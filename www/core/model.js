// Tüketim, süre ve şarj modeli. Saf fonksiyonlar: arayüzden ve OBD katmanından bağımsız test edilir.
// Fiziksel alt katman fizik.js'te; buradaki işlevler onu bölüm ölçeğine uygular.
// Kalibrasyon hedefleri (EV Database, IONIQ 5 63 kWh RWD): 110 km/h 20 °C ≈ 190 Wh/km, −10 °C ≈ 245 Wh/km.
import { sicaklikKatsayisi, direncIsisi, ilerlet, TERMAL } from './termal.js';
import { SABIT, havaYogunlugu as ro, basincTahmini, akisDirenci, ruzgarBilesenleri, yardimciKw, iklimKw, inisGeriKazanim, aksesuarKw, bataryaSogutmaKw, yagisCrrKat, yukKayipKat } from './fizik.js';

export const TIP = {
  otoyol:   { ad: 'Otoyol',               f: 1.00, akis: 0.97, limit: 130, hiz: 115, renk: '--otoyol' },
  bolunmus: { ad: 'Bölünmüş devlet yolu', f: 1.04, akis: 0.92, limit: 110, hiz: 105, renk: '--devlet' },
  tek:      { ad: 'İki yönlü / dağ yolu', f: 1.10, akis: 0.88, limit: 90,  hiz: 85,  renk: '--dag' },
  sehir:    { ad: 'Şehir içi (ort. hız)', f: 1.48, akis: 1.00, limit: 50,  hiz: 35,  renk: '--sehir' },
};

export const VARSAYILAN = {
  soc0: 100, rezerv: 15, saat: '08:00', T: 20, ruzgar: 0, yuk: 150, rakim: 1000, lastik: 1, yagis: false,
  nem: 50, basincPa: null, ruzgarHizi: null, ruzgarYonu: 0,
  kap: 60, cda: 0.743, crr: 0.009, bos: 2000, verim: 0.90, sabitdk: 4,
};

const G = SABIT.g;

// Bölümün hava yoğunluğu: ölçülen basınç ve nem varsa onlar, yoksa rakımdan tahmin.
function yogunluk(k, rakim) {
  const r = rakim ?? k.rakim;
  const p = k.basincPa && rakim == null ? k.basincPa : basincTahmini(r, k.T);
  return ro(k.T, p, k.nem ?? 50);
}

// Düz yolda Wh/km. hiz km/h; k koşullar ve araç parametreleri.
// k.ruzgarHizi (m/s, 10 m) + k.ruzgarYonu + b.yolYonu varsa rüzgâr vektörel çözülür;
// yoksa eski tek sayılı k.ruzgar (km/h, karşıdan +) kullanılır.
// b: bölüm parametreleri (rota motorundan) ya da {} — yolYonu, rakim, crrKat, ruzgarKat, akisOrani.
// Tüketimin üç fiziksel bileşeni (Wh/km): hava direnci (∝ v²), yuvarlanma (km başına sabit),
// yardımcı yükler (∝ süre). k.ogren = { aero, yuv, yard } araçtan öğrenilen çarpanlardır (ogrenme.js);
// yoksa 1. Bileşenler ayrı tutulur ki öğrenme hangi terimin saptığını ayırt edebilsin.
export function whKmBilesen(tip, hiz, k, b = {}) {
  const t = TIP[tip], h = Math.max(5, hiz);
  const ruzgarKat = b.ruzgarKat ?? 1;
  const vekt = k.ruzgarHizi != null && b.yolYonu != null
    ? ruzgarBilesenleri(k.ruzgarHizi * ruzgarKat, k.ruzgarYonu ?? 0, b.yolYonu)
    : { karsi: (k.ruzgar || 0) / 3.6 * ruzgarKat, yan: 0 };
  const a = akisDirenci(h, vekt.karsi, vekt.yan, k.cda);
  const Fa = yogunluk(k, b.rakim) * a.kuvvet;
  // Karlı/sulu karlı zeminde yuvarlanma direnci ıslak yoldan belirgin yüksek [T]; kar yağışı varsa o geçerli.
  const crr = k.crr * k.lastik * (b.crrKat ?? 1) * (1 + 0.003 * Math.max(0, 20 - k.T)) * (k.kar ? 1.35 : k.yagis ? yagisCrrKat(k.yagisMm) : 1);
  const Fr = crr * (k.bos + k.yuk) * G;
  // Gece: hava servisi ışınımı 0 veriyorsa. Ölçü yoksa (elle senaryo) gündüz sayılır.
  const aks = aksesuarKw({ gece: k.gunes === 0, yagis: !!(k.yagis || k.kar), T: k.T }) + bataryaSogutmaKw(k.T);
  const yardimci = SABIT.temelKw + (k.ekYukKw || 0) + aks + iklimKw(k.T, { kabin: k.kabinC ?? SABIT.kabinC, gunes: k.gunes ?? null }) * (k.klimaKat ?? 1);
  const o = k.ogren || {};
  return {
    aero: Fa / 3.6 / k.verim * t.f * (o.aero ?? 1),
    yuv: Fr / 3.6 / k.verim * t.f * (o.yuv ?? 1),
    yard: yardimci * 1000 / (h * (b.akisOrani ?? t.akis)) * (o.yard ?? 1),
  };
}
export function whKm(tip, hiz, k, b = {}) {
  const c = whKmBilesen(tip, hiz, k, b);
  return c.aero + c.yuv + c.yard;
}

