import test from 'node:test';
import assert from 'node:assert/strict';
import { elmBaytlari, coz220101, hex, hexBayt, ElmOturum } from '../www/core/obd.js';

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
});
test('hücre gerilimleri dolu bataryayla tutarlı', () => {
  const d = coz220101(elmBaytlari(ORNEK));
  assert.equal(d.hucreMaxV, 4.1); assert.equal(d.hucreMinV, 4.1);
  assert.ok(d.hucreMaxNo >= 1 && d.hucreMaxNo <= 192);
  assert.equal(d.yardimciAkuV, 14.1);
  assert.equal(d.bataryaMaxT, 16); assert.equal(d.bataryaMinT, 13);
});
test('enerji sayaçları Ah sayaçlarıyla karışmaz', () => {
  const d = coz220101(elmBaytlari(ORNEK));
  assert.equal(d.cecKwh, 299.5); assert.equal(d.cedKwh, 248.8);
  assert.equal(d.cccAh, 399.4); assert.equal(d.cdcAh, 340.9);
  const kv = d.cecKwh / d.cccAh;
  assert.ok(kv > 0.65 && kv < 0.8, `kWh/Ah ≈ paket gerilimi (kV): ${kv.toFixed(2)}`);
  assert.ok(d.calismaSaat > 300 && d.calismaSaat < 320);
});
test('şarj akımı DC şarj olarak işaretlenir', () => {
  const b = elmBaytlari(ORNEK); b[13] = 0xF8; b[14] = 0x30; // −200,0 A
  const d = coz220101(b);
  assert.equal(d.dcSarj, true); assert.ok(d.gucKw < -150);
});
test('ham bayt onaltılık metne gidip geri gelir', () => {
  const b = elmBaytlari(ORNEK);
  assert.deepEqual(hexBayt(hex(b)), b);
});
test('NO DATA hata fırlatır', () => assert.throws(() => elmBaytlari('NO DATA\r>')));
test('yanlış servis reddedilir', () => assert.throws(() => coz220101([0x62, 0x01, 0x05, ...Array(60).fill(0)])));

function sahteTasima(yanitlar) {
  let dinleyici; const giden = [];
  return {
    giden,
    dinle(cb) { dinleyici = cb; },
    async gonder(m) {
      giden.push(m.trim());
      const y = yanitlar[m.trim()] ?? 'OK';
      // Yanıtı parçalı gönder: BLE bildirimleri 20 baytlık dilimler hâlinde gelir.
      const tam = y + '\r\r>';
      setTimeout(() => { for (let i = 0; i < tam.length; i += 20) dinleyici(tam.slice(i, i + 20)); }, 1);
    },
  };
}

test('ELM oturumu başlatma sırasını gönderir ve parçalı yanıtı birleştirir', async () => {
  const t = sahteTasima({ 220101: ORNEK.replace('>', '') });
  const o = new ElmOturum(t);
  await o.baslat();
  assert.deepEqual(t.giden, ['ATZ', 'ATE0', 'ATL0', 'ATH0', 'ATSP6', 'ATSH7E4']);
  const d = coz220101(await o.oku('220101'));
  assert.equal(d.socBms, 95.5);
});
test('yanıt gelmezse zaman aşımı hatası verir, sonraki komut çalışır', async () => {
  let dinleyici;
  const t = { dinle(cb) { dinleyici = cb; }, async gonder(m) { if (m.startsWith('AT')) setTimeout(() => dinleyici('OK\r>'), 1); } };
  const o = new ElmOturum(t, { zamanAsimiMs: 30 });
  await assert.rejects(o.komut('220101'), /yanıt gelmedi/);
  assert.match(await o.komut('ATE0'), /OK/);
});
