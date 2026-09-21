// Batarya ısıl modeli: yol boyunca hücre sıcaklığı ve sıcaklığın DC şarj gücüne etkisi.
//
// E-GMP soğuk hücreyi yüksek akımdan korur; aynı istasyonda soğuk batarya sıcak olanın birkaç katı
// sürede dolar. Model tek kütleli (toplu) bir ısıl denge kurar:
//   C · dT/dt = ısıKaynağı − k · (T − T_ortam)
// Isı kaynağı sürüşte ve şarjda iç direnç kaybı (I²R), ön ısıtmada ısıtıcı gücüdür.
// Etiketler: [F] fizik, [T] proje tahmini — OBD kayıtlarıyla araca özel değer yazılır (kalibrasyon.js).

export const TERMAL = {
  kapasiteKwhK: 0.10,    // [T] ısıl kütle: ~300 kg hücre + soğutucu ≈ 0,10 kWh/K
  kayipKwK: 0.012,       // [T] ortama ısı kaybı (paket yalıtımlı, yavaş soğur)
  direncOhm: 0.08,       // [T] paket iç direnci; 800 V sınıfı 63 kWh için mertebe
  nominalV: 697,         // [F] 63 kWh E-GMP nominal gerilim (192s)
  isiticiKw: 4.5,        // [T] ön ısıtma ısıtıcısı; DC şarjda soğuk hücreyi şebekeden ısıtır
  onIsitmaHedef: 28,     // [T] ön ısıtmanın hedeflediği hücre sıcaklığı
  sogutmaEsik: 35,       // [T] bu sıcaklığın üstünde BMS soğutur, kaynak kısılır
  surusEkKw: 0.35,       // [T] sürüşte motor/invertör atık ısısının pakete geçen kısmı
};

// Hücre sıcaklığı → DC şarj gücü katsayısı (0–1). Topluluk ölçümlerinin mertebesi:
// 25 °C üstünde tam güç, 10 °C civarı yarısı, donma noktasında beşte biri. [T]
// OBD ile kendi aracının sıcaklık-güç noktaları toplanınca bu tablo onunla değiştirilir.
export const SICAKLIK_TAVANI = [[-20, 0.10], [0, 0.20], [5, 0.30], [10, 0.45], [15, 0.65], [20, 0.85], [25, 1.00], [45, 1.00], [50, 0.70], [55, 0.40]];

export function tabloAra(tablo, x) {
  if (x <= tablo[0][0]) return tablo[0][1];
  for (let i = 1; i < tablo.length; i++) {
    const [a, pa] = tablo[i - 1], [b, pb] = tablo[i];
    if (x <= b) return pa + (pb - pa) * (x - a) / (b - a);
  }
  return tablo[tablo.length - 1][1];
}

export const sicaklikKatsayisi = (T, tablo = SICAKLIK_TAVANI) => tabloAra(tablo, T);

// I²R kaybı (kW). gucKw: bataryadan çekilen/verilen elektrik gücü.
export function direncIsisi(gucKw, t = TERMAL) {
  const akim = Math.abs(gucKw) * 1000 / t.nominalV;
  return akim * akim * t.direncOhm / 1000;
}

// Bir zaman aralığında sıcaklık değişimi. kaynakKw: pakete giren ısı.
// Analitik çözüm kullanılır; adım büyüklüğünden bağımsızdır.
export function ilerlet(T, ortamT, kaynakKw, dk, t = TERMAL) {
  const tau = t.kapasiteKwhK / t.kayipKwK;                 // saat
  const denge = ortamT + kaynakKw / t.kayipKwK;
  const serbest = denge + (T - denge) * Math.exp(-(dk / 60) / tau);
  // Soğutma eşiği: kaynak hücreyi eşiğin üstüne itmeye çalışırsa BMS soğutur.
  return serbest > T ? Math.min(serbest, Math.max(T, t.sogutmaEsik)) : serbest;
}

// Sürüş bölümü: ortalama güç bölümün enerjisi ve süresinden.
export function surusIsinmasi(T, ortamT, kwh, dk, t = TERMAL) {
  const gucKw = dk > 0 ? kwh / (dk / 60) : 0;
  return ilerlet(T, ortamT, direncIsisi(gucKw, t) + (gucKw > 0 ? t.surusEkKw : 0), dk, t);
}

// Ön ısıtma: hedefe ulaşmak için gereken süre (dk) ve harcanan enerji (kWh).
// Sürüş sırasında yapılır; ısıtıcı enerjisi bataryadan gelir.
export function onIsitma(T, ortamT, t = TERMAL, enFazlaDk = 45) {
  if (T >= t.onIsitmaHedef) return { dk: 0, kwh: 0, T };
  let dk = 0, s = T;
  while (s < t.onIsitmaHedef && dk < enFazlaDk) { s = ilerlet(s, ortamT, t.isiticiKw + t.surusEkKw, 1, t); dk++; }
  return { dk, kwh: +(t.isiticiKw * dk / 60).toFixed(2), T: +s.toFixed(1) };
}

// Park halinde bekleme (mola, gece): ortama doğru soğuma.
export const bekleme = (T, ortamT, dk, t = TERMAL) => ilerlet(T, ortamT, 0, dk, t);
