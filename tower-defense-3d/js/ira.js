/* Nova Bastion 3D - IRA (Integrated Response Adjutant)
 *
 * A rule-based in-game advisor. IRA watches a sim snapshot and, roughly
 * every 2 seconds, speaks one concise line of mission-control advice, or
 * stays silent (returns null). No LLM, no network, no randomness that
 * matters: every trigger is a pure predicate over the snapshot.
 *
 * ---- LLM SEAM (optional, never required) ----
 * To plug an LLM backend in later, replace NB.IRA.generate with a function
 *   (snapshot, ctx) => string | null   (sync) or Promise<string | null>.
 * A good pattern: keep this file's rule engine as the offline fallback and
 * the candidate shortlist, then let the LLM pick and rephrase one line:
 *
 *   NB.IRA.generate = async function(snapshot, ctx){
 *     var cands = NB.IRA.shortlist(snapshot);   // ranked [{id, line}]
 *     if (!cands.length) return null;
 *     var line = await myLLM.pickLine(cands, snapshot); // your backend
 *     return NB.IRA.trackFire(line ? cands[0].id : null, ctx) && line;
 *   };
 *
 * The game loop must keep calling NB.IRA.advise(snapshot, ctx) exactly as
 * today; advise() delegates to NB.IRA.generate. If the LLM is unreachable,
 * fall back to ruleBasedAdvisor so the game always works offline.
 *
 * ---- Snapshot contract (built by the game from the sim, read-only) ----
 *   gold, energyUsed, energyCap, morale, moraleState ('steady'|'inspired'|
 *   'despair'|'unrest'), surge {active, warningIn}, uplinkRadius,
 *   towers[] {id, name?, dark, powered, veteran, activeSynergies[]},
 *   walls[] {hp, maxHp}, enemies[] {type, count, gate, boss?},
 *   gates[] {x, z, name?}, cols, rows, waveIndex, waveActive, breached,
 *   overclock {strain}, players[] {id, name?, doctrine}
 * Missing fields are tolerated; every trigger degrades gracefully.
 *
 * ---- UI contract ----
 *   NB.IRA.muted            : boolean flag; the UI toggles it. When true,
 *                             advise() always returns null. Never blocks
 *                             gameplay; the sim never waits on IRA.
 *   NB.IRA.LINE_TTL_MS = 6000: lines expire after 6 seconds; the UI hides
 *                             them, the sim keeps running.
 *   NB.IRA.lastFired        : id of the trigger that fired last (or null).
 *                             Informational only, handy for tests.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }
function arr(v){ return Array.isArray(v) ? v : []; }
function cap(s){ s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

var ENEMY_NAMES = {
  drone:'Scout Drone', runner:'Skitter', swarmling:'Shredder', tank:'Siege Walker',
  shieldbearer:'Aegis Shield-bot', phantom:'Wraith', medic:'Repair Drone',
  splitter:'Hive Carrier', mite:'Tick', sapper:'Sapper', brute:'Juggernaut',
  dreadnought:'Dreadnought', overmind:'Overmind', leviathan:'Leviathan'
};
/* tower ids that answer each enemy type, used by the coverage trigger */
var COUNTERS = {
  runner:['frost','chrono'], drone:['pulse','arc'], swarmling:['arc','mortar'],
  tank:['sniper','mortar'], shieldbearer:['sniper'], phantom:['arc','frost'],
  medic:['sniper'], splitter:['arc','mortar'], sapper:['pulse','mortar'],
  brute:['sniper','mortar'], mite:['pulse'],
  dreadnought:['sniper','mortar'], overmind:['sniper','mortar'], leviathan:['sniper','mortar']
};
var COUNTER_NAMES = { frost:'Cryo', chrono:'Stasis', pulse:'Pulse', arc:'Arc',
                      mortar:'Mortar', sniper:'Sniper' };
var BOSS_TYPES = ['dreadnought','overmind','leviathan'];
var DIR_ADJ = { east:'eastern', west:'western', north:'northern', south:'southern' };

