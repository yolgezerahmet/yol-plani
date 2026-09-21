// Plan ekranı. Hesap çekirdeği www/core altında; bu dosya yalnızca veri toplar, çağırır ve çizer.
import { VARSAYILAN, TIP } from './core/model.js';
import { ARACLAR, VARSAYILAN_ARAC, aracUygula } from './core/arac.js';
import { havaGetir, havaUygula } from './core/hava.js';
import { durakPlanla } from './core/plan.js';
import { yerAra, rotaGetir, rotaIstasyonlari, paketAc } from './core/servis.js';

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
const bildir = (m, hata = false) => { $('durum').textContent = m; $('durum').classList.toggle('hata', hata); };

$('planla').onclick = async () => {
  const btn = $('planla'); btn.disabled = true;
  const hizKat = +$('hiz').value / 100;
  const k = aracUygula({ ...VARSAYILAN, soc0: +$('soc').value, rezerv: 10 }, durum.arac, durum.soh);
  const varisSoc = +$('varis').value;
  const cikisMs = new Date($('cikis').value).getTime() || Date.now();
  try {
    bildir('Rota ve rakım alınıyor…');
    const rotalar = await rotaGetir(durum.nereden, durum.nereye, fetch, { kutle: k.bos + k.yuk });
    if (!rotalar.length) throw new Error('Bu iki nokta arasında rota bulunamadı');
    const pk = await paket();
    durum.sonuclar = [];
    for (const [i, r] of rotalar.entries()) {
      bildir(`Rota ${i + 1}: hava tahmini…`);
      let bolumler = r.bolumler, havaVar = false;
      try {
        const noktalar = await havaGetir(bolumler);
        const sureFn = b => b.km / Math.max(5, b.hiz * hizKat * (b.akisOrani || 0.9)) * 60 + (b.olayDk || 0);
        bolumler = havaUygula(bolumler, noktalar, cikisMs, sureFn); havaVar = true;
      } catch { /* havasız devam: genel koşullar kullanılır */ }
      bildir(`Rota ${i + 1}: yol üstündeki istasyonlar…`);
      const ist = { istasyonlar: rotaIstasyonlari(r.sekil, pk.istasyonlar) };
      const plan = durakPlanla(bolumler, ist.istasyonlar, k, { hizKat, varisSoc });
      durum.sonuclar.push({ rota: r, bolumler, plan, ist, havaVar, k });
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
  $('ozet').innerHTML = `<strong>${sure(p.toplamDk)}</strong> yolculuk, ${n ? `<strong>${n}</strong> şarj durağı (${sure(p.sarjDk)})` : 'şarj durağı yok'}, varışta <strong>%${sayi(p.varisSoc)}</strong>. `
    + `Ortalama ${sayi(p.ortWh)} Wh/km, toplam ${sayi(p.toplamKwh, 1)} kWh.`;

  const u = [];
  if (p.sorun) u.push(`<p class="uyari">${kacis(p.sorun.mesaj)}. Menzili uzatmak için hızı düşürmeyi ya da çıkış bataryasını artırmayı deneyin.</p>`);
  if (!s.havaVar) u.push(`<p class="bilgi">Hava tahmini alınamadı; ${VARSAYILAN.T} °C ve rüzgârsız hava varsayıldı.</p>`);
  else if (s.bolumler.some(b => b.tahminDisi)) u.push(`<p class="bilgi">Çıkış zamanı tahmin aralığının dışında; hava en yakın saatle dolduruldu.</p>`);
  const tl = s.bolumler.filter(b => b.tahminiLimit).reduce((t, b) => t + b.km, 0);
  if (tl > 20) u.push(`<p class="bilgi">${sayi(tl)} km'de hız sınırı haritada etiketli değil; yol türünden tahmin edildi.</p>`);
  const yas = Math.round((Date.now() - Date.parse(epdkPaketi.tarih)) / 864e5);
  if (yas > 21) u.push(`<p class="bilgi">İstasyon listesi ${yas} gün önce alındı; yeni açılan istasyonlar eksik olabilir.</p>`);
  $('uyarilar').innerHTML = u.join('');

  $('durakBaslik').hidden = !n;
  $('duraklar').innerHTML = p.duraklar.map(durakHtml).join('');
  $('bolumler').innerHTML = bolumTablosu(s);
  $('kaynak').textContent = `Rota ve rakım: Valhalla (OpenStreetMap). Hava: Open-Meteo. İstasyonlar ve konumları: EPDK şarj istasyonları servisi, ${epdkPaketi.tarih}. Müsaitlik canlı değildir.`;
}

// Android'de geo: adresi varsayılan harita uygulamasını açar (Google Haritalar, Yandex, OsmAnd).
const haritaLink = (i, metin = 'Haritada aç') =>
  `<a class="harita" href="geo:${i.enlem},${i.boylam}?q=${i.enlem},${i.boylam}(${encodeURIComponent(i.ad)})">${metin}</a>`;

function durakHtml(d) {
  const i = d.istasyon;
  const konum = i.konum === 'kesin' ? '' : ' Konum yaklaşık.';
  const yedek = d.yedekler?.length
    ? `<details class="yedek"><summary>Olmazsa ${d.yedekler.length} yedek</summary><ul>${d.yedekler.map(y =>
        `<li>${sayi(y.rotaKm)}. km, ${kacis(y.marka || y.ad)} ${sayi(y.kw)} kW${y.sapmaKm > 1 ? `, yoldan ${sayi(y.sapmaKm, 1)} km` : ''}. ${haritaLink(y, 'Aç')}</li>`).join('')}</ul></details>`
    : `<p class="not dikkat">Bu durağın ulaşılabilir yedeği yok.</p>`;
  return `<li class="durak">
    <div class="km">${sayi(d.km)}. km${i.sapmaKm > 0.5 ? `, yoldan ${sayi(i.sapmaKm, 1)} km` : ''}, ${kacis(i.il || '')}</div>
    <div class="ad">${kacis(i.marka || '')} ${kacis(i.ad)}</div>
    <div class="sarj">%${sayi(d.varisSoc)} → %${d.hedefSoc} <span>${d.dk} dk, ${sayi(d.ekKwh, 1)} kWh, ${sayi(i.kw)} kW × ${i.soketSayisi || 1}</span></div>
    <p class="not">${kacis(i.operator || '')}.${konum} ${haritaLink(i)}</p>
    ${yedek}</li>`;
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

aracYaz();
