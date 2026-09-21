// Ön plan servisiyle JS arasında tek nokta. Yerel servis yoksa (tarayıcı, eski APK) her şey
// tarayıcı karşılıklarına düşer; çağıran kod iki durumu ayırt etmek zorunda kalmaz.
//
// Servisi birden fazla şey kullanabilir (yolda modu, OBD kaydı); herkes bıraktığında durur.
const P = () => (window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.YolServisi : null) || null;

const kullananlar = new Set();
const tikler = new Set(), konumlar = new Set(), eylemler = new Set(), hatalar = new Set();
let dinliyor = false, sonYerelKonum = 0;

export const servisVar = () => !!P();
export const servisAktif = () => kullananlar.size > 0 && !!P();

async function dinle() {
  if (dinliyor) return;
  const p = P(); if (!p) return;
  dinliyor = true;
  await p.addListener('tik', () => tikler.forEach(f => f()));
  await p.addListener('konum', k => { sonYerelKonum = Date.now(); konumlar.forEach(f => f(k)); });
  await p.addListener('eylem', e => eylemler.forEach(f => f(e.ad)));
  await p.addListener('hata', e => hatalar.forEach(f => f(e.hata)));
}

export async function servisAl(kim, { baslik = 'Yol Planı', metin = 'Yolculuk izleniyor' } = {}) {
  const p = P(); if (!p) return false;
  await dinle();
  try { await p.baslat({ baslik, metin }); } catch (e) { hatalar.forEach(f => f(e.message)); return false; }
  kullananlar.add(kim);
  return true;
}

export async function servisBirak(kim) {
  kullananlar.delete(kim);
  if (!kullananlar.size) { try { await P()?.durdur(); } catch {} }
}

export function servisGuncelle({ baslik, metin, gitUrl = null, gitAd = 'Yönlendir' }) {
  if (servisAktif()) P().guncelle({ baslik, metin, gitUrl, gitAd }).catch(() => {});
}

// Ses: servis varsa Android metin okuması (navigasyon sesini kısarak); yoksa false döner.
export function servisSoyle(metin) {
  if (!servisAktif()) return false;
  P().soyle({ metin }).catch(() => {});
  return true;
}

// Periyodik iş: tarayıcı zamanlayıcısı + yerel tik. Arka planda tarayıcı zamanlayıcısı kısılır,
// yerel tik sürer; önde ikisi birden gelir, yakın aralıklı çağrılar atlanır.
export function periyodik(ms, fn) {
  let son = 0;
  const calis = () => { const t = Date.now(); if (t - son < ms * 0.8) return; son = t; fn(); };
  const id = setInterval(calis, ms);
  tikler.add(calis);
  calis();
  return () => { clearInterval(id); tikler.delete(calis); };
}

// Konum: yerel servis konumu (arka planda da gelir) + tarayıcı konumu. Yerel son 10 sn içinde
// geldiyse tarayıcınınki yok sayılır; aynı yolun iki kez sayılmaması için.
export function konumDinle(cb, hata = () => {}) {
  const yerel = k => cb({ enlem: k.enlem, boylam: k.boylam, dogruluk: k.dogruluk });
  konumlar.add(yerel);
  let id = null;
  if (navigator.geolocation) {
    id = navigator.geolocation.watchPosition(p => {
      if (Date.now() - sonYerelKonum < 10000) return;
      cb({ enlem: p.coords.latitude, boylam: p.coords.longitude, dogruluk: p.coords.accuracy });
    }, hata, { enableHighAccuracy: true, maximumAge: 4000 });
  } else if (!P()) hata();
  return () => { konumlar.delete(yerel); if (id != null) navigator.geolocation.clearWatch(id); };
}

export function eylemDinle(cb) { eylemler.add(cb); return () => eylemler.delete(cb); }
export function hataDinle(cb) { hatalar.add(cb); return () => hatalar.delete(cb); }
