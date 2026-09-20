// Tüketim, süre ve şarj modeli. Saf fonksiyonlar: arayüzden ve OBD katmanından bağımsız test edilir.
// Kalibrasyon hedefleri (EV Database, IONIQ 5 63 kWh RWD): 110 km/h 20 °C ≈ 190 Wh/km, −10 °C ≈ 245 Wh/km.

export const TIP = {
  otoyol:   { ad: 'Otoyol',               f: 1.00, akis: 0.97, limit: 130, hiz: 115, renk: '--otoyol' },
  bolunmus: { ad: 'Bölünmüş devlet yolu', f: 1.04, akis: 0.92, limit: 110, hiz: 105, renk: '--devlet' },
  tek:      { ad: 'İki yönlü / dağ yolu', f: 1.10, akis: 0.88, limit: 90,  hiz: 85,  renk: '--dag' },
  sehir:    { ad: 'Şehir içi (ort. hız)', f: 1.48, akis: 1.00, limit: 50,  hiz: 35,  renk: '--sehir' },
};

export const VARSAYILAN = {
  soc0: 100, rezerv: 15, saat: '08:00', T: 20, ruzgar: 0, yuk: 150, rakim: 1000, lastik: 1, yagis: false,
  kap: 60, cda: 0.743, crr: 0.009, bos: 2000, verim: 0.90, sabitdk: 4,
};

const G = 9.81;

export function havaYogunlugu(T, rakim) {
  return 1.225 * 288.15 / (T + 273.15) * Math.exp(-rakim / 8500);
}

// Düz yolda Wh/km. hiz km/h; k koşullar ve araç parametreleri.
export function whKm(tip, hiz, k) {
  const t = TIP[tip], h = Math.max(5, hiz), v = h / 3.6;
  const va = Math.max(0, v + k.ruzgar / 3.6);
  const Fa = 0.5 * havaYogunlugu(k.T, k.rakim) * k.cda * va * va;
  const crr = k.crr * k.lastik * (1 + 0.003 * Math.max(0, 20 - k.T)) * (k.yagis ? 1.15 : 1);
  const Fr = crr * (k.bos + k.yuk) * G;
  const yardimci = 0.5 + 0.14 * Math.max(0, 17 - k.T) + 0.07 * Math.max(0, k.T - 24); // kW
  return (Fa + Fr) / 3.6 / k.verim * t.f + yardimci * 1000 / (h * t.akis);
}

// Bir bölümün enerjisi (kWh), ortalama Wh/km ve süresi (dk). b: {tip, km, dh}
export function bolumHesap(b, hiz, k) {
  const Eh = (k.bos + k.yuk) * G * b.dh / 3600 / 1000;
  const kwh = whKm(b.tip, hiz, k) * b.km / 1000 + (b.dh >= 0 ? Eh / k.verim : Eh * 0.75);
  return { wh: b.km > 0 ? kwh / b.km * 1000 : 0, kwh, dk: b.km / (Math.max(5, hiz) * TIP[b.tip].akis) * 60 };
}

// Referans eğri: 63 kWh E-GMP, 800 V istasyon; diğer bataryalar sarjOlcek ile ölçeklenir (bkz. arac.js).
// Ölçülen %10→80: 350 kW'ta 18 dk, 150 kW'ta 22 dk, 50 kW'ta 53 dk.
const EGRI = [[0, 110], [5, 150], [10, 165], [45, 175], [55, 145], [70, 125], [78, 95], [82, 55], [90, 32], [100, 8]];
function temelGuc(soc) {
  for (let i = 1; i < EGRI.length; i++) {
    const [a, pa] = EGRI[i - 1], [c, pc] = EGRI[i];
    if (soc <= c) return pa + (pc - pa) * (soc - a) / (c - a);
  }
  return 8;
}
export function sarjGucu(soc, olcek = 1) {
  return olcek * temelGuc(soc);
}
export function sarjDk(s0, s1, istasyonKw, kap, olcek = 1) {
  let saat = 0;
  for (let s = Math.floor(s0); s < s1; s++) {
    const bas = Math.max(s, s0), son = Math.min(s + 1, s1);
    saat += kap * (son - bas) / 100 / Math.min(sarjGucu(s + 0.5, olcek), istasyonKw * 0.93);
  }
  return saat * 60;
}

// Planı baştan sona yürütür. hizFn verilirse duraklar yok sayılır (senaryo karşılaştırması).
export function hesapla(bolumler, k, hizFn) {
  let soc = k.soc0, km = 0, surus = 0, durakDk = 0, kwh = 0, maliyet = 0;
  const satir = [];
  for (const b of bolumler) {
    const h = bolumHesap(b, hizFn ? hizFn(b) : b.hiz, k);
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
