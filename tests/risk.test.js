import test from 'node:test';
import assert from 'node:assert/strict';
import { sigmaOrani, bacakRiski, Z90 } from '../www/core/risk.js';
import { isabet } from '../www/core/isabet.js';
import { durakOptimum } from '../www/core/optimum.js';
import { VARSAYILAN } from '../www/core/model.js';

const bol = n => Array.from({ length: n }, (_, i) => ({ tip: 'otoyol', km: 50, basKm: i * 50, hiz: 120, cikis: 20, inis: 20 }));
const st = km => ({ id: 'k' + km, no: 'N' + km, ad: 'İst', marka: 'ZES', operator: 'ZES', kw: 180, rotaKm: km, sapmaKm: 0.3, enlem: 39, boylam: 33, guven: 1 });
const k = { ...VARSAYILAN, soc0: 90, rezerv: 10 };

test('kalibrasyon belirsizliği azaltır; hava yayılımı eklenir', () => {
  assert.equal(sigmaOrani({}).model, 0.08);
  assert.equal(sigmaOrani({ kalibreYolculuk: 5 }).model, 0.06);
  assert.equal(sigmaOrani({ olculen: 0.041 }).model, 0.041);      // aracın kendi ölçülmüş hatası önceliklidir
  const s = sigmaOrani({ kalibreYolculuk: 5, havaSenaryoKwh: [100, 104, 108], toplamKwh: 104 });
  assert.ok(Math.abs(s.hava - 8 / 4 / 104) < 1e-4); assert.ok(s.toplam > 0.06);
});

test('bacak riski: her durak ve varış için P10; uzun bacak daha belirsiz', () => {
  const p = durakOptimum(bol(10), [100, 170, 250, 330, 410].map(st), k, { varisSoc: 15, onIsitma: false });
  const r = bacakRiski(p, k, 0.06);
  assert.equal(r.bacak.length, p.duraklar.length + 1);
  for (const b of r.bacak) assert.ok(Math.abs(b.p10 - (b.ort - Z90 * b.sigma)) < 0.11);
  const uzun = r.bacak.reduce((a, b) => (b.km > a.km ? b : a));
  assert.equal(Math.max(...r.bacak.map(b => b.sigma)), uzun.sigma);
  assert.ok(r.enKotu.p10 <= Math.min(...r.bacak.map(b => b.p10)));
  assert.ok(r.bacak.every(b => b.altKritik >= 0 && b.altKritik < 0.5));
});

test('isabet: ortalama mutlak hata, yön ve varış hatası', () => {
  const r = isabet([
    { km: 100, planKwh: 20, olculenKwh: 22, planVarisSoc: 30, varisSoc: 27 },
    { km: 50, planKwh: 11, olculenKwh: 10, planVarisSoc: 40, varisSoc: 41 },
    { km: 5, planKwh: 1, olculenKwh: 2 },
  ]);
  assert.equal(r.yolculuk, 2);
  assert.equal(r.mape, +(((2 / 22) + (1 / 10)) / 2 * 100).toFixed(1));
  assert.equal(r.varisHataPuan, 2);
  assert.equal(isabet([]), null);
});
