// OSM'den Türkiye'deki sabit hız kameraları ve ortalama hız koridorlarını çeker.
// Kullanım: node scripts/denetim-guncelle.mjs [www/data/denetim.json]
import fs from 'node:fs';
import { OVERPASS, SORGU, denetimPaketle } from '../www/core/denetim.js';

const HEDEF = process.argv[2] || 'www/data/denetim.json';
const y = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: SORGU }),
  headers: { 'User-Agent': 'yol-plani (acik kaynak EV rota planlayici)' } });
if (!y.ok) throw new Error('Overpass ' + y.status);
const p = denetimPaketle(await y.json());
if (p.n.length < 100) throw new Error(`Beklenmeyen yanıt: ${p.n.length} kayıt; yazılmadı`);
fs.writeFileSync(HEDEF, JSON.stringify(p));
console.log(`${p.n.length} denetim noktası (${p.n.filter(r => r[2]).length} koridor) → ${HEDEF}`);
