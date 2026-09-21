// EV'nin fiziksel doğası. Her katsayının kaynağı ve belirsizliği yanında yazılıdır.
// [Ö] ölçülen/standart, [L] literatür, [T] bu projenin tahmini (OBD kaydıyla kalibre edilecek).

export const SABIT = {
  g: 9.80665,        // [Ö] standart yerçekimi
  Rd: 287.058,       // [Ö] kuru hava gaz sabiti, J/(kg·K)
  Rv: 461.495,       // [Ö] su buharı gaz sabiti
  z0: 0.05,          // [L] açık arazi pürüzlülük uzunluğu, m (logaritmik rüzgâr profili)
  zOlcum: 10,        // [Ö] meteoroloji rüzgârı ölçüm yüksekliği, m
  zArac: 1.2,        // [T] aracın etkin rüzgâr yüksekliği (IONIQ 5 gövde ortası), m
  kYaw: 0.0012,      // [T] yan rüzgârda CdA artışı: CdA(β) = CdA0 (1 + kYaw·β²), β derece
  yawMaks: 15,       // [T] modelin geçerli saydığı en büyük sapma açısı
  kabinC: 22,        // [T] hedef kabin sıcaklığı
  UA: 0.115,         // [T] kabin + batarya ısı kaybı katsayısı, kW/K (EVDB −10 °C çapasına oturtuldu)
  soğutmaEsigi: 24,  // [T] bu sıcaklığın üstünde soğutma açılır
  EER: 2.5,          // [L] klima soğutma verimi
  temelKw: 0.5,      // [T] sürekli yardımcı yük (aydınlatma, ekran, pompa)
  camAlani: 2.0,     // [T] güneşe bakan etkin cam alanı, m²
  camGecirgenlik: 0.45, // [L] ısı yalıtımlı otomobil camı güneş ısı kazanç katsayısı
};

// Doymuş buhar basıncı (Tetens), Pa. [L]
const pSat = T => 610.78 * Math.exp(17.27 * T / (T + 237.3));

// Nemli hava yoğunluğu. Kuru havadan ~%1 hafiftir; barometrik yaklaşımın yerini alır.
// p: Pa (istasyon basıncı), T: °C, nem: %0-100.
export function havaYogunlugu(T, p = 101325, nem = 50) {
  const Tk = T + 273.15;
  const pv = Math.max(0, Math.min(1, nem / 100)) * pSat(T);
  return (p - pv) / (SABIT.Rd * Tk) + pv / (SABIT.Rv * Tk);
}

// Rakımdan istasyon basıncı (barometrik), ölçülen basınç yoksa. [L]
export const basincTahmini = (rakimM, T = 15) =>
  101325 * Math.pow(1 - 0.0065 * rakimM / (T + 273.15 + 0.0065 * rakimM), 5.257);

// 10 m rüzgârını araç yüksekliğine indirger (logaritmik sınır tabakası). [L]
export function ruzgarAracYuksekligi(v10) {
  const { z0, zOlcum, zArac } = SABIT;
  return v10 * Math.log(zArac / z0) / Math.log(zOlcum / z0);
}

// Rüzgârı yol eksenine ayırır. Açılar derece, meteorolojik yön (rüzgârın GELDİĞİ yön).
// Dönüş: karsi (+ karşıdan, m/s), yan (m/s).
export function ruzgarBilesenleri(v10, ruzgarYonu, yolYonu) {
  const v = ruzgarAracYuksekligi(v10);
  const a = (ruzgarYonu - yolYonu) * Math.PI / 180;
  return { karsi: v * Math.cos(a), yan: v * Math.sin(a) };
}

// Bağıl akışın hızı ve sapma açısı; yan rüzgâr CdA'yı büyütür (kutu gövdede belirgin).
export function akisDirenci(hizKmh, karsiMs, yanMs, cda0) {
  const v = hizKmh / 3.6 + karsiMs;
  const vBagil = Math.hypot(Math.max(0, v), yanMs);
  const beta = Math.min(SABIT.yawMaks, Math.abs(Math.atan2(yanMs, Math.max(1, v)) * 180 / Math.PI));
  const cda = cda0 * (1 + SABIT.kYaw * beta * beta);
  return { vBagil, beta, cda, kuvvet: 0.5 * cda * vBagil * vBagil }; // ρ ile çarpılacak
}

// Isı pompası verimi (COP). Dış sıcaklık düştükçe düşer; çok soğukta rezistans devreye girer.
// Eğri, EVDB'nin −10 °C otoyol tüketimi çapasına oturtuldu; batarya ısıtmasını da içerir. [T]
const COP_EGRI = [[-20, 1.0], [-10, 1.0], [0, 1.6], [10, 2.4], [15, 3.0]];
export function isiPompasiCop(T) {
  if (T <= COP_EGRI[0][0]) return COP_EGRI[0][1];
  for (let i = 1; i < COP_EGRI.length; i++) {
    const [a, ca] = COP_EGRI[i - 1], [b, cb] = COP_EGRI[i];
    if (T <= b) return ca + (cb - ca) * (T - a) / (b - a);
  }
  return COP_EGRI[COP_EGRI.length - 1][1];
}

// Yardımcı yük (kW): ısıtma ısı pompasıyla, soğutma klimayla, artı sabit tüketim.
export function yardimciKw(T, o = {}) { return SABIT.temelKw + iklimKw(T, o); }

