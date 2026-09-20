import test from 'node:test';
import assert from 'node:assert/strict';
import { havaYogunlugu, basincTahmini, ruzgarAracYuksekligi, ruzgarBilesenleri, akisDirenci,
         isiPompasiCop, yardimciKw, rejenVerimi, rejenKabulKw, inisGeriKazanim } from '../www/core/fizik.js';
import { whKm, bolumHesap, VARSAYILAN } from '../www/core/model.js';

const yakin = (d, h, tol, ad) => assert.ok(Math.abs(d - h) <= tol, `${ad}: ${d.toFixed(3)} (hedef ${h}±${tol})`);
const deniz = { ...VARSAYILAN, rakim: 0, yuk: 100 };

test('standart atmosfer yoğunluğu', () => yakin(havaYogunlugu(15, 101325, 0), 1.225, 0.002, 'ISA'));
test('nemli hava kuru havadan hafiftir', () => {
  assert.ok(havaYogunlugu(30, 101325, 90) < havaYogunlugu(30, 101325, 0));
});
test('rakımla yoğunluk düşer', () => {
  yakin(basincTahmini(1000, 15) / 100, 899, 6, 'hPa');
  assert.ok(havaYogunlugu(20, basincTahmini(1000, 20)) < havaYogunlugu(20, 101325) * 0.92);
});

test('logaritmik profil 10 m rüzgârını azaltır', () => {
  yakin(ruzgarAracYuksekligi(10) / 10, 0.6, 0.05, 'oran');
  assert.equal(ruzgarAracYuksekligi(0), 0);
});
test('rüzgâr yönü ayrışması: karşıdan, arkadan, yandan', () => {
  const k = ruzgarBilesenleri(10, 0, 0), a = ruzgarBilesenleri(10, 180, 0), y = ruzgarBilesenleri(10, 90, 0);
  assert.ok(k.karsi > 5 && Math.abs(k.yan) < 0.01);
  assert.ok(a.karsi < -5);
  assert.ok(Math.abs(y.karsi) < 0.01 && y.yan > 5);
});
test('yan rüzgâr direnci artırır', () => {
  const duz = akisDirenci(110, 0, 0, 0.743), yan = akisDirenci(110, 0, 8, 0.743);
  assert.ok(yan.cda > duz.cda && yan.kuvvet > duz.kuvvet);
  assert.ok(yan.beta > 5 && yan.beta <= 15);
});

test('ısı pompası COP soğukta düşer', () => {
  assert.ok(isiPompasiCop(15) > isiPompasiCop(0) && isiPompasiCop(0) > isiPompasiCop(-10));
  assert.equal(isiPompasiCop(-30), 1);
});
test('yardımcı yük: ılıman en düşük, soğuk en yüksek', () => {
  yakin(yardimciKw(20), 0.5, 0.1, '20 °C');
  yakin(yardimciKw(-10), 4.2, 0.3, '−10 °C');
  assert.ok(yardimciKw(35) > yardimciKw(22));
});

test('EV Database çapaları korunur', () => {
  yakin(whKm('otoyol', 110, deniz), 190, 5, '20 °C');
  yakin(whKm('otoyol', 110, { ...deniz, T: -10 }), 245, 6, '−10 °C');
});

test('rejenerasyon verimi soğukta ve sert frende düşer', () => {
  assert.ok(rejenVerimi(20) > rejenVerimi(-10));
  assert.ok(rejenVerimi(20, 0.8) > rejenVerimi(20, 3.0));
  assert.ok(rejenVerimi(20) <= 0.85);
});
test('dolu batarya rejenerasyonu kabul etmez', () => {
  assert.equal(rejenKabulKw(98, 20), 0);
  assert.ok(rejenKabulKw(70, 20) > rejenKabulKw(85, 20));
  assert.ok(rejenKabulKw(70, -10) < rejenKabulKw(70, 20) * 0.4);
});
test('dik inişte dolu batarya enerjiyi balataya verir', () => {
  const dolu = inisGeriKazanim(800, 2150, 10, 90, 98, 20);
  const bos = inisGeriKazanim(800, 2150, 10, 90, 60, 20);
  assert.equal(dolu.kwh, 0);
  assert.ok(dolu.kisilanKwh > 4 && bos.kwh > 2 && bos.kisilanKwh < 0.5);
});
test('uzun yumuşak iniş kısılmaz', () => {
  const g = inisGeriKazanim(780, 2150, 90, 85, 95, 20);
  assert.equal(g.kisilanKwh, 0);
  assert.ok(g.kwh > 3);
});

test('bölüm hesabı tırmanış ve geri kazanımı ayrı raporlar', () => {
  const b = { tip: 'tek', km: 20, cikis: 400, inis: 100, hiz: 80 };
  const r = bolumHesap(b, 80, VARSAYILAN, 50);
  assert.ok(r.tirmanisKwh > 2.5 && r.geriKazanimKwh > 0.4 && r.geriKazanimKwh < r.tirmanisKwh);
});
test('rüzgâr vektörü yol yönüne göre işler', () => {
  const k = { ...deniz, ruzgarHizi: 12, ruzgarYonu: 0 };
  const karsi = whKm('otoyol', 110, k, 0), arkadan = whKm('otoyol', 110, k, 180);
  assert.ok(karsi > arkadan * 1.15);
});
