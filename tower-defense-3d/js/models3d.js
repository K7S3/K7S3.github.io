/* Nova Bastion 3D - external model library (CC0 GLBs).
 *
 * Loads proper 3D models for towers, enemies and structures, replacing the
 * code-built primitives. Everything is optional: if a model is missing or
 * fails to load, the game falls back to the primitive builders and keeps
 * working. See assets/models/CREDITS.md for sources and licenses.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }

/* logical name -> { file, size }: size = target max dimension in world units */
var MANIFEST = {
  /* towers */
  tower_pulse:   { file: 'pulse_turret.glb',   size: 3.4 },
  tower_frost:   { file: 'cryo_projector.glb', size: 3.4 },
  tower_arc:     { file: 'tesla_coil.glb',     size: 4.2 },
  tower_mortar:  { file: 'mortar.glb',         size: 3.6 },
  tower_sniper:  { file: 'sniper_nest.glb',    size: 5.2 },
  tower_chrono:  { file: 'stasis_pylon.glb',   size: 4.0 },
  tower_mint:    { file: 'fabricator.glb',     size: 3.4 },
  tower_amplify: { file: 'uplink_dish.glb',    size: 4.0 },
  /* structures */
  struct_wall:     { file: 'wall_segment.glb',   size: 2.2 },
  struct_spire:    { file: 'command_spire.glb',  size: 14 },
  struct_reactor:  { file: 'reactor.glb',        size: 3.2 },
  struct_barrel:   { file: 'fuel_barrel.glb',    size: 1.4 },
  struct_crate:    { file: 'supply_crate.glb',   size: 1.6 },
  struct_colonist: { file: 'colonist.glb',       size: 1.8 },
  struct_engineer: { file: 'engineer.glb',       size: 1.8 },
  /* enemies */
  enemy_drone:        { file: 'scout_drone.glb',   size: 1.7 },
  enemy_runner:       { file: 'skitter.glb',       size: 1.7 },
  enemy_swarmling:    { file: 'swarm_mite.glb',    size: 1.0 },
  enemy_tank:         { file: 'siege_walker.glb',  size: 3.0 },
  enemy_shieldbearer: { file: 'aegis_bot.glb',     size: 2.2 },
  enemy_phantom:      { file: 'wraith.glb',        size: 2.0 },
  enemy_medic:        { file: 'repair_drone.glb',  size: 1.8 },
  enemy_splitter:     { file: 'splitter.glb',      size: 2.4 },
  enemy_mite:         { file: 'swarm_mite.glb',    size: 0.7 },
  enemy_sapper:       { file: 'sapper.glb',        size: 1.8 },
  enemy_brute:        { file: 'juggernaut.glb',    size: 3.6 },
  enemy_dreadnought:  { file: 'dreadnought.glb',   size: 7 },
  enemy_overmind:     { file: 'overmind.glb',      size: 8 },
  enemy_leviathan:    { file: 'leviathan.glb',     size: 10 }
};

var TOWER_IDS = ['pulse','frost','arc','mortar','sniper','chrono','mint','amplify'];
var ENEMY_TYPES = ['drone','runner','swarmling','tank','shieldbearer','phantom',
  'medic','splitter','mite','sapper','brute','dreadnought','overmind','leviathan'];

var BASE = 'assets/models/';

