// "Yolda" ekranı: konumu ve (varsa) OBD'yi canlı izler, plana göre durumu söyler, gerektiğinde yeniden planlar.
// OBD yoksa batarya tahmin edilir; sürücü göstergedeki değeri girerek düzeltebilir.
import { onIsitmaHarcanan, rotaKonumu, canliKat, canliDurum, canliMesaj, sarjDurumu, yenidenPlanla, kalanBolumler } from './core/canli.js';
import { sarjDk } from './core/model.js';
import { aralikKwh } from './core/plan.js';
import { obdDinle, obdBagli, obdKaydiAc, ogrenmeDurumu, ogrenmeKaydet } from './obd-ekran.js';
import { pencereBileseni, guncelle, hizGuncelle, OGRENME } from './core/ogrenme.js';
import { servisAl, servisBirak, servisGuncelle, servisSoyle, servisVar, periyodik, konumDinle, eylemDinle, hataDinle } from './servis.js';

const $ = id => document.getElementById(id);
const sayi = (x, b = 0) => Number(x).toLocaleString('tr-TR', { maximumFractionDigits: b, minimumFractionDigits: b });
const sure = dk => { dk = Math.round(dk); const s = Math.floor(dk / 60); return s ? `${s} sa ${dk % 60} dk` : `${dk} dk`; };
const HAVA_TAZELE_MS = 30 * 60e3, OBD_BAYAT_MS = 30e3;

let c = null;   // canlı oturum durumu

function soyle(anahtar, metin) {
  if (!c || c.soylenen.has(anahtar)) return;
  c.soylenen.add(anahtar);
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  // Önce Android metin okuması (arka planda da çalışır, navigasyon sesini kısar); yoksa tarayıcınınki.
  if (c.ses && !servisSoyle(metin) && 'speechSynthesis' in window) {
    try { const u = new SpeechSynthesisUtterance(metin); u.lang = 'tr-TR'; speechSynthesis.speak(u); } catch {}
  }
  $('canliUyari').textContent = metin;
}

async function ekranAcikTut() {
  try { c.kilit = await navigator.wakeLock?.request('screen'); } catch { c.kilit = null; }
}

function bataryaSimdi() {
  const o = c.obd, taze = o && Date.now() - o.t < OBD_BAYAT_MS;
  if (taze) return { soc: o.soc, kaynak: 'obd' };
  // Tahmin: son bilinen değerden bu yana modelin öngördüğü tüketim.
  const d = (aralikKwh(c.plan.enerji, c.cipa.km, c.km) * c.kat + onIsitmaHarcanan(c.plan, c.cipa.km, c.km)) / c.k.kap * 100;
  return { soc: Math.max(0, c.cipa.soc - d), kaynak: 'tahmin' };
}

