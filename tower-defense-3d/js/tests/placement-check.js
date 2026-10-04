/* Placement round-trip regression test.
 *
 * The bug ("towers place randomly"): screenToGround intersected the picking
 * ray with the y=0 plane while the visible terrain has real elevation (sim
 * hills up to 2.5 world units). Aiming at a hilltop resolved 3+ cells past
 * the target, and the error moved with the camera angle, so placement felt
 * random. A second defect pinned the ghost preview at the map corner
 * (render3d read c.x/c.z; game.js writes cx/cz).
 *
 * This test, headless in node:
 *  1. Loads the REAL sim (sector 1, real hills) and uses its real heightAt,
 *     the same function the renderer uses to displace the visible ground.
 *  2. Replicates the game camera exactly (dist 88, polar 58deg, az 0,
 *     lookAt y 2.5, fov 52deg) with an INDEPENDENT projection implementation
 *     (standard perspective + lookAt math, no THREE).
 *  3. legacyPlaneHit: the old y=0-plane algorithm. Asserted to be WRONG on
 *     hills (error > 1 world unit on hilltops) -- this pins the bug: the old
 *     production code fails an accuracy assertion here.
 *  4. NB.Pick round trip: project known terrain points (flat, hilltop,
 *     hillside, edges, corners) to NDC -> rebuild the ray with
 *     NB.Pick.ndcToRay -> NB.Pick.rayGroundHit against sim.heightAt ->
 *     assert hit within 0.15 world units and the cell matches, across many
 *     camera angles / zooms / rotations.
 *  5. Screen-space round trip: cell center -> px -> ray -> hit -> reproject,
 *     assert within 3 px of the original click.
 *  6. Edge cases: sky-pointing and horizontal rays return null.
 *  7. Static checks on render3d.js: screenToGround must use
 *     NB.Pick.rayGroundHit (not the y=0 plane), updateGhost must read cx/cz.
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.NB = globalThis.NB || {};
require('../config.js');
require('../towers.js');
require('../enemies.js');
require('../events.js');
require('../sectors.js');
require('../sim.js');
require('../pick3d.js');

const CELL = 2;
const sim = NB.createSim(NB.SECTORS[0], { seed: 7 });
/* production ground truth: the renderer's groundY routes sim.heightAt
 * (a per-cell staircase) through NB.Pick.smoothSample so picking matches
 * the GPU-interpolated visible mesh. The test uses the exact same path. */
const stairAt = (x, z) => sim.heightAt(x, z);
const heightAt = (x, z) => NB.Pick.smoothSample(stairAt, CELL, x, z);
const toCell = (x, z) => ({ cx: Math.floor(x / CELL), cz: Math.floor(z / CELL) });

/* ---------- independent camera model (mirrors render3d updateCamera) ---------- */
function makeCam(tx, tz, dist, polarDeg, azDeg){
  const pol = polarDeg * Math.PI / 180, az = azDeg * Math.PI / 180;
  const sp = Math.sin(pol);
  const eye = {
    x: tx + dist * sp * Math.sin(az),
    y: dist * Math.cos(pol),
    z: tz + dist * sp * Math.cos(az)
  };
  const tgt = { x: tx, y: 2.5, z: tz };   /* render3d lookAt(tx, 2.5, tz) */
  const fovDeg = 52, aspect = 16 / 9, near = 0.5, far = 900;
  /* view basis, THREE Matrix4.lookAt convention: z = normalize(eye - tgt) */
  let zx = eye.x - tgt.x, zy = eye.y - tgt.y, zz = eye.z - tgt.z;
  const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
  let xx = 1 * zz - 0 * zy, xy = 0 * zx - 0 * zz, xz = 0 * zy - 1 * zx; /* up x z */
  const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const f = 1 / Math.tan(fovDeg * Math.PI / 360);
  const A = (far + near) / (near - far), B = 2 * far * near / (near - far);
  function project(x, y, z){
    const ex = x - eye.x, ey = y - eye.y, ez = z - eye.z;
    const vx = xx * ex + xy * ey + xz * ez;
    const vy = yx * ex + yy * ey + yz * ez;
    const vz = zx * ex + zy * ey + zz * ez;
    const w = -vz;
    if (w <= 0) return null;
    return [(f / aspect * vx) / w, (f * vy) / w];
  }
  const ndcCam = { px: eye.x, py: eye.y, pz: eye.z,
                   tx: tgt.x, ty: tgt.y, tz: tgt.z, fovDeg, aspect };
  return { eye, project, ndcCam };
}

