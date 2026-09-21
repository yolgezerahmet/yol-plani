// Sabit hız denetimi: OSM'deki hız kameraları ve ortalama hız koridorları (type=enforcement).
// Amaç ceza kaçırmak değil: koridorda gerçek seyir hızı limittir; "limitin %110'u" senaryosu
// orada geçerli olamaz ve süre/enerji tahmini buna göre okunmalıdır. Gezici denetim toplanmaz.
// Kapsam uyarısı: OSM'de Türkiye için birkaç yüz kamera ve az sayıda koridor işli; gerçek sayı
// çok daha fazla. "Listede yok" demek "denetim yok" demek değildir.
import { rotayaIzdusur } from './istasyon.js';

export const OVERPASS = 'https://overpass-api.de/api/interpreter';
export const SORGU = '[out:json][timeout:120];area["ISO3166-1"="TR"][admin_level=2]->.a;'
  + '(node["highway"="speed_camera"](area.a);relation["type"="enforcement"]["enforcement"~"^(average_speed|maxspeed)$"](area.a););out tags center;';

// Overpass yanıtı → paket: { tarih, n: [[enlem, boylam, tur, limit, ad]] } tur: 0 kamera, 1 koridor
export function denetimPaketle(yanit, tarih = new Date().toISOString().slice(0, 10)) {
  const n = [];
  for (const e of yanit.elements || []) {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat == null || lon == null) continue;
    const t = e.tags || {};
    const koridor = e.type === 'relation' && t.enforcement === 'average_speed';
    const limit = parseInt(t.maxspeed, 10);
    n.push([+lat.toFixed(5), +lon.toFixed(5), koridor ? 1 : 0, Number.isFinite(limit) ? limit : 0, koridor ? (t.name || '') : '']);
  }
  return { surum: 1, kaynak: 'OpenStreetMap katkıcıları (ODbL)', tarih, n };
}

export function rotadakiDenetim(paket, sekil, esikKm = 0.15) {
  if (!paket?.n?.length || !sekil?.length) return [];
  const lat = sekil.map(p => p[0]), lon = sekil.map(p => p[1]);
  const kutu = [Math.min(...lat) - 0.02, Math.max(...lat) + 0.02, Math.min(...lon) - 0.02, Math.max(...lon) + 0.02];
  return paket.n
    .filter(r => r[0] > kutu[0] && r[0] < kutu[1] && r[1] > kutu[2] && r[1] < kutu[3])
    .map(r => ({ r, iz: rotayaIzdusur({ enlem: r[0], boylam: r[1] }, sekil) }))
    .filter(x => x.iz.sapmaKm <= (x.r[2] ? 1.5 : esikKm))      // koridor merkezi yol ekseninden uzak olabilir
    .map(x => ({ km: +x.iz.rotaKm.toFixed(1), tur: x.r[2] ? 'koridor' : 'kamera', limit: x.r[3] || null, ad: x.r[4] || '' }))
    .sort((a, b) => a.km - b.km);
}
