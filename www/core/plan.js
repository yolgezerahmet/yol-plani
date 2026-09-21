// Durak planlayıcı: bölümler + rota üstü istasyonlar → şarj durakları, batarya profili, yedekler.
//
// Yaklaşım: önce her bölümün enerjisi (hava dahil) hesaplanır, rota boyunca birikimli enerji
// eğrisi kurulur. Sonra açgözlü yürüyüş: bulunduğun yerden varışa yetiyorsa bitir; yetmiyorsa
// rezervin üstünde ulaşılabilen istasyonların ileri kısmından en güçlüsünü seç, yalnızca
// gerektiği kadar (en fazla %80'e) şarj et. %80 üstü E-GMP'de yavaş; iki kısa durak bir uzun
// duraktan hızlıdır.
import { bolumHesap, sarjDk, sarjSimule } from './model.js';
import { TERMAL, surusIsinmasi, onIsitma as onIsitmaHesap } from './termal.js';
import { yedekZinciri } from './istasyon.js';

export const PLAN_VARSAYILAN = { minKw: 50, sarjUst: 80, atlamaUst: 90, pay: 3, ileriOran: 0.75, enFazlaDurak: 8 };

const HAVA_ALANLARI = ['T', 'nem', 'basincPa', 'ruzgarHizi', 'ruzgarYonu', 'yagisMm', 'yagis', 'kar', 'gunes'];

// Bölüme kendi havası varsa (havaUygula atar) koşullara o işlenir; yoksa genel koşullar.
export function bolumKosulu(k, b) {
  const kb = { ...k };
  for (const a of HAVA_ALANLARI) if (b[a] != null) kb[a] = b[a];
  if (b.yagis != null) kb.yagis = !!b.yagis;
  if (b.kar != null) kb.kar = !!b.kar;
  return kb;
}

// Birikimli enerji eğrisi. hizKat: hız senaryosu (0,9 = limitin %90'ı).
export function enerjiEgrisi(bolumler, k, { hizKat = 1, soc = 60 } = {}) {
  const km = [0], kwh = [0];
  let dk = 0;
  const satir = bolumler.map(b => {
    const hiz = Math.round((b.hiz || 90) * hizKat);
    const h0 = bolumHesap(b, hiz, bolumKosulu(k, b), soc);
    // OBD'den gelen araca özel düzeltme (ölçülen / model); yoksa 1.
    const h = { ...h0, kwh: h0.kwh * (k.tuketimKat ?? 1) };
    km.push(km[km.length - 1] + b.km);
    kwh.push(kwh[kwh.length - 1] + h.kwh);
    dk += h.dk;
    return { ...h, hiz, basKm: km[km.length - 2], km: b.km };
  });
  const toplamKm = km[km.length - 1];
  return { km, kwh, satir, surusDk: dk, toplamKm, toplamKwh: kwh[kwh.length - 1],
           ortWh: toplamKm > 0 ? kwh[kwh.length - 1] / toplamKm * 1000 : 180 };
}

// Rotanın x km'sine kadar birikimli enerji (bölüm içinde doğrusal).
export function kwhKmde(e, x) {
  if (x <= 0) return 0;
  if (x >= e.toplamKm) return e.toplamKwh;
  let i = 1;
  while (e.km[i] < x) i++;
  const t = (x - e.km[i - 1]) / (e.km[i] - e.km[i - 1] || 1);
  return e.kwh[i - 1] + (e.kwh[i] - e.kwh[i - 1]) * t;
}
export const aralikKwh = (e, a, b) => kwhKmde(e, b) - kwhKmde(e, a);

const socDus = (kwh, kap) => kwh / kap * 100;

