/* Debris physics unit test (headless, no THREE needed).
 * 1. Spawn 100 bodies, step 5 s at 60 Hz: all must settle (rest on ground,
 *    velocity ~ 0, settled flag) and none may tunnel below the ground.
 * 2. Pool cap: spawning 500 into a 300-cap system keeps active <= 300 and
 *    never throws.
 * 3. Radial kick: bodies inside the radius gain outward velocity; bodies
 *    outside it are untouched.
 * 4. Life expiry: bodies are removed when life runs out.
 */
'use strict';
globalThis.NB = globalThis.NB || {};
require('../debris.js');
const assert = require('assert');

const groundY = () => 0;

function step(sys, seconds){
  const dt = 1 / 60, n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) sys.update(dt, groundY);
}

/* 1. settle test */
{
  const sys = NB.Debris.create({ cap: 300, gravity: 22 });
  const spawned = sys.burst(0, 6, 0, { count: 100, speed: 9, up: 7, life: 30, size: 0.7 });
  assert.strictEqual(spawned, 100, 'spawned 100');
  step(sys, 5);
  let active = sys.active();
  assert.strictEqual(active, 100, 'none expired early, active = ' + active);
  let settled = 0, below = 0, moving = 0;
  for (let i = 0; i < active; i++){
    const b = sys.body(i);
    if (b.y < -0.001) below++;
    if (b.settled) settled++;
    const v = sys._arrays;
    const sp = Math.hypot(v.vx[i], v.vy[i], v.vz[i]);
    if (!b.settled && sp > 0.5) moving++;
  }
  console.log('settle: settled=' + settled + '/100 below_ground=' + below + ' still_moving=' + moving);
  assert.strictEqual(below, 0, 'no tunneling below ground');
  assert.ok(settled >= 95, 'at least 95% settled after 5s, got ' + settled);
  assert.strictEqual(moving, 0, 'no unsettled body still fast');
  console.log('PASS settle (100 bodies rest on ground after 5s)');
}

/* 2. pool cap */
{
  const sys = NB.Debris.create({ cap: 300, gravity: 22 });
  let ok = 0;
  for (let k = 0; k < 500; k++) if (sys.spawn(0, 2, 0, { life: 30 })) ok++;
  assert.strictEqual(sys.active(), 300, 'active capped at 300, got ' + sys.active());
  assert.strictEqual(ok, 300, 'spawn returns false when full');
  step(sys, 0.5);
  assert.ok(sys.active() <= 300, 'still capped after stepping');
  console.log('PASS pool cap (500 spawns -> 300 active)');
}

/* 3. radial kick */
{
  const sys = NB.Debris.create({ cap: 300, gravity: 22 });
  // place bodies deterministically: bypass randomness by spawning then pinning
  for (let k = 0; k < 5; k++) sys.spawn(k * 2, 1, 0, { life: 30, speed: 0, up: 0 });
  const v = sys._arrays;
  for (let i = 0; i < 5; i++){ v.vx[i] = 0; v.vy[i] = 0; v.vz[i] = 0; }
  // body 0 at x=0 (d=0 -> skipped? d=0.001 guard), body1 x=2, body2 x=4, body3 x=6, body4 x=8
  const kicked = sys.kick(0, 0, 5, 10);
  assert.strictEqual(kicked, 3, '3 bodies within radius 5 (x=0,2,4), got ' + kicked);
  assert.ok(v.vx[1] > 0, 'body at x=2 pushed +x, vx=' + v.vx[1]);
  assert.ok(v.vx[2] > 0, 'body at x=4 pushed +x, vx=' + v.vx[2]);
  assert.strictEqual(v.vx[3], 0, 'body at x=6 untouched');
  assert.strictEqual(v.vx[4], 0, 'body at x=8 untouched');
  console.log('PASS radial kick (inside pushed out, outside untouched)');
}

/* 4. life expiry */
{
  const sys = NB.Debris.create({ cap: 300, gravity: 22 });
  sys.spawn(0, 1, 0, { life: 0.5 });
  assert.strictEqual(sys.active(), 1);
  step(sys, 1);
  assert.strictEqual(sys.active(), 0, 'body removed after life expiry');
  console.log('PASS life expiry (fade-out removal)');
}

console.log('ALL DEBRIS PHYSICS TESTS PASS');