/* sanity: my projection and NB.Pick.ndcToRay agree (ray passes through target) */
{
  const cam = makeCam(64, 40, 88, 58, 0);
  const ndc = cam.project(13, 2.5, 11);
  assert.ok(ndc, 'hilltop projects in front of camera');
  const r = NB.Pick.ndcToRay(ndc[0], ndc[1], cam.ndcCam);
  /* closest approach of ray to the target point must be ~0 */
  const ex = 13 - r.ox, ey = 2.5 - r.oy, ez = 11 - r.oz;
  const t = ex * r.dx + ey * r.dy + ez * r.dz;
  const cxp = r.ox + r.dx * t - 13, cyp = r.oy + r.dy * t - 2.5, czp = r.oz + r.dz * t - 11;
  const miss = Math.hypot(cxp, cyp, czp);
  assert.ok(miss < 1e-9, 'ndcToRay consistent with projection, miss=' + miss);
  console.log('PASS ndcToRay/projection consistency (miss ' + miss.toExponential(1) + ')');
}

/* ---------- the OLD production algorithm (y=0 plane), kept to pin the bug ---------- */
function legacyPlaneHit(ndc, cam){
  const r = NB.Pick.ndcToRay(ndc[0], ndc[1], cam.ndcCam);
  const t = -r.oy / r.dy;
  if (t < 0) return null;
  return { x: r.ox + r.dx * t, z: r.oz + r.dz * t };
}

const hillPts = [
  [13, 11, 'hilltop h=2.5'], [81, 29, 'hill2 h=2.5'], [49, 55, 'hill3 h=2'],
  [17, 11, 'hillside'], [9, 8, 'hill skirt']
];
const flatPts = [
  [65, 41, 'mid flat'], [5, 5, 'corner'], [123, 75, 'far corner'],
  [65, 5, 'north edge'], [101, 61, 'open field']
];

/* 3. legacy must be WRONG on hills (this is the shipped bug) */
{
  const cam = makeCam(64, 40, 88, 58, 0);
  let worst = 0;
  for (const [x, z, name] of hillPts){
    const ndc = cam.project(x, heightAt(x, z), z);
    assert.ok(ndc, name + ' projects');
    const h = legacyPlaneHit(ndc, cam);
    const err = Math.hypot(h.x - x, h.z - z);
    worst = Math.max(worst, err);
    console.log('  legacy ' + name + ': err ' + err.toFixed(2) + ' units');
  }
  assert.ok(worst > 1.0,
    'legacy y=0 algorithm must be off by >1 unit on hills (bug), got ' + worst.toFixed(2));
  console.log('PASS legacy algorithm confirmed broken on hills (worst err ' +
    worst.toFixed(2) + ' units = ' + (worst / CELL).toFixed(1) + ' cells)');
}

