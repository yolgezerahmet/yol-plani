# Özellikler ve kabul ölçütleri

İlke: **her sayı test edilmiş fizik motorundan gelir.** Dil modeli sayı üretmez; yalnızca girdiyi kısıta çevirir ve sonucu açıklar. İnternet ya da OBD yokken planlama çalışmaya devam eder.

Durum: ☐ yapılacak · ◐ sürüyor · ☑ bitti

## A. Araç

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| A1 | Batarya/çekiş varyantları: 58, 63, 72,6, 77,4, 84 kWh; RWD/AWD | Her varyant için %10→80 süresi yayımlanmış ölçümün ±2,5 dk içinde; AWD > RWD tüketim | ☑ |
| A2 | Batarya yıpranması (SoH) | SoH kapasiteyi ölçekler; OBD'den okunabildiğinde otomatik | ◐ |
| A3 | Araca özel kalibrasyon | Sabit hızlı sürüş kaydından CdA ve Crr; kalibrasyon sonrası 3 hız bandında hata < %4 | ☐ |
| A4 | Lastik: yaz/kış, ölçü, basınç (TPMS) | Basınç OBD'den okunur, Crr'ye yansır | ☐ |

## B. Rota

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| B1 | Otomatik bölümleme | Başlangıç–varıştan rota; limit ya da yol sınıfı değişiminde yeni bölüm; etiketsiz limitler "tahmini" işaretli | ☑ |
| B2 | Rakım profili | Tırmanış ve iniş ayrı toplanır (net fark değil); 200 m yeniden örnekleme + 10 m histerezis | ☑ |
| B3 | Hızlanma ve geçiş kayıpları | Akış hızı çukurları + yoğunluk tabanlı yerleşim geçişleri; ΔKE × (1/verim − rejen) | ◐ veri zayıf |
| B4 | Alternatif rota karşılaştırma | En az iki rota: toplam süre, enerji, durak sayısı, maliyet yan yana | ◐ motor hazır, arayüz yok |
| B5 | Çevrimdışı önbellek | Planlanmış rota bağlantısız açılır ve yeniden hesaplanır | ☐ |

## C. Hava

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| C1 | Bölüm bazlı rüzgâr vektörü | Her bölüme varış saatindeki tahmin; yol eksenine boyuna ve yanal izdüşüm | ☐ |
| C2 | Yükseklik düzeltmesi | 10 m rüzgârı araç yüksekliğine indirgenir (log profil) | ☐ |
| C3 | Yan rüzgârda CdA artışı | Akış açısına bağlı düzeltme; katsayı kaynağı belgeli | ☐ |
| C4 | Yoğunluk ve yağış | Basınç + sıcaklık + nemden yoğunluk; yağışta yuvarlanma artışı | ☐ |
| C5 | Çıkış saati önerisi | ±6 saat penceresinde enerji ve varış karşılaştırması | ☐ |

## D. Sürüş stratejisi

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| D1 | Hız–süre takası | Her bölüm için hız değişiminin net dakika etkisi (sürüş + şarj) | ◐ |
| D2 | Rejenerasyon seviye önerisi | Bölüm eğimi ve tipine göre 0/1/2/3/i-Pedal; gerekçesi görünür | ☐ |
| D3 | İniş öncesi şarj tavanı | Rotanın ilk inişindeki geri kazanım hesaplanır; "%X üstünde çıkma" uyarısı | ☐ |
| D4 | Mola mantığı | Durak süresi = max(şarj, insan ihtiyacı); yemek saati, sürüş ritmi, yolcu profili girdi | ☐ |
| D5 | Ön ısıtma kararı | Isıtma enerjisi ile kazanılan şarj dakikası karşılaştırılır | ☐ |
| D6 | Maliyet optimizasyonu | Operatör bazlı TL/kWh; varışta AC varsa düşük varış şarjı önerisi | ☐ |

