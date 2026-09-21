import test from 'node:test';
import assert from 'node:assert/strict';
import { overpassSorgusu, overpassCozumle, anahtar, dizinKur, bul, mesafeKm, konumSozlugu } from '../www/core/yerad.js';

const NOKTALAR = [
  { ad: 'Mimar Sinan', tur: 'suburb', lat: 38.75, lon: 35.55 },
  { ad: 'Yıldırımbeyazıt', tur: 'neighbourhood', lat: 38.72, lon: 35.49 },
  { ad: 'Bahçelievler', tur: 'neighbourhood', lat: 38.73, lon: 35.48 },
  { ad: 'Bahçelievler', tur: 'village', lat: 37.58, lon: 36.92 },
  { ad: 'Gesi', tur: 'village', lat: 38.83, lon: 35.60 },
];

test('Overpass sorgusu kutuyu ve yer türlerini içerir', () => {
  const q = overpassSorgusu([38.3, 35.2, 38.9, 36.6]);
  assert.match(q, /node\["place"~"neighbourhood\|suburb\|quarter\|village\|town\|city"\]/);
  assert.match(q, /\(38\.3,35\.2,38\.9,36\.6\)/);
});

test('Overpass yanıtı adsız ve konumsuz düğümleri eler', () => {
  const n = overpassCozumle({ elements: [
    { tags: { name: 'A', place: 'suburb' }, lat: 1, lon: 2 },
    { tags: { place: 'village' }, lat: 3, lon: 4 },
    { tags: { name: 'C', place: 'village' } },
  ]});
  assert.equal(n.length, 1);
  assert.equal(n[0].ad, 'A');
});

test('anahtar Türkçe harf ve boşluk farkını siler', () => {
  assert.equal(anahtar('Mimarsinan'), anahtar('Mimar Sinan'));
  assert.equal(anahtar('Yıldırım Beyazıt'), anahtar('Yıldırımbeyazıt'));
  assert.equal(anahtar('Ümit Mahallesi'), anahtar('ümit'));
  assert.equal(anahtar('Gesi Bağpınar'), 'gesibagpinar');
});

test('yazım farkı olan mahalle bulunur', () => {
  const d = dizinKur(NOKTALAR);
  assert.equal(bul(d, 'Mimarsinan', { lat: 38.72, lon: 35.49 }).ad, 'Mimar Sinan');
  assert.equal(bul(d, 'Yıldırım Beyazıt').ad, 'Yıldırımbeyazıt');
  assert.equal(bul(d, 'Bilinmeyen Mahallesi'), null);
});

test('aynı adlı mahallelerden ilçeye yakın olan seçilir', () => {
  const d = dizinKur(NOKTALAR);
  const kayseri = bul(d, 'Bahçelievler', { lat: 38.72, lon: 35.48 });
  const maras = bul(d, 'Bahçelievler', { lat: 37.57, lon: 36.92 });
  assert.ok(Math.abs(kayseri.lat - 38.73) < 0.01);
  assert.ok(Math.abs(maras.lat - 37.58) < 0.01);
  assert.equal(kayseri.adaySayisi, 2, 'çok adaylı olduğu bildirilir');
});

test('ilçeden çok uzaktaki aday reddedilir', () => {
  const d = dizinKur(NOKTALAR);
  assert.equal(bul(d, 'Gesi', { lat: 37.58, lon: 36.92 }), null, 'Maraş ilçesine Kayseri köyü verilmez');
});

test('şehir içi mahalle türü köyden önce gelir', () => {
  const d = dizinKur([
    { ad: 'Yeni', tur: 'village', lat: 38.7, lon: 35.5 },
    { ad: 'Yeni', tur: 'neighbourhood', lat: 38.7, lon: 35.5 },
  ]);
  assert.equal(bul(d, 'Yeni', { lat: 38.7, lon: 35.5 }).tur, 'neighbourhood');
});

test('mesafe bilinen iki nokta arasında doğru', () => {
  const km = mesafeKm({ lat: 39.0, lon: 35.0 }, { lat: 39.0, lon: 36.0 });
  assert.ok(km > 85 && km < 90, `39. enlemde 1 derece boylam ~86 km, bulunan ${km.toFixed(1)}`);
});

test('konum sözlüğü istasyon listesinden üretilir ve tekilleşir', () => {
  const d = dizinKur(NOKTALAR);
  const ist = [
    { mahalle: 'Mimarsinan Mahallesi', ilce: 'Melikgazi', il: 'KAYSERİ' },
    { mahalle: 'Mimarsinan Mahallesi', ilce: 'Melikgazi', il: 'KAYSERİ' },
    { mahalle: 'Yok Böyle', ilce: 'Melikgazi', il: 'KAYSERİ' },
  ];
  const s = konumSozlugu(ist, d, { Melikgazi: { lat: 38.72, lon: 35.49 } });
  assert.equal(Object.keys(s).length, 1);
  assert.deepEqual(s['Mimarsinan Mahallesi, Melikgazi, KAYSERİ'], [38.75, 35.55]);
});

test('ilçe merkezi yoksa aynı adlı adaylardan hiçbiri seçilmez', () => {
  const d = dizinKur(NOKTALAR);
  assert.equal(bul(d, 'Bahçelievler'), null, 'iki aday varken tahmin yürütülmez');
  assert.ok(bul(d, 'Gesi'), 'tekil ad yine bulunur');
});

test('ilçe merkezi yoksa genel mahalle adı tekil olsa da reddedilir', () => {
  const d = dizinKur([{ ad: 'Merkez', tur: 'town', lat: 39.14, lon: 34.16 }]);
  assert.equal(bul(d, 'Merkez Mahallesi'), null, 'Pursaklar Merkez, Kırşehir Merkez sanılmaz');
  assert.ok(bul(d, 'Merkez', { lat: 39.1, lon: 34.1 }), 'ilçe merkezi biliniyorsa yakınlıkla kabul');
});