/* 4. NB.Pick round trip across cameras x terrain */
{
  /* true when terrain blocks the eye->target segment before the target */
  function segOccluded(cam, x, y, z){
    const dx = x - cam.eye.x, dy = y - cam.eye.y, dz = z - cam.eye.z;
    for (let i = 1; i < 200; i++){
      const t = i / 200;
      if (cam.eye.y + dy * t - heightAt(cam.eye.x + dx * t, cam.eye.z + dz * t) < -0.05)
        return true;
    }
    return false;
  }
  const cams = [];
  for (const az of [0, 45, 90, 180, 270]) cams.push(makeCam(64, 40, 88, 58, az));
  cams.push(makeCam(64, 40, 40, 58, 0));    /* zoomed in */
  cams.push(makeCam(64, 40, 110, 58, 0));   /* zoomed out */
  cams.push(makeCam(64, 40, 88, 30, 20));   /* high angle */
  cams.push(makeCam(64, 40, 88, 75, 200));  /* low grazing angle */
  cams.push(makeCam(20, 60, 70, 55, 130));  /* panned elsewhere */
  let n = 0, nOcc = 0, worst = 0, worstCell = 0;
  for (const cam of cams){
    for (const [x, z, name] of hillPts.concat(flatPts)){
      const y = heightAt(x, z);
      const ndc = cam.project(x, y, z);
      if (!ndc) continue; /* behind camera at this angle */
      if (Math.abs(ndc[0]) > 1 || Math.abs(ndc[1]) > 1) continue; /* off screen */
      const r = NB.Pick.ndcToRay(ndc[0], ndc[1], cam.ndcCam);
      const hit = NB.Pick.rayGroundHit(r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, heightAt);
      assert.ok(hit, 'hit for ' + name);
      if (segOccluded(cam, x, y, z)){
        /* the aimed point is behind a hill: the click must land on the
         * nearer visible surface, reprojecting to the same pixel */
        nOcc++;
        const dHit = Math.hypot(hit.x - cam.eye.x, hit.z - cam.eye.z);
        const dTgt = Math.hypot(x - cam.eye.x, z - cam.eye.z);
        assert.ok(dHit < dTgt - 0.5, name + ': occluded click must hit nearer surface');
        const ndc2 = cam.project(hit.x, heightAt(hit.x, hit.z), hit.z);
        const perr = Math.hypot(ndc2[0] - ndc[0], ndc2[1] - ndc[1]);
        assert.ok(perr < 0.01, name + ': occluded hit reprojects, err=' + perr.toFixed(4));
        n++;
        continue;
      }
      const err = Math.hypot(hit.x - x, hit.z - z);
      worst = Math.max(worst, err);
      const c0 = toCell(x, z), c1 = toCell(hit.x, hit.z);
      const cellErr = Math.max(Math.abs(c0.cx - c1.cx), Math.abs(c0.cz - c1.cz));
      worstCell = Math.max(worstCell, cellErr);
      assert.ok(err < 0.15, name + ' err ' + err.toFixed(3) + ' >= 0.15');
      assert.deepStrictEqual(c1, c0, name + ' cell mismatch');
      n++;
    }
  }
  console.log('PASS rayGroundHit round trip: ' + n + ' aims (' + nOcc + ' occluded) x ' +
    cams.length + ' cameras, worst err ' + worst.toFixed(3) + ' units, worst cell err ' + worstCell);
}

/* 5. screen-pixel round trip: click -> cell -> reproject lands within 3 px */
{
  const Wpx = 1280, Hpx = 720;
  const cam = makeCam(64, 40, 88, 58, 0);
  function occluded(x, y, z){
    const dx = x - cam.eye.x, dy = y - cam.eye.y, dz = z - cam.eye.z;
    for (let i = 1; i < 200; i++){
      const t = i / 200;
      if (cam.eye.y + dy * t - heightAt(cam.eye.x + dx * t, cam.eye.z + dz * t) < -0.05)
        return true;
    }
    return false;
  }
  let worst = 0, n = 0;
  for (const [cx, cz] of [[30, 20], [6, 5], [40, 14], [10, 30], [55, 8], [0, 0], [50, 30]]){
    const wx = (cx + 0.5) * CELL, wz = (cz + 0.5) * CELL;
    if (occluded(wx, heightAt(wx, wz), wz)) continue; /* not visible, skip */
    const ndc = cam.project(wx, heightAt(wx, wz), wz);
    assert.ok(ndc && Math.abs(ndc[0]) < 1 && Math.abs(ndc[1]) < 1, 'cell on screen');
    const px = (ndc[0] + 1) / 2 * Wpx, py = (1 - ndc[1]) / 2 * Hpx;
    /* simulate a click at (px,py): NDC -> ray -> ground -> cell */
    const r = NB.Pick.ndcToRay(ndc[0], ndc[1], cam.ndcCam);
    const hit = NB.Pick.rayGroundHit(r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, heightAt);
    const got = toCell(hit.x, hit.z);
    assert.deepStrictEqual(got, { cx, cz }, 'click cell matches');
    const ndc2 = cam.project(hit.x, heightAt(hit.x, hit.z), hit.z);
    const px2 = (ndc2[0] + 1) / 2 * Wpx, py2 = (1 - ndc2[1]) / 2 * Hpx;
    const perr = Math.hypot(px2 - px, py2 - py);
    worst = Math.max(worst, perr);
    assert.ok(perr < 3, 'reproject within 3px, got ' + perr.toFixed(2));
    n++;
  }
  console.log('PASS screen round trip: ' + n + ' clicks, worst reproject err ' +
    worst.toFixed(2) + ' px');
}

