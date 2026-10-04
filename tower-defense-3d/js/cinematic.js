/* Nova Bastion 3D - cinematic rendering: post-processing chain, dynamic
 * shadows, pooled combat FX, per-sector color grading.
 *
 * Quality tiers:
 *   high   : MSAA render target + UnrealBloom + color-grade/vignette pass
 *            + 2048 shadow map, pixelRatio up to 2
 *   medium : bloom only (no grade pass), 1024 shadow map, pixelRatio up to 1.5
 *   low    : direct render (no composer), shadows off, pixelRatio up to 1
 *
 * NOTE on color: the final grade pass does NOT apply an sRGB encode. The
 * game was art-directed for years against direct linear output; encoding
 * here would brighten every midtone and undo the brightness passes. The
 * grade operates in the same space the game already ships.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};
var NP = globalThis.NBPost = globalThis.NBPost || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }
function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

/* ---------------- color grade shader ---------------- */
var GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat:   { value: 1.0 },
    uCon:   { value: 1.0 },
    uLift:  { value: new (globalThis.THREE ? globalThis.THREE.Vector3 : Object)(0, 0, 0) },
    uWarm:  { value: 0.0 },
    uVig:   { value: 0.3 }
  },
  vertexShader: [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse;',
    'uniform float uSat;',
    'uniform float uCon;',
    'uniform vec3 uLift;',
    'uniform float uWarm;',
    'uniform float uVig;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  vec3 col = c.rgb + uLift;',
    '  col = (col - vec3(0.18)) * uCon + vec3(0.18);',
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(vec3(lum), col, uSat);',
    '  col.r *= (1.0 + uWarm);',
    '  col.b *= (1.0 - uWarm * 0.7);',
    '  vec2 d = vUv - vec2(0.5);',
    '  float v = 1.0 - uVig * smoothstep(0.12, 0.72, dot(d, d) * 2.4);',
    '  col *= v;',
    '  gl_FragColor = vec4(col, c.a);',
    '}'
  ].join('\n')
};

/* ---------------- the Cine singleton ---------------- */
var renderer = null, scene = null, camera = null;
var composer = null, renderPass = null, bloomPass = null, gradePass = null;
var quality = 'high';
var sunRef = null, sunDir = null;
var groundMesh = null;
var inited = false;

/* FX pools */
var flashLights = [], flashIdx = 0;
var flashSprites = [], spriteIdx = 0, spriteTex = null;
var arcs = [], arcIdx = 0;
var shadowTimer = 0;

function makeSpriteTexture(){
  var THREE = globalThis.THREE;
  var s = 128, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  var ctx = cv.getContext('2d');
  var g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,240,210,0.85)');
  g.addColorStop(0.6, 'rgba(255,180,90,0.28)');
  g.addColorStop(1, 'rgba(255,150,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  var tex = new THREE.CanvasTexture(cv);
  return tex;
}

function init(aRenderer, aScene, aCamera){
  var THREE = globalThis.THREE;
  renderer = aRenderer; scene = aScene; camera = aCamera;
  if (inited){ buildChain(quality); return; }
  /* pooled flash lights (muzzle + explosions share the pool) */
  for (var i = 0; i < 6; i++){
    var L = new THREE.PointLight(0xffd9a0, 0, 34, 2);
    L.visible = false;
    scene.add(L);
    flashLights.push(L);
  }
  if (!spriteTex){ try { spriteTex = makeSpriteTexture(); } catch (e){} }
  for (var s2 = 0; s2 < 18; s2++){
    var sm = new THREE.SpriteMaterial({ map: spriteTex, color: 0xffc37a,
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false });
    var sp = new THREE.Sprite(sm);
    sp.visible = false;
    scene.add(sp);
    flashSprites.push({ sp: sp, life: 0, maxLife: 1, grow: 0 });
  }
  buildChain(quality);
  inited = true;
}

function disposeChain(){
  if (composer){
    try {
      if (composer.renderTarget1) composer.renderTarget1.dispose();
      if (composer.renderTarget2) composer.renderTarget2.dispose();
    } catch (e){}
    composer = null; renderPass = null; bloomPass = null; gradePass = null;
  }
}

function buildChain(q){
  var THREE = globalThis.THREE;
  disposeChain();
  if (q === 'low' || !NP.EffectComposer) return; /* direct render */
  try {
    composer = new NP.EffectComposer(renderer);
    var webgl2 = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
    if (q === 'high' && webgl2){
      composer.renderTarget1.samples = 4;
      composer.renderTarget2.samples = 4;
    }
    renderPass = new NP.RenderPass(scene, camera);
    composer.addPass(renderPass);
    var size = renderer.getSize(new THREE.Vector2());
    bloomPass = new NP.UnrealBloomPass(
      new THREE.Vector2(size.x, size.y), 0.55, 0.45, 0.82);
    composer.addPass(bloomPass);
    gradePass = new NP.ShaderPass(GradeShader);
    gradePass.enabled = (q === 'high');
    composer.addPass(gradePass);
  } catch (e){
    disposeChain(); /* fall back to direct render */
  }
}

