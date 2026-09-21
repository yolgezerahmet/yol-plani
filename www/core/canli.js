// Yolda (canlı) mod: konum + ölçülen batarya → plana göre neredeyiz, sıradaki durağa yetiyor mu,
// ne yapmalı. Saf fonksiyonlar; GPS, OBD ve ses arayüz katmanında.
import { rotayaIzdusur } from './istasyon.js';
import { kwhKmde, aralikKwh, durakPlanla } from './plan.js';

export const CANLI = {
  rotaDisiKm: 1.5,        // rotadan bu kadar uzaklaşınca "rota dışı"
  enAzKm: 15,             // canlı tüketim katsayısı için gereken en az yol
  tamGuvenKm: 60,         // bu kadar yoldan sonra ölçüme tam güvenilir
  katAlt: 0.8, katUst: 1.45,
  darPay: 3,              // rezervin üstünde bu kadar puan kalıyorsa "hızı düşür"
  fazlaPay: 8,            // plana göre bu kadar puan öndeysek yeniden planlamaya değer
};

// Konum → rotanın kaçıncı km'si. Rota kendine yaklaşan kıvrımlar içerebilir; önceki konumdan
// geriye büyük sıçrama kabul edilmez (GPS sapması ya da karşı şerit).
export function rotaKonumu(konum, sekil, oncekiKm = 0) {
  const r = rotayaIzdusur({ enlem: konum.enlem, boylam: konum.boylam }, sekil);
  const rotaDisi = r.sapmaKm > CANLI.rotaDisiKm;
  const km = !rotaDisi && r.rotaKm < oncekiKm - 3 ? oncekiKm : r.rotaKm;
  return { km, sapmaKm: r.sapmaKm, rotaDisi };
}

// Planın o km'deki beklenen bataryası. Profilde durak dikey sıçramadır; durak km'sinde varış değeri döner.
export function planSoc(profil, km) {
  if (km <= profil[0][0]) return profil[0][1];
  for (let i = 1; i < profil.length; i++) {
    const [x0, y0] = profil[i - 1], [x1, y1] = profil[i];
    if (km <= x1) return x1 === x0 ? y0 : y0 + (y1 - y0) * (km - x0) / (x1 - x0);
  }
  return profil[profil.length - 1][1];
}

// Rotanın x km'sine kadar birikimli sürüş süresi (dk).
export function dkKmde(e, x) {
  let dk = 0;
  for (const s of e.satir) {
    if (x >= s.basKm + s.km) { dk += s.dk; continue; }
    if (x > s.basKm) dk += s.dk * (x - s.basKm) / s.km;
    break;
  }
  return dk;
}

// Canlı tüketim katsayısı: bu yolculukta ölçülen / modelin aynı yol için öngördüğü.
// Kısa yolda gürültülüdür; yol uzadıkça ölçüme güven artar. bas: { km, kwh } yolculuk başındaki
// sayaç (OBD CED−CEC) ve rota km'si.
export function canliKat(e, basKm, simdiKm, olculenKwh) {
  const yol = simdiKm - basKm, model = aralikKwh(e, basKm, simdiKm);
  if (olculenKwh == null || yol < CANLI.enAzKm || model <= 0) return { kat: 1, guven: 0, oran: null };
  const oran = Math.max(CANLI.katAlt, Math.min(CANLI.katUst, olculenKwh / model));
  const guven = Math.min(1, yol / CANLI.tamGuvenKm);
  return { kat: +(1 + (oran - 1) * guven).toFixed(3), guven: +guven.toFixed(2), oran: +oran.toFixed(3) };
}

// a–b km arasında ön ısıtmaya giden enerji (kWh): plan ısıtmayı baslaKm → durak arasına eşit yayar.
export function onIsitmaHarcanan(plan, a, b) {
  let kwh = 0;
  for (const d of plan.duraklar) {
    const oi = d.onIsitma; if (!oi) continue;
    const bas = Math.max(a, oi.baslaKm), son = Math.min(b, d.km);
    if (son > bas) kwh += oi.kwh * (son - bas) / Math.max(1, d.km - oi.baslaKm);
  }
  return kwh;
}

