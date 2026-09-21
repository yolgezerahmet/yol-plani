# İlgili açık projeler: ne aldık, ne almadık

Tarama tarihi: 21.09.2026. Yıldız ve son güncelleme GitHub API'sinden o gün okundu.

## OBD ve araç verisi (Hyundai/Kia E-GMP)
| Proje | Lisans | Durum | Bizim için değeri |
|---|---|---|---|
| nickn17/evDash | MIT | etkin (08.2026), ★178 | E-GMP çözücüsü (`CarHyundaiEgmp.cpp`): 220101/05/06, 22C00B, 22B002, 220100. 58/63 kWh paketi ayrı ele alıyor. **Çözücülerimizin birinci kaynağı.** |
| meatpiHQ/wican-fw | GPL-3.0 | etkin, ★778 | `vehicle_profiles/hyundai/ioniq5-6.json`: aynı PID'ler, bağımsız indis sistemiyle. **İkinci kaynak; yalnız olgu (bayt konumu) alındı, kod alınmadı.** IONIQ 9, Kona, eski IONIQ profilleri de var. |
| openvehicles/OVMS-3 | karma | etkin, ★858 | `vehicle_hyundai_ioniq5` bileşeni: üçüncü sağlama kaynağı; henüz satır satır karşılaştırılmadı. |
| JejuSoul/OBD-PIDs-for-HKMC-EVs | yok | 2021'de durmuş, ★285 | Kona, Niro, eski IONIQ, Soul için Torque tabloları. E-GMP yok; eski nesil genişlemesinde başvuru. Lisanssız: yalnız olgu. |
| EVNotify | karma | etkin, ★233 | SoC bildirimi ve sunucu mimarisi örneği. |
| Hyundai-Kia-Connect/hyundai_kia_connect_api | MIT | etkin, ★365 | Bluelink bulut API'si (OBD'siz SoC, konum, klima). Resmî değil; Türkiye bölgesi desteği doğrulanmadı. OBD adaptörü olmayan kullanıcı için ikinci veri yolu adayı. |

Doğrulama: evDash'in karakter indisi ile WiCAN'ın çerçeve indisi 0x62'den sayılan yük indisine çevrildiğinde
SoH (28–29), gösterge SoC (34), dört lastik basıncı (7, 12, 17, 22), kilometre (9–11), iç/dış sıcaklık (8, 9)
birebir örtüşüyor; testte `wicanYukIndisi` ile sabitlendi. Mevcut 220101 çözücümüz de WiCAN ile örtüşüyor.
2026 makyajlı 63 kWh araçta hiçbiri DOĞRULANMADI.

## Tesla
| Proje | Lisans | Not |
|---|---|---|
| teslamate-org/teslamate | AGPL-3.0, ★9.014 | Kayıt ve verim analizi için en olgun örnek; AGPL olduğu için kod alınamaz, fikir alınır (sürüş başına verim, şarj eğrisi arşivi). |
| teslamotors/vehicle-command | Apache-2.0 | Resmî komut/protokol kitaplığı; Fleet API yolunun dayanağı. |
| timdorr/tesla-api | MIT | Gayriresmî API belgeleri. |

## Harita, rota, istasyon
| Proje | Lisans | Not |
|---|---|---|
| ev-map/EVMap | MIT, etkin | Açık kaynak Android şarj haritası; **Android Auto şarj uygulaması kategorisinin çalışan örneği.** Araç ekranı katmanında başvuru. |
| valhalla, graphhopper, brouter | karma / Apache-2.0 / MIT | Valhalla kullanıyoruz. BRouter çevrimdışı ve rakım duyarlı; çevrimdışı rota gerekirse aday. |
| cematil/cepteradar | belirtilmemiş | KGM yol durumu servis adresini buradan öğrendik; radar verisinin kaynağı belirsiz olduğu için alınmadı. |
| openchargemap | MIT | Türkiye kapsamı EPDK'ya göre çok eksik; ana akıştan çıkarıldı. |

## Fizik ve doğrulama
| Proje | Lisans | Not |
|---|---|---|
| NatLabRockies/fastsim (NREL) | Apache-2.0, etkin | Araç enerji benzetimi; motor/inverter verim haritası yaklaşımı ve doğrulama verileri. Yüke bağlı kayıp katsayımızı sınamak için aday. |

## GitHub'da bulunmayanlar
- "EV route planner" aramasındaki projelerin tamamı küçük (★ ≤ 27) ve düz menzil varsayımlı; bölüm bazlı
  fizik + hava + ısıl model birleştiren açık bir proje çıkmadı. Bu alandaki ciddi işler (ABRP, Chargetrip) kapalı.
- Türkiye'ye özgü: birkaç küçük istasyon bulucu var; EPDK REST servisini kullanan ya da tarife/maliyet hesabı yapan yok.
