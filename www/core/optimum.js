// En iyi durak planı: dinamik programlama.
//
// Açgözlü planlayıcı her adımda yerel olarak iyi görünen istasyonu seçer ve hep %80'e kadar doldurur.
// Bu, toplamda en kısa yolculuğu garanti etmez: bazen güçlü bir istasyonda %60'a kadar kısa şarj,
// bazen bir durağı atlamak için %88'e kadar uzun şarj daha iyidir. Burada bütün istasyon ve
// batarya düzeyi birleşimleri birlikte değerlendirilir.
//
// Durum: (düğüm, ayrılış SoC'si, %1 adım). Düğümler: çıkış, rota üstü istasyonlar, varış.
// Amaç (dakika): şarj süresi + durak başına sabit süre + sapma süresi + (isteğe bağlı) TL × zaman değeri.
// Sürüş süresi rota boyunca aynıdır; karşılaştırmada sabit terimdir, toplamda raporlanır.
//
// Hız: dilim başına şarj süresi, istasyonun o sıcaklıktaki değil nominal eğrisiyle hesaplanır;
// seçim sonrası ısıl geçiş (planiTamamla) süreleri sıcaklığa göre yeniden hesaplar.
// Karmaşıklık: N düğüm × erişilen düğüm × 101 düzey; ~150 düğümde milisaniyeler.
import { enerjiEgrisi, aralikKwh, planiTamamla, PLAN_VARSAYILAN } from './plan.js';
import { sarjGucu } from './model.js';
import { durakFiyati } from './maliyet.js';

export const OPT_VARSAYILAN = {
  ...PLAN_VARSAYILAN,
  enYuksekSoc: 95,        // tek durakta en fazla; %80 üstü yavaş ama bir durağı atlatabilir
  kovaKm: 8,              // aynı 8 km'lik dilimde en fazla ...
  kovaBasi: 3,            // ... 3 aday (güce göre); hesap süresini sınırlar
  sapmaHizKmh: 40,        // istasyona sapma sürüşü
  dayanikli: true,        // her durakta "çalışmazsa yedeğe ulaşırım" koşulu
  yedekRezerv: 3,         // yedeğe en az bu yüzdeyle varılmalı
  yedekMenzilKm: 80,      // yedek en çok bu kadar ileride aranır
  arizaSabitDk: 10,       // bozuk istasyonda kaybedilen süre (deneme, uygulama, yeniden yola çıkış) [T]
  olcumler: [],           // kendi şarj ölçümlerin (olcum.js); düşük güç veren istasyonun arıza olasılığı artar
  saatTl: null,           // zamanın TL değeri (saatlik); null → yalnız süre
  fiyat: {},              // kullanıcı fiyatları (maliyet.js biçimi)
};

// Bir istasyonda 0'dan s'ye birikimli şarj süresi (dk), %1 adımlarla. Fark = şarj süresi.
function birikimliSure(kw, kap, olcek) {
  const C = new Float64Array(101);
  for (let s = 1; s <= 100; s++) C[s] = C[s - 1] + kap / 100 / Math.min(sarjGucu(s - 0.5, olcek), kw * 0.93) * 60;
  return C;
}

// İstasyonun o an işe yaramama olasılığı [T]. Dayanak: Rempel ve ark. (2023), halka açık DC soketlerin
// ~%27'si çalışmıyor (ABD, Körfez Bölgesi); Türkiye için ölçüm yok, kendi kayıtlarımızla düzeltilecek.
// Soketler bağımsız sayılır; saha geneli nedenler (enerji, ağ, giriş kapalı) için %3 taban eklenir.
export const SOKET_ARIZA = 0.25, SAHA_ARIZA = 0.03;
export function arizaOlasiligi(s, olcumler = []) {
  const n = Math.max(1, Math.min(8, s.soketSayisi || 1));
  let p = 1 - (1 - SAHA_ARIZA) * (1 - Math.pow(SOKET_ARIZA, n));
  const son = olcumler.filter(o => o.istasyonNo === s.no).sort((a, z) => z.bas - a.bas)[0];
  if (son) p = son.dusuk ? Math.min(0.6, p * 2) : p * 0.5;       // kendi ölçümün: beklenenin altındaysa kötü, değilse iyi işaret
  return +p.toFixed(3);
}

