import test from 'node:test';
import assert from 'node:assert/strict';
import { bosDurum, pencereBileseni, guncelle, hizGuncelle, ogrenilen, olculenSigma, ogrenmeOzeti, OGRENME } from '../www/core/ogrenme.js';
import { VARSAYILAN, whKm } from '../www/core/model.js';
import { enerjiEgrisi } from '../www/core/plan.js';

let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const tipler = ['otoyol', 'tek', 'sehir'], hizlar = { otoyol: [95, 130], tek: [60, 95], sehir: [25, 50] };
const rota = n => Array.from({ length: n }, (_, i) => { const tip = tipler[i % 3]; return { tip, km: 6, basKm: i * 6, hiz: 90, cikis: rnd() * 40, inis: rnd() * 40, T: 2 + rnd() * 25 }; });

// Gerçek araç: hava direnci %15 fazla (tavan çubukları), yardımcı yük %35 fazla.
function benzet(gercek, n, gurultu = 0.03) {
  const bolumler = rota(n), k = { ...VARSAYILAN, T: 12 };
  let d = bosDurum();
  for (const b of bolumler) {
    const v = hizlar[b.tip][0] + rnd() * (hizlar[b.tip][1] - hizlar[b.tip][0]);
    const p = pencereBileseni(bolumler, k, b.basKm, b.basKm + b.km, v);
    const y = (p.x[0] * gercek[0] + p.x[1] * gercek[1] + p.x[2] * gercek[2] + p.sabit) * (1 + gauss() * gurultu);
    d = guncelle(d, { x: p.x, sabit: p.sabit, y, km: b.km });
  }
  return d;
}

test('pencere bileşenleri modelle tutarlı: toplamı, aynı hızdaki bölüm enerjisine eşit', () => {
  const bolumler = [{ tip: 'otoyol', km: 10, basKm: 0, hiz: 120, cikis: 30, inis: 10, T: 8 }], k = { ...VARSAYILAN, T: 8 };
  const p = pencereBileseni(bolumler, k, 0, 10, 108);
  const e = enerjiEgrisi([{ ...bolumler[0], hiz: 108, akisOrani: 1 }], k).toplamKwh;
  const p1 = pencereBileseni([{ ...bolumler[0], akisOrani: 1 }], k, 0, 10, 108);
  assert.ok(Math.abs(p1.x[0] + p1.x[1] + p1.x[2] + p1.sabit - e) < 0.03, `${p1.x} ${p1.sabit} / ${e}`);
  assert.ok(p.x.every(v => v > 0));
  const yari = pencereBileseni(bolumler, k, 0, 5, 108);
  assert.ok(Math.abs(yari.x[0] * 2 - p.x[0]) < 1e-9);
});

test('karışık yollarda gerçek çarpanları bulur (aero +%15, yardımcı +%35)', () => {
  const d = benzet([1.15, 1.0, 1.35], 150);
  const o = ogrenilen(d);
  assert.ok(Math.abs(o.aero - 1.15) < 0.05, 'aero ' + o.aero);
  assert.ok(Math.abs(o.yuv - 1.0) < 0.08, 'yuv ' + o.yuv);
  assert.ok(Math.abs(o.yard - 1.35) < 0.10, 'yard ' + o.yard);
  assert.ok(olculenSigma(d) < 0.06, String(olculenSigma(d)));
  assert.match(ogrenmeOzeti(d), /hava direncin katalogdan %1\d yüksek/);
});

test('öğrenilen çarpanlar tek katsayıdan iyi tahmin eder (görülmemiş hız ve sıcaklıkta)', () => {
  const gercek = [1.15, 1.0, 1.35], d = benzet(gercek, 150), o = ogrenilen(d);
  const k = { ...VARSAYILAN };
  // Tek katsayı: eğitim koşullarındaki ortalama oran
  let mg = 0, mm = 0;
  for (const [tip, v, T] of [['otoyol', 110, 12], ['tek', 80, 12], ['sehir', 35, 12]]) { mg += whKm(tip, v, { ...k, T, ogren: { aero: gercek[0], yuv: gercek[1], yard: gercek[2] } }); mm += whKm(tip, v, { ...k, T }); }
  const tek = mg / mm;
  let hataOgren = 0, hataTek = 0, n = 0;
  for (const [tip, v, T] of [['otoyol', 130, -8], ['otoyol', 90, 30], ['sehir', 20, -5], ['tek', 70, 35]]) {
    const dogru = whKm(tip, v, { ...k, T, ogren: { aero: gercek[0], yuv: gercek[1], yard: gercek[2] } });
    hataOgren += Math.abs(whKm(tip, v, { ...k, T, ogren: o }) / dogru - 1);
    hataTek += Math.abs(whKm(tip, v, { ...k, T }) * tek / dogru - 1); n++;
  }
  assert.ok(hataOgren / n < 0.03, 'öğrenen ' + hataOgren / n);
  assert.ok(hataOgren < hataTek * 0.6, `öğrenen ${hataOgren / n} tek ${hataTek / n}`);
});

test('az veriyle katalogda kalır; aykırı pencere yok sayılır; sınırlar korunur', () => {
  assert.equal(ogrenilen(benzet([1.3, 1.3, 1.3], OGRENME.enAzPencere - 1)), null);
  let d = benzet([1, 1, 1], 60); const once = [...d.teta];
  d = guncelle(d, { x: [1, 0.5, 0.3], sabit: 0, y: 9, km: 6 });            // 5 kat tüketim: sayaç atlaması
  assert.deepEqual(d.teta, once); assert.equal(d.atlanan, 1);
  const uc = benzet([2.5, 2.5, 2.5], 200, 0);
  assert.ok(uc.teta.every(v => v <= OGRENME.ust + 1e-9));
});

test('sabit hızlı otoyolda bile toplam tahmin düzelir (bileşenler ayrışmasa da)', () => {
  const bolumler = Array.from({ length: 60 }, (_, i) => ({ tip: 'otoyol', km: 6, basKm: i * 6, hiz: 120, cikis: 10, inis: 10, T: 15 })), k = { ...VARSAYILAN, T: 15 };
  let d = bosDurum();
  for (const b of bolumler) { const p = pencereBileseni(bolumler, k, b.basKm, b.basKm + 6, 118); d = guncelle(d, { x: p.x, sabit: p.sabit, y: (p.x[0] * 1.2 + p.x[1] + p.x[2]) + p.sabit, km: 6 }); }
  const p = pencereBileseni(bolumler, k, 0, 6, 118), o = d.teta;
  const tahmin = p.x[0] * o[0] + p.x[1] * o[1] + p.x[2] * o[2], dogru = p.x[0] * 1.2 + p.x[1] + p.x[2];
  assert.ok(Math.abs(tahmin / dogru - 1) < 0.01, String(tahmin / dogru));
});

test('hız alışkanlığı yol tipine göre öğrenilir', () => {
  let d = bosDurum();
  for (let i = 0; i < 12; i++) d = hizGuncelle(d, 'otoyol', 126, 117);
  assert.ok(Math.abs(d.hiz.otoyol.oran - 126 / 117) < 0.01);
  assert.equal(hizGuncelle(d, 'sehir', 8, 30).hiz.sehir, undefined);        // trafik sıkışıklığı alışkanlık değildir
});
