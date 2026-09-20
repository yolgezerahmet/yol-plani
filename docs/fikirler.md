# Başka uygulamalardan ve başka alanlardan alınabilecekler

Tarama 20.09.2026. Amaç: bizim listemizde olmayan ama işe yarayan fikirleri bulmak.

## EV uygulamalarında var, bizde yok

| Kaynak | Özellik | Bizde karşılığı |
|---|---|---|
| PlugShare | Kullanıcı check-in'i, fotoğraf, istasyon güvenilirlik puanı | Kendi şarj kayıtlarımızdan kişisel istasyon karnesi (G3) |
| Chargeprice | Aynı istasyonda operatör bazında fiyat karşılaştırması | Türkiye'de yok; EPDK fiyat yayımlamayı zorunlu tutuyor, veri kaynağı var |
| Tesla seyahat planlayıcı | Yolda canlı yeniden tahmin: varış şarjı sürüş boyunca güncellenir | F5 ile örtüşüyor, önceliği yükseltilmeli |
| Tesla / Hyundai | Hedef şarja göre otomatik batarya ön koşullama | D5 var; tetikleme mesafesini biz hesaplayabiliriz |
| Fastned, Electra | Canlı doluluk | Türkiye'de operatör uygulamalarında; açık API yok |
| ChargePoint | Sıraya girme (waitlist) | Kapsam dışı |
| Google/Apple Haritalar | Çevrimdışı harita, şerit yönlendirme | B5 bizde var, şerit gereksiz |
| Rangea | Verimliliği benzer araçlarla kıyaslama | Tek araç için anlamsız; kendi geçmişimizle kıyas daha değerli |

## Başka alanlardan

Havacılık uçuş planı, en verimli kaynak:

- Yedek (alternate) zorunluluğu. Her şarj durağı için ulaşılabilir bir yedek istasyon.
  İstasyon arıza oranları düşünce bile %14 dolayında; Türkiye'de daha yüksek olması beklenir.
  En değerli eksik özellik bu.
- Dönüş noktası (point of no return): bu km'den sonra geri dönmek ileri gitmekten pahalı.
- Yakıt rezervi kuralı: sabit %15 yerine, kalan mesafenin belirsizliğine göre değişen rezerv.
- Git/gitme karar kapısı: yola çıkmadan tek ekranda plan, yedek ve hava kontrolü.

Kamyon ve filo rotalaması: sürüş süresi kuralları → mola ritmi (D4); geçiş ücreti optimizasyonu
→ rota motoru artık ucretliKm veriyor, HGS maliyeti eklenebilir.

Ralli yol defteri: bölüm bölüm tempo notu; bizim bölüm mantığımızın ta kendisi. Sürüş öncesi
hız kartı çıktısı olarak verilebilir.

Denizcilik: gelgit penceresi → çıkış saati penceresi (C5, zaten planlı).

## Önceliğe alınanlar (yeni)

| # | Özellik | Neden |
|---|---|---|
| I1 | Yedek istasyon zinciri | Her durak için ulaşılabilir alternatif; arıza gerçek ve sık |
| I2 | Operatör fiyat karşılaştırması | Türkiye'de 181 lisanslı işletmeci, fiyatlar çok farklı, yayımlanması zorunlu |
| I3 | Geçiş ücreti (HGS) maliyeti | Rota karşılaştırmasının eksik ayağı; 464 km'ye karşı 170 km |
| I4 | Dönüş noktası ve dinamik rezerv | Sabit %15 rezerv ya fazla ya eksik |
| I5 | Git/gitme kapısı | Tüm kontrolleri tek ekranda toplar |
| I6 | Sürüş öncesi hız kartı | Bölüm bölüm hedef hız; telefona bakmadan uygulanabilir |

## Bilerek almadıklarım

- Şarj oturumu başlatma ve ödeme: operatör uygulamalarının işi, API'leri kapalı.
- Sosyal check-in ve fotoğraf: kullanıcı kütlesi olmadan boş kalır.
- Dönüşünü söyleyen navigasyon: araç navigasyonu ve Google zaten yapıyor.
- Android Auto: Google onay süreci hobi projesine uygun değil.