function ciz() {
  if (!c) return;
  const b = bataryaSimdi();
  // Canlı tüketim katsayısı yalnız OBD sayaçlarıyla ölçülür.
  if (c.obd && c.obdBas) c.kat = canliKat(c.plan.enerji, c.obdBas.km, c.km, c.obd.net - c.obdBas.net).kat;
  const d = canliDurum({ plan: c.plan, k: c.k, km: c.km, soc: b.soc, kat: c.kat, varisSoc: c.varisSoc, rotaDisi: c.rotaDisi, bataryaT: c.obd?.T ?? null });
  c.son = d;

  const durakta = c.obd?.dcSarj && c.plan.duraklar.find(x => Math.abs(x.km - c.km) < 1.5);
  if (durakta) {
    const s = sarjDurumu({ durak: durakta, soc: b.soc, gucKw: c.obd.gucKw, sarjDkFn: (a, z) => sarjDk(a, z, durakta.istasyon.kw, c.k.kap, c.k.sarjOlcek || 1) });
    $('canliSira').textContent = `Şarjda: ${durakta.istasyon.marka || ''} ${durakta.istasyon.ad}`.trim();
    $('canliKalan').textContent = s.tamam ? 'Hedefe ulaşıldı' : `%${s.hedef} için ${s.kalanDk} dk`;
    $('canliVaris').textContent = `Şimdi %${sayi(b.soc)}${s.gucKw != null ? `, ${s.gucKw} kW` : ''}`;
    $('canliKarar').textContent = s.tamam ? 'Yola çıkabilirsin. Dolu araçla beklemek işgaliye ücreti doğurabilir.' : s.yavas ? `İstasyon beklenenden yavaş veriyor (${durakta.istasyon.kw} kW yazıyor).` : 'Şarj planlandığı gibi.';
    $('canliKarar').dataset.durum = s.tamam ? 'iyi' : s.yavas ? 'dar' : 'iyi';
    servisGuncelle({ baslik: s.tamam ? `Şarj tamam: %${Math.round(b.soc)}` : `Şarjda: %${Math.round(b.soc)} → %${s.hedef}, ${s.kalanDk} dk`,
                     metin: `${durakta.istasyon.marka || ''} ${durakta.istasyon.ad}`.trim() + (s.gucKw != null ? ` · ${s.gucKw} kW` : ''),
                     gitUrl: c.sonrakiUrl || c.varisUrl, gitAd: 'Yola devam' });
    if (s.tamam) soyle('sarj-tamam:' + durakta.no, `Batarya yüzde ${s.hedef}. Yola çıkabilirsin.`);
    return;
  }

  const ad = d.sira ? `${d.sira.no}. durak: ${d.sira.istasyon.marka || ''} ${d.sira.istasyon.ad}`.trim() : 'Varış';
  $('canliSira').textContent = d.bitti ? 'Vardın' : ad;
  $('canliKalan').textContent = d.bitti ? '' : `${sayi(d.kalanKm)} km, ${sure(d.kalanDk)}`;
  $('canliVaris').textContent = `Varışta %${sayi(d.hedefVarisSoc)} (plan %${sayi(d.planHedefVarisSoc)})`;
  const f = Math.round(d.farkSoc);
  $('canliSoc').textContent = `Şimdi %${sayi(b.soc)}, ${f === 0 ? 'planla aynı' : `plandan ${Math.abs(f)} puan ${f > 0 ? 'önde' : 'geride'}`}`
    + (b.kaynak === 'tahmin' ? ' · tahmini, düzeltmek için dokun' : ' · OBD')
    + (c.kat !== 1 ? ` · tüketim modelin %${sayi(c.kat * 100)}'i` : '');
  const metin = { yolunda: 'Plan tutuyor.', 'hiz-dusur': 'Pay dar: hızı 10 km/h düşür.', yetmiyor: 'Bu durağa yetmiyor: yeniden planlanıyor.',
                  onde: 'Plandan öndesin; yeniden planlarsan durak kısalabilir.', 'rota-disi': 'Rota dışındasın.' }[d.karar];
  $('canliKarar').textContent = metin + (c.planNotu ? ' ' + c.planNotu : '');
  $('canliKarar').dataset.durum = { yolunda: 'iyi', onde: 'iyi', 'hiz-dusur': 'dar', yetmiyor: 'kotu', 'rota-disi': 'dar' }[d.karar];
  const hedef = d.sira?.istasyon || null;
  $('canliGit').href = hedef ? `https://www.google.com/maps/dir/?api=1&destination=${hedef.enlem},${hedef.boylam}&travelmode=driving&dir_action=navigate` : c.varisUrl;
  $('canliGit').textContent = hedef ? 'Bu durağa yönlendir' : 'Varışa yönlendir';

  // Bildirim: Haritalar öndeyken sürücünün gördüğü kart.
  const gitUrl = $('canliGit').href;
  c.sonrakiUrl = gitUrl;
  servisGuncelle({
    baslik: d.bitti ? 'Vardın' : `${hedef ? (hedef.marka || hedef.ad) : 'Varış'}: ${sayi(d.kalanKm)} km, ${sure(d.kalanDk)}`,
    metin: `Varışta %${sayi(d.hedefVarisSoc)} (plan %${sayi(d.planHedefVarisSoc)}) · şimdi %${sayi(b.soc)}${b.kaynak === 'obd' ? '' : ' (tahmini)'} · ${metin}`,
    gitUrl, gitAd: hedef ? 'Durağa git' : 'Varışa git',
  });

  const m = canliMesaj(d);
  if (m) soyle(m.anahtar, m.metin);
  if (d.onIsitmaSimdi) soyle('isit:' + d.sira.no, `Batarya ön ısıtmasını şimdi başlat. ${d.sira.istasyon.marka || 'Durak'} ${Math.round(d.kalanKm)} kilometre sonra.`);
  if (d.karar === 'yetmiyor' && !c.otomatik.has(d.sira?.no ?? 'v')) { c.otomatik.add(d.sira?.no ?? 'v'); planla('Tüketim plandan yüksek çıktı;'); }
  if (d.karar === 'rota-disi') { c.disiBas ??= Date.now(); $('canliBuradan').hidden = Date.now() - c.disiBas < 90e3; } else { c.disiBas = null; $('canliBuradan').hidden = true; }
  if (d.bitti) soyle('bitti', 'Vardın. İyi günler.');
}

