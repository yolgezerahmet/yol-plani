// Navigasyonu devretme: plan hazır olunca yolculuk başka bir navigasyon uygulamasında sürer.
// Yol Planı adım adım yönlendirme yapmaz; şarj duraklarını ara nokta olarak verir.
//
// Google Haritalar: https://www.google.com/maps/dir/?api=1 biçimi Android'de uygulamayı açar,
// ara noktaları (waypoints) taşır. Belgelenen sınır mobil tarayıcıda 3, uygulamada 9 ara nokta;
// fazlası kırpılır ve kullanıcıya söylenir.
// Waze tek hedef kabul eder: yalnızca sıradaki durak için kullanılır.

export const GOOGLE_ARA_NOKTA_SINIRI = 9;

const nokta = p => `${(+p.lat).toFixed(5)},${(+p.lon).toFixed(5)}`;

// duraklar: [{ istasyon: { enlem, boylam } }] — plan.duraklar
export function googleRota(bas, son, duraklar = [], { sinir = GOOGLE_ARA_NOKTA_SINIRI } = {}) {
  const ara = duraklar
    .map(d => d.istasyon)
    .filter(i => i && i.enlem != null && i.boylam != null)
    .map(i => ({ lat: i.enlem, lon: i.boylam }));
  const kirpildi = ara.length > sinir;
  const q = new URLSearchParams({ api: '1', origin: nokta(bas), destination: nokta(son), travelmode: 'driving' });
  if (ara.length) q.set('waypoints', ara.slice(0, sinir).map(nokta).join('|'));
  return { url: 'https://www.google.com/maps/dir/?' + q.toString(), araNokta: Math.min(ara.length, sinir), kirpildi };
}

export function wazeHedef(p) {
  return `https://waze.com/ul?ll=${encodeURIComponent(nokta(p))}&navigate=yes`;
}

// Yoldayken: bulunulan konuma göre sıradaki durak (henüz geçilmemiş ilk durak).
// geçilenKm: rotada şimdiye kadar gidilen km (OBD kaydı ya da konumdan).
export function siradakiDurak(duraklar, gecilenKm = 0) {
  return duraklar.find(d => d.km > gecilenKm + 0.5) || null;
}
