# Yol Planı

IONIQ 5 (63 kWh, RWD) için bölüm bazlı hız, tüketim, süre ve şarj durağı planlayıcı. Capacitor ile Android uygulaması.

## Durum

| Katman | Durum |
|---|---|
| Tüketim ve şarj modeli (`www/core/model.js`) | Çalışıyor, EV Database değerlerine karşı testli |
| Plan arayüzü | Web taslağı çalışıyor; uygulamaya yeniden tasarımla girecek. `www/index.html` şimdilik iskelet |
| ELM327 / E-GMP ayrıştırıcı (`www/core/obd.js`) | 2021–24 forum örneğiyle testli; 2026 araçta **doğrulanmadı** |
| Rota motoru (Valhalla: limit + rakım) | Yapılacak |
| Hava (bölüm bazlı rüzgâr, sıcaklık) | Yapılacak |
| BLE bağlantısı (vLinker MC+), sürüş kaydı | Yapılacak |

## Geliştirme

```
npm install
npm test
```

APK: `main` dalına her gönderimde GitHub Actions derler. Actions sekmesinde son çalıştırmanın altındaki
`yol-plani-debug-apk` paketini indir. `android/` klasörü depoda tutulmuyor, derleme sırasında üretiliyor;
yerel izinler (BLE, ön plan servisi) eklendiğinde depoya alınacak.

## Model varsayımları

CdA 0,743 m², Crr 0,009, kullanılabilir 60 kWh, aktarma verimi 0,90. Hepsi ilk OBD sürüş kaydıyla
araca özel kalibre edilecek. Ayrıntı: `www/core/model.js` ve `tests/`.
