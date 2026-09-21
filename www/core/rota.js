// Rota → bölüm. Valhalla'nın kenar özniteliklerinin tamamını fiziksel parametrelere çevirir:
// yol sınıfı, hız limiti, akış hızı, yüzey, şerit, tünel, köprü, döner kavşak, ışık, kesişme,
// viraj, ücretli yol, yön (rüzgâr için), ortalama rakım (hava yoğunluğu için), eğim.
// Katsayı etiketleri: [Ö] ölçülen/standart, [L] literatür, [T] proje tahmini.

export const SINIF_TIP = {
  motorway: 'otoyol', motorway_link: 'otoyol',
  trunk: 'bolunmus', primary: 'bolunmus',
  secondary: 'tek', tertiary: 'tek', unclassified: 'tek',
  residential: 'sehir', service: 'sehir', ramp: 'sehir', turn_channel: 'sehir',
};

// Etiket yoksa varsayılan limit (Türkiye, otomobil). "tahmini" işaretlenir.
export const VARSAYILAN_LIMIT = { otoyol: 120, bolunmus: 110, tek: 90, sehir: 50 };

// Yüzeyin yuvarlanma direncine çarpanı. [L] mertebe, [T] kesin değerler.
export const YUZEY_CRR = {
  paved_smooth: 1.00, paved: 1.06, paved_rough: 1.18, compacted: 1.35,
  dirt: 1.60, gravel: 1.50, path: 1.80, impassable: 2.00,
};

export const AYAR = {
  enKisaBolumKm: 3,
  enUzunBolumKm: 60,
  rakimAdimM: 200,
  rakimEsigiM: 10,
  gecisEsigiKmh: 20,
  yogunlukEsigi: 8,
  rejenVerimi: 0.70,        // rota katmanının kaba değeri; fizik.js ayrıntılı modeli tutar
  egimTavani: 12,           // [T] %12 üstü kenar eğimi veri hatası sayılır
  donelHizKmh: 25,          // [T] döner kavşaktan geçiş hızı
  donelSaniye: 12,          // [T] döner kavşak başına ek süre
  isikHizKmh: 0,            // [T] ışıkta tam duruş
  isikSaniye: 25,           // [T] ortalama kırmızı ışık beklemesi
  kavsakHizKmh: 45,         // [T] ana yolda düz geçilen kavşakta yavaşlama
  kavsakSaniye: 5,
  virajEsigi: 3,            // [T] bu ve üstü curvature hız düşürür
  tunelRuzgarKat: 0.15,     // [T] tünelde rüzgâr etkisi neredeyse yok
  kopruRuzgarKat: 1.30,     // [T] viyadükte rüzgâr daha sert
};

// Valhalla curvature (0-15) → hız çarpanı. [T]
export const virajHizKat = c => (c <= AYAR.virajEsigi ? 1 : Math.max(0.6, 1 - 0.035 * (c - AYAR.virajEsigi)));

const tipBul = s => SINIF_TIP[s] || 'tek';
const sayi = (x, v = 0) => (Number.isFinite(Number(x)) ? Number(x) : v);

// Ham kenarlardan tam parametre profili.
export function profil(edges) {
  let km = 0;
  return edges.map(e => {
    const tip = tipBul(e.road_class);
    const etiketli = sayi(e.speed_limit) > 0;
    const limit = etiketli ? sayi(e.speed_limit) : VARSAYILAN_LIMIT[tip];
    const bas = km; const uz = sayi(e.length); km += uz;
    const kesisen = Array.isArray(e.kesisen) ? e.kesisen
      : Array.isArray(e.end_node?.intersecting_edges) ? e.end_node.intersecting_edges.map(x => x.road_class) : [];
    const tavan = AYAR.egimTavani;
    const up = sayi(e.up ?? e.max_upward_grade), down = sayi(e.down ?? e.max_downward_grade);
    return {
      tip, limit, etiketli, km: uz, bas, son: km,
      akis: sayi(e.speed) > 0 ? sayi(e.speed) : limit,
      yogunluk: sayi(e.density),
      yuzey: e.surface || 'paved_smooth',
      crrKat: YUZEY_CRR[e.surface] || 1,
      serit: sayi(e.lanes ?? e.lane_count, 2),
      ucretli: !!e.toll, tunel: !!e.tunnel, kopru: !!e.bridge, donel: !!e.roundabout,
      isik: !!(e.signal ?? e.traffic_signal ?? e.end_node?.traffic_signal),
      kavsak: (e.nodeType ?? e.end_node?.type) === 'street_intersection' && kesisen.length > 0,
      kesisen, viraj: sayi(e.curvature), kullanim: e.use || 'road',
      yon: sayi(e.h0 ?? e.begin_heading),
      egimYukari: Math.min(tavan, Math.max(0, up)),
      egimAsagi: Math.max(-tavan, Math.min(0, down)),
      egimAgirlikli: Math.max(-tavan, Math.min(tavan, sayi(e.wgrade ?? e.weighted_grade))),
      egimSuphe: Math.abs(up) > tavan || Math.abs(down) > tavan,
      rakim: sayi(e.ele ?? e.mean_elevation, 0),
    };
  });
}

