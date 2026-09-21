// Planı GPX'e çevirir: OsmAnd (ve her GPX okuyan navigasyon) rotayı "izle" diye açar, şarj
// durakları ara nokta olur. OsmAnd'in EV planlaması yok; enerji bilgisi durak adına ve
// açıklamasına yazılır ki sürücü OsmAnd içinde de görsün.
//
// Yapı: <wpt> şarj durakları (başlangıç ve varış dahil), <rte> ara noktalı rota (OsmAnd bunu
// yeniden hesaplar), <trk> rotanın tam şekli (yeniden hesap istemeyenler için "izle").
const x = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const k5 = v => (+v).toFixed(5);
const sayi = (v, b = 0) => Number(v).toLocaleString('tr-TR', { maximumFractionDigits: b });

export function gpxUret({ bas, son, sekil, plan, ad = 'Yol Planı' }) {
  const wpt = [];
  const nokta = (lat, lon, adi, aciklama, tur) => wpt.push(
    `  <wpt lat="${k5(lat)}" lon="${k5(lon)}"><name>${x(adi)}</name>${aciklama ? `<desc>${x(aciklama)}</desc>` : ''}<type>${tur}</type></wpt>`);
  nokta(bas.lat, bas.lon, `Çıkış · %${sayi(plan.enerji?.soc0 ?? plan.profil?.[0]?.[1] ?? 0)}`, bas.ad || '', 'start');
  for (const d of plan.duraklar) {
    const i = d.istasyon;
    nokta(i.enlem, i.boylam, `${d.no}. şarj: ${i.marka || i.ad} · %${sayi(d.varisSoc)}→%${sayi(d.hedefSoc)}, ${d.dk} dk`,
      `${i.ad}. ${i.kw} kW × ${i.soketSayisi || '?'}. Varışta %${sayi(d.varisSoc)}, hedef %${sayi(d.hedefSoc)}, ${sayi(d.ekKwh, 1)} kWh, ${d.dk} dk.`
      + (d.onIsitma ? ` Ön ısıtmayı ${sayi(d.onIsitma.baslaKm)}. km'de başlat.` : '')
      + (d.ariza?.yedek ? ` Çalışmazsa: ${d.ariza.yedek.marka || d.ariza.yedek.ad}, ${sayi(Math.abs(d.ariza.yedekKm))} km ${d.ariza.yedekKm >= 0 ? 'ileride' : 'geride'}.` : ''),
      'charging');
    if (d.onIsitma && sekil) { const p = noktaKmde(sekil, plan.enerji, d.onIsitma.baslaKm); if (p) nokta(p[0], p[1], `Ön ısıtmayı başlat (${d.no}. durak)`, '', 'preheat'); }
  }
  nokta(son.lat, son.lon, `Varış · %${sayi(plan.varisSoc)}`, son.ad || '', 'end');
  const rte = [bas, ...plan.duraklar.map(d => ({ lat: d.istasyon.enlem, lon: d.istasyon.boylam })), son]
    .map(p => `    <rtept lat="${k5(p.lat)}" lon="${k5(p.lon)}"/>`).join('\n');
  const trk = (sekil || []).map(p => `      <trkpt lat="${k5(p[0])}" lon="${k5(p[1])}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Yol Planı" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${x(ad)}</name><desc>${x(`${sayi(plan.toplamKm)} km, ${plan.duraklar.length} şarj durağı, toplam ${sayi(plan.toplamKwh, 1)} kWh. Şarj durakları ara nokta; rotayı "izle" seçeneğiyle aç.`)}</desc></metadata>
${wpt.join('\n')}
  <rte><name>${x(ad + ' (ara noktalı)')}</name>
${rte}
  </rte>
${trk ? `  <trk><name>${x(ad)}</name><trkseg>\n${trk}\n    </trkseg></trk>` : ''}
</gpx>
`;
}

// Rota şeklinde x km'deki nokta (eşit aralıklı varsayımla; tam km eksenini enerji eğrisi verir).
export function noktaKmde(sekil, e, km) {
  const L = e?.toplamKm; if (!sekil?.length || !(L > 0)) return null;
  const i = Math.min(sekil.length - 1, Math.max(0, Math.round(km / L * (sekil.length - 1))));
  return sekil[i];
}