// Ana planlayıcı.
// istasyonlar: rotaUstunde() çıktısı — { rotaKm, sapmaKm, kw, guven, ... }
// k: araç + koşullar (kap, soc0, rezerv, sabitdk, sarjOlcek)
// opt.varisSoc: varışta istenen batarya (varsayılan k.rezerv)
export function durakPlanla(bolumler, istasyonlar, k, opt = {}) {
  const o = { ...PLAN_VARSAYILAN, ...opt };
  const varisSoc = o.varisSoc ?? k.rezerv;
  const e = enerjiEgrisi(bolumler, k, { hizKat: o.hizKat ?? 1 });
  const L = e.toplamKm, kap = k.kap;
  const sapmaKwh = s => 2 * s.sapmaKm * e.ortWh / 1000;
  const aday = istasyonlar.filter(s => s.kw >= o.minKw && s.rotaKm > 0 && s.rotaKm < L);

  const duraklar = [];
  let pos = 0, soc = k.soc0, sorun = null;

  while (duraklar.length <= o.enFazlaDurak) {
    const bitis = soc - socDus(aralikKwh(e, pos, L), kap);
    if (bitis >= varisSoc) break;

    const ulasilan = aday
      .filter(s => s.rotaKm > pos + 5)
      .map(s => ({ s, varis: soc - socDus(aralikKwh(e, pos, s.rotaKm) + sapmaKwh(s), kap) }))
      .filter(x => x.varis >= k.rezerv);
    if (!ulasilan.length) {
      sorun = { tur: 'menzil', km: +pos.toFixed(1),
                mesaj: `${Math.round(pos)}. km'den sonra rezervin üstünde ulaşılabilen hızlı şarj istasyonu yok` };
      break;
    }
    const enUzak = Math.max(...ulasilan.map(x => x.s.rotaKm));
    const esik = pos + o.ileriOran * (enUzak - pos);
    const havuz = ulasilan.filter(x => x.s.rotaKm >= esik);
    havuz.sort((a, b) => (b.s.kw * (b.s.guven ?? 1)) - (a.s.kw * (a.s.guven ?? 1)) || b.s.rotaKm - a.s.rotaKm);
    const { s, varis } = havuz[0];

    const kalanIhtiyac = socDus(aralikKwh(e, s.rotaKm, L) + sapmaKwh(s) / 2, kap) + varisSoc + o.pay;
    // Varışa %80'in biraz üstü yetiyorsa (≤ %90) bir durak daha eklemek yerine burada fazladan
    // şarj edilir: %80–90 arası yavaş ama yeni durağın sabit süresi ve sapmasından kısadır.
    const ust = kalanIhtiyac <= o.atlamaUst ? o.atlamaUst : o.sarjUst;
    const hedef = Math.max(varis, Math.min(ust, Math.ceil(kalanIhtiyac)));
    const dk = hedef > varis ? sarjDk(varis, hedef, s.kw, kap, k.sarjOlcek || 1) + (k.sabitdk ?? 4) : 0;
    duraklar.push({
      no: duraklar.length + 1, istasyon: s, km: s.rotaKm,
      varisSoc: +varis.toFixed(1), hedefSoc: hedef,
      ekKwh: +((hedef - varis) / 100 * kap).toFixed(1), dk: Math.round(dk),
      kalanKwh: varis / 100 * kap, sonrakiKwh: hedef / 100 * kap,
      sonDurak: hedef >= kalanIhtiyac - 0.5,
    });
    pos = s.rotaKm;
    soc = hedef - socDus(sapmaKwh(s) / 2, kap);
  }
  if (!sorun && duraklar.length > o.enFazlaDurak) sorun = { tur: 'cok-durak', mesaj: 'Durak sayısı sınırı aşıldı' };

  const varis = soc - socDus(aralikKwh(e, pos, L), kap);
  // Yedek, asıl durağa yakın olmalı: yola çıkar çıkmaz karşılaşılan istasyon, 150 km ileride
  // kapalı çıkan durağın gerçek alternatifi değildir. Önceki duraktan bu durağa yolun ikinci
  // yarısı ve sonrası aranır; asıl durağa yakınlık, sonra güç sıralar.
  const yedekli = (duraklar.length ? yedekZinciri(duraklar, aday, e.ortWh, { rezervKwh: k.rezerv / 100 * kap, enFazla: 12 }) : [])
    .map((d, n) => {
      const once = n === 0 ? 0 : duraklar[n - 1].km;
      const yedekler = d.yedekler
        .filter(y => y.rotaKm >= once + 0.5 * (d.km - once))
        .sort((a, b) => Math.abs(a.rotaKm - d.km) - Math.abs(b.rotaKm - d.km) || b.kw - a.kw)
        .slice(0, 3);
      return { ...d, yedekler, yedekVar: yedekler.length > 0 };
    });
  const son = yedekli.length ? yedekli : duraklar;
  const termal = termalGecis(e, bolumler, son, k, o);
  const sarjDkToplam = son.reduce((t, d) => t + d.dk, 0);
  return {
    duraklar: son, termal,
    varisSoc: +varis.toFixed(1),
    surusDk: Math.round(e.surusDk), sarjDk: sarjDkToplam,
    toplamDk: Math.round(e.surusDk + sarjDkToplam),
    toplamKm: +L.toFixed(1), toplamKwh: +e.toplamKwh.toFixed(1), ortWh: Math.round(e.ortWh),
    profil: socProfili(e, k.soc0, son, kap),
    enerji: e, sorun,
  };
}

