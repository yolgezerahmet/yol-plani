// Rota → bölüm. Valhalla trace_attributes kenarlarını ve yükseklik profilini alır,
// hız limiti ve yol sınıfına göre bölümlere ayırır, tırmanış/inişi ayrı toplar,
// limit düşüşlerini (kasaba geçişi, kavşak) hızlanma kaybı olarak sayar.

// OSM yol sınıfı → model yol tipi.
export const SINIF_TIP = {
  motorway: 'otoyol', motorway_link: 'otoyol',
  trunk: 'bolunmus', primary: 'bolunmus',
  secondary: 'tek', tertiary: 'tek', unclassified: 'tek',
  residential: 'sehir', service: 'sehir', ramp: 'sehir', turn_channel: 'sehir',
};

// Etiket yoksa varsayılan limit (Türkiye, otomobil). Bu değerler "tahmini" işaretlenir.
export const VARSAYILAN_LIMIT = { otoyol: 120, bolunmus: 110, tek: 90, sehir: 50 };

export const AYAR = {
  enKisaBolumKm: 3,     // bundan kısa bölümler komşuya katılır
  enUzunBolumKm: 60,    // bundan uzun bölümler eşit parçalara bölünür
  rakimAdimM: 200,      // yükseklik profili bu aralığa yeniden örneklenir
  rakimEsigiM: 10,      // yeniden örnekleme sonrası histerezis
  gecisEsigiKmh: 20,    // akış hızındaki bu kadar düşüş bir geçiş sayılır
  yogunlukEsigi: 8,     // Valhalla density: bu ve üstü yerleşim sayılır
  rejenVerimi: 0.70,    // yavaşlarken geri kazanılan oran
};

const tipBul = s => SINIF_TIP[s] || 'tek';

// Ham kenarlardan (road_class, speed_limit, length) limit/tip profili çıkarır.
export function profil(edges) {
  let km = 0;
  return edges.map(e => {
    const tip = tipBul(e.road_class);
    const etiketli = Number(e.speed_limit) > 0;
    const limit = etiketli ? Number(e.speed_limit) : VARSAYILAN_LIMIT[tip];
    const bas = km; km += Number(e.length);
    // Valhalla'nın kendi akış hızı: kasaba geçişi, kavşak ve yoğunluğu yansıtır.
    const akis = Number(e.speed) > 0 ? Number(e.speed) : limit;
    return { tip, limit, etiketli, akis, yogunluk: Number(e.density) || 0, bas, son: km, km: Number(e.length) };
  });
}

// Akış hızındaki çukurları bulur: düşüp tekrar yükselen her yer bir yavaşlama-hızlanma olayıdır.
// Limit etiketi yerine Valhalla'nın akış hızını kullanır; Türkiye'de devlet yollarında
// limit etiketi çoğu yerde yok, ama akış hızı kasaba ve kavşakları yansıtıyor.
export function gecisler(p, esik = AYAR.gecisEsigiKmh) {
  const g = [];
  for (let i = 1; i < p.length; i++) {
    if (p[i - 1].akis - p[i].akis < esik) continue;
    const dusuk = p[i].akis;
    let j = i;
    while (j + 1 < p.length && p[j + 1].akis <= dusuk) j++;
    if (!p[j + 1]) break; // hız geri yükselmiyorsa bu bir çukur değil, kalıcı düşüş
    const yuksek = Math.min(p[i - 1].akis, p[j + 1].akis);
    if (yuksek - dusuk >= esik) g.push({ km: p[i].bas, yuksek, dusuk, uzunlukKm: p[j].son - p[i].bas });
    i = j;
  }
  return g;
}

// Valhalla yoğunluk (density 0-15) dizisinden yerleşim geçişlerini kestirir.
// Akış hızı düşüşleri Türkiye devlet yollarında kasabaları çoğu zaman göstermiyor;
// yoğunluk bunu kısmen yakalıyor. Bu geçişler "tahmini" sayılır.
export function yerlesimGecisleri(p, esikYogunluk = AYAR.yogunlukEsigi) {
  const g = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i].yogunluk < esikYogunluk) continue;
    let j = i, uz = 0;
    while (j < p.length && p[j].yogunluk >= esikYogunluk) { uz += p[j].km; j++; }
    if (uz >= 0.3) {
      const yuksek = Math.min(p[Math.max(0, i - 1)].akis, p[Math.min(p.length - 1, j)].akis);
      const dusuk = Math.min(...p.slice(i, j).map(x => x.akis), 50);
      if (yuksek - dusuk >= AYAR.gecisEsigiKmh) g.push({ km: p[i].bas, yuksek, dusuk, uzunlukKm: uz, tahmini: true });
    }
    i = j;
  }
  return g;
}

// Bir geçişin net enerji bedeli (kWh): yavaşlayıp yeniden hızlanmanın kaybı.
export function gecisKwh(yuksek, dusuk, kutle, verim, rejen = AYAR.rejenVerimi) {
  const v1 = yuksek / 3.6, v2 = dusuk / 3.6;
  const dKE = 0.5 * kutle * (v1 * v1 - v2 * v2) / 3.6e6; // kWh
  return Math.max(0, dKE * (1 / verim - rejen));
}

