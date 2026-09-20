// IONIQ 5 batarya/çekiş varyantları. Kullanılabilir kapasiteler EV Database tahminleridir (üretici açıklamaz);
// ağırlıklar üretici aralıklarının ortasıdır. OBD kaydıyla araca özel kalibrasyon bu değerlerin üstüne yazar.
// sarjOlcek: 63 kWh referans eğrisinin ölçeği; %10→80 ortalama gücü ölçümlere oturtur.

export const ARACLAR = {
  'i5-58-rwd':  { ad: 'IONIQ 5 58 kWh RWD (2021–24)',   brut: 58,   kap: 54, bos: 1910, verim: 0.90, sarjOlcek: 0.86, tepeKw: 175, kaynak: 'EVDB' },
  'i5-63-rwd':  { ad: 'IONIQ 5 63 kWh RWD (2024–)',     brut: 63,   kap: 60, bos: 2000, verim: 0.90, sarjOlcek: 1.00, tepeKw: 195, kaynak: 'EVDB' },
  'i5-73-rwd':  { ad: 'IONIQ 5 72,6 kWh RWD (2021–22)', brut: 72.6, kap: 70, bos: 1985, verim: 0.90, sarjOlcek: 1.15, tepeKw: 220, kaynak: 'tahmin' },
  'i5-73-awd':  { ad: 'IONIQ 5 72,6 kWh AWD (2021–22)', brut: 72.6, kap: 70, bos: 2095, verim: 0.88, sarjOlcek: 1.15, tepeKw: 220, kaynak: 'tahmin' },
  'i5-77-rwd':  { ad: 'IONIQ 5 77,4 kWh RWD (2022–24)', brut: 77.4, kap: 74, bos: 2010, verim: 0.90, sarjOlcek: 1.18, tepeKw: 233, kaynak: 'EVDB' },
  'i5-77-awd':  { ad: 'IONIQ 5 77,4 kWh AWD (2022–24)', brut: 77.4, kap: 74, bos: 2120, verim: 0.88, sarjOlcek: 1.18, tepeKw: 233, kaynak: 'EVDB' },
  'i5-84-rwd':  { ad: 'IONIQ 5 84 kWh RWD (2024–)',     brut: 84,   kap: 80, bos: 2060, verim: 0.90, sarjOlcek: 1.20, tepeKw: 260, kaynak: 'EVDB/EVKX' },
  'i5-84-awd':  { ad: 'IONIQ 5 84 kWh AWD (2024–)',     brut: 84,   kap: 80, bos: 2140, verim: 0.88, sarjOlcek: 1.20, tepeKw: 260, kaynak: 'EVDB/EVKX' },
};

export const VARSAYILAN_ARAC = 'i5-63-rwd';

// Koşul nesnesine araç parametrelerini uygular; batarya yıpranması (soh, 0–1) kapasiteyi ölçekler.
export function aracUygula(k, aracId = VARSAYILAN_ARAC, soh = 1) {
  const a = ARACLAR[aracId];
  if (!a) throw new Error('Bilinmeyen araç: ' + aracId);
  if (!(soh > 0.5 && soh <= 1)) throw new Error('SoH 0,5–1 aralığında olmalı');
  return { ...k, aracId, kap: a.kap * soh, bos: a.bos, verim: a.verim, sarjOlcek: a.sarjOlcek };
}
