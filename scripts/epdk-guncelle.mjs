// EPDK REST servisinden tüm Türkiye şarj istasyonlarını çekip uygulama paketini yazar.
// Kullanım: node scripts/epdk-guncelle.mjs [www/data/epdk.json]
// Parametresiz sorgu saatte bir yapılabilir (EPDK kılavuzu); haftalık iş akışı bunun çok altında.
// Servis GET gövdesiyle çalışır; fetch GET'te gövdeye izin vermediği için node:https kullanılır.
import https from 'node:https';
import fs from 'node:fs';
import { paketle } from '../www/core/epdk.js';

const HEDEF = process.argv[2] || 'www/data/epdk.json';
const govde = '{}';

function getir() {
  return new Promise((coz, reddet) => {
    const r = https.request('https://apigateway.epdk.gov.tr/sarjIstasyonlari', {
      method: 'GET', timeout: 180000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json',
                 'Content-Length': Buffer.byteLength(govde), 'User-Agent': 'yol-plani (acik kaynak EV rota planlayici)' },
    }, y => {
      const parca = [];
      y.on('data', p => parca.push(p));
      y.on('end', () => {
        const metin = Buffer.concat(parca).toString('utf8');
        if (y.statusCode !== 200) return reddet(new Error(`EPDK ${y.statusCode}: ${metin.slice(0, 200)}`));
        try { coz(JSON.parse(metin)); } catch (e) { reddet(new Error('EPDK yanıtı JSON değil: ' + metin.slice(0, 200))); }
      });
    });
    r.on('timeout', () => r.destroy(new Error('EPDK zaman aşımı')));
    r.on('error', reddet);
    r.end(govde);
  });
}

const y = await getir();
if (!Array.isArray(y.data) || y.data.length < 1000) throw new Error(`Beklenmeyen yanıt: ${y.data?.length ?? 0} kayıt`);
const p = paketle(y.data);
// Ani düşüş koruması: önceki paketin %80'inden azsa yazma; servis eksik dönmüş olabilir.
if (fs.existsSync(HEDEF)) {
  const eski = JSON.parse(fs.readFileSync(HEDEF, 'utf8'));
  if (eski.surum === 2 && p.s.length < eski.s.length * 0.8)
    throw new Error(`İstasyon sayısı ${eski.s.length} → ${p.s.length}; yazılmadı`);
}
fs.mkdirSync(HEDEF.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(HEDEF, JSON.stringify(p));
console.log(`${y.data.length} kayıt → ${p.s.length} halka açık hızlı istasyon, ${p.operatorler.length} işletmeci`);