// Valhalla polyline6 çözücü: [[enlem, boylam], ...]. Bölüm koordinatları buradan gelir;
// hava tahmini ve istasyon araması bölümün gerçek yerini bilmek zorunda.
export function cozPolyline(str, hassasiyet = 1e6) {
  const nokta = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    let sonuc = 0, kaydir = 0, b;
    do { b = str.charCodeAt(i++) - 63; sonuc |= (b & 0x1f) << kaydir; kaydir += 5; } while (b >= 0x20);
    lat += (sonuc & 1) ? ~(sonuc >> 1) : (sonuc >> 1);
    sonuc = 0; kaydir = 0;
    do { b = str.charCodeAt(i++) - 63; sonuc |= (b & 0x1f) << kaydir; kaydir += 5; } while (b >= 0x20);
    lon += (sonuc & 1) ? ~(sonuc >> 1) : (sonuc >> 1);
    nokta.push([lat / hassasiyet, lon / hassasiyet]);
  }
  return nokta;
}

// İki nokta arası büyük daire mesafesi (km).
export function mesafeKm(a, b) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (b[0] - a[0]) * d, dLon = (b[1] - a[1]) * d;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Şekil üzerinde verilen km'deki noktayı bulur.
export function noktaKmde(nokta, hedefKm) {
  if (!nokta?.length) return null;
  let km = 0;
  for (let i = 1; i < nokta.length; i++) {
    const d = mesafeKm(nokta[i - 1], nokta[i]);
    if (km + d >= hedefKm) {
      const t = d === 0 ? 0 : (hedefKm - km) / d;
      return [nokta[i - 1][0] + (nokta[i][0] - nokta[i - 1][0]) * t,
              nokta[i - 1][1] + (nokta[i][1] - nokta[i - 1][1]) * t];
    }
    km += d;
  }
  return nokta[nokta.length - 1];
}

// Açıların dairesel ağırlıklı ortalaması (0-360); rüzgâr izdüşümü için.
export function ortalamaYon(acilar, agirliklar) {
  let x = 0, y = 0;
  acilar.forEach((a, i) => {
    const w = agirliklar ? agirliklar[i] : 1, r = a * Math.PI / 180;
    x += w * Math.cos(r); y += w * Math.sin(r);
  });
  if (x === 0 && y === 0) return 0;
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Akış hızındaki çukurlar: düşüp geri yükselen her yer bir yavaşlama-hızlanma olayı.
export function gecisler(p, esik = AYAR.gecisEsigiKmh) {
  const g = [];
  for (let i = 1; i < p.length; i++) {
    if (p[i - 1].akis - p[i].akis < esik) continue;
    const dusuk = p[i].akis;
    let j = i;
    while (j + 1 < p.length && p[j + 1].akis <= dusuk) j++;
    if (!p[j + 1]) break; // kalıcı düşüş, çukur değil
    const yuksek = Math.min(p[i - 1].akis, p[j + 1].akis);
    if (yuksek - dusuk >= esik) g.push({ km: p[i].bas, yuksek, dusuk, uzunlukKm: p[j].son - p[i].bas, tur: 'akis' });
    i = j;
  }
  return g;
}

// Yoğunluk dizisinden yerleşim geçişi kestirimi (limit etiketi olmayan devlet yolları için).
export function yerlesimGecisleri(p, esikYogunluk = AYAR.yogunlukEsigi) {
  const g = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i].yogunluk < esikYogunluk) continue;
    let j = i, uz = 0;
    while (j < p.length && p[j].yogunluk >= esikYogunluk) { uz += p[j].km; j++; }
    if (uz >= 0.3) {
      const yuksek = Math.min(p[Math.max(0, i - 1)].akis, p[Math.min(p.length - 1, j)].akis);
      const dusuk = Math.min(...p.slice(i, j).map(x => x.akis), 50);
      if (yuksek - dusuk >= AYAR.gecisEsigiKmh) g.push({ km: p[i].bas, yuksek, dusuk, uzunlukKm: uz, tur: 'yerlesim', tahmini: true });
    }
    i = j;
  }
  return g;
}

