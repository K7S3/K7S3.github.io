/* Nova Bastion 3D - pure-math 3D picking (no THREE, no DOM).
 *
 * Root cause of the "towers place randomly" bug: screenToGround intersected
 * the picking ray with the y=0 plane, but the visible terrain has real
 * elevation (sim hills up to 2.5 world units). Clicking a hilltop therefore
 * resolved ~2 cells past the aimed point, and the error shifted with camera
 * angle, so placement felt random. (A second bug: the ghost preview read
 * c.x/c.z while game.js writes cx/cz, pinning the ghost at the map corner.)
 *
 * rayGroundHit sphere-traces the ray against the actual height field and
 * returns the FIRST (visible) intersection, so the picked point matches the
 * surface the player sees. render3d.js feeds it its own groundY, the exact
 * height function used to displace the visible ground mesh.
 *
 * Headless-testable: js/tests/placement-check.js exercises this against the
 * real sim heightAt with an independent camera projection implementation.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }

/* Build a camera ray from NDC coords.
 * cam: {px,py,pz} eye, {tx,ty,tz} lookAt target, fovDeg, aspect.
 * Mirrors THREE.PerspectiveCamera.unproject for a perspective camera.
 * Returns {ox,oy,oz,dx,dy,dz} with a normalized direction. */
function ndcToRay(nx, ny, cam){
  var px = num(cam.px, 0), py = num(cam.py, 50), pz = num(cam.pz, 0);
  var tx = num(cam.tx, 0), ty = num(cam.ty, 0), tz = num(cam.tz, 0);
  var fov = num(cam.fovDeg, 52) * Math.PI / 180;
  var aspect = num(cam.aspect, 16 / 9);
  var fx = tx - px, fy = ty - py, fz = tz - pz;
  var fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  /* right = normalize(cross(fwd, up(0,1,0))) = (-fz, 0, fx) */
  var rx = -fz, ry = 0, rz = fx;
  var rl = Math.sqrt(rx * rx + rz * rz) || 1;
  rx /= rl; rz /= rl;
  /* upv = cross(right, fwd) */
  var ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  var th = Math.tan(fov / 2);
  var sx = nx * th * aspect, sy = ny * th;
  var dx = fx + rx * sx + ux * sy;
  var dy = fy + ry * sx + uy * sy;
  var dz = fz + rz * sx + uz * sy;
  var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return { ox: px, oy: py, oz: pz, dx: dx / dl, dy: dy / dl, dz: dz / dl };
}

/* First intersection of a ray with a height field.
 * (ox,oy,oz) origin, (dx,dy,dz) direction (normalized internally),
 * groundY(x,z) -> height (must match the visible surface).
 * Returns {x, z} of the visible hit, or null when the ray never goes down
 * into terrain (sky / horizontal).
 *
 * Sphere tracing: f(t) = rayY(t) - groundY(t) has |df/dt| <= |dy| +
 * MAX_SLOPE * hSpeed, so stepping f/rate can never skip over the zero.
 * A fixed-step march is NOT enough here: near-tangent rays over a rounded
 * hilltop produce a dip in f(t) narrower than any reasonable fixed step,
 * and the march would report the far side of the hill instead of the
 * visible crest. A plain fixed-point iteration from the y=0 plane is even
 * worse: it can converge to the far side of a hill.
 *
 * MAX_SLOPE bound: sector hills peak at h=3, r=2.5, whose cosine falloff
 * has max gradient h*pi/(2r) ~= 1.9; the bilinear smoothing keeps the same
 * order. 4 is a ~2x safety margin. If a future sector ships steeper hills,
 * raise this (placement-check.js asserts the empirical max slope < 3.5). */
var MAX_SLOPE = 4;

function rayGroundHit(ox, oy, oz, dx, dy, dz, groundY){
  if (typeof groundY !== 'function') groundY = function(){ return 0; };
  var dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(dl > 0)) return null;
  dx /= dl; dy /= dl; dz /= dl;
  if (!(dy < -1e-7)) return null;               /* sky or horizontal */
  var tMax = (oy + 4) / (-dy);                  /* give up below y = -4 */
  if (!(tMax > 0)) return null;
  function gy(x, z){
    var v = groundY(x, z);
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }
  var hSpeed = Math.sqrt(dx * dx + dz * dz);
  var rate = (-dy) + MAX_SLOPE * hSpeed;
  var t = 0, tPrev = 0;
  var f = oy - gy(ox, oz);
  if (f <= 0) return { x: ox, z: oz };          /* origin inside terrain */
  for (var i = 0; i < 500; i++){
    var step = f / rate;
    if (step < 1e-4) step = 1e-4;              /* creep up to grazing hits */
    tPrev = t;
    t += step;
    if (t > tMax) return null;
    f = (oy + dy * t) - gy(ox + dx * t, oz + dz * t);
    if (f <= 0){
      var a = tPrev, b = t, m, fm, k;          /* refine the bracket */
      for (k = 0; k < 12; k++){
        m = (a + b) / 2;
        fm = (oy + dy * m) - gy(ox + dx * m, oz + dz * m);
        if (fm <= 0) b = m; else a = m;
      }
      var th = (a + b) / 2;
      return { x: ox + dx * th, z: oz + dz * th };
    }
    if (f < 1e-3 && step <= 1e-4){
      /* grazing contact: the ray skims the crest; report the skim point */
      return { x: ox + dx * t, z: oz + dz * t };
    }
  }
  return null;
}

NB.Pick = { ndcToRay: ndcToRay, rayGroundHit: rayGroundHit,
              smoothSample: smoothSample };

/* Bilinear smoothing of a staircase height field (e.g. sim.heightAt, which
 * is constant per cell). Samples the source at cell centers and
 * interpolates, so the result is C0-continuous, equals the source exactly
 * at cell centers, and tracks the GPU-interpolated ground mesh far better
 * than the raw staircase (whose vertical steps at cell borders would
 * otherwise throw picking off by up to a cell at grazing angles).
 * render3d.js routes its groundY through this so picking agrees with the
 * visible surface. Gameplay (flow field, high-ground bonus) keeps using the
 * discrete cell heights; this is visuals/picking only. */
function smoothSample(stairFn, cell, x, z){
  cell = num(cell, 2);
  function H(cx, cz){
    var v = stairFn((cx + 0.5) * cell, (cz + 0.5) * cell);
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }
  var fx = x / cell - 0.5, fz = z / cell - 0.5;
  var cx0 = Math.floor(fx), cz0 = Math.floor(fz);
  var tx = fx - cx0, tz = fz - cz0;
  var h00 = H(cx0, cz0), h10 = H(cx0 + 1, cz0);
  var h01 = H(cx0, cz0 + 1), h11 = H(cx0 + 1, cz0 + 1);
  var a = h00 + (h10 - h00) * tx, b = h01 + (h11 - h01) * tx;
  return a + (b - a) * tz;
}

})();
