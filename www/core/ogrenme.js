// Kendi kendine öğrenen tüketim modeli.
//
// Fikir (literatür: De Cauwer ve ark. 2015, 2017 — fiziksel bileşenler üstünde regresyon;
// Zhu ve ark. 2025 — fizik temelli özellikler + araca özel çevrimiçi uyarlama hatayı düşürür):
// tek bir "tüketim katsayısı" yerine üç fiziksel bileşenin çarpanı öğrenilir:
//     ölçülen ≈ θa·E_aero + θy·E_yuv + θk·E_yard + (tırmanış − geri kazanım)
// E_* modelin o pencere için, GERÇEK sürüş hızıyla hesapladığı enerjilerdir. Böylece sürücünün
// plandan hızlı/yavaş gitmesi araç katsayılarına karışmaz; o ayrı öğrenilir (hız alışkanlığı).
//
// Yöntem: önsel bilgili özyinelemeli en küçük kareler (durağan durumlu Kalman süzgeci).
// Önsel θ = 1. Az veriyle model katalog değerinde kalır; veri geldikçe araca kayar. Sabit hızlı
// otoyolda bileşenler ayrışmaz (eşdoğrusal); süzgeç o zaman düzeltmeyi önsel belirsizliğe göre
// paylaştırır, hız çeşitlendikçe ayırır. Küçük süreç gürültüsü mevsim/lastik kaymasını izler.
import { whKmBilesen, bolumHesap, TIP } from './model.js';
import { bolumKosulu } from './plan.js';

export const OGRENME = {
  onselSigma: [0.12, 0.15, 0.30],   // aero, yuvarlanma, yardımcı: katalog değerine güven [T]
  surec: 2e-5,                      // pencere başına kayma varyansı
  olcumOran: 0.06, olcumTaban: 0.04,// ölçüm gürültüsü: %6 + 0,04 kWh (SoC/sayaç çözünürlüğü)
  alt: 0.7, ust: 1.5,
  enAzPencere: 8,                   // bundan önce plana uygulanmaz
  pencereKm: [3, 12],
};

export const bosDurum = () => ({
  teta: [1, 1, 1],
  P: OGRENME.onselSigma.map((s, i) => OGRENME.onselSigma.map((_, j) => (i === j ? s * s : 0))),
  n: 0, km: 0, hataKare: 0.0049, hiz: {},      // hataKare: göreli artık karesinin üstel ortalaması (başlangıç %7)
});

// Bir pencerenin model bileşenleri (kWh), gerçek ortalama hızla. bolumler: havası işlenmiş rota bölümleri.
export function pencereBileseni(bolumler, k, aKm, bKm, gercekHiz, soc = 50) {
  const x = [0, 0, 0]; let sabit = 0, planSaat = 0;
  const k0 = { ...k, ogren: null };            // öğrenilen çarpanlar özelliklere karışmasın
  for (const b of bolumler) {
    const bas = Math.max(aKm, b.basKm), son = Math.min(bKm, b.basKm + b.km);
    if (son <= bas) continue;
    const km = son - bas, oran = km / b.km;
    const kb = bolumKosulu(k0, b);
    const c = whKmBilesen(b.tip, gercekHiz, kb, b);
    x[0] += c.aero * km / 1000; x[1] += c.yuv * km / 1000; x[2] += c.yard * km / 1000;
    const parca = { ...b, km, cikis: (b.cikis || 0) * oran, inis: (b.inis || 0) * oran, gecisKayipKwh: 0, olayDk: 0 };
    const h = bolumHesap(parca, gercekHiz, kb, soc);
    sabit += h.tirmanisKwh - h.geriKazanimKwh + h.yukKayipKwh;
    planSaat += km / Math.max(5, (b.hiz || 90) * (b.akisOrani || TIP[b.tip].akis));
  }
  return { x, sabit, planHiz: planSaat > 0 ? (bKm - aKm) / planSaat : null };
}

