import test from 'node:test';
import assert from 'node:assert/strict';
import { profil, gecisler, yerlesimGecisleri, altyapiOlaylari, gecisKwh, yenidenOrnekle,
         maskeleUygula, rakimProfili, ortalamaYon, virajHizKat, bolumle, YUZEY_CRR } from '../www/core/rota.js';

const kenar = (o = {}) => ({
  road_class: 'trunk', speed_limit: 0, speed: 95, length: 10, density: 0,
  surface: 'paved_smooth', lanes: 2, toll: false, tunnel: false, bridge: false,
  roundabout: false, signal: false, curvature: 0, use: 'road', h0: 90, h1: 90,
  up: 0, down: 0, wgrade: 0, ele: 900, ...o,
});
const duzH = (km, y = 900) => { const h = []; for (let m = 0; m <= km * 1000; m += 200) h.push([m, y]); return h; };

test('etiketsiz limit yol sınıfından gelir ve işaretlenir', () => {
  const p = profil([kenar(), kenar({ road_class: 'motorway', speed_limit: 140 })]);
  assert.equal(p[0].limit, 110); assert.equal(p[0].etiketli, false);
  assert.equal(p[1].limit, 140); assert.equal(p[1].etiketli, true);
});

test('yüzey yuvarlanma çarpanına çevrilir', () => {
  const p = profil([kenar({ surface: 'gravel' }), kenar({ surface: 'bilinmeyen' })]);
  assert.equal(p[0].crrKat, YUZEY_CRR.gravel);
  assert.equal(p[1].crrKat, 1, 'bilinmeyen yüzey nötr');
});

test('saçma eğim kırpılır ve şüpheli işaretlenir', () => {
  const p = profil([kenar({ up: 52, down: -44 })]);
  assert.equal(p[0].egimYukari, 12); assert.equal(p[0].egimAsagi, -12);
  assert.equal(p[0].egimSuphe, true);
});

test('akış hızı çukuru geçiş sayılır, kalıcı düşüş sayılmaz', () => {
  const dus = profil([kenar({ speed: 100 }), kenar({ speed: 50, length: 1 }), kenar({ speed: 100 })]);
  assert.equal(gecisler(dus).length, 1);
  assert.equal(gecisler(profil([kenar({ speed: 100 }), kenar({ speed: 50 })])).length, 0);
});

test('yoğunluk yerleşim geçişi verir', () => {
  const p = profil([kenar({ speed: 100 }), kenar({ speed: 90, length: 1, density: 12 }), kenar({ speed: 100 })]);
  const y = yerlesimGecisleri(p);
  assert.equal(y.length, 1); assert.equal(y[0].tahmini, true);
});

test('döner kavşak, ışık ve kesişme olayları ayrışır', () => {
  const p = profil([
    kenar({ roundabout: true }), kenar({ signal: true }),
    kenar({ nodeType: 'street_intersection', kesisen: ['residential'] }),
    kenar({ road_class: 'motorway', nodeType: 'street_intersection', kesisen: ['motorway_link'] }),
  ]);
  const o = altyapiOlaylari(p);
  assert.deepEqual(o.map(x => x.tur), ['donel', 'isik', 'kavsak'], 'otoyol kesişmesi sayılmaz');
  assert.ok(o[1].dusuk === 0 && o[1].saniye >= 20, 'ışık tam duruş ve en uzun bekleme');
});

test('geçiş bedeli hıza göre artar, sıfır farkta sıfırdır', () => {
  const a = gecisKwh(120, 50, 2150, 0.9), b = gecisKwh(90, 50, 2150, 0.9);
  assert.ok(a > b && a < 0.2 && b > 0.02);
  assert.equal(gecisKwh(80, 80, 2150, 0.9), 0);
});

test('dairesel ortalama 350° ile 10° arasında 0 verir', () => {
  assert.ok(Math.abs(ortalamaYon([350, 10]) % 360) < 0.001);
  assert.ok(Math.abs(ortalamaYon([80, 100]) - 90) < 0.001);
});

