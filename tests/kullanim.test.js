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

import { CEKILEN, basincCrrKat } from '../www/core/kullanim.js';
import { aksesuarKw, bataryaSogutmaKw, yagisCrrKat, yukKayipKat } from '../www/core/fizik.js';
import { whKm as _wh, bolumHesap as _bh, VARSAYILAN as _V } from '../www/core/model.js';

test('römork kütleyi ve hava direncini birlikte büyütür; otoyol tüketimi belirgin artar', () => {
  const k0 = kullanimUygula({ ..._V }, { cekilen: 'yok' }), k1 = kullanimUygula({ ..._V }, { cekilen: 'karavan' });
  assert.equal(k1.yuk - k0.yuk, CEKILEN.karavan.kg);
  const oran = _wh('otoyol', 100, k1) / _wh('otoyol', 100, k0);
  assert.ok(oran > 1.6 && oran < 2.2, String(oran));
});

test('düşük lastik basıncı yuvarlanma direncini artırır', () => {
  assert.equal(basincCrrKat(0), 1);
  assert.ok(basincCrrKat(0.3) > 1.04 && basincCrrKat(0.3) < 1.07);
  assert.ok(kullanimUygula({ ..._V }, { basinc: 'cok', lastik: 'kis' }).lastik > 1.19);
});

test('aksesuar ve batarya soğutma: ılık gündüzde sıfır (kalibrasyon çapaları kaymaz)', () => {
  assert.equal(aksesuarKw({ gece: false, yagis: false, T: 20 }), 0);
  assert.equal(bataryaSogutmaKw(25), 0);
  assert.ok(aksesuarKw({ gece: true, yagis: true, T: 0 }) > 0.5);
  assert.ok(Math.abs(bataryaSogutmaKw(42) - 0.8) < 1e-9);
  assert.equal(_wh('otoyol', 110, { ..._V, T: 20 }), _wh('otoyol', 110, { ..._V, T: 20, gunes: null }));
});

test('yağış şiddeti kademeli; mm bilinmiyorsa eski değer', () => {
  assert.equal(yagisCrrKat(null), 1.15); assert.equal(yagisCrrKat(0), 1);
  assert.ok(yagisCrrKat(0.5) < yagisCrrKat(2) && yagisCrrKat(2) < yagisCrrKat(8));
});

test('yüke bağlı kayıp: düz seyirde yok, dik ve uzun tırmanışta var, tavanlı', () => {
  assert.equal(yukKayipKat(20), 1);
  assert.ok(yukKayipKat(60) > 1.015 && yukKayipKat(60) < 1.02);
  assert.equal(yukKayipKat(500), 1.06);
  const duz = _bh({ tip: 'otoyol', km: 20, cikis: 0, inis: 0 }, 110, { ..._V });
  const dik = _bh({ tip: 'otoyol', km: 20, cikis: 1200, inis: 0 }, 110, { ..._V });
  assert.equal(duz.yukKayipKwh, 0); assert.ok(dik.yukKayipKwh > 0.1, String(dik.yukKayipKwh));
});