function enemyName(t){ return ENEMY_NAMES[t] || cap(t); }
function dirAdj(d){ return DIR_ADJ[d] || d || 'outer'; }

/* Resolve a gate reference (index, name string, or {x,z}) to a compass word. */
function gateDirection(gate, snap){
  if (gate === null || gate === undefined) return null;
  if (typeof gate === 'string') return gate.toLowerCase();
  var g = null;
  if (typeof gate === 'number') g = arr(snap.gates)[gate] || null;
  else if (typeof gate === 'object') g = gate;
  if (!g) return null;
  if (g.name) return String(g.name).toLowerCase();
  var cols = num(snap.cols, 64), rows = num(snap.rows, 40);
  var dx = num(g.x, cols/2) - cols/2, dz = num(g.z, rows/2) - rows/2;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
  return dz >= 0 ? 'south' : 'north';
}

function activeTowers(snap){
  return arr(snap.towers).filter(function(t){ return !t.dark && t.powered !== false; });
}
function massingType(snap){
  var byType = {}, best = null, bestN = 0;
  arr(snap.enemies).forEach(function(e){
    var n = num(e.count, 1);
    byType[e.type] = (byType[e.type] || 0) + n;
    if (byType[e.type] > bestN){ bestN = byType[e.type]; best = e; }
  });
  if (!best || bestN < 6) return null;
  return { type: best.type, count: bestN, gate: best.gate };
}
function counterCoverage(snap, type){
  var ids = COUNTERS[type] || [];
  var towers = activeTowers(snap);
  for (var i = 0; i < towers.length; i++){
    if (ids.indexOf(towers[i].id) >= 0) return towers[i].id;
  }
  return null;
}
function counterLabel(type){
  var ids = COUNTERS[type] || [];
  return ids.map(function(id){ return COUNTER_NAMES[id] || cap(id); }).join(' or ');
}
function distinctDoctrines(snap){
  var seen = {}, out = [];
  arr(snap.players).forEach(function(p){
    if (p.doctrine && !seen[p.doctrine]){ seen[p.doctrine] = true; out.push(p.doctrine); }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Triggers. Each: {id, priority (lower fires first), cooldownSec,
 * when(snap)->bool, line(snap)->string}. 3-4 voice variants each.      */
/* ------------------------------------------------------------------ */
var TRIGGERS = [

{ id:'boss_incoming', priority:10, cooldownSec:45,
  when: function(s){
    return arr(s.enemies).some(function(e){
      return e.boss === true || BOSS_TYPES.indexOf(e.type) >= 0;
    });
  },
  line: function(s){
    var b = arr(s.enemies).filter(function(e){
      return e.boss === true || BOSS_TYPES.indexOf(e.type) >= 0;
    })[0] || {};
    var dir = dirAdj(gateDirection(b.gate, s));
    var v = [
      'Something big is coming through the ' + dir + ' gate. Check the scope.',
      enemyName(b.type) + '-class signature on the scope. All guns, Commander.',
      'Big one inbound on the ' + dir + ' approach. Aim for the legs. Metaphorically. It has no legs.',
      'The scope just lit up like a holiday. ' + enemyName(b.type) + ', ' + dir + ' gate. Do not let it knock.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'surge_warning', priority:20, cooldownSec:30,
  when: function(s){
    var sg = s.surge || {};
    return !sg.active && sg.warningIn !== null && sg.warningIn !== undefined &&
           num(sg.warningIn, 999) <= 60;
  },
  line: function(s){
    var n = Math.max(1, Math.round(num((s.surge || {}).warningIn, 60)));
    var d = arr(s.towers).filter(function(t){ return t.dark; }).length;
    var v = [
      'Blackout surge in ' + n + ' seconds. ' + d + ' turret' + (d === 1 ? '' : 's') +
        ' sit' + (d === 1 ? 's' : '') + ' outside the uplink.',
      'Heads up, Commander. The surge hits in ' + n + ' seconds. Anything dark is about to stay dark.',
      'Surge countdown: ' + n + ' seconds. ' + d + ' turret' + (d === 1 ? '' : 's') +
        ' outside the wire. Pull them in or lose them.',
      n + ' seconds to blackout. The uplink is about to shrink. Plan accordingly.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'surge_active', priority:25, cooldownSec:60,
  when: function(s){ return !!(s.surge || {}).active; },
  line: function(){
    var v = [
      'Blackout surge is here. Hardened rust moves faster now. Hold the line.',
      'The uplink just shrank, Commander. The dark is not your friend tonight.',
      'Surge active. Wraiths and hive carriers love this weather. Stay sharp.',
      'We are in the blackout. Conserve, concentrate, and do not panic. Panic is my job.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'wall_breach', priority:30, cooldownSec:30,
  when: function(s){ return s.breached === true; },
  line: function(s){
    var dir = dirAdj(gateDirection((arr(s.enemies)[0] || {}).gate, s));
    var v = [
      'Western wall breached. They are inside the wire.',
      'Breach on the ' + dir + ' wall. Seal it or lose the sector.',
      'They are through the wall, Commander. Polite of them to knock first.',
      'Inner perimeter compromised. Everything you love is behind that wall.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'overclock_strain', priority:40, cooldownSec:30,
  when: function(s){ return num((s.overclock || {}).strain, 0) >= 80; },
  line: function(s){
    var n = Math.round(num((s.overclock || {}).strain, 80));
    var v = [
      'Spire strain critical. Vent it or lose the core.',
      'Overclock strain at ' + n + ' percent. The Spire is screaming, Commander. Vent it.',
      'The core cannot take much more of this. Vent the strain. That is an order phrased as advice.',
      'Strain ' + n + ' percent and climbing. Your call, but the Spire disagrees with it.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'morale_low', priority:50, cooldownSec:60,
  when: function(s){
    return s.moraleState === 'despair' || s.moraleState === 'unrest' || num(s.morale, 100) <= 25;
  },
  line: function(){
    var v = [
      'Morale is failing. The colonists are watching the walls.',
      'The hab decks are quiet, Commander. Too quiet. Win something for them.',
      'Morale critical. People fight worse when they have stopped believing.',
      'The colony is losing heart. Give them a victory, any size, soon.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'power_shortage', priority:60, cooldownSec:45,
  when: function(s){
    return arr(s.towers).some(function(t){ return t.powered === false && !t.dark; });
  },
  line: function(s){
    var n = arr(s.towers).filter(function(t){ return t.powered === false && !t.dark; }).length;
    var v = [
      n + ' turret' + (n === 1 ? '' : 's') + ' unpowered. The grid cannot feed them all. Build a reactor.',
      'Brownouts on the line, Commander. Turrets without power are decorations.',
      'Power deficit: ' + n + ' turret' + (n === 1 ? '' : 's') + ' dark on the inside. Feed them or sell them.',
      'The grid is tapped out. A reactor would fix this faster than hope.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'dark_turrets', priority:70, cooldownSec:45,
  when: function(s){
    return arr(s.towers).filter(function(t){ return t.dark; }).length >= 2;
  },
  line: function(s){
    var n = arr(s.towers).filter(function(t){ return t.dark; }).length;
    var v = [
      n + ' turrets are dark, Commander. The Spire\u2019s reach is not what it used to be.',
      n + ' of your turrets are asleep outside the uplink. Wake them with a Spire upgrade.',
      'Dark towers: ' + n + '. They look lovely as statues. They shoot better awake.',
      n + ' turrets beyond the uplink. Either extend the light or move the guns.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'coverage_gap', priority:80, cooldownSec:40,
  when: function(s){
    var m = massingType(s);
    return !!m && !counterCoverage(s, m.type);
  },
  line: function(s){
    var m = massingType(s) || { type:'drone', gate:null };
    var dir = dirAdj(gateDirection(m.gate, s));
    var v = [
      enemyName(m.type) + ' pack massing ' + dir + '. ' + counterLabel(m.type) + ' coverage is thin there.',
      'Scouts report ' + enemyName(m.type) + 's building up ' + dir + '. We have nothing that answers them.',
      dirAdj(gateDirection(m.gate, s)) + ' gate: ' + enemyName(m.type) + 's incoming, and no ' +
        counterLabel(m.type) + ' to greet them. Rude of us.',
      enemyName(m.type) + 's, ' + dir + ', in numbers. Whatever counters them, build it yesterday.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'energy_surplus', priority:90, cooldownSec:60,
  when: function(s){
    return num(s.energyCap, 0) - num(s.energyUsed, 0) >= 25 && num(s.gold, 0) >= 250;
  },
  line: function(){
    var v = [
      'Energy surplus, Commander. An Arc coil would end this.',
      'The grid is humming with spare power. Spend it before the rust does something clever.',
      'Surplus energy on the board. Arc coils eat power and spit lightning. Just saying.',
      'Power to spare and gold to spend. The Arc coil is right there. I am not subtle.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'economy_idle', priority:100, cooldownSec:60,
  when: function(s){ return num(s.gold, 0) >= 700; },
  line: function(s){
    var g = Math.round(num(s.gold, 0));
    var v = [
      'The treasury is full and the walls are not. Gold does not shoot, Commander.',
      g + ' gold sitting idle. The rust is not impressed by savings accounts.',
      'Rich and undefended, my least favorite combination. Build something.',
      'That gold is not earning interest against the swarm. Spend it like you mean it.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'doctrine_synergy', priority:110, cooldownSec:90,
  when: function(s){
    var d = distinctDoctrines(s);
    return d.length >= 2 &&
      arr(s.towers).some(function(t){ return arr(t.activeSynergies).length > 0; });
  },
  line: function(s){
    var d = distinctDoctrines(s);
    var a = cap(d[0]), b = cap(d[1]);
    var v = [
      'Your ' + a + '\u2019s uplink overlaps the ' + b + '\u2019s kill zone. Beautiful.',
      a + ' and ' + b + ' coverage overlapping. The rust will not enjoy this.',
      'Two doctrines, one kill box. Textbook, Commander.',
      'Synergy online between ' + a + ' and ' + b + ' guns. Somewhere, a rust tactician just despaired.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'wall_repair', priority:120, cooldownSec:45,
  when: function(s){
    return arr(s.walls).some(function(w){
      return num(w.maxHp, 1) > 0 && num(w.hp, 0) / num(w.maxHp, 1) < 0.4;
    });
  },
  line: function(s){
    var w = arr(s.walls).filter(function(x){
      return num(x.maxHp, 1) > 0 && num(x.hp, 0) / num(x.maxHp, 1) < 0.4;
    })[0] || { hp:0, maxHp:1 };
    var pct = Math.round(num(w.hp, 0) / Math.max(1, num(w.maxHp, 1)) * 100);
    var v = [
      'Wall segment at ' + pct + ' percent integrity. Patch it before the next wave.',
      'That wall is more hope than plating. Send a repair crew.',
      'A wall is hanging on at ' + pct + ' percent. The rust has noticed. Probably.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'veteran', priority:130, cooldownSec:90,
  when: function(s){
    return arr(s.towers).some(function(t){ return num(t.veteran, 0) >= 2; });
  },
  line: function(s){
    var t = arr(s.towers).filter(function(x){ return num(x.veteran, 0) >= 2; })[0] || {};
    var name = t.name || enemyName(t.id) || 'turret';
    if (ENEMY_NAMES[t.id]) name = cap(t.id) + ' turret';
    var v = [
      'That ' + name + ' just went elite. Thirty percent meaner. The crews are cheering.',
      'Veteran crew on the ' + name + '. They have seen things. They shoot straighter.',
      'Elite status confirmed on the ' + name + '. Buy those crews a drink. After the wave.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'morale_high', priority:140, cooldownSec:90,
  when: function(s){
    return s.moraleState === 'inspired' || num(s.morale, 0) >= 80;
  },
  line: function(){
    var v = [
      'Morale is soaring. The colonists are singing on the net. Do not waste it.',
      'The bastion believes in you, Commander. Keep it that way.',
      'Inspired colonists, inspired crews. Strike while the singing lasts.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'idle', priority:999, cooldownSec:120,
  when: function(s){
    return !s.waveActive && arr(s.enemies).length === 0 && !(s.surge || {}).active;
  },
  line: function(){
    var v = [
      'All quiet. Too quiet. Build while you can.',
      'No contacts on the scope. A rare gift. Spend it on walls.',
      'The dust is settling and nothing is moving. Enjoy it. It never lasts.',
      'Quiet sector, Commander. The rust is regrouping, which means so should we.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

/* ---------------- colony economy ---------------- */

{ id:'food_negative', priority:55, cooldownSec:60,
  when: function(s){
    return num(s.foodRate, 0) < -0.05 && num(s.food, 999) < 40 && !s.starving;
  },
  line: function(s){
    var v = [
      'Food reserves are falling, Commander. Staff the hydroponics or build more.',
      'We are eating faster than we grow. More laborers on the farms, please.',
      'Hydroponics output is behind consumption. Fix it before the stores run dry.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'starving', priority:15, cooldownSec:45,
  when: function(s){ return !!s.starving; },
  line: function(){
    var v = [
      'The colony is STARVING. Hydroponics, now. Everything else can wait.',
      'Empty stores, empty stomachs. Get food growing or morale collapses.',
      'Starvation protocols, Commander. This is how bastions fall from the inside.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'idle_workers', priority:120, cooldownSec:90,
  when: function(s){
    var p = s.pop || {};
    return num(p.idle, 0) >= 4 && (arr(s.extractors).length + arr(s.hydros).length) > 0;
  },
  line: function(s){
    var n = Math.round(num((s.pop || {}).idle, 0));
    var v = [
      n + ' colonists are idle. The auto-governor can staff them, or assign them yourself.',
      'Idle hands, Commander: ' + n + ' colonists waiting for work. Farms and extractors are hungry.',
      n + ' idle colonists on the roster. Put them to work or turn the governor on.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'metal_stockpiled', priority:130, cooldownSec:120,
  when: function(s){
    return num(s.metal, 0) >= 60 && num(s.metalRate, 0) > 0.5;
  },
  line: function(s){
    var v = [
      'Metal stockpiled and the forges are warm. Tier-3 upgrades and branches are hungry for it.',
      'We are sitting on ' + Math.floor(num(s.metal, 0)) + ' metal. Spend it on the top-end upgrades.',
      'Scrap reserves looking healthy. That metal wants to be a tier-3 turret.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } },

{ id:'pop_cap', priority:125, cooldownSec:120,
  when: function(s){
    var p = s.pop || {};
    return num(p.total, 0) >= num(p.cap, 999) - 1 && num(p.cap, 0) > 0;
  },
  line: function(){
    var v = [
      'Housing is full. Build a Hab Module if you want the colony to keep growing.',
      'No bunks left, Commander. Hab Modules mean more hands for the war.',
      'The colony has outgrown its housing. Hab Modules, unless you like the smell of full.'
    ];
    return v[Math.floor(Math.random() * v.length)];
  } }

];

TRIGGERS.sort(function(a, b){ return a.priority - b.priority; });

/* ------------------------------------------------------------------ */
/* Engine                                                               */
/* ------------------------------------------------------------------ */
function ruleBasedAdvisor(snapshot, ctx){
  ctx = ctx || {};
  var cooldowns = ctx.cooldowns || {};
  var now = num(ctx.time, Date.now() / 1000);
  var s = snapshot || {};
  for (var i = 0; i < TRIGGERS.length; i++){
    var t = TRIGGERS[i];
    var readyAt = num(cooldowns[t.id], -Infinity);
    if (now < readyAt) continue;
    var ok = false;
    try { ok = !!t.when(s); } catch (e){ ok = false; }
    if (!ok) continue;
    var line = null;
    try { line = t.line(s); } catch (e){ line = null; }
    if (!line) continue;
    cooldowns[t.id] = now + t.cooldownSec;
    ctx.cooldowns = cooldowns;
    NB.IRA.lastFired = t.id;
    return line;
  }
  NB.IRA.lastFired = null;
  return null;
}

NB.IRA = {
  muted: false,
  LINE_TTL_MS: 6000,          /* UI hides a line 6s after it appears */
  triggers: TRIGGERS,
  lastFired: null,

  /* Default generator. Reassign to plug an LLM backend (see seam note). */
  generate: ruleBasedAdvisor,

  /* The game calls this about every 2 seconds. Returns one line or null. */
  advise: function(snapshot, ctx){
    if (NB.IRA.muted) return null;
    return NB.IRA.generate(snapshot, ctx);
  },

  /* Ranked trigger candidates for the current snapshot, ignoring
   * cooldowns. Useful as the LLM shortlist (see seam note above). */
  shortlist: function(snapshot){
    var s = snapshot || {};
    var out = [];
    for (var i = 0; i < TRIGGERS.length; i++){
      var t = TRIGGERS[i], ok = false;
      try { ok = !!t.when(s); } catch (e){ ok = false; }
      if (!ok) continue;
      var line = null;
      try { line = t.line(s); } catch (e){ line = null; }
      if (line) out.push({ id: t.id, priority: t.priority, line: line });
    }
    return out;
  },

  /* Record a manual fire (used by custom generate() implementations). */
  trackFire: function(triggerId, ctx){
    ctx = ctx || {};
    var cooldowns = ctx.cooldowns || {};
    var now = num(ctx.time, Date.now() / 1000);
    for (var i = 0; i < TRIGGERS.length; i++){
      if (TRIGGERS[i].id === triggerId){
        cooldowns[triggerId] = now + TRIGGERS[i].cooldownSec;
        break;
      }
    }
    ctx.cooldowns = cooldowns;
    NB.IRA.lastFired = triggerId || null;
    return !!triggerId;
  },

  resetCooldowns: function(ctx){
    if (ctx) ctx.cooldowns = {};
    NB.IRA.lastFired = null;
  }
};

/* ------------------------------------------------------------------ */
/* Situation report (player clicks IRA) + click easter egg              */
/* ------------------------------------------------------------------ */
var RECOMMEND = {
  boss_incoming: 'Focus everything on the big one. Strip its shields, then its armor.',
  surge_warning: 'Pull exposed turrets inside the uplink before the blackout hits.',
  surge_active: 'Conserve and concentrate until the surge passes.',
  wall_breach: 'Seal the breach first. Walls before everything.',
  overclock_strain: 'Vent the Spire strain before it vents itself.',
  morale_low: 'Give the colonists a small victory. Any size counts.',
  power_shortage: 'Build a reactor. Unpowered turrets are statues.',
  starving: 'Hydroponics, staffed with laborers. Nothing else matters until the colony eats.',
  food_negative: 'Food is draining. More farms, or more laborers on the ones you have.',
  idle_workers: 'Idle colonists are wasted hands. Governor on, or assign them yourself.',
  metal_stockpiled: 'Spend that metal: tier-3 upgrades, branches, late-age towers.',
  pop_cap: 'Hab Modules raise the housing cap. More people, more war.',
  dark_turrets: 'Extend the uplink, or move the dark turrets into the light.',
  coverage_gap: 'Build {counter} coverage on the threatened axis.',
  energy_surplus: 'Spend the surplus. An Arc coil is waiting.',
  economy_idle: 'That gold is not a wall. Build like it.',
  doctrine_synergy: 'Keep the doctrines overlapped. It is working.',
  wall_repair: 'Patch the weak wall segment before the next wave.',
  veteran: 'Protect your veterans. They earn their keep.',
  morale_high: 'Strike while the singing lasts.',
  idle: 'Build while it is quiet.'
};

function recommendFor(s){
  for (var i = 0; i < TRIGGERS.length; i++){
    var t = TRIGGERS[i], ok = false;
    try { ok = !!t.when(s); } catch (e){ ok = false; }
    if (!ok) continue;
    var rec = RECOMMEND[t.id];
    if (!rec) continue;
    if (t.id === 'coverage_gap'){
      var m = massingType(s);
      rec = rec.replace('{counter}', m ? counterLabel(m.type) : 'counter');
    }
    return rec;
  }
  return 'Hold the line.';
}

function threatSummary(s){
  var list = arr(s.enemies), i, e;
  for (i = 0; i < list.length; i++){
    e = list[i];
    if (e.boss === true || BOSS_TYPES.indexOf(e.type) >= 0){
      return 'a ' + enemyName(e.type) + ' pushing the ' +
             dirAdj(gateDirection(e.gate, s)) + ' approach';
    }
  }
  if (s.breached === true) return 'rust inside the wire';
  var m = massingType(s);
  if (m) return 'a ' + enemyName(m.type) + ' pack massing ' + dirAdj(gateDirection(m.gate, s));
  if (list.length) return 'scattered contacts across the field';
  return 'nothing on the scope';
}

/* 2-3 sentence situation report: wave state, biggest threat axis,
 * economy, morale, and one recommendation. Rule-based, same voice. */
NB.IRA.report = function(snapshot){
  var s = snapshot || {};
  var wTotal = num(s.wavesTotal, 0);
  var waveBit = s.over ? 'The sector is decided'
    : s.waveActive ? ('Wave ' + (num(s.waveIndex, 0) + 1) +
                     (wTotal ? ' of ' + wTotal : '') + ' is live')
    : 'Between waves';
  if ((s.surge || {}).active) waveBit += ' under a blackout surge';
  var moraleWord = s.moraleState === 'inspired' ? 'soaring'
    : s.moraleState === 'despair' ? 'failing'
    : s.moraleState === 'unrest' ? 'in open unrest' : 'steady';
  var econ = 'Morale is ' + moraleWord + ' at ' + Math.round(num(s.morale, 0)) +
    ', the treasury holds ' + Math.round(num(s.gold, 0)) + ' gold, and the grid runs ' +
    Math.round(num(s.energyUsed, 0)) + ' of ' + Math.round(num(s.energyCap, 0)) + '.';
  return waveBit + '; biggest threat: ' + threatSummary(s) + '. ' + econ +
    ' Recommendation: ' + recommendFor(s);
};

/* Click handler: the UI calls NB.IRA.click(snapshot) when the player clicks
 * IRA. Five clicks within 30 seconds earn a dry easter egg instead of the
 * usual report. nowMs is injectable for tests; defaults to Date.now(). */
NB.IRA.EGG_LINES = [
  'That is five pokes in thirty seconds, Commander. I am an adjutant, not a doorbell.',
  'Keep clicking and I will start billing. One credit per poke. You are at five, and counting is my best skill.'
];
NB.IRA._clickTimes = [];
NB.IRA._eggFlip = false;
NB.IRA.click = function(snapshot, nowMs){
  var now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
  var ts = NB.IRA._clickTimes;
  ts.push(now);
  while (ts.length && now - ts[0] > 30000) ts.shift();
  if (ts.length >= 5){
    ts.length = 0;
    NB.IRA._eggFlip = !NB.IRA._eggFlip;
    return NB.IRA.EGG_LINES[NB.IRA._eggFlip ? 0 : 1];
  }
  return NB.IRA.report(snapshot);
};

})();
