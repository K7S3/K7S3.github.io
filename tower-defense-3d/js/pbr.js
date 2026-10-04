/* Nova Bastion 3D - PBR material tuning for loaded GLB templates.
 *
 * The KayKit models arrive with baked vertex colors and generic materials.
 * tuneTemplate() walks a template group ONCE at load time and retunes every
 * mesh material by classifying its average color:
 *   glow   (bright + saturated, e.g. windows, lamps, energy cores) -> strong
 *            emissive so it feeds the bloom pass
 *   metal  (dark neutral grays) -> high metalness, mid roughness
 *   paint  (everything else)    -> dielectric, satin roughness
 * A shared procedural roughness-variation texture kills the flat uniform look.
 * Templates are cloned per instance after tuning, so clones inherit the PBR.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }

var _roughTex = null;
function roughnessTexture(){
  if (_roughTex) return _roughTex;
  var THREE = globalThis.THREE;
  var s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  var ctx = cv.getContext('2d');
  var img = ctx.createImageData(s, s);
  /* value noise: a few octaves of random blotches, blurred by scaling */
  var seed = 1234567;
  function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var oct = [];
  for (var o = 0; o < 4; o++){
    var n = 8 << o, grid = new Float32Array(n * n);
    for (var i = 0; i < n * n; i++) grid[i] = rnd();
    oct.push({ n: n, grid: grid, amp: 1 / (o + 1) });
  }
  for (var y = 0; y < s; y++){
    for (var x = 0; x < s; x++){
      var v = 0, ampSum = 0;
      for (var k = 0; k < oct.length; k++){
        var oc = oct[k], gx = x / s * oc.n, gy = y / s * oc.n;
        var x0 = Math.floor(gx) % oc.n, y0 = Math.floor(gy) % oc.n;
        var x1 = (x0 + 1) % oc.n, y1 = (y0 + 1) % oc.n;
        var fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
        var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        var g00 = oc.grid[y0 * oc.n + x0], g10 = oc.grid[y0 * oc.n + x1];
        var g01 = oc.grid[y1 * oc.n + x0], g11 = oc.grid[y1 * oc.n + x1];
        v += ((g00 * (1 - sx) + g10 * sx) * (1 - sy) + (g01 * (1 - sx) + g11 * sx) * sy) * oc.amp;
        ampSum += oc.amp;
      }
      v /= ampSum; /* 0..1 */
      /* map to a roughness multiplier band 0.75..1.25 */
      var m = 0.75 + v * 0.5;
      var idx = (y * s + x) * 4;
      var b = Math.max(0, Math.min(255, Math.round(m * 255)));
      img.data[idx] = b; img.data[idx + 1] = b; img.data[idx + 2] = b; img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  var tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _roughTex = tex;
  return tex;
}

/* Pure classifier: average linear-ish color -> material bucket. */
function classify(r, g, b){
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  var sat = mx > 0.001 ? (mx - mn) / mx : 0;
  if (lum > 0.55 && sat > 0.35) return 'glow';
  /* hot reds/oranges read dim by luminance but are clearly lights */
  if (mx > 0.8 && sat > 0.5) return 'glow';
  if (sat < 0.22 && lum < 0.5) return 'metal';
  return 'paint';
}

/* Average vertex color of a geometry (stride-sampled). Falls back to
 * material.color when there is no color attribute. */
function avgColor(geo, matColor){
  var r = 1, g = 1, b = 1, n = 0;
  try {
    var attr = geo && geo.attributes && geo.attributes.color;
    if (attr && attr.count > 0){
      var arr = attr.array, stride = Math.max(1, Math.floor(attr.count / 64));
      var sr = 0, sg = 0, sb = 0, c = 0;
      for (var i = 0; i < attr.count; i += stride){
        sr += arr[i * 3]; sg += arr[i * 3 + 1]; sb += arr[i * 3 + 2]; c++;
      }
      if (c > 0){ r = sr / c; g = sg / c; b = sb / c; n = c; }
    } else if (matColor){ r = matColor.r; g = matColor.g; b = matColor.b; n = 1; }
  } catch (e){}
  return { r: r, g: g, b: b, n: n };
}

var _tuned = {}; /* material.uuid -> true (per template walk) */

function tuneMaterial(mat, cls, avg){
  if (!mat || mat.isMeshStandardMaterial !== true) return;
  if (_tuned[mat.uuid]) return;
  _tuned[mat.uuid] = true;
  try {
    if (cls === 'glow'){
      mat.emissive = mat.emissive || new (globalThis.THREE.Color)(0xffffff);
      mat.emissive.setRGB(avg.r, avg.g, avg.b);
      /* restrained: reads as "lit" and kisses the bloom threshold,
         without turning painted accents into lightbulbs */
      mat.emissiveIntensity = 1.35;
      mat.metalness = 0.0;
      mat.roughness = 0.4;
      mat.toneMapped = true;
    } else if (cls === 'metal'){
      mat.metalness = 0.9;
      mat.roughness = 0.38;
      mat.roughnessMap = roughnessTexture();
      mat.envMapIntensity = 1.25;
    } else {
      mat.metalness = 0.08;
      mat.roughness = 0.55;
      mat.roughnessMap = roughnessTexture();
      mat.envMapIntensity = 0.9;
    }
    mat.needsUpdate = true;
  } catch (e){}
}

/* Walk a loaded template group once; retune every mesh material. */
function tuneTemplate(group){
  if (!group) return 0;
  var THREE = globalThis.THREE;
  if (!THREE) return 0;
  var count = 0;
  try {
    group.traverse(function(o){
      if (!o.isMesh || !o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      for (var i = 0; i < mats.length; i++){
        var m = mats[i];
        if (!m || m.isMeshStandardMaterial !== true) continue;
        if (_tuned[m.uuid]) continue;
        var avg = avgColor(o.geometry, m.color);
        tuneMaterial(m, classify(avg.r, avg.g, avg.b), avg);
        count++;
      }
    });
  } catch (e){}
  return count;
}

/* Single-material tune for the merged swarm-enemy geometry (vertexColors).
 * One material serves the whole merged body, so we pick a mid "armored
 * machine" response instead of per-part buckets. */
function tuneEnemyMaterial(mat){
  if (!mat) return;
  try {
    mat.metalness = 0.35;
    mat.roughness = 0.5;
    mat.roughnessMap = roughnessTexture();
    mat.envMapIntensity = 1.0;
    mat.needsUpdate = true;
  } catch (e){}
}

NB.PBR = {
  classify: classify,
  tuneTemplate: tuneTemplate,
  tuneEnemyMaterial: tuneEnemyMaterial,
  roughnessTexture: roughnessTexture,
  /* test hook */
  _reset: function(){ _tuned = {}; _roughTex = null; }
};

})();
