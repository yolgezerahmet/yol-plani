// EPDK lisans portalının "Şarj İstasyonları" raporunu (Raporla düğmesi) içe aktarır.
// Rapor resmî ve eksiksizdir: lisanslı her istasyon, işletmecisi, soket tipi ve gücü.
// TEK EKSİĞİ KOORDİNAT. Bu yüzden konum iki yoldan gelir:
//   1) Open Charge Map kaydıyla eşleştirme (kesin konum),
//   2) adresteki mahalleden merkez nokta (yaklaşık, ±1-2 km; açıkça işaretlenir).
//
// Rapor biçimi: istasyon satırı + altında soket satırları.
//   [Sıra No, İstasyon No, İstasyon Adı, Hizmet Şekli, Marka, Şarj Ağı İşletmecisi,
//    Şarj İstasyonu İşletmecisi, Yeşil mi, Adres, Soket No, Soket Tipi, Soket Türü, Güç kW]

export const SOKET_TURU = { DC_CCS: 'ccs2', DC_CHADEMO: 'chademo', AC_TYPE2: 'tip2' };
export const HASSASIYET = { kesin: 'kesin', mahalle: 'mahalle', yok: 'yok' };

const metin = x => String(x ?? '').trim();
const sayi = x => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// Ham satır dizisini (başlık satırı dahil) istasyon nesnelerine çevirir.
export function satirlariCoz(satirlar) {
  const ist = [];
  let cur = null;
  for (const s of satirlar) {
    const no = metin(s[1]);
    if (no && /^ŞRJ|^SRJ/i.test(no)) {
      cur = {
        no, ad: metin(s[2]), hizmet: metin(s[3]), marka: metin(s[4]),
        agIsletmecisi: metin(s[5]), isletmeci: metin(s[6]),
        yesil: /evet|^E$/i.test(metin(s[7])),
        adres: metin(s[8]).replace(/\s+/g, ' '),
        soketler: [],
      };
      ist.push(cur);
    } else if (cur && /^SKT/i.test(metin(s[9]))) {
      cur.soketler.push({
        no: metin(s[9]), akim: metin(s[10]),
        tur: SOKET_TURU[metin(s[11])] || metin(s[11]).toLowerCase(),
        kw: sayi(s[12]),
      });
    }
  }
  return ist.map(ozet);
}

// İstasyona özet alanlar ekler: en yüksek DC gücü, soket sayıları, halka açık mı.
export function ozet(i) {
  const dc = i.soketler.filter(s => s.akim === 'DC');
  const ccs = dc.filter(s => s.tur === 'ccs2');
  return {
    ...i,
    dcKw: ccs.length ? Math.max(...ccs.map(s => s.kw)) : 0,
    ccsSoket: ccs.length,
    acSoket: i.soketler.filter(s => s.akim === 'AC').length,
    halkaAcik: i.hizmet === 'HALKA_ACIK',
    ...adresCozumle(i.adres),
  };
}

// "Ümit Mahallesi 2479 Sokağı No:2 Çankaya / ANKARA" → {mahalle, ilce, il}
export function adresCozumle(adres) {
  const a = metin(adres);
  const il = (a.split('/').pop() || '').trim();
  const govde = a.slice(0, a.lastIndexOf('/') < 0 ? a.length : a.lastIndexOf('/'));
  const mahalle = (govde.match(/^(.*?Mahallesi)/i) || [])[1]?.trim() || '';
  // İlçe, adresin sonundaki son kelime öbeği (mahalle/sokak/kapı numarasından sonra).
  const kalan = govde.replace(mahalle, '').replace(/No\s*:\s*\S+/i, '').trim();
  const parcalar = kalan.split(/\s+/).filter(Boolean);
  const ilce = parcalar.length ? parcalar[parcalar.length - 1] : '';
  return { il, ilce: /sokağı|caddesi|bulvarı|\d/i.test(ilce) ? '' : ilce, mahalle };
}

// Nominatim için sorgu metni: sokak düzeyi Türkiye'de tutmuyor, mahalle düzeyi tutuyor.
export const mahalleSorgusu = i => [i.mahalle, i.ilce, i.il].filter(Boolean).join(', ');

