import test from 'node:test';
import assert from 'node:assert/strict';
import { durakOptimum, hizOnerisi, adaylariSeyrelt } from '../www/core/optimum.js';
import { durakPlanla } from '../www/core/plan.js';
import { canliDurum } from '../www/core/canli.js';
import { VARSAYILAN } from '../www/core/model.js';

const bol = (n, km = 50, o = {}) => Array.from({ length: n }, (_, i) => ({ tip: 'otoyol', km, basKm: i * km, hiz: 120, cikis: 20, inis: 20, ...o }));
const st = (km, kw, o = {}) => ({ id: 'k' + km, no: 'N' + km, ad: 'İst ' + km, marka: 'X', operator: 'ZES', kw, rotaKm: km, sapmaKm: 0.3, enlem: 39, boylam: 33, guven: 1, soketSayisi: 2, ...o });
const k = { ...VARSAYILAN, soc0: 90, rezerv: 10 };
const kurallara = (p, kk, varis) => {
  let ok = true;
  for (const d of p.duraklar) { if (d.varisSoc < kk.rezerv - 0.6) ok = false; if (d.hedefSoc > 95) ok = false; }
  return ok && p.varisSoc >= varis - 0.6;
};

test('durak gerekmiyorsa durmaz', () => {
  const p = durakOptimum(bol(4), [st(100, 180)], k, { varisSoc: 15 });
  assert.equal(p.duraklar.length, 0); assert.equal(p.yontem, 'optimum');
});

test('en iyi plan açgözlüden hiç kötü değil ve kurallara uyuyor (çok rota)', () => {
  let kazanc = 0;
  for (let t = 0; t < 12; t++) {
    const n = 8 + (t % 5) * 2;
    const ist = [];
    for (let km = 25 + (t * 7) % 30; km < n * 50 - 10; km += 35 + ((km * 13 + t) % 45)) ist.push(st(km, [50, 60, 120, 150, 180, 240, 350][(km + t) % 7]));
    const bb = bol(n);
    const g = durakPlanla(bb, ist, k, { varisSoc: 15, onIsitma: false });
    // Adil kıyas: açgözlü yöntem arıza yedeği koşulu taşımaz; o koşul ayrı testte.
    const oo = durakOptimum(bb, ist, k, { varisSoc: 15, onIsitma: false, dayanikli: false, arizaSabitDk: 0 });
    if (g.sorun) continue;
    assert.ok(!oo.sorun, `t=${t}: optimum çözüm bulamadı`);
    assert.ok(kurallara(oo, k, 15), `t=${t}: kural ihlali ${JSON.stringify(oo.duraklar.map(d => [d.km, d.varisSoc, d.hedefSoc]))}`);
    assert.ok(oo.toplamDk <= g.toplamDk + 1, `t=${t}: optimum ${oo.toplamDk} > açgözlü ${g.toplamDk}`);
    kazanc += g.toplamDk - oo.toplamDk;
  }
  assert.ok(kazanc > 0, 'toplamda kazanç yok');
});

test('güçlü istasyonu zayıfa tercih eder, gerekirse %80 üstüne çıkıp durak atlatır', () => {
  // 400 km, ortada 50 kW ve 350 kW: optimum 350 kW'ı seçer; tek durakla varmak için %80'i aşar
  const p = durakOptimum(bol(8), [st(190, 50), st(200, 350)], k, { varisSoc: 15, onIsitma: false });
  assert.equal(p.duraklar.length, 1); assert.equal(p.duraklar[0].istasyon.kw, 350);
  assert.ok(p.duraklar[0].hedefSoc > 80, String(p.duraklar[0].hedefSoc));
  assert.ok(p.varisSoc >= 14.4);
});

test('zaman değeri verilirse ucuz istasyon pahalıdan öne geçebilir', () => {
  const ist = [st(200, 180, { operator: 'ZES' }), st(205, 150, { operator: 'ZEPLİN ENERJİ' })];
  const hizli = durakOptimum(bol(8), ist, k, { varisSoc: 15, onIsitma: false });
  const ucuz = durakOptimum(bol(8), ist, k, { varisSoc: 15, onIsitma: false, saatTl: 50 });
  assert.equal(hizli.duraklar[0].istasyon.kw, 180);
  assert.equal(ucuz.duraklar[0].istasyon.operator, 'ZEPLİN ENERJİ');
});

test('çıktı canlı modla uyumlu: plan tutuyorken sapma yok', () => {
  const ist = [100, 170, 240, 310].map(x => st(x, 180));
  const p = durakOptimum(bol(8), ist, k, { varisSoc: 15, onIsitma: false });
  const d1 = p.duraklar[0], km = d1.km / 2;
  const r = canliDurum({ plan: p, k, km, soc: k.soc0 - (k.soc0 - d1.varisSoc) * 0.5 });
  assert.ok(Math.abs(r.hedefVarisSoc - d1.varisSoc) < 1.2, `${r.hedefVarisSoc} / ${d1.varisSoc}`);
});

