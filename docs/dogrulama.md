
## İkinci koşu: tam parametreli motor (20.09.2026)

Valhalla'nın tüm kenar öznitelikleri parametreye çevrildikten sonra aynı rotalar:

| | Otoyol | Alternatif |
|---|---|---|
| Mesafe | 685 km | 601 km |
| Enerji (limitte, 20 °C) | 161,4 kWh · 236 Wh/km | 124,5 kWh · 207 Wh/km |
| Süre | 6,58 sa | 6,74 sa (Valhalla 6,45 / 6,65) |
| Tırmanış / iniş | 6.153 / 6.502 m | 5.059 / 5.409 m |
| Tünel / köprü | 10,5 / 19,0 km | 17,1 / 7,4 km |
| **Ücretli yol** | **464 km** | **170 km** |
| **Döner kavşak** | **4** | **34** |
| Işık | 3 | 3 |
| Olay süresi / enerjisi | 2 dk · 0,2 kWh | 8 dk · 1,8 kWh |
| Etiketsiz limit | 56 km | 355 km |
| Rakım aralığı | 78–1.346 m | 478–1.627 m |

### Bu koşunun getirdikleri

- **Döner kavşaklar bulundu.** Alternatif rotada 34 tane; her biri ~25 km/h'a inip yeniden
  hızlanma demek. Toplam 1,8 kWh ve 8 dakika. Bir önceki koşuda bu kalem görünmüyordu.
- **Ücretli yol ayrıştı.** 464 km'ye karşı 170 km; otoyolun gişe maliyeti artık hesaplanabilir.
- **Tünel maskesi tırmanışı düzeltti.** Otoyolda 7.113 → 6.153 m (−960 m), alternatifte
  5.571 → 5.059 m. Tünel ve viyadük aralıklarında DEM araziyi gösteriyordu.
- **Rakım artık bölüm bazlı.** Otoyol rotası 78 m ile 1.346 m arasında geziyor; hava yoğunluğu
  bu iki uçta %15 fark ediyor. Tek bir ortalama rakım kullanmak bu farkı siliyordu.
- **Yol yönü çıktı.** Her bölümün dairesel ağırlıklı yönü hesaplanıyor; rüzgârın boyuna ve yanal
  bileşenine ayrılması için gereken son parça buydu.

### Yeni görülen veri sorunları

- **Eğim değerleri güvenilmez.** Kenar bazında `max_upward_grade` %52'ye kadar çıkıyor —
  fiziksel olarak imkânsız. %12 tavanıyla kırpılıyor ve bölüm `egimSuphe` bayrağıyla işaretleniyor;
  40 bölümün 37'si bu bayrağı taşıyor. Bu yüzden eğim, enerji hesabında DEM profilinin yerine
  değil, yanında bilgi olarak duruyor.
- **Trafik ışığı verisi neredeyse yok.** İki rotada toplam 6 ışık göründü; gerçekte çok daha fazla.
  Kavşak sayısı da 0 döndü. Kasaba geçişi kestirimi hâlâ yoğunluk etiketine bağlı ve iyimser.
- **Yüzey tekdüze.** Her iki rotanın tamamı `paved_smooth`; yüzey çarpanı bu koridorda
  ayırt edici değil, ama toprak ve stabilize yolların olduğu rotalarda devreye girecek.

## İstasyon verisi: Open Charge Map, Türkiye (20.09.2026)

Ankara–Kahramanmaraş koridorunda 9 noktadan 40 km yarıçapla, DC ≥ 50 kW, toplam 96 ham kayıt;
CCS2 ve güç bilgisi olan 95'i kullanılabilir.

| | Alternatif rota (601 km) | Otoyol rotası (685 km) |
|---|---|---|
| Rota üstünde (≤5 km sapma) | 20 istasyon | 15 istasyon |
| Ankara çıkışı dışında kalan | 8 | 3 |
| En uzun boşluk | Gölbaşı 38 km → Kırşehir 214 km = **176 km** | Gölbaşı 38 km → Türkoğlu 661 km = **623 km** |

