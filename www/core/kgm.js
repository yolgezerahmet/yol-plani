// KGM Günlük Yol Durumu Bülteni: yapım, bakım, şerit kapatma ve kapalı yollar.
// Bülten serbest metin; resmî kilometre referansı KGM kontrol kesimlerine göre, bizim rotamız
// OSM üzerinde. Bu yüzden eşleme yer adlarıyla yapılır: kayıttaki yer adlarından en az ikisi
// (ya da otoyol adının iki ucu) rotaya yakınsa kayıt "rotanda olabilir" sayılır. Kesin değildir;
// ekranda böyle söylenir.
import { mesafeKm } from './istasyon.js';

export const KGM_BULTEN = 'https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/YolDanisma/GunlukYolDurumuBulteni.aspx';

const temizle = s => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

// HTML → [{ no, metin }] ve bülten tarihi. Numaralı iki hücreli satırlar kayıttır.
export function bultenCoz(html) {
  const tarih = (html.match(/(\d{2})\.(\d{2})\.(\d{4})/) || []).slice(1);
  const kayit = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const td = (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map(temizle);
    if (td.length === 2 && /^\d+$/.test(td[0]) && td[1].length > 20) kayit.push({ no: +td[0], metin: td[1] });
  }
  return { tarih: tarih.length ? `${tarih[2]}-${tarih[1]}-${tarih[0]}` : null, kayit };
}

