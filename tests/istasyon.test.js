import test from 'node:test';
import assert from 'node:assert/strict';
import { istekUrl, guvenPuani, normalize, rotayaIzdusur, rotaUstunde,
         ulasilabilir, yedekZinciri, SOKET } from '../www/core/istasyon.js';

const SIMDI = Date.parse('2026-09-21T00:00:00Z');
const ay = n => new Date(SIMDI - n * 30 * 24 * 3600 * 1000).toISOString();
const poi = (id, lat, lon, kw, tip = SOKET.ccs2, guncel = ay(1)) => ({
  ID: id, AddressInfo: { Title: 'İstasyon ' + id, Latitude: lat, Longitude: lon, Town: 'Kayseri' },
  Connections: [{ ConnectionTypeID: tip, PowerKW: kw, Quantity: 2 }],
  OperatorID: 100, DateLastStatusUpdate: guncel,
});

test('istek adresi güç ve yarıçap filtresini taşır', () => {
  const u = istekUrl(38.7, 35.5, { yaricapKm: 30, minKw: 50 });
  assert.ok(u.includes('latitude=38.7') && u.includes('distance=30') && u.includes('minpowerkw=50'));
});

test('güven puanı kayıt yaşıyla düşer', () => {
  assert.equal(guvenPuani(ay(1), SIMDI), 1);
  assert.ok(guvenPuani(ay(12), SIMDI) < 1 && guvenPuani(ay(12), SIMDI) > 0.35);
  assert.equal(guvenPuani(ay(36), SIMDI), 0.35);
  assert.equal(guvenPuani(null, SIMDI), 0.3, 'tarih yoksa düşük güven');
});

test('uyumsuz soket elenir, güç ve soket sayısı okunur', () => {
  const ccs = normalize(poi(1, 38.7, 35.5, 180), { simdi: SIMDI });
  assert.equal(ccs.kw, 180); assert.equal(ccs.soketSayisi, 2); assert.equal(ccs.guven, 1);
  assert.equal(normalize(poi(2, 38.7, 35.5, 50, SOKET.chademo), { simdi: SIMDI }), null);
  assert.equal(normalize(poi(3, 38.7, 35.5, 0), { simdi: SIMDI }), null, 'güç bilgisi yoksa elenir');
});

test('istasyon rotaya izdüşürülür', () => {
  const sekil = [[39.0, 33.0], [39.0, 33.5], [39.0, 34.0]];
  const yakin = rotayaIzdusur({ enlem: 39.0, boylam: 33.5 }, sekil);
  assert.ok(yakin.sapmaKm < 1 && yakin.rotaKm > 40 && yakin.rotaKm < 45);
  const uzak = rotayaIzdusur({ enlem: 40.0, boylam: 33.5 }, sekil);
  assert.ok(uzak.sapmaKm > 100);
});

test('sapma sınırı dışındakiler elenir ve km sırasına girer', () => {
  const sekil = [[39.0, 33.0], [39.0, 34.0]];
  const liste = rotaUstunde([
    { id: 1, enlem: 39.0, boylam: 33.8 },
    { id: 2, enlem: 41.0, boylam: 33.5 },
    { id: 3, enlem: 39.01, boylam: 33.2 },
  ], sekil, 5);
  assert.deepEqual(liste.map(x => x.id), [3, 1]);
});

test('ulaşılabilirlik sapmayı iki yönlü sayar', () => {
  const ist = [
    { id: 1, rotaKm: 100, sapmaKm: 0, kw: 150, guven: 1 },
    { id: 2, rotaKm: 100, sapmaKm: 20, kw: 150, guven: 1 }, // 40 km ek sürüş
  ];
  // 20 kWh, 200 Wh/km → 100 km menzil: birincisi tam sınırda, ikincisi ulaşılmaz
  const u = ulasilabilir(ist, 0, 20, 200, 0);
  assert.deepEqual(u.map(x => x.id), [1]);
  assert.equal(u[0].gerekenKm, 100);
});

test('rezerv menzilden düşülür', () => {
  const ist = [{ id: 1, rotaKm: 95, sapmaKm: 0, kw: 150, guven: 1 }];
  assert.equal(ulasilabilir(ist, 0, 20, 200, 0).length, 1);
  assert.equal(ulasilabilir(ist, 0, 20, 200, 3).length, 0, 'rezervle yetişmiyor');
});

test('yedek zinciri asıl durağı dışlar ve güce göre sıralar', () => {
  const ist = [
    { id: 1, rotaKm: 200, sapmaKm: 0, kw: 60, guven: 1 },
    { id: 2, rotaKm: 180, sapmaKm: 2, kw: 180, guven: 1 },
    { id: 3, rotaKm: 150, sapmaKm: 1, kw: 120, guven: 0.35 },
  ];
  const [d] = yedekZinciri([{ km: 200, kalanKwh: 12 }], ist, 200, { rezervKwh: 0 });
  assert.equal(d.yedekVar, true);
  assert.deepEqual(d.yedekler.map(x => x.id), [2, 3], 'asıl durak (200 km) listede yok');
  assert.ok(d.veriGuveni < 1 && d.veriGuveni > 0.6);
});

test('ulaşılabilir yedek yoksa açıkça bildirilir', () => {
  const [d] = yedekZinciri([{ km: 200, kalanKwh: 5 }], [
    { id: 9, rotaKm: 400, sapmaKm: 0, kw: 180, guven: 1 },
  ], 200);
  assert.equal(d.yedekVar, false);
  assert.equal(d.veriGuveni, 0);
});
