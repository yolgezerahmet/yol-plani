import test from 'node:test';
import assert from 'node:assert/strict';
import { satirlariCoz, adresCozumle, mahalleSorgusu, eslestir, konumlandir,
         istasyonBicimine, birlestir, HASSASIYET } from '../www/core/epdk.js';

const BASLIK = ['Sıra No','İstasyon No','İstasyon Adı','Hizmet Şekli','Marka','Şarj Ağı İşletmecisi',
                'Şarj İstasyonu İşletmecisi','Yeşil Şarj İstasyonu mu','Adres','Soket Bilgileri','','',''];
const ORNEK = [
  BASLIK,
  [1,'ŞRJ/2487','ASTOR ÜMİT','HALKA_ACIK','ASTOR','ASTOR ENERJİ A.Ş.','ASTOR',' ',
   'Ümit Mahallesi 2479 Sokağı  No:2 Çankaya / ANKARA','Soket No','Soket Tipi','Soket Türü','Soket Gücü (kW)'],
  ['','','','','','','','','','SKT/1','DC','DC_CCS',160],
  ['','','','','','','','','','SKT/2','DC','DC_CCS',160],
  ['','','','','','','','','','SKT/3','AC','AC_TYPE2',22],
  [2,'ŞRJ/9999','Özel Tesis','OZEL','zes','ZES DİJİTAL','ZES','Evet',
   'İnönü Mahallesi Yenimahalle / ANKARA','Soket No','Soket Tipi','Soket Türü','Soket Gücü (kW)'],
  ['','','','','','','','','','SKT/4','AC','AC_TYPE2',11],
];

test('rapor satırları istasyon ve soketlerine ayrılır', () => {
  const i = satirlariCoz(ORNEK);
  assert.equal(i.length, 2);
  assert.equal(i[0].soketler.length, 3);
  assert.equal(i[0].dcKw, 160);
  assert.equal(i[0].ccsSoket, 2);
  assert.equal(i[0].acSoket, 1);
  assert.equal(i[0].halkaAcik, true);
  assert.equal(i[1].dcKw, 0, 'yalnızca AC olan istasyonun DC gücü sıfır');
  assert.equal(i[1].halkaAcik, false);
  assert.equal(i[1].yesil, true);
});

test('adres mahalle, ilçe ve ile ayrışır', () => {
  const a = adresCozumle('Ümit Mahallesi 2479 Sokağı  No:2 Çankaya / ANKARA');
  assert.equal(a.mahalle, 'Ümit Mahallesi');
  assert.equal(a.ilce, 'Çankaya');
  assert.equal(a.il, 'ANKARA');
});

test('sokak bilgisi ilçe sanılmaz', () => {
  const a = adresCozumle('Ostim Mahallesi Yenimahalle / ANKARA');
  assert.equal(a.ilce, 'Yenimahalle');
  assert.equal(mahalleSorgusu({ ...a }), 'Ostim Mahallesi, Yenimahalle, ANKARA');
});

test('marka, ilçe ve güç uyuşunca OCM kaydı eşleşir', () => {
  const epdk = satirlariCoz(ORNEK)[0];
  const ocm = [
    { id: 7, ad: 'Astor Ümit Çankaya DC', il: 'Çankaya', kw: 150, enlem: 39.89, boylam: 32.69 },
    { id: 8, ad: 'Başka Operatör', il: 'Keçiören', kw: 60, enlem: 39.99, boylam: 32.85 },
  ];
  const e = eslestir(epdk, ocm);
  assert.equal(e.id, 7);
  assert.ok(e.puan >= 0.8);
});

test('zayıf benzerlik eşleşme sayılmaz', () => {
  const epdk = satirlariCoz(ORNEK)[0];
  assert.equal(eslestir(epdk, [{ id: 9, ad: 'Alakasız', il: 'Sincan', kw: 22 }]), null);
});

test('konum önce OCM, sonra mahalle, yoksa boş', () => {
  const liste = satirlariCoz(ORNEK);
  const k = konumlandir(liste, {
    ocmListesi: [{ id: 7, ad: 'Astor Ümit DC', il: 'Çankaya', kw: 160, enlem: 39.89, boylam: 32.69 }],
    mahalleKonumlari: { 'İnönü Mahallesi, Yenimahalle, ANKARA': [39.95, 32.72] },
  });
  assert.equal(k[0].konum, HASSASIYET.kesin);
  assert.equal(k[0].enlem, 39.89);
  assert.equal(k[1].konum, HASSASIYET.mahalle);
  assert.equal(k[1].enlem, 39.95);
  assert.equal(konumlandir(liste)[0].konum, HASSASIYET.yok);
});

test('güven konum hassasiyetine bağlı', () => {
  const [a, b] = konumlandir(satirlariCoz(ORNEK), {
    ocmListesi: [{ id: 7, ad: 'Astor Ümit DC', il: 'Çankaya', kw: 160, enlem: 39.89, boylam: 32.69 }],
    mahalleKonumlari: { 'İnönü Mahallesi, Yenimahalle, ANKARA': [39.95, 32.72] },
  }).map(istasyonBicimine);
  assert.equal(a.guven, 1);
  assert.equal(b.guven, 0.7);
  assert.equal(a.id, 'epdk:ŞRJ/2487');
  assert.equal(a.kaynak, 'epdk');
});

test('birleştirmede eşleşen OCM kaydı iki kez görünmez', () => {
  const ocm = [
    { id: 7, ad: 'Astor Ümit DC', il: 'Çankaya', kw: 160, enlem: 39.89, boylam: 32.69 },
    { id: 8, ad: 'EPDK listesinde olmayan', il: 'Mamak', kw: 180, enlem: 39.9, boylam: 32.9 },
  ];
  const k = konumlandir(satirlariCoz(ORNEK), { ocmListesi: ocm });
  const hepsi = birlestir(k, ocm);
  assert.equal(hepsi.length, 2, 'eşleşen tekilleşti, eşleşmeyen OCM kaydı korundu');
  assert.deepEqual(hepsi.map(x => x.kaynak).sort(), ['epdk', 'ocm']);
});
