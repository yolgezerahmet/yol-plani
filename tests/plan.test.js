import test from 'node:test';
import assert from 'node:assert/strict';
import { VARSAYILAN } from '../www/core/model.js';
import { aracUygula } from '../www/core/arac.js';
import { enerjiEgrisi, kwhKmde, aralikKwh, durakPlanla, bolumKosulu } from '../www/core/plan.js';

const K = aracUygula({ ...VARSAYILAN, soc0: 90, rezerv: 12 }, 'i5-63-rwd');
const duz = (km, n) => Array.from({ length: n }, (_, i) => ({ tip: 'otoyol', km, dh: 0, hiz: 110, basKm: i * km }));
const ist = (rotaKm, kw = 150, extra = {}) => ({ id: 'i' + rotaKm, ad: 'S' + rotaKm, rotaKm, sapmaKm: 0.5, kw, guven: 1, ...extra });

test('enerji eğrisi bölüm toplamına eşit ve km içinde doğrusal', () => {
  const e = enerjiEgrisi(duz(100, 3), K);
  assert.equal(e.toplamKm, 300);
  assert.ok(Math.abs(kwhKmde(e, 150) - e.toplamKwh / 2) < 0.01);
  assert.ok(Math.abs(aralikKwh(e, 100, 200) - e.kwh[2] + e.kwh[1]) < 1e-9);
  assert.equal(kwhKmde(e, -5), 0);
  assert.equal(kwhKmde(e, 999), e.toplamKwh);
});

test('bölüm havası genel koşulun üstüne yazılır', () => {
  const kb = bolumKosulu(K, { T: -5, yagis: 2.1 });
  assert.equal(kb.T, -5);
  assert.equal(kb.yagis, true);
  assert.equal(bolumKosulu(K, {}).T, K.T);
  const sicak = enerjiEgrisi([{ tip: 'otoyol', km: 100, dh: 0, hiz: 110 }], K).toplamKwh;
  const soguk = enerjiEgrisi([{ tip: 'otoyol', km: 100, dh: 0, hiz: 110, T: -10 }], K).toplamKwh;
  assert.ok(soguk > sicak * 1.15, 'soğuk bölüm belirgin şekilde pahalı');
});

test('kısa yolculukta durak yok', () => {
  const p = durakPlanla(duz(50, 2), [ist(50)], K);
  assert.equal(p.duraklar.length, 0);
  assert.ok(p.varisSoc > 60);
  assert.equal(p.sorun, null);
});

test('uzun yolculukta durak planlanır ve varış rezervin üstünde', () => {
  const istasyonlar = [80, 160, 240, 320, 400, 480].map(x => ist(x));
  const p = durakPlanla(duz(100, 6), istasyonlar, K);
  assert.ok(p.duraklar.length >= 1);
  assert.ok(p.varisSoc >= K.rezerv - 0.5, `varış ${p.varisSoc}`);
  for (const d of p.duraklar) {
    assert.ok(d.varisSoc >= K.rezerv, 'her durağa rezervin üstünde varılır');
    assert.ok(d.hedefSoc <= 90, 'şarj %90 üstüne çıkmaz');
    assert.ok(d.dk > 0);
  }
  assert.ok(Math.abs(p.toplamDk - (p.surusDk + p.sarjDk + p.sapmaDk)) <= 1);
});

test('son durakta yalnızca gerektiği kadar şarj edilir', () => {
  const p = durakPlanla(duz(100, 4), [ist(200), ist(250)], K);
  const son = p.duraklar[p.duraklar.length - 1];
  assert.ok(son.hedefSoc < 80, `son durak hedefi ${son.hedefSoc}`);
  assert.ok(Math.abs(p.varisSoc - (K.rezerv + 3)) < 3, 'varış rezerv + pay civarı');
});

test('ileri bölgede güçlü istasyon yavaş olana tercih edilir', () => {
  const p = durakPlanla(duz(100, 4), [ist(230, 60), ist(240, 180)], K);
  assert.equal(p.duraklar[0].istasyon.kw, 180);
});

test('düşük güvenli istasyon puanı düşer', () => {
  const p = durakPlanla(duz(100, 4), [ist(230, 180, { guven: 0.35 }), ist(240, 120)], K);
  assert.equal(p.duraklar[0].istasyon.kw, 120, '180×0,35 < 120×1');
});

test('ulaşılamayan boşlukta sorun bildirilir', () => {
  const p = durakPlanla(duz(100, 8), [ist(700)], K);
  assert.equal(p.sorun.tur, 'menzil');
  assert.match(p.sorun.mesaj, /km/);
});

