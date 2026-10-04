/* Brightness regression guard: assert scene lighting params stay in the
 * "dramatic but readable" band, not near-black. Static check on render3d.js
 * source (the values debugLighting() would report at runtime). */
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'render3d.js'), 'utf8');

function grab(re, label){
  const m = src.match(re);
  if (!m) throw new Error('not found: ' + label);
  return parseFloat(m[1]);
}
const exposure = grab(/baseExposure\s*=\s*([\d.]+)/, 'baseExposure');
const hemi     = grab(/HemisphereLight\(0x[0-9a-fA-F]+,\s*0x[0-9a-fA-F]+,\s*([\d.]+)\)/, 'hemi');
const sun      = grab(/DirectionalLight\(0x[0-9a-fA-F]+,\s*([\d.]+)\)/, 'sun');
const fog      = grab(/FogExp2\([^,]+,\s*([\d.]+)\)/, 'fog');

const checks = [
  ['toneMappingExposure', exposure, 1.30, 1.60],
  ['hemisphere intensity', hemi, 0.85, 1.20],
  ['sun intensity', sun, 1.05, 1.50],
  ['fog density (thin, not murk)', fog, 0.001, 0.008],
];
let fail = 0;
for (const [name, v, lo, hi] of checks){
  const ok = v >= lo && v <= hi;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' = ' + v + ' (band ' + lo + '-' + hi + ')');
  if (!ok) fail++;
}
// brightness slider present in settings UI
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const sliderOk = html.includes('rng-bright');
console.log((sliderOk ? 'PASS' : 'FAIL') + ' brightness slider (rng-bright) in index.html');
if (!sliderOk) fail++;
if (fail){ console.log(fail + ' FAILURES'); process.exit(1); }
console.log('ALL BRIGHTNESS CHECKS PASS');