// Anlık durum ve karar. plan: durakPlanla çıktısı; k: koşullar (kap, rezerv); km, soc: şimdi.
export function canliDurum({ plan, k, km, soc, kat = 1, varisSoc = k.rezerv, rotaDisi = false, bataryaT = null }) {
  const e = plan.enerji, kap = k.kap;
  const dus = (a, b) => aralikKwh(e, a, b) * kat / kap * 100;
  // Durakta şarj edilmişse beklenen değer varış değil, şarj hedefidir.
  const burada = plan.duraklar.find(d => Math.abs(d.km - km) < 1);
  const oncekiKm = [...plan.duraklar].reverse().find(d => d.km <= km)?.km ?? (plan.yenidenKm || 0);
  const beklenen = burada && soc > (burada.varisSoc + burada.hedefSoc) / 2 ? burada.hedefSoc
    : planSoc(plan.profil, km) - onIsitmaHarcanan(plan, oncekiKm, km) / kap * 100;
  const kalanDuraklar = plan.duraklar.filter(d => d.km > km + 0.5);
  const sira = kalanDuraklar[0] || null;
  const hedefKm = sira ? sira.km : e.toplamKm;
  // Planlayıcıyla aynı muhasebe: istasyona sapmanın gidiş-dönüşü varışta düşülür, yarısı çıkışta.
  const sapma = d => 2 * (d.istasyon.sapmaKm || 0) * e.ortWh / 1000 * kat / kap * 100;
  // Ön ısıtma enerjisi de planın varış değerine dahildir; başladıysa kalan kısmı sayılır.
  const isitma = d => {
    const oi = d.onIsitma; if (!oi) return 0;
    const kalanOran = km <= oi.baslaKm ? 1 : Math.max(0, (d.km - km) / Math.max(1, d.km - oi.baslaKm));
    return oi.kwh * kalanOran / kap * 100;
  };
  const hedefVaris = soc - dus(km, hedefKm) - (sira ? sapma(sira) + isitma(sira) : 0);
  // Planlı şarjlar yapılırsa varıştaki batarya.
  let s = soc, x = km;
  for (const d of kalanDuraklar) { s -= dus(x, d.km) + sapma(d) + isitma(d); s = Math.max(s, d.hedefSoc) - sapma(d) / 2; x = d.km; }
  const varis = s - dus(x, e.toplamKm);
  const esik = sira ? k.rezerv : varisSoc;

  let karar = 'yolunda';
  if (rotaDisi) karar = 'rota-disi';
  else if (hedefVaris < esik) karar = 'yetmiyor';
  else if (hedefVaris < esik + CANLI.darPay) karar = 'hiz-dusur';
  else if (soc - beklenen >= CANLI.fazlaPay && kalanDuraklar.length) karar = 'onde';
  else if (!sira && varis < varisSoc) karar = 'yetmiyor';

  const oi = sira?.onIsitma;
  return {
    km: +km.toFixed(1), soc: +soc.toFixed(1), beklenenSoc: +beklenen.toFixed(1), farkSoc: +(soc - beklenen).toFixed(1),
    sira, kalanKm: +(hedefKm - km).toFixed(1), kalanDk: Math.round(dkKmde(e, hedefKm) - dkKmde(e, km)),
    hedefVarisSoc: +hedefVaris.toFixed(1), planHedefVarisSoc: sira ? sira.varisSoc : plan.varisSoc,
    varisSoc: +varis.toFixed(1), karar, kat,
    // Ön ısıtma: planın söylediği km geçildiyse ve hücre hâlâ soğuksa şimdi başlat.
    onIsitmaSimdi: !!(oi && km >= oi.baslaKm && km < sira.km - 3 && (bataryaT == null || bataryaT < 22)),
    bitti: km >= e.toplamKm - 0.5,
  };
}

