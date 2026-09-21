import test from 'node:test';
import assert from 'node:assert/strict';
import { rotaKonumu, planSoc, dkKmde, canliKat, canliDurum, canliMesaj, kalanBolumler, yenidenPlanla } from '../www/core/canli.js';
import { durakPlanla } from '../www/core/plan.js';
import { VARSAYILAN } from '../www/core/model.js';

// Doğuya giden düz rota: 39°K'da 1° boylam ≈ 86,4 km
const SEKIL = [[39, 32], [39, 33], [39, 34], [39, 35], [39, 36]];
const bolumler = Array.from({ length: 8 }, (_, i) => ({ tip: 'otoyol', km: 43.2, basKm: i * 43.2, hiz: 120, cikis: 40, inis: 40, enlem: 39, boylam: 32 + i * 0.5 }));
const ist = [90, 150, 210, 270].map((km, i) => ({ id: 'i' + i, no: 'N' + i, ad: 'İst ' + i, marka: 'ZES', kw: 180, rotaKm: km, sapmaKm: 0.3, enlem: 39, boylam: 32 + km / 86.4, guven: 1, soketSayisi: 2 }));
const k = { ...VARSAYILAN, soc0: 80, rezerv: 10 };
const plan = durakPlanla(bolumler, ist, k, { varisSoc: 15, onIsitma: false });

test('konum rotaya oturur; rota dışı ve geriye sıçrama ayrılır', () => {
  const a = rotaKonumu({ enlem: 39.001, boylam: 33 }, SEKIL);
  assert.ok(Math.abs(a.km - 86.4) < 1.5, String(a.km)); assert.equal(a.rotaDisi, false);
  assert.equal(rotaKonumu({ enlem: 39.05, boylam: 33 }, SEKIL).rotaDisi, true);
  assert.equal(rotaKonumu({ enlem: 39, boylam: 32.5 }, SEKIL, 120).km, 120);   // GPS geriye sıçradı: önceki korunur
});

test('plan bataryası: durakta varış değeri, arada doğrusal', () => {
  const pr = [[0, 80], [100, 30], [100, 70], [200, 20]];
  assert.equal(planSoc(pr, 50), 55); assert.equal(planSoc(pr, 100), 30); assert.equal(planSoc(pr, 150), 45); assert.equal(planSoc(pr, 999), 20);
});

test('canlı katsayı: kısa yolda 1, uzadıkça ölçüme yaklaşır, uçlar sınırlı', () => {
  const e = plan.enerji;
  assert.equal(canliKat(e, 0, 10, 5).kat, 1);
  const model30 = e.kwh[1] * 30 / 43.2;
  const c30 = canliKat(e, 0, 30, model30 * 1.2), c90 = canliKat(e, 0, 90, (e.kwh[2] + (e.kwh[3] - e.kwh[2]) * (90 - 86.4) / 43.2) * 1.2);
  assert.ok(c30.kat > 1.08 && c30.kat < 1.12, String(c30.kat));
  assert.ok(Math.abs(c90.kat - 1.2) < 0.005, String(c90.kat));
  assert.equal(canliKat(e, 0, 90, 999).oran, 1.45);
});

test('plan tutuyorsa "yolunda"; tüketim yüksekse önce "hız düşür", sonra "yetmiyor"', () => {
  assert.ok(plan.duraklar.length >= 1);
  const d1 = plan.duraklar[0], km = d1.km / 2, soc = planSoc(plan.profil, km);
  const iyi = canliDurum({ plan, k, km, soc });
  assert.equal(iyi.karar, 'yolunda'); assert.equal(iyi.sira.no, 1);
  assert.ok(Math.abs(iyi.hedefVarisSoc - d1.varisSoc) < 0.6, `${iyi.hedefVarisSoc} / ${d1.varisSoc}`);
  assert.ok(iyi.kalanDk > 5 && Math.abs(iyi.kalanKm - (d1.km - km)) < 0.11);
  const pay = d1.varisSoc - k.rezerv;
  const dar = canliDurum({ plan, k, km, soc: soc - pay + 1.5 });
  assert.equal(dar.karar, 'hiz-dusur'); assert.match(canliMesaj(dar).metin, /Hızı on kilometre/);
  const kotu = canliDurum({ plan, k, km, soc: soc - pay - 2 });
  assert.equal(kotu.karar, 'yetmiyor'); assert.match(canliMesaj(kotu).anahtar, /^yetmiyor:1$/);
  assert.equal(canliDurum({ plan, k, km, soc: soc + 10 }).karar, 'onde');
  assert.equal(canliDurum({ plan, k, km, soc, rotaDisi: true }).karar, 'rota-disi');
  assert.equal(canliMesaj(iyi), null);
});

