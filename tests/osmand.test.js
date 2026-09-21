import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, zipYaz } from '../www/core/zip.js';
import { osfDosyalari, osfUret, GRUPLAR } from '../www/core/osmand.js';

const st = (kw, o = {}) => ({ no: 'ŞRJ/' + kw, ad: 'Deneme & Tesis', marka: 'ZES', operator: 'ZES DİJİTAL', enlem: 39.1, boylam: 33.2, kw, soketSayisi: 2, ilce: 'Çankaya', ilAdi: 'ANKARA', ...o });

test('CRC32 bilinen değer', () => { assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926); });

test('zip standart araçlarla açılır, Türkçe dosya adı korunur', () => {
  const d = mkdtempSync(join(tmpdir(), 'zip-')), f = join(d, 'a.zip');
  writeFileSync(f, zipYaz([{ ad: 'items.json', veri: '{"a":1}' }, { ad: 'favorites-EV şarj 150 kW+.gpx', veri: 'çğıöşü' }]));
  const liste = execFileSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("\\n".join(z.namelist()));print(z.read("favorites-EV şarj 150 kW+.gpx").decode())`, f]).toString();
  assert.match(liste, /items\.json/); assert.match(liste, /favorites-EV şarj 150 kW\+\.gpx/); assert.match(liste, /çğıöşü/);
});

test('osf: eklenti ve iki favori grubu; her FAVOURITES öğesinin dosyası pakette', () => {
  const ist = [st(180), st(350), st(60), st(120), st(40)];
  const ds = osfDosyalari(ist, { tarih: '2026-09-21' });
  const items = JSON.parse(ds[0].veri).items;
  assert.equal(items[0].type, 'PLUGIN'); assert.equal(items[0].pluginId, 'yolplani.ev');
  const fav = items.filter(i => i.type === 'FAVOURITES');
  assert.equal(fav.length, 2);
  for (const f of fav) assert.ok(ds.some(d => d.ad === f.file), f.file);
  const g150 = ds.find(d => d.ad.includes(GRUPLAR[0].ad)).veri, g50 = ds.find(d => d.ad.includes(GRUPLAR[1].ad)).veri;
  assert.equal((g150.match(/<wpt /g) || []).length, 2); assert.equal((g50.match(/<wpt /g) || []).length, 2);   // 40 kW dışarıda
  assert.match(g150, /<name>ZES · 350 kW × 2<\/name>/); assert.match(g150, /Deneme &amp; Tesis/);
  assert.match(g150, /<type>EV şarj 150 kW\+<\/type>/); assert.match(g150, /amenity_charging_station/);
  assert.ok(osfUret(ist) instanceof Uint8Array);
});

test('gerçek EPDK paketiyle boyut makul', async () => {
  const { paketAc } = await import('../www/core/servis.js');
  const p = paketAc(JSON.parse(readFileSync(new URL('../www/data/epdk.json', import.meta.url))));
  const z = osfUret(p.istasyonlar, { tarih: p.tarih });
  assert.ok(z.length < 6e6, String(z.length));
});