// Öğrenme penceresi: rota üstünde, şarjsız, ≥ 8 km'lik kesit. Gerçek ortalama hızla modelin bileşenleri
// hesaplanır, ölçülen enerjiyle karşılaştırılır; araç çarpanları ve hız alışkanlığı güncellenir.
function ogren(o) {
  const w = c.pencere;
  if (o.dcSarj || c.rotaDisi || !w) { c.pencere = { km: c.km, net: c.obd.net, t: o.t, soc: o.soc }; return; }
  const km = c.km - w.km, saat = (o.t - w.t) / 3.6e6;
  if (km < 8) return;
  c.pencere = { km: c.km, net: c.obd.net, t: o.t, soc: o.soc };
  const hiz = km / saat, y = c.obd.net - w.net;
  if (km > OGRENME.pencereKm[1] * 2 || !(hiz > 8 && hiz < 170) || !(y > -3 && y < 12)) return;   // GPS kopması, sayaç atlaması
  try {
    const p = pencereBileseni(c.bolumler, c.k, w.km, c.km, hiz, (w.soc + o.soc) / 2);
    let d = guncelle(ogrenmeDurumu(), { x: p.x, sabit: p.sabit, y, km });
    const tip = c.bolumler.find(b => w.km >= b.basKm && w.km < b.basKm + b.km)?.tip;
    if (tip && p.planHiz) d = hizGuncelle(d, tip, hiz, p.planHiz * (c.opt.hizKat || 1));
    ogrenmeKaydet(d);
  } catch { /* öğrenme hiçbir zaman sürüşü bozmaz */ }
}

async function planla(neden = '') {
  if (!c || c.planlaniyor) return;
  c.planlaniyor = true;
  try {
    const b = bataryaSimdi();
    let hazir = null;
    try { hazir = await c.havaTazele(kalanBolumler(c.bolumler, c.km)); c.havaT = Date.now(); } catch { hazir = null; }
    const eski = c.plan.duraklar.filter(x => x.km > c.km + 0.5).map(x => x.istasyon.id).join(',');
    const y = yenidenPlanla({ bolumler: c.bolumler, istasyonlar: c.istasyonlar, k: c.k, km: c.km, soc: b.soc, kat: c.kat, hazirKalan: hazir,
                              opt: { ...c.opt, bataryaT0: c.obd?.T ?? undefined } });
    if (y.sorun && y.sorun.tur === 'menzil' && !y.duraklar.length) {
      // Rezervin üstünde ulaşılan yok: rezervi harcamak pahasına en yakın istasyonu göster.
      const en = c.istasyonlar.filter(s => s.rotaKm > c.km + 1).sort((a, z) => a.rotaKm - z.rotaKm)[0];
      const varir = en ? b.soc - (aralikKwh(c.plan.enerji, c.km, en.rotaKm) * c.kat + 2 * en.sapmaKm * c.plan.enerji.ortWh / 1000) / c.k.kap * 100 : null;
      const metin = en ? `Rezervin üstünde ulaşılan hızlı şarj yok. En yakını ${en.marka || en.ad}, ${Math.round(en.rotaKm - c.km)} kilometre; oraya yaklaşık yüzde ${Math.max(0, Math.round(varir))} ile varırsın. Hızı düşür.`
        : 'Önünde rota üstünde hızlı şarj görünmüyor. Hızı düşür ve haritadan en yakın istasyonu ara.';
      soyle('menzil:' + Math.round(c.km / 20), metin);
      if (en) { $('canliGit').href = `https://www.google.com/maps/dir/?api=1&destination=${en.enlem},${en.boylam}&travelmode=driving&dir_action=navigate`; $('canliGit').textContent = 'En yakın istasyona yönlendir'; }
      return;
    }
    const yeni = y.duraklar.map(x => x.istasyon.id).join(',');
    c.plan = y; c.cipa = { km: c.km, soc: b.soc }; c.soylenen.clear();
    const ilk = y.duraklar[0];
    c.planNotu = yeni !== eski ? (ilk ? `Yeni plan: sıradaki durak ${ilk.istasyon.marka || ''} ${ilk.istasyon.ad}, ${sayi(ilk.km - c.km)} km sonra.` : 'Yeni plan: durmadan varıyorsun.') : '';
    if (yeni !== eski) soyle('yeni-plan:' + yeni, `${neden} ${c.planNotu}`.trim());
    c.yeniPlan?.(y);
  } finally { c.planlaniyor = false; ciz(); }
}

