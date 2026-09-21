// OsmAnd özel eklentisi (.osf). OsmAnd'in "Eklentiler" menüsünde asıl eklentiler gibi görünür;
// F-Droid, Play ve ücretsiz sürümlerin hepsinde çalışır (kod değil, veri paketidir).
// İçerik: EPDK'nın halka açık hızlı şarj istasyonları, güce göre iki favori grubu olarak.
// Biçim OsmAnd kaynağından doğrulandı: items.json + her FAVOURITES öğesi için adı "file" alanıyla
// birebir aynı bir GPX (SettingsItem.readFromJson, FavoritesSettingsItem, FavouritesFileHelper).
import { zipYaz } from './zip.js';

export const EKLENTI_ID = 'yolplani.ev';
const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const k5 = v => (+v).toFixed(5);
export const GRUPLAR = [
  { ad: 'EV şarj 150 kW+', renk: '#1b8a4d', en: 150 },
  { ad: 'EV şarj 50–149 kW', renk: '#d88a12', en: 50 },
];

export function grupGpx(grup, istasyonlar) {
  const wpt = istasyonlar.map(s => `  <wpt lat="${k5(s.enlem)}" lon="${k5(s.boylam)}">
    <name>${x(`${s.marka || 'Şarj'} · ${s.kw} kW × ${s.soketSayisi || '?'}`)}</name>
    <desc>${x(`${s.ad}${s.ilce ? ', ' + s.ilce : ''}${s.ilAdi ? ' / ' + s.ilAdi : ''}. ${s.operator}. EPDK ${s.no}.`)}</desc>
    <type>${x(grup.ad)}</type>
    <extensions><osmand:icon>amenity_charging_station</osmand:icon><osmand:background>circle</osmand:background><osmand:color>${grup.renk}</osmand:color></extensions>
  </wpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Yol Planı" xmlns="http://www.topografix.com/GPX/1/1" xmlns:osmand="https://osmand.net">
  <metadata><name>${x(grup.ad)}</name></metadata>
${wpt}
  <extensions><osmand:points_groups><group name="${x(grup.ad)}" color="${grup.renk}" icon="amenity_charging_station" background="circle"/></osmand:points_groups></extensions>
</gpx>
`;
}

export function osfDosyalari(istasyonlar, { tarih = '' } = {}) {
  const gruplar = GRUPLAR.map((g, i) => ({ g, l: istasyonlar.filter(s => s.kw >= g.en && (i === 0 || s.kw < GRUPLAR[i - 1].en)) }));
  const items = [{
    type: 'PLUGIN', pluginId: EKLENTI_ID, version: 1,
    name: { '': 'Yol Planı: elektrikli araç', tr: 'Yol Planı: elektrikli araç' },
    description: { '': `Türkiye hızlı şarj istasyonları (EPDK resmî listesi${tarih ? ', ' + tarih : ''}): ${istasyonlar.length} istasyon, güce göre iki grup. Rota ve şarj planı Yol Planı uygulamasından "OsmAnd'e gönder" ile gelir.` },
  }, ...gruplar.map(({ g }) => ({ type: 'FAVOURITES', pluginId: EKLENTI_ID, file: `favorites-${g.ad}.gpx` }))];
  return [
    { ad: 'items.json', veri: JSON.stringify({ version: 1, items }, null, 1) },
    ...gruplar.map(({ g, l }) => ({ ad: `favorites-${g.ad}.gpx`, veri: grupGpx(g, l) })),
  ];
}

export const osfUret = (istasyonlar, opt) => zipYaz(osfDosyalari(istasyonlar, opt));
