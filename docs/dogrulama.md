# Gerçek veriyle doğrulama

## Ankara Kızılay → Kahramanmaraş, 20.09.2026

FOSSGIS açık Valhalla sunucusu, `auto` maliyet modeli, iki alternatif rota.
Model: 63 kWh RWD, 2.150 kg, 20 °C, rüzgârsız, 900 m ortalama rakım.

| Rota | km | Bölüm | Tırmanış | İniş | Enerji (limitte) | Enerji (%92) | Süre (%92) | Valhalla süre |
|---|---|---|---|---|---|---|---|---|
| Otoyol (Niğde–Adana) | 685 | 20 | 7.113 m | 7.406 m | 163,3 kWh | 153,5 kWh | 6,87 sa | 6,45 sa |
| Alternatif (Kayseri–Göksun) | 601 | 22 | 5.571 m | 5.920 m | 127,1 kWh | 118,8 kWh | 7,04 sa | 6,65 sa |

Çıkarım: otoyol 84 km daha uzun ve limitleri yüksek (274 km'si 140 km/h), bu yüzden **%29 daha fazla
enerji** istiyor — bir şarj durağı farkı. Süreler birbirine yakın. Sabit tüketim varsayan
planlayıcılar bu karşılaştırmayı gösteremez.

## Bu koşuda görülen veri sınırları

### Limit kapsamı
Otoyol rotasının %92'sinde OSM hız limiti etiketi var. Alternatif rotanın 355 km'sinde yok;
yol sınıfından varsayılan atanıyor ve bölüm `tahminiLimit` işaretiyle dönüyor.

### Yerleşim geçişleri güvenilir değil
601 km'lik alternatif rotada yalnızca 9 geçiş bulunabildi (toplam 0,5 kWh). Valhalla'nın akış hızı
devlet yollarında kasabalarda düşmüyor: 1.059 kenar boyunca 20 km/h'ı aşan bitişik düşüş sayısı 11.
Yoğunluk etiketi (density ≥ 8) de yalnızca 27 km'yi yerleşim sayıyor. Gerçek kayıp bunun birkaç katı
olmalı — bir kasaba geçişi 120 km/h'tan 50'ye inişte 0,11 kWh tutuyor.

Kalıcı çözüm: OBD sürüş kaydından gerçek hız profilini öğrenmek (A3, H1). O zamana kadar bu kalem
sistematik olarak **iyimser**.

### DEM gürültüsü
Ham yükseklik örnekleri düzensiz aralıklı (virajda 10 m). Doğrudan toplanınca otoyol rotasında
11.369 m tırmanış çıkıyor; eşik duyarlılığı:

| Histerezis | Tırmanış (ham örnekleme) |
|---|---|
| 0 m | 11.369 m |
| 8 m | 8.597 m |
| 25 m | 6.238 m |
| 60 m | 4.069 m |

200 m'ye yeniden örnekleme + 10 m histerezis 7.113 m veriyor. Net yükseklik farkı (−340 m)
her eşikte doğru kalıyor, yani yöntem enerji korunumunu bozmuyor. Tünel ve viyüklerde DEM araziyi
gösterdiği için bir miktar fazlalık kalıyor.

### Akış oranı artık ölçülü
Bölüm süresi, yol tipine göre sabit katsayı yerine Valhalla'nın o bölümdeki ortalama hızı / limit
oranıyla hesaplanıyor. Toplam süreler Valhalla'nınkine %6 içinde yaklaşıyor.

## Yöntem notu

Bu koşu geliştirme makinesinde canlı servislere karşı yapıldı; CI'daki testler sentetik veriyle
aynı davranışları doğrular (gürültü eleme, çukur bulma, kısa parça yutma, uzun bölüm bölme).
