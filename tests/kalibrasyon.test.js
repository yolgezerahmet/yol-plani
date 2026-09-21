import test from 'node:test';
import assert from 'node:assert/strict';
import { sarjOturumlari, sicaklikTablosu, suruIstatistigi, tuketimKatsayisi, kapasiteTahmini } from '../www/core/kalibrasyon.js';
import { sarjGucu } from '../www/core/model.js';
import { SICAKLIK_TAVANI } from '../www/core/termal.js';

// Sentetik soğuk şarj: 8 °C'de gerçek araç eğrinin %40'ını alıyor olsun.
const oturum = (T, kat, t0 = 0) => Array.from({ length: 30 }, (_, i) => {
  const soc = 12 + i * 1.5;
  return { t: t0 + i * 30000, soc, gucKw: -sarjGucu(soc) * kat, bataryaMinT: T, bataryaMaxT: T + 2,
           cecKwh: 1000 + i * 0.9, cedKwh: 900, dcSarj: true };
});

test('şarj oturumları boşlukla ayrılır', () => {
  const o = sarjOturumlari([...oturum(8, 0.4), { t: 999999, dcSarj: false }, ...oturum(25, 1, 3600000)]);
  assert.equal(o.length, 2);
  assert.ok(o[0].tepeKw < o[1].tepeKw);
  assert.equal(o[0].kwh, 26.1);
});

test('ölçülen dilim varsayılan tablonun yerine geçer', () => {
  const r = sicaklikTablosu(sarjOturumlari(oturum(8, 0.4)));
  assert.equal(r.olculen, 1);
  const on = r.tablo.find(([T]) => T === 10);
  assert.ok(on && Math.abs(on[1] - 0.4) < 0.02, JSON.stringify(on));
  assert.ok(r.tablo.some(([T, k]) => T === 25 && k === 1), 'ölçülmeyen dilim varsayılandan');
});

test('istasyon sınırlı noktalar katsayıyı aşağı çekmez', () => {
  // Aynı sıcaklıkta biri 50 kW istasyonda (kısık), biri hızlı istasyonda
  const yavas = oturum(20, 0.3), hizli = oturum(20, 0.9, 7200000);
  const r = sicaklikTablosu(sarjOturumlari([...yavas, { t: 5000000, dcSarj: false }, ...hizli]));
  const yirmi = r.tablo.find(([T]) => T === 20);
  assert.ok(yirmi[1] > 0.8, `üst çeyrek kullanılır: ${yirmi[1]}`);
});

test('veri yoksa varsayılan tablo döner', () => {
  assert.equal(sicaklikTablosu([]).tablo, SICAKLIK_TAVANI);
});

test('sürüş istatistiği rejenerasyonu düşer', () => {
  const s = suruIstatistigi({ cedKwh: 100, cecKwh: 50, km: 1000, soc: 90 }, { cedKwh: 120, cecKwh: 52, km: 1100, soc: 60 });
  assert.equal(s.netKwh, 18); assert.equal(s.whKm, 180); assert.equal(s.dSoc, 30);
});

test('tüketim katsayısı km ağırlıklı ve kırpılmış', () => {
  const r = tuketimKatsayisi([{ km: 300, modelKwh: 57, olculenKwh: 60 }, { km: 10, modelKwh: 2, olculenKwh: 5 }]);
  assert.equal(r.yolculuk, 1, '20 km altı yolculuk sayılmaz');
  assert.ok(Math.abs(r.kat - 60 / 57) < 0.01);
  assert.equal(tuketimKatsayisi([{ km: 100, modelKwh: 10, olculenKwh: 30 }]).kat, 1.25);
});

test('kapasite tahmini büyük SoC değişimi ister', () => {
  assert.equal(kapasiteTahmini({ soc: 50, cecKwh: 0, cedKwh: 0 }, { soc: 60, cecKwh: 6, cedKwh: 0 }), null);
  assert.equal(kapasiteTahmini({ soc: 10, cecKwh: 0, cedKwh: 0 }, { soc: 80, cecKwh: 42, cedKwh: 0 }), 60);
});
