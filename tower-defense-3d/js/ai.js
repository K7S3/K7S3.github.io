/* Nova Bastion 3D - AI commanders (host-only co-op bots)
 *
 * NB.AI.Commander wraps a sim player slot and issues intents through
 * sim.applyIntent with its own playerId. Bots go through the SAME
 * validation, costs, and rules as human players. No cheating: the AI only
 * reads what the public sim API exposes (snapshot, canPlaceTower,
 * isBuildable, getEvent, getEdictOffer) plus the static NB.TOWERS data.
 *
 * The host game loop calls commander.tick(dt) (or manager.tick(dt)).
 * Bots never touch overclock. Veteran bots may buy spire upgrades when
 * gold is flush. Big actions push {t:'announce'} events into a local
 * queue; the host net layer merges them into the broadcast event stream
 * so guests see them too.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

var DIFFICULTY = {
  recruit: { interval: 5.0, reserve: 250, label: 'Recruit' },
  regular: { interval: 2.5, reserve: 100, label: 'Regular' },
  veteran: { interval: 1.2, reserve: 60,  label: 'Veteran' }
};

var MAX_PLAYERS = 4;

var AI_COLORS = {
  vanguard: '#ff8a5c',
  engineer: '#a3e635',
  warden:   '#a78bfa'
};

var DAMAGE_BEHAVIORS = { projectile: 1, chain: 1, lobbed: 1, aura: 1 };

var VANGUARD_TOWERS = ['pulse', 'mortar', 'sniper', 'arc'];
var ENGINEER_SUPPORT = ['frost', 'arc'];
var WARDEN_SUPPORT = ['amplify', 'mint', 'chrono'];

var _counters = { vanguard: 0, engineer: 0, warden: 0 };
var _seatCounter = 0;

function doctrineName(d){
  var D = (NB.DOCTRINES || {})[d];
  return (D && D.name) || (d.charAt(0).toUpperCase() + d.slice(1));
}

/* ---------- small geometry helpers ---------- */
function dist2(ax, az, bx, bz){
  var dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
function compass(dx, dz){
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
  return dz >= 0 ? 'south' : 'north';
}

/* Effective tower stats for a (tier, branch) combo, from NB.TOWERS data.
 * Tier entries and branch entries are absolute overrides (see towers.js). */
function effStats(towerId, tier, branch){
  var def = (NB.TOWERS || {})[towerId];
  if (!def) return null;
  var s = { damage: def.damage || 0, fireRate: def.fireRate || 0,
            range: def.range || 0, behavior: def.behavior || '',
            cost: def.cost || 0 };
  var tiers = def.tiers || [];
  if (tier >= 2 && tiers[0]) applyOv(s, tiers[0]);
  if (tier >= 3 && tiers[1]) applyOv(s, tiers[1]);
  if (branch && def.branch && def.branch[branch]) applyOv(s, def.branch[branch]);
  return s;
}
function applyOv(s, ov){
  if (typeof ov.damage === 'number') s.damage = ov.damage;
  if (typeof ov.fireRate === 'number') s.fireRate = ov.fireRate;
  if (typeof ov.range === 'number') s.range = ov.range;
  if (typeof ov.cost === 'number') s.cost = ov.cost;
}
function dpsOf(towerId, tier, branch){
  var s = effStats(towerId, tier, branch);
  if (!s || !DAMAGE_BEHAVIORS[s.behavior]) return 0;
  return (s.damage || 0) * (s.fireRate || 0);
}

/* ============================================================
 * Commander
 * ============================================================ */
function Commander(sim, player, opts){
  opts = opts || {};
  this.sim = sim;
  this.player = player;
  this.id = player.id;
  this.name = player.name;
  this.doctrine = player.doctrine || 'vanguard';
  var d = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'regular';
  this.difficulty = d;
  this.cfg = DIFFICULTY[d];
  this._t = Math.random() * this.cfg.interval; /* stagger first actions */
  this._heat = {};      /* "cx,cz" -> enemy sightings (decayed) */
  this._spawns = [];    /* inferred gate anchors {cx,cz,w} */
  this._events = [];    /* announce queue for the net layer */
  this._votedEvent = null;
  this._votedEdict = null;
  this._wallCooldown = 0;
  this._acts = 0;
  this._errors = 0;
}

Commander.prototype.say = function(text){
  this._events.push({ t: 'announce', x: 0, z: 0,
                      color: this.player.color || '#a3e635',
                      text: this.name + ': ' + text, sub: '' });
};
Commander.prototype.drainEvents = function(){
  var out = this._events;
  this._events = [];
  return out;
};

Commander.prototype.intent = function(kind, params){
  var intent = { playerId: this.id, kind: kind };
  for (var k in params){
    if (Object.prototype.hasOwnProperty.call(params, k)) intent[k] = params[k];
  }
  try {
    return this.sim.applyIntent(intent);
  } catch (e){
    this._errors++;
    return { ok: false, reason: 'exception' };
  }
};

Commander.prototype.tick = function(dt){
  if (!this.sim || dt <= 0) return;
  this._t += dt;
  if (this._t < this.cfg.interval) return;
  this._t = 0;
  try {
    this.act();
  } catch (e){
    this._errors++;
  }
};

/* Observe enemy movement: heat map + inferred spawn (gate) anchors. */
Commander.prototype.observe = function(snap){
  var gs = null;
  try { gs = this.sim.gridSize(); } catch (e){ /* ignore */ }
  var cols = gs ? gs.cols : 64, rows = gs ? gs.rows : 40;
  var heat = this._heat;
  for (var k in heat){
    if (Object.prototype.hasOwnProperty.call(heat, k)){
      heat[k] *= 0.92;
      if (heat[k] < 0.25) delete heat[k];
    }
  }
  var enemies = snap.enemies || [];
  for (var i = 0; i < enemies.length; i++){
    var e = enemies[i];
    var cell = this.sim.worldToCell(e.x, e.z);
    var cx = Math.max(0, Math.min(cols - 1, cell.cx));
    var cz = Math.max(0, Math.min(rows - 1, cell.cz));
    var key = cx + ',' + cz;
    heat[key] = (heat[key] || 0) + 1;
    /* near a map edge: probably a spawn gate */
    if (cx < 3 || cz < 3 || cx >= cols - 3 || cz >= rows - 3){
      this.noteSpawn(cx, cz);
    }
  }
};

Commander.prototype.noteSpawn = function(cx, cz){
  var best = null, bestD = 49; /* 7 cells */
  for (var i = 0; i < this._spawns.length; i++){
    var s = this._spawns[i];
    var d = dist2(s.cx, s.cz, cx, cz);
    if (d < bestD){ bestD = d; best = s; }
  }
  if (best){ best.cx = Math.round((best.cx * best.w + cx) / (best.w + 1));
             best.cz = Math.round((best.cz * best.w + cz) / (best.w + 1));
             best.w++; }
  else if (this._spawns.length < 6) this._spawns.push({ cx: cx, cz: cz, w: 1 });
};

Commander.prototype.canAfford = function(cost, snap){
  return snap.gold - cost >= this.cfg.reserve;
};

/* Spiral search for a buildable cell near (cx, cz). */
Commander.prototype.findCellNear = function(cx, cz, maxR, test){
  for (var r = 0; r <= maxR; r++){
    for (var dz = -r; dz <= r; dz++){
      for (var dx = -r; dx <= r; dx++){
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        var x = cx + dx, z = cz + dz;
        if (test(x, z)) return { cx: x, cz: z };
      }
    }
  }
  return null;
};

Commander.prototype.inUplink = function(cx, cz, snap, margin){
  var hq = snap.hq || { cx: 32, cz: 20 };
  var r = (snap.uplinkRadius || 9) - (margin || 0);
  return dist2(cx, cz, hq.cx, hq.cz) <= r * r;
};

/* ---------- shared sub-routines ---------- */

/* Repair damaged walls first. Returns true if a repair batch ran. */
Commander.prototype.doRepairs = function(snap, threshold, maxN){
  if (snap.gold < this.cfg.reserve + 15) return false; /* keep the reserve */
  var walls = snap.walls || [];
  var hurt = [];
  for (var i = 0; i < walls.length; i++){
    var w = walls[i];
    if (w.hp < w.maxHp * threshold) hurt.push(w);
  }
  if (!hurt.length) return false;
  hurt.sort(function(a, b){ return (a.hp / a.maxHp) - (b.hp / b.maxHp); });
  var n = 0, spent = 0;
  for (var j = 0; j < hurt.length && n < maxN; j++){
    var res = this.intent('repair', { instId: hurt[j].id });
    if (res.ok){ n++; spent += res.cost || 0; }
    else if (res.reason === 'gold') break;
    else if (res.reason !== 'full') break;
  }
  if (n > 0 && this.difficulty !== 'recruit'){
    this.say('patching ' + n + ' wall section' + (n > 1 ? 's' : '') +
             ' (' + spent + 'g)');
  }
  return n > 0;
};

/* Vote on a pending crossroads event. Once per event. */
Commander.prototype.doEventVote = function(snap){
  if (!snap.pendingEvent) { this._votedEvent = null; return false; }
  var ev = null;
  try { ev = this.sim.getEvent(); } catch (e){ return false; }
  if (!ev || !ev.choices || !ev.choices.length) return false;
  if (this._votedEvent === ev.id) return false;
  var pick = ev.choices[0];
  var i, c, fx;
  if (this.doctrine === 'warden'){
    for (i = 0; i < ev.choices.length; i++){
      c = ev.choices[i];
      if (c.colonistFriendly === true){ pick = c; break; }
    }
  } else if (this.doctrine === 'vanguard'){
    for (i = 0; i < ev.choices.length; i++){
      c = ev.choices[i]; fx = c.effects || {};
      if (fx.dmgMultTemp || (typeof fx.gold === 'number' && fx.gold > 0)){ pick = c; break; }
    }
  } else { /* engineer: energy and infrastructure first */
    for (i = 0; i < ev.choices.length; i++){
      c = ev.choices[i]; fx = c.effects || {};
      if (typeof fx.reactorBoost === 'number' || fx.uplinkTemp ||
          (typeof fx.gold === 'number' && fx.gold > 0)){ pick = c; break; }
    }
  }
  var res = this.intent('eventVote', { choiceId: pick.id });
  if (res.ok){
    this._votedEvent = ev.id;
    this.say('voted "' + (pick.label || pick.id) + '" at the crossroads');
    return true;
  }
  return false;
};

/* Vote on a pending edict. Once per offer. */
Commander.prototype.doEdictVote = function(snap){
  if (!snap.pendingEdict) { this._votedEdict = null; return false; }
  var offer = null;
  try { offer = this.sim.getEdictOffer(); } catch (e){ return false; }
  var pair = (offer && offer.pair) || [];
  if (!pair.length) return false;
  var key = pair.map(function(p){ return p.id; }).join('+');
  if (this._votedEdict === key) return false;
  var prefs = {
    vanguard: ['martial-law', 'salvage-crews', 'overclock-governors', 'emergency-shifts'],
    engineer: ['reinforced-barricades', 'hardened-relays', 'emergency-shifts', 'field-hospitals'],
    warden:   ['memorial-hall', 'field-hospitals', 'salvage-crews', 'hardened-relays']
  }[this.doctrine] || [];
  var pick = pair[0], i, j;
  outer:
  for (i = 0; i < prefs.length; i++){
    for (j = 0; j < pair.length; j++){
      if (pair[j].id === prefs[i]){ pick = pair[j]; break outer; }
    }
  }
  var res = this.intent('edictVote', { edictId: pick.id });
  if (res.ok){
    this._votedEdict = key;
    this.say('signed the ' + (pick.name || pick.id) + ' edict');
    return true;
  }
  return false;
};

/* Veteran: buy a spire upgrade when gold is flush. */
Commander.prototype.doSpire = function(snap){
  if (this.difficulty !== 'veteran') return false;
  if ((snap.spireUpgrades || 0) >= 3) return false;
  if (snap.gold < 500) return false;
  if (snap.pendingEvent || snap.pendingEdict) return false;
  var res = this.intent('spireUpgrade', {});
  if (res.ok){
    this.say('uplink spire raised to tier ' + res.tier);
    return true;
  }
  return false;
};

/* ---------- doctrine main acts ---------- */

Commander.prototype.act = function(){
  var snap;
  try { snap = this.sim.snapshot(); } catch (e){ return; }
  if (!snap || snap.over) return;
  this._acts++;
  this.observe(snap);

  /* shared: repairs and votes come first */
  var repairThreshold = this.doctrine === 'engineer' ? 0.85 :
                        this.doctrine === 'warden' ? 0.6 : 0.5;
  if (this.difficulty !== 'recruit' && this.doRepairs(snap, repairThreshold, 3)) return;
  if (this.doEventVote(snap)) return;
  if (this.doEdictVote(snap)) return;
  if (this.doSpire(snap)) return;

  if (this.doctrine === 'vanguard') this.actVanguard(snap);
  else if (this.doctrine === 'engineer') this.actEngineer(snap);
  else this.actWarden(snap);
};

/* ----- Vanguard: forward damage, upgrades, expansion ----- */
Commander.prototype.actVanguard = function(snap){
  var avail = snap.availableTowers || [];
  /* 1. upgrade the best damage towers first */
  if (this.difficulty !== 'recruit'){
    var mine = [];
    var i, t;
    for (i = 0; i < (snap.towers || []).length; i++){
      t = snap.towers[i];
      if (t.ownerId !== this.id) continue;
      var dps = dpsOf(t.id, t.tier, t.branch);
      if (dps > 0) mine.push({ t: t, dps: dps });
    }
    if (this.difficulty === 'veteran') mine.sort(function(a, b){ return b.dps - a.dps; });
    else mine.sort(function(a, b){ return a.t.totalSpent - b.t.totalSpent; });
    for (i = 0; i < mine.length; i++){
      var tw = mine[i].t;
      if (tw.tier < 3){
        var td = (((NB.TOWERS[tw.id] || {}).tiers || [])[tw.tier - 1]) || {};
        var cost = td.cost || 999999;
        if (this.canAfford(cost, snap)){
          var res = this.intent('upgrade', { instId: tw.instId });
          if (res.ok){
            this.say(tw.name + ' upgraded to tier ' + (tw.tier + 1));
            return;
          }
        }
      } else if (!tw.branch){
        var bd = ((NB.TOWERS[tw.id] || {}).branch) || {};
        var which = (dpsOf(tw.id, 3, 'a') >= dpsOf(tw.id, 3, 'b')) ? 'a' : 'b';
        if (bd[which] && this.canAfford(bd[which].cost || 999999, snap)){
          var br = this.intent('branch', { instId: tw.instId, which: which });
          if (br.ok){
            this.say(tw.name + ' branched: ' + (bd[which].name || which));
            return;
          }
        }
      }
    }
  }
  /* 2. build a forward damage tower */
  var choice = this.pickDamageTower(avail, snap);
  if (!choice) return;
  var cell = this.pickForwardCell(snap, choice.id);
  if (!cell) return;
  var res = this.intent('buildTower', { cx: cell.cx, cz: cell.cz, towerId: choice.id });
  if (res.ok && this.difficulty !== 'recruit'){
    this.say(choice.name + ' online near the ' + cell.dir + ' gate');
  }
};

Commander.prototype.pickDamageTower = function(avail, snap){
  var pool = VANGUARD_TOWERS.filter(function(id){ return avail.indexOf(id) >= 0; });
  if (!pool.length) return null;
  if (this.difficulty === 'recruit') return { id: 'pulse', name: 'Pulse Turret' };
  var best = null, bestScore = -1;
  for (var i = 0; i < pool.length; i++){
    var s = effStats(pool[i], 1, null);
    if (!s) continue;
    var score = ((s.damage || 0) * (s.fireRate || 0)) / Math.max(1, s.cost);
    if (score > bestScore){ bestScore = score; best = pool[i]; }
  }
  if (!best) return null;
  var def = NB.TOWERS[best];
  if (this.canAfford(def.cost || 0, snap)) return { id: best, name: def.name || best };
  /* best is out of reach: fall back to the cheapest affordable damage tower */
  var cheap = null, cheapCost = Infinity;
  for (var j = 0; j < pool.length; j++){
    var cd = NB.TOWERS[pool[j]] || {};
    var cc = cd.cost || Infinity;
    if (cc < cheapCost && this.canAfford(cc, snap)){ cheapCost = cc; cheap = pool[j]; }
  }
  if (!cheap) return null;
  var cdef = NB.TOWERS[cheap];
  return { id: cheap, name: cdef.name || cheap };
};

/* Forward cell: near an inferred spawn anchor, toward the HQ, in uplink. */
Commander.prototype.pickForwardCell = function(snap, towerId){
  var hq = snap.hq || { cx: 32, cz: 20 };
  var anchors = this._spawns.slice().sort(function(a, b){ return b.w - a.w; });
  if (!anchors.length){
    /* no intel yet: ring at mid uplink radius in a random direction */
    var a = Math.random() * Math.PI * 2;
    var r = Math.max(3, Math.floor((snap.uplinkRadius || 9) / 2));
    anchors = [{ cx: hq.cx + Math.round(Math.cos(a) * r),
                 cz: hq.cz + Math.round(Math.sin(a) * r), w: 1 }];
  }
  for (var s = 0; s < anchors.length; s++){
    var an = anchors[s];
    var dir = compass(an.cx - hq.cx, an.cz - hq.cz);
    for (var ring = 4; ring <= 9; ring++){
      var cands = [];
      for (var dz = -ring; dz <= ring; dz++){
        for (var dx = -ring; dx <= ring; dx++){
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          cands.push({ cx: an.cx + dx, cz: an.cz + dz });
        }
      }
      /* prefer cells closer to the HQ side of the anchor */
      cands.sort(function(p, q){
        return dist2(p.cx, p.cz, hq.cx, hq.cz) - dist2(q.cx, q.cz, hq.cx, hq.cz);
      });
      for (var i = 0; i < cands.length; i++){
        var c = cands[i];
        if (!this.inUplink(c.cx, c.cz, snap, 1)) continue;
        var chk = this.sim.canPlaceTower(c.cx, c.cz, towerId, this.id);
        if (chk.ok && this.canAfford(chk.cost, snap)){
          return { cx: c.cx, cz: c.cz, dir: dir };
        }
      }
    }
  }
  return null;
};

/* ----- Engineer: walls at chokepoints, reactors, repairs, support ----- */
Commander.prototype.actEngineer = function(snap){
  this._wallCooldown = Math.max(0, this._wallCooldown - 1);
  /* 1. reactors when the grid is strained (or not built yet) */
  var reactors = snap.reactors || [];
  var strained = reactors.length === 0 ||
    (snap.energyCap > 0 && snap.energyUsed / snap.energyCap > 0.75);
  if (reactors.length < 5 && strained){
    var hq = snap.hq || { cx: 32, cz: 20 };
    var self = this;
    var rcell = this.findCellNear(hq.cx, hq.cz, 6, function(x, z){
      return self.sim.isBuildable(x, z);
    });
    if (rcell){
      var rr = this.intent('buildReactor', { cx: rcell.cx, cz: rcell.cz });
      if (rr.ok){
        this.say('reactor online, grid capacity up');
        return;
      }
    }
  }
  /* 2. wall line across the hottest narrow corridor */
  if (this._wallCooldown === 0 && (snap.walls || []).length < 140){
    var line = this.pickChokeWall(snap);
    if (line){
      var estLen = Math.abs(line.x2 - line.x1) + Math.abs(line.z2 - line.z1) + 1;
      if (snap.gold - estLen * 10 >= this.cfg.reserve){
        var wr = this.intent('buildWall',
                             { x1: line.x1, z1: line.z1, x2: line.x2, z2: line.z2 });
        this._wallCooldown = 6; /* walls are commitments; leave gold for guns */
        if (wr.ok && wr.built > 0){
          this.say('walling the ' + line.dir + ' approach (' + wr.built + ' sections)');
          return;
        }
      } else {
        this._wallCooldown = 2;
      }
    } else {
      this._wallCooldown = 2;
    }
  }
  /* 3. support tower near the wall line */
  if (this.difficulty !== 'recruit'){
    var avail = snap.availableTowers || [];
    var sid = null, i;
    for (i = 0; i < ENGINEER_SUPPORT.length; i++){
      if (avail.indexOf(ENGINEER_SUPPORT[i]) >= 0){ sid = ENGINEER_SUPPORT[i]; break; }
    }
    if (sid){
      var sdef = NB.TOWERS[sid] || {};
      if (this.canAfford(sdef.cost || 0, snap)){
        var wall = (snap.walls || [])[0];
        var hq2 = snap.hq || { cx: 32, cz: 20 };
        var anchor = wall || hq2;
        var self2 = this;
        var scell = this.findCellNear(anchor.cx, anchor.cz, 4, function(x, z){
          if (!self2.inUplink(x, z, snap, 1)) return false;
          var chk = self2.sim.canPlaceTower(x, z, sid, self2.id);
          return chk.ok && self2.canAfford(chk.cost, snap);
        });
        if (scell){
          var sr = this.intent('buildTower', { cx: scell.cx, cz: scell.cz, towerId: sid });
          if (sr.ok){
            this.say((sdef.name || sid) + ' covering the wall line');
            return;
          }
        }
      }
    }
  }
};

/* Chokepoint wall: hottest enemy corridor cell with the narrowest
 * traversed width (flow-field width heuristic approximated from the
 * enemy heat map). The wall line runs perpendicular to the
 * anchor-to-HQ direction. */
Commander.prototype.pickChokeWall = function(snap){
  var hq = snap.hq || { cx: 32, cz: 20 };
  var heat = this._heat;
  var keys = Object.keys(heat);
  if (!keys.length) return null;
  var hot = keys.filter(function(k){ return heat[k] > 2; });
  if (!hot.length) return null;
  var self = this;
  function widthAt(cx, cz){
    var w = 0;
    for (var dz = -2; dz <= 2; dz++){
      for (var dx = -2; dx <= 2; dx++){
        if ((heat[(cx + dx) + ',' + (cz + dz)] || 0) > 0) w++;
      }
    }
    return w;
  }
  var best = null, bestScore = 1e9;
  for (var i = 0; i < hot.length; i++){
    var parts = hot[i].split(',');
    var cx = +parts[0], cz = +parts[1];
    if (!self.sim.isBuildable(cx, cz)) continue;
    if (dist2(cx, cz, hq.cx, hq.cz) < 36) continue; /* keep out of the base */
    var w = widthAt(cx, cz);
    var score = w * 100 - (heat[hot[i]] || 0); /* narrow first, hot second */
    if (score < bestScore){ bestScore = score; best = { cx: cx, cz: cz, w: w }; }
  }
  if (!best) return null;
  /* perpendicular to the anchor -> HQ approach direction */
  var dx = hq.cx - best.cx, dz = hq.cz - best.cz;
  var len = Math.max(3, Math.min(7, Math.round(best.w / 2) + 2));
  var x1, z1, x2, z2, half = Math.floor(len / 2);
  if (Math.abs(dx) >= Math.abs(dz)){ x1 = best.cx; z1 = best.cz - half;
                                     x2 = best.cx; z2 = best.cz + half; }
  else { x1 = best.cx - half; z1 = best.cz;
         x2 = best.cx + half; z2 = best.cz; }
  return { x1: x1, z1: z1, x2: x2, z2: z2,
           dir: compass(best.cx - hq.cx, best.cz - hq.cz) };
};

/* ----- Warden: support near allies, colonist-friendly votes, safe builds ----- */
Commander.prototype.actWarden = function(snap){
  var avail = snap.availableTowers || [];
  /* pick the best support available: chrono late, amplify mid, mint early */
  var pick = null, i, id;
  var ordered = [];
  if ((snap.age || 0) >= 2 && snap.gold > this.cfg.reserve + 400) ordered.push('chrono');
  ordered.push('amplify', 'mint');
  for (i = 0; i < ordered.length; i++){
    if (avail.indexOf(ordered[i]) >= 0){ pick = ordered[i]; break; }
  }
  if (!pick){
    for (i = 0; i < WARDEN_SUPPORT.length; i++){
      id = WARDEN_SUPPORT[i];
      if (avail.indexOf(id) >= 0){ pick = id; break; }
    }
  }
  if (!pick) return;
  var def = NB.TOWERS[pick] || {};
  if (!this.canAfford(def.cost || 0, snap)) return;
  /* build near the densest ally tower cluster, safely inside the uplink */
  var allies = [];
  for (i = 0; i < (snap.towers || []).length; i++){
    var t = snap.towers[i];
    if (t.ownerId !== this.id) allies.push(t);
  }
  if (!allies.length) return;
  var best = null, bestN = -1;
  for (i = 0; i < allies.length; i++){
    var n = 0;
    for (var j = 0; j < allies.length; j++){
      if (i !== j && dist2(allies[i].cx, allies[i].cz, allies[j].cx, allies[j].cz) <= 16) n++;
    }
    if (n > bestN){ bestN = n; best = allies[i]; }
  }
  var self = this;
  var cell = this.findCellNear(best.cx, best.cz, 3, function(x, z){
    if (!self.inUplink(x, z, snap, 3)) return false;
    var chk = self.sim.canPlaceTower(x, z, pick, self.id);
    return chk.ok && self.canAfford(chk.cost, snap);
  });
  if (!cell) return;
  var res = this.intent('buildTower', { cx: cell.cx, cz: cell.cz, towerId: pick });
  if (res.ok) this.say((def.name || pick) + ' online, supporting allied guns');
};

/* ============================================================
 * Seat management
 * ============================================================ */
function addCommander(sim, opts){
  opts = opts || {};
  var doctrine = (NB.DOCTRINES || {})[opts.doctrine] ? opts.doctrine : 'engineer';
  var n = ++_counters[doctrine];
  var name = opts.name || (doctrineName(doctrine) + '-' + n);
  var id = opts.id || ('ai' + (++_seatCounter) + '_' + doctrine);
  var color = opts.color || AI_COLORS[doctrine] || '#a3e635';
  var added = sim.addPlayer({ id: id, name: name, color: color,
                              doctrine: doctrine, isAI: true });
  if (!added.ok) return { ok: false, reason: added.reason };
  var commander = new Commander(sim, added.player,
                                { difficulty: opts.difficulty || 'regular' });
  return { ok: true, player: added.player, commander: commander };
}

/* Fill empty co-op seats with AI commanders, up to MAX_PLAYERS total.
 * doctrines: optional array cycled for variety. */
function fillSeats(sim, opts){
  opts = opts || {};
  if (!opts.aiFill) return [];
  var snap;
  try { snap = sim.snapshot(); } catch (e){ return []; }
  var have = (snap.players || []).length;
  var doctrines = opts.doctrines || ['engineer', 'vanguard', 'warden'];
  var difficulty = opts.difficulty || 'regular';
  var out = [];
  var di = 0;
  while (have < MAX_PLAYERS){
    var r = addCommander(sim, { doctrine: doctrines[di % doctrines.length],
                                difficulty: difficulty });
    if (!r.ok) break;
    out.push(r);
    have++;
    di++;
  }
  return out;
}

/* Host-side manager: one tick call drives every commander. */
function createManager(sim){
  var mgr = {
    sim: sim,
    commanders: [],
    add: function(opts){
      var r = addCommander(sim, opts || {});
      if (r.ok) mgr.commanders.push(r.commander);
      return r;
    },
    remove: function(playerId){
      for (var i = 0; i < mgr.commanders.length; i++){
        if (mgr.commanders[i].id === playerId){
          mgr.commanders.splice(i, 1);
          return true;
        }
      }
      return false;
    },
    get: function(playerId){
      for (var i = 0; i < mgr.commanders.length; i++){
        if (mgr.commanders[i].id === playerId) return mgr.commanders[i];
      }
      return null;
    },
    tick: function(dt){
      for (var i = 0; i < mgr.commanders.length; i++){
        mgr.commanders[i].tick(dt);
      }
    },
    drainEvents: function(){
      var out = [];
      for (var i = 0; i < mgr.commanders.length; i++){
        var evs = mgr.commanders[i].drainEvents();
        for (var j = 0; j < evs.length; j++) out.push(evs[j]);
      }
      return out;
    },
    fillSeats: function(opts){
      var added = fillSeats(sim, opts || {});
      for (var i = 0; i < added.length; i++) mgr.commanders.push(added[i].commander);
      return added;
    }
  };
  return mgr;
}

NB.AI = {
  DIFFICULTY: DIFFICULTY,
  MAX_PLAYERS: MAX_PLAYERS,
  Commander: Commander,
  addCommander: addCommander,
  fillSeats: fillSeats,
  createManager: createManager,
  effStats: effStats,
  dpsOf: dpsOf
};

})();
