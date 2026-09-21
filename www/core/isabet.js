// Tahmin isabeti: OBD ile kaydedilen yolculuklarda plan tahmini ile ölçülen enerji karşılaştırılır.
// "ABRP'den daha iyi" iddiası ancak bu sayılarla sınanabilir; bkz. docs/dogrulama.md, ABRP kıyası.
export function isabet(yolculuklar, { enAzKm = 20 } = {}) {
  const g = yolculuklar.map(y => ({ ...y, planKwh: y.planKwh ?? y.modelKwh })).filter(y => y.km >= enAzKm && y.planKwh > 0 && y.olculenKwh > 0);
  if (!g.length) return null;
  const hata = g.map(y => (y.planKwh - y.olculenKwh) / y.olculenKwh);
  const ort = a => a.reduce((t, x) => t + x, 0) / a.length;
  const km = g.reduce((t, y) => t + y.km, 0);
  const soc = g.filter(y => y.planVarisSoc != null && y.varisSoc != null).map(y => y.planVarisSoc - y.varisSoc);
  return {
    yolculuk: g.length, km: Math.round(km),
    mape: +(ort(hata.map(Math.abs)) * 100).toFixed(1),       // ortalama mutlak yüzde hata
    sapma: +(ort(hata) * 100).toFixed(1),                    // + ise iyimser değil, kötümser (fazla tahmin)
    varisHataPuan: soc.length ? +ort(soc.map(Math.abs)).toFixed(1) : null,
  };
}
