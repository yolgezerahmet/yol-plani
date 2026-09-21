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

import { kesifTara, KESIF } from '../www/core/obd.js';
test('keşif taraması başlık değiştirir, yanıtsızı atlar, BMS başlığına döner', async () => {
  const t = sahteTasima({ 220105: '62 01 05 AA BB', '22B002': 'NO DATA' });
  const o = new ElmOturum(t, { zamanAsimiMs: 200 });
  const r = await kesifTara(o, KESIF.slice(0, 3));
  assert.equal(r[0].yanit, true); assert.equal(r[0].hex, '620105aabb');
  assert.equal(r[2].yanit, false, 'NO DATA yanıt sayılmaz');
  assert.deepEqual(t.giden.filter(g => g.startsWith('ATSH')), ['ATSH7E4', 'ATSH7C6', 'ATSH7E4']);
});

import { wicanYukIndisi, coz220105, coz220106, coz22C00B, coz22B002, coz220100, kesifTara as _kt } from '../www/core/obd.js';

test('WiCAN çerçeve indisi → yük indisi: iki açık kaynak aynı baytı gösteriyor', () => {
  // evDash karakter indisi / 2 = yük indisi
  assert.equal(wicanYukIndisi(34), 56 / 2);   // SoH
  assert.equal(wicanYukIndisi(41), 68 / 2);   // gösterge SoC
  assert.equal(wicanYukIndisi(10), 14 / 2);   // ön sol basınç
  assert.equal(wicanYukIndisi(15), 24 / 2); assert.equal(wicanYukIndisi(21), 34 / 2); assert.equal(wicanYukIndisi(27), 44 / 2);
  assert.equal(wicanYukIndisi(12), 18 / 2);   // kilometre sayacı ilk baytı
  assert.equal(wicanYukIndisi(11), 16 / 2); assert.equal(wicanYukIndisi(12), 18 / 2); // iç, dış sıcaklık
  assert.equal(wicanYukIndisi(10), 7);        // 220101 SoC: mevcut çözücüyle aynı
});

const dolu = (n, ilk, yaz) => { const b = new Array(n).fill(0); ilk.forEach((v, i) => b[i] = v); for (const [i, v] of Object.entries(yaz)) b[+i] = v; return b; };

test('220105: SoH, gösterge SoC, hücre sapması', () => {
  const d = coz220105(dolu(46, [0x62, 0x01, 0x05], { 28: 0x03, 29: 0xE8, 34: 170, 23: 1 }));
  assert.equal(d.sohYuzde, 100); assert.equal(d.socGosterge, 85); assert.equal(d.hucreSapmaV, 0.02);
  assert.equal(coz220105(dolu(46, [0x62, 0x01, 0x05], { 28: 0xFF, 29: 0xFF })).sohYuzde, null);   // aralık dışı → null
  assert.throws(() => coz220105([0x62, 0x01, 0x05, 0]), /kısa/);
});

test('22C00B lastik, 22B002 kilometre, 220100 sıcaklık, 220106 soğutma suyu', () => {
  const t = coz22C00B(dolu(26, [0x62, 0xC0, 0x0B], { 7: 181, 8: 72, 12: 180, 13: 71, 17: 178, 18: 70, 22: 179, 23: 70 }));
  assert.equal(t.onSol.bar, 2.5); assert.equal(t.onSol.C, 22); assert.equal(t.arkaSag.bar, 2.47);
  assert.equal(coz22B002(dolu(14, [0x62, 0xB0, 0x02], { 9: 0x00, 10: 0x30, 11: 0x39 })).odoKm, 12345);
  const k = coz220100(dolu(12, [0x62, 0x01, 0x00], { 8: 124, 9: 70 }));
  assert.equal(k.icC, 22); assert.equal(k.disC, -5);
  const s = coz220106(dolu(30, [0x62, 0x01, 0x06], { 7: 0xF6, 27: 0x21 }));
  assert.equal(s.sogutmaSuyuC, -10); assert.equal(s.sarjBiti, true);
});

test('keşif taraması çözebildiğini çözer, çözemediğinde hamı saklar', async () => {
  const yanit = { '22B002': '62 B0 02 00 00 00 00 00 00 00 30 39 00 00', '220105': '62 01 05 00' };
  const oturum = { komut: async k => (k.startsWith('AT') ? 'OK' : yanit[k] ?? 'NO DATA') };
  const r = await _kt(oturum, [{ baslik: '7C6', pid: '22B002', ne: 'odo' }, { baslik: '7E4', pid: '220105', ne: 'soh' }]);
  assert.equal(r[0].deger.odoKm, 12345);
  assert.equal(r[1].deger, null); assert.equal(r[1].yanit, true);
});
