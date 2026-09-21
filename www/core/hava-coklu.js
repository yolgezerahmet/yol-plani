// Hava verisini tek kaynağa bırakmamak için iki katman:
//  1. Tahmin topluluğu: Open-Meteo aynı istekte birden çok bağımsız modeli döndürür (ECMWF, DWD ICON,
//     NOAA GFS, Météo-France). Her saat için ortanca alınır; modeller arası açılma belirsizlik ölçüsüdür.
//  2. Gözlem sınaması: rota çevresindeki havalimanlarının METAR gözlemleri (NOAA aviationweather.gov)
//     ile tahmin karşılaştırılır. Tutarlı bir sapma varsa yolculuğun ilk saatleri ölçüme doğru çekilir.
// Ağ çağrıları dışarıda (getir parametresi); çekirdek çevrimdışı test edilir.
import { OPEN_METEO, ALANLAR } from './hava.js';
import { mesafeKm } from './istasyon.js';

export const MODELLER = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'meteofrance_seamless'];
export const MODEL_AD = { ecmwf_ifs025: 'ECMWF', icon_seamless: 'ICON', gfs_seamless: 'GFS', meteofrance_seamless: 'Météo-France' };
const ALAN_ESLE = { temperature_2m: 'T', relative_humidity_2m: 'nem', surface_pressure: 'basincHpa',
                    wind_speed_10m: 'ruzgarMs', wind_direction_10m: 'ruzgarYonu', precipitation: 'yagisMm',
                    snowfall: 'karCm', shortwave_radiation: 'gunesWm2' };

export function topluUrl(noktalar, gun = 3, modeller = MODELLER) {
  const lat = noktalar.map(n => n.enlem).join(','), lon = noktalar.map(n => n.boylam).join(',');
  return `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&hourly=${ALANLAR.join(',')}`
       + `&models=${modeller.join(',')}&forecast_days=${gun}&wind_speed_unit=ms&timezone=auto`;
}

// Yanıt: her nokta için hourly içinde "temperature_2m_ecmwf_ifs025" biçiminde alanlar.
// Verisi boş (tamamı null) gelen model atlanır; tek model istenmişse sonek olmayabilir.
export function topluCozumle(yanit, noktalar, modeller = MODELLER) {
  const dizi = Array.isArray(yanit) ? yanit : [yanit];
  return dizi.map((y, i) => {
    const h = y.hourly, m = {};
    for (const md of modeller) {
      const o = {};
      let dolu = false;
      for (const [a, k] of Object.entries(ALAN_ESLE)) {
        const d = h[`${a}_${md}`] ?? (modeller.length === 1 ? h[a] : undefined);
        o[k] = d || null;
        if (a === 'temperature_2m' && d?.some(v => v != null)) dolu = true;
      }
      if (dolu) m[md] = o;
    }
    return { km: noktalar[i]?.km ?? 0, enlem: y.latitude, boylam: y.longitude,
             saat: h.time.map(t => Date.parse(t.length === 16 ? t + ':00' : t)), modeller: m };
  });
}