### Sonuç: otoyol rotası bu veriye göre 63 kWh ile yapılamaz

OCM verisinde otoyol koridorunda 38. km ile 661. km arasında **hiç DC istasyon yok**.
Gerçekte Niğde–Adana hattında istasyon olduğu neredeyse kesin; yani bu bir veri boşluğu,
gerçek bir boşluk değil. Ama planlayıcı elindeki veriyle çalışır, bu yüzden bu durum
kullanıcıya "veri yetersiz" diye bildirilmeli, sessizce "rota yapılamaz" denmemeli.

### Veri güveni dağılımı

95 istasyonun 35'i son 6 ayda güncellenmiş (tam güven), 43'ü arada, 17'si iki yıldan eski.
Yedek zincirinde güven ortalaması durağa göre 0,35 ile 1,00 arasında değişiyor:
Göksun durağının yedekleri 0,35 — yani listelenen alternatifler iki yıldır doğrulanmamış.

### Yedek zinciri, alternatif rota

| Durak | Güç | Varış | Yedek sayısı | Veri güveni |
|---|---|---|---|---|
| 219 km Kırşehir | 120 kW | 10,3 kWh | 3 | 1,00 |
| 352 km Kayseri | 180 kW | 21,3 kWh | 2 | 0,64 |
| 529 km Göksun | 150 kW | 12,6 kWh | 2 | 0,35 |
| 599 km Maraş | 180 kW | 33,9 kWh | 1 | 0,95 |

