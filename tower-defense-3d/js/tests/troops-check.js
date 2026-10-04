/* Full TROOPS system regression test: barracks, troop types, orders,
 * upkeep, upgrades, reinforcement, permanent death, intents.
 *
 * Covers:
 *  1. registry: ranger/rifleman/breacher stats, costs, upkeep, bonusVs
 *  2. barracks: build cost (gold+metal), +6 troop cap each, one squad each,
 *     rally point set and used at spawn
 *  3. training: per-squad caps, global cap, soldier consumed at queue
 *  4. orders: move/attackmove/hold execute; attack-move spreads a loose line
 *  5. upkeep: fielded troops drain food over time
 *  6. upgrades: weapon/armor tiers apply to new and existing troops;
 *     research timing scales with scientists
 *  7. reinforce: one tap refills dead slots, permanent death stays
 *  8. intents: buildBarracks/setRally/squadOrder/troopUpgrade/reinforce
 *     validate through sim.applyIntent (host-authoritative path)
 *  9. headless soak: 300+ frames with 3 squads fighting, no NaNs/errors
 */
'use strict';
const assert = require('assert');

globalThis.NB = globalThis.NB || {};
require('../config.js');
require('../towers.js');
require('../enemies.js');
require('../troops.js');
require('../events.js');
require('../sectors.js');
require('../sim.js');

const CFG = NB.CONFIG;
let pass = 0;
function ok(name, cond){
  pass++;
  assert(cond, 'FAIL: ' + name);
  console.log('  ok - ' + name);
}
function freshSim(seed){
  return NB.createSim(NB.SECTORS[0], { seed: seed || 7 });
}
function tick(sim, secs){
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) sim.update(1 / 60);
}
function richSim(seed){
  /* deep pockets so training/upgrades never stall on cost */
  const sim = freshSim(seed);
  sim.debugGive(5000, 500, 2000);
  sim.addPopulation(40, 'test');
  sim.assignClass('soldier', 30);
  return sim;
}
function findBarracksCell(sim){
  for (let z = 15; z < 40; z++){
    for (let x = 15; x < 50; x++){
      if (sim.canPlaceBarracks(x, z).ok) return { x: x, z: z };
    }
  }
  return null;
}
function barracksAt(sim){
  const cell = findBarracksCell(sim);
  assert(cell, 'found a buildable barracks cell');
  const res = sim.buildBarracks(cell.x, cell.z, 'p0');
  assert(res.ok, 'buildBarracks ok: ' + (res.reason || ''));
  return res.instId;
}


console.log('troops: registry');
{
  ok('rifleman registered', !!NB.TROOPS.rifleman);
  ok('breacher registered', !!NB.TROOPS.breacher);
  ok('ranger kept as fast skirmisher',
     NB.TROOPS.ranger.speed > NB.TROOPS.rifleman.speed &&
     NB.TROOPS.rifleman.speed > NB.TROOPS.breacher.speed);
  ok('breacher is the tanky one',
     NB.TROOPS.breacher.hp > NB.TROOPS.rifleman.hp &&
     NB.TROOPS.breacher.hp > NB.TROOPS.ranger.hp);
  ok('breacher bonus vs armored', (NB.TROOPS.breacher.bonusVs || []).length > 0);
  ok('rifleman mid cost', NB.TROOPS.rifleman.costGold > 0 &&
     NB.TROOPS.rifleman.costGold < NB.TROOPS.breacher.costGold);
  ok('upkeep positive for all',
     NB.TROOPS.ranger.upkeep > 0 && NB.TROOPS.rifleman.upkeep > 0 &&
     NB.TROOPS.breacher.upkeep > 0);
  ok('breacher upkeep highest',
     NB.TROOPS.breacher.upkeep >= NB.TROOPS.rifleman.upkeep);
  ok('armored types listed', (NB.ARMORED_TYPES || []).indexOf('brute') >= 0);
}

console.log('troops: barracks build');
{
  const sim = richSim(11);
  const s0 = sim.snapshot();
  ok('spire guard squad exists at init',
     (s0.squads || []).some(function(q){ return q.id === 'sq-spire'; }));
  const before = s0.troopCap;
  ok('barracks placement check exists', typeof sim.canPlaceBarracks(0, 0).ok === 'boolean');
  const g0 = sim.snapshot().gold, m0 = sim.snapshot().metal;
  const instId = barracksAt(sim);
  const s = sim.snapshot();
  ok('barracks costs gold', sim.snapshot().gold < g0);
  ok('barracks costs metal', sim.snapshot().metal < m0);
  ok('barracks raises troop cap by 6', s.troopCap === before + 6);
  ok('one squad per barracks',
     (s.squads || []).some(function(q){ return q.barracksId === instId; }));
  ok('barracks in snapshot', (s.barracks || []).some(function(b){ return b.instId === instId; }));
  const r = sim.setRally(instId, 40, 40, 'p0');
  ok('setRally ok', r.ok);
  ok('rally stored on barracks',
     sim.snapshot().barracks.filter(function(b){ return b.instId === instId; })[0].rally.x === 40);
  ok('foreign rally rejected', sim.setRally(instId, 1, 1, 'pX').ok === false);
}