/* 6. edge cases */
{
  const cam = makeCam(64, 40, 88, 58, 0);
  const sky = NB.Pick.ndcToRay(0, 2.5, cam.ndcCam); /* above the frame */
  assert.ok(sky.dy > 0, 'test ray points skyward');
  assert.strictEqual(NB.Pick.rayGroundHit(sky.ox, sky.oy, sky.oz, sky.dx, sky.dy, sky.dz, heightAt), null);
  assert.strictEqual(NB.Pick.rayGroundHit(0, 50, 0, 1, 0, 0, heightAt), null,
    'horizontal ray -> null');
  assert.strictEqual(NB.Pick.rayGroundHit(0, 50, 0, 0, 1, 0, heightAt), null,
    'straight-up ray -> null');
  /* steep top-down ray onto a hilltop is exact */
  const top = NB.Pick.rayGroundHit(13, 60, 11, 0, -1, 0, heightAt);
  assert.ok(Math.abs(top.x - 13) < 1e-6 && Math.abs(top.z - 11) < 1e-6, 'top-down exact');
  /* procedural fallback terrain (renderer groundHeight shape) also converges */
  const proc = (x, z) => 0.32 * Math.sin(x * 0.11) * Math.cos(z * 0.13) +
                         0.18 * Math.sin(x * 0.31 + z * 0.17) +
                         0.10 * Math.cos(x * 0.53 - z * 0.41);
  const pndc = cam.project(30, proc(30, 30), 30);
  const r = NB.Pick.ndcToRay(pndc[0], pndc[1], cam.ndcCam);
  const hp = NB.Pick.rayGroundHit(r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, proc);
  assert.ok(Math.hypot(hp.x - 30, hp.z - 30) < 0.15, 'procedural terrain converges');
  /* smoothing: equals the staircase at cell centers, no steps at borders */
  for (const [cx, cz] of [[6, 5], [20, 20], [40, 14]]){
    const wx = (cx + 0.5) * CELL, wz = (cz + 0.5) * CELL;
    assert.ok(Math.abs(heightAt(wx, wz) - stairAt(wx, wz)) < 1e-9,
      'smooth == staircase at cell center');
  }
  let maxStep = 0;
  for (let x = 4; x < 24; x += 0.1){
    const d = Math.abs(heightAt(x, 11) - heightAt(x + 0.1, 11));
    maxStep = Math.max(maxStep, d);
  }
  assert.ok(maxStep < 0.25, 'no staircase steps across hill, maxStep=' + maxStep.toFixed(3));
  /* empirical max slope of the smoothed field must stay under the
   * sphere-tracing bound (MAX_SLOPE = 4 in pick3d.js) */
  let maxSlope = 0;
  for (let x = 0; x < 128; x += 1){
    for (let z = 0; z < 80; z += 1){
      const sx = Math.abs(heightAt(x + 0.5, z) - heightAt(x - 0.5, z));
      const sz = Math.abs(heightAt(x, z + 0.5) - heightAt(x, z - 0.5));
      maxSlope = Math.max(maxSlope, sx, sz);
    }
  }
  assert.ok(maxSlope < 3.5, 'slope bound holds, maxSlope=' + maxSlope.toFixed(2));
  console.log('PASS edge cases (sky/horizontal null, top-down exact, procedural terrain, smooth field, slope ' +
    maxSlope.toFixed(2) + ' < 3.5)');
}

/* 7. static checks: production code must use the fixed path */
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'render3d.js'), 'utf8');
  assert.ok(/NB\.Pick\.rayGroundHit/.test(src),
    'render3d.js screenToGround must call NB.Pick.rayGroundHit');
  assert.ok(!/var t = -camera3\.position\.y \/ _v2\.y/.test(src),
    'old y=0 plane math must be gone from screenToGround');
  const ug = src.match(/function updateGhost[\s\S]{0,600}?var wx/);
  assert.ok(ug && /c\.cx/.test(ug[0]),
    'updateGhost must read c.cx/c.cz (ghost was pinned at map corner)');
  console.log('PASS static checks (terrain-aware picking wired, ghost keys fixed)');
}

console.log('\nAll placement checks passed.');
