// Şarj istasyonu katmanı. Open Charge Map'ten rota koridorundaki istasyonları alır,
// veriyi normalleştirir, güvenilirliğini puanlar ve her durak için YEDEK zinciri kurar.
//
// Neden yedek: istasyonun bozuk çıkması nadir değil. Havacılıkta varış alanına inilemezse
// gidilecek bir yedek meydan zorunludur; burada da her durağın ulaşılabilir bir alternatifi olmalı.
//
// Anahtar koda gömülmez: çağıran verir (uygulama ayarlarında saklanır).

export const OCM = 'https://api.openchargemap.io/v3/poi';

// E-GMP: CCS2 (DC) ve Type 2 (AC). OCM bağlantı tipi kimlikleri.
export const SOKET = { ccs2: 33, tip2: 25, tip2Kablo: 1036, chademo: 2 };
export const UYUMLU_DC = [SOKET.ccs2];

export const GUVEN = {
  tazeAy: 6,        // bu kadar yeni kayıt tam güvenilir
  eskiAy: 24,       // bundan eski kayıt düşük güvenli
};

export function istekUrl(enlem, boylam, { yaricapKm = 25, minKw = 50, adet = 100 } = {}) {
  return `${OCM}?output=json&latitude=${enlem}&longitude=${boylam}&distance=${yaricapKm}`
       + `&distanceunit=KM&maxresults=${adet}&compact=true&verbose=false&minpowerkw=${minKw}`;
}

// Kayıt yaşından güven puanı (0-1). Eski kayıt yanlış olabilir; kullanıcıya bunu söylemek zorundayız.
export function guvenPuani(guncellemeIso, simdi = Date.now()) {
  if (!guncellemeIso) return 0.3;
  const ay = (simdi - Date.parse(guncellemeIso)) / (30 * 24 * 3600 * 1000);
  if (!Number.isFinite(ay)) return 0.3;
  if (ay <= GUVEN.tazeAy) return 1;
  if (ay >= GUVEN.eskiAy) return 0.35;
  return 1 - 0.65 * (ay - GUVEN.tazeAy) / (GUVEN.eskiAy - GUVEN.tazeAy);
}

// OCM kaydını sade biçime çevirir. Uyumsuz soketli istasyonlar elenir.
export function normalize(poi, { uyumlu = UYUMLU_DC, simdi = Date.now() } = {}) {
  const a = poi.AddressInfo || {};
  const baglanti = (poi.Connections || []).filter(c => !uyumlu.length || uyumlu.includes(c.ConnectionTypeID));
  if (!baglanti.length) return null;
  const kw = Math.max(...baglanti.map(c => Number(c.PowerKW) || 0));
  if (!kw) return null;
  return {
    id: poi.ID,
    ad: a.Title || 'Adsız istasyon',
    enlem: a.Latitude, boylam: a.Longitude,
    il: a.Town || a.StateOrProvince || '',
    kw,
    soketSayisi: baglanti.reduce((t, c) => t + (Number(c.Quantity) || 1), 0),
    operatorId: poi.OperatorID ?? null,
    guncelleme: poi.DateLastStatusUpdate || null,
    guven: +guvenPuani(poi.DateLastStatusUpdate, simdi).toFixed(2),
  };
}

const R = 6371, d2r = Math.PI / 180;
export function mesafeKm(a, b) {
  const dLat = (b[0] - a[0]) * d2r, dLon = (b[1] - a[1]) * d2r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * d2r) * Math.cos(b[0] * d2r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// İstasyonu rotaya izdüşürür: rotanın kaçıncı km'sine denk geliyor ve ne kadar sapma gerekiyor.
// Köşe noktalarına değil, PARÇAYA izdüşüm alınır; seyrek köşeli rotada köşe mesafesi
// sapmayı onlarca km abartır. Eş dikdörtgen yaklaşımı bu ölçekte yeterli.
export function rotayaIzdusur(istasyon, sekil) {
  const lat0 = istasyon.enlem * d2r;
  const xy = ([la, lo]) => [lo * d2r * Math.cos(lat0) * R, la * d2r * R];
  const p = xy([istasyon.enlem, istasyon.boylam]);
  let km = 0, enIyi = { rotaKm: 0, sapmaKm: Infinity };
  for (let i = 1; i < sekil.length; i++) {
    const a = xy(sekil[i - 1]), b = xy(sekil[i]);
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const uzunluk2 = vx * vx + vy * vy;
    const t = uzunluk2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / uzunluk2));
    const dx = p[0] - (a[0] + vx * t), dy = p[1] - (a[1] + vy * t);
    const d = Math.hypot(dx, dy);
    const adim = mesafeKm(sekil[i - 1], sekil[i]);
    if (d < enIyi.sapmaKm) enIyi = { rotaKm: +(km + adim * t).toFixed(1), sapmaKm: +d.toFixed(1) };
    km += adim;
  }
  return enIyi;
}

