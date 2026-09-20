import test from 'node:test';
import assert from 'node:assert/strict';
import { whKm, sarjDk, hesapla, VARSAYILAN } from '../www/core/model.js';

const deniz = { ...VARSAYILAN, rakim: 0, yuk: 100 };
const yakin = (deger, hedef, tol, ad) => assert.ok(Math.abs(deger - hedef) <= tol, `${ad}: ${deger.toFixed(1)} (hedef ${hedef}±${tol})`);

test('EV Database otoyol tüketimi, ılıman', () => yakin(whKm('otoyol', 110, deniz), 190, 6, '110 km/h'));
test('EV Database otoyol tüketimi, −10 °C', () => yakin(whKm('otoyol', 110, { ...deniz, T: -10 }), 245, 8, '−10 °C'));
test('şehir içi ılıman ~118 Wh/km', () => yakin(whKm('sehir', 35, deniz), 118, 12, 'şehir'));
test('hız arttıkça tüketim artar', () => assert.ok(whKm('otoyol', 130, deniz) > whKm('otoyol', 110, deniz) * 1.2));
test('rakım hava direncini düşürür', () => assert.ok(whKm('otoyol', 120, { ...deniz, rakim: 1000 }) < whKm('otoyol', 120, deniz)));
test('%10→80 şarj süreleri ölçümlere yakın', () => {
  yakin(sarjDk(10, 80, 350, 60), 18, 2, '350 kW');
  yakin(sarjDk(10, 80, 150, 60), 22, 3.5, '150 kW');
  yakin(sarjDk(10, 80, 50, 60), 53, 3, '50 kW');
});
test('enerji korunumu: bölüm toplamı = SoC düşüşü', () => {
  const b = [{ tip: 'otoyol', km: 100, dh: 0, hiz: 110 }, { tip: 'tek', km: 50, dh: 300, hiz: 80 }];
  const r = hesapla(b, VARSAYILAN);
  yakin((VARSAYILAN.soc0 - r.varis) / 100 * VARSAYILAN.kap, r.kwh, 1e-9, 'kWh');
});
test('iniş enerji geri kazandırır ama tamamını değil', () => {
  const e = dh => hesapla([{ tip: 'tek', km: 20, dh, hiz: 80 }], VARSAYILAN).kwh;
  assert.ok(e(500) - e(0) > e(0) - e(-500));
});
