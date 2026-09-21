// Plan ekranı. Hesap çekirdeği www/core altında; bu dosya yalnızca veri toplar, çağırır ve çizer.
import { VARSAYILAN, TIP } from './core/model.js';
import { ARACLAR, VARSAYILAN_ARAC, aracUygula } from './core/arac.js';
import { havaGetir, havaUygula, ornekNoktalari } from './core/hava.js';
import { cokluHavaGetir, modelNoktasi, belirsizlik, MODEL_AD } from './core/hava-coklu.js';
import { durakPlanla, enerjiEgrisi } from './core/plan.js';
import { bultenGetir, yerSozlugu, rotadakiKayitlar } from './core/kgm.js';
import { KULLANIM_VARSAYILAN, TAVAN, LASTIK, KLIMA, kullanimUygula, kabinGecisKwh, yolculukKapasiteKat } from './core/kullanim.js';
import { rotadakiDenetim } from './core/denetim.js';

// KGM bülteni günde bir yayımlanıyor; bir saatlik önbellek yeter.
let kgmOnbellek = null, sozlukOnbellek = null;
async function kgmBulteni() {
  if (kgmOnbellek && Date.now() - kgmOnbellek.t < 3600e3) return kgmOnbellek.b;
  const b = await bultenGetir(fetch);
  kgmOnbellek = { t: Date.now(), b };
  return b;
}
import { yerAra, rotaGetir, rotaIstasyonlari, paketAc } from './core/servis.js';
import { obdPaneli, kalibrasyon, olcumler } from './obd-ekran.js';
import { yolculukMaliyeti, evSarjiEtkisi, asimAyi, OPERATORLER, FIYAT_TARIHI, MESKEN_SINIRI } from './core/maliyet.js';
import { enerjiAyristir, ayristirmaCumlesi } from './core/ayristir.js';
import { v2lSure, CIHAZLAR, V2L_SINIR_KW } from './core/v2l.js';
import { googleRota, wazeHedef } from './core/nav.js';

