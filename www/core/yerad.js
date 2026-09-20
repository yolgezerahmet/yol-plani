// Çevrimdışı coğrafi kodlama: OSM yer noktalarıyla mahalle eşleştirme.
//
// Neden: Türkiye adreslerinde sokak düzeyi coğrafi kodlama tutmuyor, mahalle düzeyi tutuyor.
// Ama mahalle mahalle ağ sorgusu ölçeklenmiyor (81 il x ~120 mahalle). Bunun yerine
// OSM'den il başına TEK sorguyla tüm yer noktaları indirilir, eşleştirme cihazda yapılır.
// Sonuç: ağ çağrısı yok, kota yok, uçuş modunda çalışır.
//
// Yer noktası: { ad, tur: 'suburb'|'neighbourhood'|'village'|..., lat, lon }

// Overpass sorgusu. Kutu: [güney, batı, kuzey, doğu].
export function overpassSorgusu([g, b, k, d]) {
  return `[out:json][timeout:120];node["place"~"neighbourhood|suburb|quarter|village|town|city"](${g},${b},${k},${d});out body;`;
}

export function overpassCozumle(yanit) {
  return (yanit?.elements || [])
    .filter(e => e.tags?.name && e.lat != null)
    .map(e => ({ ad: e.tags.name, tur: e.tags.place, lat: e.lat, lon: e.lon }));
}

// Türkçe ada duyarlı normalleştirme. "Mimarsinan" ile "Mimar Sinan" aynı anahtara düşsün diye
// boşluklar da silinir; "Yıldırım Beyazıt" ↔ "Yıldırımbeyazıt" bu sayede eşleşir.
export function anahtar(ad) {
  return String(ad ?? '')
    .toLocaleLowerCase('tr')
    .replace(/\s*mahallesi\s*$/i, '')
    .replace(/[çğıöşü]/g, c => ({ 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' }[c]))
    .replace(/[^a-z0-9]/g, '');
}

// Yer noktalarından arama dizini kurar. Aynı ada birden çok nokta düşerse hepsi saklanır;
// seçim ilçe yakınlığına göre yapılır.
export function dizinKur(noktalar) {
  const d = new Map();
  for (const n of noktalar) {
    const a = anahtar(n.ad);
    if (!a) continue;
    if (!d.has(a)) d.set(a, []);
    d.get(a).push(n);
  }
  return d;
}

const R = 6371;
const rad = x => (x * Math.PI) / 180;
export function mesafeKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Mahalle adından konum bulur. Aynı ad birden çok yerde varsa (Türkiye'de sık),
// ilçe merkezine en yakın olan seçilir — bu yüzden ilceKonumu önemli.
// Tür önceliği: şehir içi mahalle türleri köy/kasabadan önce gelir.
const TUR_ONCELIK = { neighbourhood: 0, suburb: 1, quarter: 2, town: 3, village: 4, city: 5 };

export function bul(dizin, mahalleAdi, ilceKonumu = null, { enFazlaKm = 40 } = {}) {
  const adaylar = dizin.get(anahtar(mahalleAdi));
  if (!adaylar?.length) return null;
  let liste = adaylar;
  if (ilceKonumu) {
    liste = adaylar
      .map(n => ({ n, km: mesafeKm(n, ilceKonumu) }))
      .filter(x => x.km <= enFazlaKm)
      .sort((a, b) => a.km - b.km)
      .map(x => x.n);
    if (!liste.length) return null;
  }
  liste = [...liste].sort(
    (a, b) => (TUR_ONCELIK[a.tur] ?? 9) - (TUR_ONCELIK[b.tur] ?? 9)
  );
  const s = liste[0];
  return { lat: s.lat, lon: s.lon, ad: s.ad, tur: s.tur, adaySayisi: adaylar.length };
}

// EPDK istasyon listesini çevrimdışı konumlandırır.
// ilceKonumlari: { "Melikgazi": {lat, lon} } — ilçe merkezleri, ayırım için.
export function konumSozlugu(istasyonlar, dizin, ilceKonumlari = {}) {
  const s = {};
  for (const i of istasyonlar) {
    if (!i.mahalle) continue;
    const k = `${i.mahalle}, ${i.ilce}, ${i.il}`;
    if (s[k]) continue;
    const b = bul(dizin, i.mahalle, ilceKonumlari[i.ilce] || null);
    if (b) s[k] = [b.lat, b.lon];
  }
  return s;
}