## E. Menzil analizi

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| E1 | Olasılıklı varış şarjı | Rüzgâr, sıcaklık, trafik belirsizliğiyle ≥500 senaryo; P10/P50/P90 | ☐ |
| E2 | Duyarlılık tablosu | Hız, sıcaklık, rüzgâr, yük, lastik için km ve % etki | ☐ |
| E3 | Erişim haritası | Mevcut şarjla, arazi ve rüzgâr dahil ulaşılabilir alan | ☐ |

## F. Canlı (OBD)

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| F1 | BLE bağlantı | vLinker MC+; kopmada otomatik yeniden bağlanma; ekran kapalıyken kayıt | ☐ |
| F2 | Ayrıştırıcı | 220101/220105; her değer makullük kontrolünden geçer; 2026 araçta ham veriyle doğrulanmış | ◐ |
| F3 | Tüketim ayrıştırma | Anlık güç = hava + yuvarlanma + eğim + ivme + klima + artık | ☐ |
| F4 | Rüzgâr kestirimi | Artık terimden boyuna rüzgâr; tahminle karşılaştırma | ☐ |
| F5 | Plan–gerçek sapması ve hız danışmanı | Hedef varış şarjı için bölüm hız tavanı | ☐ |
| F6 | Rejenerasyon verimi ölçümü | İnişlerde geri kazanılan / potansiyel enerji | ☐ |

## G. Batarya ve şarj sağlığı

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| G1 | İç direnç kestirimi | Akım basamağına karşı voltaj çökmesi; sıcaklık ve SoC'ye göre normalize eğilim | ☐ |
| G2 | Hücre dengesi ve SoH eğilimi | Zaman serisi, eşik uyarısı | ☐ |
| G3 | İstasyon karnesi | Her şarjda gerçek kW–SoC eğrisi; istasyon başına ortalama ve güvenilirlik | ☐ |
| G4 | 12 V / ICCU izleme | Dinlenme voltajı eğilimi, eşik uyarısı | ☐ |

## H. Öğrenme ve dil katmanı

| # | Özellik | Kabul ölçütü | Durum |
|---|---|---|---|
| H1 | Öğrenen düzeltme | Fizik modelinin artığını sürüş kayıtlarından öğrenen küçük model; cihazda çalışır; doğrulama kümesinde hatayı düşürmüyorsa devreye girmez | ☐ |
| H2 | Doğal dille planlama | Serbest metin → kısıt nesnesi; kısıtlar kullanıcıya gösterilip onaylanır | ☐ |
| H3 | Yolculuk değerlendirmesi | Sapmanın bileşenlere dökümü motordan; metin dil modelinden | ☐ |
| H4 | Bağlantısız güvence | H2–H3 kapalıyken hiçbir planlama işlevi eksilmez | ☐ |

## Veri kaynakları

| Veri | Kaynak | Not |
|---|---|---|
| Rota, limit, rakım | Valhalla (FOSSGIS açık sunucu; gerekirse kendi kurulum) | Türkiye otoyollarında limit kapsamı yüksek, devlet yollarında düşük |
| Hava | Open-Meteo | Kullanım koşulları doğrulanacak |
| İstasyon | Open Charge Map, EPDK Şarj@TR | Kapsam ve API erişimi doğrulanacak |
| Araç | OBD (UDS 0x22, BMS 7E4) | Bluelink kapsam dışı: seyrek ve Türkiye desteği belirsiz |

## Gerçek veriyle doğrulama (20.09.2026, Ankara Kızılay → Kahramanmaraş)

FOSSGIS açık Valhalla sunucusu, `auto` maliyet modeli, iki alternatif. Model: 63 kWh RWD, 2.150 kg, 20 °C, rüzgârsız.

| Rota | km | Bölüm | Tırmanış | İniş | Enerji (limitte) | Enerji (%92) | Süre (%92) | Valhalla süre |
|---|---|---|---|---|---|---|---|---|
| Otoyol (Niğde–Adana) | 685 | 20 | 7.113 m | 7.406 m | 163,3 kWh | 153,5 kWh | 6,87 sa | 6,45 sa |
| Alternatif (Kayseri–Göksun) | 601 | 22 | 5.571 m | 5.920 m | 127,1 kWh | 118,8 kWh | 7,04 sa | 6,65 sa |