var Lib = {
  manifest: MANIFEST,
  _templates: {},   /* name -> THREE.Group template */
  _templateMeta: {}, /* name -> { height } (plain data, clone-safe) */
  _bossNames: { enemy_dreadnought: 1, enemy_overmind: 1, enemy_leviathan: 1 },
  _enemyGeo: {},    /* enemy type -> merged BufferGeometry */
  _failed: {},      /* name -> true */
  _done: false,
  _started: false,

  has: function(name){ return !!this._templates[name]; },
  enemyReady: function(type){ return !!this._enemyGeo[type]; },

  /* Merge every mesh of a loaded GLB scene into ONE geometry with baked
     vertex colors. Rigid, no skinning. No normalization; returns null on
     failure. See mergeModel for the normalized variant. */
  mergeSceneRaw: function(glbScene){
    var THREE = globalThis.THREE;
    if (!THREE) return null;
    try {
      glbScene.updateMatrixWorld(true);
      var parts = [];
      glbScene.traverse(function(o){
        if (!o.isMesh || !o.geometry) return;
        var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        /* bake material color into vertex colors */
        var mat = o.material;
        var col = new THREE.Color(0xffffff);
        try {
          if (mat && !Array.isArray(mat) && mat.color) col.copy(mat.color);
          else if (Array.isArray(mat) && mat[0] && mat[0].color) col.copy(mat[0].color);
        } catch (e){}
        var n = g.attributes.position.count;
        /* If the source geometry already carries baked vertex colors (e.g.
           KayKit GLBs converted with texture colors baked into COLOR_0),
           keep them; otherwise bake the material color. */
        var existing = g.attributes.color;
        if (existing && existing.itemSize === 3 && existing.count === n){
          /* keep as-is */
        } else if (existing && existing.itemSize === 4 && existing.count === n){
          var rgb = new Float32Array(n * 3);
          for (var q = 0; q < n; q++){ rgb[q*3] = existing.array[q*4]; rgb[q*3+1] = existing.array[q*4+1]; rgb[q*3+2] = existing.array[q*4+2]; }
          g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
        } else {
          var carr = new Float32Array(n * 3);
          for (var i = 0; i < n; i++){ carr[i*3] = col.r; carr[i*3+1] = col.g; carr[i*3+2] = col.b; }
          g.setAttribute('color', new THREE.BufferAttribute(carr, 3));
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv){
          g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
        }
        parts.push(g);
      });
      if (!parts.length) return null;
      /* concatenate */
      var total = 0, i;
      for (i = 0; i < parts.length; i++) total += parts[i].attributes.position.count;
      var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3),
          uv = new Float32Array(total * 2), col2 = new Float32Array(total * 3);
      var o3 = 0, o2 = 0;
      for (i = 0; i < parts.length; i++){
        var p = parts[i], c = p.attributes.position.count;
        pos.set(p.attributes.position.array, o3 * 3);
        nor.set(p.attributes.normal.array, o3 * 3);
        uv.set(p.attributes.uv.array, o2 * 2);
        col2.set(p.attributes.color.array, o3 * 3);
        o3 += c; o2 += c;
      }
      var out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      out.setAttribute('color', new THREE.BufferAttribute(col2, 3));
      return out;
    } catch (e){
      return null;
    }
  },
  /* mergeSceneRaw + normalize: center XZ, base at y=0, scale to targetSize. */
  mergeModel: function(glbScene, targetSize){
    var out = this.mergeSceneRaw(glbScene);
    if (!out) return null;
    try {
      out.computeBoundingBox();
      var bb = out.boundingBox, size = new (globalThis.THREE.Vector3)();
      bb.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var sc = num(targetSize, 2) / maxDim;
      var cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      out.translate(-cx, -bb.min.y, -cz);
      out.scale(sc, sc, sc);
      out.computeBoundingBox();
      out.computeBoundingSphere();
      return out;
    } catch (e){ return null; }
  },
  /* Merged geometry for a structure template (already normalized at load). */
  _geometryCache: {},
  geometryFor: function(name){
    if (this._geometryCache[name]) return this._geometryCache[name];
    var t = this._templates[name];
    if (!t) return null;
    var g = this.mergeSceneRaw(t);
    if (g){ g.computeBoundingSphere(); this._geometryCache[name] = g; }
    return g;
  },

  /* Normalize a template group: center XZ, base at y=0, scale to size. */
  normalizeGroup: function(group, targetSize){
    var THREE = globalThis.THREE;
    try {
      var bb = new THREE.Box3().setFromObject(group);
      var size = new THREE.Vector3(); bb.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var s = num(targetSize, 2) / maxDim;
      group.scale.setScalar(s);
      bb = new THREE.Box3().setFromObject(group);
      group.position.x -= (bb.min.x + bb.max.x) / 2;
      group.position.z -= (bb.min.z + bb.max.z) / 2;
      group.position.y -= bb.min.y;
      /* muzzle anchor: top-center of the model (found by name after clone) */
      var muzzle = new THREE.Object3D();
      muzzle.name = '__muzzle';
      muzzle.position.set(0, (bb.max.y - bb.min.y) * 0.92, 0);
      group.add(muzzle);
      return group;
    } catch (e){}
    return group;
  },

  towerModel: function(towerId){
    return this._groupModel('tower_' + towerId);
  },

  bossModel: function(bossType){
    return this._groupModel('enemy_' + bossType);
  },

  _groupModel: function(name){
    var t = this._templates[name];
    if (!t) return null;
    var g = t.clone(true);
    var muzzle = null;
    g.traverse(function(o){ if (!muzzle && o.name === '__muzzle') muzzle = o; });
    var meta = this._templateMeta[name] || {};
    return { group: g, muzzle: muzzle, height: meta.height || 3 };
  },

  enemyGeometry: function(type){
    return this._enemyGeo[type] || null;
  },

  structureModel: function(name){
    var t = this._templates['struct_' + name];
    return t ? t.clone(true) : null;
  },

  /* Preload every manifest entry. Calls onProgress(done,total), then onDone().
     Never rejects: failures fall back to primitives. Timeout forces onDone. */
  preload: function(onProgress, onDone, timeoutMs){
    var self = this;
    if (this._started){ if (onDone && this._done) onDone(); return; }
    this._started = true;
    var THREE = globalThis.THREE;
    var names = Object.keys(MANIFEST);
    var total = names.length, done = 0;
    function tick(){ done++; try { if (onProgress) onProgress(done, total); } catch (e){} if (done >= total) finish(); }
    function finish(){
      if (self._done) return;
      self._done = true;
      try { if (onDone) onDone(); } catch (e){}
    }
    if (!THREE || !THREE.GLTFLoader){
      for (var i = 0; i < total; i++){ self._failed[names[i]] = true; tick(); }
      return;
    }
    var loader = new THREE.GLTFLoader();
    var timedOut = false;
    var timer = setTimeout(function(){
      timedOut = true;
      finish();
    }, num(timeoutMs, 12000));
    names.forEach(function(name){
      var entry = MANIFEST[name];
      try {
        loader.load(BASE + entry.file,
          function(glb){
            if (!timedOut){
              try {
                var scene = glb.scene || (glb.scenes && glb.scenes[0]);
                if (scene){
                  if (name.indexOf('enemy_') === 0 && !self._bossNames[name]){
                    var type = name.slice(6);
                    var geo = self.mergeModel(scene, entry.size);
                    if (geo) self._enemyGeo[type] = geo;
                    else self._failed[name] = true;
                  } else {
                    var grp = self.normalizeGroup(scene, entry.size);
                    /* PBR pass: classify parts (metal / paint / glow) once at
                       load; clones inherit the tuned materials */
                    try { if (NB.PBR) NB.PBR.tuneTemplate(grp); } catch (eP){}
                    self._templates[name] = grp;
                    try {
                      var hbb = new THREE.Box3().setFromObject(grp);
                      var hs = new THREE.Vector3(); hbb.getSize(hs);
                      self._templateMeta[name] = { height: hs.y };
                    } catch (e2){ self._templateMeta[name] = { height: entry.size }; }
                  }
                } else self._failed[name] = true;
              } catch (e){ self._failed[name] = true; }
            }
            tick();
          },
          undefined,
          function(){ self._failed[name] = true; tick(); });
      } catch (e){ self._failed[name] = true; tick(); }
    });
  }
};

NB.ModelLib = Lib;

})();
