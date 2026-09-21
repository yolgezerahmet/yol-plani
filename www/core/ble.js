// vLinker MC+ (ve benzeri BLE ELM327 adaptörleri) için Bluetooth LE taşıma katmanı.
// Capacitor eklentisi: @capacitor-community/bluetooth-le. Yerel köprü window.Capacitor.Plugins
// üzerinden doğrudan çağrılır; paketleyici gerekmez. Değerler iki yönde de onaltılık metin taşınır.
//
// DURUM: vLinker MC+'nın hizmet/karakteristik UUID'leri henüz görülmedi. Bu yüzden sabit UUID yerine
// keşif yapılır: yazılabilir ve bildirim veren karakteristiği olan ilk uygun hizmet seçilir;
// bilinen ELM hizmetleri (FFF0, FFE0, 18F0) önceliklidir. Seçim ekranda gösterilir.

const BILINEN = ['fff0', 'ffe0', '18f0', 'e7810a71'];
const kisa = uuid => String(uuid).toLowerCase().replace(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/, '$1');

// getServices() çıktısından yazma ve bildirim kanalını seçer.
export function kanalSec(hizmetler) {
  const adaylar = [];
  for (const h of hizmetler || []) {
    const ch = h.characteristics || [];
    const bildirim = ch.find(c => c.properties?.notify || c.properties?.indicate);
    const yazma = ch.find(c => c.properties?.write || c.properties?.writeWithoutResponse);
    if (!bildirim || !yazma) continue;
    const oncelik = BILINEN.findIndex(b => kisa(h.uuid).startsWith(b));
    adaylar.push({ hizmet: h.uuid, bildirim: bildirim.uuid, yazma: yazma.uuid,
                   yanitsiz: !yazma.properties?.write && !!yazma.properties?.writeWithoutResponse,
                   oncelik: oncelik < 0 ? 99 : oncelik });
  }
  adaylar.sort((a, b) => a.oncelik - b.oncelik);
  return adaylar[0] || null;
}

export const metinHex = m => [...m].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
export const hexMetin = h => ((String(h).replace(/[^0-9a-f]/gi, '').match(/../g)) || []).map(x => String.fromCharCode(parseInt(x, 16))).join('');

// ElmOturum'un beklediği taşıma nesnesini kurar. eklenti enjekte edilebilir (test için).
export async function bleBaglan({ eklenti = globalThis.Capacitor?.Plugins?.BluetoothLe, adOnEki = null, kopunca = null } = {}) {
  if (!eklenti) throw new Error('Bluetooth eklentisi yok. Uygulamanın APK sürümünde çalışır, tarayıcıda çalışmaz.');
  await eklenti.initialize({ androidNeverForLocation: true });
  const cihaz = await eklenti.requestDevice(adOnEki ? { namePrefix: adOnEki } : {});
  const deviceId = cihaz.deviceId;
  if (kopunca) await eklenti.addListener(`disconnected|${deviceId}`, () => kopunca());
  await eklenti.connect({ deviceId });
  const { services } = await eklenti.getServices({ deviceId });
  const kanal = kanalSec(services);
  if (!kanal) throw new Error('Adaptörde yazılabilir ve bildirim veren bir BLE hizmeti bulunamadı.');
  let dinleyici = () => {};
  await eklenti.addListener(`notification|${deviceId}|${kanal.hizmet}|${kanal.bildirim}`, e => dinleyici(hexMetin(e?.value ?? '')));
  await eklenti.startNotifications({ deviceId, service: kanal.hizmet, characteristic: kanal.bildirim });
  const yaz = kanal.yanitsiz ? 'writeWithoutResponse' : 'write';
  return {
    cihaz: { ad: cihaz.name || 'adsız', id: deviceId }, kanal,
    tasima: {
      dinle(cb) { dinleyici = cb; },
      async gonder(m) {
        // BLE yazma boyu sınırlı; ELM komutları kısa ama 20 bayt dilimlemek güvenli.
        for (let i = 0; i < m.length; i += 20)
          await eklenti[yaz]({ deviceId, service: kanal.hizmet, characteristic: kanal.yazma, value: metinHex(m.slice(i, i + 20)) });
      },
    },
    kapat: () => eklenti.disconnect({ deviceId }),
  };
}
