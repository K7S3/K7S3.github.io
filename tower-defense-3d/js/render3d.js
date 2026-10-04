/* Nova Bastion 3D - WebGL renderer (three.js r147, vendored, no CDN).
 *
 * Visual identity: "ember and hologram", 2100 military sci-fi, humans vs the Rust.
 * Palette with meaning: deep charcoal/indigo battlefield; warm AMBER = humanity
 * (colony windows, Spire heart, veteran trim); CYAN = command network and holograms
 * (uplink grid, IRA, accents); hot RED-ORANGE = the Rust (eye-glows, warnings).
 * Beauty tricks are cheap: emissive materials, additive glow sprites (no bloom
 * passes), distance fog, instancing everywhere.
 *
 * Coordinate contract: sim units ARE world units. Grid is COLS x ROWS cells,
 * CELL world units per cell (defaults 64 x 40 x 2, world 128 x 80). Structures
 * carry x,z in world units (or cx,cz grid cells). Ghost cells are grid coords.
 *
 * Defensive by design: every snapshot field is optional. If sim.snapshot()
 * throws, the last good frame is kept. Events come from sim.drainEvents() when
 * present, otherwise sim.events is drained manually.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }
function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t){ return a + (b - a) * t; }
function arr(v){ return Array.isArray(v) ? v : []; }
function frac(v){ return v - Math.floor(v); }

/* deterministic rng for static decor */
function mulberry(seed){
  var s = seed >>> 0;
  return function(){
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var TOWER_IDS = ['pulse','frost','arc','mortar','sniper','chrono','mint','amplify'];
var ENEMY_TYPES = ['drone','runner','swarmling','tank','shieldbearer','phantom',
  'medic','splitter','mite','sapper','brute','dreadnought','overmind','leviathan'];
var BOSS_SET = { dreadnought: 1, overmind: 1, leviathan: 1 };
var SKITTER_SET = { drone: 1, runner: 1, swarmling: 1, splitter: 1, mite: 1, sapper: 1 };
var COMBAT_TOWERS = { pulse: 1, mortar: 1, sniper: 1, arc: 1 };

function towerColor(id){
  var T = (NB.TOWERS && NB.TOWERS[id]) || {};
  return T.color || '#22d3ee';
}
function enemyDef(type){
  return (NB.ENEMIES && NB.ENEMIES[type]) || {};
}

NB.Renderer3D = function(canvas){
  var r = {};
  var THREE = null;

  /* ---------- persistent state ---------- */
  var inited = false;
  var renderer = null, scene = null, camera3 = null;
  var W = 128, H = 80, CELL = 2, COLS = 64, ROWS = 40;
  var time = 0;
  var quality = 'high';
  var perfGov = null; /* NB.Perf adaptive governor, created by r.perfInit */
  var lastSnap = null;
  var sectorSig = '';

  /* camera rig: desired values ease toward actual */
  var cam = {
    dtx: 64, dtz: 40, ddist: 88, dpol: 58 * Math.PI / 180, daz: 0,
    tx: 64, tz: 40, dist: 88, pol: 58 * Math.PI / 180, az: 0,
    trauma: 0,
    cine: null /* {fx,fz,fdist, tx,tz,tdist, t, dur} */
  };
  var lastCineT = null;

  /* surge (blackout) state: manual override OR snapshot */
  var surgeManual = { active: false, i: 0 };

  /* registries */
  var towers = {};    /* instId -> entry */
  var reactors = {};  /* instId -> entry */
  var bosses = {};    /* enemy id -> entry */
  var wallIds = [];   /* instance index -> wall id */
  var headings = {};  /* enemy id -> {x,z,a} */
  var hitPool = [];
  var hqPos = { x: 64, z: 40 };

  /* scene refs */
  var groundMesh = null, groundTex = null, groundCanvas = null, groundCtx = null;
  var crackLines = null, rubbleMesh = null, rockMesh = null, ruinGroup = null;
  var spire = null, spireRefs = {};
  var iraSmall = null, iraBig = null, iraShimmer = null;
  var uplinkGroup = null, hexRings = [], edgeRing = null, edgeGlow = null, lightCone = null;
  var hemi = null, sun = null, spireLight = null, flashLight = null, flashSprite = null;
  var baseExposure = 1.6, baseHemi = 1.15, baseSun = 1.6, brightnessV = 1;
  var wallMesh = null;
  var enemyPools = {};   /* type -> {mesh, cap} */
  var eyeMesh = null, legMesh = null, shieldMesh = null;
  var projMesh = null, beamLines = null, arcLines = null;
  var sparks = null, smoke = null, ash = null, debris = null;
  var rings = [];        /* shockwave pool */
  var craterMesh = null, craterIdx = 0;
  var ghostMeshes = [], ghostMats = {};
  var selRing = null, hoverBox = null;
  var colonistBodies = null, colonistHeads = null, colonists = [];
  var cineSprite = null, cineCanvas = null, cineCtx = null, cineTex = null;
  var uplinkR = 9, texUplinkR = -999;
  var fogBase = null, fogSurge = null;
  var auraT = 0, mistT = 0, arcT = 0;

  /* temps (no per-frame allocation in hot loops) */
  var _v1, _v2, _v3, _m1, _q1, _e1, _c1, _c2, _s1;

  r.eventListener = null;

  /* ================= init ================= */
  r.init = function(){
    THREE = globalThis.THREE;
    if (!THREE) throw new Error('webgl');
    var cv = canvas;
    if (!cv || typeof document === 'undefined') throw new Error('webgl');
    try {
      var probe = document.createElement('canvas');
      var gl = probe.getContext('webgl2') || probe.getContext('webgl') ||
               probe.getContext('experimental-webgl');
      if (!gl) throw new Error('webgl');
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true,
        powerPreference: 'high-performance' });
    } catch (e) {
      throw new Error('webgl');
    }
    var dpr = 1;
    try { dpr = num(globalThis.devicePixelRatio, 1); } catch (e) {}
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /* brightness system: base exposure for a clearly-readable scene;
       setBrightness(v) scales it (v=1 is the default). */
    baseExposure = 1.6;
    renderer.toneMappingExposure = baseExposure;

    scene = new THREE.Scene();
    fogBase = new THREE.Color(0x10141f);
    fogSurge = new THREE.Color(0x1c0a0c);
    scene.background = new THREE.Color(0x05060b);
    scene.fog = new THREE.FogExp2(fogBase.getHex(), 0.006);

    /* Procedural environment map. Metallic PBR surfaces with no env map
       render near-black; this gives them something to reflect. One-time
       PMREM cost at boot. Palette matches ember-and-hologram: warm key,
       cyan fill, cool bounce. */
    try { buildEnvironment(); } catch (e) {}

    camera3 = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 900);

    hemi = new THREE.HemisphereLight(0x9aabcc, 0x4a3a28, 1.15);
    baseHemi = 1.15;
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
    baseSun = 1.6;
    sun.position.set(70, 110, 35);
    scene.add(sun);
    spireLight = new THREE.PointLight(0xffb347, 1.6, 70, 2);
    scene.add(spireLight);
    flashLight = new THREE.PointLight(0xffd27a, 0, 26, 2);
    scene.add(flashLight);

    _v1 = new THREE.Vector3(); _v2 = new THREE.Vector3(); _v3 = new THREE.Vector3();
    _m1 = new THREE.Matrix4(); _q1 = new THREE.Quaternion();
    _e1 = new THREE.Euler(); _c1 = new THREE.Color(); _c2 = new THREE.Color();
    _s1 = new THREE.Vector3();

    buildGround();
    buildSky();
    buildSpire();
    buildUplinkFx();
    buildWalls();
    buildEnemies();
    buildProjectiles();
    buildBeams();
    buildArcs();
    buildParticles();
    buildDebris();
    buildRings();
    buildCraters();
    buildGhost();
    buildSelection();
    buildColonists();
    buildIRA();
    buildCineSprite();
    buildFlashSprite();
    buildProps();

    /* Cinematic layer: post-processing chain, dynamic shadows, pooled FX.
       Fully optional: if the vendored post pieces fail to load, the game
       renders directly exactly as before. */
    try {
      if (NB.Cine && globalThis.NBPost && NBPost.EffectComposer){
        NB.Cine.init(renderer, scene, camera3);
        NB.Cine.enableShadows(sun);
        NB.Cine.setGroundMesh(groundMesh);
        NB.Cine.setQuality(quality);
      }
    } catch (e){}

    inited = true;
    var w = num(cv.width, 800), h = num(cv.height, 600);
    r.resize(w, h);
    return r;
  };

  r.resize = function(w, h){
    w = Math.max(1, num(w, 800)); h = Math.max(1, num(h, 600));
    if (!inited) return;
    try { renderer.setSize(w, h, false); } catch (e) {}
    camera3.aspect = w / h;
    camera3.updateProjectionMatrix();
    try { if (NB.Cine) NB.Cine.resize(w, h); } catch (e) {}
  };

  /* Three quality tiers: high (full post chain + 2048 shadows), medium
     (bloom only + 1024 shadows), low (direct render, no shadows). */
  r.setQuality = function(q){
    quality = (q === 'low') ? 'low' : ((q === 'medium') ? 'medium' : 'high');
    var dpr = 1;
    try { dpr = num(globalThis.devicePixelRatio, 1); } catch (e) {}
    if (inited){
      if (quality === 'low') renderer.setPixelRatio(Math.min(dpr, 1));
      else if (quality === 'medium') renderer.setPixelRatio(Math.min(dpr, 1.5));
      else renderer.setPixelRatio(Math.min(dpr, 2));
      try { if (NB.Cine) NB.Cine.setQuality(quality); } catch (e){}
    }
  };
  r.getQuality = function(){ return quality; };

  /* Adaptive quality: rolling-FPS governor steps tiers up/down with
     hysteresis; manual override locks the tier. Called once at boot. */
  r.perfInit = function(initialQ, manualQ){
    if (!NB.Perf) return;
    try {
      perfGov = NB.Perf.create({
        initial: initialQ || NB.Perf.autoDetect(),
        onChange: function(q){ r.setQuality(q); }
      });
      if (manualQ && manualQ !== 'auto') perfGov.setManual(manualQ);
      else r.setQuality(perfGov.tier);
    } catch (e){}
  };
  r.perfSetManual = function(q){
    try { if (perfGov) perfGov.setManual(q); } catch (e){}
  };

  /* manual blackout-surge override; OR-combined with snapshot.surge */
  r.setSurge = function(active, intensity01){
    surgeManual.active = !!active;
    surgeManual.i = clamp(num(intensity01, 0.8), 0, 1);
  };
  r.setStorm = r.setSurge; /* legacy alias */

  /* Display brightness (accessibility + phone-in-sunlight). v=1 is the
     art-directed default; range 0.55..1.8. Persists via UI save. */
  r.setBrightness = function(v){
    v = clamp(num(v, 1), 0.55, 1.8);
    brightnessV = v;
    try {
      if (renderer) renderer.toneMappingExposure = baseExposure * v;
      if (hemi) hemi.intensity = baseHemi * (0.55 + 0.45 * v);
      if (sun) sun.intensity = baseSun * (0.55 + 0.45 * v);
    } catch (e){}
    return v;
  };
  r.getBrightness = function(){ return brightnessV; };
  /* test hook: lighting params for luminance-band assertions */
  r.debugLighting = function(){
    return {
      exposure: renderer ? renderer.toneMappingExposure : 0,
      hemi: hemi ? hemi.intensity : 0,
      sun: sun ? sun.intensity : 0,
      fogDensity: 0.006,
      brightness: brightnessV
    };
  };

  /* ================= camera ================= */
  function camAxes(outF, outR){
    var s = Math.sin(cam.az), c = Math.cos(cam.az);
    outF.set(-s, 0, -c);      /* forward on ground (away from viewer) */
    outR.set(c, 0, -s);       /* right on ground */
  }
  var _f = null, _rr = null;

  r.camera = {
    panBy: function(dx, dz){
      dx = num(dx, 0); dz = num(dz, 0);
      if (!_f){ _f = new THREE.Vector3(); _rr = new THREE.Vector3(); }
      camAxes(_f, _rr);
      cam.dtx = clamp(cam.dtx + _rr.x * dx + _f.x * dz, -6, W + 6);
      cam.dtz = clamp(cam.dtz + _rr.z * dx + _f.z * dz, -6, H + 6);
      cam.cine = null;
    },
    zoomBy: function(mult){
      mult = num(mult, 1);
      cam.ddist = clamp(cam.ddist * mult, 22, 110);
      if (cam.cine) cam.cine.tdist = cam.ddist;
    },
    rotateBy: function(rad){
      cam.daz += num(rad, 0);
    },
    reset: function(hx, hz){
      hx = num(hx, hqPos.x); hz = num(hz, hqPos.z);
      cam.dtx = cam.tx = hx; cam.dtz = cam.tz = hz;
      cam.ddist = cam.dist = 88;
      cam.dpol = cam.pol = 58 * Math.PI / 180;
      cam.daz = cam.az = 0;
      cam.cine = null;
    },
    cinematicTo: function(x, z, dist, dur, polarDeg){
      x = num(x, cam.tx); z = num(z, cam.tz);
      dist = clamp(num(dist, 34), 22, 110); dur = Math.max(0.4, num(dur, 2.2));
      cam.cine = { fx: cam.tx, fz: cam.tz, fdist: cam.dist,
                   tx: x, tz: z, tdist: dist, t: 0, dur: dur };
      if (polarDeg != null) cam.dpol = clamp(num(polarDeg, 52) * Math.PI / 180, 0.26, 1.4);
    },
    addTrauma: function(a){
      cam.trauma = clamp(cam.trauma + num(a, 0.2), 0, 1);
    }
  };

  function updateCamera(dt){
    var k = 1 - Math.exp(-7 * dt);
    cam.dpol = clamp(cam.dpol, 0.26, 1.4); /* 15 to 80 degrees from vertical */
    if (cam.cine){
      var c = cam.cine;
      c.t += dt;
      var t = clamp(c.t / c.dur, 0, 1);
      var e = t * t * (3 - 2 * t);
      cam.dtx = lerp(c.fx, c.tx, e);
      cam.dtz = lerp(c.fz, c.tz, e);
      cam.ddist = lerp(c.fdist, c.tdist, e);
      if (t >= 1) cam.cine = null;
    }
    cam.tx += (cam.dtx - cam.tx) * k;
    cam.tz += (cam.dtz - cam.tz) * k;
    cam.dist += (cam.ddist - cam.dist) * k;
    cam.pol += (cam.dpol - cam.pol) * k;
    cam.az += (cam.daz - cam.az) * k;
    cam.trauma = Math.max(0, cam.trauma - dt * 1.6);

    var sp = Math.sin(cam.pol);
    var px = cam.tx + cam.dist * sp * Math.sin(cam.az);
    var py = cam.dist * Math.cos(cam.pol);
    var pz = cam.tz + cam.dist * sp * Math.cos(cam.az);
    if (cam.trauma > 0.001){
      var tr = cam.trauma * cam.trauma;
      var t1 = time * 61.7, t2 = time * 53.3;
      px += Math.sin(t1) * 1.4 * tr;
      py += Math.sin(t2 * 1.3) * 0.9 * tr;
      pz += Math.cos(t1 * 0.9) * 1.4 * tr;
    }
    camera3.position.set(px, py, pz);
    camera3.lookAt(cam.tx, 2.5, cam.tz);
    /* keep the shadow frustum centered on the camera target */
    try { if (NB.Cine) NB.Cine.followCamera(cam.tx, cam.tz); } catch (e){}
  }

  /* Terrain-aware picking: sphere-trace the ray against the real height
   * field (NB.Pick.rayGroundHit) instead of the y=0 plane. The old y=0
   * math missed hilltops by 3+ cells, which is why towers seemed to place
   * "randomly". groundY is the exact function displacing the visible mesh.
   * Returns null for sky clicks and for hits outside the world margin. */
  r.screenToGround = function(clientX, clientY){
    if (!inited) return null;
    var rect = { left: 0, top: 0, width: 800, height: 600 };
    try { rect = canvas.getBoundingClientRect(); } catch (e) {}
    camera3.updateMatrixWorld();
    var nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    var ny = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    _v1.set(nx, ny, 0.5).unproject(camera3);
    _v2.copy(_v1).sub(camera3.position).normalize();
    var hit = NB.Pick.rayGroundHit(camera3.position.x, camera3.position.y,
      camera3.position.z, _v2.x, _v2.y, _v2.z, groundY);
    if (!hit) return null;
    if (hit.x < -8 || hit.x > W + 8 || hit.z < -8 || hit.z > H + 8) return null;
    return hit;
  };

  r.pickStructure = function(clientX, clientY){
    if (!inited) return null;
    var rect = { left: 0, top: 0, width: 800, height: 600 };
    try { rect = canvas.getBoundingClientRect(); } catch (e) {}
    camera3.updateMatrixWorld();
    var nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    var ny = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    _v1.set(nx, ny, 0.5);
    var ray = new THREE.Raycaster();
    ray.setFromCamera(_v1, camera3);
    var best = null, bestD = 1e9, i, h;
    for (i = 0; i < hitPool.length; i++){
      h = hitPool[i];
      h.updateMatrixWorld();
      var hits = ray.intersectObject(h, false);
      if (hits.length && hits[0].distance < bestD){
        bestD = hits[0].distance;
        best = { kind: h.userData.kind, instId: h.userData.instId };
      }
    }
    if (wallMesh && wallMesh.count > 0){
      wallMesh.updateMatrixWorld();
      var wh = ray.intersectObject(wallMesh, false);
      for (i = 0; i < wh.length; i++){
        if (wh[i].distance < bestD && wh[i].instanceId != null){
          bestD = wh[i].distance;
          best = { kind: 'wall', instId: wallIds[wh[i].instanceId] };
        }
      }
    }
    return best;
  };

  /* Procedural PMREM environment: gradient sky + warm key card + cyan
     fill + cool bounce. Gives metallic materials something to reflect so
     they read as metal instead of black. */
  function buildEnvironment(){
    var es = new THREE.Scene();
    es.background = new THREE.Color(0x11141f);
    function card(hex, mult, w, h, x, y, z){
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      m.material.color.setHex(hex).multiplyScalar(mult);
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      es.add(m);
    }
    card(0xffb347, 5.0, 34, 34, 45, 65, 25);    /* warm key sun */
    card(0x22d3ee, 2.0, 44, 20, -55, 28, -12);  /* cyan hologram fill */
    card(0x8a9ac0, 1.1, 70, 70, 0, -35, 0);     /* cool ground bounce */
    card(0xfff2df, 0.9, 22, 22, -25, 45, 55);   /* soft top fill */
    card(0xff5a2a, 1.4, 26, 12, 30, 8, -60);    /* ember rim */
    var pm = new THREE.PMREMGenerator(renderer);
    var rt = pm.fromScene(es, 0.04);
    scene.environment = rt.texture;
    pm.dispose();
  }

  /* ================= ground ================= */
  function groundHeight(x, z){
    return 0.32 * Math.sin(x * 0.11) * Math.cos(z * 0.13) +
           0.18 * Math.sin(x * 0.31 + z * 0.17) +
           0.10 * Math.cos(x * 0.53 - z * 0.41);
  }

  function buildGround(){
    var geo = new THREE.PlaneGeometry(W, H, 72, 45);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++){
      var x = pos.getX(i) + W / 2, z = pos.getZ(i) + H / 2;
      pos.setY(i, groundHeight(x, z));
    }
    geo.computeVertexNormals();

    groundCanvas = document.createElement('canvas');
    groundCanvas.width = 1024; groundCanvas.height = 640;
    groundCtx = groundCanvas.getContext('2d');
    groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.anisotropy = 4;
    paintGround(null, null);

    var mat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.94, metalness: 0.08 });
    groundMesh = new THREE.Mesh(geo, mat);
    groundMesh.position.set(W / 2, 0, H / 2);
    scene.add(groundMesh);

    /* glowing red cracks near Rust gates (additive lines) */
    crackLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xff3a12, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    crackLines.frustumCulled = false;
    scene.add(crackLines);

    /* blocked terrain: instanced dark rubble */
    var rubGeo = new THREE.BoxGeometry(1, 1, 1);
    var rubMat = new THREE.MeshStandardMaterial({ color: 0x35313c, roughness: 0.95, metalness: 0.05 });
    rubbleMesh = new THREE.InstancedMesh(rubGeo, rubMat, 700);
    rubbleMesh.frustumCulled = false;
    rubbleMesh.count = 0;
    scene.add(rubbleMesh);

    /* scattered rocks */
    var rockGeo = new THREE.IcosahedronGeometry(1, 0);
    var rockMat = new THREE.MeshStandardMaterial({ color: 0x4c4557, roughness: 0.95 });
    rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, 120);
    rockMesh.frustumCulled = false;
    var rng = mulberry(77);
    for (var rI = 0; rI < 120; rI++){
      var rx = rng() * W, rz = rng() * H;
      _e1.set(rng() * 3, rng() * 3, rng() * 3);
      _q1.setFromEuler(_e1);
      var rs = 0.25 + rng() * rng() * 1.1;
      _v1.set(rx, groundHeight(rx, rz) + rs * 0.25, rz);
      _s1.set(rs * (0.7 + rng() * 0.7), rs * (0.5 + rng() * 0.5), rs * (0.7 + rng() * 0.7));
      _m1.compose(_v1, _q1, _s1);
      rockMesh.setMatrixAt(rI, _m1);
    }
    rockMesh.instanceMatrix.needsUpdate = true;
    scene.add(rockMesh);

    /* ruined structures at the map edges: the world before */
    ruinGroup = new THREE.Group();
    var ruinMat = new THREE.MeshStandardMaterial({ color: 0x322e3d, roughness: 0.9, metalness: 0.15 });
    var rr = mulberry(913);
    for (var q = 0; q < 14; q++){
      var g = new THREE.Group();
      var n = 2 + Math.floor(rr() * 3);
      for (var b = 0; b < n; b++){
        var bw = 1 + rr() * 2.4, bh = 0.8 + rr() * rr() * 3.2, bd = 1 + rr() * 2.4;
        var bm = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), ruinMat);
        bm.position.set((rr() - 0.5) * 5, bh * 0.32, (rr() - 0.5) * 5);
        bm.rotation.y = rr() * Math.PI;
        bm.rotation.z = (rr() - 0.5) * 0.35;
        g.add(bm);
      }
      var edge = q % 4;
      var ex = rr() * W, ez = rr() * H;
      if (edge === 0) ez = 2 + rr() * 4;
      else if (edge === 1) ez = H - 2 - rr() * 4;
      else if (edge === 2) ex = 2 + rr() * 4;
      else ex = W - 2 - rr() * 4;
      g.position.set(ex, 0, ez);
      ruinGroup.add(g);
    }
    scene.add(ruinGroup);
  }

  /* paint the ground canvas: dusty concrete/metal, grid, blocked, gate cracks,
     faint cyan uplink tint. blockedRects in grid coords; gates in grid coords. */
  /* ================= sky: gradient dome, stars, aurora =================
     Replaces the old flat-black background. A big BackSide sphere with a
     cheap gradient shader (top/horizon/bottom + sun disk glow), a Points
     starfield for night sectors, and two animated aurora ribbons for the
     sectors that want them. Per-sector look is applied by applyEnvironment(),
     driven by the `env` block on each sector in js/sectors.js. */
  var skyUniforms = null, starMat = null, auroraMats = [], skyDome = null;
  var envSunColor = null, envId = '', currentEnv = null, envFogDensity = 0.0058;
  var DEFAULT_ENV = {
    skyTop: '#3a1f33', skyHorizon: '#c4552a', skyBottom: '#1c0f14',
    fog: '#6e3524', fogDensity: 0.0058,
    sunColor: '#ffb36b', sunIntensity: 1.7, sunElev: 24, sunAzim: 145,
    hemiSky: '#c48a6a', hemiGround: '#3a2418', hemiIntensity: 1.2,
    ground: ['#5e636e', '#6f6357', '#5a5f6a'], dust: '#c47a3a',
    stars: 0.0, aurora: 0.0
  };

  function buildSky(){
    skyUniforms = {
      topColor: { value: new THREE.Color(DEFAULT_ENV.skyTop) },
      horizonColor: { value: new THREE.Color(DEFAULT_ENV.skyHorizon) },
      bottomColor: { value: new THREE.Color(DEFAULT_ENV.skyBottom) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(DEFAULT_ENV.sunColor) },
      sunGlow: { value: 0.5 }
    };
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: skyUniforms,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor;',
        'uniform vec3 sunColor; uniform vec3 sunDir; uniform float sunGlow;',
        'varying vec3 vDir;',
        'void main(){',
        '  float h = clamp(vDir.y, -1.0, 1.0);',
        '  vec3 col = h > 0.0',
        '    ? mix(horizonColor, topColor, pow(h, 0.55))',
        '    : mix(horizonColor, bottomColor, pow(-h, 0.6));',
        '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  col += sunColor * (pow(s, 350.0) * 1.2 + pow(s, 8.0) * sunGlow * 0.35);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    skyDome = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 20), skyMat);
    skyDome.frustumCulled = false;
    skyDome.renderOrder = -10;
    scene.add(skyDome);

    /* starfield (visible in night sectors via env.stars) */
    var nstars = 500, sp = new Float32Array(nstars * 3);
    for (var i = 0; i < nstars; i++){
      var th = Math.random() * 6.2832, ph = Math.random() * 1.35 + 0.08;
      sp[i * 3] = 740 * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = 740 * Math.cos(ph);
      sp[i * 3 + 2] = 740 * Math.sin(ph) * Math.sin(th);
    }
    var sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.8,
      sizeAttenuation: false, transparent: true, opacity: 0,
      depthWrite: false, fog: false });
    var stars = new THREE.Points(sgeo, starMat);
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    scene.add(stars);

    /* aurora ribbons (animated; intensity per-sector via env.aurora) */
    for (var k = 0; k < 2; k++){
      var am = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: Math.random() * 10 },
          uColor: { value: new THREE.Color(k ? '#3af2a0' : '#3aa8f2') },
          uIntensity: { value: 0 }
        },
        vertexShader: [
          'varying vec2 vUv;',
          'void main(){ vUv = uv;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
        ].join('\n'),
        fragmentShader: [
          'uniform float uTime; uniform float uIntensity; uniform vec3 uColor;',
          'varying vec2 vUv;',
          'void main(){',
          '  float band = sin(vUv.x * 18.0 + uTime * 0.6',
          '    + sin(vUv.x * 5.0 + uTime * 0.3) * 1.5);',
          '  band = smoothstep(0.1, 0.9, band * 0.5 + 0.5);',
          '  float vert = sin(vUv.y * 3.14159);',
          '  float a = band * vert * vert * uIntensity * 0.5;',
          '  gl_FragColor = vec4(uColor, a);',
          '}'
        ].join('\n')
      });
      var ribbon = new THREE.Mesh(new THREE.PlaneGeometry(900, 160, 1, 1), am);
      ribbon.position.set(k ? -150 : 200, 330, k ? -420 : -380);
      ribbon.rotation.y = k ? 0.5 : -0.4;
      ribbon.rotation.z = k ? 0.12 : -0.1;
      ribbon.frustumCulled = false;
      ribbon.renderOrder = -8;
      scene.add(ribbon);
      auroraMats.push(am);
    }
    envSunColor = new THREE.Color(DEFAULT_ENV.sunColor);
    applyEnvironment(DEFAULT_ENV);
  }

  /* Apply a sector's environment look: sky gradient, fog, sun, hemi, stars,
     aurora. Called when the sector changes (and once at boot). */
  function applyEnvironment(env){
    env = env || {};
    function pick(k){ return env[k] == null ? DEFAULT_ENV[k] : env[k]; }
    skyUniforms.topColor.value.set(pick('skyTop'));
    skyUniforms.horizonColor.value.set(pick('skyHorizon'));
    skyUniforms.bottomColor.value.set(pick('skyBottom'));
    var fogC = pick('fog');
    scene.fog.color.set(fogC);
    scene.fog.density = num(pick('fogDensity'), 0.0058);
    envFogDensity = scene.fog.density;
    fogBase.set(fogC);
    hemi.color.set(pick('hemiSky'));
    hemi.groundColor.set(pick('hemiGround'));
    baseHemi = num(pick('hemiIntensity'), 1.2);
    var scol = pick('sunColor');
    sun.color.set(scol);
    envSunColor.set(scol);
    baseSun = num(pick('sunIntensity'), 1.7);
    var el = num(pick('sunElev'), 24) * Math.PI / 180;
    var az = num(pick('sunAzim'), 145) * Math.PI / 180;
    sun.position.set(
      Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)
    ).multiplyScalar(140);
    /* shadow rig follows the new sun direction */
    try { if (NB.Cine) NB.Cine.syncSunDir(); } catch (e){}
    skyUniforms.sunDir.value.copy(sun.position).normalize();
    skyUniforms.sunColor.value.set(scol);
    starMat.opacity = num(pick('stars'), 0) * 0.9;
    var au = num(pick('aurora'), 0);
    for (var i = 0; i < auroraMats.length; i++)
      auroraMats[i].uniforms.uIntensity.value = au;
    /* cinematic color grade for this sector (teal-orange dusk, cold night...) */
    try { if (NB.Cine) NB.Cine.setGrade(env.grade); } catch (e){}
    currentEnv = env;
  }

  function paintGround(blockedRects, gates, env){
    var ctx = groundCtx;
    var cw = groundCanvas.width, ch = groundCanvas.height;
    var sx = cw / W, sz = ch / H;
    ctx.clearRect(0, 0, cw, ch);
    /* base: per-sector ground palette (env.ground), clearly readable;
       dusty concrete/metal, dramatic, never near-black */
    var gc = (env && env.ground) || DEFAULT_ENV.ground;
    var grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, gc[0]);
    grad.addColorStop(0.5, gc[1]);
    grad.addColorStop(1, gc[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    var rng = mulberry(4242);
    for (var i = 0; i < 4200; i++){
      var gx = rng() * cw, gy = rng() * ch, gr = 1 + rng() * 7;
      var warm = rng() < 0.4;
      ctx.fillStyle = warm ? 'rgba(120,95,65,0.12)' : 'rgba(30,26,36,0.14)';
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 6.2832); ctx.fill();
    }
    /* fine grain */
    for (var f = 0; f < 2600; f++){
      var fx = rng() * cw, fy = rng() * ch;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(fx, fy, 1.6, 1.6);
    }
    /* cracks: thin dark jagged polylines */
    ctx.strokeStyle = 'rgba(20,14,10,0.35)'; ctx.lineWidth = 1.2;
    for (var cr = 0; cr < 46; cr++){
      var px0 = rng() * cw, py0 = rng() * ch;
      ctx.beginPath(); ctx.moveTo(px0, py0);
      var px1 = px0, py1 = py0;
      for (var sg2 = 0; sg2 < 5; sg2++){
        px1 += (rng() - 0.5) * 46; py1 += (rng() - 0.5) * 46;
        ctx.lineTo(px1, py1);
      }
      ctx.stroke();
    }
    /* metal plate seams */
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
    var plate = 8 * CELL * sx;
    for (var px = 0; px <= cw; px += plate){
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, ch); ctx.stroke();
    }
    for (var pz = 0; pz <= ch; pz += plate){
      ctx.beginPath(); ctx.moveTo(0, pz); ctx.lineTo(cw, pz); ctx.stroke();
    }
    /* subtle per-cell grid */
    ctx.strokeStyle = 'rgba(150,180,220,0.055)'; ctx.lineWidth = 1;
    var cell = CELL * sx;
    for (var cx = 0; cx <= cw; cx += cell){
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, ch); ctx.stroke();
    }
    for (var cz = 0; cz <= ch; cz += cell){
      ctx.beginPath(); ctx.moveTo(0, cz); ctx.lineTo(cw, cz); ctx.stroke();
    }
    /* blocked terrain patches */
    var br = blockedRects || [];
    for (var b = 0; b < br.length; b++){
      var r = normRect(br[b]);
      ctx.fillStyle = 'rgba(20,17,24,0.85)';
      ctx.fillRect(r.x * CELL * sx, r.z * CELL * sz, r.w * CELL * sx, r.h * CELL * sz);
    }
    /* glowing red cracks near gates */
    var gs = gates || [];
    ctx.strokeStyle = 'rgba(255,70,20,0.9)'; ctx.lineWidth = 3;
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 12;
    for (var gi = 0; gi < gs.length; gi++){
      var gx0 = (gs[gi].x + 0.5) * CELL * sx, gz0 = (gs[gi].z + 0.5) * CELL * sz;
      for (var cn = 0; cn < 5; cn++){
        var ang = (gi * 2.399 + cn * 1.256) % 6.2832;
        var len = (2 + ((gi * 7 + cn * 13) % 5)) * CELL * sx;
        var jx = gx0 + Math.cos(ang) * len * 0.4, jz = gz0 + Math.sin(ang) * len * 0.4;
        ctx.beginPath(); ctx.moveTo(gx0, gz0);
        ctx.quadraticCurveTo(
          gx0 + Math.cos(ang + 0.5) * len * 0.5, gz0 + Math.sin(ang + 0.5) * len * 0.5,
          gx0 + Math.cos(ang) * len, gz0 + Math.sin(ang) * len);
        ctx.stroke();
        void jx; void jz;
      }
    }
    ctx.shadowBlur = 0;
    /* faint cyan uplink tint */
    if (uplinkR > 0){
      var ug = ctx.createRadialGradient(
        hqPos.x * sx, hqPos.z * sz, 0, hqPos.x * sx, hqPos.z * sz, uplinkR * CELL * sx);
      ug.addColorStop(0, 'rgba(34,211,238,0.10)');
      ug.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = ug;
      ctx.fillRect(0, 0, cw, ch);
    }
    groundTex.needsUpdate = true;
  }

  function normRect(r){
    if (Array.isArray(r)) return { x: num(r[0], 0), z: num(r[1], 0), w: num(r[2], 1), h: num(r[3], 1) };
    r = r || {};
    return { x: num(r.x, 0), z: num(r.z, 0), w: num(r.w || r.width, 1), h: num(r.h || r.height, 1) };
  }

  /* rebuild rubble instances + ground texture when the sector changes */
  function refreshSector(sector){
    sector = sector || {};
    /* per-sector environment look (sky, fog, sun, terrain tint) */
    var sid = sector.id || '';
    if (sid !== envId){ envId = sid; applyEnvironment(sector.env); }
    var cols = Math.max(8, Math.round(num(sector.cols, num((NB.CONFIG || {}).COLS, 64))));
    var rows = Math.max(8, Math.round(num(sector.rows, num((NB.CONFIG || {}).ROWS, 40))));
    var cell = num(sector.cell, num((NB.CONFIG || {}).CELL, 2));
    var sig = cols + 'x' + rows + 'x' + cell + '|' + JSON.stringify(sector.blocked || []) +
              '|' + JSON.stringify(sector.gates || []);
    COLS = cols; ROWS = rows; CELL = cell;
    W = COLS * CELL; H = ROWS * CELL;
    if (sig !== sectorSig){
      sectorSig = sig;
      texUplinkR = uplinkR;
      paintGround(sector.blocked, sector.gates, sector.env);
      /* rubble on blocked cells */
      var br = sector.blocked || [];
      var rng = mulberry(31337);
      var n = 0;
      for (var b = 0; b < br.length && n < 700; b++){
        var r = normRect(br[b]);
        for (var ix = 0; ix < r.w && n < 700; ix++){
          for (var iz = 0; iz < r.h && n < 700; iz++){
            if (rng() < 0.25) continue;
            var wx = (r.x + ix + 0.5) * CELL, wz = (r.z + iz + 0.5) * CELL;
            _e1.set((rng() - 0.5) * 0.6, rng() * 3.1, (rng() - 0.5) * 0.6);
            _q1.setFromEuler(_e1);
            var s = 0.5 + rng() * 1.3;
            _v1.set(wx + (rng() - 0.5) * 0.8, s * 0.5, wz + (rng() - 0.5) * 0.8);
            _s1.set(s * 1.25, s * (1.5 + rng() * 1.8), s * 1.25); /* raised rock mesas */
            _m1.compose(_v1, _q1, _s1);
            rubbleMesh.setMatrixAt(n, _m1);
            n++;
          }
        }
      }
      rubbleMesh.count = n;
      rubbleMesh.instanceMatrix.needsUpdate = true;
      /* gate crack lines in 3D */
      var gs = sector.gates || [];
      var verts = [];
      for (var gi = 0; gi < gs.length; gi++){
        var gx0 = (num(gs[gi].x, 0) + 0.5) * CELL, gz0 = (num(gs[gi].z, 0) + 0.5) * CELL;
        for (var cn2 = 0; cn2 < 6; cn2++){
          var a2 = gi * 1.7 + cn2 * 1.047;
          var L = (3 + ((gi + cn2) % 4)) * CELL;
          var segs = 4, px2 = gx0, pz2 = gz0;
          for (var s2 = 1; s2 <= segs; s2++){
            var t2 = s2 / segs;
            var nx2 = gx0 + Math.cos(a2 + Math.sin(cn2 * 9 + s2 * 3) * 0.35) * L * t2;
            var nz2 = gz0 + Math.sin(a2 + Math.sin(cn2 * 9 + s2 * 3) * 0.35) * L * t2;
            verts.push(px2, 0.25, pz2, nx2, 0.25, nz2);
            px2 = nx2; pz2 = nz2;
          }
        }
      }
      var cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      crackLines.geometry.dispose();
      crackLines.geometry = cg;
    }
  }

  /* ================= command spire ================= */
  var gunmetal, darkMetal, oliveMat, amberGlow, cyanHolo;

  function sharedMats(){
    if (gunmetal) return;
    gunmetal = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.55, metalness: 0.7 });
    darkMetal = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.6, metalness: 0.6 });
    oliveMat = new THREE.MeshStandardMaterial({ color: 0x5c5a3c, roughness: 0.8, metalness: 0.25 });
    amberGlow = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    cyanHolo = new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }

  function box(w, h, d, mat, x, y, z){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, seg){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function buildSpire(){
    sharedMats();
    spire = new THREE.Group();
    var R = spireRefs;

    /* base structure: real model when loaded, primitives otherwise */
    var spireModel = null;
    try {
      var ML = (globalThis.NB && NB.ModelLib) || null;
      spireModel = ML ? ML.structureModel('spire') : null;
    } catch (e){ spireModel = null; }
    if (spireModel && spireModel.group){
      spire.add(spireModel.group);
    } else {
    /* armored plinth + plated column */
    spire.add(box(7.5, 1.2, 7.5, darkMetal, 0, 0.6, 0));
    spire.add(box(6.2, 1.0, 6.2, gunmetal, 0, 1.6, 0));
    var col = cyl(1.9, 2.5, 9, gunmetal, 0, 6.5, 0, 8);
    spire.add(col);
    for (var i = 0; i < 4; i++){
      var a = i * Math.PI / 2 + Math.PI / 4;
      var plate = box(0.5, 7.5, 1.6, darkMetal, Math.cos(a) * 2.35, 6.2, Math.sin(a) * 2.35);
      plate.rotation.y = -a;
      spire.add(plate);
    }
    spire.add(cyl(2.6, 2.2, 0.8, darkMetal, 0, 11.2, 0, 8));

    /* warm-lit command deck with amber windows */
    var deck = cyl(3.1, 2.6, 1.6, gunmetal, 0, 12.4, 0, 8);
    spire.add(deck);
    R.windows = [];
    for (var wI = 0; wI < 8; wI++){
      var wa = wI * Math.PI / 4;
      var win = box(0.9, 0.5, 0.15, amberGlow, Math.cos(wa) * 2.95, 12.4, Math.sin(wa) * 2.95);
      win.rotation.y = -wa + Math.PI / 2;
      spire.add(win);
      R.windows.push(win);
    }
    spire.add(cyl(0.5, 1.2, 2.2, darkMetal, 0, 14.2, 0, 6));

    /* antenna masts with blinking red tips */
    R.tips = [];
    var mastPos = [[1.6, 0], [-1.6, 0], [0, 1.6]];
    for (var mI = 0; mI < 3; mI++){
      var mh = 4 + mI * 1.5;
      spire.add(cyl(0.09, 0.14, mh, darkMetal, mastPos[mI][0], 13 + mh / 2, mastPos[mI][1], 6));
      var tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      tip.position.set(mastPos[mI][0], 13 + mh + 0.2, mastPos[mI][1]);
      spire.add(tip);
      R.tips.push(tip);
    }
    }
    if (!R.windows) R.windows = [];
    if (!R.tips) R.tips = [];

    /* holographic crown: cyan cone + rings per spire tier */
    R.crown = new THREE.Group();
    R.crown.position.y = 16.4;
    R.cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.2, 24, 1, true), cyanHolo.clone());
    R.cone.position.y = 2.1;
    R.crown.add(R.cone);
    R.tierRings = [];
    for (var tI = 0; tI < 3; tI++){
      var tr = new THREE.Mesh(new THREE.TorusGeometry(2.2 + tI * 0.85, 0.09, 8, 40),
        cyanHolo.clone());
      tr.rotation.x = Math.PI / 2;
      tr.position.y = 0.6 + tI * 1.1;
      tr.visible = false;
      R.crown.add(tr);
      R.tierRings.push(tr);
    }
    spire.add(R.crown);

    /* owner ring at base (multiplayer tint) */
    R.ownerRing = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide }));
    R.ownerRing.rotation.x = -Math.PI / 2;
    R.ownerRing.position.y = 0.15;
    spire.add(R.ownerRing);

    /* fake volumetric light cone over the spire */
    lightCone = new THREE.Mesh(new THREE.ConeGeometry(5.5, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2bd8f5, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    lightCone.position.y = 26;
    spire.add(lightCone);

    spireLight.position.set(0, 13, 0);
    scene.add(spire);
  }

  function updateSpire(snap, dt, surgeI){
    if (!spire) return;
    var R = spireRefs;
    spire.position.set(hqPos.x, groundY(hqPos.x, hqPos.z), hqPos.z);
    spireLight.position.set(hqPos.x, 13, hqPos.z);

    var oc = (snap && snap.overclock) || {};
    var ocActive = !!oc.active;
    var strain = clamp(num(oc.strain, 0), 0, 100);
    /* pulse the hologram crown on overclock */
    var pulse = ocActive ? (1 + 0.10 * Math.sin(time * 11) + strain / 500) : 1;
    R.crown.scale.set(pulse, 1 + (ocActive ? 0.06 * Math.sin(time * 11) : 0), pulse);
    R.cone.material.opacity = (ocActive ? 0.55 : 0.34) + 0.06 * Math.sin(time * 2.2);
    R.cone.rotation.y = time * (ocActive ? 1.6 : 0.5);
    for (var i = 0; i < R.tierRings.length; i++){
      var tr = R.tierRings[i];
      tr.rotation.z = time * (0.4 + i * 0.25) * (i % 2 ? -1 : 1);
      tr.material.opacity = 0.5 + 0.15 * Math.sin(time * 3 + i);
    }
    /* antenna tip blink, faster during surge */
    for (var tI = 0; tI < R.tips.length; tI++){
      var sp = surgeI > 0.02 ? 10 : 3.2;
      R.tips[tI].visible = Math.sin(time * sp + tI * 2.1) > -0.2;
    }
    /* morale shifts the heart-light: despair dims and reddens */
    var morale = num(snap && snap.morale, 70);
    var warm = clamp((morale - 10) / 90, 0, 1);
    spireLight.intensity = (ocActive ? 2.6 : 1.6) * (0.55 + 0.45 * warm) * (1 - surgeI * 0.35);
    spireLight.color.setHex(0xffb347).lerp(_c2.setHex(0xff3a1a), (1 - warm) * 0.55);
    lightCone.material.opacity = 0.05 * (1 - surgeI * 0.6) + (ocActive ? 0.03 : 0);
    lightCone.rotation.y = time * 0.12;
  }

  function setSpireTier(tier, ownerColor){
    var R = spireRefs;
    if (!R.tierRings) return;
    tier = clamp(Math.round(num(tier, 0)), 0, 2);
    for (var i = 0; i < R.tierRings.length; i++){
      R.tierRings[i].visible = i <= tier; /* 1 ring at tier 0, up to 3 */
    }
    var s = 1 + tier * 0.16;
    R.crown.scale.set(s, 1, s);
    if (ownerColor) R.ownerRing.material.color.set(ownerColor);
  }

  /* ================= IRA: holographic AI avatar ================= */
  function buildIraFigure(scale){
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: 0x54e8ff, transparent: true,
      opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    var robe = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.1, 10, 1, true), mat);
    robe.position.y = 1.05;
    g.add(robe);
    var torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat);
    torso.position.y = 2.15; torso.scale.set(1, 1.25, 0.8);
    g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat);
    head.position.y = 2.95;
    g.add(head);
    /* hair-like arc */
    var halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 20), mat);
    halo.position.y = 2.95; halo.rotation.x = Math.PI / 2.4;
    g.add(halo);
    g.scale.setScalar(scale);
    g.userData.mat = mat;
    g.userData.halo = halo;
    return g;
  }

  function buildIRA(){
    /* small holo-projector figure on the spire, always during gameplay */
    iraSmall = buildIraFigure(0.55);
    iraSmall.position.y = 15.6;
    spire.add(iraSmall);
    /* large briefing figure, appears when she speaks */
    iraBig = buildIraFigure(2.1);
    iraBig.visible = false;
    scene.add(iraBig);
    /* shimmer particles around the big figure */
    var n = 26;
    var posArr = new Float32Array(n * 3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    iraShimmer = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7df3ff,
      size: 0.35, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
      depthWrite: false }));
    iraShimmer.visible = false;
    iraShimmer.frustumCulled = false;
    scene.add(iraShimmer);
  }

  function updateIRA(view, dt){
    var speaking = !!(view && view.iraSpeaking);
    /* small projector figure: gentle bob always */
    iraSmall.position.y = 15.6 + Math.sin(time * 1.4) * 0.18;
    iraSmall.rotation.y = time * 0.6;
    iraSmall.userData.mat.opacity = speaking ? 0.75 : 0.45;
    /* big briefing figure rises beside the spire when she speaks or showIra('large') */
    var bigShow = speaking || iraMode === 'large';
    iraBig.visible = bigShow;
    iraShimmer.visible = bigShow;
    iraSmall.visible = iraMode !== 'hidden';
    if (bigShow){
      var pulse = 1 + 0.07 * Math.sin(time * 9);
      iraBig.scale.setScalar(2.1 * pulse);
      var bgy = groundY(hqPos.x + 7.5, hqPos.z - 2);
      iraBig.position.set(hqPos.x + 7.5, bgy + Math.sin(time * 1.4) * 0.3, hqPos.z - 2);
      iraBig.rotation.y = Math.sin(time * 0.5) * 0.4;
      iraBig.userData.mat.opacity = 0.55 + 0.25 * Math.sin(time * 9);
      iraBig.userData.halo.rotation.z = time * 1.2;
      var pos = iraShimmer.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++){
        var a = time * 0.9 + i * 2.4;
        var rr2 = 2.2 + Math.sin(time * 2 + i) * 0.5;
        pos.setXYZ(i,
          iraBig.position.x + Math.cos(a) * rr2,
          1 + ((time * 1.5 + i * 0.7) % 6),
          iraBig.position.z + Math.sin(a) * rr2);
      }
      pos.needsUpdate = true;
    }
  }

  /* ================= uplink fx: hex grid + tactical ring ================= */
  function buildUplinkFx(){
    uplinkGroup = new THREE.Group();
    scene.add(uplinkGroup);
    for (var i = 0; i < 8; i++){
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 6, 1),
        new THREE.MeshBasicMaterial({ color: 0x2bd8f5, transparent: true, opacity: 0.4,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.22;
      ring.visible = false;
      uplinkGroup.add(ring);
      hexRings.push({ mesh: ring, phase: i / 8 });
    }
    edgeRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.015, 72),
      new THREE.MeshBasicMaterial({ color: 0x37e6ff, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    edgeRing.rotation.x = -Math.PI / 2;
    edgeRing.position.y = 0.2;
    scene.add(edgeRing);
    /* soft radial glow under the spire */
    var gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    var gx = gc.getContext('2d');
    var grd = gx.createRadialGradient(64, 64, 2, 64, 64, 64);
    grd.addColorStop(0, 'rgba(80,220,255,0.55)');
    grd.addColorStop(0.6, 'rgba(60,180,230,0.18)');
    grd.addColorStop(1, 'rgba(40,140,200,0)');
    gx.fillStyle = grd; gx.fillRect(0, 0, 128, 128);
    var gtex = new THREE.CanvasTexture(gc);
    edgeGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: gtex, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    edgeGlow.rotation.x = -Math.PI / 2;
    edgeGlow.position.y = 0.12;
    scene.add(edgeGlow);
  }

  function updateUplinkFx(view, dt){
    var show = !!(view && view.showHeat);
    edgeRing.visible = show;
    edgeGlow.visible = show;
    for (var i = 0; i < hexRings.length; i++) hexRings[i].mesh.visible = show;
    if (!show) return;
    var R = uplinkR * CELL;
    var ugy = groundY(hqPos.x, hqPos.z);
    edgeRing.position.set(hqPos.x, ugy + 0.22, hqPos.z);
    edgeRing.scale.set(R, R, 1);
    edgeRing.material.opacity = 0.4 + 0.22 * Math.sin(time * 2.6);
    edgeGlow.position.set(hqPos.x, ugy + 0.14, hqPos.z);
    var gs = R * 2.6;
    edgeGlow.scale.set(gs, gs, 1);
    for (var k = 0; k < hexRings.length; k++){
      var hr = hexRings[k];
      var f = frac(time / 3.2 + hr.phase);
      var rr3 = Math.max(0.01, f * R);
      hr.mesh.position.set(hqPos.x, ugy + 0.24, hqPos.z);
      hr.mesh.scale.set(rr3, rr3, 1);
      hr.mesh.material.opacity = (1 - f) * 0.5;
      hr.mesh.rotation.z = time * 0.15 + hr.phase * 2;
    }
  }

  /* ================= towers ================= */
  function accentMat(hex, intensity){
    return new THREE.MeshStandardMaterial({ color: 0x11131a, emissive: new THREE.Color(hex),
      emissiveIntensity: num(intensity, 1.6), roughness: 0.4, metalness: 0.3 });
  }
  function crewFigure(){
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 3, 8), oliveMat);
    body.position.y = 0.55;
    g.add(body);
    var helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), darkMetal);
    helm.position.y = 1.12;
    g.add(helm);
    var visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.05), amberGlow);
    visor.position.set(0, 1.12, 0.14);
    g.add(visor);
    g.userData.body = body;
    return g;
  }

  var TOWER_BUILDERS = {
    pulse: function(A){
      var g = new THREE.Group(), P = {};
      g.add(box(2.3, 0.5, 2.3, new THREE.MeshStandardMaterial({ color: 0x6b6250, roughness: 0.9 }), 0, 0.25, 0));
      g.add(cyl(0.75, 1.0, 0.75, gunmetal, 0, 0.85, 0, 8));
      P.barrels = [];
      for (var i = -1; i <= 1; i += 2){
        var b = cyl(0.09, 0.11, 1.7, darkMetal, i * 0.22, 1.55, 0.5, 8);
        b.rotation.x = Math.PI / 2 - 0.18;
        b.userData.bz = 0.5;
        g.add(b); P.barrels.push(b);
      }
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), A);
      lamp.position.set(0, 1.35, -0.55); g.add(lamp);
      P.muzzle = new THREE.Object3D(); P.muzzle.position.set(0, 1.75, 1.35); g.add(P.muzzle);
      var crew = crewFigure(); crew.position.set(0.95, 0.5, -0.5); crew.rotation.y = -0.6;
      g.add(crew); P.crew = crew;
      return { group: g, parts: P };
    },
    frost: function(A){
      var g = new THREE.Group(), P = {};
      g.add(box(1.7, 0.8, 1.7, gunmetal, 0, 0.4, 0));
      var dish = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.7), darkMetal);
      dish.position.y = 1.5; dish.rotation.x = Math.PI + 0.5; dish.scale.set(1, 0.75, 1);
      g.add(dish);
      var glow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 14), A);
      glow.position.set(0, 1.78, 0.28); glow.rotation.x = -Math.PI / 2 + 0.5;
      g.add(glow);
      for (var i = -1; i <= 1; i += 2){
        var tank = cyl(0.26, 0.26, 1.15, A, i * 0.85, 0.95, -0.5, 8);
        g.add(tank);
        g.add(cyl(0.3, 0.3, 0.12, darkMetal, i * 0.85, 1.55, -0.5, 8));
      }
      P.mistY = 1.9;
      return { group: g, parts: P };
    },
    arc: function(A){
      var g = new THREE.Group(), P = {};
      g.add(cyl(0.7, 0.95, 0.55, gunmetal, 0, 0.28, 0, 8));
      g.add(cyl(0.16, 0.24, 2.7, darkMetal, 0, 1.85, 0, 8));
      P.rings = [];
      for (var i = 0; i < 3; i++){
        var rg = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 14), A);
        rg.rotation.x = Math.PI / 2; rg.position.y = 1.2 + i * 0.7;
        g.add(rg); P.rings.push(rg);
      }
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), A);
      orb.position.y = 3.45; g.add(orb); P.orb = orb;
      P.muzzle = new THREE.Object3D(); P.muzzle.position.set(0, 3.45, 0); g.add(P.muzzle);
      var crew = crewFigure(); crew.position.set(0.9, 0, -0.6); crew.rotation.y = -2.6;
      g.add(crew); P.crew = crew;
      return { group: g, parts: P };
    },
    mortar: function(A){
      var g = new THREE.Group(), P = {};
      for (var i = 0; i < 4; i++){
        var a = i * Math.PI / 2;
        var wall = box(2.4, 0.8, 0.35, oliveMat, Math.cos(a) * 1.05, 0.4, Math.sin(a) * 1.05);
        wall.rotation.y = -a + Math.PI / 2;
        g.add(wall);
      }
      g.add(cyl(0.9, 1.0, 0.35, darkMetal, 0, 0.18, 0, 8));
      P.barrels = [];
      for (var k = -1; k <= 1; k += 2){
        var tube = cyl(0.26, 0.32, 1.6, gunmetal, k * 0.4, 1.15, -0.1, 10);
        tube.rotation.x = -0.85;
        tube.userData.bz = -0.1; tube.userData.by = 1.15;
        g.add(tube); P.barrels.push(tube);
      }
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 12), A);
      band.position.set(0, 1.75, 0.62); band.rotation.x = -0.85 + Math.PI / 2;
      g.add(band);
      P.muzzle = new THREE.Object3D(); P.muzzle.position.set(0, 1.9, 0.75); g.add(P.muzzle);
      var crew = crewFigure(); crew.position.set(-1.15, 0, 0.75); crew.rotation.y = 1.2;
      g.add(crew); P.crew = crew;
      return { group: g, parts: P };
    },
    sniper: function(A){
      var g = new THREE.Group(), P = {};
      g.add(box(1.1, 0.5, 1.1, darkMetal, 0, 0.25, 0));
      g.add(box(0.85, 4.0, 0.85, oliveMat, 0, 2.4, 0));
      g.add(box(1.25, 0.7, 1.25, gunmetal, 0, 4.6, 0));
      var barrel = cyl(0.06, 0.09, 2.8, darkMetal, 0, 4.75, 1.4, 8);
      barrel.rotation.x = Math.PI / 2 - 0.06;
      barrel.userData.bz = 1.4;
      g.add(barrel); P.barrels = [barrel];
      var scope = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), A);
      scope.position.set(0, 5.0, -0.2); g.add(scope);
      P.muzzle = new THREE.Object3D(); P.muzzle.position.set(0, 4.85, 2.85); g.add(P.muzzle);
      var crew = crewFigure(); crew.position.set(0.75, 0, -0.75); crew.rotation.y = -2.2;
      g.add(crew); P.crew = crew;
      return { group: g, parts: P };
    },
    chrono: function(A){
      var g = new THREE.Group(), P = {};
      g.add(box(1.0, 0.5, 1.0, darkMetal, 0, 0.25, 0));
      g.add(box(0.7, 2.1, 0.7, gunmetal, 0, 1.5, 0));
      var holo = new THREE.MeshBasicMaterial({ color: new THREE.Color(A.emissive.getHex()),
        transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 28), holo);
      ring.rotation.x = Math.PI / 2; ring.position.y = 3.0;
      g.add(ring);
      P.ring = ring; P.ringMat = holo; P.ringY = 3.0;
      var tipm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), A);
      tipm.position.y = 2.7; g.add(tipm);
      return { group: g, parts: P };
    },
    mint: function(A){
      var g = new THREE.Group(), P = {};
      g.add(box(1.9, 1.5, 1.9, new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.6 }), 0, 0.75, 0));
      g.add(box(2.1, 0.25, 2.1, darkMetal, 0, 1.6, 0));
      P.posts = [];
      for (var i = -1; i <= 1; i += 2){
        var post = box(0.16, 1.1, 0.16, gunmetal, i * 0.8, 2.2, 0);
        g.add(post); P.posts.push(post);
      }
      var beam = box(1.76, 0.16, 0.3, gunmetal, 0, 2.7, 0);
      g.add(beam); P.gantry = beam;
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), A);
      lamp.position.set(0.7, 1.85, 0.7); g.add(lamp);
      var lamp2 = lamp.clone(); lamp2.position.set(-0.7, 1.85, -0.7); g.add(lamp2);
      return { group: g, parts: P };
    },
    amplify: function(A){
      var g = new THREE.Group(), P = {};
      g.add(cyl(0.6, 0.85, 0.5, gunmetal, 0, 0.25, 0, 8));
      g.add(cyl(0.13, 0.2, 2.9, darkMetal, 0, 1.9, 0, 8));
      var dish = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.55, 14, 1, true), gunmetal);
      dish.position.set(0, 3.35, 0.25); dish.rotation.x = -Math.PI / 2.6;
      dish.material = dish.material;
      g.add(dish);
      var feed = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), A);
      feed.position.set(0, 3.35, 0.75); g.add(feed);
      P.dish = dish; P.feed = feed;
      return { group: g, parts: P };
    }
  };

  function structWorld(t){
    var x = num(t.x, null), z = num(t.z, null);
    if (x == null && t.cx != null) x = (num(t.cx, 0) + 0.5) * CELL;
    if (z == null && t.cz != null) z = (num(t.cz, 0) + 0.5) * CELL;
    return { x: num(x, W / 2), z: num(z, H / 2) };
  }

  function playerColor(snap, ownerId){
    var ps = (snap && snap.players) || [];
    for (var i = 0; i < ps.length; i++){
      if (ps[i] && ps[i].id === ownerId) return ps[i].color || '#9fb4cc';
    }
    return '#9fb4cc';
  }

  function makeHitMesh(kind, instId, radius, height){
    var m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 6),
      new THREE.MeshBasicMaterial());
    m.visible = false;
    m.userData.kind = kind;
    m.userData.instId = instId;
    scene.add(m);
    return m;
  }

  function addOwnerRing(group, color){
    var ring = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.34, 28),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true,
        opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
    return ring;
  }

  function addVeteranTrim(group, veteran){
    var trim = new THREE.Group();
    if (veteran >= 1){
      var gold = new THREE.MeshStandardMaterial({ color: 0x8a6a1f, emissive: 0xffb347,
        emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.8 });
      var band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.07, 6, 22), gold);
      band.rotation.x = Math.PI / 2; band.position.y = 0.42;
      trim.add(band);
      var ch1 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), gold);
      ch1.position.y = 3.3; ch1.rotation.y = Math.PI / 4;
      trim.add(ch1);
    }
    if (veteran >= 2){
      var gold2 = trim.children[0].material;
      var ch2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), gold2);
      ch2.position.y = 3.85; ch2.rotation.y = Math.PI / 4;
      trim.add(ch2);
    }
    group.add(trim);
    return trim;
  }

  function addStandby(group){
    var s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    s.position.set(0.75, 2.2, 0.75);
    s.visible = false;
    group.add(s);
    return s;
  }

  function addScaffold(group){
    var s = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.8, 2.1),
      new THREE.MeshBasicMaterial({ color: 0x37e6ff, wireframe: true, transparent: true,
        opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.y = 1.4;
    s.visible = false;
    group.add(s);
    return s;
  }

  /* Model-first tower visual: real GLB model when loaded, primitive fallback.
     Returns {group, parts} like TOWER_BUILDERS. */
  function buildTowerVisual(id, A){
    var ML = (globalThis.NB && NB.ModelLib) || null;
    if (ML){
      try {
        var m = ML.towerModel(id);
        if (m && m.group){
          var g = new THREE.Group();
          g.add(m.group);
          /* team-color accent nub so allegiance still reads instantly */
          var nub = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), A);
          nub.position.set(0, (m.height || 3) * 0.62, 0);
          g.add(nub);
          return { group: g, parts: { muzzle: m.muzzle, model: true } };
        }
      } catch (e){}
    }
    return TOWER_BUILDERS[id](A);
  }

  function buildTowerEntry(t, snap){
    var id = TOWER_IDS.indexOf(t.id) >= 0 ? t.id : 'pulse';
    var A = accentMat(towerColor(id));
    var built = buildTowerVisual(id, A);
    var g = built.group;
    var p = structWorld(t);
    g.position.set(p.x, 0, p.z);
    var ownerRing = addOwnerRing(g, playerColor(snap, t.ownerId));
    var trim = addVeteranTrim(g, num(t.veteran, 0));
    var standby = addStandby(g);
    var scaffold = addScaffold(g);
    var hit = makeHitMesh('tower', t.instId, 1.6, 4.5);
    hit.position.set(p.x, 2.2, p.z);
    scene.add(g);
    spawnRing(p.x, p.z, { color: '#c8b89a', maxR: 3.2, life: 0.8 }); /* dust ring on build */
    spawnDebris(p.x, groundY(p.x, p.z) + 0.6, p.z,
      { count: 10, color: '#9a8a6a', speed: 6, up: 4, life: 0.9, size: 0.8 }); /* placement thud */
    return {
      instId: t.instId, id: id, group: g, parts: built.parts, accent: A,
      ownerRing: ownerRing, trim: trim, standby: standby, scaffold: scaffold,
      hit: hit, x: p.x, z: p.z,
      bornAt: time, prevCd: num(t.cooldown, 0), hp: num(t.hp, 1), maxHp: num(t.maxHp, 1),
      recoil: 0, dark: false, powered: true, veteran: num(t.veteran, 0),
      angle: num(t.angle, 0), seed: Math.random() * 10
    };
  }

  function removeTowerEntry(e){
    scene.remove(e.group);
    scene.remove(e.hit);
    e.accent.dispose();
    delete towers[e.instId];
  }

  function applyTowerState(e, t, snap, dt){
    var dark = !!t.dark;
    var powered = t.powered !== false;
    var vet = num(t.veteran, 0);
    if (vet !== e.veteran){
      e.group.remove(e.trim);
      e.trim = addVeteranTrim(e.group, vet);
      e.veteran = vet;
    }
    e.dark = dark; e.powered = powered;
    var ai = dark ? 0.03 : (powered ? 1.6 : 0.08);
    e.accent.emissiveIntensity += (ai - e.accent.emissiveIntensity) * Math.min(1, dt * 8);
    e.standby.visible = dark;
    if (dark) e.standby.material.color.setHex(Math.sin(time * 5 + e.seed) > 0 ? 0xff2a1a : 0x550f0a);
    e.ownerRing.material.color.set(playerColor(snap, t.ownerId));
    /* rotate to face angle */
    var targetA = num(t.angle, e.angle);
    e.angle = targetA;
    e.group.rotation.y = -targetA;
    /* build animation: rise from ground with hologram scaffolding */
    var age = time - e.bornAt;
    if (age < 1){
      var k = clamp(age / 1, 0, 1);
      e.group.position.y = groundY(e.x, e.z) - 2.4 * (1 - k * k);
      e.scaffold.visible = true;
      e.scaffold.material.opacity = 0.55 * (1 - k);
    } else {
      e.group.position.y = groundY(e.x, e.z);
      e.scaffold.visible = false;
    }
    /* model recoil: whole-model kick opposite the facing direction */
    var P0 = e.parts;
    if (P0 && P0.model && e.recoil > 0.001){
      var rk = e.recoil * 0.5;
      e.group.position.x = e.x + Math.sin(e.angle) * rk;
      e.group.position.z = e.z - Math.cos(e.angle) * rk;
    } else if (P0 && P0.model){
      e.group.position.x = e.x;
      e.group.position.z = e.z;
    }
    /* muzzle flash detection: cooldown jumping up means a shot was fired */
    var cd = num(t.cooldown, 0);
    if (e.prevCd < 0.05 && cd > e.prevCd + 0.05 && e.parts.muzzle){
      e.recoil = 1;
      fireMuzzle(e);
    }
    e.prevCd = cd;
    e.recoil = Math.max(0, e.recoil - dt * 5);
    var P = e.parts;
    if (P.barrels){
      for (var i = 0; i < P.barrels.length; i++){
        var b = P.barrels[i];
        var back = e.recoil * 0.45;
        if (b.userData.bz != null) b.position.z = b.userData.bz - back;
        else { b.position.z = -back; }
        if (b.userData.by != null && b.rotation.x < -0.5){
          b.position.y = b.userData.by - back * 0.7;
        }
      }
    }
    /* idle animation */
    if (P.crew) P.crew.userData.body.position.y = 0.55 + Math.sin(time * 2 + e.seed) * 0.03;
    if (P.rings) for (var rI = 0; rI < P.rings.length; rI++) P.rings[rI].rotation.z = time * (1 + rI * 0.4);
    if (P.orb){ var os = 1 + 0.12 * Math.sin(time * 7 + e.seed); P.orb.scale.set(os, os, os); }
    if (P.ring){
      P.ring.rotation.z = time * 1.4;
      P.ring.position.y = P.ringY + Math.sin(time * 1.8 + e.seed) * 0.18;
      P.ringMat.opacity = e.dark ? 0.1 : 0.6 + 0.2 * Math.sin(time * 3);
    }
    if (P.gantry) P.gantry.position.x = Math.sin(time * 0.9 + e.seed) * 0.55;
    if (P.dish) P.dish.rotation.z = Math.sin(time * 0.7 + e.seed) * 0.25;
    /* damage sparks on hp loss */
    var hp = num(t.hp, e.hp);
    if (hp < e.hp - 0.5){
      spawnBurst(e.x, 1.6, e.z, { count: 8, color: 0xffa050, speed: 7, life: 0.5, size: 2.6, up: 4 });
      spawnPuff(e.x, 2.2, e.z, { count: 3, life: 1.1, size: 5 });
    }
    e.hp = hp; e.maxHp = num(t.maxHp, e.maxHp);
    /* hit proxy follows (stays invisible; raycast still hits it) */
    e.hit.position.set(e.x, 2.2, e.z);
  }

  function updateTowers(snap, dt){
    var list = arr(snap && snap.towers);
    var seen = {}, i, t, e;
    for (i = 0; i < list.length; i++){
      t = list[i];
      if (t == null || t.instId == null) continue;
      seen[t.instId] = 1;
      e = towers[t.instId];
      if (!e){
        e = buildTowerEntry(t, snap);
        towers[t.instId] = e;
      } else {
        var p = structWorld(t);
        e.x = p.x; e.z = p.z;
        e.group.position.x = p.x; e.group.position.z = p.z;
      }
      applyTowerState(e, t, snap, dt);
    }
    for (var k in towers){
      if (!seen[k]) removeTowerEntry(towers[k]);
    }
    /* aura towers breathe: cryo mist + stasis rings */
    auraT -= dt; mistT -= dt;
    if (auraT <= 0){
      auraT = 1.3;
      for (var k2 in towers){
        var e2 = towers[k2];
        if (e2.id === 'chrono' && !e2.dark){
          spawnRing(e2.x, e2.z, { color: 0xc084fc, maxR: 7, life: 1.3, width: 0.5 });
        }
      }
    }
    if (mistT <= 0){
      mistT = 0.7;
      for (var k3 in towers){
        var e3 = towers[k3];
        if (e3.id === 'frost' && !e3.dark && e3.parts.mistY){
          spawnPuff(e3.x + (Math.random() - 0.5), e3.parts.mistY, e3.z + (Math.random() - 0.5),
            { count: 2, color: 0xbfe9ff, life: 0.9, size: 4, vel: 1.2 });
        }
      }
    }
  }

  /* ================= walls ================= */
  var wallHasModel = false;
  function buildWalls(){
    var ML = (globalThis.NB && NB.ModelLib) || null;
    var geo = null;
    try { geo = ML ? ML.geometryFor('struct_wall') : null; } catch (e){ geo = null; }
    wallHasModel = !!geo;
    if (!geo) geo = new THREE.BoxGeometry(1.9, 1.7, 1.9);
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.45,
      vertexColors: wallHasModel });
    wallMesh = new THREE.InstancedMesh(geo, mat, 1600);
    wallMesh.frustumCulled = false;
    wallMesh.count = 0;
    scene.add(wallMesh);
  }

  var wallPrev = {}; /* id -> {x,z} for crumble detection */

  function updateWalls(snap, dt){
    var list = arr(snap && snap.walls);
    var n = Math.min(list.length, 1600);
    var seen = {};
    for (var i = 0; i < n; i++){
      var w = list[i];
      if (!w) continue;
      var id = w.id != null ? w.id : ('w' + i);
      seen[id] = 1;
      var p = structWorld(w);
      var frac = clamp(num(w.hp, 1) / Math.max(1, num(w.maxHp, 1)), 0, 1);
      _v1.set(p.x, groundY(p.x, p.z) + (wallHasModel ? 0 : 0.85), p.z);
      _q1.identity();
      _s1.set(1, 1, 1);
      _m1.compose(_v1, _q1, _s1);
      wallMesh.setMatrixAt(i, _m1);
      /* healthy steel-blue-gray -> damaged orange/red */
      _c1.setHex(0x6b7a8c).lerp(_c2.setHex(0xff5a2a), 1 - frac);
      wallMesh.setColorAt(i, _c1);
      wallIds[i] = id;
      wallPrev[id] = { x: p.x, z: p.z };
    }
    wallMesh.count = n;
    wallMesh.instanceMatrix.needsUpdate = true;
    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;
    /* crumble: walls that vanished break into chunks */
    for (var k in wallPrev){
      if (!seen[k]){
        var wp = wallPrev[k];
        spawnDebris(wp.x, 1, wp.z, { count: 3, color: 0x6b7a8c, speed: 5, life: 1.0, size: 0.8 });
        spawnBurst(wp.x, 1, wp.z, { count: 6, color: 0x9aa8b8, speed: 5, life: 0.5, size: 2.2, up: 3 });
        delete wallPrev[k];
      }
    }
  }

  /* ================= reactors ================= */
  function buildReactorEntry(t, snap){
    var g = new THREE.Group();
    var p = structWorld(t);
    var coreMat = new THREE.MeshStandardMaterial({ color: 0x062a33,
      emissive: 0x22d3ee, emissiveIntensity: 1.8, roughness: 0.3 });
    /* real model when loaded, primitives otherwise */
    var rmodel = null;
    try {
      var ML = (globalThis.NB && NB.ModelLib) || null;
      rmodel = ML ? ML.structureModel('reactor') : null;
    } catch (e){ rmodel = null; }
    if (rmodel && rmodel.group){
      g.add(rmodel.group);
      var nub = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), coreMat);
      nub.position.y = 2.6;
      g.add(nub);
    } else {
      g.add(cyl(0.85, 1.05, 0.6, gunmetal, 0, 0.3, 0, 8));
      var core = cyl(0.5, 0.5, 1.0, coreMat, 0, 1.1, 0, 10);
      g.add(core);
      g.add(cyl(0.62, 0.62, 0.14, darkMetal, 0, 1.65, 0, 10));
    }
    var ownerRing = addOwnerRing(g, playerColor(snap, t.ownerId));
    var standby = addStandby(g);
    var hit = makeHitMesh('reactor', t.instId, 1.4, 3.2);
    hit.position.set(p.x, 1.6, p.z);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    return { instId: t.instId, group: g, coreMat: coreMat, ownerRing: ownerRing,
             standby: standby, hit: hit, x: p.x, z: p.z, dark: false,
             bornAt: time, seed: Math.random() * 10 };
  }

  function updateReactors(snap, dt){
    var list = arr(snap && snap.reactors);
    var seen = {};
    for (var i = 0; i < list.length; i++){
      var t = list[i];
      if (!t || t.instId == null) continue;
      seen[t.instId] = 1;
      var e = reactors[t.instId];
      if (!e){ e = buildReactorEntry(t, snap); reactors[t.instId] = e; }
      else {
        var p = structWorld(t);
        e.x = p.x; e.z = p.z;
        e.group.position.x = p.x; e.group.position.z = p.z;
      }
      var dark = !!t.dark;
      e.dark = dark;
      var ai = dark ? 0.04 : 1.8 + 0.35 * Math.sin(time * 4 + e.seed);
      e.coreMat.emissiveIntensity += (ai - e.coreMat.emissiveIntensity) * Math.min(1, dt * 8);
      e.standby.visible = dark;
      if (dark) e.standby.material.color.setHex(Math.sin(time * 5 + e.seed) > 0 ? 0xff2a1a : 0x550f0a);
      e.ownerRing.material.color.set(playerColor(snap, t.ownerId));
      var age = time - e.bornAt;
      e.group.position.y = groundY(e.x, e.z) + (age < 0.8 ? -1.6 * (1 - age / 0.8) : 0);
      e.hit.position.set(e.x, 1.6, e.z);
    }
    for (var k in reactors){
      if (!seen[k]){
        scene.remove(reactors[k].group);
        scene.remove(reactors[k].hit);
        reactors[k].coreMat.dispose();
        delete reactors[k];
      }
    }
  }

  /* ================= enemies ================= */
  function enemyBodyGeo(type){
    var g;
    switch (type){
      case 'drone': g = new THREE.OctahedronGeometry(1); g.scale(1, 0.55, 1.35); break;
      case 'runner': g = new THREE.OctahedronGeometry(0.8); g.scale(0.8, 0.5, 1.6); break;
      case 'swarmling': g = new THREE.TetrahedronGeometry(0.7); break;
      case 'tank': g = new THREE.BoxGeometry(1.7, 1.3, 2.3); break;
      case 'shieldbearer': g = new THREE.OctahedronGeometry(1.05); g.scale(1, 0.8, 1); break;
      case 'phantom': g = new THREE.TetrahedronGeometry(1.0); break;
      case 'medic': g = new THREE.BoxGeometry(1.05, 0.75, 1.05); break;
      case 'splitter': g = new THREE.OctahedronGeometry(1.25); break;
      case 'mite': g = new THREE.TetrahedronGeometry(0.5); break;
      case 'sapper': g = new THREE.ConeGeometry(0.8, 1.7, 6); g.rotateX(Math.PI / 2); break;
      case 'brute': g = new THREE.BoxGeometry(1.9, 1.7, 1.9); break;
      default: g = new THREE.OctahedronGeometry(1); break;
    }
    return g;
  }

  function buildEnemies(){
    var bodyCap = 500;
    var ML = (globalThis.NB && NB.ModelLib) || null;
    for (var i = 0; i < ENEMY_TYPES.length; i++){
      var type = ENEMY_TYPES[i];
      if (BOSS_SET[type]) continue;
      var transparent = (type === 'phantom');
      var mgeo = null;
      try { mgeo = ML ? ML.enemyGeometry(type) : null; } catch (e){ mgeo = null; }
      var hasModel = !!mgeo;
      var mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.5,
        transparent: transparent, opacity: transparent ? 0.55 : 1,
        vertexColors: hasModel });
      /* PBR: armored-machine response + roughness variation (one material
         serves the whole merged body, so a mid response, not per-part) */
      try { if (NB.PBR) NB.PBR.tuneEnemyMaterial(mat); } catch (e){}
      var mesh = new THREE.InstancedMesh(mgeo || enemyBodyGeo(type), mat, bodyCap);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      var tint = new THREE.Color(0x888888);
      try { tint.set(enemyDef(type).color || '#888888'); } catch (er) {}
      enemyPools[type] = { mesh: mesh, cap: bodyCap, transparent: transparent, tint: tint, hasModel: hasModel };
    }
    /* shared eye-glows: hot red-orange */
    var eyeGeo = new THREE.BoxGeometry(0.17, 0.11, 0.07);
    eyeMesh = new THREE.InstancedMesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xff5a1a }), 1500);
    eyeMesh.frustumCulled = false; eyeMesh.count = 0;
    scene.add(eyeMesh);
    /* skitter legs */
    var legGeo = new THREE.BoxGeometry(0.13, 0.95, 0.13);
    legGeo.translate(0, -0.475, 0);
    legMesh = new THREE.InstancedMesh(legGeo,
      new THREE.MeshStandardMaterial({ color: 0x2a201b, roughness: 0.7, metalness: 0.5 }), 3000);
    legMesh.frustumCulled = false; legMesh.count = 0;
    scene.add(legMesh);
    /* hex shield shimmer for shield-bots */
    shieldMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1.35, 1.35, 1.9, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x54d8ff, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 300);
    shieldMesh.frustumCulled = false; shieldMesh.count = 0;
    scene.add(shieldMesh);
  }

  function enemySlowed(e, tnow){
    if (e.slowed === true) return true;
    return e.slowUntil != null && tnow != null && e.slowUntil > tnow;
  }
  function enemyFrozen(e, tnow){
    if (e.frozen === true || e.dark === true) return true;
    return e.frozenUntil != null && tnow != null && e.frozenUntil > tnow;
  }

  var buckets = {};
  (function(){
    for (var i = 0; i < ENEMY_TYPES.length; i++) buckets[ENEMY_TYPES[i]] = new Int32Array(600);
  })();
  var bucketCount = {};
  var bossSpawnQueue = [];
  var headingCount = 0;

  function updateEnemies(snap, dt){
    var list = arr(snap && snap.enemies);
    var tnow = (snap && snap.time != null) ? snap.time : time;
    for (var i = 0; i < ENEMY_TYPES.length; i++) bucketCount[ENEMY_TYPES[i]] = 0;
    var nList = Math.min(list.length, 600);
    var seenBoss = {};
    for (var bi = 0; bi < nList; bi++){
      var e = list[bi];
      if (!e) continue;
      var type = BOSS_SET[e.type] ? e.type : (enemyPools[e.type] ? e.type : 'drone');
      if (BOSS_SET[e.type]){
        seenBoss[e.id] = 1;
        if (!bosses[e.id]) bossSpawnQueue.push(e);
        updateBoss(bosses[e.id], e, dt);
      } else {
        var bc = bucketCount[type];
        if (bc < 600){ buckets[type][bc] = bi; bucketCount[type] = bc + 1; }
      }
    }
    /* spawn queued bosses (intro cinematic hook via announce event from sim) */
    for (var q = 0; q < bossSpawnQueue.length; q++){
      var be = bossSpawnQueue[q];
      if (!bosses[be.id]) bosses[be.id] = buildBoss(be.type, be);
    }
    bossSpawnQueue.length = 0;
    for (var bk in bosses){
      if (!seenBoss[bk]){
        scene.remove(bosses[bk].group);
        delete bosses[bk];
      }
    }
    /* keep the heading cache bounded */
    headingCount += nList;
    if (headingCount > 4000){
      var dropped = 0;
      for (var hk in headings){
        delete headings[hk];
        if (++dropped > 2000) break;
      }
      headingCount = 0;
    }

    var eyeI = 0, legI = 0, shieldI = 0;
    var animLegs = quality === 'high';
    var legDist2 = 75 * 75;
    for (var ti = 0; ti < ENEMY_TYPES.length; ti++){
      var t2 = ENEMY_TYPES[ti];
      if (BOSS_SET[t2]) continue;
      var pool = enemyPools[t2];
      var mesh = pool.mesh;
      var cnt = Math.min(bucketCount[t2], pool.cap);
      var def = enemyDef(t2);
      var isSkitter = !!SKITTER_SET[t2];
      var isWalker = (t2 === 'tank');
      for (var k = 0; k < cnt; k++){
        var en = list[buckets[t2][k]];
        var s = clamp(num(en.size, num(def.size, 10)) * 0.09, 0.35, 2.4);
        /* heading from movement */
        var hd = headings[en.id];
        if (!hd){ hd = { x: en.x, z: en.z, a: 0 }; headings[en.id] = hd; }
        var dx = en.x - hd.x, dz = en.z - hd.z;
        var moved2 = dx * dx + dz * dz;
        var bank = 0;
        if (moved2 > 0.0004){
          var na = Math.atan2(dx, dz);
          var da = na - hd.a;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          bank = clamp(da * 1.2, -0.3, 0.3); /* lean into turns */
          hd.a += da * Math.min(1, dt * 10);
          hd.x = en.x; hd.z = en.z;
        }
        /* procedural walk cycle: full stride when moving, soft idle sway
           when still, banking into turns. Nothing looks frozen. */
        var spdF = clamp(Math.sqrt(moved2) / Math.max(dt, 0.001) / 9, 0, 1.2);
        var ampF = 0.25 + 0.75 * Math.min(1, spdF);
        var wob = bank, bobY = 0.55 * s, pitch = 0;
        if (isSkitter){
          wob += Math.sin(time * 15 + en.id * 1.7) * 0.13 * ampF;
          bobY += Math.abs(Math.sin(time * 15 + en.id * 1.7)) * 0.1 * s * ampF;
        } else if (isWalker){
          var st = Math.abs(Math.sin(time * 4.2 + en.id));
          bobY += st * 0.3 * s * ampF;
          pitch = Math.sin(time * 4.2 + en.id) * 0.05 * ampF;
        } else {
          bobY += Math.sin(time * 3 + en.id * 2.3) * 0.08 * s * ampF;
        }
        var egy = groundY(en.x, en.z);
        _v1.set(en.x, egy + bobY, en.z);
        _e1.set(pitch, hd.a, wob, 'YXZ');
        _q1.setFromEuler(_e1);
        _s1.set(s, s, s);
        _m1.compose(_v1, _q1, _s1);
        mesh.setMatrixAt(k, _m1);
        /* body tint: models carry baked vertex colors (keep near-white base so
           they pop); primitives use the classic rust tint. Status effects
           multiply on top in both cases. */
        if (pool.hasModel) _c1.setHex(0xffffff);
        else _c1.setHex(0x3a2c26).lerp(pool.tint, 0.28);
        if (t2 === 'mite') _c1.lerp(_c2.setHex(0xffc94d), 0.65);
        if (enemySlowed(en, tnow)) _c1.lerp(_c2.setHex(0x3b82f6), 0.55);
        if (enemyFrozen(en, tnow)) _c1.lerp(_c2.setHex(0xcfe8ff), 0.7);
        mesh.setColorAt(k, _c1);
        /* eyes */
        if (eyeI + 1 < 1500){
          var es = s;
          var ca = Math.cos(hd.a), sa = Math.sin(hd.a);
          for (var ei = 0; ei < 2; ei++){
            var ex = (ei === 0 ? -0.3 : 0.3) * es, ez = 0.72 * es;
            _v1.set(en.x + sa * ez + ca * ex, egy + (0.45 * es) + bobY - 0.55 * s + 0.35 * es, en.z + ca * ez - sa * ex);
            _e1.set(0, hd.a, 0); _q1.setFromEuler(_e1);
            _s1.set(es, es, es);
            _m1.compose(_v1, _q1, _s1);
            eyeMesh.setMatrixAt(eyeI++, _m1);
          }
        }
        /* legs for nearby skitters (skipped when a real model with legs is loaded) */
        if (isSkitter && animLegs && !pool.hasModel && legI + 4 < 3000){
          var ddx = en.x - cam.tx, ddz = en.z - cam.tz;
          if (ddx * ddx + ddz * ddz < legDist2){
            for (var li = 0; li < 4; li++){
              var side = li < 2 ? -1 : 1;
              var fr = (li % 2 === 0) ? 1 : -1;
              var swing = Math.sin(time * 15 + en.id * 1.7 + li * 1.9) * 0.55;
              var hx = side * 0.55 * s, hz = fr * 0.5 * s;
              var ca2 = Math.cos(hd.a), sa2 = Math.sin(hd.a);
              _v1.set(en.x + sa2 * hz + ca2 * hx, egy + 0.42 * s + bobY - 0.55 * s + 0.3 * s, en.z + ca2 * hz - sa2 * hx);
              _e1.set(swing * 0.6 + 0.25 * fr, hd.a + side * 0.5, 0, 'YXZ');
              _q1.setFromEuler(_e1);
              _s1.set(s, s, s);
              _m1.compose(_v1, _q1, _s1);
              legMesh.setMatrixAt(legI++, _m1);
            }
          }
        }
        /* shield shimmer */
        if (t2 === 'shieldbearer' && num(en.shield, 0) > 0 && shieldI < 300){
          _v1.set(en.x, egy + 1.0 * s, en.z);
          _e1.set(0, time * 0.8 + en.id, 0); _q1.setFromEuler(_e1);
          _s1.set(s, s, s);
          _m1.compose(_v1, _q1, _s1);
          shieldMesh.setMatrixAt(shieldI++, _m1);
        }
      }
      mesh.count = cnt;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (pool.transparent) pool.mesh.material.opacity = 0.38 + 0.22 * Math.sin(time * 11 + ti * 2);
    }
    eyeMesh.count = Math.min(eyeI, 1500);
    eyeMesh.instanceMatrix.needsUpdate = true;
    legMesh.count = Math.min(legI, 3000);
    legMesh.instanceMatrix.needsUpdate = true;
    shieldMesh.count = Math.min(shieldI, 300);
    shieldMesh.instanceMatrix.needsUpdate = true;
    shieldMesh.material.opacity = 0.16 + 0.1 * Math.sin(time * 6);
  }

  /* ================= bosses: unique war-machine set pieces ================= */
  function rustMat(){
    return new THREE.MeshStandardMaterial({ color: 0x3a2c24, roughness: 0.62, metalness: 0.55 });
  }
  function eyeMat(hex){
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex || '#ff5a1a') });
  }

  function buildBoss(type, e){
    var g = new THREE.Group();
    var anim = { type: type, seed: (e && e.id || 1) * 1.37 };
    var rust = rustMat();
    var glowHex = '#ff5a1a';
    try {
      var def = enemyDef(type);
      if (def.glow) glowHex = def.glow;
    } catch (er) {}
    /* real model when loaded: base + glow eyes; primitives otherwise */
    var bossModel = null;
    try {
      var MLb = (globalThis.NB && NB.ModelLib) || null;
      bossModel = MLb ? MLb.bossModel(type) : null;
    } catch (e2){ bossModel = null; }
    if (bossModel && bossModel.group){
      g.add(bossModel.group);
      anim.model = true;
      anim.segs = []; anim.shards = []; anim.eyes = [];
      anim.ring = null; anim.core = null; anim.jaw = null; anim.ering = null;
      var bh = bossModel.height || 5;
      for (var bei = 0; bei < 2; bei++){
        var beye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), eyeMat(glowHex));
        beye.position.set(bei === 0 ? -1.1 : 1.1, bh * 0.62, bh * 0.28);
        g.add(beye); anim.eyes.push(beye);
      }
    } else if (type === 'dreadnought'){
      var hull = new THREE.Mesh(new THREE.OctahedronGeometry(2.6), rust);
      hull.scale.set(1, 0.75, 1.25); hull.position.y = 2.4;
      g.add(hull);
      for (var i = 0; i < 4; i++){
        var a = i * Math.PI / 2;
        var plate = box(1.4, 1.8, 0.3, rust, Math.cos(a) * 2.2, 2.6, Math.sin(a) * 2.6);
        plate.rotation.y = -a;
        g.add(plate);
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6), rust);
        spike.position.set(Math.cos(a + 0.78) * 2.0, 4.2, Math.sin(a + 0.78) * 2.0);
        g.add(spike);
      }
      var ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 8, 28), rust);
      ring.rotation.x = Math.PI / 2; ring.position.y = 2.4;
      g.add(ring);
      anim.ring = ring;
      anim.eyes = [];
      for (var ei = 0; ei < 3; ei++){
        var eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), eyeMat(glowHex));
        eye.position.set((ei - 1) * 0.9, 2.9, 2.9);
        g.add(eye); anim.eyes.push(eye);
      }
    } else if (type === 'overmind'){
      var core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 0), rust);
      core.position.y = 3.2;
      g.add(core);
      anim.core = core;
      anim.shards = [];
      for (var s = 0; s < 6; s++){
        var sh = box(0.9, 0.9, 0.9, rust, 0, 3.2, 0);
        g.add(sh); anim.shards.push(sh);
      }
      var ering = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.14, 8, 24), eyeMat(glowHex));
      ering.position.y = 3.2;
      g.add(ering);
      anim.ering = ering;
    } else { /* leviathan */
      anim.segs = [];
      for (var gI = 0; gI < 5; gI++){
        var w = 2.6 - gI * 0.32;
        var seg = box(w, 1.7 - gI * 0.12, 2.2, rust, 0, 1.6, -gI * 2.1);
        g.add(seg); anim.segs.push(seg);
        if (gI < 4){
          var dsp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 5), rust);
          dsp.position.set(0, 2.9 - gI * 0.12, -gI * 2.1);
          g.add(dsp);
        }
      }
      var jaw = box(2.0, 0.5, 1.6, rust, 0, 1.0, 1.6);
      g.add(jaw); anim.jaw = jaw;
      anim.eyes = [];
      for (var li = 0; li < 2; li++){
        var le = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), eyeMat(glowHex));
        le.position.set(li === 0 ? -0.8 : 0.8, 2.2, 1.35);
        g.add(le); anim.eyes.push(le);
      }
    }
    g.position.set(num(e && e.x, W / 2), 0, num(e && e.z, H / 2));
    scene.add(g);
    return { group: g, anim: anim, id: e && e.id };
  }

  function updateBoss(entry, e, dt){
    if (!entry || !e) return;
    var g = entry.group, A = entry.anim;
    var hd = headings[e.id];
    if (!hd){ hd = { x: e.x, z: e.z, a: 0 }; headings[e.id] = hd; }
    var dx = e.x - hd.x, dz = e.z - hd.z;
    if (dx * dx + dz * dz > 0.01) hd.a = Math.atan2(dx, dz);
    hd.x = e.x; hd.z = e.z;
    g.position.x = e.x; g.position.z = e.z;
    g.rotation.y = hd.a;
    var t = time + A.seed;
    var bgy = groundY(e.x, e.z);
    if (A.type === 'dreadnought'){
      g.position.y = bgy + Math.sin(t * 1.1) * 0.25;
      if (A.ring) A.ring.rotation.z = t * 0.9;
    } else if (A.type === 'overmind'){
      g.position.y = bgy + Math.sin(t * 0.9) * 0.4;
      if (A.core){ A.core.rotation.y = t * 0.5; A.core.rotation.x = t * 0.23; }
      if (A.shards){
        for (var i = 0; i < A.shards.length; i++){
          var a = t * 0.7 + i * 1.047;
          A.shards[i].position.set(Math.cos(a) * 3.6, 3.2 + Math.sin(t * 1.3 + i) * 0.5, Math.sin(a) * 3.6);
          A.shards[i].rotation.y = a;
        }
      }
      if (A.ering) A.ering.rotation.y = -t * 1.1;
    } else {
      g.position.y = bgy;
      if (A.segs){
        for (var s2 = 0; s2 < A.segs.length; s2++){
          A.segs[s2].position.x = Math.sin(t * 2.2 - s2 * 0.8) * 0.5;
        }
      }
      if (A.jaw) A.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(t * 3.1)) * 0.35;
    }
    if (A.model){
      /* menacing hover-sway for model bosses */
      g.position.y += Math.sin(t * 1.15) * 0.35;
      g.rotation.z = Math.sin(t * 0.7) * 0.03;
    }
    if (A.eyes){
      var es = 1 + 0.18 * Math.sin(t * 6);
      for (var ei = 0; ei < A.eyes.length; ei++) A.eyes[ei].scale.set(es, es, es);
    }
  }

  /* ================= projectiles: signature tracers ================= */
  function buildProjectiles(){
    projMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }), 400);
    projMesh.frustumCulled = false; projMesh.count = 0;
    scene.add(projMesh);
    tracerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 2.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false }), 120);
    tracerMesh.frustumCulled = false; tracerMesh.count = 0;
    scene.add(tracerMesh);
  }
  var tracerMesh = null;

  function updateProjectiles(snap, dt){
    var list = arr(snap && snap.projectiles);
    var n = Math.min(list.length, 400);
    var ti = 0, pi = 0;
    for (var i = 0; i < n; i++){
      var p = list[i];
      if (!p) continue;
      var spd = num(p.speed, 400);
      var col = p.color || '#ffd27a';
      if (spd > 700 && ti < 120 && p.tx != null && p.tz != null){
        /* sniper rail: thin white-hot beam tracer along flight path */
        _v1.set(p.x, 1.6, p.z);
        _v2.set(p.tx - p.x, 0, p.tz - p.z);
        var L = Math.max(0.001, _v2.length());
        _v2.normalize();
        _e1.set(0, Math.atan2(_v2.x, _v2.z), 0); _q1.setFromEuler(_e1);
        _s1.set(1, 1, 1);
        _m1.compose(_v1, _q1, _s1);
        tracerMesh.setMatrixAt(ti, _m1);
        _c1.set('#fff6e8');
        tracerMesh.setColorAt(ti, _c1);
        ti++;
      } else {
        _v1.set(p.x, 1.6, p.z);
        _q1.identity();
        var ps = clamp(spd / 500, 0.7, 1.6);
        _s1.set(ps, ps, ps);
        _m1.compose(_v1, _q1, _s1);
        projMesh.setMatrixAt(pi, _m1);
        try { _c1.set(col); } catch (er) { _c1.setHex(0xffd27a); }
        projMesh.setColorAt(pi, _c1);
        pi++;
      }
    }
    projMesh.count = pi;
    projMesh.instanceMatrix.needsUpdate = true;
    if (projMesh.instanceColor) projMesh.instanceColor.needsUpdate = true;
    tracerMesh.count = ti;
    tracerMesh.instanceMatrix.needsUpdate = true;
    if (tracerMesh.instanceColor) tracerMesh.instanceColor.needsUpdate = true;
    /* mortar shells: smoke trail wisps */
    if (n > 0 && (frameNo % 3) === 0){
      for (var sI = 0; sI < Math.min(6, n); sI++){
        var mp = list[(sI * 7 + frameNo) % n];
        if (mp && num(mp.speed, 500) < 380){
          spawnPuff(mp.x, 1.8, mp.z, { count: 1, life: 0.7, size: 3.2 });
        }
      }
    }
  }
  var frameNo = 0;

  /* ================= beams + EMP arcs ================= */
  function buildBeams(){
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(512 * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(512 * 2 * 3), 3));
    beamLines = new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    beamLines.frustumCulled = false;
    scene.add(beamLines);
  }

  function updateBeams(snap){
    var list = arr(snap && snap.beams);
    var pos = beamLines.geometry.attributes.position;
    var col = beamLines.geometry.attributes.color;
    var n = Math.min(list.length, 512);
    for (var i = 0; i < n; i++){
      var b = list[i];
      if (!b){ continue; }
      var fade = clamp(num(b.ttl, 0.15) / 0.15, 0, 1);
      pos.setXYZ(i * 2, num(b.x1, 0), 2.4, num(b.z1, 0));
      pos.setXYZ(i * 2 + 1, num(b.x2, 0), 2.4, num(b.z2, 0));
      try { _c1.set(b.color || '#9df3ff'); } catch (er) { _c1.setHex(0x9df3ff); }
      _c1.multiplyScalar(0.25 + 0.75 * fade);
      col.setXYZ(i * 2, _c1.r, _c1.g, _c1.b);
      col.setXYZ(i * 2 + 1, _c1.r, _c1.g, _c1.b);
    }
    beamLines.geometry.setDrawRange(0, n * 2);
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  var ARC_N = 36, ARC_SEG = 7;
  function buildArcs(){
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * ARC_SEG * 2 * 3), 3));
    arcLines = new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    arcLines.frustumCulled = false;
    scene.add(arcLines);
  }

  function updateArcs(dt, surgeI){
    arcT -= dt;
    var pos = arcLines.geometry.attributes.position;
    if (surgeI > 0.03 && arcT <= 0){
      arcT = 0.16;
      var vi = 0;
      for (var a = 0; a < ARC_N; a++){
        var ax = Math.random() * W, az = Math.random() * H;
        var ay = 26 + Math.random() * 14;
        var px = ax, py = ay, pz = az;
        for (var s = 0; s < ARC_SEG; s++){
          var nx = px + (Math.random() - 0.5) * 7;
          var ny = py - (26 / ARC_SEG) * (0.7 + Math.random() * 0.6);
          var nz = pz + (Math.random() - 0.5) * 7;
          pos.setXYZ(vi++, px, Math.max(0.5, py), pz);
          pos.setXYZ(vi++, nx, Math.max(0.5, ny), nz);
          px = nx; py = ny; pz = nz;
        }
      }
      pos.needsUpdate = true;
      arcLines.material.opacity = 0.5 + Math.random() * 0.5;
    } else if (surgeI <= 0.03){
      arcLines.material.opacity = 0;
    } else {
      arcLines.material.opacity *= Math.max(0, 1 - dt * 9);
    }
  }

  /* ================= particles: sparks (additive) + smoke ================= */
  function makePointsMaterial(blending){
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: blending,
      vertexShader: 'attribute float aSize; attribute vec3 aColor; attribute float aAlpha;' +
        'varying vec3 vC; varying float vA;' +
        'void main(){ vC = aColor; vA = aAlpha;' +
        ' vec4 mv = modelViewMatrix * vec4(position, 1.0);' +
        ' gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));' +
        ' gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA;' +
        'void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q);' +
        ' float a = smoothstep(0.5, 0.06, d) * vA;' +
        ' if (a < 0.012) discard;' +
        ' gl_FragColor = vec4(vC, a); }'
    });
  }

  function makePool(cap, blending){
    var geo = new THREE.BufferGeometry();
    function dyn(arr, n){
      var a = new THREE.BufferAttribute(arr, n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    }
    var posA = dyn(new Float32Array(cap * 3), 3);
    var colA = dyn(new Float32Array(cap * 3), 3);
    var sizeA = dyn(new Float32Array(cap), 1);
    var alphaA = dyn(new Float32Array(cap), 1);
    geo.setAttribute('position', posA);
    geo.setAttribute('aColor', colA);
    geo.setAttribute('aSize', sizeA);
    geo.setAttribute('aAlpha', alphaA);
    geo.setDrawRange(0, 0);
    var points = new THREE.Points(geo, makePointsMaterial(blending));
    points.frustumCulled = false;
    scene.add(points);
    return { cap: cap, n: 0, geo: geo, posA: posA, colA: colA, sizeA: sizeA, alphaA: alphaA,
      px: new Float32Array(cap), py: new Float32Array(cap), pz: new Float32Array(cap),
      vx: new Float32Array(cap), vy: new Float32Array(cap), vz: new Float32Array(cap),
      life: new Float32Array(cap), maxLife: new Float32Array(cap),
      size: new Float32Array(cap), grow: new Float32Array(cap),
      drag: new Float32Array(cap), grav: new Float32Array(cap),
      r: new Float32Array(cap), g: new Float32Array(cap), b: new Float32Array(cap),
      a0: new Float32Array(cap) };
  }

  function poolSpawn(P, x, y, z, vx, vy, vz, life, size, grow, drag, grav, r, g, b, a0){
    if (P.n >= P.cap) return;
    var i = P.n++;
    P.px[i] = x; P.py[i] = y; P.pz[i] = z;
    P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz;
    P.life[i] = life; P.maxLife[i] = life;
    P.size[i] = size; P.grow[i] = grow; P.drag[i] = drag; P.grav[i] = grav;
    P.r[i] = r; P.g[i] = g; P.b[i] = b; P.a0[i] = a0;
  }

  function poolKill(P, i){
    var l = --P.n;
    if (i !== l){
      P.px[i] = P.px[l]; P.py[i] = P.py[l]; P.pz[i] = P.pz[l];
      P.vx[i] = P.vx[l]; P.vy[i] = P.vy[l]; P.vz[i] = P.vz[l];
      P.life[i] = P.life[l]; P.maxLife[i] = P.maxLife[l];
      P.size[i] = P.size[l]; P.grow[i] = P.grow[l];
      P.drag[i] = P.drag[l]; P.grav[i] = P.grav[l];
      P.r[i] = P.r[l]; P.g[i] = P.g[l]; P.b[i] = P.b[l]; P.a0[i] = P.a0[l];
    }
  }

  function poolUpdate(P, dt){
    for (var i = 0; i < P.n; i++){
      P.life[i] -= dt;
      if (P.life[i] <= 0){ poolKill(P, i); i--; continue; }
      var dr = 1 - P.drag[i] * dt;
      if (dr < 0) dr = 0;
      P.vx[i] *= dr; P.vz[i] *= dr;
      P.vy[i] = P.vy[i] * dr - P.grav[i] * dt;
      P.px[i] += P.vx[i] * dt; P.py[i] += P.vy[i] * dt; P.pz[i] += P.vz[i] * dt;
      if (P.py[i] < 0.1){ P.py[i] = 0.1; P.vy[i] = 0; }
      P.size[i] += P.grow[i] * dt;
      var t = P.life[i] / P.maxLife[i];
      P.posA.setXYZ(i, P.px[i], P.py[i], P.pz[i]);
      P.colA.setXYZ(i, P.r[i], P.g[i], P.b[i]);
      P.sizeA.setX(i, Math.max(0.01, P.size[i]));
      P.alphaA.setX(i, P.a0[i] * t);
    }
    P.geo.setDrawRange(0, P.n);
    P.posA.needsUpdate = true; P.colA.needsUpdate = true;
    P.sizeA.needsUpdate = true; P.alphaA.needsUpdate = true;
  }

  function buildParticles(){
    sparks = makePool(2200, THREE.AdditiveBlending);
    smoke = makePool(700, THREE.NormalBlending);
    /* drifting ash/dust: simple points, always alive */
    var n = 500;
    var geo = new THREE.BufferGeometry();
    var parr = new Float32Array(n * 3);
    for (var i = 0; i < n; i++){
      parr[i * 3] = Math.random() * W;
      parr[i * 3 + 1] = Math.random() * 34;
      parr[i * 3 + 2] = Math.random() * H;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(parr, 3));
    ash = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9a8a74, size: 0.45,
      transparent: true, opacity: 0.5, depthWrite: false }));
    ash.frustumCulled = false;
    ash.userData.n = n;
    scene.add(ash);
  }

  var _tmpC = null;
  function hexRgb(h){
    if (!_tmpC) _tmpC = new THREE.Color();
    try { _tmpC.set(h); } catch (e) { _tmpC.setHex(0xffffff); }
    return _tmpC;
  }

  function spawnBurst(x, y, z, o){
    o = o || {};
    var mult = quality === 'low' ? 0.5 : 1;
    var count = Math.round(num(o.count, 10) * mult);
    var c = hexRgb(o.color == null ? '#ffcf7a' : o.color);
    var speed = num(o.speed, 8), up = num(o.up, 5), life = num(o.life, 0.6);
    for (var i = 0; i < count; i++){
      var a = Math.random() * 6.2832, r2 = Math.random();
      poolSpawn(sparks, x, y, z,
        Math.cos(a) * speed * r2, up * (0.4 + Math.random() * 0.9), Math.sin(a) * speed * r2,
        life * (0.6 + Math.random() * 0.8), num(o.size, 2.6) * (0.7 + Math.random() * 0.6),
        0, 2.2, 9, c.r, c.g, c.b, 0.95);
    }
  }

  function spawnPuff(x, y, z, o){
    o = o || {};
    var mult = quality === 'low' ? 0.5 : 1;
    var count = Math.max(1, Math.round(num(o.count, 4) * mult));
    var c = hexRgb(o.color == null ? '#4a4448' : o.color);
    var vel = num(o.vel, 1.6);
    for (var i = 0; i < count; i++){
      var a = Math.random() * 6.2832;
      poolSpawn(smoke, x + (Math.random() - 0.5), y, z + (Math.random() - 0.5),
        Math.cos(a) * vel, 1.2 + Math.random() * 1.4, Math.sin(a) * vel,
        num(o.life, 1.4) * (0.7 + Math.random() * 0.6), num(o.size, 4.5),
        3.2, 1.2, -1.5, c.r, c.g, c.b, 0.42);
    }
  }

  function updateAsh(dt, surgeI){
    if (quality === 'low'){ ash.visible = false; return; }
    ash.visible = true;
    var pos = ash.geometry.attributes.position;
    var n = ash.userData.n;
    var fall = 1.1 + surgeI * 3.2;
    var show = Math.floor(n * (surgeI > 0.03 ? 1 : 0.45));
    for (var i = 0; i < n; i++){
      var ix = i * 3;
      var y = pos.array[ix + 1] - fall * dt * (0.6 + (i % 5) * 0.2);
      var x = pos.array[ix] + Math.sin(time * 0.7 + i * 1.3) * dt * 1.2;
      if (y < 0){ y = 32 + Math.random() * 4; x = cam.tx + (Math.random() - 0.5) * W; }
      if (x < 0) x += W; if (x > W) x -= W;
      var z = pos.array[ix + 2];
      if (z < 0) z += H; if (z > H) z -= H;
      pos.array[ix] = x; pos.array[ix + 1] = y; pos.array[ix + 2] = z;
    }
    ash.geometry.setDrawRange(0, show);
    pos.needsUpdate = true;
    ash.material.opacity = 0.35 + surgeI * 0.35;
  }

  /* ================= debris: destruction physics (juice, not sim) =========
     NB.Debris owns the physics: pooled tumbling chunks, gravity, ground
     bounce with damping/friction, spin settle, radial explosion impulses.
     This module only renders it (instanced boxes synced per frame).
     See js/debris.js for the explicit scope statement. */
  var debrisSys = null, debrisMesh = null;
  function buildDebris(){
    debrisSys = NB.Debris.create({ cap: 300, gravity: 22 });
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.5 });
    debrisMesh = new THREE.InstancedMesh(geo, mat, debrisSys.cap());
    debrisMesh.frustumCulled = false; debrisMesh.count = 0;
    scene.add(debrisMesh);
  }

  function spawnDebris(x, y, z, o){
    o = o || {};
    var c = hexRgb(o.color == null ? '#5a4a3c' : o.color);
    debrisSys.burst(x, y, z, { count: num(o.count, 4), speed: num(o.speed, 7),
      up: num(o.up, 5), life: num(o.life, 1.3), size: num(o.size, 0.7),
      color: [c.r, c.g, c.b] });
  }

  function updateDebris(dt){
    debrisSys.update(dt, groundY);
    var n = debrisSys.active();
    for (var i = 0; i < n; i++){
      var b = debrisSys.body(i);
      var fade = clamp(b.life / (b.maxLife * 0.3), 0, 1);
      _v1.set(b.x, b.y, b.z);
      _e1.set(b.rx, b.ry, 0); _q1.setFromEuler(_e1);
      var s = b.size * (0.4 + 0.6 * fade);
      _s1.set(s, s * 0.7, s);
      _m1.compose(_v1, _q1, _s1);
      debrisMesh.setMatrixAt(i, _m1);
      _c1.setRGB(b.r, b.g, b.b);
      debrisMesh.setColorAt(i, _c1);
    }
    debrisMesh.count = n;
    debrisMesh.instanceMatrix.needsUpdate = true;
    if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
  }

  /* ================= shockwave rings ================= */
  function buildRings(){
    for (var i = 0; i < 10; i++){
      var m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48),
        new THREE.MeshBasicMaterial({ color: 0xffcf7a, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.3;
      m.visible = false;
      scene.add(m);
      rings.push({ mesh: m, t: 0, life: 1, maxR: 8, active: false });
    }
  }

  function spawnRing(x, z, o){
    o = o || {};
    for (var i = 0; i < rings.length; i++){
      var r = rings[i];
      if (r.active) continue;
      r.active = true; r.t = 0;
      r.life = num(o.life, 0.7); r.maxR = num(o.maxR, 8);
      r.mesh.visible = true;
      r.mesh.position.set(x, groundY(x, z) + 0.3, z);
      try { r.mesh.material.color.set(o.color == null ? '#ffcf7a' : o.color); }
      catch (e) { r.mesh.material.color.setHex(0xffcf7a); }
      return;
    }
  }

  function updateRings(dt){
    for (var i = 0; i < rings.length; i++){
      var r = rings[i];
      if (!r.active) continue;
      r.t += dt;
      var k = clamp(r.t / r.life, 0, 1);
      if (k >= 1){ r.active = false; r.mesh.visible = false; continue; }
      var e = 1 - Math.pow(1 - k, 3);
      var s = 0.5 + e * r.maxR;
      r.mesh.scale.set(s, s, 1);
      r.mesh.material.opacity = (1 - k) * 0.85;
    }
  }

  /* ================= craters: persistent scorch decals ================= */
  function buildCraters(){
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(5,4,6,0.95)');
    g.addColorStop(0.55, 'rgba(10,8,8,0.7)');
    g.addColorStop(0.8, 'rgba(20,12,8,0.35)');
    g.addColorStop(1, 'rgba(20,12,8,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    craterMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }), 40);
    craterMesh.frustumCulled = false;
    craterMesh.count = 0;
    scene.add(craterMesh);
  }

  function spawnCrater(x, z, scale){
    var i = craterIdx % 40;
    craterIdx++;
    _v1.set(x, groundY(x, z) + 0.18, z);
    _e1.set(-Math.PI / 2, 0, Math.random() * 3.14); _q1.setFromEuler(_e1);
    var s = num(scale, 5);
    _s1.set(s, s, 1);
    _m1.compose(_v1, _q1, _s1);
    craterMesh.setMatrixAt(i, _m1);
    craterMesh.count = Math.min(40, craterMesh.count + 1);
    if (i >= craterMesh.count - 1 && craterMesh.count < 40) craterMesh.count = i + 1;
    craterMesh.instanceMatrix.needsUpdate = true;
  }

  /* ================= muzzle flash: one shared light + sprite ================= */
  function buildFlashSprite(){
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.35, 'rgba(255,200,110,0.8)');
    g.addColorStop(1, 'rgba(255,150,50,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    flashSprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    flashSprite.visible = false;
    scene.add(flashSprite);
  }
  var flashLife = 0;

  function fireMuzzle(entry){
    if (!entry.parts.muzzle) return;
    entry.parts.muzzle.getWorldPosition(_v1);
    flashLight.position.copy(_v1);
    flashLight.intensity = 5;
    flashSprite.position.copy(_v1);
    flashSprite.lookAt(camera3.position);
    flashSprite.scale.set(2.6, 2.6, 1);
    flashSprite.material.opacity = 0.95;
    flashSprite.visible = true;
    flashLife = 0.07;
    spawnBurst(_v1.x, _v1.y, _v1.z, { count: 4, color: '#ffd27a', speed: 5, life: 0.22, size: 2.4, up: 1 });
    /* pooled light: every shot gets its own flicker, no single-light choke */
    try { if (NB.Cine) NB.Cine.muzzleFlash(_v1.x, _v1.y, _v1.z); } catch (e){}
  }

  function updateFlash(dt){
    if (flashLife > 0){
      flashLife -= dt;
      if (flashLife <= 0){ flashSprite.visible = false; }
    }
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 60);
    if (flashSprite.visible) flashSprite.material.opacity = Math.max(0, flashLife / 0.07) * 0.95;
  }

  /* ================= terrain height field ================= */
  var heightFn = null, heightSig = '';

  function groundY(x, z){
    if (heightFn){
      try {
        /* Bilinearly smooth the per-cell staircase (sim.heightAt) so the
         * height matches the GPU-interpolated ground mesh. Without this,
         * picking against the raw staircase disagrees with the visible
         * surface by up to a cell at hill borders. Gameplay keeps using
         * the discrete cell heights; this is visuals/picking only. */
        return NB.Pick.smoothSample(heightFn, CELL, x, z);
      } catch (e) {}
    }
    return groundHeight(x, z);
  }

  function applyHeightField(){
    var sig = sectorSig + '|' + (heightFn ? 'sim' : 'proc');
    if (sig === heightSig || !groundMesh) return;
    heightSig = sig;
    var geo = groundMesh.geometry;
    var pos = geo.attributes.position;
    var n = pos.count;
    var hs = new Float32Array(n);
    var mn = 1e9, mx = -1e9;
    for (var i = 0; i < n; i++){
      var x = pos.getX(i) + W / 2, z = pos.getZ(i) + H / 2;
      var h = groundY(x, z);
      hs[i] = h;
      if (h < mn) mn = h;
      if (h > mx) mx = h;
    }
    var colArr = new Float32Array(n * 3);
    _c1.setHex(0x14121a); _c2.setHex(0x5a5260);
    var range = Math.max(0.001, mx - mn);
    var colAttr = geo.attributes.color;
    for (var k = 0; k < n; k++){
      pos.setY(k, hs[k]);
      var t = (hs[k] - mn) / range;
      var cr = _c1.r + (_c2.r - _c1.r) * t;
      var cg2 = _c1.g + (_c2.g - _c1.g) * t;
      var cb = _c1.b + (_c2.b - _c1.b) * t;
      colArr[k * 3] = cr; colArr[k * 3 + 1] = cg2; colArr[k * 3 + 2] = cb;
    }
    if (colAttr) colAttr.array.set(colArr);
    else geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    groundMesh.material.vertexColors = true;
    groundMesh.material.needsUpdate = true;
    geo.attributes.position.needsUpdate = true;
    if (geo.attributes.color) geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /* ================= colonists: ambient life ================= */
  var colonistHasModel = false;
  function buildColonists(){
    var cap = 12;
    var ML = (globalThis.NB && NB.ModelLib) || null;
    var cgeo = null;
    try { cgeo = ML ? ML.geometryFor('struct_colonist') : null; } catch (e){ cgeo = null; }
    colonistHasModel = !!cgeo;
    colonistBodies = new THREE.InstancedMesh(
      cgeo || new THREE.CapsuleGeometry(0.16, 0.5, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a6a55, roughness: 0.8,
        vertexColors: colonistHasModel }), cap);
    colonistHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a6f5a, roughness: 0.8 }), cap);
    colonistBodies.frustumCulled = false; colonistHeads.frustumCulled = false;
    scene.add(colonistBodies); scene.add(colonistHeads);
    for (var i = 0; i < cap; i++){
      colonists.push({ x: hqPos.x + (Math.random() - 0.5) * 16,
        z: hqPos.z + (Math.random() - 0.5) * 16,
        tx: hqPos.x, tz: hqPos.z, wait: Math.random() * 3,
        phase: Math.random() * 9, speed: 1.0 + Math.random() * 0.6 });
    }
  }

  function updateColonists(dt){
    var show = quality === 'high' && cam.dist < 105;
    colonistBodies.visible = show; colonistHeads.visible = show && !colonistHasModel;
    if (!show) return;
    for (var i = 0; i < colonists.length; i++){
      var c = colonists[i];
      if (c.wait > 0){
        c.wait -= dt;
      } else {
        var dx = c.tx - c.x, dz = c.tz - c.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.6){
          c.wait = 2 + Math.random() * 4;
          var keys = Object.keys(towers);
          if (keys.length && Math.random() < 0.7){
            var te = towers[keys[(Math.random() * keys.length) | 0]];
            c.tx = te.x + (Math.random() - 0.5) * 8;
            c.tz = te.z + (Math.random() - 0.5) * 8;
          } else {
            c.tx = hqPos.x + (Math.random() - 0.5) * 24;
            c.tz = hqPos.z + (Math.random() - 0.5) * 24;
          }
          c.tx = clamp(c.tx, 2, W - 2); c.tz = clamp(c.tz, 2, H - 2);
        } else {
          c.x += dx / d * c.speed * dt;
          c.z += dz / d * c.speed * dt;
          c.heading = Math.atan2(dx, dz);
        }
      }
      var gy = groundY(c.x, c.z);
      var bob = Math.abs(Math.sin(time * 8 + c.phase)) * (c.wait > 0 ? 0.01 : 0.09);
      _v1.set(c.x, gy + (colonistHasModel ? bob : 0.62 + bob), c.z);
      _e1.set(0, c.heading || 0, 0); _q1.setFromEuler(_e1);
      _s1.set(1, 1, 1);
      _m1.compose(_v1, _q1, _s1);
      colonistBodies.setMatrixAt(i, _m1);
      _v1.set(c.x, gy + 1.18 + bob, c.z);
      _m1.compose(_v1, _q1, _s1);
      colonistHeads.setMatrixAt(i, _m1);
    }
    colonistBodies.count = colonists.length;
    colonistHeads.count = colonists.length;
    colonistBodies.instanceMatrix.needsUpdate = true;
    colonistHeads.instanceMatrix.needsUpdate = true;
  }

  /* ================= ghost / selection / hover / focus ================= */
  function buildGhost(){
    ghostMats.valid = new THREE.MeshBasicMaterial({ color: 0x2bff88, transparent: true,
      opacity: 0.45, depthWrite: false });
    ghostMats.invalid = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true,
      opacity: 0.45, depthWrite: false });
    for (var i = 0; i < 24; i++){
      var m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.9), ghostMats.valid);
      m.visible = false;
      scene.add(m);
      ghostMeshes.push(m);
    }
  }

  function updateGhost(view){
    var gh = view && view.ghost;
    var cells = (gh && gh.cells) || [];
    var n = Math.min(cells.length, ghostMeshes.length);
    for (var i = 0; i < ghostMeshes.length; i++){
      var m = ghostMeshes[i];
      if (i < n){
        var c = cells[i];
        /* game.js and sim.wallCells write cx/cz; accept x/z too */
        var ccx = (c.cx != null) ? c.cx : num(c.x, 0);
        var ccz = (c.cz != null) ? c.cz : num(c.z, 0);
        var wx = (ccx + 0.5) * CELL, wz = (ccz + 0.5) * CELL;
        m.position.set(wx, groundY(wx, wz) + 0.75, wz);
        m.material = (gh && gh.valid) ? ghostMats.valid : ghostMats.invalid;
        m.visible = true;
      } else m.visible = false;
    }
  }

  function buildSelection(){
    selRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.13, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    selRing.rotation.x = Math.PI / 2;
    selRing.visible = false;
    scene.add(selRing);
    hoverBox = new THREE.Mesh(new THREE.BoxGeometry(2, 0.25, 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3,
        depthWrite: false }));
    hoverBox.visible = false;
    scene.add(hoverBox);
    /* focus marker: pulsing red holographic diamond */
    focusMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.55),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    focusMark.visible = false;
    scene.add(focusMark);
  }
  var focusMark = null;

  function findStructPos(kind, instId){
    if (kind === 'tower' && towers[instId]) return towers[instId];
    if (kind === 'reactor' && reactors[instId]) return reactors[instId];
    if (kind === 'hq') return { x: hqPos.x, z: hqPos.z };
    if (kind === 'wall' && wallPrev[instId]) return wallPrev[instId];
    return null;
  }

  function updateSelection(view){
    var sel = view && view.selected;
    var p = (sel && sel.kind && sel.instId != null) ? findStructPos(sel.kind, sel.instId) : null;
    if (p){
      selRing.visible = true;
      selRing.position.set(p.x, groundY(p.x, p.z) + 0.3, p.z);
      var s = 1 + 0.07 * Math.sin(time * 4);
      selRing.scale.set(s, s, 1);
    } else selRing.visible = false;
    var hc = view && view.hoverCell;
    if (!hc && view && view.ghost && view.ghost.cells && view.ghost.cells.length){
      /* bright cell highlight under the placement ghost */
      var gc = view.ghost.cells[0];
      var gx = (gc.cx != null) ? gc.cx : gc.x, gz = (gc.cz != null) ? gc.cz : gc.z;
      if (gx != null && gz != null) hc = { x: gx, z: gz };
    }
    if (hc && hc.x != null){
      var wx = (hc.x + 0.5) * CELL, wz = (hc.z + 0.5) * CELL;
      hoverBox.visible = true;
      hoverBox.position.set(wx, groundY(wx, wz) + 0.15, wz);
    } else hoverBox.visible = false;
  }

  var lastEnemies = [];

  function updateFocus(view){
    var fid = view && view.focusId;
    if (fid == null){ focusMark.visible = false; return; }
    var fx = null, fz = null;
    for (var i = 0; i < lastEnemies.length; i++){
      var e = lastEnemies[i];
      if (e && e.id === fid){ fx = e.x; fz = e.z; break; }
    }
    for (var bk in bosses){
      if (bosses[bk].id === fid){
        fx = bosses[bk].group.position.x; fz = bosses[bk].group.position.z; break;
      }
    }
    if (fx == null){ focusMark.visible = false; return; }
    focusMark.visible = true;
    var gy = groundY(fx, fz);
    focusMark.position.set(fx, gy + 3.4 + Math.sin(time * 5) * 0.35, fz);
    focusMark.rotation.y = time * 2.4;
    var s = 1 + 0.25 * Math.sin(time * 6);
    focusMark.scale.set(s, s, s);
    focusMark.material.opacity = 0.65 + 0.3 * Math.sin(time * 6);
  }

  r.pickEnemy = function(clientX, clientY){
    if (!inited || !lastEnemies.length) return null;
    var g = r.screenToGround(clientX, clientY);
    if (!g) return null;
    var thresh = clamp(2.2 * cam.dist / 55, 1.6, 5.5);
    var best = null, bestD = thresh * thresh;
    for (var i = 0; i < lastEnemies.length; i++){
      var e = lastEnemies[i];
      if (!e) continue;
      var dx = e.x - g.x, dz = e.z - g.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < bestD){ bestD = d2; best = e.id; }
    }
    return best;
  };

  /* ================= cinematic name banner ================= */
  function buildCineSprite(){
    cineCanvas = document.createElement('canvas');
    cineCanvas.width = 512; cineCanvas.height = 128;
    cineCtx = cineCanvas.getContext('2d');
    cineTex = new THREE.CanvasTexture(cineCanvas);
    cineSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cineTex, transparent: true,
      depthWrite: false, depthTest: false }));
    cineSprite.scale.set(22, 5.5, 1);
    cineSprite.visible = false;
    cineSprite.renderOrder = 999;
    scene.add(cineSprite);
  }

  function drawCineName(name){
    var ctx = cineCtx;
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffb347';
    ctx.fillText(String(name || '').toUpperCase().slice(0, 24), 256, 52);
    ctx.shadowBlur = 0;
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#ff7a3a';
    ctx.fillText('RUST SIGNATURE DETECTED', 256, 100);
    cineTex.needsUpdate = true;
  }

  function applyCinematic(view){
    var cine = view && view.cinematic;
    if (cine && cine.t !== lastCineT){
      lastCineT = cine.t;
      r.camera.cinematicTo(num(cine.x, cam.tx), num(cine.z, cam.tz), 30, 2.4, 68);
      drawCineName(cine.name);
      cineSprite.visible = true;
    } else if (!cine){
      cineSprite.visible = false;
    }
    if (cineSprite.visible && cine){
      cineSprite.position.set(num(cine.x, cam.tx), 17, num(cine.z, cam.tz));
    }
  }

  /* ================= props: barrels, crates, engineer, toy robot ================= */
  var propsGroup = null, propBlinkers = [], heroEng = null, heroTool = null;

  function buildProps(){
    propsGroup = new THREE.Group();
    scene.add(propsGroup);
    /* one tasteful static easter egg: tiny rusted toy robot, half-buried near the spire */
    var toy = new THREE.Group();
    var toyRust = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.85, metalness: 0.4 });
    var tb = box(0.34, 0.42, 0.26, toyRust, 0, 0.12, 0);
    tb.rotation.z = 0.35;
    toy.add(tb);
    var th = cyl(0.14, 0.14, 0.2, toyRust, 0.1, 0.42, 0, 8);
    th.rotation.z = 0.5;
    toy.add(th);
    var ta = cyl(0.02, 0.02, 0.3, toyRust, 0.16, 0.62, 0, 5);
    toy.add(ta);
    toy.position.set(hqPos.x + 5.2, 0, hqPos.z + 3.4);
    toy.rotation.y = 0.8;
    propsGroup.add(toy);
    toy.userData.isToy = true;
    /* hero engineer (hidden until snapshot.hero) */
    heroEng = new THREE.Group();
    var engModel = null;
    try {
      var ML3 = (globalThis.NB && NB.ModelLib) || null;
      engModel = ML3 ? ML3.structureModel('engineer') : null;
    } catch (e){ engModel = null; }
    if (engModel && engModel.group){
      heroEng.add(engModel.group);
    } else {
      var hb = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.6, 3, 8),
        new THREE.MeshStandardMaterial({ color: 0xb36a1f, roughness: 0.7 }));
      hb.position.y = 0.66;
      heroEng.add(hb);
      var hh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), darkMetal);
      hh.position.y = 1.32;
      heroEng.add(hh);
    }
    heroTool = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x54e8ff }));
    heroTool.position.set(0.35, 0.9, 0.1);
    heroTool.rotation.z = 0.5;
    heroEng.add(heroTool);
    heroEng.visible = false;
    scene.add(heroEng);
  }

  function barrelMesh(){
    var g = new THREE.Group();
    var rust = new THREE.MeshStandardMaterial({ color: 0x6e3a24, roughness: 0.75, metalness: 0.45 });
    var bmodel = null;
    try {
      var ML = (globalThis.NB && NB.ModelLib) || null;
      bmodel = ML ? ML.structureModel('barrel') : null;
    } catch (e){ bmodel = null; }
    var lampY = 1.42;
    if (bmodel && bmodel.group){
      g.add(bmodel.group);
      lampY = (bmodel.height || 1.4) + 0.12;
    } else {
      g.add(cyl(0.55, 0.55, 1.3, rust, 0, 0.65, 0, 10));
      var bandm = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 14), darkMetal);
      bandm.rotation.x = Math.PI / 2; bandm.position.y = 0.95;
      g.add(bandm);
    }
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    lamp.position.y = lampY;
    g.add(lamp);
    g.userData.lamp = lamp;
    return g;
  }

  function crateMesh(){
    var g = new THREE.Group();
    var cmodel = null;
    try {
      var ML2 = (globalThis.NB && NB.ModelLib) || null;
      cmodel = ML2 ? ML2.structureModel('crate') : null;
    } catch (e){ cmodel = null; }
    var glowY = 1.18, glowS = 1.18;
    if (cmodel && cmodel.group){
      g.add(cmodel.group);
      glowY = (cmodel.height || 1.2) + 0.06;
      glowS = 1.0;
    } else {
      g.add(box(1.15, 1.15, 1.15, new THREE.MeshStandardMaterial({ color: 0x3d3a2e, roughness: 0.8 }), 0, 0.58, 0));
    }
    var glow = new THREE.Mesh(new THREE.BoxGeometry(glowS, 0.12, glowS),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    glow.position.y = glowY;
    g.add(glow);
    return g;
  }

  var propReg = {};

  function updateProps(snap, dt){
    var list = arr(snap && snap.props);
    /* decorative barrels near the spire */
    var want = {};
    for (var dI = 0; dI < 3; dI++){
      var dk = 'dec-barrel-' + dI;
      want[dk] = { kind: 'barrel', x: hqPos.x - 6 + dI * 1.7, z: hqPos.z + 6.5 };
    }
    for (var i = 0; i < list.length; i++){
      var p = list[i];
      if (p && (p.kind === 'barrel' || p.kind === 'crate') && p.x != null)
        want['p' + i] = p;
    }
    for (var k in propReg){
      if (!want[k]){ propsGroup.remove(propReg[k].group); delete propReg[k]; }
    }
    propBlinkers.length = 0;
    for (var k2 in want){
      var w = want[k2];
      var e = propReg[k2];
      if (!e){
        var g = w.kind === 'crate' ? crateMesh() : barrelMesh();
        propsGroup.add(g);
        e = propReg[k2] = { group: g, kind: w.kind };
      }
      var gy = groundY(w.x, w.z);
      e.group.position.set(w.x, gy, w.z);
      if (e.group.userData.lamp) propBlinkers.push(e.group.userData.lamp);
    }
    for (var bI = 0; bI < propBlinkers.length; bI++){
      propBlinkers[bI].visible = Math.sin(time * 4 + bI * 1.7) > 0;
    }
    /* hero engineer */
    var hero = snap && snap.hero;
    if (hero && hero.x != null){
      heroEng.visible = true;
      var hx = num(hero.x, hqPos.x), hz = num(hero.z, hqPos.z);
      heroEng.position.set(hx, groundY(hx, hz) + Math.abs(Math.sin(time * 7)) * 0.06, hz);
      heroEng.rotation.y = Math.sin(time * 0.6) * 1.2;
      heroTool.material.color.setHex(Math.sin(time * 8) > 0 ? 0x54e8ff : 0x1a6a7a);
    } else heroEng.visible = false;
  }

  /* ================= events -> VFX ================= */
  function handleEvent(e){
    if (!e || !e.t) return;
    var x = num(e.x, hqPos.x), z = num(e.z, hqPos.z);
    var gy = groundY(x, z);
    switch (e.t){
      case 'boom': {
        var n = num(e.n, 8);
        var big = n >= 18;
        spawnBurst(x, gy + 1, z, { count: 10 + n, color: e.color || '#ff9f43',
          speed: big ? 14 : 9, life: big ? 1.0 : 0.7, size: big ? 4 : 3, up: 8 });
        spawnPuff(x, gy + 1.5, z, { count: big ? 8 : 4, life: 1.6, size: 5.5 });
        spawnRing(x, z, { color: e.color || '#ff9f43', maxR: big ? 14 : 7, life: big ? 0.9 : 0.6 });
        spawnCrater(x, z, big ? 7 : 4.5);
        spawnDebris(x, gy + 1, z, { count: n <= 8 ? 4 : 6, color: e.color || '#5a4a3c',
          speed: big ? 10 : 7, life: big ? 1.6 : 1.2, size: big ? 1.1 : 0.7 });
        /* radial impulse: the blast shoves nearby debris outward (juice) */
        if (debrisSys) debrisSys.kick(x, z, big ? 14 : 8, big ? 16 : 9);
        /* cinematic: fireball flash light + electrical discharge arcs */
        try {
          if (NB.Cine){
            NB.Cine.blastFlash(x, gy + 1, z, big);
            if (big){
              for (var arcI = 0; arcI < 3; arcI++){
                var aa = Math.random() * 6.2832;
                NB.Cine.arc(x, gy + 0.6, z,
                  x + Math.cos(aa) * (6 + Math.random() * 4), gy + 0.6,
                  z + Math.sin(aa) * (6 + Math.random() * 4), 0xffc37a);
              }
            }
          }
        } catch (e){}
        if (big) r.camera.addTrauma(0.45);
        break;
      }
      case 'announce':
        spawnBurst(hqPos.x, groundY(hqPos.x, hqPos.z) + 15, hqPos.z,
          { count: 22, color: e.color || '#7df9ff', speed: 6, life: 1.1, size: 2.6, up: 7 });
        break;
      case 'wallHit':
        spawnBurst(x, gy + 1.2, z, { count: 3 + num(e.n, 3), color: e.color || '#ffb347',
          speed: 6, life: 0.45, size: 2.2, up: 4 });
        spawnDebris(x, gy + 1.2, z, { count: 2, color: '#6a625a', speed: 4,
          life: 0.9, size: 0.45 });
        /* impact glint: hot spark flash on the wall face */
        try { if (NB.Cine) NB.Cine.impactSpark(x, gy + 1.4, z); } catch (e2){}
        break;
      case 'structureDown':
        spawnBurst(x, gy + 1.5, z, { count: 30, color: e.color || '#ff7744',
          speed: 12, life: 0.9, size: 3.4, up: 8 });
        spawnPuff(x, gy + 2, z, { count: 10, life: 2, size: 6.5 });
        spawnRing(x, z, { color: '#ff9f43', maxR: 12, life: 0.8 });
        spawnDebris(x, gy + 1.5, z, { count: 5, color: '#5a4a3c', speed: 9, life: 1.5, size: 1.0 });
        if (debrisSys) debrisSys.kick(x, z, 12, 13);
        spawnCrater(x, z, 6);
        /* cinematic: big flash + discharge arcs crawling outward */
        try {
          if (NB.Cine){
            NB.Cine.blastFlash(x, gy + 1.5, z, true);
            for (var sdI = 0; sdI < 2; sdI++){
              var sa = Math.random() * 6.2832;
              NB.Cine.arc(x, gy + 0.6, z,
                x + Math.cos(sa) * 8, gy + 0.6, z + Math.sin(sa) * 8, 0x9fdcff);
            }
          }
        } catch (e){}
        r.camera.addTrauma(0.45);
        break;
      case 'gold':
        spawnBurst(x, gy + 1, z, { count: 6, color: '#ffd34d', speed: 2.5, life: 0.7, size: 2, up: 6 });
        break;
      default:
        break;
    }
  }

  /* ================= environment: surge, day/dusk ================= */
  function updateEnvironment(snap, dt){
    var s = (snap && snap.surge) || {};
    var active = surgeManual.active || !!s.active;
    var warn = num(s.warningIn, 0);
    var I = active ? (surgeManual.active ? surgeManual.i : 0.85) : 0;
    var dens = envFogDensity + I * 0.024;
    scene.fog.density += (dens - scene.fog.density) * Math.min(1, dt * 3);
    if (!active && warn > 0)
      _c1.copy(fogBase).lerp(fogSurge, 0.3 + 0.22 * Math.sin(time * 7));
    else
      _c1.copy(fogBase).lerp(fogSurge, I * (0.55 + 0.45 * Math.sin(time * 2.5)));
    scene.fog.color.copy(_c1);
    /* cheap subtle day/dusk shift across waves, relative to the sector's sun */
    var wv = num(snap && snap.waveIndex, 0);
    var warm = 0.5 + 0.5 * Math.sin((wv % 4) / 4 * 6.2832);
    if (envSunColor) sun.color.copy(envSunColor).lerp(_c2.setHex(0x9ab8ff), (1 - warm) * 0.35);
    else sun.color.setHex(0xffd9a0).lerp(_c2.setHex(0x9ab8ff), (1 - warm) * 0.35);
    /* aurora shimmer */
    for (var ai = 0; ai < auroraMats.length; ai++)
      auroraMats[ai].uniforms.uTime.value = time;
    /* base lights scaled by the brightness slider every frame (init values
       alone would be clobbered here); surge dims from there. */
    var bv = 0.55 + 0.45 * brightnessV;
    sun.intensity = baseSun * bv * (1 - I * 0.55);
    hemi.intensity = baseHemi * bv * (1 - I * 0.3);
    updateArcs(dt, I);
    updateAsh(dt, I);
    return I;
  }

  function resolveHq(sim, snap){
    var hx = null, hz = null;
    if (snap.hq && snap.hq.x != null){ hx = num(snap.hq.x, 0); hz = num(snap.hq.z, 0); }
    else if (snap.hqCell){ hx = (num(snap.hqCell.x, 0) + 1) * CELL; hz = (num(snap.hqCell.z, 0) + 1) * CELL; }
    var sector = (sim && sim.sector) || snap.sector || {};
    if (hx == null && sector.hq){
      hx = (num(sector.hq.x, 0) + 1) * CELL;
      hz = (num(sector.hq.z, 0) + 1) * CELL;
    }
    hqPos.x = hx == null ? W / 2 : hx;
    hqPos.z = hz == null ? H / 2 : hz;
  }

  /* IRA display mode for briefings */
  var iraMode = 'small';
  r.showIra = function(size){
    iraMode = (size === 'large') ? 'large' : (size === 'hidden' ? 'hidden' : 'small');
  };

  /* slow-mo support: game sets r.timeScale (e.g. 0.25 on boss death) */
  r.timeScale = 1;

  var camInit = false;

  /* ================= main draw ================= */
  r.draw = function(sim, view, dt){
    if (!inited) return;
    frameNo++;
    dt = clamp(num(dt, 1 / 60), 0.0001, 0.1);
    /* adaptive quality governor: rolling FPS steps tiers with hysteresis */
    try { if (perfGov) perfGov.update(dt); } catch (e){}
    var sdt = dt * num(r.timeScale, 1);
    time += sdt;
    view = view || {};

    var snap = null;
    if (sim && typeof sim.snapshot === 'function'){
      try { snap = sim.snapshot(); } catch (e) { snap = null; }
    }
    if (snap) lastSnap = snap;
    else snap = lastSnap;
    if (!snap){
      try { if (NB.Cine) NB.Cine.render(); else renderer.render(scene, camera3); } catch (e) {}
      return;
    }

    if (sim && typeof sim.heightAt === 'function'){
      var simRef = sim;
      heightFn = function(x, z){ return simRef.heightAt(x, z); };
    } else heightFn = null;

    resolveHq(sim, snap);
    if (!camInit){ camInit = true; r.camera.reset(hqPos.x, hqPos.z); }

    uplinkR = num(snap.uplinkRadius, 9);
    var sector = (sim && sim.sector) || snap.sector || {};
    refreshSector(sector);
    applyHeightField();
    if (Math.abs(uplinkR - texUplinkR) > 1){
      texUplinkR = uplinkR;
      paintGround(sector.blocked, sector.gates);
    }

    var evs = [];
    try {
      if (sim && typeof sim.drainEvents === 'function') evs = sim.drainEvents() || [];
      else if (sim && Array.isArray(sim.events) && sim.events.length){
        evs = sim.events.slice();
        sim.events.length = 0;
      }
    } catch (e) {}
    for (var ei = 0; ei < evs.length; ei++){
      handleEvent(evs[ei]);
      if (r.eventListener){
        try { r.eventListener(evs[ei]); } catch (e2) {}
      }
    }

    lastEnemies = arr(snap.enemies);

    updateSpire(snap, sdt, 0);
    setSpireTier(num(snap.spireTier, 0), playerColor(snap, (snap.spireOwner != null) ? snap.spireOwner : 'p0'));
    updateTowers(snap, sdt);
    updateWalls(snap, sdt);
    updateReactors(snap, sdt);
    updateEnemies(snap, sdt);
    updateProjectiles(snap, sdt);
    updateBeams(snap);

    poolUpdate(sparks, sdt);
    poolUpdate(smoke, sdt);
    updateDebris(sdt);
    updateRings(sdt);
    updateFlash(sdt);
    try { if (NB.Cine) NB.Cine.update(sdt); } catch (e){}

    var surgeI = updateEnvironment(snap, sdt);
    updateUplinkFx(view, sdt);
    updateIRA(view, sdt);
    updateColonists(sdt);
    updateProps(snap, sdt);
    updateGhost(view);
    updateSelection(view);
    updateFocus(view);
    applyCinematic(view);

    /* spire hit proxy (invisible) */
    var R = spireRefs;
    if (!R.hit) R.hit = makeHitMesh('hq', 'hq', 4.5, 15);
    R.hit.position.set(hqPos.x, groundY(hqPos.x, hqPos.z) + 7, hqPos.z);

    /* rebuild pick registry */
    hitPool.length = 0;
    var tk;
    for (tk in towers) hitPool.push(towers[tk].hit);
    for (tk in reactors) hitPool.push(reactors[tk].hit);
    hitPool.push(R.hit);

    updateCamera(sdt);
    try { if (NB.Cine) NB.Cine.render(); else renderer.render(scene, camera3); } catch (e) {}
  };

  return r;
};

})();
