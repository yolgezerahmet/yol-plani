// ELM327 yanıt ayrıştırma ve E-GMP BMS (7E4) çözümleme.
// DURUM: 220101 alanları 2021–2024 IONIQ 5 topluluk tablolarına ve bir forum ham örneğine göre doğrulandı.
// 2026 makyajlı 63 kWh araçta henüz DOĞRULANMADI; ilk ham terminal çıktısıyla test edilecek.

// "03E\n0: 62 01 01 ...\n1: EF BF ..." biçimindeki çok çerçeveli yanıtı bayt dizisine çevirir.
export function elmBaytlari(metin) {
  const bayt = [];
  let beklenen = null;
  for (const ham of String(metin).split(/[\r\n]+/)) {
    const s = ham.replace(/>/g, '').trim();
    if (!s || /^(SEARCHING|OK|AT|ELM)/i.test(s)) continue;
    if (/NO DATA|ERROR|UNABLE|STOPPED|\?/i.test(s)) throw new Error('ELM hata yanıtı: ' + s);
    if (/^[0-9A-F]{3}$/i.test(s)) { beklenen = parseInt(s, 16); continue; }
    const m = s.match(/^([0-9A-F]{1,2}):\s*(.*)$/i);
    const veri = (m ? m[2] : s).replace(/\s+/g, '');
    if (!/^([0-9A-F]{2})+$/i.test(veri)) continue;
    for (let i = 0; i < veri.length; i += 2) bayt.push(parseInt(veri.slice(i, i + 2), 16));
  }
  return beklenen ? bayt.slice(0, beklenen) : bayt;
}

const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const s16 = (b, i) => { const v = u16(b, i); return v > 32767 ? v - 65536 : v; };
const u32 = (b, i) => b[i] * 16777216 + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const s8 = v => (v > 127 ? v - 256 : v);

// Torque harf indisi (a=0) + 3 = 0x62'den sayılan yanıt indisi.
export function coz220101(b) {
  if (b[0] !== 0x62 || b[1] !== 0x01 || b[2] !== 0x01) throw new Error('220101 yanıtı değil');
  if (b.length < 45) throw new Error('220101 yanıtı kısa: ' + b.length + ' bayt');
  const d = {
    socBms: b[7] / 2,                // %
    akimA: s16(b, 13) / 10,          // + deşarj, − şarj
    voltajV: u16(b, 15) / 10,
    sicakliklar: [17, 18, 19, 20, 21, 22, 23].map(i => s8(b[i])),
    cecKwh: u32(b, 33) / 10,         // kümülatif şarj enerjisi
    cedKwh: u32(b, 37) / 10,         // kümülatif deşarj enerjisi
  };
  d.gucKw = d.akimA * d.voltajV / 1000;
  if (d.socBms < 0 || d.socBms > 100) throw new Error('SoC aralık dışı: ' + d.socBms);
  if (d.voltajV < 300 || d.voltajV > 900) throw new Error('Voltaj aralık dışı: ' + d.voltajV);
  return d;
}