// Batarya profili: [km, soc] noktaları; durakta dikey sıçrama. Grafik içindir;
// istasyona sapma enerjisi durak noktasında düşülür, böylece plan sayılarıyla tutarlı kalır.
export function socProfili(e, soc0, duraklar, kap) {
  const kmler = [...new Set([...e.km, ...duraklar.map(d => d.km)])].sort((a, b) => a - b);
  const noktalar = [];
  let soc = soc0, onceki = 0, di = 0;
  for (const x of kmler) {
    soc -= socDus(aralikKwh(e, onceki, x), kap);
    while (di < duraklar.length && Math.abs(duraklar[di].km - x) < 1e-6) {
      const d = duraklar[di++];
      noktalar.push([+x.toFixed(1), d.varisSoc]);
      noktalar.push([+x.toFixed(1), d.hedefSoc]);
      soc = d.hedefSoc;
    }
    if (!noktalar.length || noktalar[noktalar.length - 1][0] !== +x.toFixed(1)) noktalar.push([+x.toFixed(1), +soc.toFixed(1)]);
    onceki = x;
  }
  return noktalar;
}

// Isıl geçiş: duraklar seçildikten sonra hücre sıcaklığı rota boyunca yürütülür, her durağın
// şarj süresi sıcaklığa göre yeniden hesaplanır. Ön ısıtma açıksa durağa varmadan hedefe ısıtılır;
// ısıtıcı enerjisi bataryadan gider ve varış SoC'sinden düşülür. Her iki senaryo da raporlanır ki
// kullanıcı ön ısıtmanın kaç dakika kazandırdığını görsün.
// o.bataryaT0: çıkıştaki hücre sıcaklığı (kapalı otoparkta gece geçirdiyse garaj sıcaklığı).
// o.onIsitma: varsayılan açık. o.sicaklikTablosu: OBD kalibrasyonundan gelen tablo.
export function termalGecis(e, bolumler, duraklar, k, o = {}) {
  const t = { ...TERMAL, ...(k.termal || {}) };
  const ortam = i => bolumler[Math.min(i, bolumler.length - 1)]?.T ?? k.T;
  let T = o.bataryaT0 ?? ortam(0), km = 0, i = 0, kazanc = 0;
  const onIsitmaAcik = o.onIsitma !== false;
  const sat = e.satir;
  for (const d of duraklar) {
    // Durağa kadar olan bölümleri (ve bölüm parçalarını) sür.
    while (i < sat.length && km + sat[i].km <= d.km + 1e-6) {
      T = surusIsinmasi(T, ortam(i), sat[i].kwh, sat[i].dk, t); km += sat[i].km; i++;
    }
    if (i < sat.length && d.km > km) {
      const oran = (d.km - km) / sat[i].km;
      T = surusIsinmasi(T, ortam(i), sat[i].kwh * oran, sat[i].dk * oran, t);
    }
    const dis = ortam(i), Tvaris = +T.toFixed(1);
    const isitma = onIsitmaAcik ? onIsitmaHesap(T, dis, t) : { dk: 0, kwh: 0, T };
    const hizKmh = sat[Math.max(0, i - 1)] ? sat[Math.max(0, i - 1)].km / (sat[Math.max(0, i - 1)].dk / 60) : 90;
    const varis = Math.max(0, d.varisSoc - isitma.kwh / k.kap * 100);
    const ortak = { olcek: k.sarjOlcek || 1, ortamT: dis, termal: t, tablo: o.sicaklikTablosu };
    const sicakli = sarjSimule(varis, d.hedefSoc, d.istasyon.kw, k.kap, { ...ortak, T: isitma.T });
    const isitmasiz = sarjSimule(d.varisSoc, d.hedefSoc, d.istasyon.kw, k.kap, { ...ortak, T: Tvaris });
    const sabit = k.sabitdk ?? 4;
    d.bataryaT = onIsitmaAcik ? isitma.T : Tvaris;
    d.bataryaTVaris = Tvaris;
    d.ortamT = dis;
    d.onIsitma = isitma.dk ? { dk: isitma.dk, kwh: isitma.kwh, baslaKm: Math.max(0, Math.round(d.km - isitma.dk / 60 * hizKmh)) } : null;
    d.varisSoc = +varis.toFixed(1);
    d.dk = Math.round(sicakli.dk + sabit);
    d.dkIsitmasiz = Math.round(isitmasiz.dk + sabit);
    d.sicaklikKaybiDk = Math.max(0, Math.round(sicakli.sicaklikKaybiDk));
    kazanc += d.dkIsitmasiz - d.dk;
    T = sicakli.T;
  }
  return { bataryaT0: +(o.bataryaT0 ?? ortam(0)).toFixed(1), onIsitma: onIsitmaAcik, onIsitmaKazanciDk: Math.max(0, kazanc) };
}