Her durağın en az bir yedeği var; ama yedeklerin bir kısmı geriye dönmeyi gerektiriyor
(ör. 529 km durağının yedeği 438 km'de). Bu doğru davranış: yedek, bir önceki duraktan
ulaşılabilen istasyondur, ille de ileride olması gerekmez.

### Karar

OCM Türkiye için **tek başına yeterli değil**: EPDK Eylül 2025'te 35.894 soket bildiriyor,
OCM'de ülke genelinde 2.275 konum var. Kullanım biçimi şu olmalı:
- OCM taban katman, her istasyon güven puanıyla gösterilir.
- Kullanıcı elle istasyon ekleyebilir (kendi bildiği yerler).
- Gerçek şarj kayıtlarından kişisel istasyon veritabanı büyür (G3) — zamanla en güvenilir kaynak bu olur.
- "Yedek yok" çıktısı, "istasyon yok" değil "veride yok" diye okunmalı.

## EPDK resmî raporu (Ankara, 20.09.2026)

EPDK lisans portalındaki "Raporla" düğmesiyle indirilen XLS. Kazıma yok: veri resmî yoldan dışa aktarıldı.

| | EPDK raporu | Open Charge Map |
|---|---|---|
| Ankara, toplam istasyon | 500 (rapor 500 satırda kesiliyor) | 200 |
| CCS ≥ 50 kW | **198** | 75 |
| Bunlardan halka açık | 186 | — |
| Soket tipi dökümü | 886 AC Type2, 592 DC CCS, 5 CHAdeMO | — |
| Koordinat | **yok** | var |

EPDK 2,6 kat daha fazla hızlı şarj istasyonu biliyor. Eksik olan tek şey konum.

### Raporun getirdiği alanlar

İstasyon no (ŞRJ/…), ad, hizmet şekli (halka açık / özel), marka, **şarj ağı işletmecisi**,
istasyon işletmecisi, yeşil şarj (YEK-G), adres, ve her soket için **tip (AC/DC), tür
(CCS/CHAdeMO/Type2) ve güç**. Bunlar OCM'de ya yok ya eksik.

Marka dağılımı (Ankara): ZES 39, Trugo 36, Epsis 35, Ecobox 29, Voltrun 27, Neva Şarj 26, Eşarj 22, Astor 18.

### Konum sorunu ve çözümü

Adresler "Ümit Mahallesi 2479 Sokağı No:2 Çankaya / ANKARA" biçiminde. Ayrıştırıcı 500 kaydın
tamamında ilçeyi, 491'inde mahalleyi çıkarabiliyor.

Nominatim denemesi: **sokak düzeyi tutmuyor, mahalle düzeyi tutuyor.** Altı adresin altısında da
tam adres sorgusu boş döndü; "Mahalle, İlçe, İl" biçimi altısında da sonuç verdi. Ankara'nın
DC istasyonları 124 benzersiz mahalleye düşüyor, yani 124 sorgu tüm ili kapsıyor.

Bu yüzden konum üç kademeli:
1. **Kesin** — OCM kaydıyla eşleşirse (marka + ilçe + güç benzerliği) onun koordinatı alınır.
2. **Mahalle** — mahalle merkez noktası; ±1-2 km, açıkça işaretlenir, güven 0,7'ye düşer.
3. **Yok** — hiçbiri tutmazsa istasyon listelenir ama haritaya konmaz.

Mahalle merkezi rota planlaması için yeterli (sapma eşiği 5 km), ama "beni oraya götür" için
yeterli değil. Uygulama bunu kullanıcıya söylemek zorunda.

### Rapor sınırı

Çıktı 500 satırda kesiliyor. Ankara'nın tamamı için ilçe ilçe ya da marka marka indirmek gerekiyor.
Türkiye geneli için 81 il × birkaç sorgu; elle yapılabilir ama otomatik değil.

## Üç il birlikte: EPDK vs OCM (20.09.2026)

Ankara, Kayseri ve Kahramanmaraş raporları indirildi (her biri EPDK portalından "Raporla" ile).

| İl | Rapordaki istasyon | Halka açık DC ≥50 kW | 150 kW+ | OCM'de DC ≥50 (ilçe merkezi çevresi) |
|---|---|---|---|---|
| Ankara | 500 (kesilmiş) | 186 | 103 | 75 |
| Kayseri | 351 | **238** | 105 | 1–3 |
| Kahramanmaraş | 96 | 60 | 39 | 3 |

Toplam güç dağılımı: 50–99 kW 140 adet, 100–149 kW 97, 150–249 kW **222**, 250 kW+ 25.

### Koridor ilçelerinde OCM'nin ne kadar eksik olduğu

| İlçe | EPDK halka açık DC | OCM (15 km) |
|---|---|---|
| Kayseri Melikgazi | 112 | — |
| Kayseri Kocasinan | 74 | — |
| **Pınarbaşı** | **9** | 1 |
| **Göksun** | **3** | 1 |
| **Sarız** | **3** | **0** |
| Elbistan | 5 | **0** |
| Türkoğlu | 3 | 2 |
| Maraş Onikişubat | 29 | — |

Önceki koşuda "Kayseri'de 30 km içinde 1 DC istasyon" çıkmıştı; gerçek sayı **186**.
Sarız ve Elbistan'da OCM sıfır gösteriyor, EPDK'da istasyon var.

**Sonuç: OCM Türkiye koridorlarında kullanılamaz.** EPDK raporu asıl kaynak olmalı,
OCM yalnızca koordinat ödünç almak için ikincil.

### Konum: ilçe merkezi yeterli mi

258 koridor istasyonu ilçe merkezine konumlandırıldı. Küçük ilçelerde (Pınarbaşı, Göksun, Sarız)
ilçe merkezi ile gerçek istasyon arasındaki fark birkaç km; rota sapma eşiği 5 km olduğu için
planlama açısından kabul edilebilir. Büyük şehirlerde (Melikgazi'de 112 istasyon aynı noktaya
düşüyor) ilçe merkezi anlamsız — orada mahalle düzeyi şart.

Kural: **şehir içi mahalle, koridor ilçeleri için ilçe merkezi yeterli.**
Her iki durumda da konum "yaklaşık" işaretiyle gösterilir.

## Diğer Türkiye kaynakları taraması (20.09.2026)

Koordinat sorununa çözüm ararken denenen kaynaklar.

### Denenip elenenler

**Open Charge Map** — Kayseri kutusunda EPDK 238 gösterirken OCM 1–3. Türkiye koridorlarında
kullanılamaz; yalnızca koordinat ödünç almak için ikincil kaynak.

**OpenStreetMap şarj istasyonları** (`amenity=charging_station`, Overpass) — Kayseri kutusunda
**16 istasyon**. OCM'den iyi değil. Etiketler de zayıf: `socket:type2_combo` ve güç alanları
çoğunlukla boş, operatör adı var (SHARZ, Renault). İstasyon kaynağı olarak yetersiz,
ama operatör adı üzerinden koordinat eşleştirmede işe yarayabilir.

**Operatör siteleri** (ZES, Trugo, Eşarj, Voltrun, Astor, Sharz) — SSL hatası, 404, 429, zaman
aşımı. Tutarsız ve kırılgan; ayrıca herkese açık harita uç noktalarını düzenli sorgulamak
niyetlerinin dışında. Bu yola girilmedi.

**Nominatim sokak düzeyi** — Türkiye adreslerinde tutmuyor (6/6 boş). Mahalle düzeyi çalışıyor
ama istek başına ~1 sn sınırı var; 81 il × ~120 mahalle = on binlerce sorgu demek. Ölçeklenmez.

### İşe yarayan: OSM yer noktaları toplu indirme

`place=neighbourhood|suburb|quarter|village|town|city` düğümleri Overpass'tan **il başına tek
sorguda** iniyor, saniyeler içinde, sınır yok:

| İl | Yer noktası | Dağılım |
|---|---|---|
| Ankara | 2.267 | köy 1.277, suburb 620, mahalle 243, quarter 83 |
| Kayseri | 1.612 | suburb 736, köy 717, mahalle 127 |
| Kahramanmaraş | 2.033 | köy 953, mahalle 696, suburb 349 |

EPDK mahalle adlarını bu listeyle **çevrimdışı** eşleştirme isabeti (tam ad eşleşmesi, DC istasyonları):

| İl | Eşleşen | Oran |
|---|---|---|
| Ankara | 15/15 | %100 |
| Kayseri | 39/46 | %85 |
| Kahramanmaraş | 9/15 | %60 |

Eşleşmeyenler yazım farkından: "Mimarsinan" ↔ "Mimar Sinan", "Ertuğrul Gazi" ↔ "Ertuğrulgazi",
"Yıldırım Beyazıt" ↔ "Yıldırımbeyazıt". Boşluk ve büyük/küçük harf normalleştirmesiyle
isabetin %90'ın üstüne çıkması bekleniyor.

**Karar: coğrafi kodlama çevrimdışı olacak.** İl başına bir Overpass sorgusu, sonuç depoda
saklanır, eşleştirme cihazda yapılır. Ağ çağrısı yok, kota yok, uçuş modunda çalışır.

### Kapsam dışı bırakılanlar

**KGM ücret tarifeleri** — HGS geçiş maliyeti (fikir I3) için gerekli. Resmî API yok; tarife
PDF/tablo olarak yayımlanıyor, yılda birkaç kez güncelleniyor. Elle girilen küçük bir tablo
yeterli; otoyol rotasında 464 km ücretli yol var, maliyet hesabı anlamlı.

**KGM güzergâh analizi / yol durumu** — `yol.kgm.gov.tr` üzerinde arayüz var, API yok.

## EPDK REST servisi: resmî koordinatlar (21.09.2026)

`apigateway.epdk.gov.tr/sarjIstasyonlari` — EPDK web servisleri sayfasındaki kullanım kılavuzuna göre
parametresiz GET tüm istasyonları döndürür, **saatte bir** sorgu hakkı vardır; parametreli sorgu
dakikada bir. Önceki denemelerdeki kota hatası bu sınırdan kaynaklanıyordu.

Tek sorguda: **16.856 istasyon**, 15,8 MB. Halka açık ve CCS ≥ 50 kW: **7.595**; hepsi koordinatlı,
hepsi Türkiye sınırları içinde, enlem-boylamı yer değiştirmiş kayıt yok. Yalnızca 11'i iki ondalık
basamak (±1 km) hassasiyetinde. Güç: 50–99 kW 1.569, 100–149 kW 2.342, 150–249 kW 3.175, 250+ 509.

XLS raporuyla çapraz kontrol: Kayseri 238 = 238, Kahramanmaraş 60 = 60. Ankara 710 (XLS 500 satırda
kesildiği için 186 görünüyordu).

### Gerçek rotalarda (Valhalla, Ayrancı → Kahramanmaraş)

| | Otoyol (Niğde–Adana) | Kayseri–Göksun |
|---|---|---|
| Uzunluk | 684 km | 600 km |
| Rotaya ≤ 5 km hızlı istasyon | 487 | 476 |
| En büyük boşluk | 57 km (257–314) | 62 km (151–213) |

Önceki "otoyolda 623 km boşluk" sonucu tamamen Open Charge Map'in eksikliğiymiş. Gerçekte iki rotada
da hiçbir yerde 62 km'den uzun hızlı şarj boşluğu yok; 63 kWh araç için menzil kaygısı yok, yalnızca
en verimli durak seçimi var.

**Karar:** OSM mahalle eşleştirmesi (yerad.js) ve XLS yolu artık ana akışta değil. Paket haftalık
GitHub Actions ile yenilenir (`veri.yml`), APK'ya gömülür, uygulama çevrimdışı çalışır.

## ABRP ile kıyas protokolü

"ABRP'den daha iyi" iddiası ölçülmeden yapılmaz. Kıyas şöyle yapılır:

1. Yola çıkmadan aynı çıkış, varış, çıkış saati, başlangıç SoC'si, varış hedefi ve hız ayarıyla hem ABRP'de
   hem Yol Planı'nda plan alınır. İki planın ekran görüntüsü saklanır: durak listesi, durak başına varış
   SoC'si, şarj süreleri, toplam süre, varış SoC'si.
2. Yolculuk Yol Planı'nın OBD kaydı açıkken yapılır (hangi planın durakları izlendiği not edilir).
3. Yolculuk sonunda her durağa gerçek varış SoC'si, gerçek şarj süresi ve toplam süre kayıttan alınır.
4. Ölçütler: durak başına varış SoC hatası (puan), toplam enerji hatası (%), toplam süre hatası (dk),
   ve izlenen planın gerçek toplam süresi. Bir yolculuk sonuç değildir; en az 5 yolculuk, farklı mevsim.

Uygulama içinde yalnız kendi tahminimizin isabeti otomatik tutulur (`core/isabet.js`, OBD panelinde
"tahmin isabeti"). ABRP tarafı elle kaydedilir.

### Yöntemsel farklar (ölçülmemiş, tasarım gereği)
| | Yol Planı | ABRP (herkese açık bilgiye göre) |
|---|---|---|
| Durak seçimi | Dinamik programlama; tüm istasyon × batarya düzeyi birleşimleri, amaç toplam süre (+ isteğe bağlı TL) | Toplam süreyi en aza indiren kapalı algoritma |
| Belirsizlik | Her bacak için %90 alt sınır; hava modeli yayılımı + model hatası | Tek sayı |
| Maliyet | Türkiye operatör fiyatları, zamanın TL değeriyle seçim | Sınırlı |
| İstasyon verisi | EPDK resmî listesi (haftalık) | Kendi veritabanı |
| Hava | 4 model + METAR sınaması | Tek kaynak (bilinmiyor) |
| Batarya ısısı | Tek kütleli ısıl model, ön ısıtma zamanlaması | Var (ayrıntı kapalı) |
| Kalibrasyon | OBD sayaçlarından tüketim, sıcaklık–şarj tablosu, kapasite | OBD canlı veriyle referans tüketim |