// Rota üstündeki istasyonları sıralar; sapma sınırının dışındakiler elenir.
export function rotaUstunde(istasyonlar, sekil, enFazlaSapmaKm = 5) {
  return istasyonlar
    .map(i => ({ ...i, ...rotayaIzdusur(i, sekil) }))
    .filter(i => i.sapmaKm <= enFazlaSapmaKm)
    .sort((a, b) => a.rotaKm - b.rotaKm);
}

// Bir noktadan, elde kalan enerjiyle ulaşılabilecek istasyonlar.
// sapma iki yönlü sayılır: istasyona gidip rotaya dönmek gerekir.
export function ulasilabilir(istasyonlar, basKm, kalanKwh, whKm, rezervKwh = 0) {
  const menzilKm = (kalanKwh - rezervKwh) * 1000 / Math.max(80, whKm);
  return istasyonlar
    .filter(i => i.rotaKm >= basKm && (i.rotaKm - basKm) + 2 * i.sapmaKm <= menzilKm)
    .map(i => ({ ...i, gerekenKm: +((i.rotaKm - basKm) + 2 * i.sapmaKm).toFixed(1),
                 kalanMenzilKm: +(menzilKm - (i.rotaKm - basKm) - 2 * i.sapmaKm).toFixed(1) }));
}

// Her planlanan durak için yedek zinciri.
// duraklar: [{ km, kalanKwh }] — durağa VARIŞTAKİ kalan enerji.
// Yedek, bir önceki duraktan (ya da çıkıştan) ulaşılabilen, asıl duraktan farklı istasyondur.
export function yedekZinciri(duraklar, istasyonlar, whKm, { enFazla = 3, rezervKwh = 2 } = {}) {
  return duraklar.map((d, i) => {
    const oncekiKm = i === 0 ? 0 : duraklar[i - 1].km;
    const oncekiKwh = i === 0 ? d.kalanKwh + (d.km - oncekiKm) * whKm / 1000 : duraklar[i - 1].sonrakiKwh ?? d.kalanKwh;
    const aday = ulasilabilir(istasyonlar, oncekiKm, oncekiKwh, whKm, rezervKwh)
      .filter(s => Math.abs(s.rotaKm - d.km) > 1)
      .sort((a, b) => (b.kw * b.guven) - (a.kw * a.guven) || a.sapmaKm - b.sapmaKm)
      .slice(0, enFazla);
    return {
      ...d,
      yedekler: aday,
      yedekVar: aday.length > 0,
      // Veri güveni düşükse kullanıcıya söylenmeli: liste boş olabilir ama istasyon var olabilir.
      veriGuveni: aday.length ? +(aday.reduce((t, a) => t + a.guven, 0) / aday.length).toFixed(2) : 0,
    };
  });
}

// Ağ katmanı; anahtar çağırandan gelir, depoda saklanmaz.
export async function istasyonGetir(noktalar, anahtar, getir = fetch, opt = {}) {
  if (!anahtar) throw new Error('Open Charge Map anahtarı gerekli');
  const hepsi = new Map();
  for (const n of noktalar) {
    const yanit = await getir(istekUrl(n.enlem, n.boylam, opt), { headers: { 'X-API-Key': anahtar } });
    if (!yanit.ok) throw new Error('İstasyon servisi yanıt vermedi: ' + yanit.status);
    for (const poi of await yanit.json()) {
      const i = normalize(poi, opt);
      if (i) hepsi.set(i.id, i);
    }
  }
  return [...hepsi.values()];
}
