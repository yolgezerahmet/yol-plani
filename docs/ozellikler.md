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
| B1 | Otomatik bölümleme | Başlangıç–varıştan rota; limit ya da yol sınıfı değişiminde yeni bölüm; etiketsiz limitler "tahmini" işaretli | ☐ |
| B2 | Rakım profili | Tırmanış ve iniş ayrı toplanır (net fark değil); örnek rotada toplam tırmanış DEM ile ±%10 | ☐ |
| B3 | Hızlanma ve geçiş kayıpları | Limit düşüşleri, dönel kavşak ve ışık sayılır; geçiş başına ΔKE × (1 − rejenerasyon verimi) eklenir | ☐ |
| B4 | Alternatif rota karşılaştırma | En az iki rota: toplam süre, enerji, durak sayısı, maliyet yan yana | ☐ |
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