// Yükseklik profilini sabit adıma yeniden örnekler. Valhalla örnekleri düzensiz aralıklı
// (virajda 10 m, düzlükte 300 m); doğrudan toplamak kısa dalga boylu DEM gürültüsünü
// gerçek tırmanış sayar. Sabit adım + histerezis bunu eler.
export function yenidenOrnekle(h, adimM = AYAR.rakimAdimM) {
  if (!h.length) return [];
  const son = h[h.length - 1][0], cikti = [];
  let i = 0;
  for (let m = h[0][0]; m <= son; m += adimM) {
    while (i + 1 < h.length && h[i + 1][0] < m) i++;
    const [m0, y0] = h[i], [m1, y1] = h[Math.min(i + 1, h.length - 1)];
    const t = m1 === m0 ? 0 : (m - m0) / (m1 - m0);
    cikti.push([m, y0 + (y1 - y0) * t]);
  }
  if (cikti[cikti.length - 1][0] !== son) cikti.push(h[h.length - 1]);
  return cikti;
}

// [mesafe_m, yükseklik_m] örneklerinden bir km aralığındaki tırmanış ve inişi ayırır.
// h yeniden örneklenmiş olmalı (bkz. yenidenOrnekle).
export function rakimProfili(h, basKm, sonKm, esik = AYAR.rakimEsigiM) {
  let cikis = 0, inis = 0, ref = null, ilk = null, sonY = null;
  for (const [m, y] of h) {
    const km = m / 1000;
    if (km < basKm || km > sonKm) continue;
    if (ref === null) { ref = y; ilk = y; }
    sonY = y;
    if (y - ref >= esik) { cikis += y - ref; ref = y; }
    else if (ref - y >= esik) { inis += ref - y; ref = y; }
  }
  if (ref !== null && sonY !== null) { // kalan eğilimi de yaz
    if (sonY > ref) cikis += sonY - ref; else inis += ref - sonY;
  }
  return { cikis, inis, net: ilk === null ? 0 : sonY - ilk };
}

// Ana işlev: Valhalla verisinden model bölümleri üretir.
// edges: [{road_class, speed_limit, speed, density, length}] (km), h: [[mesafe_m, yükseklik_m], ...]
export function bolumle(edges, ham_h, { kutle = 2150, verim = 0.9, enKisa = AYAR.enKisaBolumKm, enUzun = AYAR.enUzunBolumKm } = {}) {
  const h = yenidenOrnekle(ham_h);
  const p = profil(edges);
  if (!p.length) return { bolumler: [], gecisler: [], toplamKm: 0 };
  const hizDipleri = gecisler(p);
  const yerlesim = yerlesimGecisleri(p).filter(y => !hizDipleri.some(x => Math.abs(x.km - y.km) < 1));
  const g = [...hizDipleri, ...yerlesim].sort((a, b) => a.km - b.km);

  // 1) aynı tip ve limitteki ardışık kenarları birleştir
  let ham = [];
  for (const e of p) {
    const s = ham[ham.length - 1];
    if (s && s.tip === e.tip && s.limit === e.limit) { s.son = e.son; s.etiketli = s.etiketli && e.etiketli; }
    else ham.push({ tip: e.tip, limit: e.limit, etiketli: e.etiketli, bas: e.bas, son: e.son });
  }
  // 2) kısa parçaları komşuya kat: uzun komşunun kimliği kazanır
  let degisti = true;
  while (degisti && ham.length > 1) {
    degisti = false;
    for (let i = 0; i < ham.length; i++) {
      if (ham[i].son - ham[i].bas >= enKisa) continue;
      const onceki = ham[i - 1], sonraki = ham[i + 1];
      const hedef = !onceki ? sonraki : !sonraki ? onceki
        : (onceki.son - onceki.bas >= sonraki.son - sonraki.bas ? onceki : sonraki);
      hedef.bas = Math.min(hedef.bas, ham[i].bas);
      hedef.son = Math.max(hedef.son, ham[i].son);
      ham.splice(i, 1);
      degisti = true;
      break;
    }
  }

  // 3) çok uzun bölümleri eşit parçalara böl: şarj durağı ve rakım çözünürlüğü için
  const parcali = [];
  for (const s of ham) {
    const uz = s.son - s.bas, adet = Math.max(1, Math.ceil(uz / enUzun));
    for (let k = 0; k < adet; k++) {
      parcali.push({ ...s, bas: s.bas + uz * k / adet, son: s.bas + uz * (k + 1) / adet });
    }
  }

  const bolumler = parcali.map((s, i) => {
    const r = rakimProfili(h, s.bas, s.son);
    // Akış oranı: Valhalla'nın bu aralıktaki ortalama hızı / yasal limit.
    // Sabit katsayı yerine gerçek yol verisi; kavşak, kasaba ve viraj etkisini taşır.
    const ic = p.filter(e => e.son > s.bas && e.bas < s.son);
    const uz = ic.reduce((t, e) => t + e.km, 0);
    const ortAkis = uz > 0 ? ic.reduce((t, e) => t + e.akis * e.km, 0) / uz : s.limit;
    const akisOrani = Math.min(1.05, Math.max(0.45, ortAkis / s.limit));
    const ig = g.filter(x => x.km >= s.bas && x.km < s.son);
    const gecisKayipKwh = ig.reduce((t, x) => t + gecisKwh(x.yuksek, x.dusuk, kutle, verim), 0);
    return {
      no: i + 1, tip: s.tip, limit: s.limit, tahminiLimit: !s.etiketli,
      basKm: +s.bas.toFixed(1), km: +(s.son - s.bas).toFixed(1),
      cikis: Math.round(r.cikis), inis: Math.round(r.inis), dh: Math.round(r.net),
      gecisSayisi: ig.length, gecisKayipKwh: +gecisKayipKwh.toFixed(2),
      akisOrani: +akisOrani.toFixed(3), tahminiGecis: ig.some(x => x.tahmini),
      hiz: s.limit, // başlangıç değeri; kullanıcı değiştirir
    };
  });
  return { bolumler, gecisler: g, toplamKm: +p[p.length - 1].son.toFixed(1) };
}
