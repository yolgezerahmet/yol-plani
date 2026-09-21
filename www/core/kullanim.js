// Kullanıma bağlı menzil etkenleri: yük, tavan aksesuarı, lastik, iklimlendirme alışkanlığı,
// soğuk kabin ve soğuk batarya. Her katsayının kaynağı: [L] literatür, [T] bu projenin tahmini
// (OBD kaydıyla düzeltilecek). Tam döküm: docs/menzil-etkenleri.md
import { isiPompasiCop, SABIT } from './fizik.js';

export const KULLANIM_VARSAYILAN = {
  kisi: 1, bagajKg: 20, tavan: 'yok', lastik: 'yaz', klima: 'oto', kabinC: 22, sebekeOnKlima: false,
  cekilen: 'yok', basinc: 'tam', acikCam: false,
};
// Çekilen yük: kütle ve hava direnci birlikte büyür. Römorkta alan ve art iz büyüdüğü için CdA
// artışı tavan yükünden çok daha fazladır [T; yayımlanan EV çekme testleri menzilin %40–55 düştüğünü gösteriyor].
export const CEKILEN = {
  yok:     { ad: 'Yok', cda: 1.00, kg: 0 },
  hafif:   { ad: 'Hafif römork (750 kg)', cda: 1.35, kg: 750 },
  karavan: { ad: 'Karavan (1.400 kg)', cda: 1.90, kg: 1400 },
};
// Lastik basıncı: Crr yaklaşık p^-0,4 ile değişir [L]. Önerilen 2,5 bar kabul edilir.
export const BASINC = {
  tam:   { ad: 'Önerilen basınçta', bar: 0 },
  dusuk: { ad: '0,3 bar düşük', bar: 0.3 },
  cok:   { ad: '0,5 bar düşük', bar: 0.5 },
};
export const basincCrrKat = (eksikBar, onerilen = 2.5) => +Math.pow(onerilen / Math.max(1.2, onerilen - eksikBar), 0.4).toFixed(3);
export const ACIK_CAM_CDA = 1.05;                // [L] yol hızında ön camlar açık
export const KISI_KG = 75;                       // [L] ortalama yetişkin
export const TAVAN = {                           // [L] CdA artışı; ADAC ve üretici ölçümleri aralığı
  yok:   { ad: 'Yok', cda: 1.00, kg: 0 },
  cubuk: { ad: 'Yalnız tavan çubukları', cda: 1.06, kg: 6 },
  kutu:  { ad: 'Tavan kutusu', cda: 1.18, kg: 20 },
  bisiklet: { ad: 'Tavanda bisiklet', cda: 1.30, kg: 25 },
  arka:  { ad: 'Arkada bisiklet taşıyıcı', cda: 1.12, kg: 30 },
};
export const LASTIK = {                          // [L] AB lastik etiketi sınıfları arası fark mertebesi
  yaz: { ad: 'Yaz / fabrika', kat: 1.00 },
  dort: { ad: 'Dört mevsim', kat: 1.05 },
  kis: { ad: 'Kış', kat: 1.10 },
};
export const KLIMA = {
  oto: { ad: 'Otomatik', kat: 1.00 },
  surucu: { ad: 'Yalnız sürücü', kat: 0.80 },    // [T] E-GMP "driver only"
  eco: { ad: 'Eco', kat: 0.85 },                 // [T]
  kapali: { ad: 'Kapalı', kat: 0.10 },           // [T] cam buğusu için ara ara çalışır
};

// Koşul nesnesine (k) kullanım ayarlarını işler. Saf: yeni nesne döner.
export function kullanimUygula(k, u = KULLANIM_VARSAYILAN) {
  const a = { ...KULLANIM_VARSAYILAN, ...u };
  const tavan = TAVAN[a.tavan] || TAVAN.yok, cek = CEKILEN[a.cekilen] || CEKILEN.yok;
  return {
    ...k,
    yuk: a.kisi * KISI_KG + (+a.bagajKg || 0) + tavan.kg + cek.kg,
    cda: +(k.cda * tavan.cda * cek.cda * (a.acikCam ? ACIK_CAM_CDA : 1)).toFixed(4),
    lastik: +((LASTIK[a.lastik] || LASTIK.yaz).kat * basincCrrKat((BASINC[a.basinc] || BASINC.tam).bar)).toFixed(3),
    kabinC: a.kabinC, klimaKat: (KLIMA[a.klima] || KLIMA.oto).kat,
  };
}

// Soğuk ya da sıcak kabini hedefe getirmenin tek seferlik enerjisi (kWh). Sürekli ısı kaybı
// modelde zaten var; bu, ilk 10–15 dakikadaki fazladan çekiştir. Şebekeye bağlıyken ön
// klimalandırma yapıldıysa bataryadan gitmez.
export const KABIN_ISIL_KJ_K = 110;              // [T] kabin havası + iç yüzeylerin etkin ısıl kütlesi
export function kabinGecisKwh(disT, u = KULLANIM_VARSAYILAN, kabinT0 = disT) {
  const a = { ...KULLANIM_VARSAYILAN, ...u };
  if (a.sebekeOnKlima || a.klima === 'kapali') return 0;
  const fark = a.kabinC - kabinT0;
  const isi = Math.abs(fark) * KABIN_ISIL_KJ_K / 3600;                       // kWh ısı
  const verim = fark > 0 ? isiPompasiCop(disT) : SABIT.EER;
  return Math.abs(fark) < 3 ? 0 : +(isi / verim * (KLIMA[a.klima]?.kat ?? 1)).toFixed(2);
}

// Soğuk hücrede kullanılabilir enerji: iç direnç artar, alt gerilim sınırına erken varılır.
// NMC için literatür mertebesi [L]; E-GMP'ye özgü değer OBD'den (CEC/CED ve SoC) çıkarılacak.
const SOGUK_KAP = [[-20, 0.82], [-10, 0.90], [0, 0.95], [10, 0.98], [20, 1.00]];
export function sogukKapasiteKat(bataryaT) {
  if (bataryaT >= 20) return 1;
  if (bataryaT <= -20) return SOGUK_KAP[0][1];
  for (let i = 1; i < SOGUK_KAP.length; i++) {
    const [x0, y0] = SOGUK_KAP[i - 1], [x1, y1] = SOGUK_KAP[i];
    if (bataryaT <= x1) return +(y0 + (y1 - y0) * (bataryaT - x0) / (x1 - x0)).toFixed(3);
  }
  return 1;
}
// Yolculuk boyunca batarya ısındığı için etki tüm yola tam yansımaz. Uzun yolda (≥ 2 saat)
// kaybın yaklaşık üçte biri, kısa yolda tamamı sayılır [T].
export function yolculukKapasiteKat(bataryaT0, surusDk) {
  const tam = 1 - sogukKapasiteKat(bataryaT0);
  const pay = surusDk >= 120 ? 0.35 : 1 - 0.65 * surusDk / 120;
  return +(1 - tam * pay).toFixed(3);
}
