import test from 'node:test';
import assert from 'node:assert/strict';
import { bultenCoz, yerAdlari, yerSozlugu, rotadakiKayitlar } from '../www/core/kgm.js';

const HTML = `<h5>20.09.2026</h5><table>
<tr><td>1</td><td>O-2 TEM Otoyolu Çamlık Kavşağı – Kavacık Kavşağı arasında derz onarım çalışmaları yapılacaktır.</td></tr>
<tr><td>5</td><td>Ankara-Niğde Otoyolu, üst yapı çalışması nedeniyle Kırşehir Bağlantı Yolu Kırşehir-Kayseri İstikameti Sağ Şerit Kapatılarak Trafik Kontrollü Olarak Diğer Şeritten Verilmektedir.</td></tr>
<tr><td>9</td><td>ılgaz-Korgun-Çankırı Devlet Yolunun 17-27.km.leri arasında asfalt sathi kaplama çalışmaları nedeniyle ulaşım kontrollü olarak sağlanmaktadır.</td></tr>
<tr><td></td><td><b>Kar ve Tipi Nedeniyle Kapalı Yollar</b></td></tr></table>`;

const IST = [
  { ilAdi: 'ANKARA', ilce: 'Çankaya', enlem: 39.9, boylam: 32.86 },
  { ilAdi: 'KIRŞEHİR', ilce: 'Merkez', enlem: 39.15, boylam: 34.16 },
  { ilAdi: 'KIRŞEHİR', ilce: 'Kaman', enlem: 39.36, boylam: 33.72 },
  { ilAdi: 'NİĞDE', ilce: 'Merkez', enlem: 37.97, boylam: 34.68 },
  { ilAdi: 'KAYSERİ', ilce: 'Kocasinan', enlem: 38.72, boylam: 35.49 },
  { ilAdi: 'ÇANKIRI', ilce: 'Merkez', enlem: 40.6, boylam: 33.6 },
  { ilAdi: 'ÇANKIRI', ilce: 'Ilgaz', enlem: 40.92, boylam: 33.63 },
];
// Ankara → Kırşehir → Kayseri doğrultusunda kaba rota şekli
const SEKIL = Array.from({ length: 60 }, (_, i) => { const t = i / 59;
  return t < 0.5 ? [39.9 + (39.15 - 39.9) * t * 2, 32.86 + (34.16 - 32.86) * t * 2]
                 : [39.15 + (38.72 - 39.15) * (t - 0.5) * 2, 34.16 + (35.49 - 34.16) * (t - 0.5) * 2]; });

test('bülten tarihi ve numaralı kayıtlar ayrışır', () => {
  const b = bultenCoz(HTML);
  assert.equal(b.tarih, '2026-09-20');
  assert.deepEqual(b.kayit.map(k => k.no), [1, 5, 9]);
});

test('yer adları Türkçe büyük/küçük harfe dayanıklı bulunur', () => {
  const s = yerSozlugu(IST);
  assert.deepEqual(yerAdlari('Ankara-Niğde Otoyolu, Kırşehir Bağlantı Yolu', s).sort(), ['ankara', 'kırşehir', 'niğde']);
  assert.ok(yerAdlari('ılgaz-Korgun-Çankırı Devlet Yolunun', s).includes('çankırı'));
});

test('Merkez ilçesi ad olmaz, il merkezine katılır', () => {
  const s = yerSozlugu(IST);
  assert.equal(s.merkez, undefined);
  assert.deepEqual(s['kırşehir'], [39.15, 34.16]);
});

test('rotadaki kayıt bulunur, başka bölgedeki elenir', () => {
  const r = rotadakiKayitlar(bultenCoz(HTML), SEKIL, yerSozlugu(IST));
  assert.equal(r.length, 1);
  assert.equal(r[0].no, 5); assert.equal(r[0].tur, 'serit');
  assert.ok(r[0].yerler.includes('kırşehir'));
});

test('yön adı (istikamet) yer sayılmaz; çevre yolu tek şehirle eşleşir', () => {
  const s = yerSozlugu(IST);
  const b = { kayit: [
    { no: 1, metin: 'O-2 TEM Otoyolu Kavacık Kavşağı arası, Ankara istikameti gece kapalı. Kırşehir yönü açık.' },
    { no: 3, metin: 'Ankara Çevre Otoyolunun O-20/6 Km Eskişehir istikameti üstyapı onarımı nedeniyle trafiğe kapatılacaktır.' }] };
  const r = rotadakiKayitlar(b, SEKIL, s);
  assert.deepEqual(r.map(x => x.no), [3]);
  assert.equal(r[0].tur, 'kapali');
});

test('rotanın OSM yol adı bültende geçiyorsa güçlü eşleşme', () => {
  const b = { kayit: [{ no: 5, metin: 'Ankara-Niğde Otoyolu üst yapı çalışması, sağ şerit kapalı.' }] };
  const r = rotadakiKayitlar(b, SEKIL, yerSozlugu(IST), { yolAdlari: ['Ankara-Niğde Otoyolu', 'O-21'] });
  assert.equal(r[0].guclu, true);
});

test('konum, yol adının uçlarından değil özgül yer adından', () => {
  const r = rotadakiKayitlar(bultenCoz(HTML), SEKIL, yerSozlugu(IST));
  assert.ok(r[0].kmAralik[0] > 100, JSON.stringify(r[0].kmAralik));
});