test('50 kW altı istasyon dikkate alınmaz', () => {
  const p = durakPlanla(duz(100, 4), [ist(220, 22)], K);
  assert.equal(p.sorun?.tur, 'menzil');
});

test('yavaş sürüş durak süresini kısaltır', () => {
  const istasyonlar = [100, 200, 300, 400, 500].map(x => ist(x));
  const hizli = durakPlanla(duz(100, 6), istasyonlar, K, { hizKat: 1.1 });
  const yavas = durakPlanla(duz(100, 6), istasyonlar, K, { hizKat: 0.85 });
  assert.ok(yavas.toplamKwh < hizli.toplamKwh);
  assert.ok(yavas.sarjDk < hizli.sarjDk);
  assert.ok(yavas.surusDk > hizli.surusDk);
});

test('batarya profili durakta sıçrar ve monoton düşer', () => {
  const p = durakPlanla(duz(100, 5), [100, 200, 300, 400].map(x => ist(x)), K);
  const prof = p.profil;
  assert.equal(prof[0][1], K.soc0);
  const sicramalar = prof.filter((n, i) => i && n[0] === prof[i - 1][0] && n[1] > prof[i - 1][1]);
  assert.equal(sicramalar.length, p.duraklar.length);
  assert.ok(Math.abs(prof[prof.length - 1][1] - p.varisSoc) < 1.5);
});

test('her durak için yedek arandı', () => {
  const p = durakPlanla(duz(100, 5), [90, 150, 200, 260, 300, 380].map(x => ist(x)), K);
  assert.ok(p.duraklar.every(d => Array.isArray(d.yedekler)));
});

test('küçük açık için ikinci durak yerine %80 üstü şarj edilir', () => {
  // Tek duraklık menzil sınırında: %80 yetmiyor, %90 yetiyor.
  const e = durakPlanla(duz(100, 5), [ist(200), ist(300), ist(400)], K);
  const sayi = e.duraklar.length;
  const zorla80 = durakPlanla(duz(100, 5), [ist(200), ist(300), ist(400)], K, { atlamaUst: 80 });
  assert.ok(sayi <= zorla80.duraklar.length);
  assert.ok(e.duraklar.every(d => d.hedefSoc <= 90));
});

test('yedekler asıl durağın yakınından seçilir, yol başından değil', () => {
  const p = durakPlanla(duz(100, 5), [5, 10, 150, 190, 200, 210, 300, 380].map(x => ist(x)), K);
  const d = p.duraklar[0];
  assert.ok(d.yedekler.length > 0);
  assert.ok(d.yedekler.every(y => y.rotaKm >= d.km / 2), 'ilk 10 km yedek sayılmaz');
});

test('soğuk havada ön ısıtma durak süresini kısaltır', () => {
  const soguk = duz(100, 5).map(b => ({ ...b, T: 0 }));
  const istasyonlar = [100, 200, 300, 400].map(x => ist(x, 350));
  const acik = durakPlanla(soguk, istasyonlar, K, { bataryaT0: 2 });
  const kapali = durakPlanla(soguk, istasyonlar, K, { bataryaT0: 2, onIsitma: false });
  assert.ok(acik.sarjDk < kapali.sarjDk, `açık ${acik.sarjDk}, kapalı ${kapali.sarjDk}`);
  const d = acik.duraklar[0];
  assert.ok(d.onIsitma && d.onIsitma.dk > 0 && d.onIsitma.baslaKm < d.km);
  assert.ok(d.bataryaT > d.bataryaTVaris);
  assert.ok(acik.termal.onIsitmaKazanciDk >= 3);
});

test('ılık havada ön ısıtma gerekmez', () => {
  const ilik = duz(100, 5).map(b => ({ ...b, T: 28 }));
  const p = durakPlanla(ilik, [100, 200, 300, 400].map(x => ist(x, 350)), K, { bataryaT0: 28 });
  assert.ok(p.duraklar.every(d => !d.onIsitma));
  assert.equal(p.termal.onIsitmaKazanciDk, 0);
});

test('OBD tüketim katsayısı enerjiyi ölçekler', () => {
  const a = enerjiEgrisi(duz(100, 2), K).toplamKwh, b = enerjiEgrisi(duz(100, 2), { ...K, tuketimKat: 1.1 }).toplamKwh;
  assert.ok(Math.abs(b / a - 1.1) < 1e-9);
});
