# Veri kaynakları

| Katman | Kaynak | Erişim | Not |
|---|---|---|---|
| Rota, yol öznitelikleri | Valhalla (FOSSGIS, OpenStreetMap) | Anahtarsız, çalışma anında | `route`, `trace_attributes`, `height` |
| Hava | Open-Meteo | Anahtarsız, çalışma anında | Bölüm bazlı, varış saatine göre |
| Yer arama | Nominatim | Anahtarsız, çalışma anında | Yalnızca çıkış/varış kutusu |
| **Şarj istasyonları** | **EPDK REST servisi** | Anahtarsız, **saatte bir** tam liste | Haftalık iş akışı → APK'ya gömülü paket |

## EPDK şarj istasyonları

`GET https://apigateway.epdk.gov.tr/sarjIstasyonlari`, gövde `{}`. Kılavuz: EPDK Web Servisleri
sayfası, "Şarj İstasyonları Listesinde Yer Alan Şarj İstasyonlarının Sorgulanmasına İlişkin REST
Web Servis". Parametresiz sorgu saatte bir, parametreli sorgu (lisansNo, markaAdi…) dakikada bir.

21.09.2026: 16.856 istasyon; halka açık ve CCS ≥ 50 kW olan 7.595'inin tamamı koordinatlı.
Kayseri (238) ve Kahramanmaraş (60) sayıları lisans portalı XLS raporuyla birebir tuttu.

Paket (`www/data/epdk.json`, ~740 KB): halka açık, CCS ≥ 50 kW, koordinatlı istasyonlar; alan
listesi dosyanın içinde. `scripts/epdk-guncelle.mjs` üretir, `.github/workflows/veri.yml` her
pazartesi çalıştırır, değişiklik varsa işler ve APK derlemesini başlatır. İstasyon sayısı bir
önceki paketin %80'inin altına düşerse yazmaz (eksik yanıt koruması).

## Elenenler

- **Open Charge Map**: Türkiye koridorlarında EPDK'nın yaklaşık yüzde biri kadar kayıt.
- **OSM `amenity=charging_station`**: Kayseri kutusunda 16 kayıt, güç alanları boş.
- **Operatör siteleri**: tutarsız, harita uç noktalarını düzenli sorgulamak niyetlerinin dışında.
- **Lisans portalı XLS + OSM mahalle eşleştirmesi** (`yerad.js`): EPDK REST koordinatları varken
  gereksiz; kod yedek yol olarak duruyor.

## Gerçek rotada kapsam (Ayrancı → Kahramanmaraş)

Her iki alternatifte de rotaya 5 km içinde ~480 hızlı istasyon; en büyük boşluk 57–62 km.

## Hava: çok kaynak ve sınama (Eylül 2026)

- **Topluluk:** Open-Meteo tek istekte dört bağımsız model: ECMWF IFS, DWD ICON, NOAA GFS, Météo-France.
  Saat saat ortanca kullanılır; rüzgâr yönü (u, v) bileşenlerinden birleştirilir. Modeller arası açılma
  sıcaklıkta ≥ 5 °C ya da rüzgârda ≥ 6 m/s olursa "tahmin belirsiz" uyarısı çıkar.
- **Senaryo bandı:** Her model ayrı çalıştırılır; özet "4 hava modeline göre varış %X ile %Y arasında" der.
- **Gözlem sınaması:** NOAA aviationweather.gov METAR (rota kutusundaki havalimanları, son 2 saat).
  En az iki istasyon aynı yönde ≥ 2 °C sapıyorsa ilk saatler ölçüme çekilir, düzeltme 6 saatte söner.
- Topluluk alınamazsa tek model (eski yol); METAR alınamazsa sınama atlanır.

## Yol durumu

- **KGM Günlük Yol Durumu Bülteni** (kgm.gov.tr, HTML tablo): yapım, bakım, şerit kapatma, kapalı yollar.
  Rotaya eşleme: Valhalla'nın OSM yol adları (güçlü) ya da bülten metnindeki yer adlarının rotaya
  yakınlığı (en az iki yer; şehir çevre yolunda bir yer). Yön bildiren adlar ("Ankara istikameti") sayılmaz.
  Yer sözlüğü EPDK paketindeki il/ilçe adlarından çevrimdışı çıkarılır. Eşleme yaklaşıktır; ekranda böyle söylenir.

## Bilinçli olarak yapılmayanlar / açık konular

- **Canlı trafik:** Türkiye geneli için açık, anahtarsız bir canlı trafik akışı yok. Canlı trafik ve
  yeniden rotalama "Yola çık" ile açılan Google Haritalar'da kalıyor. Aday: KGM Trafik Hacim Haritaları
  (yıllık ortalama günlük trafik) ve bayram/tatil takvimiyle yoğunluk uyarısı.
- **EDS / hız koridorları:** EGM'nin resmî EDS haritası (onlineislemler.egm.gov.tr) sabit noktaları ve
  koridorları yayımlıyor; veri uç noktası henüz incelenmedi. Amaç ceza kaçırmak değil, koridorlarda gerçek
  seyir hızını (limit) modele doğru vermek. Gezici radar konumu toplanmaz ve gösterilmez.

## KGM kapalı yollar servisi (21.09.2026'da eklendi)

- Uç: `https://yol.kgm.gov.tr/kapaliyollar/api/workings/search` — resmî "Kapalı Yollar" harita uygulamasının
  kullandığı anahtarsız JSON. Belgelenmiş bir açık API değildir; arayüz değişirse kırılabilir, o durumda
  ekranda "ulaşılamadı" yazar ve bülten eşlemesi çalışmaya devam eder.
- Her kayıt: neden (heyelan, çökme, kar ve tipi, çığ, sel, kaza…), yol no, km aralığı, kış programı ve
  `extent` = [boylamMin, enlemMin, boylamMax, enlemMax]. Sıra Cide–İnebolu kaydıyla doğrulandı.
- Eşleme: rota şeklinin bir noktası kutunun 300 m paylı hâline düşüyorsa kayıt rotadadır. Bültendeki
  yer adı eşlemesinin aksine kesindir.
- CORS başlığı yok: tarayıcıda çalışmaz, APK'da CapacitorHttp ile çalışır. NOAA METAR için de aynısı geçerli.
- Yalnızca "kapalı yol" listesi döner (21.09.2026: 21 kayıt). "Çalışma yapılan yol" listesi için sorgu
  parametresi bulunamadı; o bilgi günlük bültenden gelmeye devam ediyor.

## Bilinçli olarak eklenmeyenler

- **MET Norway:** anahtarsız ve açık, ancak Türkiye için ECMWF'e dayanır; toplulukta ECMWF zaten var,
  bağımsız bir görüş katmaz.
- **MGM:** resmî açık API'si yok; bilinen uç başlık taklidi gerektiriyor. Gözlem için NOAA METAR kullanılıyor
  (aynı havalimanı istasyonları, açık lisans).
- **Canlı trafik yoğunluğu:** Türkiye geneli için açık ve anahtarsız bir kaynak yok. İBB açık verisi yalnızca
  İstanbul'u kapsar. TomTom/HERE ücretsiz katmanları anahtar ister ve açık veri değildir. Bölüm süreleri
  Valhalla'nın o kesim için ölçülü ortalama hızından gelir (günün saatine duyarsız).
- **Gezici radar / anlık denetim:** toplanmaz. Sabit EDS ve ortalama hız koridorları OSM'den gelir ve eksiktir
  (21.09.2026: 733 kamera, 16 koridor ilişkisi; gerçek sayı bunun katları).