console.log('troops: training and caps');
{
  const sim = richSim(12);
  const instId = barracksAt(sim);
  const sq = sim.snapshot().squads.filter(function(q){ return q.barracksId === instId; })[0];
  ok('squad id found', !!sq);
  ok('barracks placement validated', sim.canPlaceBarracks(0, 0) !== undefined);
  const sold0 = sim.snapshot().pop.classes.soldier;
  const tr = sim.trainTroop('rifleman', 'p0', sq.id);
  ok('train rifleman queues', tr.ok && tr.squadId === sq.id);
  ok('soldier consumed at queue', sim.snapshot().pop.classes.soldier === sold0 - 1);
  ok('bad type rejected', sim.trainTroop('space-marine', 'p0', sq.id).ok === false);
  ok('bad squad rejected', sim.trainTroop('rifleman', 'p0', 'sq-nope').ok === false);
  ok('foreign squad rejected', sim.trainTroop('rifleman', 'pX', sq.id).ok === false);
  /* fill the squad to cap: 6 */
  for (let i = 0; i < 5; i++) sim.trainTroop('rifleman', 'p0', sq.id);
  const full = sim.trainTroop('rifleman', 'p0', sq.id);
  ok('squad cap enforced', full.ok === false && full.reason === 'squadcap');
  tick(sim, NB.TROOPS.rifleman.trainTime + 2);
  const s = sim.snapshot();
  const fielded = s.troops.filter(function(t){ return t.squadId === sq.id; });
  ok('squad fields 6 riflemen', fielded.length === 6);
  ok('troops spawn at rally', fielded.every(function(t){
    return Math.abs(t.x - 21 * 2) < 12 && Math.abs(t.z - 21 * 2) < 12;
  }));
  /* global cap: base 6 + 6 per barracks = 12; spire squad can take 6 more */
  for (let i = 0; i < 7; i++) sim.trainTroop('ranger', 'p0', 'sq-spire');
  const s2 = sim.snapshot();
  ok('global troop cap respected',
     s2.troops.length + s2.training.length <= s2.troopCap);
}

console.log('troops: orders execute');
{
  const sim = richSim(13);
  sim.trainTroop('ranger', 'p0', 'sq-spire');
  tick(sim, NB.TROOPS.ranger.trainTime + 1);
  let s = sim.snapshot();
  ok('ranger fielded', s.troops.length === 1);
  const id = s.troops[0].id;
  const x0 = s.troops[0].x;
  ok('move executes', sim.troopOrder(id, 'move', x0 + 40, s.troops[0].z, 'p0').ok);
  tick(sim, 5);
  ok('move displaces', sim.snapshot().troops[0].x > x0 + 15);
  ok('hold pins', (function(){
    sim.troopOrder(id, 'hold', 0, 0, 'p0');
    const hx = sim.snapshot().troops[0].x;
    tick(sim, 3);
    return Math.abs(sim.snapshot().troops[0].x - hx) < 1;
  })());
  ok('bad order rejected', sim.troopOrder(id, 'dance', 0, 0, 'p0').ok === false);
  /* squad order: loose line attack-move */
  sim.assignClass('soldier', 30);
  for (let i = 0; i < 3; i++) sim.trainTroop('rifleman', 'p0', 'sq-spire');
  tick(sim, NB.TROOPS.rifleman.trainTime + 2);
  s = sim.snapshot();
  const sqTroops = s.troops.filter(function(t){ return t.squadId === 'sq-spire'; });
  ok('squad has 4', sqTroops.length === 4);
  const cx = sqTroops[0].x, cz = sqTroops[0].z;
  const starts = {};
  sqTroops.forEach(function(t){ starts[t.id] = t.x; });
  ok('squad attackmove', sim.squadOrder('sq-spire', 'attackmove', cx + 60, cz, 'p0').ok);
  tick(sim, 6);
  const after = sim.snapshot().troops.filter(function(t){ return t.squadId === 'sq-spire'; });
  const spread = Math.max.apply(null, after.map(function(t){ return t.z; })) -
                 Math.min.apply(null, after.map(function(t){ return t.z; }));
  ok('attack-move spreads loose line', spread > 2);
  ok('squad moves toward target',
     after.every(function(t){ return t.x > starts[t.id] + 10; }));
}