test('seyreltme: dilim başına en güçlü üç aday', () => {
  const l = adaylariSeyrelt([1, 2, 3, 4, 5].map(i => st(10 + i * 0.1, i * 50)), 8, 3);
  assert.deepEqual(l.map(s => s.kw).sort((a, b) => a - b), [150, 200, 250]);
});

test('hız önerisi toplam süreyi karşılaştırır', () => {
  const ist = [80, 140, 200, 260, 320, 380, 440].map(x => st(x, 240));
  const h = hizOnerisi(bol(10), ist, k, { varisSoc: 15, onIsitma: false });
  assert.equal(h.liste.length, 5);
  assert.ok(h.en.toplamDk <= h.liste[2].toplamDk);
  assert.ok(h.kazancDk >= 0);
});

import { arizaOlasiligi } from '../www/core/optimum.js';

test('arıza olasılığı: soket sayısı azaltır, kendi düşük ölçümün artırır', () => {
  const p1 = arizaOlasiligi({ no: 'a', soketSayisi: 1 }), p2 = arizaOlasiligi({ no: 'a', soketSayisi: 2 }), p6 = arizaOlasiligi({ no: 'a', soketSayisi: 6 });
  assert.ok(p1 > 0.25 && p1 < 0.3); assert.ok(p2 < 0.1); assert.ok(p6 < 0.035);
  assert.ok(arizaOlasiligi({ no: 'a', soketSayisi: 2 }, [{ istasyonNo: 'a', bas: 1, dusuk: true }]) > p2 * 1.9);
  assert.ok(arizaOlasiligi({ no: 'a', soketSayisi: 2 }, [{ istasyonNo: 'a', bas: 1, dusuk: false }]) < p2);
});

test('dayanıklı plan: her durakta yedeğe rezervle ulaşılır; yalnız istasyon seçilmez', () => {
  // 150'de tek başına güçlü istasyon (yedeği 95 km ileride), 170 ve 182'de iki orta istasyon
  const ist = [st(150, 350, { soketSayisi: 1 }), st(170, 180, { soketSayisi: 4 }), st(182, 150, { soketSayisi: 4 }), st(245, 180), st(256, 180), st(330, 180), st(338, 150)];
  const kk = { ...k, soc0: 70, rezerv: 10 };
  const d = durakOptimum(bol(8), ist, kk, { varisSoc: 15, onIsitma: false });
  assert.equal(d.dayaniklilik, 'tam');
  for (const x of d.duraklar) {
    assert.ok(x.ariza.yedek, 'yedek yok: ' + x.km);
    assert.ok(x.ariza.yedekVarisSoc >= 3 - 0.6, `${x.km}: yedeğe %${x.ariza.yedekVarisSoc}`);
    assert.ok(x.varisSoc >= kk.rezerv - 0.6);
  }
  const serbest = durakOptimum(bol(8), ist, kk, { varisSoc: 15, onIsitma: false, dayanikli: false });
  assert.equal(serbest.dayaniklilik, 'kapali');
  assert.ok(serbest.toplamDk <= d.toplamDk + 1);                     // dayanıklılığın bedeli süreyle ölçülür
});

test('dayanıklı çözüm yoksa koşulsuz plana düşer ve bunu söyler', () => {
  const d = durakOptimum(bol(8), [st(200, 350)], k, { varisSoc: 15, onIsitma: false });
  assert.equal(d.dayaniklilik, 'yok'); assert.equal(d.duraklar.length, 1);
  assert.equal(d.duraklar[0].ariza.yedek, null);
});

test('durağa varış alt sınırı kullanıcıdan: %20 istenirse her durağa en az %20 ile varılır', () => {
  const ist = [60, 100, 140, 180, 220, 260, 300, 340, 380].flatMap(x => [st(x, 180), st(x + 6, 150)]);
  const d10 = durakOptimum(bol(8), ist, { ...k, rezerv: 10 }, { varisSoc: 15, onIsitma: false });
  const d20 = durakOptimum(bol(8), ist, { ...k, rezerv: 20 }, { varisSoc: 25, onIsitma: false, enYuksekSoc: 80 });
  assert.ok(d20.duraklar.every(x => x.varisSoc >= 19.4 && x.hedefSoc <= 80), JSON.stringify(d20.duraklar.map(x => [x.varisSoc, x.hedefSoc])));
  assert.ok(d20.varisSoc >= 24.4);
  assert.ok(d20.toplamDk >= d10.toplamDk);
});