// Altyapı olayları: döner kavşak, ışık, kesişme. Her biri yavaşlama-hızlanma ve süre kaybı.
export function altyapiOlaylari(p) {
  const o = [];
  for (const e of p) {
    const v = Math.min(e.akis, e.limit);
    if (e.donel) o.push({ km: e.son, yuksek: v, dusuk: AYAR.donelHizKmh, saniye: AYAR.donelSaniye, tur: 'donel' });
    else if (e.isik) o.push({ km: e.son, yuksek: v, dusuk: AYAR.isikHizKmh, saniye: AYAR.isikSaniye, tur: 'isik' });
    else if (e.kavsak && e.tip !== 'otoyol') o.push({ km: e.son, yuksek: v, dusuk: AYAR.kavsakHizKmh, saniye: AYAR.kavsakSaniye, tur: 'kavsak' });
  }
  return o;
}

// Bir yavaşlama-hızlanma olayının net enerji bedeli (kWh).
export function gecisKwh(yuksek, dusuk, kutle, verim, rejen = AYAR.rejenVerimi) {
  const v1 = yuksek / 3.6, v2 = Math.max(0, dusuk) / 3.6;
  const dKE = 0.5 * kutle * (v1 * v1 - v2 * v2) / 3.6e6;
  return Math.max(0, dKE * (1 / verim - rejen));
}

// Yükseklik profilini sabit adıma yeniden örnekler (düzensiz DEM örneklemesini eler).
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

// Tünel ve viyadükte DEM araziyi gösterir, yolu değil. Bu aralıklarda uçlar arasında
// doğrusal geçilir; sahte tırmanış ve iniş silinir.
export function maskeleUygula(h, maskeler) {
  if (!maskeler?.length || !h.length) return h;
  const y = h.map(x => [...x]);
  for (const [basKm, sonKm] of maskeler) {
    const b = basKm * 1000, s = sonKm * 1000;
    const i0 = y.findIndex(x => x[0] >= b);
    let i1 = y.findIndex(x => x[0] > s);
    if (i0 < 0) continue;
    if (i1 < 0) i1 = y.length - 1;
    if (i1 - i0 < 2) continue;
    const [m0, e0] = y[i0], [m1, e1] = y[i1];
    for (let i = i0 + 1; i < i1; i++) y[i][1] = e0 + (e1 - e0) * (y[i][0] - m0) / (m1 - m0);
  }
  return y;
}

// Bir km aralığındaki tırmanış ve inişi histerezisle ayırır.
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
  if (ref !== null && sonY !== null) { if (sonY > ref) cikis += sonY - ref; else inis += ref - sonY; }
  return { cikis, inis, net: ilk === null ? 0 : sonY - ilk };
}

// Ardışık kenarları tek kimlikte birleştirir, kısa parçaları yutar, uzunları böler.
function bolumSinirlari(p, enKisa, enUzun) {
  const ham = [];
  for (const e of p) {
    const s = ham[ham.length - 1];
    if (s && s.tip === e.tip && s.limit === e.limit) { s.son = e.son; s.etiketli = s.etiketli && e.etiketli; }
    else ham.push({ tip: e.tip, limit: e.limit, etiketli: e.etiketli, bas: e.bas, son: e.son });
  }
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
      ham.splice(i, 1); degisti = true; break;
    }
  }
  const parcali = [];
  for (const s of ham) {
    const uz = s.son - s.bas, adet = Math.max(1, Math.ceil(uz / enUzun));
    for (let k = 0; k < adet; k++) parcali.push({ ...s, bas: s.bas + uz * k / adet, son: s.bas + uz * (k + 1) / adet });
  }
  return parcali;
}