test('viraj hızı düşürür ama tabanı var', () => {
  assert.equal(virajHizKat(0), 1); assert.equal(virajHizKat(3), 1);
  assert.ok(virajHizKat(10) < 1 && virajHizKat(15) >= 0.6);
});

test('yeniden örnekleme yüksek frekanslı gürültüyü eler', () => {
  const h = [];
  for (let m = 0; m <= 4000; m += 10) h.push([m, 100 + (m / 10 % 2 ? 12 : 0)]);
  assert.ok(rakimProfili(h, 0, 4, 10).cikis > 300);
  assert.ok(rakimProfili(yenidenOrnekle(h, 200), 0, 4, 10).cikis < 20);
});

test('gerçek tırmanış korunur', () => {
  const h = []; for (let m = 0; m <= 10000; m += 50) h.push([m, 500 + m / 20]);
  const r = rakimProfili(yenidenOrnekle(h, 200), 0, 10);
  assert.ok(Math.abs(r.cikis - 500) < 15 && r.inis === 0);
});

test('tünel maskesi sahte tırmanışı siler', () => {
  const h = []; // 2-4 km arası tünel: DEM üstteki dağı gösteriyor
  for (let m = 0; m <= 6000; m += 200) h.push([m, m > 2000 && m < 4000 ? 1200 : 900]);
  const ham = rakimProfili(h, 0, 6);
  const maskeli = rakimProfili(maskeleUygula(h, [[2, 4]]), 0, 6);
  assert.ok(ham.cikis > 250 && maskeli.cikis < 20);
});

test('bölümleme: kısa parça yutulur, uzun bölüm bölünür', () => {
  const e = [
    kenar({ road_class: 'motorway', speed_limit: 140, speed: 130, length: 120 }),
    kenar({ road_class: 'motorway', speed_limit: 90, speed: 85, length: 0.5 }),
    kenar({ road_class: 'motorway', speed_limit: 140, speed: 130, length: 120 }),
  ];
  const r = bolumle(e, duzH(240.5), { enUzun: 60 });
  assert.ok(r.bolumler.every(b => b.km <= 60.5));
  assert.ok(r.bolumler.every(b => b.tip === 'otoyol' && b.limit === 140));
  assert.ok(Math.abs(r.toplamKm - 240.5) < 0.1);
});

test('bölüm parametreleri ağırlıklı toplanır', () => {
  const e = [
    kenar({ length: 30, toll: true, ele: 1000, h0: 0, curvature: 0 }),
    kenar({ length: 10, tunnel: true, ele: 800, h0: 0, curvature: 8, surface: 'paved_rough' }),
  ];
  const b = bolumle(e, duzH(40)).bolumler[0];
  assert.equal(b.ucretliKm, 30);
  assert.equal(b.tunelKm, 10);
  assert.equal(b.rakim, 950, 'rakım uzunlukla ağırlıklı');
  assert.ok(b.crrKat > 1 && b.crrKat < 1.06, 'yüzey karışımı');
  assert.ok(b.ruzgarKat < 1, 'tünel rüzgârı perdeler');
  assert.equal(b.yolYonu, 0);
  assert.ok(b.viraj > 1 && b.hiz < b.limit, 'viraj hızı düşürür');
});

test('olaylar süre ve enerji cezası üretir', () => {
  const e = [kenar({ length: 5 }), kenar({ length: 5, roundabout: true }), kenar({ length: 5 })];
  const r = bolumle(e, duzH(15));
  assert.equal(r.ozet.donel, 1);
  assert.ok(r.ozet.olayDk > 0.15 && r.ozet.gecisKayipKwh > 0.03);
});

test('akış oranı ölçülen hızdan gelir', () => {
  const b = bolumle([kenar({ speed_limit: 110, speed: 88, length: 50 })], duzH(50)).bolumler[0];
  assert.equal(b.akisOrani, 0.8);
});
