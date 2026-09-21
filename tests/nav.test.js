import test from 'node:test';
import assert from 'node:assert/strict';
import { googleRota, wazeHedef, siradakiDurak } from '../www/core/nav.js';

const BAS = { lat: 39.8985, lon: 32.8617 }, SON = { lat: 37.5753, lon: 36.9228 };
const d = (km, enlem, boylam) => ({ km, istasyon: { enlem, boylam } });

test('Google rotası çıkış, varış ve durakları sırayla taşır', () => {
  const r = googleRota(BAS, SON, [d(140, 39.15, 34.16), d(330, 38.72, 35.49)]);
  const u = new URL(r.url);
  assert.equal(u.hostname, 'www.google.com');
  assert.equal(u.searchParams.get('origin'), '39.89850,32.86170');
  assert.equal(u.searchParams.get('destination'), '37.57530,36.92280');
  assert.equal(u.searchParams.get('waypoints'), '39.15000,34.16000|38.72000,35.49000');
  assert.equal(r.araNokta, 2); assert.equal(r.kirpildi, false);
});

test('durak yoksa ara nokta parametresi eklenmez', () => {
  assert.equal(new URL(googleRota(BAS, SON, []).url).searchParams.has('waypoints'), false);
});

test('sınırın üstündeki duraklar kırpılır ve bildirilir', () => {
  const r = googleRota(BAS, SON, Array.from({ length: 12 }, (_, i) => d(i * 50, 39, 33 + i * 0.1)), { sinir: 9 });
  assert.equal(r.araNokta, 9); assert.equal(r.kirpildi, true);
  assert.equal(new URL(r.url).searchParams.get('waypoints').split('|').length, 9);
});

test('koordinatı olmayan durak atlanır', () => {
  const r = googleRota(BAS, SON, [d(100, null, null), d(200, 39, 34)]);
  assert.equal(r.araNokta, 1);
});

test('Waze bağlantısı tek hedefe gider', () => {
  const u = new URL(wazeHedef({ lat: 39.15, lon: 34.16 }));
  assert.equal(u.searchParams.get('ll'), '39.15000,34.16000');
  assert.equal(u.searchParams.get('navigate'), 'yes');
});

test('sıradaki durak geçilen km ile bulunur', () => {
  const dd = [d(140, 1, 1), d(330, 2, 2)];
  assert.equal(siradakiDurak(dd, 0).km, 140);
  assert.equal(siradakiDurak(dd, 200).km, 330);
  assert.equal(siradakiDurak(dd, 400), null);
});