export function canliBaslat({ sonuc, ekOpt = {}, varisSoc, hizKat, onIsitma, sicaklikTablosu, havaTazele, varisUrl, yeniPlan, buradanPlanla }) {
  canliBitir();
  c = { plan: sonuc.plan, bolumler: sonuc.bolumler, istasyonlar: sonuc.ist.istasyonlar, k: sonuc.k, sekil: sonuc.rota.sekil, varisSoc,
        opt: { ...ekOpt, hizKat, varisSoc, onIsitma, sicaklikTablosu }, havaTazele, varisUrl, yeniPlan,
        km: 0, kat: 1, rotaDisi: false, cipa: { km: 0, soc: sonuc.k.soc0 }, obd: null, obdBas: null,
        soylenen: new Set(), otomatik: new Set(), ses: true, havaT: Date.now(), planNotu: '' };
  $('canli').hidden = false; document.body.classList.add('canli-acik');
  // Ön plan servisi: Haritalar'a geçince ya da ekran kilitlenince takip ve ses sürer.
  servisAl('canli', { baslik: 'Yol Planı: yolda', metin: 'Plan izleniyor' }).then(ok => {
    if (!ok && servisVar()) $('canliUyari').textContent = 'Arka plan servisi başlatılamadı: Haritalar öndeyken takip durabilir. Konum iznini kontrol et.';
  });
  c.eylemKes = eylemDinle(ad => { if (ad === 'yeniden') planla(''); });
  c.hataKes = hataDinle(h => { if (c) $('canliUyari').textContent = h; });
  c.tikKes = periyodik(5000, () => ciz());
  $('canliUyari').textContent = obdBagli() ? '' : 'OBD bağlı değil: batarya plandan tahmin ediliyor. Göstergedeki değeri girersen tahmin düzelir.';
  ekranAcikTut();
  c.gorunur = () => { if (document.visibilityState === 'visible' && c) ekranAcikTut(); };
  document.addEventListener('visibilitychange', c.gorunur);

  if (obdBagli()) obdKaydiAc(sonuc.plan);
  c.obdKes = obdDinle(o => {
    if (!c) return;
    c.obd = { t: o.t, soc: o.soc, gucKw: o.gucKw, T: o.bataryaMinT, dcSarj: o.dcSarj, net: (o.cedKwh ?? 0) - (o.cecKwh ?? 0) };
    // Şarj, ölçülen tüketim hesabını bozar: her şarjdan sonra ölçüm çıpası yenilenir.
    if (!c.obdBas || o.dcSarj) c.obdBas = { km: c.km, net: c.obd.net };
    ogren(o);
    c.cipa = { km: c.km, soc: o.soc };
    ciz();
  });

  c.konumKes = konumDinle(k => {
    if (!c || k.dogruluk > 80) return;
    const r = rotaKonumu({ enlem: k.enlem, boylam: k.boylam }, c.sekil, c.km);
    c.km = r.km; c.rotaDisi = r.rotaDisi; c.konum = { lat: k.enlem, lon: k.boylam };
    ciz();
    if (Date.now() - c.havaT > HAVA_TAZELE_MS && !r.rotaDisi) { c.havaT = Date.now(); planla('Hava tahmini tazelendi;'); }
  }, () => { if (c) $('canliUyari').textContent = 'Konum alınamıyor. Konum iznini ve GPS\'i kontrol et.'; });

  $('canliYeniden').onclick = () => planla('');
  $('canliSes').onclick = () => { c.ses = !c.ses; $('canliSes').textContent = c.ses ? 'Ses açık' : 'Ses kapalı'; if (!c.ses) try { speechSynthesis.cancel(); } catch {} };
  $('canliSoc').onclick = () => {
    const v = parseFloat(String(prompt('Göstergedeki batarya yüzdesi:', Math.round(bataryaSimdi().soc)) ?? '').replace(',', '.'));
    if (v >= 0 && v <= 100) { c.cipa = { km: c.km, soc: v }; ciz(); }
  };
  $('canliBuradan').onclick = () => { const k = c.konum; canliBitir(); if (k) buradanPlanla(k); };
  $('canliBitir').onclick = canliBitir;
  ciz();
}

export function canliBitir() {
  if (!c) return;
  c.konumKes?.(); c.tikKes?.(); c.eylemKes?.(); c.hataKes?.();
  servisBirak('canli');
  c.obdKes?.(); document.removeEventListener('visibilitychange', c.gorunur);
  try { c.kilit?.release(); } catch {}
  try { speechSynthesis?.cancel(); } catch {}
  c = null; $('canli').hidden = true; document.body.classList.remove('canli-acik');
}
