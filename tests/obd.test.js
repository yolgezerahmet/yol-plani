import test from 'node:test';
import assert from 'node:assert/strict';
import { elmBaytlari, coz220101 } from '../www/core/obd.js';

// Kaynak: ioniqforum.com "OBD2 PIDs for Ioniq 5/6" başlığındaki ham 220101 yanıtı.
const ORNEK = `03E
0: 62 01 01 EF FB E7
1: EF BF 00 00 00 00 00
2: 00 03 1E D4 10 0D 10
3: 0E 0F 0D 0F 00 39 CD
4: 55 CD 48 00 00 8D 00
5: 00 0F 9A 00 00 0D 51
6: 00 00 0B B3 00 00 09
7: B8 00 11 00 E7 00 03
8: 14 00 00 00 00 06 C4
>`;

test('çok çerçeveli yanıt 0x3E bayta iner', () => assert.equal(elmBaytlari(ORNEK).length, 0x3E));
test('forum örneği makul değerler verir', () => {
  const d = coz220101(elmBaytlari(ORNEK));
  assert.equal(d.socBms, 95.5);
  assert.equal(d.voltajV, 789.2);
  assert.equal(d.akimA, 0.3);
  assert.equal(d.cecKwh, 399.4);
  assert.equal(d.cedKwh, 340.9);
});
test('NO DATA hata fırlatır', () => assert.throws(() => elmBaytlari('NO DATA\r>')));
test('yanlış servis reddedilir', () => assert.throws(() => coz220101([0x62, 0x01, 0x05, ...Array(60).fill(0)])));
