import test from 'node:test';
import assert from 'node:assert/strict';
import { v2lSure } from '../www/core/v2l.js';

test('temel ev yükü: buzdolabı + modem + lamba, %80 → %20', () => {
  const r = v2lSure({ soc: 80, kap: 60, altSinir: 20, secili: ['buzdolabi', 'modem', 'lamba'] });
  assert.equal(r.yukW, 105);
  assert.equal(r.kullanilabilirKwh, 36);
  const beklenen = 36 / (0.105 / 0.9 + 0.15);
  assert.ok(Math.abs(r.saat - beklenen) < 0.1);
  assert.equal(r.asiri, false);
});

test('ısıtıcı ve su ısıtıcının tepe gücü 3,6 kW sınırını aşar', () => {
  assert.equal(v2lSure({ soc: 80, kap: 60, secili: ['isitici', 'kettle'] }).asiri, true);
});

test('alt sınırın altındaysa süre sıfır', () => {
  assert.equal(v2lSure({ soc: 15, kap: 60, altSinir: 20, secili: ['modem'] }).saat, 0);
});
