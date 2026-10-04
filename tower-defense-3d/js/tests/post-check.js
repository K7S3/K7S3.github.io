/* Post-processing chain test: with a stubbed THREE, the vendored r147
 * post files must load into NBPost, and NB.Cine must build the correct
 * pass chain per quality tier. Run: node js/tests/post-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

/* ---- auto-stub THREE: any property is a no-op constructable ---- */
function autoStub(){
  return new Proxy(function(){}, {
    construct: () => autoStub(),
    apply: () => autoStub(),
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === 'clone') return () => autoStub();
      if (p === 'then') return undefined;
      return autoStub();
    },
    set: () => true
  });
}
globalThis.THREE = new Proxy({}, { get: () => autoStub() });

function load(name){
  const src = fs.readFileSync(path.join(root, name), 'utf8');
  eval.call(globalThis, src);
}

let failures = 0;
function ok(cond, label){
  if (!cond){ failures++; console.error('FAIL:', label); }
  else console.log('ok:', label);
}

/* 1. vendored post files load and register */
['vendor/post/CopyShader.js', 'vendor/post/LuminosityHighPassShader.js',
 'vendor/post/Pass.js', 'vendor/post/MaskPass.js',
 'vendor/post/ShaderPass.js', 'vendor/post/RenderPass.js',
 'vendor/post/EffectComposer.js', 'vendor/post/UnrealBloomPass.js'].forEach(load);
const NP = globalThis.NBPost;
ok(!!(NP && NP.EffectComposer && NP.RenderPass && NP.ShaderPass &&
     NP.UnrealBloomPass && NP.Pass && NP.FullScreenQuad &&
     NP.CopyShader && NP.LuminosityHighPassShader && NP.MaskPass),
   'all 8 vendored post modules registered on NBPost');

/* 2. grade shader definition is well-formed */
load('cinematic.js');
const Cine = globalThis.NB.Cine;
const GS = Cine._gradeShader;
ok(!!GS, 'GradeShader exposed');
const un = GS.uniforms;
ok(un.tDiffuse && un.uSat && un.uCon && un.uLift && un.uWarm && un.uVig,
   'grade uniforms complete (tDiffuse/sat/con/lift/warm/vig)');
ok(GS.fragmentShader.indexOf('smoothstep') >= 0 && GS.fragmentShader.indexOf('vUv') >= 0,
   'grade fragment does vignette over vUv');
ok(GS.fragmentShader.indexOf('pow(') < 0 && GS.fragmentShader.toLowerCase().indexOf('srgb') < 0,
   'grade does NOT sRGB-encode (preserves art-directed linear look)');
ok(GS.vertexShader.indexOf('vUv') >= 0, 'grade vertex passes vUv');

/* 3. chain builds per tier with a stub renderer */
const stubRenderer = {
  capabilities: { isWebGL2: true },
  getSize: () => ({ width: 1280, height: 720 }),
  getPixelRatio: () => 1,
  setPixelRatio: () => {},
  render: () => {}
};
const stubScene = { add: () => {}, traverse: () => {} };
Cine.init(stubRenderer, stubScene, {});
Cine.setQuality('high');
ok(Cine.composerActive === true, 'high: composer active');
Cine.setQuality('medium');
ok(Cine.composerActive === true, 'medium: composer active (bloom only)');
Cine.setQuality('low');
ok(Cine.composerActive === false, 'low: composer off (direct render)');
Cine.setQuality('high');
ok(Cine.composerActive === true, 'back to high rebuilds chain');

/* 4. FX APIs are no-throw with stubs */
try {
  Cine.muzzleFlash(1, 2, 3);
  Cine.blastFlash(1, 2, 3, true);
  Cine.impactSpark(1, 2, 3);
  Cine.arc(0, 1, 0, 5, 1, 5, 0x9fdcff);
  Cine.update(1 / 60);
  Cine.setGrade({ sat: 1.08, con: 1.05, warm: 0.06, vig: 0.32, lift: [0, 0, 0] });
  Cine.followCamera(10, 20);
  Cine.applyShadowFlags();
  ok(true, 'FX + grade + shadow APIs no-throw on stubs');
} catch (e){ ok(false, 'FX APIs threw: ' + (e && e.message)); }

/* 5. PBR classifier buckets are sane */
load('pbr.js');
const PBR = globalThis.NB.PBR;
ok(PBR.classify(0.08, 0.09, 0.10) === 'metal', 'dark gray -> metal');
ok(PBR.classify(0.85, 0.15, 0.05) === 'glow', 'bright saturated red -> glow');
ok(PBR.classify(0.95, 0.85, 0.20) === 'glow', 'hot amber -> glow');
ok(PBR.classify(0.15, 0.45, 0.75) === 'paint', 'saturated blue -> paint');
ok(PBR.classify(0.75, 0.72, 0.70) === 'paint', 'light neutral -> paint (not metal)');

/* 6. sector grades exist and are distinct */
const secSrc = fs.readFileSync(path.join(root, 'sectors.js'), 'utf8');
const grades = secSrc.match(/grade:\{[^}]*\}/g) || [];
ok(grades.length === 5, '5 sector grade blocks (got ' + grades.length + ')');
const sats = grades.map(g => g.match(/sat:([\d.]+)/)[1]);
ok(new Set(sats).size >= 3, 'sector grades are visually distinct');

if (failures){ console.error(failures + ' FAILURES'); process.exit(1); }
console.log('post-check: all green');