const kucuk = s => s.toLocaleLowerCase('tr-TR').replace(/[’'`]/g, '');
const TUR = [
  [/trafiğe kapat|yolun kapatılması|kapalı/i, 'kapali', 'Yol ya da bir yön kapalı'],
  [/şerit|tek şerit|kontrollü/i, 'serit', 'Şerit daraltma, kontrollü geçiş'],
  [/sathi kaplama|mıcır/i, 'kaplama', 'Sathi kaplama, mıcır'],
  [/patlatma/i, 'kapali', 'Patlatma, saatli kapanma'],
];

// Metindeki yer adı adayları: "Ankara-Niğde Otoyolu", "Ilgaz-Korgun-Çankırı Devlet Yolu" gibi
// tireli dizilerin parçaları ve bilinen yer adları sözlüğündeki eşleşmeler.
export function yerAdlari(metin, sozluk) {
  const k = kucuk(metin);
  const bulunan = new Set();
  for (const ad of Object.keys(sozluk)) {
    if (ad.length < 4) continue;
    const re = new RegExp(`(^|[^a-zçğıöşü])${ad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zçğıöşü]|$)`, 'u');
    if (re.test(k)) bulunan.add(ad);
  }
  return [...bulunan];
}

// Sözlük: ad (küçük harf) → [enlem, boylam]. EPDK paketindeki istasyonların ilçe/il adlarından
// merkez kestirimi (ortanca) çıkarılır; çevrimdışı, ek veri gerektirmez.
// "Merkez" ilçesi her ilde var; ad olarak kullanılmaz, o ilin merkezi kestirimine katılır.
export function yerSozlugu(istasyonlar) {
  const g = new Map(), merkez = new Map();
  const ekle = (m, a, n) => { if (!m.has(a)) m.set(a, []); m.get(a).push(n); };
  for (const s of istasyonlar) {
    if (s.enlem == null) continue;
    const n = [s.enlem, s.boylam], il = s.ilAdi ? kucuk(s.ilAdi) : null, ilce = s.ilce ? kucuk(s.ilce) : null;
    if (ilce && ilce !== 'merkez') ekle(g, ilce, n);
    if (il) { ekle(g, il, n); if (ilce === 'merkez') ekle(merkez, il, n); }
  }
  for (const [il, n] of merkez) g.set(il, n);   // il adı için il merkezindeki istasyonlar yeğlenir
  const ort = v => { const s = [...v].sort((x, y) => x - y); return s[s.length >> 1]; };
  return Object.fromEntries([...g].map(([a, n]) => [a, [ort(n.map(x => x[0])), ort(n.map(x => x[1]))]]));
}

// Rota şekline en yakın uzaklık (km) ve o noktanın rota km'si (seyrek örnekle yeterli).
function rotayaUzaklik(nokta, sekil, kumKm) {
  let en = Infinity, km = 0;
  for (let i = 0; i < sekil.length; i += 5) {
    const d = mesafeKm(nokta, sekil[i]);
    if (d < en) { en = d; km = kumKm[i]; }
  }
  return { d: en, km };
}

// Yön bildiren adlar ("Ankara istikameti", "Eskişehir yönü") yolun nerede olduğunu değil nereye
// gittiğini söyler; yer eşlemesinde sayılmaz.
const YON = /^\s*(istikamet|yön|yönü|yönünde|yönüne|\(dış daire\)|\(iç daire\))/u;
function yerdeOlanlar(metin, adlar) {
  const k = kucuk(metin);
  return adlar.filter(a => {
    const re = new RegExp(`${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zçğıöşü]|$)`, 'gu');
    let m, yerde = false;
    while ((m = re.exec(k))) if (!YON.test(k.slice(m.index + a.length))) yerde = true;
    return yerde;
  });
}

// Rotanın OSM yol adları (Valhalla "names"): kayıt bu adlardan birini içeriyorsa güçlü eşleşme.
const yolAdiEslesir = (metin, yolAdlari) => {
  const k = kucuk(metin);
  return yolAdlari.map(kucuk).filter(a => a.length >= 8 && !/^\d/.test(a)).find(a => k.includes(a.replace(/ yolu$| otoyolu$/, ''))) || null;
};

export function rotadakiKayitlar(bulten, sekil, sozluk, { esikKm = 20, yolAdlari = [] } = {}) {
  const kum = [0];
  for (let i = 1; i < sekil.length; i++) kum.push(kum[i - 1] + mesafeKm(sekil[i - 1], sekil[i]));
  const sonuc = [];
  for (const k of bulten.kayit) {
    const adlar = yerdeOlanlar(k.metin, yerAdlari(k.metin, sozluk));
    const yakin = adlar.map(a => ({ ad: a, ...rotayaUzaklik(sozluk[a], sekil, kum) })).filter(x => x.d <= esikKm);
    const yol = yolAdiEslesir(k.metin, yolAdlari);
    // Şehir çevre yolu tek şehir adıyla anılır: o şehir rotadaysa yeterli.
    const cevre = /çevre (oto)?yol/i.test(k.metin) && yakin.length >= 1;
    if (yakin.length < 2 && !yol && !cevre) continue;
    if (!yakin.length) continue;
    const tur = TUR.find(([re]) => re.test(k.metin));
    // Yol adının uçları ("Ankara-Niğde Otoyolu") yolu tanımlar, çalışmanın yerini değil. Başka bir
    // yer adı da geçiyorsa (örn. "Kırşehir Bağlantı Yolu") konum için o kullanılır.
    const uclar = new Set();
    for (const m of kucuk(k.metin).matchAll(/([a-zçğıöşü]+)-([a-zçğıöşü]+)(?:-[a-zçğıöşü]+)* (?:oto)?yol/gu)) m.slice(1).forEach(x => uclar.add(x));
    const ozgul = yakin.filter(x => !uclar.has(x.ad) || kucuk(k.metin).split(x.ad).length > 2);
    const kms = (ozgul.length ? ozgul : yakin).map(x => x.km);
    sonuc.push({ no: k.no, metin: k.metin, tur: tur?.[1] || 'calisma', ozet: tur?.[2] || 'Yol çalışması', guclu: !!yol,
      yerler: yakin.map(x => x.ad), kmAralik: [Math.round(Math.min(...kms)), Math.round(Math.max(...kms))] });
  }
  return sonuc;
}

export async function bultenGetir(getir = fetch) {
  const y = await getir(KGM_BULTEN);
  if (!y.ok) throw new Error('KGM bülteni alınamadı: ' + y.status);
  return bultenCoz(await y.text());
}