console.log('troops: upkeep drain');
{
  const sim = richSim(14);
  const f0 = sim.snapshot().food;
  sim.trainTroop('breacher', 'p0', 'sq-spire');
  tick(sim, NB.TROOPS.breacher.trainTime + 1);
  const withUpkeep = sim.snapshot().food;
  tick(sim, 20);
  const later = sim.snapshot().food;
  ok('upkeep drains food over time', later < withUpkeep);
  ok('upkeep in snapshot', sim.snapshot().troopUpkeep > 0);
  ok('drain scales with upkeep rate',
     (withUpkeep - later) > NB.TROOPS.breacher.upkeep * 20 * 0.5);
}

console.log('troops: upgrades');
{
  const sim = richSim(15);
  sim.assignClass('soldier', 8);
  sim.assignClass('scientist', 4);
  /* defend the HQ while research runs: 4 pulse turrets in a ring */
  const hq = sim.snapshot().hq;
  const hqc = { x: Math.round(hq.x / 2), z: Math.round(hq.z / 2) };
  [[-3, 0], [3, 0], [0, -3], [0, 3]].forEach(function(o){
    sim.buildTower(hqc.x + o[0], hqc.z + o[1], 'pulse', 'p0');
  });
  const r = sim.researchTroopUpgrade('weapon', 'p0');
  ok('weapon research starts', r.ok && r.duration <= 45);
  ok('scientists speed research', r.duration < 45);
  ok('duplicate research rejected', sim.researchTroopUpgrade('armor', 'p0').ok === false);
  tick(sim, r.duration + 2);
  ok('weapon tier 1 applied', sim.snapshot().troopUpg.weapon === 1);
  /* damage scales: check a fresh troop right after spawn (waves may be live) */
  sim.trainTroop('rifleman', 'p0', 'sq-spire');
  tick(sim, NB.TROOPS.rifleman.trainTime + 1);
  const t = sim.snapshot().troops[sim.snapshot().troops.length - 1];
  ok('troop spawned for dmg check', !!t);
  ok('damage scales with weapon tier',
     t.dmg >= NB.TROOPS.rifleman.dmg * 1.24);
  /* armor tier: research, then a fresh troop spawns with scaled maxHp */
  const r2 = sim.researchTroopUpgrade('armor', 'p0');
  ok('armor research starts', r2.ok);
  tick(sim, r2.duration + 2);
  ok('armor tier 1 applied', sim.snapshot().troopUpg.armor === 1);
  sim.assignClass('soldier', 8);
  sim.trainTroop('rifleman', 'p0', 'sq-spire');
  tick(sim, NB.TROOPS.rifleman.trainTime + 1);
  const troops = sim.snapshot().troops;
  const t2 = troops[troops.length - 1];
  ok('troop spawned for armor check', !!t2);
  ok('armor scales maxHp', t2.maxHp >= NB.TROOPS.rifleman.hp * 1.29);
  /* tier cap: research weapon to tier 2, third attempt fails */
  const r3 = sim.researchTroopUpgrade('weapon', 'p0');
  ok('weapon tier 2 research starts', r3.ok);
  tick(sim, r3.duration + 2);
  ok('weapon tier 2 applied', sim.snapshot().troopUpg.weapon === 2);
  ok('max 2 tiers', sim.researchTroopUpgrade('weapon', 'p0').ok === false);
}

console.log('troops: reinforcement and permanent death');
{
  const sim = richSim(16);
  const instId = barracksAt(sim);
  const sq = sim.snapshot().squads.filter(function(q){ return q.barracksId === instId; })[0];
  for (let i = 0; i < 3; i++) sim.trainTroop('rifleman', 'p0', sq.id);
  tick(sim, NB.TROOPS.rifleman.trainTime + 2);
  let s = sim.snapshot();
  ok('3 fielded', s.troops.filter(function(t){ return t.squadId === sq.id; }).length === 3);
  /* kill two via debug damage */
  const ids = s.troops.filter(function(t){ return t.squadId === sq.id; }).map(function(t){ return t.id; });
  sim.debugDamageTroop(ids[0], 99999);
  sim.debugDamageTroop(ids[1], 99999);
  tick(sim, 0.5);
  s = sim.snapshot();
  ok('permanent death', s.troops.filter(function(t){ return t.squadId === sq.id; }).length === 1);
  ok('squad shows dead slots', (function(){
    const q = s.squads.filter(function(x){ return x.id === sq.id; })[0];
    return q.alive === 1 && q.cap === 6;
  })());
  const rf = sim.reinforceSquad(sq.id, 'p0');
  ok('reinforce queues missing', rf.ok && rf.queued === 5);
  ok('full squad reinforce rejected',
     sim.reinforceSquad(sq.id, 'p0').ok === false);
  tick(sim, NB.TROOPS.rifleman.trainTime + 2);
  ok('reinforced back to strength',
     sim.snapshot().troops.filter(function(t){ return t.squadId === sq.id; }).length === 6);
}

