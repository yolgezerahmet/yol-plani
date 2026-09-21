import test from 'node:test';
import assert from 'node:assert/strict';
import { enerjiAyristir, ayristirmaCumlesi } from '../www/core/ayristir.js';
import { VARSAYILAN } from '../www/core/model.js';

const b = (o = {}) => ({ tip: 'otoyol', km: 100, hiz: 110, cikis: 0, inis: 0, ...o });

test('ılık, düz, rüzgârsız yolda ek kalem yok', () => {
  const a = enerjiAyristir([b(), b()], { ...VARSAYILAN, T: 20 });
  assert.ok(Math.abs(a.rakimKwh) < 0.01 && Math.abs(a.sicaklikKwh) < 0.01 && Math.abs(a.ruzgarKwh) < 0.01);
  assert.equal(ayristirmaCumlesi(a), null);
});

test('soğuk ve tırmanış ayrı ayrı görünür, toplam korunur', () => {
  const a = enerjiAyristir([b({ cikis: 800, T: -5 }), b({ inis: 200, T: -5 })], { ...VARSAYILAN, T: -5 });
  assert.ok(a.sicaklikKwh > 2, String(a.sicaklikKwh));
  assert.ok(a.rakimKwh > 1, String(a.rakimKwh));
  assert.ok(Math.abs(a.taban + a.rakimKwh + a.sicaklikKwh + a.ruzgarKwh - a.toplam) < 0.2);
  assert.match(ayristirmaCumlesi(a), /soğuk .* kWh ekliyor/);
});

test('karşı rüzgâr pozitif kalem üretir', () => {
  const a = enerjiAyristir([b({ yolYonu: 0 })], { ...VARSAYILAN, T: 20, ruzgarHizi: 10, ruzgarYonu: 0 });
  assert.ok(a.ruzgarKwh > 1, String(a.ruzgarKwh));
});
