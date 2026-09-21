// Ağ katmanı. Her işlev getir (fetch) alır; testte sahte yanıtla çalışır.
// Çekirdek hesaplar burada yapılmaz: bu dosya yalnızca veriyi toplar ve dönüştürür.
import { bolumle, cozPolyline } from './rota.js';
import { rotaUstunde, mesafeKm } from './istasyon.js';

export const VALHALLA = 'https://valhalla1.openstreetmap.de';
export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

async function json(getir, url, govde) {
  const y = await getir(url, govde
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }
    : undefined);
  if (!y.ok) throw new Error(`${new URL(url).host} yanıt vermedi (${y.status})`);
  return y.json();
}

// Yer adından koordinat (çıkış/varış kutuları için).
export async function yerAra(metin, getir = fetch) {
  const u = `${NOMINATIM}?format=json&countrycodes=tr&limit=5&q=${encodeURIComponent(metin)}`;
  const r = await json(getir, u);
  return r.map(x => ({ ad: x.display_name.split(',').slice(0, 3).join(','), lat: +x.lat, lon: +x.lon }));
}

// Rota + alternatif. Her alternatif için kenar öznitelikleri ve yükseklik profili alınır.
export async function rotaGetir(bas, son, getir = fetch, { alternatif = 1, kutle = 2150 } = {}) {
  const r = await json(getir, `${VALHALLA}/route`, {
    locations: [{ lat: bas.lat, lon: bas.lon }, { lat: son.lat, lon: son.lon }],
    costing: 'auto', alternates: alternatif, units: 'kilometers',
  });
  const tripler = [r.trip, ...(r.alternates || []).map(a => a.trip)].filter(Boolean);
  const sonuc = [];
  for (const t of tripler) {
    const shape = t.legs.map(l => l.shape).join('');
    const legShape = t.legs[0].shape;
    const [ta, yk] = await Promise.all([
      json(getir, `${VALHALLA}/trace_attributes`, { encoded_polyline: legShape, costing: 'auto', shape_match: 'edge_walk' }),
      json(getir, `${VALHALLA}/height`, { encoded_polyline: legShape, range: true, resample_distance: 100, height_precision: 0 }),
    ]);
    const h = (yk.range_height || []).filter(x => x[1] != null);
    const b = bolumle(ta.edges || [], h, { kutle, shape: legShape });
    const adim = Math.max(1, Math.ceil(h.length / 400));
    const rakimProfili = h.filter((_, i) => i % adim === 0).map(([m, y]) => [+(m / 1000).toFixed(2), Math.round(y)]);
    sonuc.push({ ...b, rakimProfili, sekil: cozPolyline(shape), sureDkValhalla: Math.round(t.summary.time / 60), kmValhalla: t.summary.length });
  }
  return sonuc;
}

// Paket (bkz. epdk.js paketle) istasyon nesnelerine açılır. Konum EPDK'nın resmî koordinatıdır.
export function paketAc(p) {
  if (p.surum !== 2) throw new Error('İstasyon paketi eski biçimde; güncelleme iş akışını çalıştırın');
  const i = Object.fromEntries(p.alanlar.map((a, n) => [a, n]));
  return {
    tarih: p.tarih, kaynak: p.kaynak,
    istasyonlar: p.s.map(r => ({
      id: 'epdk:' + r[i.no], no: 'ŞRJ/' + r[i.no], ad: r[i.ad], marka: r[i.marka],
      operator: p.operatorler[r[i.op]] || '', enlem: r[i.enlem], boylam: r[i.boylam],
      kw: r[i.dcKw], soketSayisi: r[i.ccsSoket], ilce: r[i.ilce], il: r[i.ilce] || r[i.il], ilAdi: r[i.il] || null,
      yesil: !!r[i.yesil], kaynak: 'epdk', konum: 'kesin', guven: 1,
    })),
  };
}

// Rota çevresindeki istasyonlar. 7.500 istasyonu 10.000 noktalı şekle tek tek izdüşürmek telefonda
// saniyeler sürer; önce kaba eleme: rota kutusu, sonra ~2 km aralıklı seyreltilmiş şekle uzaklık.
// Kesin izdüşüm yalnızca kalan birkaç yüz aday için yapılır.
export function seyrelt(sekil, adimKm = 2) {
  const c = [sekil[0]];
  let son = sekil[0];
  for (const n of sekil) if (mesafeKm(son, n) >= adimKm) { c.push(n); son = n; }
  if (c[c.length - 1] !== sekil[sekil.length - 1]) c.push(sekil[sekil.length - 1]);
  return c;
}

export function rotaIstasyonlari(sekil, istasyonlar, { sapmaKm = 5 } = {}) {
  let g = 90, b = 180, k = -90, d = -180;
  for (const [la, lo] of sekil) { g = Math.min(g, la); k = Math.max(k, la); b = Math.min(b, lo); d = Math.max(d, lo); }
  const pay = 0.12;
  const kutuda = istasyonlar.filter(s => s.enlem > g - pay && s.enlem < k + pay && s.boylam > b - pay && s.boylam < d + pay);
  const kaba = seyrelt(sekil);
  const esik = sapmaKm + 2.5;
  const yakin = kutuda.filter(s => kaba.some(n => mesafeKm(n, [s.enlem, s.boylam]) < esik));
  return rotaUstunde(yakin, sekil, sapmaKm);
}
