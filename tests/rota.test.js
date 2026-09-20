import test from 'node:test';
import assert from 'node:assert/strict';
import { profil, gecisler, yerlesimGecisleri, gecisKwh, yenidenOrnekle, rakimProfili, bolumle } from '../www/core/rota.js';

const kenar = (road_class, speed_limit, speed, length, density = 0) => ({ road_class, speed_limit, speed, length, density });

test('etiketsiz limit yol sınıfından gelir ve işaretlenir', () => {
  const p = profil([kenar('trunk', 0, 95, 10), kenar('motorway', 140, 130, 10)]);
  assert.equal(p[0].limit, 110); assert.equal(p[0].etiketli, false);
  assert.equal(p[1].limit, 140); assert.equal(p[1].etiketli, true);
});

test('akış hızı çukuru geçiş sayılır, kalıcı düşüş sayılmaz', () => {
  const dus = profil([kenar('trunk', 110, 100, 10), kenar('trunk', 110, 50, 1), kenar('trunk', 110, 100, 10)]);
  assert.equal(gecisler(dus).length, 1);
  const kalici = profil([kenar('trunk', 110, 100, 10), kenar('trunk', 110, 50, 10)]);
  assert.equal(gecisler(kalici).length, 0);
});

test('yoğunluk yerleşim geçişi verir', () => {
  const p = profil([kenar('trunk', 110, 100, 10), kenar('trunk', 110, 90, 1, 12), kenar('trunk', 110, 100, 10)]);
  const y = yerlesimGecisleri(p);
  assert.equal(y.length, 1); assert.equal(y[0].tahmini, true);
});

test('geçiş bedeli hıza göre artar ve sıfırda sıfırdır', () => {
  const a = gecisKwh(120, 50, 2150, 0.9), b = gecisKwh(90, 50, 2150, 0.9);
  assert.ok(a > b && a < 0.2 && b > 0.02);
  assert.equal(gecisKwh(80, 80, 2150, 0.9), 0);
});

test('yeniden örnekleme yüksek frekanslı gürültüyü eler', () => {
  const h = []; // 10 m aralıkla ±12 m DEM gürültüsü, gerçek eğim yok
  for (let m = 0; m <= 4000; m += 10) h.push([m, 100 + (m / 10 % 2 ? 12 : 0)]);
  const ham = rakimProfili(h, 0, 4, 10);
  const temiz = rakimProfili(yenidenOrnekle(h, 200), 0, 4, 10);
  assert.ok(ham.cikis > 300, 'ham profil gürültüyü tırmanış sayar');
  assert.ok(temiz.cikis < 20, 'yeniden örneklenmiş profil elemeli');
});

test('gerçek tırmanış korunur', () => {
  const h = []; for (let m = 0; m <= 10000; m += 50) h.push([m, 500 + m / 20]); // 10 km'de 500 m
  const r = rakimProfili(yenidenOrnekle(h, 200), 0, 10);
  assert.ok(Math.abs(r.cikis - 500) < 15 && r.inis === 0);
});

test('bölümleme: kısa parça yutulur, uzun bölüm bölünür', () => {
  const e = [kenar('motorway', 140, 130, 120), kenar('motorway', 90, 85, 0.5), kenar('motorway', 140, 130, 120)];
  const h = []; for (let m = 0; m <= 240500; m += 500) h.push([m, 900]);
  const r = bolumle(e, h, { enUzun: 60 });
  assert.ok(r.bolumler.every(b => b.km <= 60.5), 'hiçbir bölüm 60 km\'yi geçmez');
  assert.ok(r.bolumler.every(b => b.tip === 'otoyol' && b.limit === 140), 'kısa 90 parçası yutuldu');
  assert.ok(Math.abs(r.toplamKm - 240.5) < 0.1);
});

test('akış oranı ölçülen hızdan gelir', () => {
  const e = [kenar('trunk', 110, 88, 50)];
  const h = [[0, 900], [50000, 900]];
  const b = bolumle(e, h).bolumler[0];
  assert.equal(b.akisOrani, 0.8);
});
