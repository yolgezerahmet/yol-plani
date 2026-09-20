import test from 'node:test';
import assert from 'node:assert/strict';
import { ARACLAR, aracUygula } from '../www/core/arac.js';
import { sarjDk, hesapla, VARSAYILAN } from '../www/core/model.js';

const yakin = (d, h, tol, ad) => assert.ok(Math.abs(d - h) <= tol, `${ad}: ${d.toFixed(1)} (hedef ${h}±${tol})`);
const sure = id => { const a = ARACLAR[id]; return sarjDk(10, 80, 350, a.kap, a.sarjOlcek); };

test('%10→80 süreleri: 58 ≈ 18 dk, 77,4 ≈ 18 dk, 84 ≈ 19 dk', () => {
  yakin(sure('i5-58-rwd'), 18, 2.5, '58');
  yakin(sure('i5-77-rwd'), 18, 2.5, '77,4');
  yakin(sure('i5-84-rwd'), 19, 2.5, '84');
});
test('büyük batarya aynı rotada daha yüksek şarjla varır', () => {
  const rota = [{ tip: 'otoyol', km: 250, dh: 0, hiz: 120 }];
  const v = id => hesapla(rota, aracUygula(VARSAYILAN, id)).varis;
  assert.ok(v('i5-84-rwd') > v('i5-63-rwd') && v('i5-63-rwd') > v('i5-58-rwd'));
});
test('AWD aynı bataryada daha çok tüketir', () => {
  const rota = [{ tip: 'otoyol', km: 100, dh: 0, hiz: 120 }];
  const e = id => hesapla(rota, aracUygula(VARSAYILAN, id)).kwh;
  assert.ok(e('i5-84-awd') > e('i5-84-rwd'));
});
test('SoH kapasiteyi ölçekler, saçma değer reddedilir', () => {
  assert.equal(aracUygula(VARSAYILAN, 'i5-84-rwd', 0.9).kap, 72);
  assert.throws(() => aracUygula(VARSAYILAN, 'i5-84-rwd', 1.2));
  assert.throws(() => aracUygula(VARSAYILAN, 'yok'));
});