Çıkarım: otoyol 84 km daha uzun ve limitleri yüksek (274 km'si 140), bu yüzden **%29 daha fazla enerji** istiyor —
bir şarj durağı farkı. Süreler birbirine yakın. Bu karşılaştırmayı sabit tüketimli araçlar göstermez.

### Bu koşuda görülen veri sınırları

- **Limit kapsamı.** Otoyol rotasının %92'sinde OSM limit etiketi var; alternatif rotanın 355 km'sinde yok,
  yol sınıfından varsayılan atanıyor ve "tahmini" işaretleniyor.
- **Yerleşim geçişleri güvenilir değil.** 601 km'lik alternatif rotada yalnızca 9 geçiş bulunabildi
  (toplam 0,5 kWh). Valhalla'nın akış hızı devlet yollarında kasabalarda düşmüyor; yoğunluk (density ≥ 8)
  etiketi de yalnızca 27 km'yi yerleşim sayıyor. Gerçek kayıp bunun birkaç katı olmalı.
  Kalıcı çözüm: OBD sürüş kaydından gerçek hız profilini öğrenmek (A3, H1).
- **DEM gürültüsü.** Ham yükseklik örnekleri virajda 10 m aralıklı; doğrudan toplanınca otoyol rotasında
  11.369 m tırmanış çıkıyor. 200 m'ye yeniden örnekleme + 10 m histerezis bunu 7.113 m'ye indiriyor.
  Tünel ve viyadüklerde DEM araziyi gösterdiği için bir miktar fazlalık kalıyor.
- **Akış oranı artık ölçülü.** Bölüm süresi, yol tipine göre sabit katsayı yerine Valhalla'nın o bölümdeki
  ortalama hızı / limit oranıyla hesaplanıyor. Toplam süreler Valhalla'nınkine %6 içinde yaklaşıyor.

## Maliyet, ev elektriği, V2L, ölçülmüş şarj gücü (Eylül 2026)

- **Yolculuk maliyeti:** her durakta operatöre göre tutar; özet toplam, evde doldurulan kısım ve km başı TL.
  Fiyatlar kullanıcı girdisi > tablo (yaklaşık, Temmuz 2026) > tahmin sırasıyla. Ücretli yol km'si ayrıca bildirilir.
- **Ev elektriği:** EPDK mesken son kaynak sınırı (4.000 kWh/yıl, 2026) ile ev şarjının etkisi; hangi ay
  aşılacağı ve yüksek tarifenin ne zaman başlayabileceği.
- **Enerji ayrıştırma:** "Bu yolculukta soğuk X kWh, tırmanış Y kWh, rüzgâr Z kWh ekliyor."
- **V2L:** seçilen cihazlarla kesintide kaç saat/gün; 3,6 kW anlık sınır uyarısı.
- **Ölçülmüş şarj gücü (yerel):** OBD kaydındaki DC şarj, GPS ile istasyona eşlenir; durak kartında
  "senin ölçümün". Paylaşım henüz yok; tasarımı ayrı karar.

## Yolda modu: canlı takip (Eylül 2026)

Plan ekranındaki "Yolda modunu başlat" ile açılır. Çekirdek `core/canli.js` (saf, testli), arayüz `canli-ekran.js`.
- **Konum:** GPS rotaya izdüşürülür; rota dışı (> 1,5 km) ve geriye sıçrama ayrılır. 90 sn rota dışında kalınırsa "Buradan yeni rota".
- **Batarya:** OBD bağlıysa 5 sn'de bir ölçüm; değilse plandan tahmin, göstergedeki değer elle girilerek düzeltilir.
- **Canlı tüketim katsayısı:** OBD enerji sayaçlarından ölçülen / model; 15 km'den sonra devreye girer, 60 km'de tam güven, 0,8–1,45 arası.
- **Karar:** plan tutuyor · pay dar (hızı düşür) · yetmiyor (otomatik yeniden planlama) · plandan önde · rota dışı. Sesli ve titreşimli; aynı uyarı yinelenmez.
- **Ön ısıtma hatırlatması:** planın söylediği km'de, hücre hâlâ soğuksa.
- **Durakta:** OBD DC şarjı görünce hedefe kalan dakika, anlık kW, istasyon beklenenden yavaşsa uyarı, hedefe varınca "yola çıkabilirsin" (işgaliye).
- **Tazeleme:** 30 dakikada bir kalan yolun havası yeniden alınır ve plan güncellenir.
- Ekran açık tutulur (Wake Lock). Arka plan: aşağıdaki ön plan servisi.

## En iyi durak planı, hız önerisi, belirsizlik (Eylül 2026)

- **Dinamik programlama** (`core/optimum.js`): düğümler rota üstü istasyonlar (8 km'lik dilimde en güçlü 3),
  durum ayrılış SoC'si (%1). Amaç: şarj + durak sabit süresi + sapma süresi (+ TL × zaman değeri).
  Tek durakta %95'e kadar dolum serbest; %80 üstü yavaş ama bir durağı atlatıyorsa seçilir.
  300 rastgele rotada açgözlü yönteme göre ortalama 16 dk, ortanca 11 dk, en çok 77 dk kısa; hiçbirinde uzun değil.
  600 km rota ve 480 istasyonla tek plan ~14 ms.
- **Toplam süreye sapma dahil:** istasyona gidiş-dönüş sürüşü artık toplam süreye ekleniyor.
- **Hız önerisi:** limitin %90–110'u arasında toplam süre (sürüş + şarj) karşılaştırılır, 3 dk'dan fazla kazanç varsa önerilir.
- **Belirsizlik** (`core/risk.js`): her bacak için %90 alt sınır. σ = bacak enerjisi × √(model² + hava²);
  model %6 (kalibrasyonsuz) / %3 (≥ 3 OBD yolculuğu), hava = model senaryoları yayılımı / 4.
- **Zamanın değeri:** Hesap menüsünde TL/saat girilirse planlayıcı ucuz–yavaş ile pahalı–hızlı arasında buna göre seçer.
- **İsabet** (`core/isabet.js`): OBD yolculuklarında tahmin/ölçüm ortalama mutlak hatası; OBD panelinde.
- Yolda modunda yeniden planlama da aynı en iyi planlayıcıyı kullanır.

## Ön plan servisi: Haritalar öndeyken ve ekran kilitliyken (Eylül 2026)

Yerel Capacitor eklentisi `plugins/yol-servisi` (Java), JS tarafı `www/servis.js`.
- Servis türü konum + bağlı cihaz; bildirim çubuğunda sürekli kart. Kısmi uyanık tutma kilidi (en çok 10 sa).
- **Tik:** 5 sn'de bir yerel olay. OBD okuması ve karar hesabı buna bağlı; tarayıcı zamanlayıcıları arka planda kısılsa da sürer.
- **Konum:** GPS doğrudan servisten; tarayıcı konumu yedek (yerel son 10 sn'de geldiyse yok sayılır).
- **Ses:** Android metin okuması, navigasyon kılavuzu ses türüyle; navigasyonu susturmaz, kısar (ducking). Türkçe ses paketi yoksa uyarı.
- **Bildirim kartı:** "Kırşehir ZES: 42 km, 25 dk · varışta %24 (plan %24)"; düğmeler: Yeniden planla, Durağa git. Şarjda: hedefe kalan dakika, kW, "Yola devam".
- **Bekçi:** JS 45 sn bildirimi güncellemezse kart "yanıt vermiyor" der. Arka planda WebView'in çalışıp çalışmadığı cihazda böyle görülür.
- Kullanıcılar: yolda modu ve OBD kaydı; ikisi de bırakınca servis durur.
- Doğrulanmadı: WebView JS'inin arka planda yerel olaylarla sürmesi (Android/WebView sürümüne bağlı). Durursa sıradaki adım karar hesabını servis içinde QuickJS ile çalıştırmak.
