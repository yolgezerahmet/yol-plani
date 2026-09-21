import test from 'node:test';
import assert from 'node:assert/strict';
import { topluUrl, topluCozumle, birlestir, belirsizlik, metarCozumle, gozlemSinama, sapmaDuzeltmesi, duzeltmeUygula, modelNoktasi } from '../www/core/hava-coklu.js';

const NOKTA = [{ km: 0, enlem: 39.9, boylam: 32.86 }, { km: 300, enlem: 38.7, boylam: 35.5 }];
const T0 = Date.parse('2026-09-22T08:00:00');
const saatler = ['2026-09-22T08:00', '2026-09-22T09:00'];
const hourly = (o) => {
  const h = { time: saatler };
  for (const [md, v] of Object.entries(o)) {
    h[`temperature_2m_${md}`] = v.T; h[`relative_humidity_2m_${md}`] = [50, 50]; h[`surface_pressure_${md}`] = [900, 900];
    h[`wind_speed_10m_${md}`] = v.W; h[`wind_direction_10m_${md}`] = v.D; h[`precipitation_${md}`] = [0, 0];
  }
  return h;
};
const YANIT = [
  { latitude: 39.9, longitude: 32.86, hourly: { ...hourly({ ecmwf_ifs025: { T: [8, 10], W: [3, 3], D: [350, 350] },
    icon_seamless: { T: [9, 11], W: [5, 5], D: [10, 10] }, gfs_seamless: { T: [12, 13], W: [4, 4], D: [0, 0] } }),
    temperature_2m_meteofrance_seamless: [null, null] } },
  { latitude: 38.7, longitude: 35.5, hourly: hourly({ ecmwf_ifs025: { T: [5, 6], W: [2, 2], D: [180, 180] },
    icon_seamless: { T: [5, 7], W: [10, 10], D: [180, 180] }, gfs_seamless: { T: [6, 6], W: [3, 3], D: [180, 180] } }) },
];

test('istek URL birden çok modeli ister', () => {
  const u = new URL(topluUrl(NOKTA));
  assert.equal(u.searchParams.get('models').split(',').length, 4);
  assert.equal(u.searchParams.get('latitude'), '39.9,38.7');
});

test('boş gelen model atlanır, diğerleri çözülür', () => {
  const r = topluCozumle(YANIT, NOKTA);
  assert.deepEqual(Object.keys(r[0].modeller).sort(), ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless']);
  assert.equal(r[0].saat[0], T0);
});

test('birleştirme: ortanca sıcaklık, açılma ve sarmal rüzgâr yönü', () => {
  const b = birlestir(topluCozumle(YANIT, NOKTA)[0]);
  assert.equal(b.T[0], 9); assert.equal(b.acilmaT[0], 4);
  assert.ok(b.ruzgarYonu[0] < 15 || b.ruzgarYonu[0] > 345, String(b.ruzgarYonu[0]));
  assert.equal(b.modelSayisi, 3);
});

test('belirsizlik penceresi rüzgârdaki anlaşmazlığı bulur', () => {
  const bb = topluCozumle(YANIT, NOKTA).map(birlestir);
  const r = belirsizlik(bb, T0, T0 + 3600e3);
  assert.equal(r.ruzgar.km, 300); assert.equal(r.ruzgar.deger, 8); assert.equal(r.yuksek, true);
});

test('model noktası hava.js biçimine döner', () => {
  const m = modelNoktasi(topluCozumle(YANIT, NOKTA)[0], 'gfs_seamless');
  assert.deepEqual(m.T, [12, 13]); assert.equal(modelNoktasi(topluCozumle(YANIT, NOKTA)[0], 'meteofrance_seamless'), null);
});

test('METAR: istasyon başına en yeni gözlem, knot → m/s', () => {
  const g = metarCozumle([
    { icaoId: 'LTAC', lat: 40.13, lon: 32.99, obsTime: T0 / 1000 - 1800, temp: 4, wspd: 10, wdir: 20 },
    { icaoId: 'LTAC', lat: 40.13, lon: 32.99, obsTime: T0 / 1000, temp: 5, wspd: 10, wdir: 'VRB' },
    { icaoId: 'XXXX', lat: 1, lon: 1, obsTime: T0 / 1000, temp: null }]);
  assert.equal(g.length, 1); assert.equal(g[0].T, 5); assert.equal(g[0].ruzgarMs, 5.1); assert.equal(g[0].ruzgarYonu, null);
});

test('gözlem sınaması ve tutarlı sapmada düzeltme, 6 saatte sönüm', () => {
  const bb = topluCozumle(YANIT, NOKTA).map(birlestir);
  const s = gozlemSinama(bb, [
    { icao: 'LTAC', ad: 'Esenboğa', enlem: 40.13, boylam: 32.99, zaman: T0, T: 5 },
    { icao: 'LTAU', ad: 'Kayseri', enlem: 38.77, boylam: 35.49, zaman: T0, T: 2.5 }]);
  assert.equal(s.length, 2); assert.equal(s[0].fark, -4); assert.equal(s[1].fark, -2.5);
  const d = sapmaDuzeltmesi(s);
  assert.equal(d.farkT, -3.3);
  const dz = duzeltmeUygula(bb, d, T0);
  assert.ok(Math.abs(dz[0].T[0] - 5.7) < 0.01, String(dz[0].T[0]));
  assert.ok(dz[0].T[1] > 11 - 3.3 && dz[0].T[1] < 11, String(dz[0].T[1]));
});

test('ters yönlü ya da küçük sapmada düzeltme yok', () => {
  assert.equal(sapmaDuzeltmesi([{ fark: 3 }, { fark: -3 }]), null);
  assert.equal(sapmaDuzeltmesi([{ fark: 1 }, { fark: 1.5 }]), null);
  assert.equal(sapmaDuzeltmesi([{ fark: -4 }]), null);
});

test('gözlem sınaması rakım farkını sapma saymaz', () => {
  const saat = [Date.UTC(2026, 8, 21, 6), Date.UTC(2026, 8, 21, 7)];
  // Model hücresi 1.400 m, havalimanı 1.050 m: 350 m × 6,5 °C/km ≈ 2,3 °C daha ılık olması beklenir.
  const bb = [{ km: 0, enlem: 38.77, boylam: 35.49, rakim: 1400, saat, T: [15, 16] }];
  const [s] = gozlemSinama(bb, [{ icao: 'LTAU', ad: 'Kayseri', enlem: 38.77, boylam: 35.50, rakim: 1050, zaman: saat[0], T: 17.3 }]);
  assert.equal(s.rakimFarkiM, 350);
  assert.ok(Math.abs(s.fark) < 0.1, String(s.fark));        // düzeltmesiz +2,3 °C sapma görünürdü
  const [d] = gozlemSinama([{ ...bb[0], rakim: null }], [{ icao: 'X', ad: 'x', enlem: 38.77, boylam: 35.50, rakim: 1050, zaman: saat[0], T: 17.3 }]);
  assert.equal(d.fark, 2.3);                                  // rakım bilinmiyorsa eski davranış
});