// Ana işlev: Valhalla verisinden tam parametreli model bölümleri.
// shape verilirse (Valhalla polyline6) her bölüme orta noktasının koordinatı eklenir.
export function bolumle(edges, ham_h, opt = {}) {
  const { kutle = 2150, verim = 0.9, enKisa = AYAR.enKisaBolumKm, enUzun = AYAR.enUzunBolumKm, shape = null } = opt;
  const sekil = typeof shape === 'string' ? cozPolyline(shape) : shape;
  const p = profil(edges);
  if (!p.length) return { bolumler: [], olaylar: [], toplamKm: 0, ozet: {} };

  const maskeler = [];
  for (const e of p) if (e.tunel || e.kopru) {
    const son = maskeler[maskeler.length - 1];
    if (son && Math.abs(son[1] - e.bas) < 0.05) son[1] = e.son; else maskeler.push([e.bas, e.son]);
  }
  const h = maskeleUygula(yenidenOrnekle(ham_h), maskeler);

  const hizDipleri = gecisler(p);
  const yerlesim = yerlesimGecisleri(p).filter(y => !hizDipleri.some(x => Math.abs(x.km - y.km) < 1));
  const altyapi = altyapiOlaylari(p);
  const olaylar = [...hizDipleri, ...yerlesim, ...altyapi].sort((a, b) => a.km - b.km);

  const bolumler = bolumSinirlari(p, enKisa, enUzun).map((s, i) => {
    const uzB = s.son - s.bas;
    const ic = p.filter(e => e.son > s.bas && e.bas < s.son);
    const pay = e => Math.max(0, Math.min(e.son, s.son) - Math.max(e.bas, s.bas));
    const uz = ic.reduce((t, e) => t + pay(e), 0) || 1;
    const agirlikli = f => ic.reduce((t, e) => t + f(e) * pay(e), 0) / uz;
    const r = rakimProfili(h, s.bas, s.son);
    const io = olaylar.filter(x => x.km >= s.bas && x.km < s.son);
    const tunelKm = ic.filter(e => e.tunel).reduce((t, e) => t + pay(e), 0);
    const kopruKm = ic.filter(e => e.kopru).reduce((t, e) => t + pay(e), 0);
    const viraj = agirlikli(e => e.viraj);
    // Hız çarpanı kenar kenar hesaplanıp ağırlıklı toplanır: kısa ama keskin viraj,
    // uzun düz kesimin ortalamasında kaybolmasın.
    const virajKat = agirlikli(e => virajHizKat(e.viraj));
    const orta = sekil ? noktaKmde(sekil, (s.bas + s.son) / 2) : null;
    return {
      enlem: orta ? +orta[0].toFixed(5) : null, boylam: orta ? +orta[1].toFixed(5) : null,
      no: i + 1, tip: s.tip, limit: s.limit, tahminiLimit: !s.etiketli,
      basKm: +s.bas.toFixed(1), km: +uzB.toFixed(1),
      yolYonu: Math.round(ortalamaYon(ic.map(e => e.yon), ic.map(pay))),
      rakim: Math.round(agirlikli(e => e.rakim)),
      cikis: Math.round(r.cikis), inis: Math.round(r.inis), dh: Math.round(r.net),
      egimYukari: +agirlikli(e => e.egimYukari).toFixed(2),
      egimAsagi: +agirlikli(e => e.egimAsagi).toFixed(2),
      egimSuphe: ic.some(e => e.egimSuphe),
      yuzey: ic.reduce((a, e) => (pay(e) > pay(a) ? e : a), ic[0]).yuzey,
      crrKat: +agirlikli(e => e.crrKat).toFixed(3),
      serit: +agirlikli(e => e.serit).toFixed(1),
      viraj: +viraj.toFixed(1), virajHizKat: +virajKat.toFixed(3),
      tunelKm: +tunelKm.toFixed(1), kopruKm: +kopruKm.toFixed(1),
      ucretliKm: +ic.filter(e => e.ucretli).reduce((t, e) => t + pay(e), 0).toFixed(1),
      ruzgarKat: +(1 - tunelKm / uzB * (1 - AYAR.tunelRuzgarKat) + kopruKm / uzB * (AYAR.kopruRuzgarKat - 1)).toFixed(3),
      donel: io.filter(x => x.tur === 'donel').length,
      isik: io.filter(x => x.tur === 'isik').length,
      kavsak: io.filter(x => x.tur === 'kavsak').length,
      yerlesimGecisi: io.filter(x => x.tur === 'yerlesim').length,
      akisOrani: +Math.min(1.05, Math.max(0.45, agirlikli(e => e.akis) / s.limit)).toFixed(3),
      gecisSayisi: io.length,
      gecisKayipKwh: +io.reduce((t, x) => t + gecisKwh(x.yuksek, x.dusuk, kutle, verim), 0).toFixed(2),
      olayDk: +(io.reduce((t, x) => t + (x.saniye || 0), 0) / 60).toFixed(1),
      hiz: Math.round(s.limit * virajKat),
    };
  });

  const T = f => +bolumler.reduce((t, b) => t + f(b), 0).toFixed(1);
  return {
    bolumler, olaylar, toplamKm: +p[p.length - 1].son.toFixed(1),
    ozet: {
      cikis: T(b => b.cikis), inis: T(b => b.inis), ucretliKm: T(b => b.ucretliKm),
      tunelKm: T(b => b.tunelKm), kopruKm: T(b => b.kopruKm),
      donel: T(b => b.donel), isik: T(b => b.isik), kavsak: T(b => b.kavsak),
      olayDk: T(b => b.olayDk), gecisKayipKwh: T(b => b.gecisKayipKwh),
      tahminiLimitKm: T(b => (b.tahminiLimit ? b.km : 0)),
    },
  };
}
