import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorBul, durakFiyati, yolculukMaliyeti, evSarjiEtkisi, asimAyi, BILINMEYEN_DC } from '../www/core/maliyet.js';

test('EPDK lisans adından operatör bulunur (Türkçe büyük harf)', () => {
  assert.equal(operatorBul('ZES DİJİTAL TİCARET ANONİM ŞİRKETİ').ad, 'ZES');
  assert.equal(operatorBul('Eşarj Elektrikli Araçlar Şarj Sistemleri A.Ş.').ad, 'Eşarj');
  assert.equal(operatorBul('TRUGO AKILLI ŞARJ ÇÖZÜMLERİ').ad, 'Trugo');
  assert.equal(operatorBul('BİLİNMEYEN ENERJİ A.Ş.'), null);
});

test('fiyat önceliği: kullanıcı > tablo (HPC) > tahmin', () => {
  const zes = { operator: 'ZES DİJİTAL', kw: 180 }, zesHpc = { operator: 'ZES DİJİTAL', kw: 300 };
  assert.equal(durakFiyati(zes).tl, 12.99);
  assert.equal(durakFiyati(zesHpc).tl, 16.49);
  assert.deepEqual(durakFiyati(zes, { ZES: 11 }).kaynak, 'senin');
  const b = durakFiyati({ operator: 'X ENERJİ', kw: 60 });
  assert.equal(b.tl, BILINMEYEN_DC); assert.equal(b.kaynak, 'tahmin');
});

test('yolculuk maliyeti: şarj kaybı faturaya eklenir, ücretli km toplanır', () => {
  const plan = { toplamKm: 500, duraklar: [
    { no: 1, ekKwh: 30, istasyon: { operator: 'ZES DİJİTAL', kw: 180 } },
    { no: 2, ekKwh: 20, istasyon: { operator: 'X', kw: 60 } }] };
  const m = yolculukMaliyeti(plan, { bolumler: [{ ucretliKm: 100 }, { ucretliKm: 20.5 }], evTl: 3, baslangicKwh: 45 });
  assert.equal(m.duraklar[0].faturaKwh, 31.6);
  assert.equal(m.duraklar[0].tutar, Math.round(30 / 0.95 * 12.99));
  assert.equal(m.evTutar, Math.round(45 / 0.9 * 3));
  assert.equal(m.toplamTl, m.sarjTl + m.evTutar);
  assert.equal(m.ucretliKm, 120.5);
  assert.equal(m.tahminVar, true);
});

test('ev şarjı 4.000 kWh sınırını aşar mı', () => {
  const r = evSarjiEtkisi({ evYillikKwh: 2400, aracYillikKm: 15000, whKm: 180 });
  assert.equal(r.aracKwh, Math.round(15000 * 0.18 * 0.8 / 0.9));
  assert.equal(r.asar, true);
  assert.ok(r.sinirKm > 9000 && r.sinirKm < 11000, String(r.sinirKm));
  assert.equal(evSarjiEtkisi({ evYillikKwh: 1500, aracYillikKm: 8000 }).asar, false);
});

test('aşım ayı ve uygulama başlangıcı (üçüncü ayın başı)', () => {
  const r = asimAyi({ buYilKwh: 2800, ay: 6, aylikKwh: 400 });
  assert.equal(r.ay, 9); assert.equal(r.uygulama, 12);
  assert.equal(asimAyi({ buYilKwh: 100, ay: 11, aylikKwh: 100 }), null);
  assert.equal(asimAyi({ buYilKwh: 4100, ay: 5, aylikKwh: 300 }).zaten, true);
});