const normal = s => metin(s).toLocaleLowerCase('tr')
  .replace(/[çğıöşü]/g, c => ({ 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' }[c]))
  .replace(/[^a-z0-9]/g, '');

// EPDK kaydını OCM kaydıyla eşleştirir: aynı marka/işletmeci + yakın güç + aynı ilçe.
// Amaç istasyonu doğrulamak değil, KOORDİNATINI ödünç almak.
export function eslestir(epdk, ocmListesi, { gucTolerans = 0.35 } = {}) {
  const hedefMarka = normal(epdk.marka), hedefIlce = normal(epdk.ilce);
  let enIyi = null, enIyiPuan = 0;
  for (const o of ocmListesi) {
    const ad = normal(o.ad), il = normal(o.il);
    let puan = 0;
    if (hedefMarka && (ad.includes(hedefMarka) || hedefMarka.includes(ad.slice(0, 6)))) puan += 0.5;
    if (hedefIlce && il && (il.includes(hedefIlce) || hedefIlce.includes(il))) puan += 0.3;
    if (epdk.dcKw && o.kw && Math.abs(epdk.dcKw - o.kw) / Math.max(epdk.dcKw, o.kw) <= gucTolerans) puan += 0.3;
    if (epdk.mahalle && ad.includes(normal(epdk.mahalle.replace(/mahallesi/i, '')))) puan += 0.4;
    if (puan > enIyiPuan) { enIyiPuan = puan; enIyi = o; }
  }
  return enIyiPuan >= 0.8 ? { ...enIyi, puan: +enIyiPuan.toFixed(2) } : null;
}

// EPDK listesini konumlandırır. ocmListesi ve mahalleKonumlari dışarıdan verilir;
// mahalleKonumlari: { "Ümit Mahallesi, Çankaya, ANKARA": [enlem, boylam] }
export function konumlandir(epdkListesi, { ocmListesi = [], mahalleKonumlari = {} } = {}) {
  return epdkListesi.map(i => {
    const es = ocmListesi.length ? eslestir(i, ocmListesi) : null;
    if (es) return { ...i, enlem: es.enlem, boylam: es.boylam, konum: HASSASIYET.kesin, ocmId: es.id };
    const m = mahalleKonumlari[mahalleSorgusu(i)];
    if (m) return { ...i, enlem: m[0], boylam: m[1], konum: HASSASIYET.mahalle };
    return { ...i, enlem: null, boylam: null, konum: HASSASIYET.yok };
  });
}

// İstasyon katmanının beklediği biçime çevirir (bkz. istasyon.js).
// guven: EPDK kaydı lisanslı ve resmî olduğu için yüksek; konum yaklaşıksa düşürülür.
export function istasyonBicimine(i) {
  return {
    id: 'epdk:' + i.no,
    ad: i.ad, enlem: i.enlem, boylam: i.boylam, il: i.ilce || i.il,
    kw: i.dcKw, soketSayisi: i.ccsSoket,
    operatorId: null, operator: i.agIsletmecisi, marka: i.marka,
    yesil: i.yesil, halkaAcik: i.halkaAcik,
    kaynak: 'epdk', konum: i.konum,
    guven: i.konum === HASSASIYET.kesin ? 1 : i.konum === HASSASIYET.mahalle ? 0.7 : 0.4,
  };
}

// İki kaynağı birleştirir: EPDK varlığı ve soketi, OCM kesin konumu verir.
// Aynı istasyon iki kez listelenmesin diye eşleşenler tekilleştirilir.
export function birlestir(epdkKonumlu, ocmListesi) {
  const eslesen = new Set(epdkKonumlu.map(i => i.ocmId).filter(Boolean));
  return [
    ...epdkKonumlu.filter(i => i.enlem != null).map(istasyonBicimine),
    ...ocmListesi.filter(o => !eslesen.has(o.id)).map(o => ({ ...o, kaynak: 'ocm', konum: HASSASIYET.kesin })),
  ];
}