test('ön ısıtma hatırlatması: plan km geçilince ve hücre soğuksa', () => {
  const p2 = { ...plan, duraklar: plan.duraklar.map((d, i) => (i ? d : { ...d, onIsitma: { baslaKm: d.km - 40, dk: 20, kwh: 1.5 } })) };
  const d1 = p2.duraklar[0], soc = 50;
  assert.equal(canliDurum({ plan: p2, k, km: d1.km - 50, soc, bataryaT: 5 }).onIsitmaSimdi, false);
  assert.equal(canliDurum({ plan: p2, k, km: d1.km - 30, soc, bataryaT: 5 }).onIsitmaSimdi, true);
  assert.equal(canliDurum({ plan: p2, k, km: d1.km - 30, soc, bataryaT: 27 }).onIsitmaSimdi, false);
});

test('kalan bölümler: kesilen bölüm orantılı, km ekseni sıfırlanır', () => {
  const kb = kalanBolumler(bolumler, 60);
  assert.equal(kb.length, 7); assert.equal(kb[0].basKm, 0);
  assert.ok(Math.abs(kb[0].km - 26.4) < 0.01); assert.ok(Math.abs(kb[0].cikis - 40 * 26.4 / 43.2) < 0.02);
  assert.ok(Math.abs(kb.reduce((t, b) => t + b.km, 0) - (345.6 - 60)) < 0.05);
});

test('yeniden planlama: özgün km ekseninde, ilerideki istasyonlarla, canlı katsayıyla', () => {
  const y = yenidenPlanla({ bolumler, istasyonlar: ist, k, km: 60, soc: 45, kat: 1.2, opt: { varisSoc: 15, onIsitma: false } });
  assert.ok(y.duraklar.length >= 1);
  assert.ok(y.duraklar.every(d => d.km > 60 && ist.some(s => Math.abs(s.rotaKm - d.km) < 0.11)), JSON.stringify(y.duraklar.map(d => d.km)));
  assert.equal(y.profil[0][0], 60); assert.equal(y.profil[0][1], 45);
  assert.ok(Math.abs(y.enerji.toplamKm - 345.6) < 0.2);
  const d = canliDurum({ plan: y, k, km: 60, soc: 45 });            // yeni plan kendi içinde tutarlı
  assert.ok(Math.abs(d.farkSoc) < 0.1); assert.ok(d.hedefVarisSoc >= k.rezerv - 0.5);
  const normal = yenidenPlanla({ bolumler, istasyonlar: ist, k, km: 60, soc: 45, kat: 1, opt: { varisSoc: 15, onIsitma: false } });
  assert.ok(y.toplamKwh > normal.toplamKwh * 1.15);
});

import { sarjDurumu } from '../www/core/canli.js';
test('durakta şarj sonrası beklenen değer şarj hedefidir; şarj durumu hedefi ve yavaş istasyonu bildirir', () => {
  const d1 = plan.duraklar[0];
  const sonra = canliDurum({ plan, k, km: d1.km, soc: d1.hedefSoc });
  assert.ok(Math.abs(sonra.farkSoc) < 0.1); assert.notEqual(sonra.karar, 'onde');
  const s = sarjDurumu({ durak: d1, soc: d1.hedefSoc - 20, gucKw: -60, sarjDkFn: (a, b) => (b - a) * 0.4 });
  assert.equal(s.tamam, false); assert.equal(s.kalanDk, 8); assert.equal(s.yavas, d1.hedefSoc - 20 < 60);
  assert.equal(sarjDurumu({ durak: d1, soc: d1.hedefSoc, gucKw: -30, sarjDkFn: () => 5 }).tamam, true);
});

test('ön ısıtma enerjisi canlı varış tahminine dahil: plan değeriyle örtüşür', () => {
  const p2 = { ...plan, duraklar: plan.duraklar.map((d, i) => (i ? d : { ...d, varisSoc: d.varisSoc - 3, onIsitma: { baslaKm: d.km - 40, dk: 20, kwh: 3 * k.kap / 100 } })) };
  const d1 = p2.duraklar[0], km = 10;
  const r = canliDurum({ plan: p2, k, km, soc: planSoc(plan.profil, km) });
  assert.ok(Math.abs(r.hedefVarisSoc - d1.varisSoc) < 0.6, `${r.hedefVarisSoc} / ${d1.varisSoc}`);
  const yari = canliDurum({ plan: p2, k, km: d1.km - 20, soc: 50 }), yok = canliDurum({ plan, k, km: d1.km - 20, soc: 50 });
  assert.ok(Math.abs((yok.hedefVarisSoc - yari.hedefVarisSoc) - 1.5) < 0.1);
});
