// OBD paneli: bağlan, canlı oku, kayıt tut, kalibrasyon üret.
// Kayıtlar yalnızca telefonda (localStorage) durur; depoya ya da ağa gitmez.
import { ElmOturum, coz220101, hex, kesifTara } from './core/obd.js';
import { bleBaglan } from './core/ble.js';
import { sarjOturumlari, sicaklikTablosu, kapasiteTahmini, tuketimKatsayisi } from './core/kalibrasyon.js';
import { mesafeKm } from './core/istasyon.js';
import { olcumOzeti } from './core/olcum.js';

const $ = id => document.getElementById(id);
const sayi = (x, b = 0) => x == null || Number.isNaN(x) ? '–' : Number(x).toLocaleString('tr-TR', { maximumFractionDigits: b, minimumFractionDigits: b });
const depo = {
  al(k, v) { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch { return v; } },
  koy(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const EN_FAZLA = 8000;   // ~2 MB; 5 sn aralıkla ~11 saat

const obd = { tampon: [], oturum: null, baglanti: null, zamanlayici: null, izleme: null, km: 0, sonKonum: null, gunluk: [], yolculuk: null };
export const kalibrasyon = () => depo.al('kalibrasyon', null);
// İstasyon no → en son ölçümler (yalnızca bu telefonda).
export const olcumler = () => depo.al('olcumler', []);

function gunlukYaz(k, y) {
  obd.gunluk.push(`> ${k}\n${String(y).trim()}`);
  if (obd.gunluk.length > 60) obd.gunluk.shift();
  $('obdHam').textContent = obd.gunluk.slice(-12).join('\n');
}
const durum = (m, hata = false) => { $('obdDurum').textContent = m; $('obdDurum').classList.toggle('hata', hata); };

function goster(d) {
  const satir = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`;
  $('obdDegerler').innerHTML =
    satir('Batarya (BMS)', `%${sayi(d.socBms, 1)}`) +
    satir('Güç', `${sayi(d.gucKw, 1)} kW ${d.gucKw < 0 ? '(şarj)' : ''}`) +
    satir('Gerilim, akım', `${sayi(d.voltajV, 1)} V, ${sayi(d.akimA, 1)} A`) +
    satir('Hücre sıcaklığı', `${d.bataryaMinT}–${d.bataryaMaxT} °C`) +
    satir('Hücre gerilimi', `${sayi(d.hucreMinV, 2)}–${sayi(d.hucreMaxV, 2)} V (fark ${d.hucreFarkMv} mV)`) +
    satir('12 V akü', `${sayi(d.yardimciAkuV, 1)} V`) +
    satir('Sayaçlar', `şarj ${sayi(d.cecKwh, 1)}, deşarj ${sayi(d.cedKwh, 1)} kWh`);
}

async function baglan() {
  try {
    durum('Adaptör aranıyor…');
    obd.baglanti = await bleBaglan({ kopunca: () => { durum('Bağlantı koptu.', true); kaydiDurdur(); obd.oturum = null; } });
    durum(`${obd.baglanti.cihaz.ad} bağlandı; başlatılıyor…`);
    obd.oturum = new ElmOturum(obd.baglanti.tasima, { gunluk: gunlukYaz });
    await obd.oturum.baslat();
    durum(`${obd.baglanti.cihaz.ad} hazır. Hizmet ${obd.baglanti.kanal.hizmet.slice(4, 8)}.`);
    $('obdOku').disabled = $('obdKayit').disabled = false;
  } catch (e) { durum(e.message, true); }
}

async function oku() {
  if (!obd.oturum) return null;
  const b = await obd.oturum.oku('220101');
  const d = coz220101(b);
  goster(d);
  return { d, ham: hex(b) };
}

async function tekOku() {
  try {
    await oku();
    // Diğer modüller: yanıt verenler ham olarak telefonda saklanır; çözücü ilk gerçek çıktıyla yazılacak.
    durum('BMS okundu; diğer modüller taranıyor…');
    const k = await kesifTara(obd.oturum);
    depo.koy('obd:kesif', { t: Date.now(), sonuc: k });
    const var_ = k.filter(x => x.yanit);
    // Açık kaynak tablolarıyla çözülen değerler: ekranda "doğrulanmadı" notuyla gösterilir.
    const v = Object.assign({}, ...k.filter(x => x.deger).map(x => x.deger));
    const ek = [];
    if (v.sohYuzde != null) ek.push(['Batarya sağlığı (SoH)', `%${sayi(v.sohYuzde, 1)}`]);
    if (v.socGosterge != null) ek.push(['Gösterge SoC', `%${sayi(v.socGosterge, 1)}`]);
    if (v.sogutmaSuyuC != null) ek.push(['Batarya soğutma suyu', `${sayi(v.sogutmaSuyuC)} °C`]);
    if (v.disC != null) ek.push(['Dış / iç sıcaklık', `${sayi(v.disC, 1)} / ${sayi(v.icC, 1)} °C`]);
    if (v.odoKm != null) ek.push(['Kilometre', `${sayi(v.odoKm)} km`]);
    if (v.onSol?.bar != null) ek.push(['Lastik basıncı (bar)', [v.onSol, v.onSag, v.arkaSol, v.arkaSag].map(t => sayi(t.bar, 2)).join(' · ')]);
    if (ek.length) $('obdDegerler').insertAdjacentHTML('beforeend',
      ek.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('') + '<dt>Not</dt><dd>Bu ek değerler açık kaynak tablolarıyla çözüldü; gösterge panelindeki değerlerle karşılaştır.</dd>');
    depo.koy('obd:arac', { t: Date.now(), ...v });
    durum(`${var_.length}/${k.length} modül yanıt verdi: ${var_.map(x => x.ne.split(':')[0]).join(', ') || 'yok'}. `
      + '"Ham çıktıyı kopyala" ile paylaşırsan çözücüleri yazarım.');
  } catch (e) { durum('Okuma hatası: ' + e.message, true); }
}

function konumIzle() {
  if (!navigator.geolocation) return;
  obd.izleme = navigator.geolocation.watchPosition(p => {
    if (p.coords.accuracy > 50) return;
    const n = [p.coords.latitude, p.coords.longitude];
    if (obd.sonKonum) { const d = mesafeKm(obd.sonKonum, n); if (d > 0.02 && d < 5) obd.km += d; }
    obd.sonKonum = n;
  }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
}

function tamponuYaz() {
  if (!obd.tampon.length) return;
  const liste = depo.al('obd:ornekler', []).concat(obd.tampon);
  obd.tampon = [];
  if (liste.length > EN_FAZLA) liste.splice(0, liste.length - EN_FAZLA);
  if (!depo.koy('obd:ornekler', liste)) durum('Telefon deposu doldu; eski kayıtları silin.', true);
}

function kaydiBaslat(plan) {
  obd.km = 0; obd.sonKonum = null;
  obd.yolculuk = plan ? { planKwh: plan.toplamKwh, planKm: plan.toplamKm, bas: null, son: null } : { bas: null, son: null };
  konumIzle();
  const tur = async () => {
    try {
      const { d, ham } = await oku();
      const o = { t: Date.now(), soc: d.socBms, gucKw: d.gucKw, bataryaMinT: d.bataryaMinT, bataryaMaxT: d.bataryaMaxT,
                  cecKwh: d.cecKwh, cedKwh: d.cedKwh, dcSarj: d.dcSarj, km: +obd.km.toFixed(2), ham };
      // Konum yalnızca DC şarj sırasında ve yalnızca istasyonu eşlemek için saklanır.
      if (d.dcSarj && obd.sonKonum) { o.enlem = +obd.sonKonum[0].toFixed(5); o.boylam = +obd.sonKonum[1].toFixed(5); }
      obd.tampon.push(o);
      // Depoya dakikada bir yazılır: 2 MB'lık listeyi her 5 saniyede yeniden yazmak pili yorar.
      if (obd.tampon.length >= 12) tamponuYaz();
      if (obd.yolculuk) { obd.yolculuk.bas ??= o; obd.yolculuk.son = o; }
      $('obdKayitBilgi').textContent = `Kayıt sürüyor: bu yolculuk ${sayi(obd.km, 1)} km${d.dcSarj ? ', DC şarj kaydediliyor' : ''}.`;
    } catch (e) { gunlukYaz('kayıt', e.message); }
  };
  tur(); obd.zamanlayici = setInterval(tur, 5000);
  $('obdKayit').textContent = 'Kaydı durdur';
}

function kaydiDurdur() {
  clearInterval(obd.zamanlayici); obd.zamanlayici = null;
  tamponuYaz();
  if (obd.izleme != null) navigator.geolocation.clearWatch(obd.izleme); obd.izleme = null;
  $('obdKayit').textContent = 'Kaydı başlat';
  // Planlı bir yolculuk tamamlandıysa tüketim karşılaştırması için sakla.
  const y = obd.yolculuk;
  if (y?.bas && y?.son && y.planKwh && obd.km >= 20) {
    const olculen = (y.son.cedKwh - y.bas.cedKwh) - (y.son.cecKwh - y.bas.cecKwh);
    const liste = depo.al('obd:yolculuklar', []);
    liste.push({ t: Date.now(), km: +obd.km.toFixed(1), olculenKwh: +olculen.toFixed(1), modelKwh: +(y.planKwh * obd.km / y.planKm).toFixed(1) });
    depo.koy('obd:yolculuklar', liste);
  }
  obd.yolculuk = null;
}

export function kalibrasyonGuncelle(olcek = 1, istasyonlar = []) {
  tamponuYaz();
  const ornekler = depo.al('obd:ornekler', []);
  const oturumlar = sarjOturumlari(ornekler);
  const st = sicaklikTablosu(oturumlar, { olcek });
  const kapasiteler = oturumlar.filter(o => o.kwh != null).map(o => kapasiteTahmini(
    { soc: o.soc0, cecKwh: 0, cedKwh: 0 }, { soc: o.soc1, cecKwh: o.kwh, cedKwh: 0 })).filter(Boolean);
  const tk = tuketimKatsayisi(depo.al('obd:yolculuklar', []));
  const k = {
    tarih: new Date().toISOString().slice(0, 10), oturum: oturumlar.length, olculenDilim: st.olculen,
    sicaklikTablosu: st.olculen ? st.tablo : null,
    kapasiteKwh: kapasiteler.length ? +(kapasiteler.reduce((a, b) => a + b, 0) / kapasiteler.length).toFixed(1) : null,
    tuketimKat: tk.yolculuk ? tk.kat : null, yolculuk: tk.yolculuk,
  };
  depo.koy('kalibrasyon', k);
  if (istasyonlar.length) {
    const yeni = oturumlar.map(o => ({ bas: o.bas, ...olcumOzeti(o, istasyonlar, { olcek, tablo: k.sicaklikTablosu || undefined }) }))
      .filter(o => o.istasyonNo);
    const eski = olcumler().filter(o => !yeni.some(y => y.bas === o.bas));
    depo.koy('olcumler', eski.concat(yeni).slice(-300));
    k.olcum = yeni.length;
  }
  return k;
}

export function kalibrasyonMetni(k = kalibrasyon()) {
  if (!k) return 'Henüz kalibrasyon yok. Bir hızlı şarj ve bir planlı yolculuğu kaydedince model kendi aracına uyar.';
  const p = [];
  p.push(`${k.oturum} şarj oturumu, ${k.olculenDilim} sıcaklık dilimi ölçüldü`);
  if (k.kapasiteKwh) p.push(`kullanılabilir kapasite ≈ ${sayi(k.kapasiteKwh, 1)} kWh`);
  if (k.tuketimKat) p.push(`tüketim modelin %${sayi(k.tuketimKat * 100)}'i (${k.yolculuk} yolculuk)`);
  const o = olcumler();
  if (o.length) p.push(`${o.length} şarj bir istasyonla eşlendi${o.some(x => x.dusuk) ? `, ${o.filter(x => x.dusuk).length} tanesi beklenenin belirgin altında` : ''}`);
  return p.join('; ') + `. Güncelleme: ${k.tarih}.`;
}

export function obdPaneli({ planGetir, olcekGetir, istasyonlarGetir = async () => [] }) {
  $('obdDugme').onclick = () => { $('obdKalib').textContent = kalibrasyonMetni(); $('obdDialog').showModal(); };
  $('obdBaglan').onclick = baglan;
  $('obdOku').onclick = tekOku;
  $('obdKayit').onclick = () => (obd.zamanlayici ? kaydiDurdur() : kaydiBaslat(planGetir()));
  $('obdKopya').onclick = async () => {
    try { await navigator.clipboard.writeText(obd.gunluk.join('\n\n')); durum('Ham çıktı panoya kopyalandı.'); }
    catch { durum('Panoya kopyalanamadı; metni uzun basıp seçebilirsin.', true); }
  };
  $('obdGuncelle').onclick = async () => {
    let ist = [];
    try { ist = await istasyonlarGetir(); } catch {}
    $('obdKalib').textContent = kalibrasyonMetni(kalibrasyonGuncelle(olcekGetir(), ist));
  };
  $('obdSil').onclick = () => {
    if (!confirm('Telefondaki tüm OBD kayıtları ve kalibrasyon silinsin mi?')) return;
    ['obd:ornekler', 'obd:yolculuklar', 'kalibrasyon', 'olcumler'].forEach(k => localStorage.removeItem(k));
    $('obdKalib').textContent = kalibrasyonMetni(null); $('obdKayitBilgi').textContent = '';
  };
}