const ortanca = a => { const s = a.filter(v => v != null && !Number.isNaN(v)).sort((x, y) => x - y);
  if (!s.length) return null; const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const aralik = a => { const s = a.filter(v => v != null); return s.length ? Math.max(...s) - Math.min(...s) : 0; };

// Topluluktan tek seri: sayısal alanlarda ortanca; rüzgârda vektör (u, v) ortancası, böylece
// 350° ve 10° diyen iki model 180° değil 0° verir. Yanında saat saat açılma (sıcaklık, rüzgâr) durur.
export function birlestir(nokta) {
  const md = Object.values(nokta.modeller);
  const n = nokta.saat.length, r = { km: nokta.km, enlem: nokta.enlem, boylam: nokta.boylam, saat: nokta.saat,
    T: [], nem: [], basincHpa: [], ruzgarMs: [], ruzgarYonu: [], yagisMm: [], karCm: [], gunesWm2: [], acilmaT: [], acilmaRuzgar: [], modelSayisi: md.length };
  for (let i = 0; i < n; i++) {
    const al = k => md.map(m => m[k]?.[i]);
    r.T.push(ortanca(al('T'))); r.nem.push(ortanca(al('nem'))); r.basincHpa.push(ortanca(al('basincHpa')));
    r.yagisMm.push(ortanca(al('yagisMm')));
    r.karCm.push(ortanca(al('karCm')) ?? 0); r.gunesWm2.push(ortanca(al('gunesWm2')));
    const u = [], v = [];
    md.forEach(m => { const s = m.ruzgarMs?.[i], y = m.ruzgarYonu?.[i];
      if (s != null && y != null) { u.push(s * Math.sin(y * Math.PI / 180)); v.push(s * Math.cos(y * Math.PI / 180)); } });
    const uu = ortanca(u) ?? 0, vv = ortanca(v) ?? 0;
    r.ruzgarMs.push(ortanca(al('ruzgarMs')));
    r.ruzgarYonu.push((Math.atan2(uu, vv) * 180 / Math.PI + 360) % 360);
    r.acilmaT.push(aralik(al('T'))); r.acilmaRuzgar.push(aralik(al('ruzgarMs')));
  }
  return r;
}

// Tek modeli hava.js'in bildiği nokta biçimine çevirir (model bazlı senaryo için).
export function modelNoktasi(nokta, md) {
  const m = nokta.modeller[md];
  return m ? { km: nokta.km, enlem: nokta.enlem, boylam: nokta.boylam, saat: nokta.saat, ...m } : null;
}

// Yolculuk penceresindeki en büyük açılma: nerede ve ne kadar.
export function belirsizlik(birlesik, basMs, bitMs) {
  let enT = { deger: 0 }, enR = { deger: 0 };
  for (const p of birlesik) p.saat.forEach((t, i) => {
    if (t < basMs - 3600e3 || t > bitMs + 3600e3) return;
    if (p.acilmaT[i] > enT.deger) enT = { deger: p.acilmaT[i], km: p.km, t };
    if (p.acilmaRuzgar[i] > enR.deger) enR = { deger: p.acilmaRuzgar[i], km: p.km, t };
  });
  return { T: enT, ruzgar: enR, yuksek: enT.deger >= 5 || enR.deger >= 6 };
}

// ---- Gözlem (METAR) -----------------------------------------------------------------
export const METAR_API = 'https://aviationweather.gov/api/data/metar';
export function metarUrl(noktalar, payDerece = 0.4) {
  const lat = noktalar.map(n => n.enlem), lon = noktalar.map(n => n.boylam);
  const k = [Math.min(...lat) - payDerece, Math.min(...lon) - payDerece, Math.max(...lat) + payDerece, Math.max(...lon) + payDerece]
    .map(x => x.toFixed(2));
  return `${METAR_API}?bbox=${k.join(',')}&format=json&hours=2`;
}

// aviationweather JSON: [{ icaoId, name, lat, lon, obsTime (epoch sn), temp, wspd (knot), wdir }]
export function metarCozumle(liste) {
  const son = new Map();
  for (const m of liste || []) {
    if (m.temp == null || m.lat == null) continue;
    const o = { icao: m.icaoId, ad: m.name || m.icaoId, enlem: m.lat, boylam: m.lon, zaman: m.obsTime * 1000,
      T: m.temp, ruzgarMs: m.wspd != null ? +(m.wspd * 0.5144).toFixed(1) : null, ruzgarYonu: typeof m.wdir === 'number' ? m.wdir : null };
    if (!son.has(o.icao) || son.get(o.icao).zaman < o.zaman) son.set(o.icao, o);
  }
  return [...son.values()];
}

// Her gözlemi rotadaki en yakın tahmin noktasıyla karşılaştırır (≤ 50 km).
// Rakım farkı için standart düşüş oranı (6,5 °C/km) düzeltmesi uygulanır.
export function gozlemSinama(birlesik, gozlemler, { enFazlaKm = 50 } = {}) {
  const sonuc = [];
  for (const g of gozlemler) {
    let en = null, d = Infinity;
    for (const p of birlesik) { const x = mesafeKm([g.enlem, g.boylam], [p.enlem, p.boylam]); if (x < d) { d = x; en = p; } }
    if (!en || d > enFazlaKm) continue;
    let i = 0; while (i + 1 < en.saat.length && en.saat[i + 1] <= g.zaman) i++;
    if (Math.abs(en.saat[i] - g.zaman) > 90 * 60e3) continue;
    const tahmin = en.T[i];
    if (tahmin == null) continue;
    sonuc.push({ icao: g.icao, ad: g.ad, km: en.km, uzaklikKm: Math.round(d), olculen: g.T, tahmin: +tahmin.toFixed(1),
                 fark: +(g.T - tahmin).toFixed(1) });
  }
  return sonuc;
}

// Ortak sapma: en az iki istasyon aynı yönde ≥ 2 °C ayrışıyorsa anlamlı sayılır.
// Düzeltme çıkıştan itibaren 6 saatte sönümlenir (gözlem uzak geleceği bilmez).
export function sapmaDuzeltmesi(sinama) {
  if (sinama.length < 2) return null;
  const f = sinama.map(s => s.fark), ort = f.reduce((a, b) => a + b, 0) / f.length;
  const ayniYon = f.every(x => Math.sign(x) === Math.sign(ort));
  if (!ayniYon || Math.abs(ort) < 2) return null;
  return { farkT: +ort.toFixed(1), sonumSaat: 6 };
}

export function duzeltmeUygula(birlesik, d, simdiMs) {
  if (!d) return birlesik;
  return birlesik.map(p => ({ ...p, T: p.T.map((v, i) => {
    const s = (p.saat[i] - simdiMs) / 3600e3;
    return v == null || s < -1 ? v : +(v + d.farkT * Math.max(0, 1 - Math.max(0, s) / d.sonumSaat)).toFixed(1);
  }) }));
}

// Ağ katmanı. Gözlem alınamazsa yalnızca topluluk kullanılır; topluluk da alınamazsa çağıran
// eski tek-model yoluna (hava.js) düşer.
export async function cokluHavaGetir(noktalar, getir = fetch, { gun = 3, simdiMs = Date.now() } = {}) {
  const y = await getir(topluUrl(noktalar, gun));
  if (!y.ok) throw new Error('Hava topluluğu alınamadı: ' + y.status);
  const ham = topluCozumle(await y.json(), noktalar);
  let birlesik = ham.map(birlestir);
  let sinama = [], duzeltme = null;
  try {
    const m = await getir(metarUrl(noktalar));
    if (m.ok) {
      sinama = gozlemSinama(birlesik, metarCozumle(await m.json()));
      duzeltme = sapmaDuzeltmesi(sinama);
      birlesik = duzeltmeUygula(birlesik, duzeltme, simdiMs);
    }
  } catch {}
  return { ham, birlesik, sinama, duzeltme };
}