// Aynı dilimde çok sayıda istasyon varsa en güçlüleri kalır (güven ağırlıklı).
export function adaylariSeyrelt(ist, kovaKm, kovaBasi) {
  const kova = new Map();
  for (const s of ist) {
    const b = Math.floor(s.rotaKm / kovaKm);
    if (!kova.has(b)) kova.set(b, []);
    kova.get(b).push(s);
  }
  const r = [];
  for (const l of kova.values()) r.push(...l.sort((a, z) => z.kw * (z.guven ?? 1) - a.kw * (a.guven ?? 1) || a.sapmaKm - z.sapmaKm).slice(0, kovaBasi));
  return r.sort((a, z) => a.rotaKm - z.rotaKm);
}

export function durakOptimum(bolumler, istasyonlar, k, opt = {}) {
  const o = { ...OPT_VARSAYILAN, ...opt };
  const varisSoc = o.varisSoc ?? k.rezerv;
  const e = enerjiEgrisi(bolumler, k, { hizKat: o.hizKat ?? 1 });
  const L = e.toplamKm, kap = k.kap, olcek = k.sarjOlcek || 1, sabit = k.sabitdk ?? 4;
  const pct = kwh => kwh / kap * 100;
  const aday = istasyonlar.filter(s => s.kw >= o.minKw && s.rotaKm > 0 && s.rotaKm < L);
  const secilebilir = adaylariSeyrelt(aday, o.kovaKm, o.kovaBasi);

  // Düğümler: 0 = çıkış, 1..n = istasyon, n+1 = varış
  const dugum = [{ km: 0 }, ...secilebilir.map(s => ({ km: s.rotaKm, s })), { km: L }];
  const n = dugum.length, INF = Infinity;
  const lambda = o.saatTl ? 60 / o.saatTl : 0;              // TL → dakika
  const ek = dugum.map(d => {
    if (!d.s) return null;
    const sapKwh = 2 * d.s.sapmaKm * e.ortWh / 1000;
    const f = durakFiyati(d.s, o.fiyat);
    return { sapKwh, sapDk: 2 * d.s.sapmaKm / o.sapmaHizKmh * 60, C: birikimliSure(d.s.kw, kap, olcek), tl: f.tl };
  });

  // Arıza yedeği: j çalışmazsa, j'ye varılan bataryayla ulaşılabilecek en yakın başka istasyon (ileride ya da
  // aynı yerde). Koşul: varış − yedeğe gereken ≥ yedekRezerv. Beklenen ek süre amaç fonksiyonuna girer;
  // böylece çok soketli ve yakınında seçenek olan duraklar öne çıkar.
  const yedek = dugum.map((d, j) => {
    if (!d.s) return null;
    let en = null;
    for (const s2 of aday) {
      // Geriye en çok 15 km dönülür (otoyolda geri dönüş pahalıdır); ileride yedekMenzilKm'ye kadar bakılır.
      if (s2.id === d.s.id || s2.rotaKm < d.km - 15 || s2.rotaKm > d.km + o.yedekMenzilKm) continue;
      const yol = s2.rotaKm >= d.km ? aralikKwh(e, d.km, s2.rotaKm) : (d.km - s2.rotaKm) * e.ortWh / 1000 * 1.1;
      const gerek = pct(yol + ek[j].sapKwh / 2 + s2.sapmaKm * e.ortWh / 1000);
      if (!en || gerek < en.gerek) en = { s: s2, gerek };
    }
    const p = arizaOlasiligi(d.s, o.olcumler);
    const ekDk = en ? o.arizaSabitDk + 2 * en.s.sapmaKm / o.sapmaHizKmh * 60 : 60;   // yedeksiz arıza: çekici/yavaş şarj, kaba 60 dk
    return { ...en, p, beklenenDk: p * ekDk };
  });
  const coz = dayanikli => {
  // D[j][t]: j'den t SoC ile ayrılmanın en küçük maliyeti; geri izleme için kaynak tutulur.
  const D = Array.from({ length: n }, () => new Float64Array(101).fill(INF));
  const kaynak = Array.from({ length: n }, () => new Int32Array(101).fill(-1));   // i*1000 + s
  const varisDus = Array.from({ length: n }, () => new Int32Array(101).fill(-1));  // şarjdan önceki varış
  const s0 = Math.min(100, Math.floor(k.soc0));
  D[0][s0] = 0;
  let enIyiVaris = { maliyet: INF, i: -1, s: -1, varis: 0 };

  for (let j = 1; j < n; j++) {
    const dj = dugum[j], sonDugum = j === n - 1;
    const A = new Float64Array(101).fill(INF), Akaynak = new Int32Array(101).fill(-1);
    for (let i = 0; i < j; i++) {
      const di = dugum[i];
      const yolPct = pct(aralikKwh(e, di.km, dj.km));
      // Sapma enerjisinin yarısı istasyondan çıkarken, yarısı girerken harcanır.
      const cikis = i > 0 ? pct(ek[i].sapKwh / 2) : 0;
      const giris = sonDugum ? 0 : pct(ek[j].sapKwh / 2);
      const dus = yolPct + cikis + giris;
      if (dus > 100) continue;
      for (let s = 0; s <= 100; s++) {
        const c = D[i][s]; if (c === INF) continue;
        const a = s - dus;
        if (sonDugum) {
          if (a >= varisSoc - 1e-9 && c < enIyiVaris.maliyet) enIyiVaris = { maliyet: c, i, s, varis: a };
          continue;
        }
        if (a < k.rezerv - 1e-9) continue;
        if (dayanikli && !(a - (yedek[j].gerek ?? Infinity) >= o.yedekRezerv)) continue;
        const ab = Math.floor(a);                            // muhafazakâr yuvarlama
        if (c < A[ab]) { A[ab] = c; Akaynak[ab] = i * 1000 + s; }
      }
    }
    if (sonDugum) break;
    // Şarj: ayrılış t ≥ varış a; maliyet C(t)−C(a) + sabit + sapma + TL. C eklemeli olduğundan önek en küçüğüyle O(101).
    const x = ek[j], lim = Math.min(100, o.enYuksekSoc);
    let enKucuk = INF, enKucukA = -1;
    for (let t = 0; t <= lim; t++) {
      const v = A[t] - x.C[t] - lambda * x.tl * t / 100 * kap / 0.95;
      if (v < enKucuk) { enKucuk = v; enKucukA = t; }
      if (enKucukA < 0 || t === enKucukA) continue;          // şarjsız geçiş istasyonda durmak değildir
      const m = enKucuk + x.C[t] + sabit + x.sapDk + yedek[j].beklenenDk + lambda * x.tl * t / 100 * kap / 0.95;
      if (m < D[j][t]) { D[j][t] = m; kaynak[j][t] = Akaynak[enKucukA]; varisDus[j][t] = enKucukA; }
    }
  }

    return { enIyiVaris, kaynak, varisDus };
  };
  // Önce dayanıklı çözüm; yoksa koşulsuz çözüm ve açık uyarı.
  let cozum = coz(o.dayanikli), dayaniklilik = o.dayanikli ? 'tam' : 'kapali';
  if (o.dayanikli && cozum.enIyiVaris.i < 0) { cozum = coz(false); dayaniklilik = 'yok'; }
  const { enIyiVaris, kaynak, varisDus } = cozum;

  // Doğrudan varış (şarjsız) da dinamik programın içinde: i = 0.
  if (enIyiVaris.i < 0) {
    return { ...planiTamamla({ e, bolumler, duraklar: [], aday, k, o, soc: k.soc0, pos: 0,
             sorun: { tur: 'menzil', km: 0, mesaj: 'Rezerv ve varış hedefiyle ulaşılabilen bir durak dizisi bulunamadı' } }),
             yontem: 'optimum' };
  }

  // Geri izleme
  const zincir = [];
  let i = enIyiVaris.i, s = enIyiVaris.s;
  while (i > 0) {
    zincir.push({ j: i, t: s, a: varisDus[i][s] });
    const kk = kaynak[i][s]; i = Math.floor(kk / 1000); s = kk % 1000;
  }
  zincir.reverse();

  // Açgözlüyle aynı biçimde duraklar. Varış SoC'si gerçek (yuvarlanmamış) değerle yeniden yürütülür.
  let soc = k.soc0, pos = 0, onceki = null;
  const duraklar = zincir.map((z, n2) => {
    const d = dugum[z.j], st = d.s;
    const varis = soc - pct(aralikKwh(e, pos, d.km)) - (onceki ? pct(ek[onceki].sapKwh / 2) : 0) - pct(ek[z.j].sapKwh / 2);
    const hedef = z.t;
    const dk = ek[z.j].C[hedef] - ek[z.j].C[Math.max(0, Math.min(100, Math.floor(varis)))] + sabit;
    soc = hedef; pos = d.km; onceki = z.j;
    return {
      no: n2 + 1, istasyon: st, km: st.rotaKm, varisSoc: +varis.toFixed(1), hedefSoc: hedef,
      ekKwh: +((hedef - varis) / 100 * kap).toFixed(1), dk: Math.round(dk),
      kalanKwh: varis / 100 * kap, sonrakiKwh: hedef / 100 * kap, sonDurak: n2 === zincir.length - 1,
      ariza: { p: yedek[z.j].p, yedek: yedek[z.j].s || null,
               yedekVarisSoc: yedek[z.j].s ? +(varis - yedek[z.j].gerek).toFixed(1) : null,
               yedekKm: yedek[z.j].s ? +(yedek[z.j].s.rotaKm - d.km).toFixed(1) : null },
    };
  });
  const socSon = soc - (onceki ? pct(ek[onceki].sapKwh / 2) : 0);
  return planiTamamla({ e, bolumler, duraklar, aday, k, o, soc: socSon, pos,
    ek: { yontem: 'optimum', amacDk: +enIyiVaris.maliyet.toFixed(1), aday: secilebilir.length, dayaniklilik } });
}

// Hız önerisi: limitin %90–110'u arasında toplam süreyi (sürüş + şarj) karşılaştırır.
// Hızlı şarjın bol olduğu yolda biraz hızlı gitmek, seyrek olduğunda yavaşlamak kazandırır.
export function hizOnerisi(bolumler, istasyonlar, k, opt = {}, katlar = [0.9, 0.95, 1, 1.05, 1.1]) {
  const sonuc = katlar.map(h => {
    const p = durakOptimum(bolumler, istasyonlar, k, { ...opt, hizKat: h });
    return { hizKat: h, toplamDk: p.sorun ? Infinity : p.toplamDk, durak: p.duraklar.length, kwh: p.toplamKwh, varis: p.varisSoc };
  });
  const simdi = sonuc.find(x => x.hizKat === (opt.hizKat ?? 1)) || sonuc[2];
  const en = sonuc.reduce((a, b) => (b.toplamDk < a.toplamDk ? b : a));
  return { liste: sonuc, en, kazancDk: Number.isFinite(simdi.toplamDk) ? Math.round(simdi.toplamDk - en.toplamDk) : null };
}
