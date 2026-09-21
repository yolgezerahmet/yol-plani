# Vizyon: gerçek araç kullanıcılarına en iyi yolculuk planı

Yol Planı bir navigasyon uygulaması değildir. Yolculuğun enerji tarafını hesaplar, planlar ve
aracın kendisinden öğrenir; yönlendirmeyi kullanıcının seçtiği navigasyona devreder.

## Katmanlar

1. **Planlama ve takip** — bölüm bölüm fizik, hava, batarya ısısı, EPDK istasyonları, OBD kalibrasyonu.
2. **Navigasyon devri** — Google Haritalar (şarj durakları ara nokta), Waze (sıradaki durak).
3. **Araç ekranı** — Android Auto'nun "şarj istasyonu" uygulama türüyle sıradaki durak kartı.

## Araç aileleri

Genişleme sırası, OBD ortaklığına ve bizim doğrulayabileceğimize göre:

| Aile | Modeller | Veri yolu | Durum |
|---|---|---|---|
| Hyundai/Kia E-GMP, 800 V | IONIQ 5, IONIQ 6, IONIQ 9, EV6, EV9, GV60 | OBD, BMS 7E4 220101 ailesi | IONIQ 5 63 kWh üzerinde doğrulanacak |
| Hyundai/Kia yeni nesil 400 V | EV3, EV4 ve benzerleri | OBD, bayt düzeni farklı olabilir | Kullanıcı çıktısıyla doğrulanmalı |
| Hyundai/Kia eski nesil | Kona Electric, Niro EV, IONIQ Electric | OBD, farklı PID düzeni | Topluluk tablosu var, doğrulanmadı |
| Tesla | Model 3, Model Y | OBD yerine resmî Tesla Fleet API | Geliştirici kaydı ve OAuth gerekir |

Aile başına değişen şeyler tek yerde toplanacak: kapasite, ağırlık, **CdA** (IONIQ 6 ile IONIQ 5
arasındaki aerodinamik fark otoyol tüketimini belirgin değiştirir), şarj eğrisi, 400/800 V davranışı,
ısıl katsayılar ve OBD çözücüsü.

## İlkeler

- **Kendi aracından öğrenir.** Katalog değeri başlangıçtır; OBD kaydı onun yerine geçer.
- **Kullanıcı verisi telefonda kalır.** Depo herkese açık; hiçbir kayıt, VIN ya da konum oraya gitmez.
- **Doğrulanmayan şey işaretlenir.** Tahmini katsayılar `[T]` etiketi taşır; ekranda yaklaşık olan söylenir.
- **Türkiye verisi birinci sınıf.** EPDK resmî istasyon listesi, Türkçe arayüz, yerel yol gerçekleri.
