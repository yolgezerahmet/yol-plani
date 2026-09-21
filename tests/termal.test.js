import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMAL, sicaklikKatsayisi, direncIsisi, ilerlet, surusIsinmasi, onIsitma, bekleme } from '../www/core/termal.js';
import { sarjSimule, sarjDk } from '../www/core/model.js';

test('sıcaklık katsayısı sıcakta tam, soğukta kısık', () => {
  assert.equal(sicaklikKatsayisi(30), 1);
  assert.ok(sicaklikKatsayisi(5) < 0.4);
  assert.ok(sicaklikKatsayisi(-30) > 0, 'taban sıfır değil');
  assert.ok(sicaklikKatsayisi(52) < 1, 'aşırı sıcakta da kısılır');
});

test('I²R ısısı gücün karesiyle büyür', () => {
  const a = direncIsisi(50), b = direncIsisi(150);
  assert.ok(Math.abs(b / a - 9) < 0.01);
  assert.ok(b > 2 && b < 6, `150 kW'ta ${b.toFixed(2)} kW ısı`);
});

test('kaynak yoksa ortama doğru soğur, adımdan bağımsızdır', () => {
  const tek = ilerlet(25, 0, 0, 120), parca = [...Array(12)].reduce(T => ilerlet(T, 0, 0, 10), 25);
  assert.ok(tek < 25 && tek > 0);
  assert.ok(Math.abs(tek - parca) < 1e-9);
});

test('uzun otoyol sürüşü soğuk bataryayı ısıtır', () => {
  // 2 saat, 110 km/h, ~21 kWh/saat, dışarısı 0 °C, batarya 2 °C
  const T = surusIsinmasi(2, 0, 42, 120);
  assert.ok(T > 4, `ısınma ${T.toFixed(1)}`);
});

test('ön ısıtma hedefe makul sürede ulaşır ve enerji harcar', () => {
  const o = onIsitma(3, 0);
  assert.ok(o.dk > 10 && o.dk <= 45, `${o.dk} dk`);
  assert.ok(o.kwh > 1 && o.kwh < 4);
  assert.equal(onIsitma(30, 20).dk, 0, 'zaten sıcaksa gerek yok');
});

test('mola sırasında batarya soğur', () => assert.ok(bekleme(25, 0, 60) < 25));

test('soğuk şarj yavaş, sıcak şarj eğriyle aynı', () => {
  const sicak = sarjSimule(10, 80, 350, 60, { T: 30, ortamT: 20 });
  const soguk = sarjSimule(10, 80, 350, 60, { T: 0, ortamT: 0 });
  assert.ok(Math.abs(sicak.dk - sarjDk(10, 80, 350, 60)) < 1.5, 'sıcakta ısınma kısıtı yok');
  assert.ok(soguk.dk > sicak.dk * 1.4, `soğuk ${soguk.dk.toFixed(0)} dk, sıcak ${sicak.dk.toFixed(0)} dk`);
  assert.ok(soguk.T > 5, 'şarj bataryayı ısıtır');
  assert.ok(soguk.sicaklikKaybiDk > 5);
});

test('yavaş istasyonda sıcaklık farkı küçülür', () => {
  const fark = kw => sarjSimule(20, 80, kw, 60, { T: 8, ortamT: 5 }).dk - sarjSimule(20, 80, kw, 60, { T: 30 }).dk;
  assert.ok(fark(50) < fark(350), '50 kW zaten tavan; soğuk batarya az şey kaybettirir');
});
