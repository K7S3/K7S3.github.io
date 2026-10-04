/* Nova Bastion 3D - simulation engine (headless, no DOM)
 *
 * Year 2100. Humanity survives in sealed arcologies. The RUST, a rogue
 * self-replicating machine swarm, presses every wall. You are the Bastion
 * Commander. The COMMAND SPIRE is the colony's hub and evacuation gate:
 * if it falls, the colony falls.
 *
 * Core model: 64x40 cell grid (cell = 2 world units). The Spire projects a
 * TACTICAL UPLINK NETWORK; structures outside uplink range go DARK
 * (dormant). Enemies path via a BFS flow field from the Spire and melee
 * structures when sealed out. Morale, blackout surges, crossroads events,
 * edicts, veterancy, the Director, and tower eras layer on top.
 *
 * Runs in node with no DOM: NB must be loaded via the data files
 * (config, towers, enemies, events) before this file.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){
  return (typeof v === 'number' && isFinite(v)) ? v : d;
}
function copySpecial(sp){
  var out = {};
  if (sp && typeof sp === 'object'){
    for (var k in sp){
      if (Object.prototype.hasOwnProperty.call(sp, k)) out[k] = sp[k];
    }
  }
  return out;
}
function mulberry32(seed){
  var a = (seed >>> 0) || 1;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function cloneGroups(waves){
  return (waves || []).map(function(w){
    var g = { note: w.note || '', hpMult: num(w.hpMult, 1),
              bountyMult: num(w.bountyMult, 1), boss: !!w.boss, enemies: [] };
    (w.enemies || []).forEach(function(e){
      g.enemies.push({ type: e.type, count: Math.max(0, Math.round(num(e.count, 0))),
                       gap: num(e.gap, 1), delay: num(e.delay, 0),
                       gate: (e.gate === undefined ? null : e.gate) });
    });
    return g;
  });
}
function defaultWaves(){
  return [
    { note:'Rust scouts', hpMult:1.0, enemies:[{type:'drone',count:8,gap:1.0,delay:0}] },
    { note:'Skitter pack', hpMult:1.0, enemies:[{type:'drone',count:6,gap:0.8,delay:0},{type:'runner',count:6,gap:0.6,delay:2}] },
    { note:'Shredder tide', hpMult:1.05, enemies:[{type:'swarmling',count:16,gap:0.4,delay:0}] },
    { note:'Siege walkers', hpMult:1.1, enemies:[{type:'tank',count:3,gap:2.0,delay:1},{type:'drone',count:8,gap:0.7,delay:2}] },
    { note:'Wraiths', hpMult:1.2, enemies:[{type:'phantom',count:4,gap:1.5,delay:1},{type:'runner',count:8,gap:0.5,delay:3}] },
    { note:'DREADNOUGHT', hpMult:1.0, boss:true, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'drone',count:10,gap:0.8,delay:4}] }
  ];
}

NB.createSim = function(sectorDef, opts){
  opts = opts || {};
  var CONFIG = NB.CONFIG || {};
  var TOWERS = NB.TOWERS || {};
  var ENEMIES = NB.ENEMIES || {};
  var SYNERGIES = NB.SYNERGIES || [];
  var EVENTS = NB.EVENTS || [];
  var EDICTS = NB.EDICTS || [];

  var CFG = {
    COLS: num(CONFIG.COLS, 64),
    ROWS: num(CONFIG.ROWS, 40),
    CELL: num(CONFIG.CELL, 2),
    INTEREST_RATE: num(CONFIG.INTEREST_RATE, 0.05),
    SELLBACK: num(CONFIG.SELLBACK, 0.7),
    EARLY_BASE: num(CONFIG.EARLY_BASE, 10),
    EARLY_PER_SEC: num(CONFIG.EARLY_PER_SEC, 2),
    SYNERGY_RADIUS_CELLS: num(CONFIG.SYNERGY_RADIUS_CELLS, 5),
    INTERMISSION: num(CONFIG.INTERMISSION, 20),
    WALL_COST: num(CONFIG.WALL_COST, 8),
    WALL_HP: num(CONFIG.WALL_HP, 250),
    REACTOR_COST: num(CONFIG.REACTOR_COST, 150),
    REACTOR_HP: num(CONFIG.REACTOR_HP, 400),
    REACTOR_CAP: num(CONFIG.REACTOR_CAP, 30),
    HQ_HP: num(CONFIG.HQ_HP, 2000),
    TOWER_HP_BASE: num(CONFIG.TOWER_HP_BASE, 180),
    TOWER_HP_PER_TIER: num(CONFIG.TOWER_HP_PER_TIER, 40),
    UPLINK_BASE: num(CONFIG.UPLINK_BASE, 9),
    SPIRE_UPGRADE_COSTS: CONFIG.SPIRE_UPGRADE_COSTS || [150, 300, 600],
    SPIRE_RADIUS_PER_TIER: num(CONFIG.SPIRE_RADIUS_PER_TIER, 2),
    OVERCLOCK_RADIUS: num(CONFIG.OVERCLOCK_RADIUS, 4),
    OVERCLOCK_DMG: num(CONFIG.OVERCLOCK_DMG, 1.25),
    STRAIN_FULL_TIME: num(CONFIG.STRAIN_FULL_TIME, 40),
    STRAIN_DECAY: num(CONFIG.STRAIN_DECAY, 6),
    OVERCLOCK_COOLDOWN: num(CONFIG.OVERCLOCK_COOLDOWN, 60),
    OVERCLOCK_BURN: num(CONFIG.OVERCLOCK_BURN, 0.15),
    MORALE_START: num(CONFIG.MORALE_START, 70),
    MORALE_STRUCT_LOSS: num(CONFIG.MORALE_STRUCT_LOSS, 3),
    MORALE_STRUCT_LOSS_CAP: num(CONFIG.MORALE_STRUCT_LOSS_CAP, 9),
    MORALE_BREACH: num(CONFIG.MORALE_BREACH, 4),
    MORALE_FLAWLESS: num(CONFIG.MORALE_FLAWLESS, 4),
    MORALE_CLEAR: num(CONFIG.MORALE_CLEAR, 2),
    SURGE_WARN: num(CONFIG.SURGE_WARN, 20),
    SURGE_SHRINK: num(CONFIG.SURGE_SHRINK, 3),
    SURGE_MIN_RADIUS: num(CONFIG.SURGE_MIN_RADIUS, 4),
    SURGE_REWARD_GOLD: num(CONFIG.SURGE_REWARD_GOLD, 150),
    SURGE_REWARD_MORALE: num(CONFIG.SURGE_REWARD_MORALE, 6),
    MAX_ENEMIES: num(CONFIG.MAX_ENEMIES, 600),
    MELEE_RANGE_CELLS: num(CONFIG.MELEE_RANGE_CELLS, 1.6),
    SEEK_RANGE_CELLS: num(CONFIG.SEEK_RANGE_CELLS, 14),
    SAPPER_SEEK_RANGE_CELLS: num(CONFIG.SAPPER_SEEK_RANGE_CELLS, 20),
    BREACH_RANGE_CELLS: num(CONFIG.BREACH_RANGE_CELLS, 3)
  };

  var rng = mulberry32(num(opts.seed, 1234));
  function rnd(){ return rng(); }

  /* ---------- sector definition ---------- */
  var sd = sectorDef || {};
  var COLS = Math.max(8, Math.round(num(sd.cols, CFG.COLS)));
  var ROWS = Math.max(8, Math.round(num(sd.rows, CFG.ROWS)));
  var CELL = CFG.CELL;
  var hqCell = sd.hq || { x: Math.floor(COLS/2) - 1, z: Math.floor(ROWS/2) - 1 };
  hqCell = { x: Math.max(1, Math.min(COLS-3, Math.round(num(hqCell.x, 0)))),
             z: Math.max(1, Math.min(ROWS-3, Math.round(num(hqCell.z, 0)))) };
  var gates = (sd.gates && sd.gates.length) ? sd.gates.map(function(g){
    return { x: Math.max(0, Math.min(COLS-1, Math.round(num(g.x, 0)))),
             z: Math.max(0, Math.min(ROWS-1, Math.round(num(g.z, 0)))) };
  }) : [{ x: 0, z: Math.floor(ROWS/2) }, { x: COLS-1, z: Math.floor(ROWS/2) }];
  var blockedRects = sd.blocked || [];
  var waves = cloneGroups((sd.waves && sd.waves.length) ? sd.waves : defaultWaves());
  var anomalies = sd.anomalies || [];
  var surges = sd.surges || [];
  var eventWaves = sd.eventWaves || [];
  var edictsAt = sd.edictsAt || [];
  var availableTowers = (sd.availableTowers && sd.availableTowers.length)
    ? sd.availableTowers.slice() : Object.keys(TOWERS);

  /* ---------- state ---------- */
  var evq = [];
  var st = {
    gold: num(sd.startGold, 300),
    waveIndex: 0, wavesTotal: waves.length,
    waveActive: false, intermission: CFG.INTERMISSION,
    enemies: [], towers: [], walls: [], reactors: [],
    projectiles: [], beams: [],
    time: 0, speed: num(opts.speed, 1) || 1, paused: false,
    over: false, victory: false, defeatReason: '', stars: 0,
    stats: { kills: 0, goldEarned: 0, towersBuilt: 0, upgradesBought: 0,
             bossesKilled: 0, anomaliesSeen: 0, surgesSurvived: 0,
             structuresLost: 0, wavesCleared: 0 },
    spawnQueue: [], delayed: [],
    hqHp: CFG.HQ_HP, hqMaxHp: CFG.HQ_HP,
    spireTier: 0,
    overclock: { active: false, strain: 0, cooldown: 0 },
    morale: CFG.MORALE_START, unrest: false,
    moraleLossStruct: 0, breached: false,
    hqDamageWave: 0, structsLostWave: 0,
    surgeActive: false, goldRush: false,
    activeAnomaly: null,
    pendingEvent: null, usedEvents: [],
    pendingEdict: null, usedEdicts: [], edicts: [],
    mods: { towerDmg: 1, moralePerClear: 0, structRegen: 0, buildCost: 1,
            darkBonus: 0, bountyMult: 1, wallHp: 1, strainMult: 1,
            flawlessMorale: CFG.MORALE_FLAWLESS },
    freeBuilds: {},
    uplinkTemp: { cells: 0, wavesLeft: 0 },
    costTemp: { mult: 1, wavesLeft: 0 },
    dmgTemp: { mult: 1, wavesLeft: 0 },
    nextWaveHpMult: 1,
    reactorBoost: 0,
    insulatedWaves: false,
    directorDone: {},
    curHpMult: 1, curBountyMult: 1,
    focusId: null,
    overclockCharges: Math.max(0, Math.round(num(sd.overclockCharges, 3))),
    comboTimes: [], comboBest: 0, comboMilestones: {},
    grades: [], lastGrade: null,
    barrels: [],
    drops: [],
    hero: null
  };

  var sim = {
    nextInstId: 0, nextEnemyId: 0, nextWallId: 0,
    synergyAnnounced: {}, synById: {}
  };
  var si;
  for (si = 0; si < SYNERGIES.length; si++){
    if (SYNERGIES[si] && SYNERGIES[si].id) sim.synById[SYNERGIES[si].id] = SYNERGIES[si];
  }

  /* ---------- grid helpers ---------- */
  var occ = {};   /* "cx,cz" -> {kind:'tower'|'wall'|'reactor', ref} */
  var flow = new Float32Array(COLS * ROWS);
  var hills = sd.hills || [];

  /* elevation: smooth cosine falloff per hill, base 0 */
  function cellHeight(cx, cz){
    var h = 0;
    for (var i = 0; i < hills.length; i++){
      var hl = hills[i];
      var dx = cx - num(hl.x, 0), dz = cz - num(hl.z, 0);
      var r = Math.max(0.5, num(hl.r, 3));
      var d = Math.sqrt(dx*dx + dz*dz);
      if (d < r) h += num(hl.h, 0) * 0.5 * (1 + Math.cos(Math.PI * d / r));
    }
    return h;
  }
  function heightAt(x, z){
    return cellHeight(cellCX(x), cellCZ(z));
  }

  function key(cx, cz){ return cx + ',' + cz; }
  function inB(cx, cz){ return cx >= 0 && cz >= 0 && cx < COLS && cz < ROWS; }
  function idx(cx, cz){ return cz * COLS + cx; }
  function cellCX(x){ return Math.floor(x / CELL); }
  function cellCZ(z){ return Math.floor(z / CELL); }
  function cellWX(cx){ return (cx + 0.5) * CELL; }
  function cellWZ(cz){ return (cz + 0.5) * CELL; }
  function terrainAt(cx, cz){
    for (var i = 0; i < blockedRects.length; i++){
      var r = blockedRects[i];
      if (cx >= r.x && cx < r.x + num(r.w, 1) && cz >= r.z && cz < r.z + num(r.h, 1)) return true;
    }
    return false;
  }
  function hqAt(cx, cz){
    return cx >= hqCell.x && cx < hqCell.x + 2 && cz >= hqCell.z && cz < hqCell.z + 2;
  }
  function gateAt(cx, cz){
    for (var i = 0; i < gates.length; i++){
      if (gates[i].x === cx && gates[i].z === cz) return true;
    }
    return false;
  }
  function structAt(cx, cz){ return occ[key(cx, cz)] || null; }
  function hqCenterCell(){ return { cx: hqCell.x + 1, cz: hqCell.z + 1 }; }
  function hqCenterWorld(){ return { x: (hqCell.x + 1) * CELL, z: (hqCell.z + 1) * CELL }; }

  function isBuildable(cx, cz){
    return inB(cx, cz) && !terrainAt(cx, cz) && !hqAt(cx, cz) &&
           !structAt(cx, cz) && !gateAt(cx, cz);
  }

  /* Weighted flow field: Dijkstra from the spire. Step cost is
   * 1 + uphill penalty (max(0, heightDiff) * 1.5), so the rust prefers
   * valleys and pays extra to climb. */
  function recomputeFlow(){
    var i, n = COLS * ROWS;
    for (i = 0; i < n; i++) flow[i] = Infinity;
    var pqD = [], pqX = [], pqZ = [], pqN = 0;
    function pqPush(d, cx, cz){
      var k = pqN++;
      pqD[k] = d; pqX[k] = cx; pqZ[k] = cz;
      while (k > 0){
        var p = (k - 1) >> 1;
        if (pqD[p] <= pqD[k]) break;
        var td = pqD[p]; pqD[p] = pqD[k]; pqD[k] = td;
        var tx = pqX[p]; pqX[p] = pqX[k]; pqX[k] = tx;
        var tz = pqZ[p]; pqZ[p] = pqZ[k]; pqZ[k] = tz;
        k = p;
      }
    }
    function pqPop(){
      if (pqN === 0) return null;
      var rd = pqD[0], rx = pqX[0], rz = pqZ[0];
      pqN--;
      if (pqN > 0){
        pqD[0] = pqD[pqN]; pqX[0] = pqX[pqN]; pqZ[0] = pqZ[pqN];
        var k = 0;
        for (;;){
          var l = k * 2 + 1, r = l + 1, m = k;
          if (l < pqN && pqD[l] < pqD[m]) m = l;
          if (r < pqN && pqD[r] < pqD[m]) m = r;
          if (m === k) break;
          var td = pqD[m]; pqD[m] = pqD[k]; pqD[k] = td;
          var tx = pqX[m]; pqX[m] = pqX[k]; pqX[k] = tx;
          var tz = pqZ[m]; pqZ[m] = pqZ[k]; pqZ[k] = tz;
          k = m;
        }
      }
      return { d: rd, cx: rx, cz: rz };
    }
    var dx, dz, hx, hz;
    for (dz = 0; dz < 2; dz++){
      for (dx = 0; dx < 2; dx++){
        hx = hqCell.x + dx; hz = hqCell.z + dz;
        if (!inB(hx, hz)) continue;
        flow[idx(hx, hz)] = 0;
        pqPush(0, hx, hz);
      }
    }
    var nb = [[1,0],[-1,0],[0,1],[0,-1]];
    var node;
    while ((node = pqPop()) !== null){
      var cx = node.cx, cz = node.cz, d = node.d;
      if (d > flow[idx(cx, cz)]) continue;
      var hCur = cellHeight(cx, cz);
      for (var q = 0; q < 4; q++){
        var nx = cx + nb[q][0], nz = cz + nb[q][1];
        if (!inB(nx, nz)) continue;
        if (terrainAt(nx, nz)) continue;
        if (structAt(nx, nz)) continue;
        var hNext = cellHeight(nx, nz);
        var step = 1 + Math.max(0, hNext - hCur) * 1.5;
        var nd = d + step;
        if (nd < flow[idx(nx, nz)]){
          flow[idx(nx, nz)] = nd;
          pqPush(nd, nx, nz);
        }
      }
    }
  }
  function flowDist(cx, cz){
    if (!inB(cx, cz)) return -1;
    var v = flow[idx(cx, cz)];
    return (v === Infinity) ? -1 : v;
  }
  function adjacentToHQ(cx, cz){
    return hqAt(cx + 1, cz) || hqAt(cx - 1, cz) || hqAt(cx, cz + 1) || hqAt(cx, cz - 1);
  }

  /* ---------- uplink / dark ---------- */
  function uplinkRadius(){
    var base = CFG.UPLINK_BASE + CFG.SPIRE_RADIUS_PER_TIER * st.spireTier;
    var r = base + (st.overclock.active ? CFG.OVERCLOCK_RADIUS : 0) + st.uplinkTemp.cells;
    if (st.surgeActive) r -= CFG.SURGE_SHRINK;
    if (r < CFG.SURGE_MIN_RADIUS) r = CFG.SURGE_MIN_RADIUS;
    return r;
  }
  function recomputeDark(){
    var r = uplinkRadius() + st.mods.darkBonus;
    var hc = hqCenterCell();
    var i, s, dx, dz;
    for (i = 0; i < st.towers.length; i++){
      s = st.towers[i];
      dx = (s.cx + 0.5) - (hc.cx + 0.5); dz = (s.cz + 0.5) - (hc.cz + 0.5);
      s.dark = Math.sqrt(dx*dx + dz*dz) > r;
    }
    for (i = 0; i < st.reactors.length; i++){
      s = st.reactors[i];
      dx = (s.cx + 0.5) - (hc.cx + 0.5); dz = (s.cz + 0.5) - (hc.cz + 0.5);
      s.dark = Math.sqrt(dx*dx + dz*dz) > r;
    }
  }
  function afterLayoutChange(){
    recomputeFlow();
    recomputeDark();
    allocatePower();
    recomputeBuffs();
    recomputeSynergies();
  }

  /* ---------- energy ---------- */
  function energyCostOf(t){
    var c = num(t.def.energy, 0);
    if (t.branch) c += 5;
    return c;
  }
  function energyCap(){
    var cap = 0, i;
    for (i = 0; i < st.reactors.length; i++){
      var r = st.reactors[i];
      if (r.dark) continue;
      var d = doctrineOf(r.ownerId);
      cap += (CFG.REACTOR_CAP + st.reactorBoost) * (d ? num(d.reactorEnergy, 1) : 1);
    }
    return Math.floor(cap);
  }
  function allocatePower(){
    var cap = energyCap();
    var used = 0;
    var consumers = [];
    var i, t;
    for (i = 0; i < st.towers.length; i++){
      t = st.towers[i];
      if (energyCostOf(t) > 0) consumers.push(t);
      else t.powered = true;
    }
    consumers.sort(function(a, b){ return a.instId - b.instId; });
    for (i = 0; i < consumers.length; i++){
      t = consumers[i];
      var c = energyCostOf(t);
      if (used + c <= cap){ t.powered = true; used += c; }
      else t.powered = false;
    }
    return { used: used, cap: cap };
  }

  /* ---------- events queue (drainEvents contract) ---------- */
  function announce(text, sub, color){
    evq.push({ t: 'announce', x: 0, z: 0, color: color || '#7df9ff',
               text: text, sub: sub || '' });
  }

  /* ---------- morale ---------- */
  function moraleState(){
    if (st.unrest) return 'unrest';
    if (st.morale >= 80) return 'inspired';
    if (st.morale <= 25) return 'despair';
    return 'steady';
  }
  function adjustMorale(d, pid){
    if (!d) return;
    var doc = doctrineOf(pid || 'p0');
    if (doc){
      if (d > 0) d *= num(doc.moraleGain, 1);
      else d *= num(doc.moraleLoss, 1);
    }
    st.morale += d;
    if (st.morale > 100) st.morale = 100;
    if (st.morale <= 0){
      st.morale = 0;
      if (!st.unrest){
        st.unrest = true;
        announce('UNREST', 'no construction until the next wave is cleared. Towers -25% damage.', '#ff5544');
      }
    }
  }
  function moraleDmgMult(){
    if (st.unrest) return 0.75;
    if (st.morale >= 80) return 1.1;
    if (st.morale <= 25) return 0.9;
    return 1;
  }
  function moraleCostMult(){
    var m = 1;
    if (st.morale >= 80) m *= 0.9;
    if (st.morale <= 25) m *= 1.15;
    return m;
  }
  function buildCostMult(){
    var m = st.mods.buildCost * moraleCostMult();
    if (st.costTemp.wavesLeft > 0) m *= st.costTemp.mult;
    return m;
  }

  /* ---------- synergies / buffs ---------- */
  function synergyMult(tw, kind){
    var m = 1, list = tw.activeSynergies || [];
    for (var i = 0; i < list.length; i++){
      var s = sim.synById[list[i]];
      if (s && s.kind === kind) m *= num(s.mult, 1);
    }
    return m;
  }
  function synergyBonus(tw, kind){
    var b = 0, list = tw.activeSynergies || [];
    for (var i = 0; i < list.length; i++){
      var s = sim.synById[list[i]];
      if (s && s.kind === kind) b += num(s.bonus, 0);
    }
    return b;
  }
  function towerById(id){
    for (var k = 0; k < st.towers.length; k++) if (st.towers[k].instId === id) return st.towers[k];
    return null;
  }
  function enemyById(id){
    for (var k = 0; k < st.enemies.length; k++) if (st.enemies[k].id === id) return st.enemies[k];
    return null;
  }
  function d2w(ax, az, bx, bz){ var dx = ax-bx, dz = az-bz; return dx*dx + dz*dz; }

  function recomputeBuffs(){
    var i, t;
    for (i = 0; i < st.towers.length; i++){ st.towers[i].buffDmg = 1; st.towers[i].buffRate = 1; }
    var amps = [], chronos = [];
    for (i = 0; i < st.towers.length; i++){
      t = st.towers[i];
      if (t.dark || !t.powered) continue;
      if (t.def.behavior === 'buff') amps.push(t);
      else if (t.def.behavior === 'field') chronos.push(t);
    }
    var R = CFG.SYNERGY_RADIUS_CELLS * CELL;
    var R2 = R * R;
    for (i = 0; i < st.towers.length; i++){
      t = st.towers[i];
      var beh = t.def.behavior;
      if (beh === 'economy' || beh === 'buff') continue;
      var bestDmg = 1, bestRate = 1, a, c;
      for (a = 0; a < amps.length; a++){
        var am = amps[a];
        if (am.instId === t.instId) continue;
        var ar = num(am.stats.range, 0) * CELL;
        if (d2w(am.x, am.z, t.x, t.z) > ar*ar) continue;
        var sp = am.stats.special || {};
        var supp = supportMultOf(am.ownerId);
        var dm = num(sp.damageMult, 1) * supp, rm = num(sp.rateMult, 1) * supp;
        if (dm > bestDmg) bestDmg = dm;
        if (rm > bestRate) bestRate = rm;
      }
      for (c = 0; c < chronos.length; c++){
        var ch = chronos[c];
        if (ch.instId === t.instId) continue;
        var csp = ch.stats.special || {};
        if (!csp.allyRateMult) continue;
        var cr = num(ch.stats.range, 0) * CELL;
        if (d2w(ch.x, ch.z, t.x, t.z) <= cr*cr) bestRate *= num(csp.allyRateMult, 1.35) * supportMultOf(ch.ownerId);
      }
      t.buffDmg = bestDmg;
      t.buffRate = bestRate;
    }
  }

  function recomputeSynergies(){
    var i, f, g;
    for (i = 0; i < st.towers.length; i++) st.towers[i].activeSynergies = [];
    var R = CFG.SYNERGY_RADIUS_CELLS * CELL;
    var R2 = R * R;
    for (var s = 0; s < SYNERGIES.length; s++){
      var syn = SYNERGIES[s];
      if (!syn || !syn.id || !syn.from) continue;
      var toList = Array.isArray(syn.to) ? syn.to : [syn.to];
      for (f = 0; f < st.towers.length; f++){
        if (st.towers[f].id !== syn.from) continue;
        for (g = 0; g < st.towers.length; g++){
          var tt = st.towers[g];
          if (toList.indexOf(tt.id) < 0) continue;
          if (d2w(st.towers[f].x, st.towers[f].z, tt.x, tt.z) <= R2){
            if (tt.activeSynergies.indexOf(syn.id) < 0) tt.activeSynergies.push(syn.id);
          }
        }
      }
      var anyActive = false;
      for (i = 0; i < st.towers.length; i++){
        if (st.towers[i].activeSynergies.indexOf(syn.id) >= 0){ anyActive = true; break; }
      }
      if (anyActive && !sim.synergyAnnounced[syn.id]){
        sim.synergyAnnounced[syn.id] = true;
        announce('SYNERGY: ' + (syn.name || syn.id), syn.desc || '', '#7df9ff');
      }
    }
  }

  /* ---------- enemies ---------- */
  function spawnEnemy(type, gateIdx, hpMult, bountyMult){
    var def = ENEMIES[type];
    if (!def) return null;
    if (st.enemies.length + st.spawnQueue.length >= CFG.MAX_ENEMIES) return null;
    var ab = def.abilities || {};
    var hp = num(def.hp, 10) * num(hpMult, 1);
    var spd = num(def.speed, 3);
    if (st.surgeActive){
      if (def.affinity === 'hardened'){ hp *= 1.2; spd *= 1.3; }
      else spd *= 1.1;
    }
    var gi = (gateIdx === null || gateIdx === undefined)
      ? Math.floor(rnd() * gates.length) : (gateIdx % gates.length);
    var g = gates[gi] || gates[0];
    var insulated = !!def.insulated;
    if (st.insulatedWaves && (type === 'runner' || type === 'phantom')) insulated = true;
    var golden = rnd() < 0.02;
    var bountyBase = Math.max(1, Math.round(num(def.bounty, 1) * num(bountyMult, 1) * st.mods.bountyMult));
    if (golden) bountyBase *= 5;
    var e = {
      id: ++sim.nextEnemyId, type: type, def: def,
      cx: g.x + 0.5, cz: g.z + 0.5,
      x: cellWX(g.x), z: cellWZ(g.z),
      speed: spd,
      hp: hp, maxHp: hp,
      bounty: bountyBase,
      golden: golden,
      melee: num(def.melee, 5),
      affinity: def.affinity || null, insulated: insulated,
      slowUntil: 0, slowFactor: 1, frozenUntil: 0, stunUntil: 0, untargetUntil: 0,
      shield: num(ab.shield, 0), maxShield: num(ab.shield, 0),
      healT: 0, phaseT: num(ab.phase && ab.phase.every, 6),
      spawnT: num(ab.spawn && ab.spawn.interval, 8),
      allyShieldT: num(ab.allyShield && ab.allyShield.interval, 4),
      enraged: false, dead: false, fieldVuln: null,
      dist: flowDist(g.x, g.z), hitT: 0
    };
    st.enemies.push(e);
    return e;
  }

  function nearestStructure(x, z, rangeCells, kinds){
    var best = null, bestD = rangeCells * rangeCells;
    var lists = [];
    if (!kinds || kinds.indexOf('tower') >= 0) lists.push(st.towers);
    if (!kinds || kinds.indexOf('wall') >= 0) lists.push(st.walls);
    if (!kinds || kinds.indexOf('reactor') >= 0) lists.push(st.reactors);
    for (var l = 0; l < lists.length; l++){
      var arr = lists[l];
      for (var i = 0; i < arr.length; i++){
        var s = arr[i];
        var dx = (s.cx + 0.5) - x / CELL, dz = (s.cz + 0.5) - z / CELL;
        var dd = dx*dx + dz*dz;
        if (dd < bestD){ bestD = dd; best = s; }
      }
    }
    return best;
  }

  function damageSpire(amount, why){
    if (st.over || amount <= 0) return;
    st.hqHp -= amount;
    st.hqDamageWave += amount;
    if (st.hqHp <= 0){
      st.hqHp = 0;
      st.over = true; st.victory = false; st.stars = 0;
      st.defeatReason = why || 'The Command Spire has fallen';
      announce('SPIRE DOWN', st.defeatReason, '#ff5544');
      evq.push({ t: 'boom', x: hqCenterWorld().x, z: hqCenterWorld().z,
                 color: '#ff5544', n: 40, text: 'SPIRE DOWN' });
    }
  }

  function destroyStructure(s, kind){
    var arr = kind === 'tower' ? st.towers : kind === 'wall' ? st.walls : st.reactors;
    for (var i = 0; i < arr.length; i++){
      if (arr[i] === s){ arr.splice(i, 1); break; }
    }
    delete occ[key(s.cx, s.cz)];
    st.stats.structuresLost++;
    st.structsLostWave++;
    if (s.ownerId && st.playerStats[s.ownerId]) st.playerStats[s.ownerId].structuresLost++;
    evq.push({ t: 'structureDown', x: s.x, z: s.z, color: '#ff7744',
               text: (kind === 'wall' ? 'Wall' : kind === 'reactor' ? 'Reactor' : 'Tower') + ' destroyed' });
    if (st.moraleLossStruct < CFG.MORALE_STRUCT_LOSS_CAP){
      st.moraleLossStruct += CFG.MORALE_STRUCT_LOSS;
      adjustMorale(-CFG.MORALE_STRUCT_LOSS, s.ownerId);
    }
    afterLayoutChange();
  }

  function meleeStructure(e, s, kind, dt){
    var dmg = e.melee * dt;
    s.hp -= dmg;
    e.hitT -= dt;
    if (e.hitT <= 0){
      e.hitT = 0.6;
      evq.push({ t: 'wallHit', x: s.x, z: s.z, color: '#ffb347', n: 3 });
    }
    if (s.hp <= 0) destroyStructure(s, kind);
  }

  function meleeSpire(e, dt){
    var dmg = e.melee * dt;
    e.hitT -= dt;
    if (e.hitT <= 0){
      e.hitT = 0.6;
      var hc = hqCenterWorld();
      evq.push({ t: 'wallHit', x: hc.x, z: hc.z, color: '#ff5544', n: 4 });
    }
    damageSpire(dmg, 'The rust breached the Command Spire');
  }

  function healAura(e, heal){
    var r2 = Math.pow(num(heal.radius, 4), 2);
    var amt = num(heal.amount, 6);
    for (var i = 0; i < st.enemies.length; i++){
      var o = st.enemies[i];
      if (o.dead) continue;
      if (d2w(o.x, o.z, e.x, e.z) <= r2) o.hp = Math.min(o.maxHp, o.hp + amt);
    }
  }
  function allyShieldAura(e, as){
    var r2 = Math.pow(num(as.radius, 5), 2);
    var amt = num(as.amount, 100);
    for (var i = 0; i < st.enemies.length; i++){
      var o = st.enemies[i];
      if (o.dead) continue;
      if (d2w(o.x, o.z, e.x, e.z) <= r2){
        o.shield = num(o.shield, 0) + amt;
        if (o.maxShield > 0) o.shield = Math.min(o.shield, o.maxShield);
      }
    }
  }

  function damageEnemy(e, amount, source){
    if (!e || e.dead) return;
    source = source || {};
    var tw = source.tower || null;
    var time = st.time;
    if (e.fieldVuln && time < e.fieldVuln.until) amount *= e.fieldVuln.mult;
    if (tw && st.activeAnomaly && st.activeAnomaly.type === 'solarflare'){
      amount *= num(st.activeAnomaly.dmgMult, 1.25);
    }
    if (tw){
      var slowed = time < e.slowUntil || time < e.frozenUntil;
      var frozen = time < e.frozenUntil;
      if (slowed) amount *= synergyMult(tw, 'dmgVsSlowed');
      if (frozen) amount *= synergyMult(tw, 'dmgVsFrozen');
      var spec = (tw.stats && tw.stats.special) || {};
      var chance = num(spec.critChance, 0);
      if (chance > 0){
        if (slowed) chance += synergyBonus(tw, 'critVsSlowed');
        if (rnd() < chance) amount *= num(spec.critMult, 2);
      }
    }
    if (e.shield > 0 && amount > 0){
      var absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
    }
    if (amount <= 0) return;
    e.hp -= amount;
    if (e.hp <= 0) killEnemy(e, source);
  }

  function killEnemy(e, source){
    e.dead = true;
    var bounty = e.bounty * (st.goldRush ? 1.5 : 1);
    st.gold += bounty;
    st.stats.goldEarned += bounty;
    st.stats.kills++;
    var ownerId = (source && source.tower) ? source.tower.ownerId : null;
    if (ownerId && st.playerStats[ownerId]){
      st.playerStats[ownerId].kills++;
      st.playerStats[ownerId].goldEarned += bounty;
    } else {
      creditGold('p0', bounty);
    }
    evq.push({ t: 'boom', x: e.x, z: e.z, color: e.def.color || '#fff', n: 4 });
    var i, tw;
    for (i = 0; i < st.towers.length; i++){
      tw = st.towers[i];
      if (!tw.def || tw.def.behavior !== 'economy' || tw.dark) continue;
      var sp = (tw.stats && tw.stats.special) || {};
      if (!sp.killGoldBonus) continue;
      var kr = num(sp.killGoldRadius, 7) * CELL;
      if (d2w(tw.x, tw.z, e.x, e.z) <= kr*kr){
        st.gold += sp.killGoldBonus;
        st.stats.goldEarned += sp.killGoldBonus;
        evq.push({ t: 'gold', x: tw.x, z: tw.z, amount: sp.killGoldBonus });
      }
    }
    var ab = (e.def && e.def.abilities) || {};
    if (ab.split && ab.split.into){
      var n = Math.max(1, Math.round(num(ab.split.count, 2)));
      for (var k = 0; k < n; k++){
        var c = spawnEnemy(ab.split.into, null, st.curHpMult, st.curBountyMult);
        if (c){ c.x = e.x + (rnd()-0.5)*CELL; c.z = e.z + (rnd()-0.5)*CELL; }
      }
    }
    if (e.def && e.def.boss){
      st.stats.bossesKilled++;
      announce('BOSS DOWN', '+' + bounty + 'g', '#ff9f43');
      evq.push({ t: 'boom', x: e.x, z: e.z, color: '#ff9f43', n: 24, text: 'BOSS DOWN' });
    }
    /* combo: rolling 3s kill window */
    var now = st.time;
    st.comboTimes.push(now);
    while (st.comboTimes.length && st.comboTimes[0] < now - 3) st.comboTimes.shift();
    var cc = st.comboTimes.length;
    if (cc > st.comboBest) st.comboBest = cc;
    var miles = [10, 20, 30, 50];
    for (var mi = 0; mi < miles.length; mi++){
      if (cc >= miles[mi] && !st.comboMilestones[miles[mi]]){
        st.comboMilestones[miles[mi]] = true;
        announce('RAMPAGE x' + miles[mi], cc + ' kills in 3 seconds', '#ffd34d');
      }
    }
  }

  function updateEnemies(dt){
    var time = st.time;
    var ion = (st.activeAnomaly && st.activeAnomaly.type === 'ionstorm')
      ? num(st.activeAnomaly.speedMult, 1.3) : 1;
    var hc = hqCenterCell();
    var hw = hqCenterWorld();
    var meleeR = CFG.MELEE_RANGE_CELLS * CELL;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead) continue;
      var ab = (e.def && e.def.abilities) || {};

      var m = 1;
      if (time < e.frozenUntil) m = 0;
      else if (time < e.slowUntil && !e.insulated){
        var r = num(ab.slowResist, 0);
        m = 1 - (1 - e.slowFactor) * (1 - r);
        if (m < 0) m = 0;
      }
      if (time < e.stunUntil) m = 0;
      var spdW = e.speed * CELL * m * ion;
      if (e.enraged && ab.enrage) spdW *= num(ab.enrage.speedMult, 1.5);

      var ccx = cellCX(e.x), ccz = cellCZ(e.z);
      var fd = flowDist(ccx, ccz);
      e.dist = fd;

      /* breach check: rust within 3 cells of the spire */
      if (!st.breached){
        var bdx = e.x / CELL - (hc.cx + 0.5), bdz = e.z / CELL - (hc.cz + 0.5);
        if (bdx*bdx + bdz*bdz <= CFG.BREACH_RANGE_CELLS * CFG.BREACH_RANGE_CELLS){
          st.breached = true;
          adjustMorale(-CFG.MORALE_BREACH);
          announce('SPIRE THREATENED', 'rust units within the inner perimeter', '#ff9f43');
        }
      }

      var seeker = e.type === 'sapper' || !!e.seekStructures;
      var acted = false;

      /* melee whatever is adjacent first (structures and fuel barrels) */
      var adj = nearestAttackable(e.x, e.z, CFG.MELEE_RANGE_CELLS);
      if (adj){
        if (adj.kind === 'barrel') damageBarrel(adj.ref, e.melee * dt);
        else meleeStructure(e, adj.ref, adj.kind, dt);
        acted = true;
      }
      /* hero engineer draws attacks within 2 cells */
      var hh = st.hero;
      if (hh && hh.alive){
        var hdx = hh.x - e.x, hdz = hh.z - e.z;
        if (hdx*hdx + hdz*hdz <= Math.pow(2 * CELL, 2)){
          hh.hp -= e.melee * dt;
          e.hitT -= dt;
          if (e.hitT <= 0){
            e.hitT = 0.6;
            evq.push({ t: 'wallHit', x: hh.x, z: hh.z, color: '#ff7744', n: 3 });
          }
          if (hh.hp <= 0){
            hh.alive = false; hh.hp = 0;
            hh.respawnAtWave = st.stats.wavesCleared + 2;
            adjustMorale(-5, null);
            announce('ENGINEER DOWN', '-5 morale. She returns in 2 waves.', '#ff5544');
          }
        }
      }

      if (!acted){
        if (seeker){
          var tgt = nearestStructure(e.x, e.z, CFG.SAPPER_SEEK_RANGE_CELLS);
          if (tgt) moveToward(e, tgt.x, tgt.z, spdW * dt);
          else {
            /* no structures left: converge on the spire like everyone else */
            var sx = hw.x - e.x, sz = hw.z - e.z;
            var sd2 = Math.sqrt(sx*sx + sz*sz);
            if (sd2 <= 3.4) meleeSpire(e, dt);
            else moveToward(e, hw.x, hw.z, spdW * dt);
          }
        } else if (fd < 0){
          var near = nearestStructure(e.x, e.z, CFG.SEEK_RANGE_CELLS);
          if (near) moveToward(e, near.x, near.z, spdW * dt);
          else moveToward(e, hw.x, hw.z, spdW * dt);
        } else if (adjacentToHQ(ccx, ccz)){
          var hdx = hw.x - e.x, hdz = hw.z - e.z;
          var hd = Math.sqrt(hdx*hdx + hdz*hdz);
          if (hd <= 3.4) meleeSpire(e, dt);
          else moveToward(e, hw.x, hw.z, spdW * dt);
        } else {
          var best = null, bestD = fd;
          var nb = [[1,0],[-1,0],[0,1],[0,-1]];
          for (var q = 0; q < 4; q++){
            var nx = ccx + nb[q][0], nz = ccz + nb[q][1];
            var nd = flowDist(nx, nz);
            if (nd >= 0 && nd < bestD){ bestD = nd; best = nb[q]; }
          }
          if (best) moveToward(e, cellWX(ccx + best[0]), cellWZ(ccz + best[1]), spdW * dt);
          else moveToward(e, hw.x, hw.z, spdW * dt);
        }
      }

      e.cx = e.x / CELL; e.cz = e.z / CELL;

      /* abilities */
      if (ab.phase){
        e.phaseT -= dt;
        if (e.phaseT <= 0){
          e.untargetUntil = time + num(ab.phase.duration, 2);
          e.phaseT = num(ab.phase.every, 6);
        }
      }
      if (ab.shieldRegen && e.shield < e.maxShield){
        e.shield = Math.min(e.maxShield,
          e.shield + num(ab.shieldRegen.amount, 1) * dt / Math.max(0.1, num(ab.shieldRegen.interval, 5)));
      }
      if (ab.heal){
        e.healT -= dt;
        if (e.healT <= 0){ e.healT = num(ab.heal.interval, 3); healAura(e, ab.heal); }
      }
      if (ab.allyShield){
        e.allyShieldT -= dt;
        if (e.allyShieldT <= 0){ e.allyShieldT = num(ab.allyShield.interval, 4); allyShieldAura(e, ab.allyShield); }
      }
      if (ab.spawn){
        e.spawnT -= dt;
        if (e.spawnT <= 0){
          e.spawnT = num(ab.spawn.interval, 8);
          var n = Math.max(1, Math.round(num(ab.spawn.count, 1)));
          for (var k = 0; k < n; k++){
            var c2 = spawnEnemy(ab.spawn.type, null, st.curHpMult, st.curBountyMult);
            if (c2){ c2.x = e.x; c2.z = e.z; }
          }
        }
      }
      if (ab.enrage && !e.enraged && e.maxHp > 0 && e.hp <= e.maxHp * num(ab.enrage.hpFrac, 0.3)){
        e.enraged = true;
        announce('ENRAGED', e.def.name + ' fights harder', '#ff5544');
      }
    }
  }

  function moveToward(e, tx, tz, step){
    var dx = tx - e.x, dz = tz - e.z;
    var d = Math.sqrt(dx*dx + dz*dz);
    if (d < 0.001 || step <= 0) return;
    var s = Math.min(step, d);
    e.x += dx / d * s;
    e.z += dz / d * s;
  }

  /* ---------- tower combat ---------- */
  function towerDmgMult(t){
    var m = num(t.buffDmg, 1) * st.mods.towerDmg * moraleDmgMult();
    var d = doctrineOf(t.ownerId);
    if (d) m *= num(d.towerDamage, 1);
    if (t.highGround) m *= 1.1;
    if (st.overclock.active) m *= CFG.OVERCLOCK_DMG;
    if (st.dmgTemp.wavesLeft > 0) m *= st.dmgTemp.mult;
    if (t.veteran === 1) m *= 1.15;
    else if (t.veteran >= 2) m *= 1.3;
    return m;
  }
  function rangeMult(t){ return t.highGround ? 1.15 : 1; }
  function acquireTarget(t){
    var time = st.time;
    /* focus fire: preferred target first if in range */
    if (st.focusId){
      var fe = enemyById(st.focusId);
      if (fe && !fe.dead && time >= fe.untargetUntil){
        var fr = num(t.stats.range, 0) * rangeMult(t) * CELL;
        if (d2w(fe.x, fe.z, t.x, t.z) <= fr * fr){ t.targetId = fe.id; return fe; }
      }
    }
    var rangeW = num(t.stats.range, 0) * rangeMult(t) * CELL;
    var r2 = rangeW * rangeW;
    var best = null, bestDist = Infinity, bestNear = Infinity;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || time < e.untargetUntil) continue;
      var dd = d2w(e.x, e.z, t.x, t.z);
      if (dd > r2) continue;
      var fd = e.dist < 0 ? 1e9 : e.dist;
      if (fd < bestDist || (fd === bestDist && dd < bestNear)){
        bestDist = fd; bestNear = dd; best = e;
      }
    }
    t.targetId = best ? best.id : null;
    return best;
  }

  function fireProjectile(t, tgt, dmg){
    if (st.projectiles.length >= 400) return;
    var pierce = num((t.stats.special || {}).pierce, 0);
    var beam = !!(t.stats.special || {}).beam;
    if (beam){
      st.beams.push({ x1: t.x, z1: t.z, x2: tgt.x, z2: tgt.z, ttl: 0.18,
                      color: (t.def && t.def.color) || '#fff' });
      if (pierce > 0){
        var dx = tgt.x - t.x, dz = tgt.z - t.z;
        var len = Math.sqrt(dx*dx + dz*dz) || 1;
        var rangeW = num(t.stats.range, 0) * CELL;
        var ex = t.x + dx / len * rangeW, ez = t.z + dz / len * rangeW;
        var hitN = 0;
        for (var i = 0; i < st.enemies.length && hitN < pierce; i++){
          var e = st.enemies[i];
          if (e.dead || st.time < e.untargetUntil) continue;
          var px = e.x - t.x, pz = e.z - t.z;
          var along = (px*dx + pz*dz) / len;
          if (along < 0 || along > rangeW) continue;
          var perp = Math.abs(px*dz - pz*dx) / len;
          if (perp < CELL * 0.8){ damageEnemy(e, dmg, { tower: t }); hitN++; }
        }
        st.beams[st.beams.length-1].x2 = ex;
        st.beams[st.beams.length-1].z2 = ez;
      } else {
        damageEnemy(tgt, dmg, { tower: t });
      }
      return;
    }
    st.projectiles.push({
      x: t.x, z: t.z, tx: tgt.x, tz: tgt.z,
      targetId: tgt.id, speed: Math.max(1, num(t.def.projSpeed, 40)) * CELL,
      damage: dmg, pierce: pierce, src: t.instId,
      color: (t.def && t.def.projColor) || '#fff'
    });
  }

  function auraTick(t, spec, rangeCells){
    var time = st.time;
    var rW = rangeCells * CELL, r2 = rW * rW;
    var sf = num(spec.slowFactor, 0.5);
    var sd = num(spec.slowDuration, 2);
    var fc = num(spec.freezeChance, 0);
    var fd = num(spec.freezeDuration, 1);
    var auraDmg = num(t.stats.damage, 0) * towerDmgMult(t);
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || time < e.untargetUntil) continue;
      if (d2w(e.x, e.z, t.x, t.z) > r2) continue;
      if (auraDmg > 0) damageEnemy(e, auraDmg, { tower: t });
      if (e.dead || e.insulated) continue;
      if (time >= e.slowUntil) e.slowFactor = sf;
      else if (sf < e.slowFactor) e.slowFactor = sf;
      e.slowUntil = time + sd;
      if (rnd() < fc) e.frozenUntil = time + fd;
    }
  }

  function chainLightning(t, first, spec){
    var time = st.time;
    var chains = Math.max(1, Math.round(num(spec.chains, 3)));
    var chainRange = num(spec.chainRange, 6) * CELL;
    var falloff = num(spec.falloff, 0.7);
    var stunChance = num(spec.stunChance, 0);
    var stunDur = num(spec.stunDuration, 1);
    var base = num(t.stats.damage, 0) * towerDmgMult(t);
    var hit = {};
    var px = t.x, pz = t.z;
    var cur = first;
    var color = (t.def && t.def.color) || '#9df';
    for (var i = 0; i < chains && cur; i++){
      damageEnemy(cur, base * Math.pow(falloff, i), { tower: t });
      if (rnd() < stunChance) cur.stunUntil = Math.max(cur.stunUntil, time + stunDur);
      st.beams.push({ x1: px, z1: pz, x2: cur.x, z2: cur.z, ttl: 0.18, color: color });
      hit[cur.id] = true;
      px = cur.x; pz = cur.z;
      var b2 = chainRange * chainRange;
      var best = null, bestD = b2;
      for (var j = 0; j < st.enemies.length; j++){
        var e = st.enemies[j];
        if (e.dead || hit[e.id] || time < e.untargetUntil) continue;
        var dd = d2w(e.x, e.z, px, pz);
        if (dd < bestD){ bestD = dd; best = e; }
      }
      cur = best;
    }
  }

  function explodeAt(tw, x, z, dmg, splashCells, color){
    evq.push({ t: 'boom', x: x, z: z, color: color, n: 8 });
    var splashW = splashCells * CELL;
    var r2 = splashW * splashW;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead) continue;
      var dd = d2w(e.x, e.z, x, z);
      if (dd > r2) continue;
      var mult = Math.sqrt(dd) <= splashW * 0.5 ? 1 : 0.5;
      damageEnemy(e, dmg * mult, { tower: tw });
    }
  }

  function lobShot(t, tgt, spec){
    var time = st.time;
    var tx = tgt.x, tz = tgt.z;
    var travel = Math.sqrt(d2w(t.x, t.z, tx, tz)) / (Math.max(1, num(t.def.projSpeed, 30)) * CELL);
    var dmg = num(t.stats.damage, 0) * towerDmgMult(t);
    var splash = num(spec.splash, 2.5);
    var color = (t.def && t.def.color) || '#fa3';
    var subs = Math.max(0, Math.round(num(spec.submunitions, 0)));
    var subSplash = num(spec.subSplash, splash * 0.6);
    var tExp = time + travel;
    st.delayed.push({ at: tExp, fn: function(){
      explodeAt(t, tx, tz, dmg, splash, color);
      for (var k = 0; k < subs; k++){
        (function(ox, oz){
          st.delayed.push({ at: tExp + 0.25, fn: function(){
            explodeAt(t, tx + ox, tz + oz, dmg * 0.5, subSplash, color);
          }});
        })((rnd() - 0.5) * splash * CELL, (rnd() - 0.5) * splash * CELL);
      }
    }});
  }

  function fieldTick(t, spec, rangeCells){
    var time = st.time;
    var rW = rangeCells * CELL, r2 = rW * rW;
    var sf = num(spec.slowFactor, 0.6);
    var vuln = num(spec.damageTakenMult, 0);
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || e.insulated) continue;
      if (d2w(e.x, e.z, t.x, t.z) > r2) continue;
      if (time >= e.slowUntil) e.slowFactor = sf;
      else if (sf < e.slowFactor) e.slowFactor = sf;
      e.slowUntil = time + 0.2;
      if (vuln > 0) e.fieldVuln = { mult: vuln, until: time + 0.2 };
    }
  }

  function updateTowers(dt){
    for (var i = 0; i < st.towers.length; i++){
      var t = st.towers[i];
      if (t.dark || !t.powered) continue;
      var beh = t.def.behavior;
      if (beh === 'economy' || beh === 'buff') continue;
      var spec = t.stats.special || {};
      var rate = Math.max(0.05, num(t.stats.fireRate, 1) * num(t.buffRate, 1));
      if (beh === 'projectile'){
        t.cooldown -= dt;
        if (t.cooldown > 0) continue;
        var tgt = acquireTarget(t);
        if (!tgt) continue;
        var dmg = num(t.stats.damage, 0) * towerDmgMult(t);
        if ((st.time < tgt.slowUntil || st.time < tgt.frozenUntil) && !tgt.insulated){
          rate *= synergyMult(t, 'rateVsSlowed');
        }
        fireProjectile(t, tgt, dmg);
        t.cooldown = 1 / rate;
        t.angle = Math.atan2(tgt.z - t.z, tgt.x - t.x);
      } else if (beh === 'aura'){
        t.auraT = num(t.auraT, 0) + dt;
        if (t.auraT < num(spec.tick, 0.5)) continue;
        t.auraT = 0;
        auraTick(t, spec, num(spec.radius, num(t.stats.range, 0)) * rangeMult(t));
      } else if (beh === 'chain'){
        t.cooldown -= dt;
        if (t.cooldown > 0) continue;
        var first = acquireTarget(t);
        if (!first) continue;
        chainLightning(t, first, spec);
        t.cooldown = 1 / rate;
        t.angle = Math.atan2(first.z - t.z, first.x - t.x);
      } else if (beh === 'lobbed'){
        t.cooldown -= dt;
        if (t.cooldown > 0) continue;
        var lt = acquireTarget(t);
        if (!lt) continue;
        var minR = num(spec.minRange, 0) * CELL;
        if (d2w(lt.x, lt.z, t.x, t.z) < minR * minR) continue;
        lobShot(t, lt, spec);
        t.cooldown = 1 / rate;
        t.angle = Math.atan2(lt.z - t.z, lt.x - t.x);
      } else if (beh === 'field'){
        fieldTick(t, spec, num(spec.radius, num(t.stats.range, 0)) * rangeMult(t));
      }
    }
  }

  function updateProjectiles(dt){
    for (var i = st.projectiles.length - 1; i >= 0; i--){
      var p = st.projectiles[i];
      var tgt = enemyById(p.targetId);
      var alive = tgt && !tgt.dead;
      if (alive){ p.tx = tgt.x; p.tz = tgt.z; }
      var dx = p.tx - p.x, dz = p.tz - p.z;
      var d = Math.sqrt(dx*dx + dz*dz);
      var step = p.speed * dt;
      var hitR = 1.2;
      if (d <= step + hitR || d < 0.2){
        if (alive){
          damageEnemy(tgt, p.damage, { tower: towerById(p.src) });
          if (p.pierce > 0){
            p.pierce--;
            p.targetId = -1;
            var best = null, bestD = 4 * CELL * CELL;
            for (var j = 0; j < st.enemies.length; j++){
              var e = st.enemies[j];
              if (e.dead || e.id === tgt.id || st.time < e.untargetUntil) continue;
              var dd = d2w(e.x, e.z, p.tx, p.tz);
              if (dd < bestD){ bestD = dd; best = e; }
            }
            if (best){ p.targetId = best.id; p.tx = best.x; p.tz = best.z; continue; }
          }
        }
        st.projectiles.splice(i, 1);
      } else {
        p.x += dx / d * step;
        p.z += dz / d * step;
      }
    }
  }

  /* ---------- fuel barrels ---------- */
  function explodeBarrel(b){
    if (!b.alive) return;
    b.alive = false;
    evq.push({ t: 'boom', x: b.x, z: b.z, color: '#ff6b35', n: 20, text: 'BARREL' });
    announce('BARREL DETONATED', 'fuel explosion', '#ff6b35');
    var rW = 3 * CELL, r2 = rW * rW;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead) continue;
      if (d2w(e.x, e.z, b.x, b.z) <= r2) damageEnemy(e, 60, { barrel: true });
    }
    for (var j = 0; j < st.barrels.length; j++){
      var o = st.barrels[j];
      if (o === b || !o.alive) continue;
      if (d2w(o.x, o.z, b.x, b.z) <= r2){
        o.hp -= 40;
        if (o.hp <= 0) explodeBarrel(o);
      }
    }
  }
  function damageBarrel(b, dmg){
    if (!b.alive) return;
    b.hp -= dmg;
    if (b.hp <= 0) explodeBarrel(b);
  }
  function detonateBarrel(id){
    for (var i = 0; i < st.barrels.length; i++){
      if (st.barrels[i].id === id){
        if (!st.barrels[i].alive) return { ok: false, reason: 'spent' };
        explodeBarrel(st.barrels[i]);
        return { ok: true };
      }
    }
    return { ok: false, reason: 'barrel' };
  }
  function nearestAttackable(x, z, rangeCells){
    var best = null, bestKind = null, bestD = rangeCells * rangeCells;
    function consider(arr, kind){
      for (var i = 0; i < arr.length; i++){
        var s = arr[i];
        if (kind === 'barrel' && !s.alive) continue;
        var dx = (s.cx + 0.5) - x / CELL, dz = (s.cz + 0.5) - z / CELL;
        var dd = dx*dx + dz*dz;
        if (dd < bestD){ bestD = dd; best = s; bestKind = kind; }
      }
    }
    consider(st.towers, 'tower');
    consider(st.walls, 'wall');
    consider(st.reactors, 'reactor');
    consider(st.barrels, 'barrel');
    return best ? { ref: best, kind: bestKind } : null;
  }

  /* ---------- supply drops ---------- */
  function spawnDrop(){
    for (var tries = 0; tries < 50; tries++){
      var cx = Math.floor(rnd() * COLS), cz = Math.floor(rnd() * ROWS);
      if (!isBuildable(cx, cz)) continue;
      var d = { id: 'drop' + (++sim.nextDropId), x: cellWX(cx), z: cellWZ(cz),
                amount: 100, expiresAt: st.time + 45 };
      st.drops.push(d);
      announce('SUPPLY DROP', '+100g crate landed nearby', '#4ade80');
      return;
    }
  }
  function collectDrop(id){
    for (var i = 0; i < st.drops.length; i++){
      if (st.drops[i].id === id){
        var d = st.drops.splice(i, 1)[0];
        st.gold += d.amount;
        st.stats.goldEarned += d.amount;
        creditGold('p0', d.amount);
        evq.push({ t: 'gold', x: d.x, z: d.z, amount: d.amount });
        return { ok: true, gold: d.amount };
      }
    }
    return { ok: false, reason: 'drop' };
  }

  /* ---------- hero engineer ---------- */
  function updateHero(dt){
    var h = st.hero;
    if (!h) return;
    if (!h.alive){
      if (h.respawnAtWave >= 0 && st.stats.wavesCleared >= h.respawnAtWave){
        h.alive = true; h.hp = h.maxHp;
        var hw = hqCenterWorld(); h.x = hw.x; h.z = hw.z;
        announce('ENGINEER RETURNS', 'the hero engineer is back on the walls', '#4ade80');
      }
      return;
    }
    var best = null, bestFrac = 1;
    for (var i = 0; i < st.walls.length; i++){
      var w = st.walls[i];
      var dx = (w.cx + 0.5) - h.x / CELL, dz = (w.cz + 0.5) - h.z / CELL;
      if (dx*dx + dz*dz > 100) continue;
      var frac = w.hp / w.maxHp;
      if (frac < bestFrac && frac < 1){ bestFrac = frac; best = w; }
    }
    if (best){
      var ddx = best.x - h.x, ddz = best.z - h.z;
      var d = Math.sqrt(ddx*ddx + ddz*ddz);
      if (d <= 1.5 * CELL){
        best.hp = Math.min(best.maxHp, best.hp + 10 * dt);
      } else if (d > 0.01){
        var step = 3 * CELL * dt;
        h.x += ddx / d * Math.min(step, d);
        h.z += ddz / d * Math.min(step, d);
      }
    }
  }

  /* ---------- anomalies ---------- */
  function applyAnomaly(type){
    var time = st.time;
    st.stats.anomaliesSeen++;
    var names = { meteor: 'ORBITAL STRIKE', goldrush: 'SALVAGE SURGE', elite: 'ELITE CADRE',
                  ionstorm: 'ION STORM', solarflare: 'EMP BURST' };
    var label = names[type] || String(type).toUpperCase();
    if (type === 'meteor'){
      announce('ORBITAL STRIKE', 'kinetic rods inbound', '#ff9f43');
      st.delayed.push({ at: time + 2, fn: function(){
        var px = (8 + rnd() * (COLS - 16)) * CELL;
        var pz = (8 + rnd() * (ROWS - 16)) * CELL;
        var rW = 6 * CELL, r2 = rW * rW;
        for (var i = 0; i < st.enemies.length; i++){
          var e = st.enemies[i];
          if (e.dead) continue;
          if (d2w(e.x, e.z, px, pz) <= r2) damageEnemy(e, 240, { anomaly: true });
        }
        evq.push({ t: 'boom', x: px, z: pz, color: '#ff9f43', n: 30, text: 'ORBITAL STRIKE' });
      }});
    } else if (type === 'goldrush'){
      st.goldRush = true;
      announce('SALVAGE SURGE', 'double bounties this wave', '#ffd34d');
      for (var i = 0; i < 10; i++){
        st.spawnQueue.push({ type: 'mite', at: time + i * 0.8, gate: null,
                             hpMult: st.curHpMult, bountyMult: st.curBountyMult });
      }
      st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    } else if (type === 'elite'){
      announce('ELITE CADRE INBOUND', '', '#ff5544');
      for (var j = 0; j < 4; j++){
        st.spawnQueue.push({ type: 'tank', at: time + j * 0.5, gate: null,
                             hpMult: st.curHpMult, bountyMult: st.curBountyMult });
      }
      st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    } else if (type === 'ionstorm'){
      st.activeAnomaly = { type: 'ionstorm', speedMult: 1.3, until: time + 25 };
      announce('ION STORM', 'rust units move faster', '#7df9ff');
    } else if (type === 'solarflare'){
      st.activeAnomaly = { type: 'solarflare', dmgMult: 1.25, until: time + 25 };
      announce('EMP BURST', 'towers deal bonus damage', '#ffb347');
    } else {
      announce(label, '', '#8fa3b8');
    }
  }

  /* ---------- wave control ---------- */
  function mintIncomeActive(tw){
    return tw.def && tw.def.behavior === 'economy' && !tw.dark;
  }

  function startWave(){
    if (st.over) return { ok: false, reason: 'over' };
    if (st.pendingEvent || st.pendingEdict) return { ok: false, reason: 'event' };
    if (st.waveActive) return { ok: false, reason: 'wave' };
    if (st.waveIndex >= st.wavesTotal) return { ok: false, reason: 'over' };
    var wave = waves[st.waveIndex];
    if (!wave) return { ok: false, reason: 'over' };

    if (st.intermission > 1){
      var eb = CFG.EARLY_BASE + CFG.EARLY_PER_SEC * Math.ceil(st.intermission);
      st.gold += eb;
      st.stats.goldEarned += eb;
      announce('EARLY START +' + eb + 'g', '', '#ffd34d');
    }
    var rate = CFG.INTEREST_RATE;
    var i, tw;
    for (i = 0; i < st.towers.length; i++){
      tw = st.towers[i];
      if (mintIncomeActive(tw)) rate += num((tw.stats.special || {}).interestBoost, 0);
    }
    var ib = Math.floor(st.gold * rate);
    if (ib > 0){
      st.gold += ib;
      st.stats.goldEarned += ib;
      evq.push({ t: 'gold', x: 20, z: 10, amount: ib });
    }
    for (i = 0; i < st.towers.length; i++){
      tw = st.towers[i];
      if (!mintIncomeActive(tw)) continue;
      var per = num((tw.stats.special || {}).perWave, 0);
      if (per <= 0) continue;
      var payout = Math.floor(per * synergyMult(tw, 'mintBoost') * supportMultOf(tw.ownerId));
      if (payout > 0){
        st.gold += payout;
        st.stats.goldEarned += payout;
        evq.push({ t: 'gold', x: tw.x, z: tw.z, amount: payout });
      }
    }

    st.curHpMult = num(wave.hpMult, 1) * st.nextWaveHpMult;
    st.nextWaveHpMult = 1;
    st.curBountyMult = num(wave.bountyMult, 1);
    /* multiplayer scaling: more commanders, more rust */
    var nPlayers = Math.max(1, st.players.length);
    var countScale = 1 + 0.35 * (nPlayers - 1);
    st.curHpMult *= 1 + 0.25 * (nPlayers - 1);
    st.spawnQueue = [];
    var t0 = st.time;
    var groups = wave.enemies || [];
    for (i = 0; i < groups.length; i++){
      var g = groups[i];
      var count = Math.max(0, Math.round(num(g.count, 0) * countScale));
      var gap = num(g.gap, 1);
      var delay = num(g.delay, 0);
      for (var k = 0; k < count; k++){
        st.spawnQueue.push({ type: g.type, at: t0 + delay + k * gap, gate: g.gate,
                             hpMult: st.curHpMult, bountyMult: st.curBountyMult });
      }
    }
    st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    st.waveActive = true;
    st.intermission = 0;
    st.goldRush = false;
    st.moraleLossStruct = 0;
    st.breached = false;
    st.hqDamageWave = 0;
    st.structsLostWave = 0;
    st.comboMilestones = {};
    st.comboTimes = [];
    /* fuel barrels reset each wave */
    for (var bi = 0; bi < st.barrels.length; bi++){
      st.barrels[bi].alive = true;
      st.barrels[bi].hp = st.barrels[bi].maxHp;
    }
    /* supply drop every 3rd wave */
    if ((st.waveIndex + 1) % 3 === 0) spawnDrop();
    announce('WAVE ' + (st.waveIndex + 1), wave.note || '', '#ffffff');

    /* rust probe waves: fast seeker pack, narrated */
    var probeWaves = sd.probeWaves || [5, 11];
    if (probeWaves.indexOf(st.waveIndex + 1) >= 0){
      for (var pk = 0; pk < 6; pk++){
        st.spawnQueue.push({ type: 'runner', at: t0 + 3 + pk * 0.8, gate: null,
                             hpMult: st.curHpMult, bountyMult: st.curBountyMult,
                             seekStructures: true });
      }
      st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
      announce('The Rust is probing', 'scout pack testing your defenses', '#ff9f43');
    }

    if (surges.indexOf(st.waveIndex) >= 0){
      st.surgeActive = true;
      recomputeDark();
      announce('BLACKOUT SURGE', 'uplink radius -3. Hardened rust surges.', '#b388ff');
    }
    for (var a = 0; a < anomalies.length; a++){
      if (num(anomalies[a].wave, -1) === st.waveIndex) applyAnomaly(anomalies[a].type);
    }
    return { ok: true };
  }

  function callEarly(){
    if (!st.waveActive || st.over) return { ok: false };
    var t0 = st.time;
    st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    for (var i = 0; i < st.spawnQueue.length; i++) st.spawnQueue[i].at = t0 + i * 0.15;
    st.gold += 5;
    st.stats.goldEarned += 5;
    announce('CALL EARLY +5g', 'remaining rust rushed in', '#ffd34d');
    return { ok: true };
  }

  function offerEvent(){
    var pool = [];
    for (var i = 0; i < EVENTS.length; i++){
      if (st.usedEvents.indexOf(EVENTS[i].id) < 0) pool.push(EVENTS[i]);
    }
    if (!pool.length) return;
    var ev = pool[Math.floor(rnd() * pool.length)];
    st.pendingEvent = ev.id;
    st.usedEvents.push(ev.id);
    announce('CROSSROADS', ev.title + ': choose at the command console', '#7df9ff');
  }
  function getEvent(){
    if (!st.pendingEvent) return null;
    for (var i = 0; i < EVENTS.length; i++){
      if (EVENTS[i].id === st.pendingEvent) return EVENTS[i];
    }
    return null;
  }
  function applyEventEffects(fx, playerId){
    if (!fx) return;
    if (typeof fx.gold === 'number'){
      st.gold += fx.gold;
      if (st.gold < 0) st.gold = 0;
      if (fx.gold > 0) st.stats.goldEarned += fx.gold;
      creditGold(playerId, fx.gold);
    }
    if (typeof fx.morale === 'number') adjustMorale(fx.morale, playerId);
    if (fx.uplinkTemp){
      st.uplinkTemp = { cells: num(fx.uplinkTemp.cells, 0),
                        wavesLeft: Math.max(1, Math.round(num(fx.uplinkTemp.waves, 1))) };
      recomputeDark();
    }
    if (fx.freeTowers){
      for (var i = 0; i < fx.freeTowers.length; i++){
        var id = fx.freeTowers[i];
        st.freeBuilds[id] = num(st.freeBuilds[id], 0) + 1;
      }
    }
    if (typeof fx.nextWaveMult === 'number') st.nextWaveHpMult *= fx.nextWaveMult;
    if (typeof fx.reactorBoost === 'number') st.reactorBoost += fx.reactorBoost;
    if (fx.costMultTemp){
      st.costTemp = { mult: num(fx.costMultTemp.mult, 1),
                      wavesLeft: Math.max(1, Math.round(num(fx.costMultTemp.waves, 1))) };
    }
    if (fx.dmgMultTemp){
      st.dmgTemp = { mult: num(fx.dmgMultTemp.mult, 1),
                     wavesLeft: Math.max(1, Math.round(num(fx.dmgMultTemp.waves, 1))) };
    }
  }
  function chooseEvent(choiceId, playerId){
    playerId = playerId || 'p0';
    var ev = getEvent();
    if (!ev) return { ok: false, reason: 'none' };
    var choice = null;
    for (var i = 0; i < ev.choices.length; i++){
      if (ev.choices[i].id === choiceId) choice = ev.choices[i];
    }
    if (!choice) return { ok: false, reason: 'choice' };
    applyEventEffects(choice.effects, playerId);
    st.pendingEvent = null;
    st.decisions.push({ eventId: ev.id, choiceId: choiceId, waveIndex: st.lastCleared });
    return { ok: true, outcomeText: choice.outcome || '' };
  }

  function offerEdict(){
    var pool = [];
    for (var i = 0; i < EDICTS.length; i++){
      if (st.usedEdicts.indexOf(EDICTS[i].id) < 0) pool.push(EDICTS[i]);
    }
    if (!pool.length) return;
    var a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    var b = pool.length ? pool.splice(Math.floor(rnd() * pool.length), 1)[0] : null;
    st.pendingEdict = { pair: b ? [a.id, b.id] : [a.id] };
    announce('EDICT', 'the council demands a decree: pick one', '#ffd34d');
  }
  function getEdictOffer(){
    if (!st.pendingEdict) return null;
    var out = [];
    for (var i = 0; i < st.pendingEdict.pair.length; i++){
      var id = st.pendingEdict.pair[i];
      for (var j = 0; j < EDICTS.length; j++){
        if (EDICTS[j].id === id){ out.push(EDICTS[j]); break; }
      }
    }
    return { pair: out };
  }
  function chooseEdict(id, playerId){
    playerId = playerId || 'p0';
    if (!st.pendingEdict) return { ok: false, reason: 'none' };
    if (st.pendingEdict.pair.indexOf(id) < 0) return { ok: false, reason: 'choice' };
    var ed = null;
    for (var j = 0; j < EDICTS.length; j++){
      if (EDICTS[j].id === id){ ed = EDICTS[j]; break; }
    }
    if (!ed) return { ok: false, reason: 'choice' };
    var m = ed.modifiers || {};
    if (typeof m.towerDmg === 'number') st.mods.towerDmg *= m.towerDmg;
    if (typeof m.moralePerClear === 'number') st.mods.moralePerClear += m.moralePerClear;
    if (typeof m.structRegen === 'number') st.mods.structRegen += m.structRegen;
    if (typeof m.buildCost === 'number') st.mods.buildCost *= m.buildCost;
    if (typeof m.darkBonus === 'number') st.mods.darkBonus += m.darkBonus;
    if (typeof m.bountyMult === 'number') st.mods.bountyMult *= m.bountyMult;
    if (typeof m.strainMult === 'number') st.mods.strainMult *= m.strainMult;
    if (typeof m.flawlessMorale === 'number') st.mods.flawlessMorale = m.flawlessMorale;
    if (typeof m.wallHp === 'number' && m.wallHp !== 1){
      st.mods.wallHp *= m.wallHp;
      for (var w = 0; w < st.walls.length; w++){
        st.walls[w].maxHp *= m.wallHp;
        st.walls[w].hp *= m.wallHp;
      }
    }
    if (m.immediate){
      if (typeof m.immediate.gold === 'number'){
        st.gold += m.immediate.gold;
        if (st.gold < 0) st.gold = 0;
      }
      if (typeof m.immediate.morale === 'number') adjustMorale(m.immediate.morale, playerId);
    }
    st.edicts.push(id);
    st.usedEdicts.push(id);
    st.pendingEdict = null;
    recomputeDark();
    announce('EDICT SIGNED', ed.name, '#ffd34d');
    return { ok: true };
  }

  /* ---------- the Director (lite) ---------- */
  function evaluateDirector(waveNo){
    if (waveNo !== 8 && waveNo !== 14 && waveNo !== 20) return;
    var i, w, gi;
    var frostN = 0;
    for (i = 0; i < st.towers.length; i++) if (st.towers[i].id === 'frost') frostN++;
    /* narrated rust director adaptations */
    if (frostN >= 3 && !st.directorDone.insulated){
      st.directorDone.insulated = true;
      st.insulatedWaves = true;
      announce('The Rust adapts', 'insulated husks inbound. It learned your cryo pattern.', '#ff9f43');
    }
    if (st.walls.length >= 40 && !st.directorDone.sappers){
      st.directorDone.sappers = true;
      for (var k = 1; k <= 3; k++){
        w = waves[st.waveIndex + k - 1 + 1];
        if (w) w.enemies.push({ type: 'sapper', count: 6, gap: 1, delay: 5, gate: null });
      }
      announce('The Rust adapts', 'sapper broods inbound. It is coming for your walls.', '#ff9f43');
    }
    if (st.gold > 2500 && !st.directorDone.bolder){
      st.directorDone.bolder = true;
      for (gi = st.waveIndex + 1; gi < waves.length; gi++){
        w = waves[gi];
        for (var e2 = 0; e2 < w.enemies.length; e2++){
          w.enemies[e2].count = Math.ceil(w.enemies[e2].count * 1.15);
        }
      }
      announce('The Rust adapts', 'the swarm grows bolder. Greater numbers incoming.', '#ff9f43');
    }
  }

  function checkWaveEnd(){
    if (!st.waveActive || st.over) return;
    if (st.spawnQueue.length > 0) return;
    if (st.enemies.length > 0) return;
    var cleared = st.waveIndex;
    st.waveActive = false;
    st.goldRush = false;
    st.stats.wavesCleared++;
    var bonus = 20 + cleared * 2;
    st.gold += bonus;
    st.stats.goldEarned += bonus;
    evq.push({ t: 'gold', x: 30, z: 8, amount: bonus });
    announce('WAVE ' + (cleared + 1) + ' CLEARED', '+' + bonus + 'g', '#4ade80');

    /* style grade: S flawless, A no HQ damage, B <10% HQ damage, else C */
    var grade;
    if (st.hqDamageWave <= 0 && st.structsLostWave === 0) grade = 'S';
    else if (st.hqDamageWave <= 0) grade = 'A';
    else if (st.hqDamageWave < st.hqMaxHp * 0.10) grade = 'B';
    else grade = 'C';
    st.grades.push(grade);
    st.lastGrade = grade;
    announce('STYLE ' + grade, 'wave ' + (cleared + 1) + ' graded', '#e9d5ff');

    if (st.surgeActive){
      st.surgeActive = false;
      recomputeDark();
      st.gold += CFG.SURGE_REWARD_GOLD;
      st.stats.goldEarned += CFG.SURGE_REWARD_GOLD;
      st.stats.surgesSurvived++;
      adjustMorale(CFG.SURGE_REWARD_MORALE);
      announce('SURGE WEATHERED', '+' + CFG.SURGE_REWARD_GOLD + 'g, +' +
               CFG.SURGE_REWARD_MORALE + ' morale', '#b388ff');
    }

    /* veterancy */
    for (var i = 0; i < st.towers.length; i++){
      var t = st.towers[i];
      t.wavesAlive++;
      var v = t.wavesAlive >= 10 ? 2 : t.wavesAlive >= 5 ? 1 : 0;
      if (v > t.veteran){
        t.veteran = v;
        announce((t.def.name || t.id).toUpperCase() + (v === 2 ? ' ELITE' : ' VETERAN'),
                 v === 2 ? '+30% damage' : '+15% damage', '#ffd34d');
      }
    }

    /* morale from the wave */
    var flawless = st.hqDamageWave <= 0 && st.structsLostWave === 0;
    var delta = (flawless ? st.mods.flawlessMorale : CFG.MORALE_CLEAR) + st.mods.moralePerClear;
    adjustMorale(delta);

    /* temp effects tick down */
    if (st.uplinkTemp.wavesLeft > 0){
      st.uplinkTemp.wavesLeft--;
      if (st.uplinkTemp.wavesLeft <= 0){ st.uplinkTemp.cells = 0; recomputeDark(); }
    }
    if (st.costTemp.wavesLeft > 0){
      st.costTemp.wavesLeft--;
      if (st.costTemp.wavesLeft <= 0) st.costTemp.mult = 1;
    }
    if (st.dmgTemp.wavesLeft > 0){
      st.dmgTemp.wavesLeft--;
      if (st.dmgTemp.wavesLeft <= 0) st.dmgTemp.mult = 1;
    }

    /* unrest lifts after a cleared wave */
    if (st.unrest){
      st.unrest = false;
      st.morale = 30;
      announce('ORDER RESTORED', 'construction resumes. Morale at 30.', '#4ade80');
    }

    st.lastCleared = cleared;

    /* story events (fixed ids) take precedence over random crossroads */
    var storyEvents = sd.storyEvents || {};
    var storyId = storyEvents[cleared];
    var storyOk = false;
    if (storyId){
      for (var se = 0; se < EVENTS.length; se++){
        if (EVENTS[se].id === storyId && st.usedEvents.indexOf(storyId) < 0){
          st.pendingEvent = storyId;
          st.usedEvents.push(storyId);
          announce('CROSSROADS', EVENTS[se].title + ': choose at the command console', '#7df9ff');
          storyOk = true;
          break;
        }
      }
    }
    if (!storyOk && eventWaves.indexOf(cleared) >= 0) offerEvent();
    if (edictsAt.indexOf(cleared) >= 0) offerEdict();
    evaluateDirector(cleared + 1);

    if (cleared >= st.wavesTotal - 1){
      st.over = true;
      st.victory = true;
      var lost = st.hqMaxHp - st.hqHp;
      st.stars = lost <= 0 ? 3 : (lost <= st.hqMaxHp * 0.25 ? 2 : 1);
      announce('BASTION HOLDS', st.stars + ' stars', '#ffd34d');
    } else {
      st.waveIndex = cleared + 1;
      st.intermission = CFG.INTERMISSION;
      /* ages advance at wave thirds */
      var n = st.wavesTotal;
      var newAge = st.waveIndex >= Math.floor(2 * n / 3) ? 2
                 : st.waveIndex >= Math.floor(n / 3) ? 1 : 0;
      if (newAge > st.age){
        st.age = newAge;
        var ageName = (AGES[newAge] || 'Age').toUpperCase() + ' AGE';
        announce(ageName, 'new options unlocked', '#ffd34d');
      }
    }
  }

  /* ---------- players + doctrines ---------- */
  var DOCTRINES = NB.DOCTRINES || {};
  var AGES = NB.AGES || ['Reclamation', 'Fortification', 'Dominion'];

  st.players = [];
  st.playerStats = {};
  st.decisions = [];
  st.age = 0;
  st.lastCleared = -1;

  function playerById(pid){
    for (var i = 0; i < st.players.length; i++){
      if (st.players[i].id === pid) return st.players[i];
    }
    return null;
  }
  function doctrineOf(pid){
    var p = playerById(pid);
    if (p && DOCTRINES[p.doctrine]) return DOCTRINES[p.doctrine];
    return null;
  }
  function supportMultOf(pid){
    var d = doctrineOf(pid);
    return d ? num(d.supportMult, 1) : 1;
  }
  function addPlayer(cfg){
    cfg = cfg || {};
    var id = cfg.id || ('p' + st.players.length);
    if (playerById(id)) return { ok: false, reason: 'exists' };
    var doctrine = DOCTRINES[cfg.doctrine] ? cfg.doctrine : 'vanguard';
    var p = { id: id, name: cfg.name || id, color: cfg.color || '#7df9ff',
              doctrine: doctrine, isAI: !!cfg.isAI };
    st.players.push(p);
    st.playerStats[id] = { kills: 0, goldEarned: 0, wallsBuilt: 0, structuresLost: 0 };
    return { ok: true, player: p };
  }
  function creditGold(pid, amount){
    if (!pid || !st.playerStats[pid]) pid = 'p0';
    if (!st.playerStats[pid]) return;
    if (amount > 0) st.playerStats[pid].goldEarned += amount;
  }

  function towersForAge(age){
    var list = ['pulse', 'frost', 'mortar', 'mint'];
    if (age >= 1) list = list.concat(['sniper', 'arc', 'amplify']);
    if (age >= 2) list = list.concat(['chrono']);
    return list.filter(function(id){ return !!TOWERS[id]; });
  }

  /* ---------- costs ---------- */
  function towerCostFor(def, pid){
    var d = doctrineOf(pid);
    return Math.ceil(num(def.cost, 0) * buildCostMult() * (d ? num(d.towerCost, 1) : 1));
  }
  function towerUpgradeCostFor(base, pid){
    var d = doctrineOf(pid);
    return Math.ceil(num(base, 0) * buildCostMult() * (d ? num(d.towerCost, 1) : 1));
  }
  function wallCostFor(pid){
    var d = doctrineOf(pid);
    return Math.ceil(CFG.WALL_COST * buildCostMult() * (d ? num(d.wallCost, 1) : 1));
  }
  function reactorCostFor(pid){
    return Math.ceil(CFG.REACTOR_COST * buildCostMult());
  }
  function repairCostFor(missing, maxHp, pid){
    var d = doctrineOf(pid);
    return Math.max(1, Math.ceil(missing / maxHp * CFG.WALL_COST *
             moraleCostMult() * (d ? num(d.repairCost, 1) : 1)));
  }
  function towerMaxHp(tier, pid){
    var d = doctrineOf(pid);
    return Math.round((CFG.TOWER_HP_BASE + CFG.TOWER_HP_PER_TIER * (tier - 1)) *
             (d ? num(d.towerHp, 1) : 1));
  }
  function wallMaxHp(pid){
    var d = doctrineOf(pid);
    return Math.round(CFG.WALL_HP * st.mods.wallHp * (d ? num(d.wallHp, 1) : 1));
  }

  /* ---------- player actions ---------- */
  function buildBlocked(){
    if (st.over) return 'over';
    if (st.pendingEvent || st.pendingEdict) return 'event';
    if (st.unrest) return 'unrest';
    return null;
  }

  function canPlaceTower(cx, cz, towerId, playerId){
    if (st.over) return { ok: false, reason: 'over' };
    var def = TOWERS[towerId];
    if (!def) return { ok: false, reason: 'tower' };
    if (towersForAge(st.age).indexOf(towerId) < 0) return { ok: false, reason: 'locked' };
    if (!inB(cx, cz) || terrainAt(cx, cz) || hqAt(cx, cz) || gateAt(cx, cz))
      return { ok: false, reason: 'blocked' };
    if (structAt(cx, cz)) return { ok: false, reason: 'occupied' };
    var free = num(st.freeBuilds[towerId], 0) > 0;
    var cost = free ? 0 : towerCostFor(def, playerId);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    return { ok: true, cost: cost };
  }

  function buildTower(cx, cz, towerId, playerId){
    playerId = playerId || 'p0';
    var blocked = buildBlocked();
    if (blocked) return { ok: false, reason: blocked };
    var chk = canPlaceTower(cx, cz, towerId, playerId);
    if (!chk.ok) return chk;
    var def = TOWERS[towerId];
    st.gold -= chk.cost;
    if (num(st.freeBuilds[towerId], 0) > 0) st.freeBuilds[towerId]--;
    var t = {
      instId: ++sim.nextInstId, id: towerId, def: def, ownerId: playerId,
      cx: cx, cz: cz, x: cellWX(cx), z: cellWZ(cz),
      tier: 1, branch: null, cooldown: 0, angle: 0, auraT: 0,
      totalSpent: chk.cost, wavesAlive: 0, veteran: 0,
      stats: { range: num(def.range, 0), damage: num(def.damage, 0),
               fireRate: num(def.fireRate, 0), special: copySpecial(def.special) },
      buffDmg: 1, buffRate: 1, activeSynergies: [],
      powered: true, dark: false
    };
    t.hp = towerMaxHp(1, playerId);
    t.maxHp = t.hp;
    t.highGround = cellHeight(cx, cz) >= 2.0;
    st.towers.push(t);
    occ[key(cx, cz)] = { kind: 'tower', ref: t };
    st.stats.towersBuilt++;
    afterLayoutChange();
    evq.push({ t: 'boom', x: t.x, z: t.z, color: def.color || '#8ef', n: 6 });
    return { ok: true, tower: t, instId: t.instId };
  }

  function applyOverrides(t, ov){
    if (!ov) return;
    var keys = ['range', 'damage', 'fireRate', 'special'];
    for (var i = 0; i < keys.length; i++){
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(ov, k)){
        t.stats[k] = (k === 'special') ? copySpecial(ov[k]) : ov[k];
      }
    }
  }

  function upgrade(instId, playerId){
    playerId = playerId || 'p0';
    var blocked = buildBlocked();
    if (blocked) return { ok: false, reason: blocked };
    var t = towerById(instId);
    if (!t) return { ok: false, reason: 'tower' };
    if (t.tier >= 3){
      if (!t.branch) return { ok: false, reason: 'branch' };
      return { ok: false, reason: 'max' };
    }
    var tiers = (t.def && t.def.tiers) || [];
    var td = tiers[t.tier - 1];
    if (!td) return { ok: false, reason: 'max' };
    var cost = towerUpgradeCostFor(td.cost, playerId);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    t.totalSpent += cost;
    t.tier++;
    applyOverrides(t, td);
    t.maxHp = towerMaxHp(t.tier, t.ownerId);
    t.hp = Math.min(t.maxHp, t.hp + (t.maxHp - t.hp) * 0.5 + 20);
    st.stats.upgradesBought++;
    afterLayoutChange();
    return { ok: true, tower: t };
  }

  function chooseBranch(instId, which, playerId){
    playerId = playerId || 'p0';
    if (which !== 'a' && which !== 'b') return { ok: false, reason: 'branch' };
    var blocked = buildBlocked();
    if (blocked) return { ok: false, reason: blocked };
    var t = towerById(instId);
    if (!t) return { ok: false, reason: 'tower' };
    if (t.tier !== 3) return { ok: false, reason: 'tier' };
    if (t.branch) return { ok: false, reason: 'max' };
    var bd = ((t.def && t.def.branch) || {})[which];
    if (!bd) return { ok: false, reason: 'branch' };
    var cost = towerUpgradeCostFor(bd.cost, playerId);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    t.totalSpent += cost;
    t.branch = which;
    applyOverrides(t, bd);
    afterLayoutChange();
    announce((bd.name || 'Branch') + ' ONLINE', '', '#7df9ff');
    return { ok: true, tower: t };
  }

  function sell(instId, playerId){
    playerId = playerId || 'p0';
    if (st.over) return { ok: false, reason: 'over' };
    var t = towerById(instId);
    var kind = 'tower';
    var r = null;
    if (!t){
      for (var i = 0; i < st.reactors.length; i++){
        if (st.reactors[i].instId === instId){ r = st.reactors[i]; kind = 'reactor'; break; }
      }
      if (!r) return { ok: false, reason: 'tower' };
    }
    var ref = t || r;
    var refund = Math.floor((ref.totalSpent || 0) * CFG.SELLBACK);
    st.gold += refund;
    st.stats.goldEarned += refund;
    creditGold(playerId, refund);
    if (kind === 'tower'){
      for (var j = 0; j < st.towers.length; j++){
        if (st.towers[j].instId === instId){ st.towers.splice(j, 1); break; }
      }
    } else {
      for (var k = 0; k < st.reactors.length; k++){
        if (st.reactors[k].instId === instId){ st.reactors.splice(k, 1); break; }
      }
    }
    delete occ[key(ref.cx, ref.cz)];
    afterLayoutChange();
    return { ok: true, gold: refund };
  }

  function buildReactor(cx, cz, playerId){
    playerId = playerId || 'p0';
    var blocked = buildBlocked();
    if (blocked) return { ok: false, reason: blocked };
    if (!inB(cx, cz) || terrainAt(cx, cz) || hqAt(cx, cz) || gateAt(cx, cz))
      return { ok: false, reason: 'blocked' };
    if (structAt(cx, cz)) return { ok: false, reason: 'occupied' };
    var cost = reactorCostFor(playerId);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    var r = { instId: ++sim.nextInstId, cx: cx, cz: cz, x: cellWX(cx), z: cellWZ(cz),
              hp: CFG.REACTOR_HP, maxHp: CFG.REACTOR_HP, dark: false,
              ownerId: playerId, totalSpent: cost };
    st.reactors.push(r);
    occ[key(cx, cz)] = { kind: 'reactor', ref: r };
    afterLayoutChange();
    evq.push({ t: 'boom', x: r.x, z: r.z, color: '#facc15', n: 6 });
    return { ok: true, reactor: r, instId: r.instId };
  }

  function wallCells(x1, z1, x2, z2){
    var cells = [], skipped = [];
    var dx = Math.abs(x2 - x1), dz = Math.abs(z2 - z1);
    var sx = x1 < x2 ? 1 : -1, sz = z1 < z2 ? 1 : -1;
    var err = dx - dz;
    var cx = x1, cz = z1, guard = 0;
    while (guard++ < 4096){
      if (!inB(cx, cz) || terrainAt(cx, cz) || hqAt(cx, cz) || gateAt(cx, cz)){
        skipped.push({ cx: cx, cz: cz, reason: 'blocked' });
      } else if (structAt(cx, cz)){
        skipped.push({ cx: cx, cz: cz, reason: 'occupied' });
      } else {
        cells.push({ cx: cx, cz: cz });
      }
      if (cx === x2 && cz === z2) break;
      var e2 = 2 * err;
      if (e2 > -dz){ err -= dz; cx += sx; }
      if (e2 < dx){ err += dx; cz += sz; }
    }
    return { cells: cells, skipped: skipped };
  }

  function buildWall(x1, z1, x2, z2, playerId){
    playerId = playerId || 'p0';
    var blocked = buildBlocked();
    if (blocked) return { ok: false, reason: blocked, built: 0, skipped: [] };
    var plan = wallCells(x1, z1, x2, z2);
    var cost = wallCostFor(playerId);
    var built = 0, ranOut = false;
    for (var i = 0; i < plan.cells.length; i++){
      var c = plan.cells[i];
      if (!isBuildable(c.cx, c.cz)){
        plan.skipped.push({ cx: c.cx, cz: c.cz, reason: structAt(c.cx, c.cz) ? 'occupied' : 'blocked' });
        continue;
      }
      if (st.gold < cost){ ranOut = true; break; }
      st.gold -= cost;
      var mhp = wallMaxHp(playerId);
      var w = { id: 'w' + (++sim.nextWallId), cx: c.cx, cz: c.cz,
                x: cellWX(c.cx), z: cellWZ(c.cz),
                hp: mhp, maxHp: mhp, ownerId: playerId };
      st.walls.push(w);
      occ[key(c.cx, c.cz)] = { kind: 'wall', ref: w };
      built++;
    }
    if (st.playerStats[playerId]) st.playerStats[playerId].wallsBuilt += built;
    if (built > 0) afterLayoutChange();
    return { ok: built > 0, built: built, skipped: plan.skipped, ranOut: ranOut,
             reason: built > 0 ? undefined : (ranOut ? 'gold' : 'blocked') };
  }

  function repairWall(id, playerId){
    playerId = playerId || 'p0';
    if (st.over) return { ok: false, reason: 'over' };
    var w = null;
    for (var i = 0; i < st.walls.length; i++){
      if (st.walls[i].id === id){ w = st.walls[i]; break; }
    }
    if (!w) return { ok: false, reason: 'wall' };
    var missing = w.maxHp - w.hp;
    if (missing <= 0) return { ok: false, reason: 'full' };
    var cost = repairCostFor(missing, w.maxHp, playerId);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    w.hp = w.maxHp;
    return { ok: true, cost: cost };
  }

  /* ---------- focus fire ---------- */
  function setFocusFire(enemyId){
    if (enemyId === null || enemyId === undefined){
      st.focusId = null;
      return { ok: true, focusId: null };
    }
    var e = enemyById(num(enemyId, -1));
    if (!e || e.dead) return { ok: false, reason: 'enemy' };
    st.focusId = e.id;
    return { ok: true, focusId: e.id };
  }

  /* ---------- spire: uplink, overclock, upgrades ---------- */
  function getUplink(){
    var base = CFG.UPLINK_BASE + CFG.SPIRE_RADIUS_PER_TIER * st.spireTier;
    return {
      radius: uplinkRadius(),
      baseRadius: base,
      surgeShrink: st.surgeActive ? CFG.SURGE_SHRINK : 0,
      overclock: { active: st.overclock.active, strain: Math.round(st.overclock.strain),
                   cooldown: Math.ceil(st.overclock.cooldown) }
    };
  }

  function upgradeSpire(playerId){
    playerId = playerId || 'p0';
    if (st.over) return { ok: false, reason: 'over' };
    if (st.unrest) return { ok: false, reason: 'unrest' };
    if (st.spireTier >= 3) return { ok: false, reason: 'max' };
    if (st.spireTier === 2 && st.age < 2) return { ok: false, reason: 'age' };
    var cost = Math.ceil(num(CFG.SPIRE_UPGRADE_COSTS[st.spireTier], 150) * buildCostMult());
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    st.spireTier++;
    recomputeDark();
    announce('SPIRE UPGRADED', 'uplink radius +' + CFG.SPIRE_RADIUS_PER_TIER, '#7df9ff');
    return { ok: true, tier: st.spireTier };
  }

  function toggleOverclock(){
    if (st.over) return { ok: false, reason: 'over' };
    var oc = st.overclock;
    if (!oc.active){
      if (oc.cooldown > 0) return { ok: false, reason: 'cooldown' };
      if (st.overclockCharges <= 0) return { ok: false, reason: 'charges' };
      st.overclockCharges--;
    }
    oc.active = !oc.active;
    recomputeDark();
    announce(oc.active ? 'OVERCLOCK ENGAGED' : 'OVERCLOCK RELEASED',
             oc.active ? '+4 uplink radius, +25% tower damage. Watch the strain.' : '', '#ffb347');
    return { ok: true, active: oc.active };
  }

  /* ---------- intent protocol ---------- */
  var BUILD_KINDS = { buildTower: 1, buildWall: 1, buildReactor: 1, upgrade: 1, branch: 1 };

  function applyIntent(intent){
    intent = intent || {};
    var kind = intent.kind;
    var playerId = intent.playerId || 'p0';
    if (!playerById(playerId)) return { ok: false, reason: 'player' };
    if (st.over && kind !== 'pause' && kind !== 'speed')
      return { ok: false, reason: 'over' };
    if ((st.pendingEvent || st.pendingEdict) &&
        (BUILD_KINDS[kind] || kind === 'startWave' || kind === 'spireUpgrade' || kind === 'overclock')){
      return { ok: false, reason: 'event' };
    }
    switch (kind){
      case 'buildTower': return buildTower(num(intent.cx, -1), num(intent.cz, -1), intent.towerId, playerId);
      case 'buildWall': return buildWall(num(intent.x1, 0), num(intent.z1, 0),
                                         num(intent.x2, 0), num(intent.z2, 0), playerId);
      case 'buildReactor': return buildReactor(num(intent.cx, -1), num(intent.cz, -1), playerId);
      case 'upgrade': return upgrade(num(intent.instId, -1), playerId);
      case 'branch': return chooseBranch(num(intent.instId, -1), intent.which, playerId);
      case 'sell': return sell(num(intent.instId, -1), playerId);
      case 'repair': return repairWall(intent.instId, playerId);
      case 'overclock': return toggleOverclock();
      case 'spireUpgrade': return upgradeSpire(playerId);
      case 'eventVote': {
        var ev = chooseEvent(intent.choiceId, playerId);
        return ev;
      }
      case 'edictVote': return chooseEdict(intent.edictId, playerId);
      case 'startWave': return startWave();
      case 'callEarly': return callEarly();
      case 'focus': return setFocusFire(intent.enemyId === undefined ? null : intent.enemyId);
      case 'detonate': return detonateBarrel(intent.barrelId);
      case 'collect': return collectDrop(intent.dropId);
      case 'speed': return { ok: true, speed: setSpeed(num(intent.n, 1)) };
      case 'pause': return { ok: true, paused: togglePause() };
      default: return { ok: false, reason: 'kind' };
    }
  }

  /* ---------- main update ---------- */
  function update(dtReal){
    if (st.paused || st.over) return;
    dtReal = num(dtReal, 0.016);
    var dt = Math.min(dtReal, 0.05) * st.speed;
    st.time += dt;
    var i;

    /* overclock strain */
    var oc = st.overclock;
    if (oc.active){
      oc.strain += 100 / CFG.STRAIN_FULL_TIME * st.mods.strainMult * dt;
      if (oc.strain >= 100){
        oc.strain = 100;
        oc.active = false;
        oc.cooldown = CFG.OVERCLOCK_COOLDOWN;
        recomputeDark();
        damageSpire(st.hqMaxHp * CFG.OVERCLOCK_BURN, 'Overclock burnout damaged the Command Spire');
        announce('OVERCLOCK BURNOUT', 'the spire takes ' +
                 Math.round(CFG.OVERCLOCK_BURN * 100) + '% damage. 60s cooldown.', '#ff5544');
      }
    } else {
      if (oc.strain > 0) oc.strain = Math.max(0, oc.strain - CFG.STRAIN_DECAY * dt);
      if (oc.cooldown > 0) oc.cooldown = Math.max(0, oc.cooldown - dt);
    }

    recomputeDark();

    /* structure regen (Field Hospitals edict) */
    if (st.mods.structRegen > 0){
      var rg = st.mods.structRegen * dt;
      for (i = 0; i < st.towers.length; i++){
        var t = st.towers[i];
        if (t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * rg);
      }
      for (i = 0; i < st.walls.length; i++){
        var w = st.walls[i];
        if (w.hp < w.maxHp) w.hp = Math.min(w.maxHp, w.hp + w.maxHp * rg);
      }
      for (i = 0; i < st.reactors.length; i++){
        var r = st.reactors[i];
        if (r.hp < r.maxHp) r.hp = Math.min(r.maxHp, r.hp + r.maxHp * rg);
      }
    }

    if (!st.waveActive && st.waveIndex < st.wavesTotal &&
        !st.pendingEvent && !st.pendingEdict){
      st.intermission -= dt;
      if (st.intermission <= 0) startWave();
    }

    for (i = st.delayed.length - 1; i >= 0; i--){
      if (st.delayed[i].at <= st.time){
        var job = st.delayed.splice(i, 1)[0];
        try { job.fn(); } catch (err) { /* keep sim alive */ }
      }
    }

    while (st.spawnQueue.length && st.spawnQueue[0].at <= st.time){
      if (st.enemies.length >= CFG.MAX_ENEMIES) break;
      var q = st.spawnQueue.shift();
      var ne = spawnEnemy(q.type, q.gate, q.hpMult, q.bountyMult);
      if (ne && q.seekStructures) ne.seekStructures = true;
    }

    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);
    updateHero(dt);

    /* combo window prune, drop expiry, focus clear */
    while (st.comboTimes.length && st.comboTimes[0] < st.time - 3) st.comboTimes.shift();
    for (i = st.drops.length - 1; i >= 0; i--){
      if (st.drops[i].expiresAt <= st.time) st.drops.splice(i, 1);
    }
    if (st.focusId && !enemyById(st.focusId)) st.focusId = null;

    for (i = st.beams.length - 1; i >= 0; i--){
      st.beams[i].ttl -= dt;
      if (st.beams[i].ttl <= 0) st.beams.splice(i, 1);
    }

    if (st.activeAnomaly && st.time >= st.activeAnomaly.until){
      st.activeAnomaly = null;
      announce('ANOMALY FADED', '', '#8fa3b8');
    }

    for (i = st.enemies.length - 1; i >= 0; i--){
      if (st.enemies[i].dead) st.enemies.splice(i, 1);
    }

    checkWaveEnd();
  }

  /* ---------- misc helpers ---------- */
  function setSpeed(n){
    n = num(n, 1);
    if (n <= 0) n = 1;
    if (n > 8) n = 8;
    st.speed = n;
    return n;
  }
  function togglePause(){
    st.paused = !st.paused;
    return st.paused;
  }
  function worldToCell(x, z){
    return { cx: Math.floor(x / CELL), cz: Math.floor(z / CELL) };
  }
  function gridSize(){
    return { cols: COLS, rows: ROWS, cell: CELL };
  }
  function previewWave(n){
    var w = waves[n];
    if (!w) return null;
    var groups = [], totalHp = 0, estBounty = 0;
    var list = w.enemies || [];
    for (var i = 0; i < list.length; i++){
      var g = list[i];
      var def = ENEMIES[g.type] || {};
      var hp = num(def.hp, 10) * num(w.hpMult, 1);
      var count = Math.max(0, Math.round(num(g.count, 0)));
      groups.push({ type: g.type, name: def.name || g.type, count: count, hp: Math.round(hp) });
      totalHp += hp * count;
      estBounty += Math.round(num(def.bounty, 0) * num(w.bountyMult, 1)) * count;
    }
    return { note: w.note || '', groups: groups,
             totalHp: Math.round(totalHp), estBounty: estBounty };
  }

  function surgeSnapshot(){
    if (st.surgeActive) return { active: true, warningIn: 0 };
    if (!st.waveActive && st.waveIndex < st.wavesTotal &&
        surges.indexOf(st.waveIndex) >= 0){
      return { active: false, warningIn: Math.max(0, Math.min(CFG.SURGE_WARN, st.intermission)) };
    }
    return { active: false, warningIn: 0 };
  }

  function snapshot(){
    var sc = {};
    for (var k in st.stats) sc[k] = st.stats[k];
    sc.goldEarned = Math.floor(sc.goldEarned);
    var pw = allocatePower();
    var ul = getUplink();
    var time = st.time;
    var pstats = {};
    for (var pid in st.playerStats){
      if (Object.prototype.hasOwnProperty.call(st.playerStats, pid)){
        var ps = st.playerStats[pid];
        pstats[pid] = { kills: ps.kills, goldEarned: Math.floor(ps.goldEarned),
                        wallsBuilt: ps.wallsBuilt, structuresLost: ps.structuresLost };
      }
    }
    return {
      gold: Math.floor(st.gold),
      energyUsed: pw.used, energyCap: pw.cap,
      hqHp: Math.ceil(st.hqHp), hqMaxHp: st.hqMaxHp,
      hq: { cx: hqCell.x + 1, cz: hqCell.z + 1, x: (hqCell.x + 1) * CELL, z: (hqCell.z + 1) * CELL },
      uplinkRadius: Math.round(ul.radius * 100) / 100,
      overclock: { active: ul.overclock.active, strain: ul.overclock.strain,
                   cooldown: ul.overclock.cooldown },
      overclockCharges: st.overclockCharges,
      combo: { count: st.comboTimes.length, best: st.comboBest },
      lastGrade: st.lastGrade, grades: st.grades.slice(),
      focusId: st.focusId,
      morale: Math.round(st.morale), moraleState: moraleState(),
      surge: surgeSnapshot(),
      pendingEvent: !!st.pendingEvent, pendingEdict: !!st.pendingEdict,
      availableTowers: towersForAge(st.age),
      edicts: st.edicts.slice(),
      players: st.players.map(function(p){
        return { id: p.id, name: p.name, color: p.color, doctrine: p.doctrine, isAI: p.isAI };
      }),
      age: st.age, spireTier: st.age, spireUpgrades: st.spireTier,
      statsByPlayer: pstats,
      decisions: st.decisions.map(function(d){
        return { eventId: d.eventId, choiceId: d.choiceId, waveIndex: d.waveIndex };
      }),
      waveIndex: st.waveIndex, wavesTotal: st.wavesTotal,
      waveActive: st.waveActive, intermission: Math.max(0, Math.ceil(st.intermission)),
      speed: st.speed, paused: st.paused,
      towers: st.towers.map(function(t){
        return { instId: t.instId, id: t.id, name: (t.def && t.def.name) || t.id,
                 tier: t.tier, branch: t.branch, ownerId: t.ownerId,
                 cx: t.cx, cz: t.cz, x: t.x, z: t.z,
                 hp: Math.ceil(t.hp), maxHp: t.maxHp,
                 powered: !!t.powered, dark: !!t.dark,
                 angle: t.angle, range: t.stats.range,
                 highGround: !!t.highGround,
                 effRange: Math.round(num(t.stats.range, 0) * rangeMult(t) * 100) / 100,
                 targetId: t.targetId === undefined ? null : t.targetId,
                 veteran: t.veteran, synergies: t.activeSynergies.slice() };
      }),
      walls: st.walls.map(function(w){
        return { id: w.id, cx: w.cx, cz: w.cz, x: w.x, z: w.z,
                 hp: Math.ceil(w.hp), maxHp: w.maxHp, ownerId: w.ownerId };
      }),
      reactors: st.reactors.map(function(r){
        return { instId: r.instId, cx: r.cx, cz: r.cz, x: r.x, z: r.z,
                 hp: Math.ceil(r.hp), maxHp: r.maxHp, dark: !!r.dark, ownerId: r.ownerId };
      }),
      enemies: st.enemies.map(function(e){
        return { id: e.id, type: e.type, x: Math.round(e.x * 100) / 100,
                 z: Math.round(e.z * 100) / 100,
                 hp: Math.ceil(e.hp), maxHp: Math.ceil(e.maxHp),
                 slowed: time < e.slowUntil && !e.insulated,
                 golden: !!e.golden };
      }),
      projectiles: st.projectiles.map(function(p){
        return { x: p.x, z: p.z, tx: p.tx, tz: p.tz, color: p.color };
      }),
      beams: st.beams.map(function(b){
        return { x1: b.x1, z1: b.z1, x2: b.x2, z2: b.z2, color: b.color };
      }),
      barrels: st.barrels.map(function(b){
        return { id: b.id, x: b.x, z: b.z, hp: Math.ceil(b.hp), alive: b.alive };
      }),
      drops: st.drops.map(function(d){
        return { id: d.id, x: d.x, z: d.z, amount: d.amount,
                 expiresIn: Math.max(0, Math.ceil(d.expiresAt - st.time)) };
      }),
      hero: st.hero ? { id: st.hero.id, x: Math.round(st.hero.x * 100) / 100,
                        z: Math.round(st.hero.z * 100) / 100,
                        hp: Math.ceil(st.hero.hp), alive: st.hero.alive } : null,
      over: st.over, victory: st.victory, stars: st.stars,
      time: Math.round(st.time * 100) / 100,
      stats: sc
    };
  }

  function drainEvents(){
    var out = evq;
    evq = [];
    return out;
  }

  /* ---------- wiring ---------- */
  sim.update = update;
  sim.startWave = startWave;
  sim.callEarly = callEarly;
  sim.buildTower = function(cx, cz, towerId, playerId){ return buildTower(cx, cz, towerId, playerId); };
  sim.buildWall = function(x1, z1, x2, z2, playerId){ return buildWall(x1, z1, x2, z2, playerId); };
  sim.wallCells = wallCells;
  sim.repairWall = function(id, playerId){ return repairWall(id, playerId); };
  sim.buildReactor = function(cx, cz, playerId){ return buildReactor(cx, cz, playerId); };
  sim.upgrade = function(instId, playerId){ return upgrade(instId, playerId); };
  sim.chooseBranch = function(instId, which, playerId){ return chooseBranch(instId, which, playerId); };
  sim.sell = function(instId, playerId){ return sell(instId, playerId); };
  sim.upgradeSpire = function(playerId){ return upgradeSpire(playerId); };
  sim.toggleOverclock = function(){ return toggleOverclock(); };
  sim.getUplink = getUplink;
  sim.getEvent = getEvent;
  sim.chooseEvent = function(choiceId, playerId){ return chooseEvent(choiceId, playerId); };
  sim.getEdictOffer = getEdictOffer;
  sim.chooseEdict = function(id, playerId){ return chooseEdict(id, playerId); };
  sim.addPlayer = addPlayer;
  sim.applyIntent = applyIntent;
  sim.setFocusFire = setFocusFire;
  sim.detonateBarrel = detonateBarrel;
  sim.collectDrop = collectDrop;
  sim.cellHeight = cellHeight;
  sim.heightAt = heightAt;
  sim.flowDist = flowDist;
  sim.isBuildable = isBuildable;
  sim.canPlaceTower = function(cx, cz, towerId, playerId){ return canPlaceTower(cx, cz, towerId, playerId); };
  sim.worldToCell = worldToCell;
  sim.gridSize = gridSize;
  sim.previewWave = previewWave;
  sim.setSpeed = setSpeed;
  sim.togglePause = togglePause;
  sim.snapshot = snapshot;
  sim.drainEvents = drainEvents;
  sim.statsByPlayer = st.playerStats;
  sim.decisions = st.decisions;

  /* init: host player, flow field, dark, power, barrels, hero */
  addPlayer({ id: 'p0', name: 'Commander', color: '#7df9ff',
              doctrine: opts.doctrine || 'vanguard', isAI: false });
  var barrelDefs = sd.barrels || [];
  for (var bi = 0; bi < barrelDefs.length; bi++){
    var bdx = Math.round(num(barrelDefs[bi].x, 0)), bdz = Math.round(num(barrelDefs[bi].z, 0));
    st.barrels.push({ id: 'bar' + bi, cx: bdx, cz: bdz,
                      x: cellWX(bdx), z: cellWZ(bdz), hp: 40, maxHp: 40, alive: true });
  }
  var hwc = hqCenterWorld();
  st.hero = { id: 'hero', x: hwc.x, z: hwc.z, hp: 200, maxHp: 200,
              alive: true, respawnAtWave: -1 };
  recomputeFlow();
  recomputeDark();
  allocatePower();
  recomputeBuffs();
  recomputeSynergies();

  return sim;
};

})();
