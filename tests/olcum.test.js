import test from 'node:test';
import assert from 'node:assert/strict';
import { oturumKonumu, istasyonEsle, olcumOzeti } from '../www/core/olcum.js';

const IST = [{ no: 'A', ad: 'Kırşehir', enlem: 39.1500, boylam: 34.1600, kw: 180 },
             { no: 'B', ad: 'Uzak', enlem: 39.2000, boylam: 34.3000, kw: 60 }];

test('oturum konumu ortanca ile, tek sapan GPS noktası bozmaz', () => {
  const k = oturumKonumu([{ enlem: 39.15, boylam: 34.16 }, { enlem: 39.1501, boylam: 34.1601 }, { enlem: 40, boylam: 35 }]);
  assert.equal(k.enlem, 39.1501);
});

test('150 m içindeki istasyon eşlenir, uzaktaki eşlenmez', () => {
  assert.equal(istasyonEsle({ enlem: 39.1505, boylam: 34.1605 }, IST).istasyon.no, 'A');
  assert.equal(istasyonEsle({ enlem: 39.17, boylam: 34.16 }, IST), null);
});

test('beklenenin çok altında veren istasyon işaretlenir', () => {
  const nokta = (soc, kw) => ({ soc, kw, T: 25, enlem: 39.15, boylam: 34.16 });
  const zayif = olcumOzeti({ bas: Date.UTC(2026, 8, 20), soc0: 20, soc1: 60, T0: 25, dk: 30, tepeKw: 48,
    noktalar: [nokta(20, 45), nokta(30, 46), nokta(40, 48), nokta(50, 47)] }, IST);
  assert.equal(zayif.istasyonNo, 'A'); assert.equal(zayif.dusuk, true);
  const iyi = olcumOzeti({ bas: Date.UTC(2026, 8, 20), soc0: 20, soc1: 60, T0: 25, dk: 18, tepeKw: 165,
    noktalar: [nokta(20, 160), nokta(30, 162), nokta(40, 165), nokta(50, 150)] }, IST);
  assert.equal(iyi.dusuk, false);
});
