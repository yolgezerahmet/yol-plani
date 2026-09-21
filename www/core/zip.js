// En küçük ZIP yazıcı: sıkıştırmasız (STORE), UTF-8 dosya adları. Bağımlılık yok.
// OsmAnd'in .osf paketi yeniden adlandırılmış bir zip'tir; bunun için yeter.
const TABLO = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLO[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

// dosyalar: [{ ad, veri: string | Uint8Array }] → Uint8Array
export function zipYaz(dosyalar, tarih = new Date(2026, 0, 1)) {
  const enc = new TextEncoder();
  const dosT = ((tarih.getHours() << 11) | (tarih.getMinutes() << 5) | (tarih.getSeconds() >> 1)) & 0xFFFF;
  const dosD = (((tarih.getFullYear() - 1980) << 9) | ((tarih.getMonth() + 1) << 5) | tarih.getDate()) & 0xFFFF;
  const yerel = [], merkez = []; let ofset = 0;
  for (const d of dosyalar) {
    const ad = enc.encode(d.ad), veri = typeof d.veri === 'string' ? enc.encode(d.veri) : d.veri, crc = crc32(veri);
    const b = new DataView(new ArrayBuffer(30));
    b.setUint32(0, 0x04034b50, true); b.setUint16(4, 20, true); b.setUint16(6, 0x0800, true); b.setUint16(8, 0, true);
    b.setUint16(10, dosT, true); b.setUint16(12, dosD, true); b.setUint32(14, crc, true);
    b.setUint32(18, veri.length, true); b.setUint32(22, veri.length, true); b.setUint16(26, ad.length, true); b.setUint16(28, 0, true);
    yerel.push(new Uint8Array(b.buffer), ad, veri);
    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true); m.setUint16(8, 0x0800, true); m.setUint16(10, 0, true);
    m.setUint16(12, dosT, true); m.setUint16(14, dosD, true); m.setUint32(16, crc, true); m.setUint32(20, veri.length, true); m.setUint32(24, veri.length, true);
    m.setUint16(28, ad.length, true); m.setUint32(42, ofset, true);
    merkez.push(new Uint8Array(m.buffer), ad);
    ofset += 30 + ad.length + veri.length;
  }
  const mBoy = merkez.reduce((t, x) => t + x.length, 0);
  const son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true); son.setUint16(8, dosyalar.length, true); son.setUint16(10, dosyalar.length, true);
  son.setUint32(12, mBoy, true); son.setUint32(16, ofset, true);
  const parca = [...yerel, ...merkez, new Uint8Array(son.buffer)];
  const out = new Uint8Array(parca.reduce((t, x) => t + x.length, 0)); let p = 0;
  for (const x of parca) { out.set(x, p); p += x.length; }
  return out;
}