function setQuality(q){
  q = (q === 'low') ? 'low' : (q === 'medium' ? 'medium' : 'high');
  var changed = (q !== quality);
  quality = q;
  var THREE = globalThis.THREE;
  try {
    var dpr = 1;
    try { dpr = num(globalThis.devicePixelRatio, 1); } catch (e){}
    if (q === 'low') renderer.setPixelRatio(Math.min(dpr, 1));
    else if (q === 'medium') renderer.setPixelRatio(Math.min(dpr, 1.5));
    else renderer.setPixelRatio(Math.min(dpr, 2));
  } catch (e){}
  buildChain(q);
  configureShadows();
  return changed;
}

function resize(w, h){
  try { if (composer) composer.setSize(w, h); } catch (e){}
}

function render(){
  if (composer){ try { composer.render(); return; } catch (e){} }
  try { renderer.render(scene, camera); } catch (e){}
}

/* ---------------- color grade ---------------- */
function setGrade(g){
  g = g || {};
  if (!gradePass) return;
  try {
    var u = gradePass.uniforms;
    u.uSat.value = num(g.sat, 1.0);
    u.uCon.value = num(g.con, 1.0);
    var lift = g.lift || [0, 0, 0];
    u.uLift.value.set(num(lift[0], 0), num(lift[1], 0), num(lift[2], 0));
    u.uWarm.value = num(g.warm, 0);
    u.uVig.value = num(g.vig, 0.3);
  } catch (e){}
}

/* ---------------- dynamic shadows ---------------- */
function enableShadows(sun){
  var THREE = globalThis.THREE;
  sunRef = sun;
  try {
    sunDir = sun.position.clone().normalize();
  } catch (e){ sunDir = new THREE.Vector3(0.5, 1, 0.3).normalize(); }
  configureShadows();
}

function configureShadows(){
  if (!sunRef) return;
  try {
    /* the renderer-wide switch: without this, castShadow does nothing */
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = globalThis.THREE.PCFSoftShadowMap;
    if (quality === 'low'){
      sunRef.castShadow = false;
      return;
    }
    sunRef.castShadow = true;
    var sz = quality === 'medium' ? 1024 : 2048;
    if (sunRef.shadow.mapSize.x !== sz){
      sunRef.shadow.mapSize.set(sz, sz);
      if (sunRef.shadow.map){ sunRef.shadow.map.dispose(); sunRef.shadow.map = null; }
    }
    var sc = sunRef.shadow.camera;
    sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62;
    sc.near = 20; sc.far = 420;
    sc.updateProjectionMatrix();
    sunRef.shadow.bias = -0.0004;
    sunRef.shadow.normalBias = 1.6;
  } catch (e){}
}

/* Re-capture the sun direction (call after applyEnvironment moves the sun). */
function syncSunDir(){
  if (!sunRef) return;
  try {
    sunDir = sunRef.position.clone().sub(sunRef.target.position).normalize();
  } catch (e){}
}

/* Keep the shadow frustum centered on the camera target. */
function followCamera(tx, tz){
  if (!sunRef || quality === 'low' || !sunDir) return;
  try {
    sunRef.position.set(tx + sunDir.x * 180, sunDir.y * 180, tz + sunDir.z * 180);
    sunRef.target.position.set(tx, 0, tz);
    sunRef.target.updateMatrixWorld();
  } catch (e){}
}

function setGroundMesh(m){ groundMesh = m; }

/* Traverse the scene (throttled) and flag meshes for shadow casting.
 * Skips sprites/points/lines, additive FX, and the sky dome. */
