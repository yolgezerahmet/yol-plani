// OBD kayıtlarından araca özel kalibrasyon. Model tahmin eder; kendi aracının verisi düzeltir.
//
// Örnek (ornek): { t: ms, soc, gucKw, bataryaMaxT, bataryaMinT, cecKwh, cedKwh, dcSarj, km? }
// Üç ürün:
//   1) Şarj oturumları ve sıcaklık → güç tablosu (termal.js SICAKLIK_TAVANI'nın yerine)
//   2) Tüketim katsayısı: ölçülen net enerji / model tahmini
//   3) Kullanılabilir kapasite: SoC değişimine karşı sayaç enerjisi
import { SICAKLIK_TAVANI } from './termal.js';
import { sarjGucu } from './model.js';

// Ardışık DC şarj örneklerini oturumlara böler. 5 dakikadan uzun boşluk yeni oturum sayılır.
export function sarjOturumlari(ornekler, { boslukMs = 5 * 60000 } = {}) {
  const oturum = [];
  let cur = null, onceki = null;
  for (const o of ornekler) {
    if (!o.dcSarj) { cur = null; onceki = o; continue; }
    if (!cur || (onceki && o.t - onceki.t > boslukMs)) { cur = []; oturum.push(cur); }
    cur.push(o); onceki = o;
  }
  return oturum.filter(s => s.length >= 3).map(s => ({
    bas: s[0].t, son: s[s.length - 1].t, dk: +((s[s.length - 1].t - s[0].t) / 60000).toFixed(1),
    soc0: s[0].soc, soc1: s[s.length - 1].soc,
    kwh: s[s.length - 1].cecKwh != null && s[0].cecKwh != null ? +(s[s.length - 1].cecKwh - s[0].cecKwh).toFixed(1) : null,
    T0: s[0].bataryaMinT, T1: s[s.length - 1].bataryaMinT,
    tepeKw: Math.max(...s.map(x => -x.gucKw)),
    noktalar: s.map(x => ({ soc: x.soc, kw: -x.gucKw, T: x.bataryaMinT, enlem: x.enlem, boylam: x.boylam })),
  }));
}

// Sıcaklık → güç katsayısı tablosu. Katsayı = ölçülen güç / o SoC'deki referans eğri gücü.
// İstasyon sınırlı noktalar katsayıyı düşük gösterir; bu yüzden her 5 °C diliminde en yüksek
// değerlerin (üst çeyrek) ortalaması alınır. %10–60 dışı SoC kullanılmaz (eğrinin dik yeri).
// Veri olmayan dilimde varsayılan tablo kalır; ölçülen dilimler varsayılanın yerine geçer.
export function sicaklikTablosu(oturumlar, { olcek = 1, enAzNokta = 4, varsayilan = SICAKLIK_TAVANI } = {}) {
  const dilim = new Map();
  for (const o of oturumlar) for (const n of o.noktalar) {
    if (n.soc < 10 || n.soc > 60 || n.T == null || n.kw < 5) continue;
    const kat = Math.min(1.1, n.kw / (sarjGucu(n.soc, olcek)));
    const d = Math.round(n.T / 5) * 5;
    if (!dilim.has(d)) dilim.set(d, []);
    dilim.get(d).push(kat);
  }
  const olcum = [];
  for (const [T, k] of dilim) {
    if (k.length < enAzNokta) continue;
    const ust = k.sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(k.length / 4)));
    olcum.push([T, +Math.min(1, ust.reduce((a, b) => a + b, 0) / ust.length).toFixed(2)]);
  }
  if (!olcum.length) return { tablo: varsayilan, olculen: 0 };
  const bilinen = new Set(olcum.map(x => x[0]));
  const tablo = [...varsayilan.filter(([T]) => !olcum.some(([o]) => Math.abs(o - T) < 2.5)), ...olcum]
    .sort((a, b) => a[0] - b[0]);
  // Sıcaklık arttıkça katsayı azalmamalı (45 °C altı); ölçüm gürültüsünü düzelt.
  for (let i = 1; i < tablo.length; i++) if (tablo[i][0] <= 45 && tablo[i][1] < tablo[i - 1][1]) tablo[i][1] = tablo[i - 1][1];
  return { tablo, olculen: bilinen.size };
}

// Sürüş parçası: iki örnek arasında net batarya enerjisi (deşarj − rejenerasyon dahil şarj).
// CED/CEC sayaçları 0,1 kWh çözünürlüklü; kısa parçalar gürültülüdür, en az 20 km beklenir.
export function suruIstatistigi(a, b) {
  const netKwh = (b.cedKwh - a.cedKwh) - (b.cecKwh - a.cecKwh);
  const km = b.km != null && a.km != null ? b.km - a.km : null;
  return { netKwh: +netKwh.toFixed(1), km, whKm: km ? Math.round(netKwh / km * 1000) : null, dSoc: +(a.soc - b.soc).toFixed(1) };
}

// Tüketim katsayısı: ölçülen / model. Birden çok yolculuğun km ağırlıklı ortalaması; 0,8–1,25'e kırpılır.
export function tuketimKatsayisi(yolculuklar) {
  const g = yolculuklar.filter(y => y.km >= 20 && y.modelKwh > 0 && y.olculenKwh > 0);
  if (!g.length) return { kat: 1, yolculuk: 0 };
  const top = g.reduce((t, y) => t + y.km, 0);
  const kat = g.reduce((t, y) => t + (y.olculenKwh / y.modelKwh) * y.km, 0) / top;
  return { kat: +Math.min(1.25, Math.max(0.8, kat)).toFixed(3), yolculuk: g.length };
}

// Kullanılabilir kapasite: sayaç enerjisi / SoC değişimi. %30'dan büyük değişimler güvenilir.
export function kapasiteTahmini(a, b) {
  const dSoc = Math.abs(b.soc - a.soc);
  if (dSoc < 30) return null;
  const kwh = Math.abs((b.cecKwh - a.cecKwh) - (b.cedKwh - a.cedKwh));
  return +(kwh / dSoc * 100).toFixed(1);
}
