// Belirsizlik: tahmin tek sayı değildir. Her bacağın (çıkış/durak → sonraki durak/varış) varış
// bataryası için dağılım verilir; sürücü "en kötü gerçekçi durumda" nereye varacağını görür.
//
// Kaynaklar (bağımsız varsayılır, kareler toplanır):
//   model hatası: kalibrasyonsuz %6, OBD ile ≥ 3 yolculuk ölçülmüşse %3 (enerjinin oranı) [T]
//   hava: model topluluğu senaryolarının yayılımı (en yüksek − en düşük) / 4 ≈ σ
// Bacak enerjisi arttıkça hata büyür; bu yüzden uzun bacaklar daha riskli görünür.
import { aralikKwh } from './plan.js';

export const Z90 = 1.2816;                       // tek yönlü %90
const phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
function erf(x) {                                 // Abramowitz–Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}

export function sigmaOrani({ kalibreYolculuk = 0, havaSenaryoKwh = [], toplamKwh = 0 } = {}) {
  const model = kalibreYolculuk >= 3 ? 0.03 : 0.06;
  const hava = havaSenaryoKwh.length > 1 && toplamKwh > 0 ? (Math.max(...havaSenaryoKwh) - Math.min(...havaSenaryoKwh)) / 4 / toplamKwh : 0.015;
  return { model, hava: +hava.toFixed(4), toplam: +Math.hypot(model, hava).toFixed(4) };
}

// plan: durakPlanla/durakOptimum çıktısı; k.kap; oran: sigmaOrani().toplam
export function bacakRiski(plan, k, oran, { kritikSoc = 3 } = {}) {
  const e = plan.enerji, kap = k.kap;
  const nokta = [{ km: plan.yenidenKm ?? 0 }, ...plan.duraklar.map(d => ({ km: d.km, varis: d.varisSoc, ad: d.istasyon.marka || d.istasyon.ad, no: d.no })), { km: e.toplamKm, varis: plan.varisSoc, ad: 'Varış', no: null }];
  const bacak = [];
  for (let i = 1; i < nokta.length; i++) {
    const kwh = aralikKwh(e, nokta[i - 1].km, nokta[i].km);
    const s = kwh * oran / kap * 100;                           // σ, yüzde puanı
    const ort = nokta[i].varis;
    bacak.push({
      ad: nokta[i].ad, no: nokta[i].no, km: +(nokta[i].km - nokta[i - 1].km).toFixed(0),
      ort, sigma: +s.toFixed(1), p10: +(ort - Z90 * s).toFixed(1),
      altKritik: s > 0 ? +phi((kritikSoc - ort) / s).toFixed(4) : (ort < kritikSoc ? 1 : 0),
    });
  }
  const enKotu = bacak.reduce((a, b) => (b.p10 < a.p10 ? b : a), bacak[0]);
  return { bacak, enKotu };
}