function applyShadowFlags(){
  if (!scene || quality === 'low') return;
  var THREE = globalThis.THREE;
  try {
    scene.traverse(function(o){
      if (!o.isMesh) return;
      if (o === groundMesh){ o.receiveShadow = true; o.castShadow = false; return; }
      if (o.userData && o.userData.noShadow) return;
      var m = o.material;
      if (!m) return;
      /* never let the sky dome, holograms or custom shader FX into the
         shadow map (a BackSide sky sphere would black it out) */
      if (m.isShaderMaterial) return;
      if (m.side === globalThis.THREE.BackSide) return;
      if (m.transparent && m.blending === globalThis.THREE.AdditiveBlending) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
  } catch (e){}
}

/* ---------------- pooled combat FX ---------------- */
function muzzleFlash(x, y, z, colorHex){
  if (!inited) return;
  try {
    var L = flashLights[flashIdx];
    flashIdx = (flashIdx + 1) % flashLights.length;
    L.position.set(x, y, z);
    L.color.setHex(colorHex || 0xffd9a0);
    L.intensity = 7;
    L.distance = 26;
    L.visible = true;
    spawnSprite(x, y, z, 2.4, colorHex || 0xffd27a, 0.09, 6);
  } catch (e){}
}

function blastFlash(x, y, z, big){
  if (!inited) return;
  try {
    var L = flashLights[flashIdx];
    flashIdx = (flashIdx + 1) % flashLights.length;
    L.position.set(x, y + 1, z);
    L.color.setHex(0xffa050);
    L.intensity = big ? 22 : 12;
    L.distance = big ? 55 : 38;
    L.visible = true;
    spawnSprite(x, y + 1, z, big ? 11 : 7, 0xffb060, big ? 0.5 : 0.32, big ? 26 : 15);
    spawnSprite(x, y + 2.5, z, big ? 7 : 4.5, 0xfff0c0, 0.28, 8);
  } catch (e){}
}

function impactSpark(x, y, z){
  if (!inited) return;
  spawnSprite(x, y, z, 1.6, 0xffcf7a, 0.12, 4);
}

function spawnSprite(x, y, z, scale, colorHex, life, grow){
  try {
    var s = flashSprites[spriteIdx];
    spriteIdx = (spriteIdx + 1) % flashSprites.length;
    s.sp.position.set(x, y, z);
    s.sp.material.color.setHex(colorHex);
    s.sp.material.rotation = Math.random() * 6.283;
    s.sp.scale.set(scale, scale, 1);
    s.sp.visible = true;
    s.life = life; s.maxLife = life; s.grow = grow || 0;
    s.base = scale;
  } catch (e){}
}

/* Jagged EMP lightning arc between two points. */
function arc(x1, y1, z1, x2, y2, z2, colorHex){
  if (!inited) return;
  var THREE = globalThis.THREE;
  try {
    var slot = arcIdx;
    arcIdx = (arcIdx + 1) % 12;
    var a = arcs[slot];
    if (!a){
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
      var line = new THREE.Line(g, new THREE.LineBasicMaterial({
        color: 0x9fdcff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      a = { line: line, life: 0 };
      arcs[slot] = a;
    }
    var pos = a.line.geometry.attributes.position;
    var segs = 8;
    for (var i = 0; i <= segs; i++){
      var t = i / segs;
      var jx = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 3.2;
      var jy = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 2.4;
      var jz = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 3.2;
      pos.setXYZ(i, x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy, z1 + (z2 - z1) * t + jz);
    }
    pos.needsUpdate = true;
    a.line.material.color.setHex(colorHex || 0x9fdcff);
    a.line.visible = true;
    a.life = 0.22;
  } catch (e){}
}

function update(dt){
  var i;
  for (i = 0; i < flashLights.length; i++){
    var L = flashLights[i];
    if (L.intensity > 0){
      L.intensity = Math.max(0, L.intensity - dt * 55);
      if (L.intensity <= 0) L.visible = false;
    }
  }
  for (i = 0; i < flashSprites.length; i++){
    var s = flashSprites[i];
    if (s.life > 0){
      s.life -= dt;
      var t = Math.max(0, s.life / s.maxLife);
      s.sp.material.opacity = t;
      var sc = s.base + s.grow * (1 - t);
      s.sp.scale.set(sc, sc, 1);
      if (s.life <= 0) s.sp.visible = false;
    }
  }
  for (i = 0; i < arcs.length; i++){
    var a = arcs[i];
    if (a && a.life > 0){
      a.life -= dt;
      a.line.material.opacity = Math.max(0, a.life / 0.22) * (0.6 + 0.4 * Math.random());
      if (a.life <= 0) a.line.visible = false;
    }
  }
  /* re-scan shadow flags twice a second (catches newly built meshes) */
  shadowTimer += dt;
  if (shadowTimer > 0.5){ shadowTimer = 0; applyShadowFlags(); }
}

NB.Cine = {
  init: init,
  setQuality: setQuality,
  resize: resize,
  render: render,
  setGrade: setGrade,
  enableShadows: enableShadows,
  syncSunDir: syncSunDir,
  followCamera: followCamera,
  setGroundMesh: setGroundMesh,
  applyShadowFlags: applyShadowFlags,
  muzzleFlash: muzzleFlash,
  blastFlash: blastFlash,
  impactSpark: impactSpark,
  arc: arc,
  update: update,
  get quality(){ return quality; },
  get composerActive(){ return !!composer; },
  /* test hooks */
  _gradeShader: GradeShader,
  _reset: function(){
    disposeChain();
    flashLights = []; flashSprites = []; arcs = [];
    flashIdx = 0; spriteIdx = 0; arcIdx = 0; spriteTex = null;
    sunRef = null; groundMesh = null; inited = false; quality = 'high';
  }
};

})();