// Kararın sürücüye söylenecek kısa hâli. Aynı anahtar art arda okunmaz (arayüz süzer).
export function canliMesaj(d) {
  const ad = d.sira ? (d.sira.istasyon.marka || d.sira.istasyon.ad) : 'varış';
  const y = x => Math.round(x);
  switch (d.karar) {
    case 'rota-disi': return { anahtar: 'rota-disi', metin: 'Planlanan rotanın dışındasın. Tahminler güncel değil; rotaya dönünce devam eder.' };
    case 'yetmiyor': return { anahtar: 'yetmiyor:' + (d.sira?.no ?? 'v'), metin: `Dikkat. Bu tüketimle ${ad} noktasına yüzde ${y(d.hedefVarisSoc)} ile varırsın; rezervin altında. Daha yakın bir durak için yeniden planla.` };
    case 'hiz-dusur': return { anahtar: 'hiz:' + (d.sira?.no ?? 'v'), metin: `${ad} noktasına varış yüzde ${y(d.hedefVarisSoc)} görünüyor; pay dar. Hızı on kilometre düşürmek yaklaşık üç puan kazandırır.` };
    case 'onde': return { anahtar: 'onde:' + d.sira.no, metin: `Plandan yüzde ${y(d.farkSoc)} öndesin. Yeniden planlarsan durak kısalabilir ya da atlanabilir.` };
    default: return null;
  }
}

// Durakta şarj: hedefe kalan süre ve "çekebilirsin" anı. sarjDkFn(s0, s1) modelden gelir.
export function sarjDurumu({ durak, soc, gucKw, sarjDkFn }) {
  const hedef = durak.hedefSoc, tamam = soc >= hedef - 0.5;
  return { hedef, tamam, kalanDk: tamam ? 0 : Math.max(1, Math.round(sarjDkFn(soc, hedef))), gucKw: gucKw != null ? Math.round(Math.abs(gucKw)) : null,
           yavas: gucKw != null && Math.abs(gucKw) < 0.45 * durak.istasyon.kw && soc < 60 };
}

// ---- Kalan yol için yeniden planlama ---------------------------------------------------------
// Bölümleri km'den keser; kesilen bölümün tırmanış/iniş/olay değerleri orantılı bölünür.
export function kalanBolumler(bolumler, km) {
  const r = [];
  for (const b of bolumler) {
    const son = b.basKm + b.km;
    if (son <= km + 0.05) continue;
    if (b.basKm >= km) { r.push({ ...b, basKm: +(b.basKm - km).toFixed(2) }); continue; }
    const o = (son - km) / b.km, p = v => (v == null ? v : +(v * o).toFixed(2));
    r.push({ ...b, basKm: 0, km: +(son - km).toFixed(2), cikis: p(b.cikis), inis: p(b.inis), dh: p(b.dh),
             olayDk: p(b.olayDk), ucretliKm: p(b.ucretliKm), gecisKayipKwh: 0 });
  }
  return r;
}

// Şimdiki konum ve bataryayla kalan yolu planlar; sonuç özgün rota km'sine geri kaydırılır,
// böylece ekran ve navigasyon aynı km eksenini kullanmaya devam eder.
// hazirKalan: havası tazelenmiş kalan bölümler (kalanBolumler çıktısı biçiminde) verilirse onlar kullanılır.
export function yenidenPlanla({ bolumler, istasyonlar, k, km, soc, kat = 1, opt = {}, hazirKalan = null }) {
  const kb = hazirKalan || kalanBolumler(bolumler, km);
  const ki = istasyonlar.filter(s => s.rotaKm > km + 2).map(s => ({ ...s, rotaKm: +(s.rotaKm - km).toFixed(1) }));
  const kk = { ...k, soc0: soc, tuketimKat: (k.tuketimKat ?? 1) * kat };
  const p = durakPlanla(kb, ki, kk, opt);
  const kaydir = x => +(x + km).toFixed(1);
  return {
    ...p,
    duraklar: p.duraklar.map(d => ({ ...d, km: kaydir(d.km), istasyon: { ...d.istasyon, rotaKm: kaydir(d.istasyon.rotaKm) },
      onIsitma: d.onIsitma ? { ...d.onIsitma, baslaKm: kaydir(d.onIsitma.baslaKm) } : d.onIsitma,
      yedekler: (d.yedekler || []).map(y => ({ ...y, rotaKm: kaydir(y.rotaKm) })) })),
    profil: p.profil.map(([x, y]) => [kaydir(x), y]),
    enerji: { ...p.enerji, km: p.enerji.km.map(kaydir), satir: p.enerji.satir.map(s => ({ ...s, basKm: kaydir(s.basKm) })),
              toplamKm: kaydir(p.enerji.toplamKm), kaydirmaKm: km },
    yenidenKm: km,
  };
}
