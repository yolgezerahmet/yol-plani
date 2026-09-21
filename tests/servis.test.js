import test from 'node:test';
import assert from 'node:assert/strict';
import { paketAc, rotaGetir, rotaIstasyonlari, seyrelt } from '../www/core/servis.js';

const yanit = (veri, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => veri });

// Valhalla polyline6: [(39.9, 32.85), (39.0, 34.0)] kısa bir şekil
function kodla(noktalar) {
  let s = '', pLa = 0, pLo = 0;
  const bir = v => { v = v < 0 ? ~(v << 1) : v << 1; let r = ''; while (v >= 0x20) { r += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return r + String.fromCharCode(v + 63); };
  for (const [la, lo] of noktalar) { const a = Math.round(la * 1e6), b = Math.round(lo * 1e6); s += bir(a - pLa) + bir(b - pLo); pLa = a; pLo = b; }
  return s;
}
const SEKIL = kodla([[39.9, 32.85], [39.5, 33.4], [39.0, 34.0]]);

test('rota servisi Valhalla yanıtlarını bölümlere çevirir', async () => {
  const cagrilar = [];
  const getir = async (url, o) => {
    cagrilar.push(url);
    if (url.endsWith('/route')) return yanit({ trip: { legs: [{ shape: SEKIL }], summary: { time: 7200, length: 150 } }, alternates: [] });
    if (url.endsWith('/trace_attributes')) return yanit({ edges: [] });
    if (url.endsWith('/height')) return yanit({ range_height: [[0, 900], [1000, null], [2000, 950]] });
    throw new Error('beklenmeyen ' + url);
  };
  const r = await rotaGetir({ lat: 39.9, lon: 32.85 }, { lat: 39.0, lon: 34.0 }, getir);
  assert.equal(r.length, 1);
  assert.equal(r[0].sureDkValhalla, 120);
  assert.equal(r[0].sekil.length, 3);
  assert.deepEqual(cagrilar.map(u => u.split('/').pop()).sort(), ['height', 'route', 'trace_attributes']);
});

test('servis hatası anlaşılır mesajla yükselir', async () => {
  await assert.rejects(rotaGetir({ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, async () => yanit({}, false)), /yanıt vermedi \(503\)/);
});

const PAKET = {
  surum: 2, tarih: '2026-09-21', alanlar: ['no', 'ad', 'marka', 'op', 'enlem', 'boylam', 'dcKw', 'ccsSoket', 'ilce', 'il', 'yesil'],
  operatorler: ['ZES DİJİTAL', 'TRUGO'],
  s: [
    ['1', 'Yolüstü', 'zes', 0, 39.5, 33.405, 180, 2, 'Kaman', 'KIRŞEHİR', 0],
    ['2', 'Uzakta', 'Trugo', 1, 41.0, 29.0, 300, 4, 'Kadıköy', 'İSTANBUL', 1],
    ['3', 'Sapmalı', 'Trugo', 1, 39.45, 33.55, 120, 2, 'Kaman', 'KIRŞEHİR', 0],
  ],
};

test('paket resmî koordinatlı istasyonlara açılır', () => {
  const p = paketAc(PAKET);
  assert.equal(p.istasyonlar.length, 3);
  const i = p.istasyonlar[0];
  assert.equal(i.no, 'ŞRJ/1'); assert.equal(i.operator, 'ZES DİJİTAL');
  assert.equal(i.enlem, 39.5); assert.equal(i.konum, 'kesin'); assert.equal(i.guven, 1);
  assert.equal(p.istasyonlar[1].yesil, true);
});

test('eski biçimli paket açıkça reddedilir', () => {
  assert.throws(() => paketAc({ iller: [] }), /eski biçimde/);
});

test('seyreltme uçları korur ve aralığı büyütür', () => {
  const sekil = Array.from({ length: 101 }, (_, i) => [39 + i * 0.001, 33]);
  const c = seyrelt(sekil, 2);
  assert.deepEqual(c[0], sekil[0]); assert.deepEqual(c[c.length - 1], sekil[100]);
  assert.ok(c.length < 10);
});

test('rota istasyonları kaba elemeden sonra kesin izdüşümle gelir', () => {
  const sekil = [[39.9, 32.85], [39.5, 33.4], [39.0, 34.0]];
  const r = rotaIstasyonlari(sekil, paketAc(PAKET).istasyonlar);
  assert.equal(r.length, 1, 'İstanbul kutu dışında, sapmalı olan 5 km dışında');
  assert.equal(r[0].ad, 'Yolüstü');
  assert.ok(r[0].rotaKm > 50 && r[0].sapmaKm < 1);
});
