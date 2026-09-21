// Ölçülmüş şarj gücü: OBD kaydındaki DC şarj oturumunu istasyonla eşleştirir, beklenen güçle kıyaslar.
// Veri telefonda kalır. Paylaşım (anonim, izinle) ayrı bir adım; burada yalnızca yerel kayıt var.
import { sarjGucu } from './model.js';
import { sicaklikKatsayisi } from './termal.js';
import { mesafeKm } from './istasyon.js';

export const ESLESME_M = 150;

// Oturumun konumu: örneklerdeki konumların ortancası (GPS sapmasına karşı).
export function oturumKonumu(noktalar) {
  const k = noktalar.filter(n => n.enlem != null && n.boylam != null);
  if (!k.length) return null;
  const ort = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  return { enlem: ort(k.map(n => n.enlem)), boylam: ort(k.map(n => n.boylam)) };
}

export function istasyonEsle(konum, istasyonlar, esikM = ESLESME_M) {
  if (!konum) return null;
  let en = null, d = Infinity;
  for (const s of istasyonlar) {
    const m = mesafeKm([konum.enlem, konum.boylam], [s.enlem, s.boylam]) * 1000;
    if (m < d) { d = m; en = s; }
  }
  return d <= esikM ? { istasyon: en, uzaklikM: Math.round(d) } : null;
}

// oturum: sarjOturumlari çıktısı (noktalar: {soc, kw, T, enlem?, boylam?})
// Beklenen: aracın eğrisi × sıcaklık katsayısı, istasyon gücüyle sınırlı. Oran < 0,6 ise
// istasyon beklenenin belirgin altında vermiş demektir (güç paylaşımı, kısıtlama, arıza).
export function olcumOzeti(oturum, istasyonlar, { olcek = 1, tablo } = {}) {
  const konum = oturumKonumu(oturum.noktalar);
  const e = istasyonEsle(konum, istasyonlar);
  const ist = e?.istasyon;
  const uygun = oturum.noktalar.filter(n => n.soc >= 10 && n.soc <= 60 && n.kw > 0);
  const oran = uygun.length ? uygun.map(n => {
    const bek = Math.min(sarjGucu(n.soc, olcek) * sicaklikKatsayisi(n.T ?? 25, tablo), (ist?.kw ?? 999) * 0.93);
    return n.kw / bek;
  }) : [];
  const ortanca = oran.length ? [...oran].sort((a, b) => a - b)[Math.floor(oran.length / 2)] : null;
  return {
    tarih: new Date(oturum.bas).toISOString().slice(0, 10),
    istasyonNo: ist?.no ?? null, istasyonAd: ist?.ad ?? null, uzaklikM: e?.uzaklikM ?? null,
    soc0: oturum.soc0, soc1: oturum.soc1, T0: oturum.T0, dk: oturum.dk,
    tepeKw: Math.round(oturum.tepeKw), beklenenOran: ortanca != null ? +ortanca.toFixed(2) : null,
    dusuk: ortanca != null && ortanca < 0.6,
  };
}