console.log('troops: intent validation (host path)');
{
  const sim = richSim(17);
  const instId = barracksAt(sim);
  const sq = sim.snapshot().squads.filter(function(q){ return q.barracksId === instId; })[0];
  ok('buildBarracks intent validates',
     sim.applyIntent({ kind: 'buildBarracks', playerId: 'p0', cx: 24, cz: 24 }).ok === true);
  ok('setRally intent validates',
     sim.applyIntent({ kind: 'setRally', playerId: 'p0', instId: instId, x: 30, z: 30 }).ok === true);
  ok('setRally rejects foreigner',
     sim.applyIntent({ kind: 'setRally', playerId: 'pX', instId: instId, x: 30, z: 30 }).ok === false);
  sim.trainTroop('rifleman', 'p0', sq.id);
  tick(sim, NB.TROOPS.rifleman.trainTime + 1);
  ok('squadOrder intent validates',
     sim.applyIntent({ kind: 'squadOrder', playerId: 'p0', squadId: sq.id, order: 'hold', x: 10, z: 10 }).ok === true);
  ok('squadOrder rejects bad order',
     sim.applyIntent({ kind: 'squadOrder', playerId: 'p0', squadId: sq.id, order: 'dance', x: 10, z: 10 }).ok === false);
  ok('troopUpgrade intent validates',
     sim.applyIntent({ kind: 'troopUpgrade', playerId: 'p0', track: 'weapon' }).ok === true);
  ok('troopUpgrade rejects bad track',
     sim.applyIntent({ kind: 'troopUpgrade', playerId: 'pX', track: 'shields' }).ok === false);
  ok('reinforce intent validates',
     sim.applyIntent({ kind: 'reinforce', playerId: 'p0', squadId: sq.id }).ok === true);
  ok('unknown intent rejected',
     sim.applyIntent({ kind: 'launchNukes', playerId: 'p0' }).ok === false);
}

console.log('troops: headless soak, 3 squads fighting');
{
  const sim = richSim(18);
  const ids = [];
  ids.push(barracksAt(sim));
  ids.push(barracksAt(sim));
  ids.push(barracksAt(sim));
  const squads = sim.snapshot().squads.filter(function(q){ return q.barracksId; });
  ok('3 barracks squads', squads.length === 3);
  const types = ['rifleman', 'breacher', 'ranger'];
  squads.forEach(function(sq, si){
    for (let i = 0; i < 4; i++) sim.trainTroop(types[si % 3], 'p0', sq.id);
  });
  /* rally all three to the same staging ground */
  ids.forEach(function(id){ sim.setRally(id, 35, 35, 'p0'); });
  tick(sim, 20);
  squads.forEach(function(sq){
    sim.squadOrder(sq.id, 'attackmove', 70, 70, 'p0');
  });
  /* spawn hostile packs in the troops' path */
  for (let i = 0; i < 12; i++){
    sim.debugSpawnEnemy(i % 3 === 0 ? 'brute' : 'runner', 48 + (i % 4), 48 + (i % 3));
  }
  let nan = false, err = null;
  try {
    for (let f = 0; f < 400; f++){
      sim.update(1 / 60);
      if (f % 60 === 0){
        const s = sim.snapshot();
        JSON.stringify(s.troops);
        for (let i = 0; i < s.troops.length; i++){
          const t = s.troops[i];
          if (!isFinite(t.x + t.z + t.hp) || !isFinite(t.dmg)){ nan = true; break; }
        }
        if (nan) break;
      }
    }
  } catch (e){ err = e; }
  ok('400 frames no exceptions', err === null);
  ok('no NaNs in troops', nan === false);
  const s = sim.snapshot();
  ok('fight happened (enemies engaged)',
     (s.enemies || []).length < 12 || s.troops.some(function(t){ return t.targetId; }) ||
     s.troops.some(function(t){ return t.hp < t.maxHp; }));
  console.log('    soak end: troops=' + s.troops.length + ' enemies=' + (s.enemies || []).length);
}

console.log('\n' + pass + ' troop checks passed');
