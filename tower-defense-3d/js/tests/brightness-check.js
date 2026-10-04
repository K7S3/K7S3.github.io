/* Brightness regression guard: assert scene lighting params stay in the
 * "dramatic but readable" band, not near-black. Static check on render3d.js
 * source (the values debugLighting() would report at runtime), plus:
 *  - a scene.environment assignment must exist (metallic PBR with no env
 *    map renders near-black; this was the root cause of the black Spire)
 *  - updateEnvironment must scale from baseHemi/baseSun (it used to
 *    hardcode 0.55/0.75 and clobber the art-directed init values)
 *  - the ground texture's base gradient must have a sane mean luminance
 */
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
  ['toneMappingExposure', exposure, 1.30, 1.80],
  ['hemisphere intensity', hemi, 0.85, 1.40],
  ['sun intensity', sun, 1.05, 1.80],
  ['fog density (thin, not murk)', fog, 0.001, 0.008],
];
let fail = 0;
for (const [name, v, lo, hi] of checks){
  const ok = v >= lo && v <= hi;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' = ' + v + ' (band ' + lo + '-' + hi + ')');
  if (!ok) fail++;
}
// environment map must be assigned (kills the metallic-black bug)
const envOk = src.includes('scene.environment =');
console.log((envOk ? 'PASS' : 'FAIL') + ' scene.environment assigned (env map present)');
if (!envOk) fail++;
// per-frame lighting must derive from base values, not hardcoded dims
const noClobber = /sun\.intensity\s*=\s*baseSun/.test(src) && /hemi\.intensity\s*=\s*baseHemi/.test(src);
console.log((noClobber ? 'PASS' : 'FAIL') + ' updateEnvironment scales from baseSun/baseHemi');
if (!noClobber) fail++;
// ground texture luminance floor: ground palettes are now per-sector
// (env.ground in sectors.js + DEFAULT_ENV.ground in render3d.js); the base
// gradient in paintGround is tinted from them. Parse every palette and
// require each one's mean luminance above the floor.
function lum(hex){
  const r = parseInt(hex.slice(1, 3), 16) / 255,
        g = parseInt(hex.slice(3, 5), 16) / 255,
        b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const secSrc = fs.readFileSync(path.join(__dirname, '..', 'sectors.js'), 'utf8');
const palettes = [];
for (const s of [src, secSrc]){
  for (const m of s.matchAll(/ground:\s*\[((?:'#[0-9a-fA-F]{6}'\s*,?\s*){3})\]/g)){
    palettes.push(m[1].match(/#[0-9a-fA-F]{6}/g));
  }
}
if (palettes.length < 5) { console.log('FAIL ground palettes found: ' + palettes.length + ' (want >= 5)'); fail++; }
palettes.forEach((p, i) => {
  const mean = p.reduce((a, h) => a + lum(h), 0) / p.length;
  const ok = mean > 0.10;
  console.log((ok ? 'PASS' : 'FAIL') + ' ground palette ' + i + ' mean luminance = ' + mean.toFixed(3) + ' (floor 0.10)');
  if (!ok) fail++;
});
// brightness slider present in settings UI
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const sliderOk = html.includes('rng-bright');
console.log((sliderOk ? 'PASS' : 'FAIL') + ' brightness slider (rng-bright) in index.html');
if (!sliderOk) fail++;
if (fail){ console.log(fail + ' FAILURES'); process.exit(1); }
console.log('ALL BRIGHTNESS CHECKS PASS');
