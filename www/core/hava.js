// Bölüm bazlı hava. Open-Meteo saatlik tahminini alır, her bölüme o bölüme VARIŞ
// saatindeki değerleri atar. Rüzgâr yön ve şiddetiyle gelir; fizik.js bunu yol eksenine ayırır.
// Ağ çağrısı dışarıda tutulur (getir parametresi), böylece çekirdek çevrimdışı test edilir.

export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
export const ALANLAR = ['temperature_2m', 'relative_humidity_2m', 'surface_pressure',
                        'wind_speed_10m', 'wind_direction_10m', 'precipitation', 'snowfall', 'shortwave_radiation'];

// Rota boyunca kaç örnekleme noktası alınacağını belirler: çok nokta gereksiz, tek nokta yanlış.
export const ORNEK_ARALIK_KM = 80;

// Bölümlerden örnekleme noktalarını seçer (koordinatı olanlardan, aralığa göre seyreltilmiş).
export function ornekNoktalari(bolumler, aralikKm = ORNEK_ARALIK_KM) {
  const n = [];
  for (const b of bolumler) {
    if (b.enlem == null) continue;
    const orta = b.basKm + b.km / 2;
    if (!n.length || orta - n[n.length - 1].km >= aralikKm) n.push({ km: orta, enlem: b.enlem, boylam: b.boylam });
  }
  if (!n.length && bolumler.length && bolumler[0].enlem != null) {
    n.push({ km: 0, enlem: bolumler[0].enlem, boylam: bolumler[0].boylam });
  }
  return n;
}

export function istekUrl(noktalar, gun = 3) {
  const lat = noktalar.map(n => n.enlem).join(',');
  const lon = noktalar.map(n => n.boylam).join(',');
  return `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&hourly=${ALANLAR.join(',')}`
       + `&forecast_days=${gun}&wind_speed_unit=ms&timezone=auto`;
}

// Open-Meteo yanıtını (tek nokta için nesne, çok nokta için dizi) ortak biçime çevirir.
export function yanitiCozumle(yanit, noktalar) {
  const dizi = Array.isArray(yanit) ? yanit : [yanit];
  return dizi.map((y, i) => ({
    km: noktalar[i]?.km ?? 0,
    enlem: y.latitude, boylam: y.longitude, rakim: y.elevation,
    saat: y.hourly.time.map(t => Date.parse(t.length === 16 ? t + ':00' : t)),
    T: y.hourly.temperature_2m,
    nem: y.hourly.relative_humidity_2m,
    basincHpa: y.hourly.surface_pressure,
    ruzgarMs: y.hourly.wind_speed_10m,
    ruzgarYonu: y.hourly.wind_direction_10m,
    yagisMm: y.hourly.precipitation,
    karCm: y.hourly.snowfall || null, gunesWm2: y.hourly.shortwave_radiation || null,
  }));
}

const araDeger = (dizi, i, t) => {
  const a = dizi[i], b = dizi[Math.min(i + 1, dizi.length - 1)];
  return a + (b - a) * t;
};
// Açı ortalaması sarmalı hesaba katar: 350° ile 10° arası 0°'dir, 180° değil.
const araAci = (dizi, i, t) => {
  const a = dizi[i] * Math.PI / 180, b = dizi[Math.min(i + 1, dizi.length - 1)] * Math.PI / 180;
  const x = Math.cos(a) + (Math.cos(b) - Math.cos(a)) * t;
  const y = Math.sin(a) + (Math.sin(b) - Math.sin(a)) * t;
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

// Bir nokta ve zaman için saatler arası doğrusal ara değer.
export function anlikHava(nokta, zamanMs) {
  const s = nokta.saat;
  if (!s?.length) return null;
  let i = 0;
  while (i + 1 < s.length && s[i + 1] <= zamanMs) i++;
  const t = i + 1 < s.length ? Math.max(0, Math.min(1, (zamanMs - s[i]) / (s[i + 1] - s[i]))) : 0;
  return {
    T: +araDeger(nokta.T, i, t).toFixed(1),
    nem: Math.round(araDeger(nokta.nem, i, t)),
    basincPa: Math.round(araDeger(nokta.basincHpa, i, t) * 100),
    ruzgarHizi: +araDeger(nokta.ruzgarMs, i, t).toFixed(1),
    ruzgarYonu: Math.round(araAci(nokta.ruzgarYonu, i, t)),
    yagis: +araDeger(nokta.yagisMm, i, t).toFixed(1),
    karCm: nokta.karCm?.[i] != null ? +araDeger(nokta.karCm, i, t).toFixed(2) : 0,
    gunes: nokta.gunesWm2?.[i] != null ? Math.round(araDeger(nokta.gunesWm2, i, t)) : null,
    tahminDisi: zamanMs > s[s.length - 1] || zamanMs < s[0],
  };
}

const yakinNokta = (noktalar, km) =>
  noktalar.reduce((a, b) => (Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a), noktalar[0]);

// Bölümlere hava atar. sureFn(b, i) bölümün dakikasını verir; varış saati buradan yürür.
// İki geçiş yapılır: ilkinde havasız süreler, ikincisinde havalı süreler kullanılır.
export function havaUygula(bolumler, noktalar, cikisMs, sureFn, gecis = 2) {
  if (!noktalar?.length) return bolumler;
  let sonuc = bolumler;
  for (let g = 0; g < gecis; g++) {
    let t = cikisMs;
    sonuc = sonuc.map((b, i) => {
      const orta = b.basKm + b.km / 2;
      const hava = anlikHava(yakinNokta(noktalar, orta), t + sureFn(b, i) * 30000); // bölüm ortası
      t += sureFn(b, i) * 60000 + (b.durak?.dk || 0) * 60000;
      return hava ? { ...b, ...hava, yagisMm: hava.yagis, yagis: hava.yagis > 0.1, kar: hava.karCm > 0.05 } : b;
    });
  }
  return sonuc;
}

// Ağ katmanı: çağıran getir (fetch) sağlar; çevrimdışıyken çağrılmaz.
export async function havaGetir(bolumler, getir = fetch, gun = 3) {
  const noktalar = ornekNoktalari(bolumler);
  if (!noktalar.length) return [];
  const yanit = await getir(istekUrl(noktalar, gun));
  if (!yanit.ok) throw new Error('Hava servisi yanıt vermedi: ' + yanit.status);
  return yanitiCozumle(await yanit.json(), noktalar);
}