const $ = id => document.getElementById(id);
const sayi = (x, b = 0) => Number(x).toLocaleString('tr-TR', { maximumFractionDigits: b, minimumFractionDigits: b });
const sure = dk => { dk = Math.round(dk); const s = Math.floor(dk / 60); return s ? `${s} sa ${dk % 60} dk` : `${dk} dk`; };
const kacis = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Kalıcı ayarlar. Tarayıcı depolaması boş gelebilir; her okuma korumalı.
const depo = {
  al(k, v) { try { const x = localStorage.getItem(k); return x == null ? v : JSON.parse(x); } catch { return v; } },
  koy(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const durum = {
  arac: depo.al('arac', VARSAYILAN_ARAC), soh: depo.al('soh', 1),
  nereden: depo.al('nereden', { ad: 'Ayrancı, Çankaya, Ankara', lat: 39.8985, lon: 32.8617 }),
  nereye: depo.al('nereye', { ad: 'Kahramanmaraş', lat: 37.5753, lon: 36.9228 }),
  sonuclar: [], secili: 0,
  hesap: depo.al('hesap', { evTl: null, fiyat: {}, evYillik: null, yillikKm: 15000, evPay: 80, v2l: { soc: 80, alt: 20, secili: ['buzdolabi', 'modem', 'lamba', 'telefon'] } }),
};

// ---- Araç -----------------------------------------------------------------
function aracYaz() {
  const a = ARACLAR[durum.arac];
  $('aracDugme').textContent = `${a.brut} kWh ${durum.arac.endsWith('awd') ? 'AWD' : 'RWD'}${durum.soh < 1 ? `, sağlık %${Math.round(durum.soh * 100)}` : ''}`;
}
$('aracSec').innerHTML = Object.entries(ARACLAR).map(([id, a]) => `<option value="${id}">${kacis(a.ad)}</option>`).join('');
$('aracDugme').onclick = () => {
  $('aracSec').value = durum.arac; $('soh').value = Math.round(durum.soh * 100);
  $('sohOut').value = '%' + $('soh').value; $('aracDialog').showModal();
};
$('soh').oninput = () => { $('sohOut').value = '%' + $('soh').value; };
$('aracDialog').onclose = () => {
  if ($('aracDialog').returnValue !== 'tamam') return;
  durum.arac = $('aracSec').value; durum.soh = +$('soh').value / 100;
  depo.koy('arac', durum.arac); depo.koy('soh', durum.soh); aracYaz();
};

// ---- Güzergâh girişi -------------------------------------------------------
function yerKutusu(alan) {
  const girdi = $(alan), liste = $(alan + 'Oneri');
  girdi.value = durum[alan].ad;
  let zaman, sira = 0;
  girdi.oninput = () => {
    clearTimeout(zaman);
    const q = girdi.value.trim();
    if (q.length < 3) { liste.hidden = true; return; }
    zaman = setTimeout(async () => {
      const bu = ++sira;
      try {
        const r = await yerAra(q);
        if (bu !== sira) return;
        liste.innerHTML = r.map((y, i) => `<li><button type="button" data-i="${i}">${kacis(y.ad)}</button></li>`).join('')
          || '<li><button type="button" disabled>Sonuç yok. Daha genel bir ad deneyin.</button></li>';
        liste.hidden = false;
        liste.onclick = e => {
          const i = e.target.dataset.i; if (i == null) return;
          durum[alan] = r[i]; depo.koy(alan, r[i]); girdi.value = r[i].ad; liste.hidden = true;
        };
      } catch { liste.hidden = true; }
    }, 450);
  };
}
yerKutusu('nereden'); yerKutusu('nereye');

// ---- Kaydırıcılar ----------------------------------------------------------
const kaydirici = (id, bicim) => { const f = () => { $(id + 'Out').value = bicim($(id).value); }; $(id).oninput = f; f(); };
kaydirici('soc', v => '%' + v);
kaydirici('varis', v => '%' + v);
kaydirici('hiz', v => '%' + v);
const yarin = new Date(); yarin.setDate(yarin.getDate() + 1); yarin.setHours(8, 0, 0, 0);
$('cikis').value = new Date(yarin - yarin.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

// ---- Planlama --------------------------------------------------------------
let epdkPaketi = null;
async function paket() {
  if (!epdkPaketi) {
    let y;
    try { y = await fetch('./data/epdk.json'); } catch { y = null; }
    if (!y?.ok) throw new Error('İstasyon paketi bulunamadı. Depodaki "Veri güncelle" iş akışını çalıştırıp APK\'yı yeniden kurun.');
    epdkPaketi = paketAc(await y.json());
  }
  return epdkPaketi;
}
// Hız denetimi paketi isteğe bağlı: yoksa (ilk veri güncellemesinden önce) sessizce atlanır.
let denetimPaketi;
async function denetim() {
  if (denetimPaketi === undefined) {
    try { const y = await fetch('./data/denetim.json'); denetimPaketi = y.ok ? await y.json() : null; } catch { denetimPaketi = null; }
  }
  return denetimPaketi;
}
const bildir = (m, hata = false) => { $('durum').textContent = m; $('durum').classList.toggle('hata', hata); };

$('planla').onclick = async () => {
  const btn = $('planla'); btn.disabled = true;
  const hizKat = +$('hiz').value / 100;
  const kal = kalibrasyon();
  const k = { ...aracUygula({ ...VARSAYILAN, soc0: +$('soc').value, rezerv: 10 }, durum.arac, durum.soh),
              ...(kal?.tuketimKat ? { tuketimKat: kal.tuketimKat } : {}) };
  // OBD'den ölçülen kullanılabilir kapasite, katalog değerinin makul aralığındaysa elle girilen sağlığın yerine geçer.
  if (kal?.kapasiteKwh && kal.kapasiteKwh > k.kap * 0.7 && kal.kapasiteKwh < k.kap * 1.08) k.kap = kal.kapasiteKwh;
  const kul = kullanimOku();
  Object.assign(k, kullanimUygula(k, kul));
  const garaj = $('garaj').value, onIsitma = $('onIsitma').checked;
  depo.koy('garaj', garaj); depo.koy('onIsitma', onIsitma);
  const varisSoc = +$('varis').value;
  const cikisMs = new Date($('cikis').value).getTime() || Date.now();
  try {
    bildir('Rota ve rakım alınıyor…');
    const rotalar = await rotaGetir(durum.nereden, durum.nereye, fetch, { kutle: k.bos + k.yuk });
    if (!rotalar.length) throw new Error('Bu iki nokta arasında rota bulunamadı');
    const pk = await paket();
    durum.sonuclar = [];
    const dnt = await denetim();
    let bulten = null;
    try { bulten = await kgmBulteni(); sozlukOnbellek ??= yerSozlugu(pk.istasyonlar); } catch { bulten = null; }
    for (const [i, r] of rotalar.entries()) {
      bildir(`Rota ${i + 1}: hava tahmini…`);
      let bolumler = r.bolumler, havaVar = false, hava = null;
      const sureFn = b => b.km / Math.max(5, b.hiz * hizKat * (b.akisOrani || 0.9)) * 60 + (b.olayDk || 0);
      try {
        // Önce model topluluğu + gözlem sınaması; olmazsa tek model.
        try { hava = await cokluHavaGetir(ornekNoktalari(bolumler), fetch); } catch { hava = null; }
        const kaynak = hava?.birlesik?.length ? hava.birlesik : await havaGetir(bolumler);
        bolumler = havaUygula(bolumler, kaynak, cikisMs, sureFn); havaVar = true;
        if (hava) {
          const surus = r.bolumler.reduce((t, b) => t + sureFn(b), 0);
          hava.belirsizlik = belirsizlik(hava.birlesik, cikisMs, cikisMs + surus * 60e3);
          // Her model ayrı senaryo: toplam enerji ne kadar oynuyor?
          hava.senaryo = Object.keys(hava.ham[0]?.modeller || {}).map(md => {
            const nk = hava.ham.map(p => modelNoktasi(p, md));
            if (nk.some(x => !x)) return null;
            return { md, kwh: enerjiEgrisi(havaUygula(r.bolumler, nk, cikisMs, sureFn), k, { hizKat }).toplamKwh };
          }).filter(Boolean);
        }
      } catch { /* havasız devam: genel koşullar kullanılır */ }
      // Kullanım etkenleri: soğuk/sıcak kabinin ilk dakikaları ve soğuk hücrenin kullanılabilir kapasitesi.
      const disT0 = bolumler[0]?.T ?? k.T, park = garaj === '' ? disT0 : +garaj;
      const kabinKwh = kabinGecisKwh(disT0, kul, park);
      if (kabinKwh > 0 && bolumler.length) bolumler = [{ ...bolumler[0], gecisKayipKwh: (bolumler[0].gecisKayipKwh || 0) + kabinKwh }, ...bolumler.slice(1)];
      const surusDk = bolumler.reduce((t, b) => t + sureFn(b), 0);
      const kapKat = yolculukKapasiteKat(park, surusDk);
      const kr = { ...k, kap: +(k.kap * kapKat).toFixed(2) };
      bildir(`Rota ${i + 1}: yol üstündeki istasyonlar…`);
      const ist = { istasyonlar: rotaIstasyonlari(r.sekil, pk.istasyonlar) };
      const plan = durakPlanla(bolumler, ist.istasyonlar, kr, {
        hizKat, varisSoc, onIsitma,
        bataryaT0: garaj === '' ? undefined : +garaj,
        sicaklikTablosu: kal?.sicaklikTablosu || undefined,
      });
      const yolAdlari = [...new Set(r.bolumler.flatMap(b => b.adlar || []))];
      const yol = bulten ? { tarih: bulten.tarih, kayit: rotadakiKayitlar(bulten, r.sekil, sozlukOnbellek, { yolAdlari }) } : null;
      durum.sonuclar.push({ rota: r, bolumler, plan, ist, havaVar, hava, yol, k: kr, kul, etken: { kabinKwh, kapKat },
                            denetim: dnt ? { tarih: dnt.tarih, liste: rotadakiDenetim(dnt, r.sekil) } : null });
    }
    durum.secili = 0;
    bildir('');
    ciz();
    $('sonuc').hidden = false;
    $('secim').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (e) {
    bildir(e.message.includes('Failed to fetch') ? 'Bağlantı yok. İnternet açıkken yeniden deneyin.' : e.message, true);
  } finally { btn.disabled = false; }
};

// ---- Çizim -----------------------------------------------------------------
// Rotayı yol üstündeki yerleşimlerle adlandırır: üçte bir ve üçte iki noktasına en yakın istasyonun ilçesi.
function rotaAdi(s) {
  const L = s.plan.toplamKm, ist = s.ist.istasyonlar.filter(x => x.sapmaKm < 3);
  const yakin = hedef => ist.reduce((a, b) => (!a || Math.abs(b.rotaKm - hedef) < Math.abs(a.rotaKm - hedef) ? b : a), null);
  const adlar = [...new Set([yakin(L / 3), yakin(2 * L / 3)].filter(Boolean).map(x => x.il))];
  return adlar.length ? adlar.join(', ') + ' üzerinden' : `${s.bolumler.length} bölüm`;
}

function ciz() {
  const s = durum.sonuclar[durum.secili], p = s.plan;
  $('secim').innerHTML = durum.sonuclar.map((x, i) => `
    <button type="button" aria-pressed="${i === durum.secili}" data-i="${i}">
      <b>${sayi(x.plan.toplamKm)} km, ${sure(x.plan.toplamDk)}</b>${kacis(rotaAdi(x))}</button>`).join('');
  $('secim').onclick = e => { const b = e.target.closest('button'); if (b) { durum.secili = +b.dataset.i; ciz(); } };

  $('profil').innerHTML = profilSvg(s) +
    `<figcaption>Yeşil çizgi batarya, kahverengi alan rakım, taralı bant rezerv. Alt eksen km.</figcaption>`;
  const yol = $('profil').querySelector('.cizgi');
  if (yol) yol.style.setProperty('--uz', Math.ceil(yol.getTotalLength()));

  const n = p.duraklar.length;
  const alinan = p.duraklar.reduce((t, d) => t + d.ekKwh, 0);
  const evTl = durum.hesap.evTl || null;
  s.maliyet = yolculukMaliyeti(p, { bolumler: s.bolumler, kullanici: durum.hesap.fiyat, evTl, baslangicKwh: Math.max(0, p.toplamKwh - alinan) });
  const m = s.maliyet;
  const cumle = ayristirmaCumlesi(enerjiAyristir(s.bolumler, s.k));
  const maliyetMetni = n
    ? ` Şarj maliyeti yaklaşık <strong>${sayi(m.sarjTl)} TL</strong>${m.evTutar != null ? `, evde doldurduğun kısımla birlikte ${sayi(m.toplamTl)} TL (km başı ${sayi(m.kmBasiTl, 2)} TL)` : ''}.`
    : (m.evTutar != null ? ` Enerji maliyeti yaklaşık ${sayi(m.evTutar)} TL (ev elektriği).` : '');
  let havaMetni = '';
  const sc = s.hava?.senaryo || [];
  if (sc.length >= 2) {
    const v = sc.map(x => p.varisSoc - (x.kwh - p.toplamKwh) / s.k.kap * 100);
    const lo = Math.round(Math.min(...v)), hi = Math.round(Math.max(...v));
    havaMetni = lo === hi ? ` ${sc.length} hava modeli aynı sonucu veriyor.` : ` ${sc.length} hava modeline göre varış %${lo} ile %${hi} arasında.`;
  }
  $('ozet').innerHTML = `<strong>${sure(p.toplamDk)}</strong> yolculuk, ${n ? `<strong>${n}</strong> şarj durağı (${sure(p.sarjDk)})` : 'şarj durağı yok'}, varışta <strong>%${sayi(p.varisSoc)}</strong>. `
    + `Ortalama ${sayi(p.ortWh)} Wh/km, toplam ${sayi(p.toplamKwh, 1)} kWh.`
    + (p.termal?.onIsitmaKazanciDk >= 3 ? ` Ön ısıtma şarj süresini ${p.termal.onIsitmaKazanciDk} dk kısaltıyor.` : '')
    + havaMetni + maliyetMetni + (cumle ? ' ' + cumle : '');

  const u = [];
  if (p.sorun) u.push(`<p class="uyari">${kacis(p.sorun.mesaj)}. Menzili uzatmak için hızı düşürmeyi ya da çıkış bataryasını artırmayı deneyin.</p>`);
  if (!s.havaVar) u.push(`<p class="bilgi">Hava tahmini alınamadı; ${VARSAYILAN.T} °C ve rüzgârsız hava varsayıldı.</p>`);
  else if (s.bolumler.some(b => b.tahminDisi)) u.push(`<p class="bilgi">Çıkış zamanı tahmin aralığının dışında; hava en yakın saatle dolduruldu.</p>`);
  const tl = s.bolumler.filter(b => b.tahminiLimit).reduce((t, b) => t + b.km, 0);
  if (tl > 20) u.push(`<p class="bilgi">${sayi(tl)} km'de hız sınırı haritada etiketli değil; yol türünden tahmin edildi.</p>`);
  const yas = Math.round((Date.now() - Date.parse(epdkPaketi.tarih)) / 864e5);
  if (yas > 21) u.push(`<p class="bilgi">İstasyon listesi ${yas} gün önce alındı; yeni açılan istasyonlar eksik olabilir.</p>`);
  const et = s.etken || {}, ek = [];
  if (et.kabinKwh >= 0.3) ek.push(`kabini hedef sıcaklığa getirmek ilk dakikalarda ${sayi(et.kabinKwh, 1)} kWh alıyor (araç şarjdayken ön klimalandırma bunu sıfırlar)`);
  if (et.kapKat < 0.995) ek.push(`soğuk batarya kullanılabilir kapasiteyi yaklaşık %${sayi((1 - et.kapKat) * 100, 1)} azaltıyor`);
  if (s.kul?.tavan && s.kul.tavan !== 'yok') ek.push(`${TAVAN[s.kul.tavan].ad.toLocaleLowerCase('tr-TR')} hava direncini %${Math.round((TAVAN[s.kul.tavan].cda - 1) * 100)} artırıyor`);
  if (s.bolumler.some(b => b.kar)) ek.push('rotanın bir kısmında kar yağışı bekleniyor; karlı zemin tüketimi artırır, hızın da düşeceğini hesaba kat');
  if (ek.length) u.push(`<p class="bilgi">Kullanım etkileri: ${ek.join('; ')}.</p>`);
  const dl = s.denetim?.liste || [];
  if (dl.length) {
    const kor = dl.filter(x => x.tur === 'koridor'), kam = dl.length - kor.length;
    u.push(`<p class="bilgi">Rotada haritada işli ${kam ? kam + ' sabit hız kamerası' : ''}${kam && kor.length ? ' ve ' : ''}${kor.length ? kor.length + ' ortalama hız koridoru (' + kor.map(x => sayi(x.km) + '. km' + (x.limit ? ', ' + x.limit + ' km/h' : '')).join('; ') + ')' : ''} var.`
      + `${+$('hiz').value > 100 ? ' Koridorlarda ortalama hız limitle sınırlı; süre tahmini oralarda iyimser kalır.' : ''} Liste OpenStreetMap'ten gelir ve eksiktir; gezici denetim içermez.</p>`);
  }
  const hv = s.hava;
  if (hv?.belirsizlik?.yuksek) {
    const b = hv.belirsizlik, r = b.ruzgar.deger >= 6 ? `rüzgârda ${sayi(b.ruzgar.deger * 3.6)} km/h (${sayi(b.ruzgar.km)}. km civarı)` : `sıcaklıkta ${sayi(b.T.deger)} °C (${sayi(b.T.km)}. km civarı)`;
    u.push(`<p class="bilgi">Hava modelleri ${r} ayrışıyor; tahmin bu yolculuk için belirsiz. Çıkıştan kısa süre önce planı yenile.</p>`);
  }
  if (hv?.sinama?.length) {
    const g = hv.sinama.slice(0, 3).map(x => `${kacis(x.ad)} ${sayi(Math.round(x.olculen) || 0)} °C (tahmin ${sayi(Math.round(x.tahmin) || 0)})`).join(', ');
    u.push(`<p class="bilgi">Ölçüm sınaması: ${g}.${hv.duzeltme ? ` Tahmin ölçümlerden ${sayi(Math.abs(hv.duzeltme.farkT), 1)} °C ${hv.duzeltme.farkT < 0 ? 'sıcak' : 'soğuk'} kalıyordu; ilk saatler ölçüme göre düzeltildi.` : ' Tahminle uyumlu.'}</p>`);
  }
  if (s.yol?.kayit?.length) {
    const t = s.yol.tarih ? s.yol.tarih.split('-').reverse().join('.') : '';
    u.push(`<div class="uyari yol"><p>Yol durumu (KGM bülteni ${t}): ${s.yol.kayit.length} kayıt rotanla ilgili olabilir.</p><ul>${s.yol.kayit.map(x =>
      `<li><b>${kacis(x.ozet)}</b>, yaklaşık ${sayi(x.kmAralik[0])}${x.kmAralik[1] - x.kmAralik[0] > 10 ? '–' + sayi(x.kmAralik[1]) : ''}. km${x.guclu ? '' : ' (yer adından eşlendi)'}.
       <details><summary>Bülten metni</summary><p class="kucuk">${kacis(x.metin)}</p></details></li>`).join('')}</ul></div>`);
  } else if (s.yol) u.push(`<p class="bilgi">KGM yol durumu bülteninde (${s.yol.tarih ? s.yol.tarih.split('-').reverse().join('.') : 'güncel'}) bu rotayla eşleşen çalışma ya da kapanma yok.</p>`);
  if (m.ucretliKm >= 5) u.push(`<p class="bilgi">Rotanın ${sayi(m.ucretliKm)} km'si ücretli yol (otoyol, köprü ya da tünel); geçiş ücreti şarj maliyetine eklenmedi.</p>`);
  if (m.tahminVar) u.push(`<p class="bilgi">Bazı operatörlerin fiyatı bilinmiyor; tahmini değer kullanıldı. Hesap menüsünden kendi fiyatını girebilirsin.</p>`);
  $('uyarilar').innerHTML = u.join('');

  // Yola çık: navigasyon Google Haritalar'da, şarj durakları ara nokta olarak.
  const g = googleRota(durum.nereden, durum.nereye, p.duraklar);
  $('yolaCik').href = g.url;
  $('yolaCikNot').textContent = (n ? `${g.araNokta} şarj durağı ara nokta olarak eklenir.` : 'Şarj durağı yok; doğrudan varışa yönlendirir.')
    + (g.kirpildi ? ' Haritalar en fazla 9 ara nokta aldığı için sonrakiler eklenmedi.' : '');
  const ilk = p.duraklar[0]?.istasyon;
  $('wazeIlk').hidden = !ilk;
  if (ilk) $('wazeIlk').href = wazeHedef({ lat: ilk.enlem, lon: ilk.boylam });

  $('durakBaslik').hidden = !n;
  const olc = olcumler();
  $('duraklar').innerHTML = p.duraklar.map((d, i) => durakHtml(d, m.duraklar[i], olc)).join('');
  $('bolumler').innerHTML = bolumTablosu(s);
  $('kaynak').textContent = `Rota ve rakım: Valhalla (OpenStreetMap). Hava: ${s.hava?.senaryo?.length ? s.hava.senaryo.map(x => MODEL_AD[x.md]).join(', ') + ' modelleri (Open-Meteo), gözlem NOAA METAR' : 'Open-Meteo'}.${s.yol ? ' Yol durumu: KGM günlük bülteni.' : ''} İstasyonlar ve konumları: EPDK şarj istasyonları servisi, ${epdkPaketi.tarih}. Müsaitlik canlı değildir.`;
}

// Android'de geo: adresi varsayılan harita uygulamasını açar (Google Haritalar, Yandex, OsmAnd).
const haritaLink = (i, metin = 'Haritada aç') =>
  `<a class="harita" href="geo:${i.enlem},${i.boylam}?q=${i.enlem},${i.boylam}(${encodeURIComponent(i.ad)})">${metin}</a>`;

function durakHtml(d, f, olc = []) {
  const i = d.istasyon;
  const fiyat = f ? `${kacis(f.ad)}, yaklaşık ${sayi(f.tutar)} TL (${sayi(f.tl, 2)} TL/kWh${f.kaynak === 'senin' ? ', senin fiyatın' : f.kaynak === 'tahmin' ? ', tahmini' : ''}).`
    + (f.isgaliyeDk ? ` Şarj bitince aracı çek; dolu kalan her dakika yaklaşık ${sayi(f.isgaliyeDk)} TL işgaliye.` : '') : `${kacis(i.operator || '')}.`;
  const bu = olc.filter(o => o.istasyonNo === i.no).sort((a, b) => b.bas - a.bas)[0];
  const olcum = bu ? `<p class="not${bu.dusuk ? ' dikkat' : ''}">Senin ölçümün (${bu.tarih}): en yüksek ${sayi(bu.tepeKw)} kW`
    + (bu.dusuk ? `, bu sıcaklıkta beklenenin %${sayi(bu.beklenenOran * 100)}'i. Yedeği göz önünde tut.` : ', beklendiği gibi.') + '</p>' : '';
  const konum = i.konum === 'kesin' ? '' : ' Konum yaklaşık.';
  const yedek = d.yedekler?.length
    ? `<details class="yedek"><summary>Olmazsa ${d.yedekler.length} yedek</summary><ul>${d.yedekler.map(y =>
        `<li>${sayi(y.rotaKm)}. km, ${kacis(y.marka || y.ad)} ${sayi(y.kw)} kW${y.sapmaKm > 1 ? `, yoldan ${sayi(y.sapmaKm, 1)} km` : ''}. ${haritaLink(y, 'Aç')}</li>`).join('')}</ul></details>`
    : `<p class="not dikkat">Bu durağın ulaşılabilir yedeği yok.</p>`;
  return `<li class="durak">
    <div class="km">${sayi(d.km)}. km${i.sapmaKm > 0.5 ? `, yoldan ${sayi(i.sapmaKm, 1)} km` : ''}, ${kacis(i.il || '')}</div>
    <div class="ad">${kacis(i.marka || '')} ${kacis(i.ad)}</div>
    <div class="sarj">%${sayi(d.varisSoc)} → %${d.hedefSoc} <span>${d.dk} dk, ${sayi(d.ekKwh, 1)} kWh, ${sayi(i.kw)} kW × ${i.soketSayisi || 1}</span></div>
    ${isiSatiri(d)}
    ${olcum}
    <p class="not">${fiyat}${konum} ${haritaLink(i)}</p>
    ${yedek}</li>`;
}

// Batarya sıcaklığı satırı: soğuksa ne yapılacağını söyler, ılıksa sessiz kalır.
function isiSatiri(d) {
  if (d.bataryaTVaris == null) return '';
  if (d.onIsitma) return `<p class="isi soguk">Batarya varışta ${sayi(d.bataryaTVaris)} °C. Ön ısıtmayı ${sayi(d.onIsitma.baslaKm)}. km'de başlat `
    + `(${d.onIsitma.dk} dk, ${sayi(d.onIsitma.kwh, 1)} kWh); ısıtmasız ${d.dkIsitmasiz} dk sürerdi.</p>`;
  if (d.sicaklikKaybiDk >= 2) return `<p class="isi soguk">Batarya ${sayi(d.bataryaT)} °C; soğuk hücre şarjı ${d.sicaklikKaybiDk} dk uzatıyor.</p>`;
  return `<p class="isi kucuk">Batarya ${sayi(d.bataryaT)} °C, şarja hazır.</p>`;
}

function bolumTablosu(s) {
  const satir = s.plan.enerji.satir;
  return `<table><thead><tr><th>Km</th><th>Yol</th><th>Hız</th><th>Wh/km</th><th>↑ m</th><th>↓ m</th><th>°C</th><th>Rüzgâr</th></tr></thead><tbody>${
    s.bolumler.map((b, i) => `<tr><td>${sayi(b.basKm)}–${sayi(b.basKm + b.km)}</td><td>${kacis(TIP[b.tip]?.ad.split(' ')[0] || b.tip)}</td>
      <td>${satir[i].hiz}</td><td>${sayi(satir[i].wh)}</td><td>${sayi(b.cikis)}</td><td>${sayi(b.inis)}</td>
      <td>${b.T != null ? sayi(b.T) : '–'}</td><td>${b.ruzgarHizi != null ? sayi(b.ruzgarHizi * 3.6) + ' km/h' : '–'}</td></tr>`).join('')
  }</tbody></table>`;
}

// Enerji profili: batarya çizgisi arazi silüetinin üstünde; durak kehribar sütun.
function profilSvg(s) {
  const W = 360, H = 200, sol = 30, sag = 12, ust = 12, alt = 26;
  const p = s.plan, L = p.toplamKm || 1;
  const x = km => sol + (W - sol - sag) * km / L;
  const y = soc => ust + (H - ust - alt) * (1 - soc / 100);
  const rk = s.rota.rakimProfili?.length ? s.rota.rakimProfili : s.bolumler.map(b => [b.basKm + b.km / 2, b.rakim]);
  const rmin = Math.min(...rk.map(r => r[1])), rmax = Math.max(...rk.map(r => r[1]));
  const ry = m => H - alt - (H - ust - alt) * 0.42 * (m - rmin) / Math.max(1, rmax - rmin);
  const arazi = `M${x(0)},${H - alt} ` + rk.map(([km, m]) => `L${x(km).toFixed(1)},${ry(m).toFixed(1)}`).join(' ') + ` L${x(L)},${H - alt} Z`;
  const bat = p.profil.map(([km, soc], i) => `${i ? 'L' : 'M'}${x(km).toFixed(1)},${y(soc).toFixed(1)}`).join(' ');
  const rez = s.k.rezerv;
  const izgara = [0, 50, 100].map(v => `<line x1="${sol}" x2="${W - sag}" y1="${y(v)}" y2="${y(v)}" stroke="var(--cizgi)" stroke-width="0.6"/>
      <text x="${sol - 5}" y="${y(v) + 3.5}" text-anchor="end" font-size="9.5" fill="var(--soluk)">%${v}</text>`).join('');
  const adim = L > 400 ? 100 : 50;
  const eks = Array.from({ length: Math.floor(L / adim) + 1 }, (_, i) => i * adim)
    .map(km => `<text x="${x(km)}" y="${H - 9}" text-anchor="middle" font-size="9.5" fill="var(--soluk)">${km}</text>`).join('');
  const durak = p.duraklar.map((d, i) => `
    <line x1="${x(d.km)}" x2="${x(d.km)}" y1="${y(d.varisSoc)}" y2="${y(d.hedefSoc)}" stroke="var(--sarj)" stroke-width="5" stroke-linecap="round"/>
    <circle cx="${x(d.km)}" cy="${y(d.hedefSoc) - 11}" r="8" fill="var(--sarj)"/>
    <text x="${x(d.km)}" y="${y(d.hedefSoc) - 7.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1C1405">${i + 1}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rota boyunca batarya seviyesi ve rakım" font-family="Barlow Semi Condensed, Barlow, sans-serif">
    <defs><pattern id="tarama" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="var(--uyari)" stroke-width="1" opacity=".35"/></pattern></defs>
    <path d="${arazi}" fill="var(--arazi)" opacity=".38"/>
    <text x="${W - sag}" y="${ry(rmax) - 4}" text-anchor="end" font-size="9.5" fill="var(--soluk)">${sayi(rmax)} m</text>
    ${izgara}
    <rect x="${sol}" y="${y(rez)}" width="${W - sol - sag}" height="${y(0) - y(rez)}" fill="url(#tarama)"/>
    <path class="cizgi" d="${bat}" fill="none" stroke="var(--batarya)" stroke-width="2.6" stroke-linejoin="round"/>
    ${durak}
    ${eks}
  </svg>`;
}

const sec = (id, tablo, deger) => { $(id).innerHTML = Object.entries(tablo).map(([v, o]) => `<option value="${v}">${kacis(o.ad)}</option>`).join(''); $(id).value = deger; };
function kullanimOku() {
  const u = { kisi: +$('kisi').value || 1, bagajKg: +$('bagaj').value || 0, tavan: $('tavan').value, lastik: $('lastik').value,
              klima: $('klima').value, kabinC: +$('kabinC').value || 22, sebekeOnKlima: $('sebekeOnKlima').checked };
  depo.koy('kullanim', u); return u;
}
{
  const u = { ...KULLANIM_VARSAYILAN, ...depo.al('kullanim', {}) };
  sec('tavan', TAVAN, u.tavan); sec('lastik', LASTIK, u.lastik); sec('klima', KLIMA, u.klima);
  $('kisi').value = u.kisi; $('bagaj').value = u.bagajKg; $('kabinC').value = u.kabinC; $('sebekeOnKlima').checked = u.sebekeOnKlima;
}
$('garaj').value = depo.al('garaj', '');
$('onIsitma').checked = depo.al('onIsitma', true);
obdPaneli({ planGetir: () => durum.sonuclar[durum.secili]?.plan, olcekGetir: () => ARACLAR[durum.arac].sarjOlcek,
            istasyonlarGetir: async () => (await paket()).istasyonlar });

// ---- Hesap: şarj fiyatları, ev elektriği, V2L ---------------------------------
const hesapKaydet = () => depo.koy('hesap', durum.hesap);
const sayiOku = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };

function fiyatListesi() {
  $('fiyatlar').innerHTML = OPERATORLER.map(o => `<label class="satir">${kacis(o.ad)}
    <input type="text" inputmode="decimal" data-op="${kacis(o.ad)}" placeholder="${o.dc != null ? sayi(o.dc, 2) : '–'}" value="${durum.hesap.fiyat[o.ad] != null ? sayi(durum.hesap.fiyat[o.ad], 2) : ''}"></label>`).join('');
  $('fiyatNot').textContent = `Soluk yazılan değerler ${FIYAT_TARIHI} dolaylarında derlenmiş yaklaşık DC fiyatlarıdır; operatörler fiyatı sık değiştiriyor. Kendi uygulamanda gördüğün fiyatı yazarsan o kullanılır.`;
}
$('fiyatlar').oninput = e => {
  const op = e.target.dataset.op; if (!op) return;
  const v = sayiOku(e.target.value);
  if (v == null) delete durum.hesap.fiyat[op]; else durum.hesap.fiyat[op] = v;
  hesapKaydet();
};

function evHesabi() {
  const h = durum.hesap;
  $('evTl').value = h.evTl != null ? sayi(h.evTl, 2) : '';
  $('evYillik').value = h.evYillik ?? ''; $('yillikKm').value = h.yillikKm ?? '';
  $('evPay').value = h.evPay; $('evPayOut').value = '%' + h.evPay;
  if (!h.evYillik || !h.yillikKm) { $('evSonuc').innerHTML = 'Faturadaki son 12 ayın toplamını (araç hariç) ve yıllık km\'ni yaz.'; return; }
  // Yıllık karma kullanım (şehir + yol) için yaklaşık 170 Wh/km [T]; OBD yolculukları biriktikçe ölçülene çekilebilir.
  const r = evSarjiEtkisi({ evYillikKwh: h.evYillik, aracYillikKm: h.yillikKm, whKm: 170, evPayi: h.evPay / 100 });
  const ay = new Date().getMonth() + 1;
  const a = asimAyi({ buYilKwh: (h.evYillik + r.aracKwh) * (ay - 1) / 12, ay, aylikKwh: (h.evYillik + r.aracKwh) / 12 });
  const ayAd = i => ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][(i - 1) % 12];
  $('evSonuc').innerHTML = `Aracın evde yılda yaklaşık <strong>${sayi(r.aracKwh)} kWh</strong> çeker; ev ile birlikte <strong>${sayi(r.toplam)} kWh</strong>. `
    + (r.asar
      ? `Bu, mesken için ${sayi(MESKEN_SINIRI)} kWh'lik son kaynak sınırını aşıyor. Sınır aşılınca, aşılan ayı izleyen üçüncü ayın başından itibaren tedarikçinle ikili anlaşman yoksa yüksek tüketimli tarife uygulanabilir; bir önceki yıldaki aşım da sayılıyor. `
        + (a && !a.zaten ? `Bu tempoyla sınır ${ayAd(a.ay)} ayında aşılır; yüksek tarife ${a.ay + 3 > 12 ? 'gelecek yıl ' : ''}${ayAd(a.uygulama)} başından itibaren uygulanabilir. ` : '')
        + `Evde en fazla yaklaşık ${sayi(r.sinirKm)} km'lik şarj sınırın altında kalıyor. Tedarikçilerin yüksek tüketimli aboneler için ikili anlaşma teklifleri var; karşılaştırmaya değer.`
      : `Sınırın (${sayi(MESKEN_SINIRI)} kWh) altında kalıyorsun; evde yaklaşık ${sayi(r.sinirKm)} km'ye kadar şarj sınırı aşmaz.`)
    + (h.evTl ? ` Ev şarjı km başına yaklaşık ${sayi(170 / 1000 / 0.9 * h.evTl, 2)} TL.` : '');
}
['evTl', 'evYillik', 'yillikKm', 'evPay'].forEach(id => $(id).oninput = () => {
  const h = durum.hesap;
  if (id === 'evTl') h.evTl = sayiOku($('evTl').value);
  if (id === 'evYillik') h.evYillik = sayiOku($('evYillik').value);
  if (id === 'yillikKm') h.yillikKm = sayiOku($('yillikKm').value);
  if (id === 'evPay') h.evPay = +$('evPay').value;
  hesapKaydet(); evHesabi();
});

function v2lHesabi() {
  const v = durum.hesap.v2l, a = ARACLAR[durum.arac];
  const kap = kalibrasyon()?.kapasiteKwh || a.kap * durum.soh;
  $('v2lSoc').value = v.soc; $('v2lSocOut').value = '%' + v.soc;
  $('v2lAlt').value = v.alt; $('v2lAltOut').value = '%' + v.alt;
  $('v2lCihaz').innerHTML = CIHAZLAR.map(c => `<label class="onay"><input type="checkbox" data-c="${c.id}" ${v.secili.includes(c.id) ? 'checked' : ''}> ${kacis(c.ad)} <span class="kucuk">≈ ${sayi(c.w)} W</span></label>`).join('');
  const r = v2lSure({ soc: v.soc, kap, altSinir: v.alt, secili: v.secili });
  $('v2lSonuc').innerHTML = !r.yukW ? 'Çalıştırmak istediğin cihazları seç.'
    : `Toplam ortalama yük ${sayi(r.yukW)} W. Bataryada kullanılabilir ${sayi(r.kullanilabilirKwh, 1)} kWh ile yaklaşık <strong>${r.saat >= 48 ? sayi(r.gun, 1) + ' gün' : sayi(r.saat, 0) + ' saat'}</strong> yeter.`
      + (r.asiri ? ` Dikkat: seçilenler aynı anda çalışırsa anlık çekiş ${sayi(r.tepeW)} W'a çıkabilir; V2L en fazla ${sayi(V2L_SINIR_KW, 1)} kW veriyor. Güçlü cihazları sırayla çalıştır.` : '')
      + ' Güçler tipik değerlerdir; aracın V2L alt sınırını araç menüsünden aynı değere ayarla.';
}
['v2lSoc', 'v2lAlt'].forEach(id => $(id).oninput = () => {
  durum.hesap.v2l[id === 'v2lSoc' ? 'soc' : 'alt'] = +$(id).value; hesapKaydet(); v2lHesabi();
});
$('v2lCihaz').onchange = e => {
  const c = e.target.dataset.c; if (!c) return;
  const s = new Set(durum.hesap.v2l.secili); e.target.checked ? s.add(c) : s.delete(c);
  durum.hesap.v2l.secili = [...s]; hesapKaydet(); v2lHesabi();
};
$('hesapDugme').onclick = () => { fiyatListesi(); evHesabi(); v2lHesabi(); $('hesapDialog').showModal(); };
$('hesapDialog').onclose = () => { if (durum.sonuclar.length) ciz(); };
aracYaz();
