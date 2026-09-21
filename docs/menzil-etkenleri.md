# Menzili etkileyen süreçler: döküm ve durum

Durum: **M** modelde, **Y** yaklaşık (kaba katsayı), **K** OBD kalibrasyonu düzeltir, **–** henüz yok.
Katsayı kaynağı: [Ö] ölçüm/standart, [L] literatür, [T] tahmin.

## Yol ve araç fiziği
| Süreç | Durum | Nerede |
|---|---|---|
| Hava direnci: hız², hava yoğunluğu (sıcaklık, basınç, nem, rakım) | M | fizik.js, model.js |
| Rüzgâr: karşı/yan bileşen, yan rüzgârda CdA artışı | M [T] | fizik.js |
| Tavan kutusu, bisiklet, taşıyıcı (CdA +%6…30) | M [L] | kullanim.js |
| Açık cam, römork | – | |
| Yuvarlanma direnci: kütle, yol yüzeyi (OSM), soğuk lastik | M | model.js, rota.js |
| Lastik türü (yaz, dört mevsim, kış) | M [L] | kullanim.js |
| Lastik basıncı (soğukta düşer; TPMS 7A0/22C00B okunacak) | – | |
| Islak yol (+%15), karlı zemin (+%35) | Y [T] | model.js |
| Tırmanış ve iniş; rejenerasyon verimi, soğukta ve dolu bataryada kısılma | M [T] | fizik.js |
| Yük: kişi sayısı, bagaj | M | kullanim.js |
| Aktarma verimi sabit (0,90 RWD / 0,88 AWD); hıza ve yüke bağlı harita | Y, K | arac.js |
| Dur-kalk, hız dalgalanması | Y (yol tipi katsayısı) | model.js |
| Sürüş modu, i-Pedal, sürücü tarzı | K (tüketim katsayısı) | kalibrasyon.js |

## Isıl süreçler
| Süreç | Durum | Nerede |
|---|---|---|
| Kabin ısıtma: ısı pompası COP eğrisi; soğutma: EER | M [T] | fizik.js |
| Kabin hedef sıcaklığı, klima modu (oto, yalnız sürücü, eco, kapalı) | M [T] | kullanim.js |
| Güneş ışınımı: kışın ısıtmayı azaltır, yazın soğutmayı artırır | M [T] | fizik.js, hava.js |
| Soğuk/sıcak kabinin ilk dakikaları; şebekede ön klimalandırma | M [T] | kullanim.js |
| Batarya sıcaklığı: sürüşte I²R ısınması, ortam kaybı, gece park yeri | M [T] | termal.js |
| Şarj öncesi batarya ön ısıtması: enerji ve kazanılan süre | M [T] | plan.js |
| Soğuk hücrede şarj gücü | M, K | termal.js, kalibrasyon.js |
| Soğuk hücrede kullanılabilir kapasite | Y [L] | kullanim.js |
| Sıcakta batarya soğutması (kompresör yükü) | – | |
| Cam rezistansı, koltuk/direksiyon ısıtma, farlar | Y (0,5 kW sabit yük içinde) | fizik.js |

## Batarya ve şarj
| Süreç | Durum |
|---|---|
| Kullanılabilir kapasite, sağlık (SoH) | M, K |
| Şarj eğrisi (SoC'ye göre), istasyon gücü, %80 sonrası yavaşlama | M |
| Şarj kaybı (sayaç → batarya) | Y (yalnız maliyette) |
| Beklemede tüketim (park, mola, 12 V) | – |
| Gösterge SoC ile BMS SoC farkı, alt tampon | – (OBD çıktısıyla) |

## Dış koşullar ve veri
| Süreç | Durum |
|---|---|
| Hava: 4 bağımsız model ortancası, modeller arası açılma, METAR gözlemiyle sınama | M |
| Yol çalışması, şerit daraltma, kapalı yol (KGM günlük bülteni) | M (bilgi; süreye eklenmiyor) |
| Hız sınırı ve ölçülü akış oranı (Valhalla) | M |
| Sabit hız kamerası, ortalama hız koridoru (OSM; kapsam eksik) | bilgi |
| Canlı trafik yoğunluğu | – (açık kaynak yok; navigasyonda kalıyor) |
| Bayram/tatil yoğunluğu | – |

## Sıradaki adaylar (etki büyüklüğüne göre)
1. Hıza ve yüke bağlı aktarma verimi (OBD güç ve hız kaydından çıkarılabilir).
2. Lastik basıncı ve dış sıcaklığın OBD'den okunması.
3. Sıcak havada batarya soğutma yükü.
4. Beklemede tüketim.
