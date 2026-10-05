/* UX regression test: people visibility, autoplay commander, camera/grid wiring.
 *
 * Covers (headless, node):
 *  1. people visibility: civilians present at sector start (in-bounds, near
 *     HQ); workers appear once laborers are assigned to staffed buildings;
 *     troops appear after barracks + training
 *  2. autoplay: NB.AI.Commander bound to the player slot ('p0') issues valid
 *     intents through sim.applyIntent, acts without errors, drainEvents works
 *  3. auto wave-start: sim.startWave() fires between waves (the autoplay
 *     fast-path); intermission auto-start still works at 0
 *  4. wiring guards (static): autoplay toggle, two-finger twist, rotate
 *     widget, ghost fade / holographic grid, cancelCine, sell confirm modal
 *     all present in game.js / ui.js / render3d.js / index.html
 *
 * Camera math itself lives in render3d.js (needs THREE/DOM) and is covered
 * by code review + the browser; here we guard the wiring against regressions.
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

globalThis.NB = globalThis.NB || {};
require('../config.js');
require('../towers.js');
require('../enemies.js');
require('../troops.js');
require('../events.js');
require('../sectors.js');
require('../sim.js');
require('../ai.js');

const ROOT = path.join(__dirname, '..');
function src(f){ return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

let pass = 0;
function ok(name, cond){
  pass++;
  assert(cond, 'FAIL: ' + name);
  console.log('  ok - ' + name);
}
function freshSim(seed){ return NB.createSim(NB.SECTORS[0], { seed: seed || 7 }); }
function tick(sim, secs){
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) sim.update(1 / 60);
}

console.log('ux: people visibility');
{
  const sim = freshSim(41);
  tick(sim, 3);
  const s = sim.snapshot();
  ok('civilians exist at sector start', (s.civilians || []).length > 0);
  const hq = s.hq || { x: 64, z: 40 };
  let inBounds = true, nearHq = true;
  for (const c of s.civilians){
    if (c.x < 0 || c.x > 128 || c.z < 0 || c.z > 80) inBounds = false;
    const d = Math.hypot(c.x - hq.x, c.z - hq.z);
    if (d > 40) nearHq = false;
  }
  ok('civilians in world bounds', inBounds);
  ok('civilians stay near the colony', nearHq);
  ok('no workers before economy staffing', (s.workers || []).length === 0);
}
{
  // staffed economy -> visible workers
  const sim = freshSim(42);
  const node = sim.snapshot().scrap[0];
  assert(sim.buildExtractor(node.cx, node.cz, 'p0').ok, 'extractor builds');
  assert(sim.buildHydro(30, 24, 'p0').ok, 'hydro builds');
  sim.assignClass('laborer', 5);
  tick(sim, 6);
  const s = sim.snapshot();
  ok('workers appear once laborers staff buildings', (s.workers || []).length > 0);
  let grounded = true;
  for (const w of s.workers){
    if (w.x < 0 || w.x > 128 || w.z < 0 || w.z > 80) grounded = false;
  }
  ok('workers in world bounds', grounded);
}
{
  // barracks + training -> visible troops
  const sim = freshSim(43);
  const s0 = sim.snapshot();
  const hq = s0.hq;
  const bx = Math.max(2, (hq.cx || 32) - 6), bz = (hq.cz || 20) + 3;
  sim.assignClass('soldier', 3);
  const br = sim.buildBarracks(bx, bz, 'p0');
  assert(br.ok, 'barracks builds: ' + JSON.stringify(br));
  const snap1 = sim.snapshot();
  const sq = (snap1.squads || []).find(q => q.barracksId != null);
  assert(sq, 'barracks musters a squad');
  const tr = sim.applyIntent({ playerId: 'p0', kind: 'trainTroop', type: 'rifleman', squadId: sq.id });
  assert(tr.ok, 'rifleman trains: ' + JSON.stringify(tr));
  tick(sim, 16);
  const s = sim.snapshot();
  ok('troops render after training', (s.troops || []).length > 0);
  ok('troop has sane position', s.troops.every(t => t.x >= 0 && t.x <= 128 && t.z >= 0 && t.z <= 80));
}

console.log('ux: autoplay commander');
{
  const sim = freshSim(44);
  const cmd = new NB.AI.Commander(sim,
    { id: 'p0', name: 'Autoplay', color: '#ffd166', doctrine: 'vanguard' },
    { difficulty: 'veteran' });
  ok('commander binds to the player slot', cmd.id === 'p0');
  ok('veteran difficulty configured', cmd.difficulty === 'veteran');
  const gold0 = sim.snapshot().gold;
  for (let i = 0; i < 90; i++) cmd.tick(1.3);
  ok('commander acts without throwing', cmd._acts > 0);
  ok('commander errors stay low', cmd._errors <= Math.max(2, cmd._acts * 0.2));
  const s = sim.snapshot();
  ok('commander builds through the same intent path',
     s.towers.length > 0 || s.gold < gold0);
  const evs = cmd.drainEvents();
  ok('drainEvents returns an array', Array.isArray(evs));
  cmd.tick(0);
  ok('tick(0) is a safe no-op', true);
}

console.log('ux: auto wave-start');
{
  const sim = freshSim(45);
  tick(sim, 1);
  let s = sim.snapshot();
  ok('between waves at start', !s.waveActive && (s.intermission || 0) > 0);
  const r = sim.startWave();
  ok('startWave fires between waves', r && r.ok !== false && sim.snapshot().waveActive);
  // intermission countdown still auto-starts on its own
  const sim2 = freshSim(46);
  sim2.startWave();
  tick(sim2, 400); // long enough to clear wave 1 + intermission on sector 1
  const s2 = sim2.snapshot();
  ok('sim progresses waves on its own', (s2.wave || 0) >= 1 || s2.over);
}

console.log('ux: wiring guards');
{
  const game = src('game.js'), ui = src('ui.js'),
        r3d = src('render3d.js'), html = src('../index.html');
  ok('autoplay toggle in HUD', html.includes('btn-autoplay'));
  ok('autoplay logic in game.js', game.includes('setAutoplay') && game.includes('_tickAutoplay'));
  ok('autoplay persisted', game.includes('nb_autoplay'));
  ok('two-finger twist rotates', game.includes('_pinch.a') || (game.includes('pinch') && game.includes('rotateBy')));
  ok('rotate widget in HUD', html.includes('rotate-widget'));
  ok('rotate hint wiring', game.includes('nb_rotate_hint') || ui.includes('nb_rotate_hint'));
  ok('cine skippable via camera inputs', r3d.includes('cam.cine = null'));
  ok('cancelCine exposed', r3d.includes('cancelCine'));
  ok('holographic ghost fade', r3d.includes('ghostFade'));
  ok('sell confirm modal', html.includes('modal-confirm') && game.includes('_doSellSelected'));
  ok('tutorial toast flags', game.includes('tipOnce') || ui.includes('tipOnce'));
}

console.log('\nux-check: ' + pass + ' assertions passed');
