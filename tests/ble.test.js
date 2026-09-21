import test from 'node:test';
import assert from 'node:assert/strict';
import { kanalSec, metinHex, hexMetin, bleBaglan } from '../www/core/ble.js';
import { ElmOturum } from '../www/core/obd.js';

const H = (u, ch) => ({ uuid: u, characteristics: ch });
const C = (u, p) => ({ uuid: u, properties: p });

test('bilinen ELM hizmeti genel hizmetlerden önce seçilir', () => {
  const k = kanalSec([
    H('0000180a-0000-1000-8000-00805f9b34fb', [C('2a29', { read: true })]),
    H('0000abcd-0000-1000-8000-00805f9b34fb', [C('a1', { notify: true }), C('a2', { write: true })]),
    H('0000fff0-0000-1000-8000-00805f9b34fb', [C('fff1', { notify: true }), C('fff2', { writeWithoutResponse: true })]),
  ]);
  assert.equal(k.hizmet.slice(4, 8), 'fff0');
  assert.equal(k.yanitsiz, true);
});
test('uygun hizmet yoksa boş döner', () => assert.equal(kanalSec([H('x', [C('y', { read: true })])]), null));
test('metin onaltılığa gidip gelir', () => {
  assert.equal(metinHex('AT\r'), '41 54 0d');
  assert.equal(hexMetin('41 54 0d'), 'AT\r');
  assert.equal(hexMetin('41540d'), 'AT\r');
});

test('sahte eklentiyle uçtan uca: bağlan, başlat, oku', async () => {
  const dinleyiciler = {}; const yazilan = [];
  const eklenti = {
    initialize: async () => {}, connect: async () => {}, disconnect: async () => {},
    requestDevice: async () => ({ deviceId: 'D1', name: 'vLinker MC-IOS' }),
    getServices: async () => ({ services: [H('0000fff0-0000-1000-8000-00805f9b34fb', [C('fff1', { notify: true }), C('fff2', { write: true })])] }),
    addListener: async (k, cb) => { dinleyiciler[k] = cb; },
    startNotifications: async () => {},
    write: async ({ value }) => {
      const m = hexMetin(value); yazilan.push(m);
      if (m.endsWith('\r')) setTimeout(() => dinleyiciler['notification|D1|0000fff0-0000-1000-8000-00805f9b34fb|fff1']({ value: metinHex('OK\r\r>') }), 1);
    },
  };
  const b = await bleBaglan({ eklenti });
  assert.equal(b.cihaz.ad, 'vLinker MC-IOS');
  const o = new ElmOturum(b.tasima);
  await o.baslat();
  assert.ok(yazilan.includes('ATSH7E4\r'));
});

test('eklenti yoksa anlaşılır hata verir', async () => {
  await assert.rejects(bleBaglan({ eklenti: null }), /APK sürümünde/);
});