// Bir bölümün enerjisi (kWh), ortalama Wh/km ve süresi (dk). b: {tip, km, dh}
// Rota motoru bölüm için akisOrani (Valhalla ölçülü) ve tırmanış/iniş verdiyse onlar kullanılır;
// elle girilen bölümlerde yol tipinin varsayılanı ve net rakım farkı geçerlidir.
export function bolumHesap(b, hiz, k, soc = 50) {
  const m = k.bos + k.yuk;
  const cikis = b.cikis != null ? b.cikis : Math.max(0, b.dh || 0);
  const inis = b.inis != null ? b.inis : Math.max(0, -(b.dh || 0));
  const tirmanis = m * G * cikis / 3.6e6 / k.verim;                      // kWh, harcanan
  const geri = inisGeriKazanim(inis, m, b.km, hiz, soc, k.T);            // kWh, kazanılan
  const akis = b.akisOrani || TIP[b.tip].akis;
  const cekis = whKm(b.tip, hiz, k, b) * b.km / 1000 + tirmanis;
  // Bölümün ortalama çekiş gücü yüksekse (uzun tırmanış, yüksek hız, römork) kayıp oranı büyür.
  const saat = b.km / (Math.max(5, hiz) * akis);
  const yukEk = saat > 0 ? cekis * (yukKayipKat(cekis / saat) - 1) : 0;
  const kwh = cekis + yukEk - geri.kwh + (b.gecisKayipKwh || 0);
  return {
    wh: b.km > 0 ? kwh / b.km * 1000 : 0, kwh,
    dk: b.km / (Math.max(5, hiz) * akis) * 60 + (b.olayDk || 0),
    tirmanisKwh: +tirmanis.toFixed(2), geriKazanimKwh: +geri.kwh.toFixed(2),
    kisilanKwh: +geri.kisilanKwh.toFixed(2), yukKayipKwh: +yukEk.toFixed(2),
  };
}

// Referans eğri: 63 kWh E-GMP, 800 V istasyon; diğer bataryalar sarjOlcek ile ölçeklenir (bkz. arac.js). Ölçülen %10→80: 350 kW'ta 18 dk, 150 kW'ta 22 dk, 50 kW'ta 53 dk.
const EGRI = [[0, 110], [5, 150], [10, 165], [45, 175], [55, 145], [70, 125], [78, 95], [82, 55], [90, 32], [100, 8]];
export function sarjGucu(soc, olcek = 1) {
  return olcek * temelGuc(soc);
}
function temelGuc(soc) {
  for (let i = 1; i < EGRI.length; i++) {
    const [a, pa] = EGRI[i - 1], [c, pc] = EGRI[i];
    if (soc <= c) return pa + (pc - pa) * (soc - a) / (c - a);
  }
  return 8;
}
export function sarjDk(s0, s1, istasyonKw, kap, olcek = 1) {
  let saat = 0;
  for (let s = Math.floor(s0); s < s1; s++) {
    const bas = Math.max(s, s0), son = Math.min(s + 1, s1);
    saat += kap * (son - bas) / 100 / Math.min(sarjGucu(s + 0.5, olcek), istasyonKw * 0.93);
  }
  return saat * 60;
}

