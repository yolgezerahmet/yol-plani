import test from 'node:test';
import assert from 'node:assert/strict';
import { denetimPaketle, rotadakiDenetim } from '../www/core/denetim.js';

const YANIT = { elements: [
  { type: 'node', lat: 39.5001, lon: 33.0, tags: { highway: 'speed_camera', maxspeed: '90' } },
  { type: 'node', lat: 39.5, lon: 34.0, tags: { highway: 'speed_camera' } },               // rotadan uzak
  { type: 'relation', center: { lat: 39.205, lon: 33.0 }, tags: { type: 'enforcement', enforcement: 'average_speed', maxspeed: '110', name: 'Deneme Koridoru' } },
  { type: 'relation', tags: { type: 'enforcement', enforcement: 'average_speed' } },        // konumsuz
] };
const SEKIL = [[39.9, 33.0], [39.0, 33.0]];

test('Overpass yanıtı paketlenir; konumsuz öğe atlanır', () => {
  const p = denetimPaketle(YANIT, '2026-09-21');
  assert.equal(p.n.length, 3);
  assert.deepEqual(p.n[2], [39.205, 33, 1, 110, 'Deneme Koridoru']);
});

test('rotadaki kamera ve koridor km sırasıyla bulunur, uzaktaki elenir', () => {
  const r = rotadakiDenetim(denetimPaketle(YANIT), SEKIL);
  assert.deepEqual(r.map(x => x.tur), ['kamera', 'koridor']);
  assert.equal(r[0].limit, 90); assert.ok(Math.abs(r[0].km - 44.5) < 1);
  assert.equal(r[1].ad, 'Deneme Koridoru');
});

test('paket yoksa boş döner', () => { assert.deepEqual(rotadakiDenetim(null, SEKIL), []); });
