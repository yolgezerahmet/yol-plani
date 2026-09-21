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

// Bayt indisleri 0x62'den sayılır. Forum örneğinde her alan fiziksel olarak tutarlı çıktı:
// SoC %95,5 → en yüksek hücre 4,10 V; sayaçlar CEC/CCC ≈ 0,75 kV (paket gerilimi mertebesi).
// ÖNCEKİ SÜRÜMDE HATA: 33 ve 37'deki sayaçlar Ah cinsinden şarj/deşarj akım sayacıymış (CCC/CDC);
// enerji sayaçları (CEC/CED, kWh) 41 ve 45'te. Düzeltildi, testi var.
export function coz220101(b) {
  if (b[0] !== 0x62 || b[1] !== 0x01 || b[2] !== 0x01) throw new Error('220101 yanıtı değil');
  if (b.length < 53) throw new Error('220101 yanıtı kısa: ' + b.length + ' bayt');
  const sicakliklar = [17, 18, 19, 20, 21, 22, 23].map(i => s8(b[i]));
  const d = {
    socBms: b[7] / 2,                // %
    akimA: s16(b, 13) / 10,          // + deşarj, − şarj
    voltajV: u16(b, 15) / 10,
    sicakliklar,                     // [en yüksek, en düşük, modül 1–5] °C
    bataryaMaxT: sicakliklar[0], bataryaMinT: sicakliklar[1],
    hucreMaxV: b[26] / 50, hucreMaxNo: b[27],
    hucreMinV: b[28] / 50, hucreMinNo: b[29],
    yardimciAkuV: b[32] / 10,
    cccAh: u32(b, 33) / 10,          // kümülatif şarj akımı
    cdcAh: u32(b, 37) / 10,          // kümülatif deşarj akımı
    cecKwh: u32(b, 41) / 10,         // kümülatif şarj enerjisi
    cedKwh: u32(b, 45) / 10,         // kümülatif deşarj enerjisi
    calismaSaat: +(u32(b, 49) / 3600).toFixed(1),
  };
  d.gucKw = +(d.akimA * d.voltajV / 1000).toFixed(2);
  d.hucreFarkMv = Math.round((d.hucreMaxV - d.hucreMinV) * 1000);
  d.dcSarj = d.akimA < -20;           // 20 A üstü şarj akımı DC hızlı şarj sayılır
  if (d.socBms < 0 || d.socBms > 100) throw new Error('SoC aralık dışı: ' + d.socBms);
  if (d.voltajV < 300 || d.voltajV > 900) throw new Error('Voltaj aralık dışı: ' + d.voltajV);
  return d;
}

// ---- Diğer modüller ---------------------------------------------------------------------
// Bayt yerleşimleri iki bağımsız açık kaynak projenin ÇAKIŞAN alanlarından alındı:
//   evDash (nickn17, MIT) src/CarHyundaiEgmp.cpp — birleştirilmiş yanıtta onaltılık karakter indisi
//   WiCAN (meatpiHQ) vehicle_profiles/hyundai/ioniq5-6.json — ham CAN çerçevesi bayt indisi (B..)
// İkisi farklı indis sistemleri kullanır; 0x62'den sayılan yük indisine çevrilince aşağıdaki alanların
// hepsi birebir örtüşüyor. "tek kaynak" notlu alanlar yalnız birinde var. 2026 araçta DOĞRULANMADI.
// WiCAN B indisi → yük indisi: çerçeve n = ⌊B/8⌋; n=0: B−2; n≥1: 6 + 7(n−1) + (B − 8n − 1).
export const wicanYukIndisi = B => { const n = Math.floor(B / 8); return n === 0 ? B - 2 : 6 + 7 * (n - 1) + (B - 8 * n - 1); };

const basla = (b, a, c, d, enAz, ad) => {
  if (b[0] !== a || b[1] !== c || b[2] !== d) throw new Error(ad + ' yanıtı değil');
  if (b.length < enAz) throw new Error(`${ad} yanıtı kısa: ${b.length} bayt`);
};
const aralik = (v, a, u) => (v >= a && v <= u ? v : null);

// BMS 7E4 220105: sağlık, gösterge SoC'si, hücre sapması.
export function coz220105(b) {
  basla(b, 0x62, 0x01, 0x05, 42, '220105');
  return {
    sohYuzde: aralik(u16(b, 28) / 10, 50, 100),        // iki kaynak
    socGosterge: aralik(b[34] / 2, 0, 100),            // iki kaynak; BMS SoC'sinden farkı tamponu verir
    hucreSapmaV: aralik(b[23] / 50, 0, 1),             // tek kaynak (WiCAN)
  };
}
// BMS 7E4 220106: soğutma suyu sıcaklığı. Şarj biti tek kaynak (evDash).
export function coz220106(b) {
  basla(b, 0x62, 0x01, 0x06, 28, '220106');
  return { sogutmaSuyuC: aralik(s8(b[7]), -30, 120), sarjBiti: (b[27] & 1) === 1 };
}
// TPMS 7A0 22C00B: basınç 0,2 psi adımlı; sıcaklık −50 kaydırmalı. İki kaynak.
const PSI_BAR = 14.5038;
export function coz22C00B(b) {
  basla(b, 0x62, 0xC0, 0x0B, 24, '22C00B');
  const teker = i => ({ bar: aralik(+(b[i] * 0.2 / PSI_BAR).toFixed(2), 0.5, 4.5), C: aralik(b[i + 1] - 50, -40, 120) });
  return { onSol: teker(7), onSag: teker(12), arkaSol: teker(17), arkaSag: teker(22) };
}
// Gösterge 7C6 22B002: kilometre sayacı, 3 bayt. İki kaynak.
export function coz22B002(b) {
  basla(b, 0x62, 0xB0, 0x02, 12, '22B002');
  return { odoKm: aralik((b[9] << 16) | (b[10] << 8) | b[11], 0, 2000000) };
}
// Klima 7B3 220100: iç ve dış sıcaklık, (x/2)−40. İki kaynak.
export function coz220100(b) {
  basla(b, 0x62, 0x01, 0x00, 10, '220100');
  return { icC: aralik(b[8] / 2 - 40, -40, 80), disC: aralik(b[9] / 2 - 40, -40, 60) };
}
export const COZUCULER = { '220105': coz220105, '220106': coz220106, '22C00B': coz22C00B, '22B002': coz22B002, '220100': coz220100 };

