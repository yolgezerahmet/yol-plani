import test from 'node:test';
import assert from 'node:assert/strict';
import { ornekNoktalari, istekUrl, yanitiCozumle, anlikHava, havaUygula } from '../www/core/hava.js';
import { whKm, VARSAYILAN } from '../www/core/model.js';

const bolum = (no, basKm, km, enlem, boylam, yolYonu = 90) =>
  ({ no, basKm, km, enlem, boylam, yolYonu, tip: 'otoyol', hiz: 110 });

const sahteYanit = (T, ruzgar, yon) => ({
  latitude: 39.9, longitude: 32.8, elevation: 880,
  hourly: {
    time: ['2026-09-21T08:00', '2026-09-21T09:00', '2026-09-21T10:00'],
    temperature_2m: T, relative_humidity_2m: [60, 55, 50],
    surface_pressure: [920, 919, 918], wind_speed_10m: ruzgar,
    wind_direction_10m: yon, precipitation: [0, 0, 0.4],
  },
});

test('örnekleme noktaları aralığa göre seyreltilir', () => {
  const b = [bolum(1, 0, 50, 39.9, 32.8), bolum(2, 50, 20, 39.5, 33.2), bolum(3, 70, 100, 38.7, 35.5)];
  const n = ornekNoktalari(b, 80);
  assert.equal(n.length, 2, 'ikinci bölüm birinciye çok yakın');
  assert.ok(n[1].km > 80);
});

test('koordinatsız bölümler atlanır', () => {
  assert.deepEqual(ornekNoktalari([bolum(1, 0, 50, null, null)]), []);
});

test('istek adresi tüm noktaları ve m/s birimini içerir', () => {
  const u = istekUrl([{ enlem: 39.9, boylam: 32.8 }, { enlem: 37.5, boylam: 36.9 }]);
  assert.ok(u.includes('latitude=39.9,37.5') && u.includes('longitude=32.8,36.9'));
  assert.ok(u.includes('wind_speed_unit=ms') && u.includes('surface_pressure'));
});

test('yanıt tek nokta için de dizi olur', () => {
  const n = yanitiCozumle(sahteYanit([20, 22, 24], [3, 4, 5], [0, 0, 0]), [{ km: 10 }]);
  assert.equal(n.length, 1); assert.equal(n[0].km, 10); assert.equal(n[0].saat.length, 3);
});

test('saatler arası ara değer', () => {
  const n = yanitiCozumle(sahteYanit([20, 24, 28], [2, 6, 10], [0, 0, 0]), [{ km: 0 }])[0];
  const h = anlikHava(n, Date.parse('2026-09-21T08:30:00'));
  assert.equal(h.T, 22); assert.equal(h.ruzgarHizi, 4);
  assert.equal(h.basincPa, 91950);
  assert.equal(h.tahminDisi, false);
});

test('rüzgâr yönü sarmalı doğru ortalanır', () => {
  const n = yanitiCozumle(sahteYanit([20, 20, 20], [5, 5, 5], [350, 10, 10]), [{ km: 0 }])[0];
  const h = anlikHava(n, Date.parse('2026-09-21T08:30:00'));
  assert.ok(h.ruzgarYonu === 0 || h.ruzgarYonu === 360, `yön ${h.ruzgarYonu}`);
});

test('tahmin penceresi dışı işaretlenir', () => {
  const n = yanitiCozumle(sahteYanit([20, 20, 20], [5, 5, 5], [0, 0, 0]), [{ km: 0 }])[0];
  assert.equal(anlikHava(n, Date.parse('2026-09-25T08:00:00')).tahminDisi, true);
});

test('bölümlere varış saatine göre hava atanır', () => {
  const b = [bolum(1, 0, 110, 39.9, 32.8), bolum(2, 110, 110, 39.5, 33.2)];
  const n = yanitiCozumle(sahteYanit([20, 24, 28], [2, 2, 2], [0, 0, 0]), [{ km: 55 }]);
  const cikti = havaUygula(b, n, Date.parse('2026-09-21T08:00:00'), () => 60);
  assert.ok(cikti[0].T < cikti[1].T, 'ikinci bölüme daha geç varılır, hava ısınmış');
  assert.equal(cikti[0].yagis, false);
});

test('rüzgâr hava verisiyle tüketime yansır', () => {
  const k = { ...VARSAYILAN, rakim: 0 };
  const b = { yolYonu: 90 };
  const sakin = whKm('otoyol', 110, { ...k, ruzgarHizi: 0, ruzgarYonu: 90 }, b);
  const karsi = whKm('otoyol', 110, { ...k, ruzgarHizi: 12, ruzgarYonu: 90 }, b);
  const arkadan = whKm('otoyol', 110, { ...k, ruzgarHizi: 12, ruzgarYonu: 270 }, b);
  assert.ok(karsi > sakin && sakin > arkadan);
});