// Tek gözlemle güncelleme. y: ölçülen kWh (pencere), x: bileşenler, sabit: öğrenilmeyen kısım.
export function guncelle(d, { x, sabit, y, km }) {
  const z = y - sabit, tahmin = x.reduce((t, v, i) => t + v * d.teta[i], 0);
  if (!(tahmin > 0) || !(km > 0)) return d;
  const P = d.P.map((r, i) => r.map((v, j) => v + (i === j ? OGRENME.surec : 0)));
  const R = (OGRENME.olcumOran * Math.abs(z)) ** 2 + OGRENME.olcumTaban ** 2;
  const Px = P.map(r => r.reduce((t, v, j) => t + v * x[j], 0));
  const S = x.reduce((t, v, i) => t + v * Px[i], 0) + R;
  const art = z - tahmin;
  // Aykırı pencere (GPS sıçraması, sayaç atlaması): 4σ dışı yok sayılır.
  if (art * art > 16 * S) return { ...d, atlanan: (d.atlanan || 0) + 1 };
  const K = Px.map(v => v / S);
  const teta = d.teta.map((t, i) => Math.min(OGRENME.ust, Math.max(OGRENME.alt, t + K[i] * art)));
  const Pn = P.map((r, i) => r.map((v, j) => v - K[i] * Px[j]));
  const goreli = art / Math.max(0.05, z);
  return { ...d, teta, P: Pn, n: d.n + 1, km: +(d.km + km).toFixed(1),
           hataKare: d.hataKare * 0.9 + goreli * goreli * 0.1 };
}

// Sürücünün hız alışkanlığı: yol tipine göre gerçek/plan hız oranı (üstel ortalama).
export function hizGuncelle(d, tip, gercekHiz, planHiz) {
  if (!(planHiz > 20) || !(gercekHiz > 20)) return d;
  const oran = Math.min(1.3, Math.max(0.7, gercekHiz / planHiz));
  const e = d.hiz[tip] || { oran: 1, n: 0 };
  const a = e.n < 5 ? 1 / (e.n + 1) : 0.15;
  return { ...d, hiz: { ...d.hiz, [tip]: { oran: +(e.oran + (oran - e.oran) * a).toFixed(3), n: e.n + 1 } } };
}

// Plana uygulanacak çarpanlar; yeterli veri yoksa null (katalog modeli + eski tek katsayı geçerli).
export function ogrenilen(d) {
  if (!d || d.n < OGRENME.enAzPencere) return null;
  const [aero, yuv, yard] = d.teta.map(v => +v.toFixed(3));
  return { aero, yuv, yard };
}

// Ölçülmüş tahmin belirsizliği (σ, oran): risk hesabında varsayımın yerini alır.
export const olculenSigma = d => (d && d.n >= OGRENME.enAzPencere ? +Math.sqrt(d.hataKare).toFixed(4) : null);

// İnsan diliyle: araç katalogdan nerede ayrışıyor?
export function ogrenmeOzeti(d) {
  const o = ogrenilen(d); if (!o) return d?.n ? `Öğreniyor: ${d.n}/${OGRENME.enAzPencere} ölçüm penceresi.` : null;
  const p = [], f = (v, ad, cok, az) => { const y = Math.round((v - 1) * 100); if (Math.abs(y) >= 3) p.push(`${ad} katalogdan %${Math.abs(y)} ${y > 0 ? cok : az}`); };
  f(o.aero, 'hava direncin', 'yüksek', 'düşük'); f(o.yuv, 'yuvarlanma direncin', 'yüksek', 'düşük'); f(o.yard, 'klima ve yardımcı yüklerin', 'yüksek', 'düşük');
  const hizlar = Object.entries(d.hiz).filter(([, v]) => v.n >= 5 && Math.abs(v.oran - 1) >= 0.03)
    .map(([t, v]) => `${TIP[t]?.ad?.toLocaleLowerCase('tr-TR') || t} yolda planın %${Math.round(Math.abs(v.oran - 1) * 100)} ${v.oran > 1 ? 'üstünde' : 'altında'} gidiyorsun`);
  return `${d.km} km'lik ölçümden öğrenildi: ` + (p.length ? p.join(', ') : 'aracın katalog modeline uyuyor') + (hizlar.length ? '; ' + hizlar.join(', ') : '')
    + `. Tahmin hatası ±%${Math.round(Math.sqrt(d.hataKare) * 100)}.`;
}