// Yalnızca iklimlendirme (kW, elektrik). gunes: yatay yüzeye gelen ışınım, W/m² (hava servisinden).
// Güneş kışın ısıtma ihtiyacını azaltır, yazın soğutma yükünü artırır; ılık ama güneşli havada
// (eşik altı sıcaklık) klimayı tek başına açtırabilir.
export function iklimKw(T, { kabin = SABIT.kabinC, ua = SABIT.UA, gunes = null } = {}) {
  const kazanc = gunes ? gunes * SABIT.camAlani * SABIT.camGecirgenlik / 1000 : 0;   // kW ısı
  if (T < kabin - 2) return Math.max(0, ua * (kabin - T) - kazanc) / isiPompasiCop(T);
  const sogutmaIsi = ua * Math.max(0, T - SABIT.soğutmaEsigi) + (T > 15 ? kazanc : 0);
  // Esik altında yalnız güneşten gelen küçük yük havalandırmayla atılır.
  return T > SABIT.soğutmaEsigi || sogutmaIsi > 0.4 ? sogutmaIsi / SABIT.EER : 0;
}

// Rejenerasyon verimi: yavaşlama şiddetine ve batarya sıcaklığına bağlı.
// Literatür, verimi sabit almak yerine anlık değişkenlerden hesaplamayı ve soğukta belirgin
// düşüş olduğunu bildiriyor. Eğri [T]; OBD'den ölçülen değerle değiştirilecek (F6).
export function rejenVerimi(T, yavaslamaMs2 = 0.8) {
  const soguk = T >= 15 ? 1 : T <= -10 ? 0.62 : 0.62 + 0.38 * (T + 10) / 25;
  // Sert frende mekanik fren devreye girer; çok yumuşak frende sürtünme payı büyür.
  const sekil = yavaslamaMs2 <= 0.5 ? 0.88
    : yavaslamaMs2 <= 1.5 ? 0.88 + 0.12 * (yavaslamaMs2 - 0.5)
    : Math.max(0.45, 1 - 0.28 * (yavaslamaMs2 - 1.5));
  return Math.max(0.2, Math.min(0.85, 0.85 * soguk * sekil));
}

// Bataryanın o anda kabul edebileceği rejenerasyon gücü (kW).
// Dolu bataryada ve soğukta araç rejenerasyonu kısar; artan enerji balataya gider.
// Bu, "inişle başlayan rotada %100 şarjla çıkma" uyarısının dayanağı.
export function rejenKabulKw(soc, T, tepeKw = 60) {
  const socKat = soc >= 97 ? 0 : soc >= 90 ? (97 - soc) / 7 * 0.5 : soc >= 80 ? 0.5 + (90 - soc) / 10 * 0.5 : 1;
  const sicakKat = T >= 15 ? 1 : T <= -10 ? 0.25 : 0.25 + 0.75 * (T + 10) / 25;
  return tepeKw * socKat * sicakKat;
}

// Bir inişte gerçekten geri kazanılabilecek enerji (kWh): hem verim hem kabul sınırı.
// inisM: toplam iniş, km: bölüm uzunluğu, hizKmh: hız.
export function inisGeriKazanim(inisM, kutle, km, hizKmh, soc, T) {
  const potansiyel = kutle * SABIT.g * inisM / 3.6e6;         // kWh
  if (potansiyel <= 0 || km <= 0) return { kwh: 0, kisilanKwh: 0 };
  const saat = km / Math.max(5, hizKmh);
  const ortGucKw = potansiyel / saat;                          // iniş boyunca ortalama
  const kabul = rejenKabulKw(soc, T);
  const oran = kabul <= 0 ? 0 : Math.min(1, kabul / Math.max(0.1, ortGucKw));
  const kwh = potansiyel * rejenVerimi(T) * oran;
  return { kwh, kisilanKwh: potansiyel * (1 - oran), ortGucKw, kabulKw: kabul };
}

// ---- Küçük ama sürekli yükler ve yüke bağlı kayıplar -------------------------------------
// Aksesuar yükü (kW), sabit 0,5 kW'ın ÜSTÜNE: gece farlar, yağışta silecek + arka cam rezistansı,
// donma yakınında ayna/ön cam/koltuk/direksiyon ısıtması. Değerler [T]; OBD 12 V akımıyla düzeltilir.
export function aksesuarKw({ gece = false, yagis = false, T = 20 } = {}) {
  return (gece ? 0.12 : 0) + (yagis ? 0.25 : 0) + (T < 3 ? 0.20 : 0);
}

// Sıcak havada batarya soğutması: kompresör bataryayı da soğutur. 30 °C altında yok,
// 42 °C'de ~0,8 kW [T]. Hızlı şarj sonrası ilk yarım saatte daha yüksek olabilir (modelde yok).
export function bataryaSogutmaKw(T) {
  return T <= 30 ? 0 : Math.min(0.8, (T - 30) / 12 * 0.8);
}

// Yağış şiddetine göre yuvarlanma direnci çarpanı [L/T]: su filmi ve sıçratma. mm/saat.
// Eski ikili değer (+%15) orta şiddete denk gelir; mm bilinmiyorsa o kullanılır.
export function yagisCrrKat(mm) {
  if (mm == null) return 1.15;
  if (mm < 0.1) return 1;
  return mm < 1 ? 1.06 : mm < 4 ? 1.12 : 1.20;
}

// Yüke bağlı ek kayıp: motor bakır kaybı ve batarya iç direnci akımın karesiyle büyür.
// Referans güçte (düz otoyol seyri, ~25 kW) sabit verim geçerlidir; üstünde kayıp oranı artar.
// 60 kW sürekli tırmanışta ≈ %1,7, tavan %6 [T]. OBD güç/hız kaydından ölçülecek.
export const YUK_REF_KW = 25;
export function yukKayipKat(ortKw) {
  return ortKw <= YUK_REF_KW ? 1 : Math.min(1.06, 1 + 0.012 * (ortKw / YUK_REF_KW - 1));
}
