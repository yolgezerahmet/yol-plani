// Batarya karnesi: bataryanın nasıl kullanıldığı ve sağlığının nasıl seyrettiği.
//
// Dayanak: Geotab (Ocak 2026), 22.700 araç: ortalama yıllık kapasite kaybı %2,3; 100 kW üstü DC'yi yoğun
// kullananlarda %3,0, ağırlıkla AC/düşük güç kullananlarda %1,5; sıcak iklim +%0,4/yıl. DC oturum payı
// %12'nin altında %1,5, üstünde %2,5. Uç SoC düzeyleri ancak alışkanlıksa (zamanın > %80'i) etkili.
//
// Ham OBD örnekleri döner tamponda tutulduğu için (~11 saat) karne kendi küçük günlüklerini saklar:
//   şarj günlüğü: oturum özeti (kWh, tepe güç, 100 kW üstü kWh, sıcaklıklar)
//   sağlık günlüğü: günde en çok bir kayıt (BMS SoH, km, sayaçlar, ölçülen kapasite)
export const GEOTAB = { ort: 2.3, yuksekDc: 3.0, dusukGuc: 1.5, sicakEk: 0.4, dcOturumEsik: 0.12 };
const GUN = 864e5;

export function sarjGunlugu(gunluk, oturumlar, enFazla = 600) {
  const var_ = new Set(gunluk.map(o => o.bas));
  const yeni = oturumlar.filter(o => !var_.has(o.bas) && (o.kwh ?? 0) > 0.5).map(o => ({
    bas: o.bas, dk: o.dk, soc0: o.soc0, soc1: o.soc1, kwh: o.kwh, tepeKw: Math.round(o.tepeKw),
    kwhUst100: o.kwhUst100 ?? 0, T0: o.T0 ?? null, maxT: o.maxT > -50 ? o.maxT : null }));
  return gunluk.concat(yeni).sort((a, b) => a.bas - b.bas).slice(-enFazla);
}

// Günde bir kayıt; aynı gün yeniden okunursa son okuma geçerli olur.
export function saglikGunlugu(gunluk, k, enFazla = 800) {
  if (k.soh == null && k.kapasiteKwh == null) return gunluk;
  const gun = Math.floor(k.t / GUN), r = gunluk.filter(x => Math.floor(x.t / GUN) !== gun);
  r.push({ t: k.t, soh: k.soh ?? null, odoKm: k.odoKm ?? null, cecKwh: k.cecKwh ?? null, kapasiteKwh: k.kapasiteKwh ?? null });
  return r.sort((a, b) => a.t - b.t).slice(-enFazla);
}

// En küçük kareler eğimi. Yetersiz veri → null ve nedeni.
function egim(nokta) {
  const n = nokta.length, mx = nokta.reduce((t, p) => t + p[0], 0) / n, my = nokta.reduce((t, p) => t + p[1], 0) / n;
  let a = 0, b = 0; for (const [x, y] of nokta) { a += (x - mx) * (y - my); b += (x - mx) ** 2; }
  return b > 0 ? a / b : null;
}
export function sohEgilimi(gunluk, { enAzGun = 90, enAzKayit = 4, alan = 'soh' } = {}) {
  const g = gunluk.filter(x => x[alan] != null);
  if (g.length < enAzKayit) return { hazir: false, neden: `${g.length}/${enAzKayit} okuma` };
  const sure = (g[g.length - 1].t - g[0].t) / GUN;
  if (sure < enAzGun) return { hazir: false, neden: `${Math.round(sure)}/${enAzGun} gün` };
  const ilk = g[0][alan], yil = egim(g.map(x => [(x.t - g[0].t) / (365.25 * GUN), x[alan] / ilk * 100]));
  const kmli = g.filter(x => x.odoKm != null);
  const km = kmli.length >= enAzKayit && kmli[kmli.length - 1].odoKm - kmli[0].odoKm > 2000
    ? egim(kmli.map(x => [x.odoKm / 10000, x[alan] / ilk * 100])) : null;
  return { hazir: true, gun: Math.round(sure), kayit: g.length, yillikKayip: +(-yil).toFixed(2), onBinKmKayip: km != null ? +(-km).toFixed(2) : null,
           ilk: g[0][alan], son: g[g.length - 1][alan] };
}

