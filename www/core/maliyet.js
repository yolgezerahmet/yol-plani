// Yolculuk maliyeti ve ev elektriği. Saf fonksiyonlar.
//
// Fiyatlar sık değişir ve operatörler "esnek fiyatlandırma" uygular; bu tablo yalnızca başlangıç
// değeridir. Kullanıcının girdiği fiyat her zaman önceliklidir. Kaynak: vMob ve araç rehberleri,
// Haziran–Temmuz 2026 [T]. Uygulama tabloyu ekranda "yaklaşık" diye gösterir.
export const FIYAT_TARIHI = '2026-07';
export const OPERATORLER = [
  // anahtar: EPDK lisans sahibi adında aranan parça; ad: ekranda görünen; dc: TL/kWh (yaklaşık)
  { anahtar: 'ZES', ad: 'ZES', dc: 12.99, hpc: 16.49 },
  { anahtar: 'EŞARJ', ad: 'Eşarj', dc: null },
  { anahtar: 'TRUGO', ad: 'Trugo', dc: 14.98 },
  { anahtar: 'VOLTRUN', ad: 'Voltrun', dc: 12.90, isgaliyeDk: 5 },
  { anahtar: 'ZEPLİN', ad: 'Zeplin', dc: 10.30 },
  { anahtar: 'ASTOR', ad: 'Astor', dc: null },
  { anahtar: 'SHELL', ad: 'Shell Recharge', dc: null },
  { anahtar: 'PETROL OFİSİ', ad: 'PO e-Power', dc: null },
  { anahtar: 'SHARZ', ad: 'Sharz', dc: null },
  { anahtar: 'BEEFULL', ad: 'Beefull', dc: null },
  { anahtar: 'OTOJET', ad: 'Otojet', dc: null },
  { anahtar: 'EN YAKIT', ad: 'En Yakıt', dc: null },
  { anahtar: 'TESLA', ad: 'Tesla Supercharger', dc: null },
];
export const BILINMEYEN_DC = 14;       // fiyatı bilinmeyen operatör için tahmini TL/kWh [T]
export const SARJ_KAYBI = 0.05;        // DC'de sayaçtan bataryaya kayıp [T]
export const EV_SARJ_KAYBI = 0.10;     // AC ev şarjında kayıp [T]

const buyuk = s => String(s || '').toLocaleUpperCase('tr-TR');

export function operatorBul(lisansAdi) {
  const a = buyuk(lisansAdi);
  return OPERATORLER.find(o => a.includes(o.anahtar)) || null;
}

// Bir durağın fiyatı: kullanıcı girdisi > tablo (HPC ≥ 200 kW ise hpc) > bilinmeyen.
export function durakFiyati(istasyon, kullanici = {}) {
  const o = operatorBul(istasyon.operator);
  const ad = o?.ad || (istasyon.operator || 'Bilinmeyen operatör');
  if (kullanici[ad] != null) return { ad, tl: +kullanici[ad], kaynak: 'senin' };
  const tl = o && (istasyon.kw >= 200 && o.hpc ? o.hpc : o.dc);
  if (tl != null) return { ad, tl, kaynak: 'tablo', isgaliyeDk: o.isgaliyeDk ?? null };
  return { ad, tl: BILINMEYEN_DC, kaynak: 'tahmin' };
}

// plan: durakPlanla çıktısı; bolumler: ucretliKm için; evTl: ev elektriği TL/kWh (başlangıç şarjı için)
export function yolculukMaliyeti(plan, { bolumler = [], kullanici = {}, evTl = null, baslangicKwh = null } = {}) {
  const duraklar = plan.duraklar.map(d => {
    const f = durakFiyati(d.istasyon, kullanici);
    const faturaKwh = d.ekKwh / (1 - SARJ_KAYBI);
    return { no: d.no, ...f, faturaKwh: +faturaKwh.toFixed(1), tutar: Math.round(faturaKwh * f.tl) };
  });
  const sarjTl = duraklar.reduce((t, d) => t + d.tutar, 0);
  const evTutar = evTl != null && baslangicKwh != null ? Math.round(baslangicKwh / (1 - EV_SARJ_KAYBI) * evTl) : null;
  const ucretliKm = +bolumler.reduce((t, b) => t + (b.ucretliKm || 0), 0).toFixed(1);
  return {
    duraklar, sarjTl, evTutar, toplamTl: sarjTl + (evTutar || 0),
    kmBasiTl: plan.toplamKm > 0 ? +((sarjTl + (evTutar || 0)) / plan.toplamKm).toFixed(2) : 0,
    tahminVar: duraklar.some(d => d.kaynak === 'tahmin'),
    ucretliKm,
  };
}

// Ev elektriği: EPDK son kaynak sınırı (mesken 4.000 kWh/yıl, 1 Ocak 2026'dan itibaren).
// Sınır aşılırsa, aşılan ayı izleyen üçüncü ayın ilk gününden itibaren (ikili anlaşma yoksa)
// yüksek tüketimli son kaynak tarifesi uygulanabilir; önceki takvim yılındaki aşım da sayılır.
export const MESKEN_SINIRI = 4000;

export function evSarjiEtkisi({ evYillikKwh, aracYillikKm, whKm = 180, evPayi = 0.8, sinir = MESKEN_SINIRI }) {
  const aracKwh = aracYillikKm * whKm / 1000 * evPayi / (1 - EV_SARJ_KAYBI);
  const toplam = evYillikKwh + aracKwh;
  const bosluk = sinir - evYillikKwh;
  const sinirKm = bosluk > 0 ? Math.round(bosluk * (1 - EV_SARJ_KAYBI) / evPayi / (whKm / 1000)) : 0;
  return { aracKwh: Math.round(aracKwh), toplam: Math.round(toplam), asar: toplam >= sinir, sinirKm, sinir };
}

// Yıl içinde birikim: bu yıl şimdiye kadarki tüketim ve aylık ortalama → hangi ay aşılır.
export function asimAyi({ buYilKwh, ay, aylikKwh, sinir = MESKEN_SINIRI }) {
  if (buYilKwh >= sinir) return { ay, zaten: true };
  const kalan = sinir - buYilKwh;
  const n = Math.ceil(kalan / Math.max(1, aylikKwh));
  const hedef = ay + n;
  return hedef > 12 ? null : { ay: hedef, uygulama: hedef + 3 <= 12 ? hedef + 3 : hedef + 3 - 12, zaten: false };
}
