import test from 'node:test';
import assert from 'node:assert/strict';
import { gpxUret } from '../www/core/gpx.js';

const plan = { toplamKm: 400, toplamKwh: 80.5, varisSoc: 16, profil: [[0, 90]], enerji: { toplamKm: 400, soc0: 90 },
  duraklar: [{ no: 1, varisSoc: 22.4, hedefSoc: 78, dk: 17, ekKwh: 33.4, onIsitma: { baslaKm: 150 },
    istasyon: { ad: 'Kırşehir & Co', marka: 'ZES', kw: 180, soketSayisi: 2, enlem: 39.15, boylam: 34.16 },
    ariza: { yedek: { marka: 'Trugo' }, yedekKm: -3 } }] };

test('GPX: durak, ön ısıtma ve varış ara noktaları; rota ve iz; XML kaçışı', () => {
  const g = gpxUret({ bas: { lat: 39.9, lon: 32.86, ad: 'Ayrancı' }, son: { lat: 37.57, lon: 36.92 }, sekil: [[39.9, 32.86], [39.15, 34.16], [37.57, 36.92]], plan });
  assert.match(g, /<wpt lat="39.15000" lon="34.16000"><name>1\. şarj: ZES · %22→%78, 17 dk<\/name>/);
  assert.match(g, /Kırşehir &amp; Co/); assert.match(g, /Ön ısıtmayı 150\. km/); assert.match(g, /Çalışmazsa: Trugo, 3 km geride/);
  assert.match(g, /<type>preheat<\/type>/); assert.match(g, /Varış · %16/); assert.match(g, /Çıkış · %90/);
  assert.equal((g.match(/<rtept /g) || []).length, 3); assert.equal((g.match(/<trkpt /g) || []).length, 3);
  assert.doesNotMatch(g, /&(?!amp;|lt;|gt;|quot;)/);
});

test('şekil yoksa iz yazılmaz, rota yazılır', () => {
  const g = gpxUret({ bas: { lat: 1, lon: 1 }, son: { lat: 2, lon: 2 }, sekil: null, plan: { ...plan, duraklar: [] } });
  assert.doesNotMatch(g, /<trk>/); assert.equal((g.match(/<rtept /g) || []).length, 2);
});