// Sıcaklığa duyarlı şarj benzetimi. Her %0,5 SoC adımında güç = min(eğri × ölçek × sıcaklık katsayısı,
// istasyon × 0,93); adım süresince I²R ısısı hücreyi ısıtır, ısınan hücre bir sonraki adımda daha
// hızlı alır. Soğuk başlayan şarjın "önce yavaş, sonra hızlanan" biçimi buradan çıkar.
// o: { olcek, T (hücre °C), ortamT, termal, tablo }
export function sarjSimule(s0, s1, istasyonKw, kap, o = {}) {
  const { olcek = 1, ortamT = 20, termal = TERMAL, tablo } = o;
  let T = o.T ?? 25, dk = 0, enerji = 0;
  const adim = 0.5;
  for (let s = s0; s < s1 - 1e-9; s += adim) {
    const ds = Math.min(adim, s1 - s);
    const kw = Math.max(3, Math.min(sarjGucu(s + ds / 2, olcek) * sicaklikKatsayisi(T, tablo), istasyonKw * 0.93));
    const kwh = kap * ds / 100, sure = kwh / kw * 60;
    // Soğuk hücrede BMS şarj sırasında ısıtıcıyı şebekeden çalıştırır.
    const isitici = T < termal.onIsitmaHedef ? termal.isiticiKw : 0;
    T = ilerlet(T, ortamT, direncIsisi(kw, termal) + isitici, sure, termal);
    dk += sure; enerji += kwh;
  }
  const sicakDk = sarjDk(s0, s1, istasyonKw, kap, olcek);
  return { dk, T: +T.toFixed(1), ortKw: dk > 0 ? +(enerji / (dk / 60)).toFixed(1) : 0, sicaklikKaybiDk: +(dk - sicakDk).toFixed(1) };
}

// Planı baştan sona yürütür. hizFn verilirse duraklar yok sayılır (senaryo karşılaştırması).
export function hesapla(bolumler, k, hizFn) {
  let soc = k.soc0, km = 0, surus = 0, durakDk = 0, kwh = 0, maliyet = 0;
  const satir = [];
  for (const b of bolumler) {
    const h = bolumHesap(b, hizFn ? hizFn(b) : b.hiz, k, soc);
    const bas = soc;
    soc -= h.kwh / k.kap * 100; km += b.km; surus += h.dk; kwh += h.kwh;
    const r = { ...h, bas, varis: soc, km, durak: null };
    const d = b.durak || { tur: 'yok' };
    if (!hizFn) {
      if (d.tur === 'mola') { durakDk += +d.dk || 0; r.durak = { dk: +d.dk || 0 }; }
      if (d.tur === 'sarj') {
        const hedef = Math.min(100, +d.hedef || 80), s0 = Math.max(0, soc);
        if (hedef > s0) {
          const dk = sarjDk(s0, hedef, +d.kw || 50, k.kap, k.sarjOlcek || 1) + k.sabitdk;
          const ek = (hedef - s0) / 100 * k.kap, tl = ek / 0.95 * (+d.fiyat || 0);
          durakDk += dk; maliyet += tl; r.durak = { dk, ek, tl, sonra: hedef }; soc = hedef;
        } else r.durak = { dk: 0, ek: 0, tl: 0, sonra: soc, gereksiz: true };
      }
    }
    satir.push(r);
  }
  return { satir, km, surus, durakDk, kwh, maliyet, varis: soc };
}
