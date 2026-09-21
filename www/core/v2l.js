// V2L (araçtan cihaza güç): kesintide bataryayla ev cihazlarını kaç saat çalıştırabilirsin?
// IONIQ 5 ve E-GMP ailesinde V2L çıkışı en fazla 3,6 kW; araç ayarında alt sınır (%) seçilir.
// Cihaz güçleri tipik ortalamalardır [T]; buzdolabı gibi döngüsel cihazlarda ortalama çekiş kullanılır.
export const V2L_SINIR_KW = 3.6;
export const ARAC_BEKLEME_W = 150;     // V2L açıkken aracın kendi sistemleri [T]
export const EVIRICI_VERIM = 0.90;     // [T]

export const CIHAZLAR = [
  { id: 'buzdolabi', ad: 'Buzdolabı', w: 60, tepeW: 800 },
  { id: 'modem', ad: 'Modem ve Wi-Fi', w: 15 },
  { id: 'lamba', ad: 'LED lamba (3 adet)', w: 30 },
  { id: 'telefon', ad: 'Telefon şarjı (2 adet)', w: 20 },
  { id: 'laptop', ad: 'Dizüstü bilgisayar', w: 60 },
  { id: 'tv', ad: 'Televizyon', w: 100 },
  { id: 'kombi', ad: 'Kombi (pompa ve elektronik)', w: 120, tepeW: 250 },
  { id: 'isitici', ad: 'Elektrikli ısıtıcı', w: 2000 },
  { id: 'cpap', ad: 'Solunum cihazı (CPAP)', w: 50 },
  { id: 'kettle', ad: 'Su ısıtıcı (günde 30 dk)', w: 90, tepeW: 2000 },
];

export function v2lSure({ soc, kap, altSinir = 20, secili = [], ozel = [], bekleme = ARAC_BEKLEME_W, verim = EVIRICI_VERIM, sinirKw = V2L_SINIR_KW }) {
  const liste = CIHAZLAR.filter(c => secili.includes(c.id)).concat(ozel);
  const yukW = liste.reduce((t, c) => t + c.w, 0);
  const tepeW = liste.reduce((t, c) => t + (c.tepeW ?? c.w), 0);
  const kullanilabilir = Math.max(0, (soc - altSinir) / 100 * kap);
  const cekisKw = yukW / 1000 / verim + bekleme / 1000;
  const saat = yukW > 0 ? kullanilabilir / cekisKw : 0;
  return {
    yukW, tepeW, kullanilabilirKwh: +kullanilabilir.toFixed(1),
    saat: +saat.toFixed(1), gun: +(saat / 24).toFixed(1),
    asiri: tepeW > sinirKw * 1000,
  };
}
