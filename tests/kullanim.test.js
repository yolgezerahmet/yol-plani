import test from 'node:test';
import assert from 'node:assert/strict';
import { kullanimUygula, kabinGecisKwh, sogukKapasiteKat, yolculukKapasiteKat } from '../www/core/kullanim.js';
import { VARSAYILAN, whKm, bolumHesap } from '../www/core/model.js';
import { iklimKw } from '../www/core/fizik.js';

const K = { ...VARSAYILAN, T: 20 };

test('dört kişi ve bagaj yükü artırır; tırmanışta enerji artar', () => {
  const dolu = kullanimUygula(K, { kisi: 4, bagajKg: 80 });
  assert.equal(dolu.yuk, 380);
  const b = { tip: 'tek', km: 20, cikis: 600, inis: 0 };
  const e1 = bolumHesap(b, 80, kullanimUygula(K, { kisi: 1, bagajKg: 0 })).kwh, e4 = bolumHesap(b, 80, dolu).kwh;
  assert.ok(e4 > e1 * 1.08 && e4 < e1 * 1.25, `${e1} → ${e4}`);
});

test('tavan kutusu otoyolda tüketimi %8–16 artırır, şehirde çok az', () => {
  const kutu = kullanimUygula(K, { tavan: 'kutu' }), yok = kullanimUygula(K, {});
  const o = whKm('otoyol', 120, kutu) / whKm('otoyol', 120, yok), s = whKm('sehir', 35, kutu) / whKm('sehir', 35, yok);
  assert.ok(o > 1.08 && o < 1.16, String(o)); assert.ok(s < 1.04, String(s));
});

test('kış lastiği ve klima kapalı beklenen yönde etkiler', () => {
  assert.ok(whKm('bolunmus', 100, kullanimUygula(K, { lastik: 'kis' })) > whKm('bolunmus', 100, kullanimUygula(K, {})) * 1.02);
  const soguk = { ...K, T: -5 };
  assert.ok(whKm('sehir', 35, kullanimUygula(soguk, { klima: 'kapali' })) < whKm('sehir', 35, kullanimUygula(soguk, {})) * 0.8);
});

test('soğuk kabin tek seferlik enerji ister; şebekede ön klimalandırma sıfırlar', () => {
  const e = kabinGecisKwh(-5, {});
  assert.ok(e > 0.4 && e < 1.2, String(e));
  assert.equal(kabinGecisKwh(-5, { sebekeOnKlima: true }), 0);
  assert.equal(kabinGecisKwh(21, {}), 0);
  assert.ok(kabinGecisKwh(38, {}, 50) > 0.2);   // güneşte kalmış araç
});

test('güneş kışın ısıtmayı azaltır, yazın soğutmayı artırır', () => {
  assert.ok(iklimKw(0, { gunes: 600 }) < iklimKw(0, {}));
  assert.ok(iklimKw(32, { gunes: 800 }) > iklimKw(32, {}) + 0.2);
  assert.equal(iklimKw(21, {}), 0);
});

test('soğuk batarya kapasitesi: −10 °C’de %90; uzun yolda etki azalır', () => {
  assert.equal(sogukKapasiteKat(-10), 0.9); assert.equal(sogukKapasiteKat(25), 1);
  assert.ok(yolculukKapasiteKat(-10, 20) < yolculukKapasiteKat(-10, 300));
  assert.ok(Math.abs(yolculukKapasiteKat(-10, 300) - 0.965) < 0.001);
});

test('kar, ıslak yoldan daha çok tüketir', () => {
  const s = { ...K, T: -2 };
  assert.ok(whKm('bolunmus', 90, { ...s, kar: true }) > whKm('bolunmus', 90, { ...s, yagis: true }) * 1.05);
});
