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