// Ham yanıtı saklanabilir onaltılık metne çevirir. Kayıtta çözülmüş değerlerin yanında ham bayt
// da tutulur: ileride bir alanın anlamı düzeltilirse eski kayıtlar yeniden çözülebilir.
export const hex = b => b.map(x => x.toString(16).padStart(2, '0')).join('');
export const hexBayt = h => (String(h).match(/../g) || []).map(x => parseInt(x, 16));

// ---- ELM327 oturumu --------------------------------------------------------------------
// Taşıma katmanından bağımsız: ble, klasik Bluetooth ya da testte sahte taşıma.
// tasima: { gonder(metin): Promise, dinle(cb(metinParcasi)) }
// Komutlar sıraya alınır; her yanıt '>' istemiyle biter.
export const BASLAT = ['ATZ', 'ATE0', 'ATL0', 'ATH0', 'ATSP6', 'ATSH7E4'];

export class ElmOturum {
  constructor(tasima, { zamanAsimiMs = 4000, gunluk = null } = {}) {
    this.tasima = tasima; this.zaman = zamanAsimiMs; this.gunluk = gunluk;
    this.tampon = ''; this.bekleyen = null; this.sira = Promise.resolve();
    tasima.dinle(p => this.al(p));
  }
  al(parca) {
    this.tampon += parca;
    const i = this.tampon.indexOf('>');
    if (i < 0 || !this.bekleyen) return;
    const yanit = this.tampon.slice(0, i); this.tampon = this.tampon.slice(i + 1);
    const b = this.bekleyen; this.bekleyen = null; clearTimeout(b.zamanlayici); b.coz(yanit);
  }
  komut(k) {
    const is = () => new Promise((coz, reddet) => {
      // Zaman aşımına uğramış bir önceki komutun geç gelen yanıtı bu komuta karışmasın.
      this.tampon = '';
      this.bekleyen = { coz, zamanlayici: setTimeout(() => { this.bekleyen = null; reddet(new Error(`${k}: yanıt gelmedi`)); }, this.zaman) };
      this.tasima.gonder(k + '\r').catch(h => { clearTimeout(this.bekleyen?.zamanlayici); this.bekleyen = null; reddet(h); });
    }).then(y => { this.gunluk?.(k, y); return y; });
    const s = this.sira.then(is, is);
    this.sira = s.catch(() => {});
    return s;
  }
  async baslat() { for (const k of BASLAT) await this.komut(k); }
  async oku(pid) { const y = await this.komut(pid); return elmBaytlari(y); }
}

// ---- Keşif taraması -------------------------------------------------------------------------
// E-GMP'nin başka modüllerinde yolculuk hesabına doğrudan yarayan veriler var. Aşağıdaki
// başlık/PID çiftleri 2021–24 araçların topluluk tablolarından; 2026 aracında yanıt verip
// vermedikleri bilinmiyor. Çözücüler açık kaynak tablolarına dayanır (yukarıda); ham yanıt da saklanır,
// ilk gerçek çıktıyla doğrulanır.
export const KESIF = [
  { baslik: '7E4', pid: '220105', ne: 'BMS: SoH, hücre sapması, soğutma suyu' },
  { baslik: '7E4', pid: '220106', ne: 'BMS: soğutma/ısıtma durumu' },
  { baslik: '7C6', pid: '22B002', ne: 'Gösterge: kilometre sayacı' },
  { baslik: '7B3', pid: '220100', ne: 'Klima: iç/dış sıcaklık' },
  { baslik: '7A0', pid: '22C00B', ne: 'Lastik basıncı ve sıcaklığı' },
  { baslik: '7E2', pid: '2101',   ne: 'Araç kontrol: hız, vites' },
];

// Her girdiyi sırayla sorar; hata veren atlanır. Sonunda başlık BMS'ye döner ki kayıt sürsün.
export async function kesifTara(oturum, liste = KESIF) {
  const sonuc = [];
  let baslik = null;
  for (const g of liste) {
    try {
      if (g.baslik !== baslik) { await oturum.komut('ATSH' + g.baslik); baslik = g.baslik; }
      const ham = await oturum.komut(g.pid);
      let bayt = null;
      try { bayt = elmBaytlari(ham); } catch { /* NO DATA vb. */ }
      let deger = null;
      try { if (bayt?.length && COZUCULER[g.pid]) deger = COZUCULER[g.pid](bayt); } catch { /* yerleşim farklı olabilir; ham saklanır */ }
      sonuc.push({ ...g, yanit: !!bayt?.length, uzunluk: bayt?.length ?? 0, hex: bayt ? hex(bayt) : String(ham).trim(), deger });
    } catch (e) {
      sonuc.push({ ...g, yanit: false, uzunluk: 0, hex: e.message });
    }
  }
  if (baslik !== '7E4') await oturum.komut('ATSH7E4').catch(() => {});
  return sonuc;
}
