import test from 'node:test';
import assert from 'node:assert/strict';
import { sarjGunlugu, saglikGunlugu, sohEgilimi, sarjKarisimi, karneMetni } from '../www/core/karne.js';
import { sarjOturumlari } from '../www/core/kalibrasyon.js';

const GUN = 864e5, T0 = Date.UTC(2026, 0, 1);

test('şarj oturumunda 100 kW üstü enerji ve en yüksek sıcaklık çıkarılır', () => {
  const o = Array.from({ length: 13 }, (_, i) => ({ t: T0 + i * 60e3, soc: 20 + i * 3, gucKw: i < 6 ? -150 : -60, bataryaMinT: 20, bataryaMaxT: 30 + i, cecKwh: 100 + i * 1.5, cedKwh: 0, dcSarj: true }));
  const s = sarjOturumlari(o)[0];
  assert.ok(Math.abs(s.kwhUst100 - 150 * 5 / 60) < 0.2, String(s.kwhUst100));     // 5 dakika × 150 kW
  assert.equal(s.maxT, 42);
});

test('günlükler: oturum yinelenmez; sağlık günde bir kayıt', () => {
  const o = [{ bas: 1, dk: 20, soc0: 20, soc1: 80, kwh: 35, tepeKw: 170.4, kwhUst100: 20, T0: 8, maxT: 44 }];
  let g = sarjGunlugu([], o); g = sarjGunlugu(g, o);
  assert.equal(g.length, 1); assert.equal(g[0].tepeKw, 170);
  let s = saglikGunlugu([], { t: T0, soh: 100, odoKm: 1000 });
  s = saglikGunlugu(s, { t: T0 + 3600e3, soh: 99.8, odoKm: 1010 });                // aynı gün: son okuma
  s = saglikGunlugu(s, { t: T0 + GUN, soh: 99.7, odoKm: 1200 });
  assert.equal(s.length, 2); assert.equal(s[0].soh, 99.8);
  assert.equal(saglikGunlugu(s, { t: T0 + 2 * GUN }).length, 2);                    // değer yoksa kayıt yok
});

test('eğilim: yeterli süre ve okuma yoksa hazır değil; varsa yıllık ve km başı kayıp', () => {
  const kisa = [0, 10, 20].map(d => ({ t: T0 + d * GUN, soh: 100 - d * 0.01, odoKm: d * 50 }));
  assert.equal(sohEgilimi(kisa).hazir, false);
  const uzun = Array.from({ length: 13 }, (_, i) => ({ t: T0 + i * 30 * GUN, soh: 100 - i * 0.2, odoKm: i * 1500 }));   // yılda ~%2,4, 10.000 km'de %1,33
  const e = sohEgilimi(uzun);
  assert.equal(e.hazir, true);
  assert.ok(Math.abs(e.yillikKayip - 0.2 * 365.25 / 30) < 0.05, String(e.yillikKayip));
  assert.ok(Math.abs(e.onBinKmKayip - 0.2 / 1500 * 10000) < 0.05, String(e.onBinKmKayip));
});

test('şarj karışımı: DC payı BMS sayacına göre, 100 kW üstü payı, soğuk ve sıcak oturumlar', () => {
  const sarj = [{ bas: T0 + 5 * GUN, kwh: 40, kwhUst100: 30, tepeKw: 180, T0: 4, maxT: 51 }, { bas: T0 + 20 * GUN, kwh: 20, kwhUst100: 0, tepeKw: 60, T0: 22, maxT: 35 }];
  const saglik = [{ t: T0, soh: 100, cecKwh: 1000 }, { t: T0 + 30 * GUN, soh: 100, cecKwh: 1300 }];
  const k = sarjKarisimi(sarj, saglik);
  assert.equal(k.dcKwh, 60); assert.equal(k.ust100Payi, 0.5); assert.equal(k.dcPayi, 0.2); assert.equal(k.ust100ToplamPayi, 0.1);
  assert.equal(k.sogukBaslangic, 1); assert.equal(k.sicakOturum, 1);
  assert.equal(sarjKarisimi(sarj, []).dcPayi, null);
});

test('karne metni: veri yokken ne gerektiğini, varken karşılaştırmayı söyler', () => {
  const bos = karneMetni({ sarj: [], saglik: [] });
  assert.ok(bos.some(s => /veri birikiyor/.test(s))); assert.ok(bos.some(s => /Henüz hızlı şarj kaydı yok/.test(s)));
  const saglik = Array.from({ length: 13 }, (_, i) => ({ t: T0 + i * 30 * GUN, soh: 100 - i * 0.2, odoKm: i * 1500, cecKwh: 1000 + i * 250, kapasiteKwh: 60 - i * 0.12 }));
  const sarj = Array.from({ length: 30 }, (_, i) => ({ bas: T0 + (i * 12 + 1) * GUN, kwh: 45, kwhUst100: 35, tepeKw: 190, T0: 18, maxT: 45 }));
  const m = karneMetni({ sarj, saglik, katalogKwh: 60 }).join(' ');
  assert.match(m, /yıllık kayıp \(ölçülen kapasiteden\)/); assert.match(m, /ortalama %2,3\/yıl/);
  assert.match(m, /önemli bir kısmı yüksek güçlü DC/);
  const az = karneMetni({ sarj: sarj.slice(0, 3), saglik }).join(' ');
  assert.match(az, /Hızlı şarj payın düşük/);
});
