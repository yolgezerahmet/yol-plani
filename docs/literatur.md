# Literatürden ürüne: dayanaklar ve yol haritası

Tarama: 21.09.2026. Buradaki her kaynak tarama sırasında başlığı, yazarı ve ana bulgusuyla doğrulandı;
doğrulanamayan kaynak yazılmadı. "Durum" sütunu uygulamadaki karşılığı gösterir.

## 1. Tüketim tahmini: fizik + araçtan öğrenme
- De Cauwer, Van Mierlo, Coosemans (2015), *Energies* 8(8):8573–8593. Araç dinamiği denklemini temel alıp gerçek
  sürüş verisiyle çoklu doğrusal regresyon; girdi ayrıntısına göre üç model.
- De Cauwer ve ark. (2017), *Energies* 10(5):608. Veri güdümlü tahmin ve enerji verimli rotalama.
- Fiori, Ahn, Rakha (2016), *Applied Energy* 168:257–268. Güç temelli EV tüketim modeli (VT-CPEM).
- Zhu ve ark. (2025), *IEEE Trans. Transportation Electrification* 11:2120–2132. Fizik temelli özellikler +
  araca özel çevrimiçi uyarlama: filo verisinde ortalama hata %6,30 → %5,04; tahmin aralığı kapsaması %91.

**Çıkarım:** tek bir "referans tüketim" katsayısı (ABRP'nin yaklaşımı) yerine fiziksel bileşenlerin ayrı ayrı
araca uyarlanması hem daha isabetli hem de görülmemiş koşullara (çok soğuk, çok hızlı) daha iyi genellenir.
**Durum: yapıldı** (`core/ogrenme.js`). Hava direnci, yuvarlanma ve yardımcı yük çarpanları önsel bilgili
özyinelemeli en küçük karelerle öğrenilir; özellikler gerçek sürüş hızıyla hesaplanır, sürücünün hız alışkanlığı
ayrı tutulur. Benzetimde (aero +%15, yardımcı +%35) 150 pencerede çarpanlar ±0,05–0,10 içinde bulunuyor;
görülmemiş koşullarda hata tek katsayıya göre %40'tan fazla düşüyor. Ayrıca belirsizlik varsayımımız (%3)
literatüre göre iyimserdi; %6–8'e çekildi ve araç kendi ölçülmüş hatasını ürettikçe onun yerine geçiyor.

## 2. Menzil kaygısı: belirsizliği göstermek
- Jung, Sirkin, Gür, Steinert (2015), CHI '15, doi:10.1145/2702123.2702479. 73 sürücü, 19 millik sürüş: menzilin
  belirsizlikle (aralık olarak) gösterilmesi araca güveni korudu, sürüş deneyimini ve davranışı iyileştirdi.
- Rauh, Franke, Krems (2015), *Human Factors* 57(1):177–187. Deneyimli sürücü aynı kritik durumda belirgin daha az kaygı yaşıyor.
- Franke, Krems (2013), *Transport Policy* 30:56–62. Sürücülerin "rahat menzil" tercihi kişiye göre değişiyor.

**Durum: kısmen.** Bacak başına %90 alt sınır gösteriliyor. **Sıradaki:** "rahat rezerv"in kişiye göre öğrenilmesi
(kullanıcı hep %25 ile varıyorsa plan %10'a göre kurulmamalı) ve deneyimsiz sürücü için açıklayıcı mod.

## 3. İstasyon güvenilirliği ve dayanıklı plan
- Rempel, Cullen, Bryan, Cezar (2022/2023), arXiv:2203.16372; *Human Factors* doi:10.1177/00187208231215242.
  Körfez Bölgesi'ndeki 181 halka açık DC istasyonun 657 CCS soketinin yalnız %72,5'i çalışır durumda; işletmeciler %95–98 bildiriyor.
- Rajan ve ark. (2021), ATMOS 2021. EV için en kısa uygun yol probleminin dayanıklılık genellemeleri.
- Baum, Dibbelt, Gemsa, Wagner, Zündorf (2019), *Transportation Science* 53(6):1627–1655. Şarj duraklı, gerçekçi
  şarj eğrili toplam süre en küçüklemesi (CHArge); kıta ölçeğinde en iyi çözüm.

**Durum: yapıldı.** Planlayıcıda arıza yedeği koşulu ve beklenen arıza maliyeti var (`core/optimum.js`); p soket
sayısından ve kendi ölçümlerimizden gelir. Türkiye için p bilinmiyor [T]; yerel ölçümler biriktikçe düzeltilecek.
**Sıradaki:** ölçümlerin (izinle, anonim) paylaşılması; doluluk/sıra beklentisi.

## 4. Batarya sağlığı
- Geotab (Ocak 2026), 22.700 araç, 21 model: ortalama yıllık kapasite kaybı %2,3. 100 kW üstü DC'yi yoğun kullananlarda
  %3,0, ağırlıkla AC/düşük güç kullananlarda %1,5. Sıcak iklim +%0,4/yıl. Uç SoC düzeyleri ancak alışkanlık hâline
  gelirse (zamanın > %80'i) etkili.

**Çıkarım:** yolculukta "%80'i geçme" diye ısrar etmek yersiz; asıl etken yıl içindeki yüksek güçlü DC payı.
**Sıradaki:** "batarya karnesi": OBD kayıtlarından DC payı, 100 kW üstü payı, uç düzeylerde geçen süre; SoH'nin
(220105 çözücüsü var) km'ye göre eğilimi ve Geotab ortalamasıyla karşılaştırma. İkinci el raporunun da temeli.

## 5. Henüz taranmayan alanlar
Eko-sürüş ve hız profili en iyilemesi, kabin ön koşullandırmanın enerji etkisi, sürücü yorgunluğu ve mola aralıkları,
çok zamanlı tarifede ev şarjı zamanlaması. Bunlar için kaynak doğrulanmadan ürün kararı yazılmadı.