// Şarj karışımı. Toplam şarj enerjisi BMS sayacından (sağlık günlüğündeki ilk ve son cecKwh) gelir;
// kaydedilen DC oturumları onun içindeki paydır. Ev şarjı genelde kaydedilmediği için AC payı farktan bulunur.
// Kaydedilmemiş DC oturumu varsa DC payı olduğundan düşük görünür: bu yüzden "en az" diye okunmalı.
export function sarjKarisimi(sarj, saglik) {
  const s = saglik.filter(x => x.cecKwh != null);
  const dc = sarj.reduce((t, o) => t + o.kwh, 0), ust = sarj.reduce((t, o) => t + (o.kwhUst100 || 0), 0);
  const r = { oturum: sarj.length, dcKwh: +dc.toFixed(1), ust100Kwh: +ust.toFixed(1), ust100Payi: dc > 0 ? +(ust / dc).toFixed(2) : null,
              sogukBaslangic: sarj.filter(o => o.T0 != null && o.T0 < 10 && o.tepeKw > 50).length,
              sicakOturum: sarj.filter(o => o.maxT != null && o.maxT >= 50).length, dcPayi: null, toplamKwh: null };
  if (s.length >= 2) {
    const a = s[0], z = s[s.length - 1], toplam = z.cecKwh - a.cecKwh;
    const icinde = sarj.filter(o => o.bas >= a.t && o.bas <= z.t).reduce((t, o) => t + o.kwh, 0);
    if (toplam > 20) { r.toplamKwh = +toplam.toFixed(0); r.dcPayi = +Math.min(1, icinde / toplam).toFixed(2); r.ust100ToplamPayi = +Math.min(1, sarj.filter(o => o.bas >= a.t && o.bas <= z.t).reduce((t, o) => t + (o.kwhUst100 || 0), 0) / toplam).toFixed(2); }
  }
  return r;
}

const yuzde = x => '%' + Math.round(x * 100);
const sayi = (x, b = 1) => Number(x).toLocaleString('tr-TR', { maximumFractionDigits: b });

// Karne metni: satır satır, her satır bir gözlem. Veri yoksa ne gerektiği söylenir.
export function karneMetni({ sarj, saglik, katalogKwh = null }) {
  const satir = [], son = saglik[saglik.length - 1];
  if (son?.soh != null) satir.push(`BMS'in bildirdiği sağlık (SoH): %${sayi(son.soh)}` + (son.odoKm != null ? `, ${sayi(son.odoKm, 0)} km'de` : '') + '. Bu, üreticinin kendi tahminidir; aşağıdaki ölçülen kapasiteyle birlikte okunmalı.');
  if (son?.kapasiteKwh != null) satir.push(`Ölçülen kullanılabilir kapasite: ${sayi(son.kapasiteKwh)} kWh` + (katalogKwh ? ` (katalog ${sayi(katalogKwh)} kWh'nin ${yuzde(son.kapasiteKwh / katalogKwh)}'i)` : '') + '.');
  const e = sohEgilimi(saglik), ek = sohEgilimi(saglik, { alan: 'kapasiteKwh' });
  const eg = ek.hazir ? ek : e;
  if (eg.hazir) {
    satir.push(`${eg.gun} günlük ${eg.kayit} okumaya göre yıllık kayıp ${eg === ek ? '(ölçülen kapasiteden)' : '(BMS değerinden)'}: %${sayi(Math.max(0, eg.yillikKayip), 2)}`
      + (eg.onBinKmKayip != null ? `, 10.000 km başına %${sayi(Math.max(0, eg.onBinKmKayip), 2)}` : '')
      + `. Karşılaştırma: büyük filo verisinde ortalama %${sayi(GEOTAB.ort)}/yıl; ağırlıkla yavaş şarj edenlerde %${sayi(GEOTAB.dusukGuc)}, 100 kW üstü DC'yi yoğun kullananlarda %${sayi(GEOTAB.yuksekDc)}.`);
  } else satir.push(`Sağlık eğilimi için veri birikiyor (${e.neden}). Ayda bir kez OBD panelinden "Oku" yeterli.`);
  const k = sarjKarisimi(sarj, saglik);
  if (k.oturum) {
    satir.push(`${k.oturum} hızlı şarj kaydı, toplam ${sayi(k.dcKwh, 0)} kWh`
      + (k.ust100Payi != null ? `; bunun ${yuzde(k.ust100Payi)} kadarı 100 kW üstünde verildi` : '')
      + (k.dcPayi != null ? `. Bu dönemde bataryaya giren ${sayi(k.toplamKwh, 0)} kWh'nin en az ${yuzde(k.dcPayi)} kadarı hızlı şarjdan` : '') + '.');
    // Üç kademe: filo verisindeki eşikler kaba olduğu için ara bölgede hüküm verilmez.
    if (k.dcPayi != null) satir.push(k.ust100ToplamPayi >= 0.3
      ? 'Şarjının önemli bir kısmı yüksek güçlü DC. Filo verisine göre bu kullanım biçimi kapasite kaybını belirgin hızlandırıyor; günlük kullanımda evde ya da AC\'de şarj etmek en etkili önlem.'
      : k.dcPayi < GEOTAB.dcOturumEsik
        ? 'Hızlı şarj payın düşük; filo verisine göre bu, batarya ömrü için iyi tarafta.'
        : 'Hızlı şarj payın orta düzeyde. Yolculuk dışında AC şarjı tercih etmek kaybı yavaşlatır.');
    if (k.sogukBaslangic) satir.push(`${k.sogukBaslangic} hızlı şarj 10 °C'nin altındaki hücreyle başlamış. Yola çıkmadan planın önerdiği noktada ön ısıtmayı açmak bu şarjları belirgin kısaltır.`);
    if (k.sicakOturum) satir.push(`${k.sicakOturum} oturumda hücre sıcaklığı 50 °C'ye ulaşmış.`);
  } else satir.push('Henüz hızlı şarj kaydı yok. Şarj sırasında OBD kaydı açıksa oturum karneye işlenir.');
  return satir;
}
