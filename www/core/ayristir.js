// Enerji ayrıştırma: bu yolculuğun enerjisinin ne kadarı soğuktan, rakımdan ve rüzgârdan geliyor?
// Adım adım ekleme: önce 20 °C, rüzgârsız, düz yol; sonra sırasıyla tırmanış/iniş, sıcaklık, rüzgâr.
// Sıra etkiler (soğuk havada tırmanış biraz daha pahalı); sonuç yaklaşık bir paylaştırmadır.
import { enerjiEgrisi } from './plan.js';

const HAVA = ['T', 'nem', 'basincPa', 'ruzgarHizi', 'ruzgarYonu', 'yagis', 'ruzgar'];

function temizle(b, { duz, ilik, sakin }) {
  const c = { ...b };
  if (duz) { c.cikis = 0; c.inis = 0; c.dh = 0; }
  if (ilik) { c.T = 20; c.nem = 50; c.basincPa = null; c.yagis = false; }
  if (sakin) { c.ruzgarHizi = 0; c.ruzgar = 0; }
  return c;
}

export function enerjiAyristir(bolumler, k) {
  const kk = (o) => ({ ...k, ...(o.ilik ? { T: 20, nem: 50, basincPa: null, yagis: false } : {}), ...(o.sakin ? { ruzgarHizi: 0, ruzgar: 0 } : {}) });
  const e = o => enerjiEgrisi(bolumler.map(b => temizle(b, o)), kk(o)).toplamKwh;
  const taban = e({ duz: true, ilik: true, sakin: true });
  const rakim = e({ duz: false, ilik: true, sakin: true });
  const sicak = e({ duz: false, ilik: false, sakin: true });
  const hepsi = e({ duz: false, ilik: false, sakin: false });
  const r = x => +x.toFixed(1);
  const enYuksek = Math.max(0, ...bolumler.map(b => b.rakimMax ?? b.rakim ?? 0));
  const enSoguk = Math.min(...bolumler.map(b => b.T ?? k.T));
  return { taban: r(taban), rakimKwh: r(rakim - taban), sicaklikKwh: r(sicak - rakim), ruzgarKwh: r(hepsi - sicak), toplam: r(hepsi), enYuksek, enSoguk };
}

// Ekranda tek cümle: yalnızca anlamlı (≥ 1 kWh ya da toplamın ≥ %3'ü) kalemler.
export function ayristirmaCumlesi(a) {
  const esik = Math.max(1, a.toplam * 0.03);
  const f = x => Math.abs(x).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const p = [];
  if (Math.abs(a.sicaklikKwh) >= esik) p.push(a.sicaklikKwh > 0 ? `soğuk ${f(a.sicaklikKwh)} kWh ekliyor` : `ılık hava ${f(a.sicaklikKwh)} kWh kazandırıyor`);
  if (Math.abs(a.rakimKwh) >= esik) p.push(a.rakimKwh > 0 ? `tırmanış ${f(a.rakimKwh)} kWh ekliyor` : `iniş ${f(a.rakimKwh)} kWh kazandırıyor`);
  if (Math.abs(a.ruzgarKwh) >= esik) p.push(a.ruzgarKwh > 0 ? `rüzgâr ${f(a.ruzgarKwh)} kWh ekliyor` : `arka rüzgâr ${f(a.ruzgarKwh)} kWh kazandırıyor`);
  if (!p.length) return null;
  const s = 'Bu yolculukta ' + (p.length > 1 ? p.slice(0, -1).join(', ') + ' ve ' + p[p.length - 1] : p[0]) + '.';
  return s;
}
