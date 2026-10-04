/* Sector environment data validation.
 * Every sector in js/sectors.js must carry a complete `env` block (the new
 * sky/fog/sun system reads it on sector change). Asserts: all required keys
 * present, all colors valid 6-digit hex, numeric fields in sane bands, and
 * every sector's look is distinct (different skyHorizon => not a copy-paste).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'sectors.js'), 'utf8');

const ids = [...src.matchAll(/id:'([a-z-]+)'/g)].map(m => m[1]);
assert.ok(ids.length >= 5, 'expected >= 5 sectors, got ' + ids.length);

const COLOR_KEYS = ['skyTop', 'skyHorizon', 'skyBottom', 'fog', 'sunColor',
  'hemiSky', 'hemiGround', 'dust'];
const NUM_KEYS = { sunIntensity: [0.3, 2.5], sunElev: [5, 90], sunAzim: [0, 360],
  hemiIntensity: [0.3, 2.0], fogDensity: [0.001, 0.012], stars: [0, 1], aurora: [0, 1] };

function blockFor(id){
  const start = src.indexOf("id:'" + id + "'");
  assert.ok(start >= 0, 'sector not found: ' + id);
  const envAt = src.indexOf('env:{', start);
  assert.ok(envAt > start && envAt - start < 600, 'no env block near sector ' + id);
  let depth = 0, end = envAt;
  for (; end < src.length; end++){
    if (src[end] === '{') depth++;
    else if (src[end] === '}'){ depth--; if (!depth) break; }
  }
  return src.slice(envAt, end + 1);
}

const horizons = new Set();
for (const id of ids){
  const b = blockFor(id);
  for (const k of COLOR_KEYS){
    const m = b.match(new RegExp(k + ":\\s*'([^']+)'"));
    assert.ok(m, id + ': missing color key ' + k);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(m[1]), id + ': bad hex for ' + k + ': ' + m[1]);
  }
  for (const [k, [lo, hi]] of Object.entries(NUM_KEYS)){
    const m = b.match(new RegExp(k + ':\\s*([\\d.]+)'));
    assert.ok(m, id + ': missing numeric key ' + k);
    const v = parseFloat(m[1]);
    assert.ok(v >= lo && v <= hi, id + ': ' + k + '=' + v + ' out of band [' + lo + ',' + hi + ']');
  }
  const gm = b.match(/ground:\s*\['(#[0-9a-fA-F]{6})',\s*'(#[0-9a-fA-F]{6})',\s*'(#[0-9a-fA-F]{6})'\]/);
  assert.ok(gm, id + ': missing/invalid ground palette');
  horizons.add(b.match(/skyHorizon:\s*'([^']+)'/)[1]);
  console.log('PASS env complete for ' + id);
}
assert.ok(horizons.size === ids.length, 'sectors must have distinct skyHorizon colors');
console.log('PASS all ' + ids.length + ' sectors have distinct looks');
console.log('ALL SECTOR ENV TESTS PASS');
