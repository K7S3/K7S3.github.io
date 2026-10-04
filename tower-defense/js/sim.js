/* Nova Bastion - simulation engine (headless, no DOM) */
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

NB.createSim = function(level, opts){
  opts = opts || {};
  var CONFIG = NB.CONFIG || {};
  var TOWERS = NB.TOWERS || {};
  var ENEMIES = NB.ENEMIES || {};
  var LEVELS = NB.LEVELS || [];
  var SYNERGIES = NB.SYNERGIES || [];

  var CFG = {
    WIDTH: num(CONFIG.WIDTH, 960),
    HEIGHT: num(CONFIG.HEIGHT, 600),
    INTEREST_RATE: num(CONFIG.INTEREST_RATE, 0.05),
    SELLBACK: num(CONFIG.SELLBACK, 0.7),
    EARLY_BASE: num(CONFIG.EARLY_BASE, 10),
    EARLY_PER_SEC: num(CONFIG.EARLY_PER_SEC, 2),
    SYNERGY_RADIUS: num(CONFIG.SYNERGY_RADIUS, 150),
    INTERMISSION: num(CONFIG.INTERMISSION, 20)
  };

  var lv = null;
  if (typeof level === 'number') lv = LEVELS[level];
  else if (level && typeof level === 'object') lv = level;
  if (!lv){
    lv = { id: 0, name: 'Untitled', startGold: 100, lives: 20,
      path: [[0, 300], [CFG.WIDTH, 300]], plots: [], waves: [], anomalies: [] };
  }

  /* path precompute */
  var path = (lv.path && lv.path.length >= 2) ? lv.path : [[0, 300], [CFG.WIDTH, 300]];
  var segLen = [], cum = [0], totalLen = 0, pi;
  for (pi = 1; pi < path.length; pi++){
    var pdx = path[pi][0] - path[pi-1][0];
    var pdy = path[pi][1] - path[pi-1][1];
    var PL = Math.sqrt(pdx*pdx + pdy*pdy);
    segLen.push(PL); totalLen += PL; cum.push(totalLen);
  }
  function pointAt(d){
    d = Math.max(0, Math.min(d, totalLen));
    var s = 1;
    while (s < cum.length - 1 && cum[s] < d) s++;
    var L2 = segLen[s-1] || 1;
    var f = L2 > 0 ? (d - cum[s-1]) / L2 : 0;
    return [path[s-1][0] + (path[s][0] - path[s-1][0]) * f,
            path[s-1][1] + (path[s][1] - path[s-1][1]) * f];
  }

  var startLives = Math.max(1, Math.round(num(lv.lives, 20)));
  var events = [];
  var st = {
    gold: num(lv.startGold, 100),
    lives: startLives, startLives: startLives,
    waveIndex: 0, wavesTotal: (lv.waves || []).length,
    waveActive: false, intermission: CFG.INTERMISSION,
    enemies: [], towers: [], projectiles: [], beams: [],
    time: 0, speed: num(opts.speed, 1) || 1, paused: false, slowmoT: 0,
    over: false, victory: false, defeatReason: '', stars: 0,
    stats: { kills: 0, leaked: 0, goldEarned: 0, towersBuilt: 0,
             upgradesBought: 0, bossesKilled: 0, anomaliesSeen: 0 },
    spawnQueue: [], delayed: [],
    activeAnomaly: null, goldRush: false, shake: 0,
    curHpMult: 1, curBountyMult: 1
  };

  var sim = {
    level: lv, state: st, events: events,
    nextInstId: 0, nextEnemyId: 0,
    synergyAnnounced: {}, recentAnom: [], synById: {}
  };
  var si;
  for (si = 0; si < SYNERGIES.length; si++){
    if (SYNERGIES[si] && SYNERGIES[si].id) sim.synById[SYNERGIES[si].id] = SYNERGIES[si];
  }

  function d2(ax, ay, bx, by){ var dx = ax-bx, dy = ay-by; return dx*dx + dy*dy; }
  function towerById(id){
    for (var k = 0; k < st.towers.length; k++) if (st.towers[k].instId === id) return st.towers[k];
    return null;
  }
  function enemyById(id){
    for (var k = 0; k < st.enemies.length; k++) if (st.enemies[k].id === id) return st.enemies[k];
    return null;
  }

  /* ---------- synergies ---------- */
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

  function recomputeBuffs(){
    var i, t;
    for (i = 0; i < st.towers.length; i++){ st.towers[i].buffDmg = 1; st.towers[i].buffRate = 1; }
    var amps = [], chronos = [];
    for (i = 0; i < st.towers.length; i++){
      t = st.towers[i];
      if (t.def.behavior === 'buff') amps.push(t);
      else if (t.def.behavior === 'field') chronos.push(t);
    }
    var R = CFG.SYNERGY_RADIUS;
    for (i = 0; i < st.towers.length; i++){
      t = st.towers[i];
      var beh = t.def.behavior;
      if (beh === 'economy' || beh === 'buff') continue;
      var bestDmg = 1, bestRate = 1, a, c;
      for (a = 0; a < amps.length; a++){
        var am = amps[a];
        if (am.instId === t.instId) continue;
        var ar = num(am.stats.range, 0);
        if (d2(am.x, am.y, t.x, t.y) > ar*ar) continue;
        var sp = am.stats.special || {};
        var dm = num(sp.damageMult, 1), rm = num(sp.rateMult, 1);
        var boosted = false;
        for (c = 0; c < chronos.length; c++){
          if (d2(chronos[c].x, chronos[c].y, am.x, am.y) <= R*R){ boosted = true; break; }
        }
        if (boosted){ dm *= 1.2; rm *= 1.2; }
        if (dm > bestDmg) bestDmg = dm;
        if (rm > bestRate) bestRate = rm;
      }
      for (c = 0; c < chronos.length; c++){
        var ch = chronos[c];
        if (ch.instId === t.instId) continue;
        var csp = ch.stats.special || {};
        if (!csp.rateBoost) continue;
        var cr = num(ch.stats.range, 0);
        if (d2(ch.x, ch.y, t.x, t.y) <= cr*cr) bestRate *= num(csp.rateBoost, 1.3);
      }
      t.buffDmg = bestDmg;
      t.buffRate = bestRate;
    }
  }

  function recomputeSynergies(){
    var i, f, g;
    for (i = 0; i < st.towers.length; i++) st.towers[i].activeSynergies = [];
    var R2 = CFG.SYNERGY_RADIUS * CFG.SYNERGY_RADIUS;
    for (var s = 0; s < SYNERGIES.length; s++){
      var syn = SYNERGIES[s];
      if (!syn || !syn.id || !syn.from) continue;
      var toList = Array.isArray(syn.to) ? syn.to : [syn.to];
      for (f = 0; f < st.towers.length; f++){
        if (st.towers[f].id !== syn.from) continue;
        for (g = 0; g < st.towers.length; g++){
          var tt = st.towers[g];
          if (toList.indexOf(tt.id) < 0) continue;
          if (d2(st.towers[f].x, st.towers[f].y, tt.x, tt.y) <= R2){
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
        events.push({ t: 'synergy', name: syn.name || syn.id, desc: syn.desc || '' });
        events.push({ t: 'announce', text: 'SYNERGY: ' + (syn.name || syn.id),
                      sub: syn.desc || '', color: '#7df9ff' });
      }
    }
  }

  function recompute(){ recomputeBuffs(); recomputeSynergies(); }

  /* ---------- enemies ---------- */
  function spawnEnemy(type, distOff, hpMult, bountyMult){
    var def = ENEMIES[type];
    if (!def) return null;
    if (st.enemies.length + st.spawnQueue.length >= 220) return null;
    var ab = def.abilities || {};
    var maxHp = num(def.hp, 10) * num(hpMult, 1);
    var p = pointAt(num(distOff, 0));
    var e = {
      id: ++sim.nextEnemyId, type: type, def: def,
      x: p[0], y: p[1], dist: num(distOff, 0),
      speed: num(def.speed, 40),
      hp: maxHp, maxHp: maxHp,
      bounty: Math.max(1, Math.round(num(def.bounty, 1) * num(bountyMult, 1))),
      lives: Math.max(1, Math.round(num(def.lives, 1))),
      size: num(def.size, 10), color: def.color || '#f0f',
      slowUntil: 0, slowFactor: 1, frozenUntil: 0, stunUntil: 0, untargetableUntil: 0,
      shield: num(ab.shield, 0), maxShield: num(ab.shield, 0),
      healT: 0, phaseT: num(ab.phase && ab.phase.every, 6),
      spawnT: num(ab.spawn && ab.spawn.interval, 8),
      allyShieldT: num(ab.allyShield && ab.allyShield.interval, 4),
      enraged: false, dead: false, leaked: false, fieldVuln: null
    };
    st.enemies.push(e);
    events.push({ t: 'spawn', x: e.x, y: e.y, color: e.color });
    return e;
  }

  function leakEnemy(e){
    e.leaked = true;
    st.lives -= e.lives;
    st.stats.leaked++;
    var end = path[path.length - 1];
    events.push({ t: 'leak', x: end[0], y: end[1] });
    events.push({ t: 'float', x: end[0] - 24, y: end[1] - 24,
                  text: '-' + e.lives, color: '#ff5544', size: 14 });
    if (st.lives <= 0){
      st.lives = 0;
      st.over = true; st.victory = false; st.stars = 0;
      st.defeatReason = 'The bastion has fallen';
      events.push({ t: 'defeat', reason: st.defeatReason });
    }
  }

  function healAura(e, heal){
    var r2 = Math.pow(num(heal.radius, 100), 2);
    var amt = num(heal.amount, 10);
    for (var i = 0; i < st.enemies.length; i++){
      var o = st.enemies[i];
      if (o.dead || o.leaked) continue;
      if (d2(o.x, o.y, e.x, e.y) <= r2) o.hp = Math.min(o.maxHp, o.hp + amt);
    }
  }
  function allyShieldAura(e, as){
    var r2 = Math.pow(num(as.radius, 100), 2);
    var amt = num(as.amount, 10);
    for (var i = 0; i < st.enemies.length; i++){
      var o = st.enemies[i];
      if (o.dead || o.leaked) continue;
      if (d2(o.x, o.y, e.x, e.y) <= r2){
        o.shield = num(o.shield, 0) + amt;
        var cap = num(o.maxShield, 0);
        if (cap > 0) o.shield = Math.min(o.shield, cap);
      }
    }
  }

  function damageEnemy(e, amount, source){
    if (!e || e.dead || e.leaked) return;
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
        if (Math.random() < chance){
          amount *= num(spec.critMult, 2);
          events.push({ t: 'float', x: e.x, y: e.y - 14,
                        text: 'CRIT ' + Math.round(amount), color: '#ffd34d', size: 14 });
        }
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
    events.push({ t: 'kill', x: e.x, y: e.y, color: e.color, size: e.size });
    if (bounty >= 15){
      events.push({ t: 'float', x: e.x, y: e.y - 10,
                    text: '+' + bounty + 'g', color: '#ffd34d', size: 12 });
    }
    var i, tw;
    for (i = 0; i < st.towers.length; i++){
      tw = st.towers[i];
      if (!tw.def || tw.def.behavior !== 'economy') continue;
      var sp = (tw.stats && tw.stats.special) || {};
      if (!sp.killGoldBonus) continue;
      var kr = num(sp.killGoldRadius, 150);
      if (d2(tw.x, tw.y, e.x, e.y) <= kr*kr){
        st.gold += sp.killGoldBonus;
        st.stats.goldEarned += sp.killGoldBonus;
        events.push({ t: 'gold', x: tw.x, y: tw.y - 12, amount: sp.killGoldBonus });
      }
    }
    var ab = (e.def && e.def.abilities) || {};
    if (ab.split && ab.split.into){
      var n = Math.max(1, Math.round(num(ab.split.count, 2)));
      for (var k = 0; k < n; k++){
        spawnEnemy(ab.split.into, Math.max(0, e.dist - 8 - k*10), st.curHpMult, st.curBountyMult);
      }
    }
    var isBoss = (e.def && e.def.boss) || e.lives >= 10;
    if (isBoss){
      st.stats.bossesKilled++;
      st.slowmoT = 1.5;
      st.shake = 10;
      events.push({ t: 'slowmo', dur: 1.5 });
      events.push({ t: 'shake', amount: 10 });
      events.push({ t: 'announce', text: 'BOSS DOWN', sub: '+' + bounty + 'g', color: '#ff9f43' });
    }
  }

  function updateEnemies(dt){
    var time = st.time;
    var ion = (st.activeAnomaly && st.activeAnomaly.type === 'ionstorm')
      ? num(st.activeAnomaly.speedMult, 1.3) : 1;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || e.leaked) continue;
      var ab = (e.def && e.def.abilities) || {};
      var m = 1;
      if (time < e.frozenUntil) m = 0;
      else if (time < e.slowUntil){
        var r = num(ab.slowResist, 0);
        m = 1 - (1 - e.slowFactor) * (1 - r);
        if (m < 0) m = 0;
      }
      if (time < e.stunUntil) m = 0;
      var spd = e.speed * m * ion;
      if (e.enraged && ab.enrage) spd *= num(ab.enrage.speedMult, 1.5);
      e.dist += spd * dt;
      var p = pointAt(e.dist);
      e.x = p[0]; e.y = p[1];
      if (e.dist >= totalLen){ leakEnemy(e); continue; }
      if (ab.phase){
        e.phaseT -= dt;
        if (e.phaseT <= 0){
          e.untargetableUntil = time + num(ab.phase.duration, 2);
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
            spawnEnemy(ab.spawn.type, Math.max(0, e.dist - 15 - k*12), st.curHpMult, st.curBountyMult);
          }
        }
      }
      if (ab.enrage && !e.enraged && e.maxHp > 0 && e.hp <= e.maxHp * num(ab.enrage.hpFrac, 0.3)){
        e.enraged = true;
        events.push({ t: 'float', x: e.x, y: e.y - 12, text: 'ENRAGED', color: '#ff5544', size: 12 });
      }
    }
  }

  /* ---------- towers ---------- */
  function acquireTarget(t, spec){
    spec = spec || {};
    var time = st.time;
    var range = num(t.stats.range, 0);
    var strong = spec.targeting === 'strong';
    var best = null, bestKey = -Infinity;
    var r2 = range * range;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || e.leaked || time < e.untargetableUntil) continue;
      if (d2(e.x, e.y, t.x, t.y) > r2) continue;
      var key = strong ? e.hp : e.dist;
      if (key > bestKey){ bestKey = key; best = e; }
    }
    return best;
  }

  function fireProjectile(t, tgt, dmg){
    if (st.projectiles.length >= 300) return;
    st.projectiles.push({
      x: t.x, y: t.y, tx: tgt.x, ty: tgt.y,
      targetId: tgt.id, speed: Math.max(1, num(t.def.projSpeed, 400)),
      damage: dmg, src: t.instId, color: (t.def && t.def.color) || '#fff'
    });
  }

  function auraTick(t, spec, range){
    var time = st.time;
    var r2 = range * range;
    var sf = num(spec.slowFactor, 0.5);
    var sd = num(spec.slowDuration, 2);
    var fc = num(spec.freezeChance, 0);
    var fd = num(spec.freezeDuration, 1);
    var auraDmg = num(t.stats.damage, 0) * num(t.buffDmg, 1) * num(spec.auraDamageMult, 1);
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || e.leaked || time < e.untargetableUntil) continue;
      if (d2(e.x, e.y, t.x, t.y) > r2) continue;
      if (auraDmg > 0) damageEnemy(e, auraDmg, { tower: t });
      if (e.dead) continue;
      if (time >= e.slowUntil) e.slowFactor = sf;
      else if (sf < e.slowFactor) e.slowFactor = sf;
      e.slowUntil = time + sd;
      if (Math.random() < fc) e.frozenUntil = time + fd;
    }
  }

  function chainLightning(t, first, spec){
    var time = st.time;
    var chains = Math.max(1, Math.round(num(spec.chains, 3)));
    var chainRange = num(spec.chainRange, 120);
    var falloff = num(spec.falloff, 0.7);
    var stunChance = num(spec.stunChance, 0);
    var stunDur = num(spec.stunDuration, 1);
    var base = num(t.stats.damage, 0) * t.buffDmg;
    var hit = {};
    var px = t.x, py = t.y;
    var cur = first;
    var color = (t.def && t.def.color) || '#9df';
    for (var i = 0; i < chains && cur; i++){
      damageEnemy(cur, base * Math.pow(falloff, i), { tower: t });
      if (Math.random() < stunChance) cur.stunUntil = Math.max(cur.stunUntil, time + stunDur);
      st.beams.push({ x1: px, y1: py, x2: cur.x, y2: cur.y, ttl: 0.18, color: color });
      hit[cur.id] = true;
      px = cur.x; py = cur.y;
      var best = null, bestD = chainRange * chainRange;
      for (var j = 0; j < st.enemies.length; j++){
        var e = st.enemies[j];
        if (e.dead || e.leaked || hit[e.id] || time < e.untargetableUntil) continue;
        var dd = d2(e.x, e.y, px, py);
        if (dd < bestD){ bestD = dd; best = e; }
      }
      cur = best;
    }
  }

  function explodeAt(tw, x, y, dmg, splash, color){
    events.push({ t: 'explosion', x: x, y: y, radius: splash, color: color });
    var r2 = splash * splash;
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || e.leaked) continue;
      var dd = d2(e.x, e.y, x, y);
      if (dd > r2) continue;
      var mult = Math.sqrt(dd) <= splash * 0.5 ? 1 : 0.5;
      damageEnemy(e, dmg * mult, { tower: tw });
    }
  }

  function lobShot(t, tgt, spec){
    var time = st.time;
    var tx = tgt.x, ty = tgt.y;
    var travel = Math.sqrt(d2(t.x, t.y, tx, ty)) / Math.max(1, num(t.def.projSpeed, 300));
    var dmg = num(t.stats.damage, 0) * t.buffDmg;
    var splash = num(spec.splash, 80);
    var color = (t.def && t.def.color) || '#fa3';
    var sub = spec.submunitions !== false;
    var tExp = time + travel;
    st.delayed.push({ at: tExp, fn: function(){
      explodeAt(t, tx, ty, dmg, splash, color);
      if (sub){
        for (var k = 0; k < 4; k++){
          (function(ox, oy){
            st.delayed.push({ at: tExp + 0.25, fn: function(){
              explodeAt(t, tx + ox, ty + oy, dmg * 0.5, splash * 0.5, color);
            }});
          })((Math.random() - 0.5) * splash, (Math.random() - 0.5) * splash);
        }
      }
    }});
  }

  function fieldTick(t, spec, range){
    var time = st.time;
    var r2 = range * range;
    var sf = num(spec.slowFactor, 0.6);
    var vuln = num(spec.damageTakenMult, 0);
    for (var i = 0; i < st.enemies.length; i++){
      var e = st.enemies[i];
      if (e.dead || e.leaked) continue;
      if (d2(e.x, e.y, t.x, t.y) > r2) continue;
      if (time >= e.slowUntil) e.slowFactor = sf;
      else if (sf < e.slowFactor) e.slowFactor = sf;
      e.slowUntil = time + 0.2;
      if (vuln > 0) e.fieldVuln = { mult: vuln, until: time + 0.2 };
    }
  }

  function updateTowers(dt){
    for (var i = 0; i < st.towers.length; i++){
      var t = st.towers[i];
      var beh = t.def.behavior;
      if (beh === 'economy' || beh === 'buff') continue;
      var spec = t.stats.special || {};
      var range = num(t.stats.range, 0);
      var rate = Math.max(0.05, num(t.stats.fireRate, 1) * t.buffRate);
      if (beh === 'projectile'){
        t.cooldown -= dt;
        if (t.cooldown > 0) continue;
        var tgt = acquireTarget(t, spec);
        if (!tgt) continue;
        fireProjectile(t, tgt, num(t.stats.damage, 0) * t.buffDmg);
        t.cooldown = 1 / rate;
        t.angle = Math.atan2(tgt.y - t.y, tgt.x - t.x);
      } else if (beh === 'aura'){
        t.auraT = num(t.auraT, 0) + dt;
        if (t.auraT < num(spec.tick, 0.5)) continue;
        t.auraT = 0;
        auraTick(t, spec, range);
      } else if (beh === 'chain'){
        t.cooldown -= dt;
        if (t.cooldown > 0) continue;
        var first = acquireTarget(t, spec);
        if (!first) continue;
        chainLightning(t, first, spec);
        t.cooldown = 1 / rate;
        t.angle = Math.atan2(first.y - t.y, first.x - t.x);
      } else if (beh === 'lobbed'){
        t.cooldown -= dt;
        if (t.cooldown > 0) continue;
        var lt = acquireTarget(t, spec);
        if (!lt) continue;
        lobShot(t, lt, spec);
        t.cooldown = 1 / rate;
        t.angle = Math.atan2(lt.y - t.y, lt.x - t.x);
      } else if (beh === 'field'){
        fieldTick(t, spec, range);
      }
    }
  }

  function updateProjectiles(dt){
    for (var i = st.projectiles.length - 1; i >= 0; i--){
      var p = st.projectiles[i];
      var tgt = enemyById(p.targetId);
      var alive = tgt && !tgt.dead && !tgt.leaked;
      if (alive){ p.tx = tgt.x; p.ty = tgt.y; }
      var dx = p.tx - p.x, dy = p.ty - p.y;
      var d = Math.sqrt(dx*dx + dy*dy);
      var step = p.speed * dt;
      var hitR = alive ? (num(tgt.size, 8) * 0.5 + 4) : 3;
      if (d <= step + hitR || d < 0.5){
        if (alive) damageEnemy(tgt, p.damage, { tower: towerById(p.src) });
        st.projectiles.splice(i, 1);
      } else {
        p.x += dx / d * step;
        p.y += dy / d * step;
      }
    }
  }

  /* ---------- anomalies ---------- */
  function applyAnomaly(type){
    var time = st.time;
    st.stats.anomaliesSeen++;
    sim.recentAnom.push(type);
    if (sim.recentAnom.length > 3) sim.recentAnom.shift();
    var names = { meteor: 'METEOR SHOWER', goldrush: 'GOLD RUSH', elite: 'ELITE SQUAD',
                  ionstorm: 'ION STORM', solarflare: 'SOLAR FLARE' };
    var label = names[type] || String(type).toUpperCase();
    events.push({ t: 'anomaly', type: type, text: label });
    if (type === 'meteor'){
      events.push({ t: 'announce', text: 'METEOR INBOUND', sub: 'brace for impact', color: '#ff9f43' });
      st.delayed.push({ at: time + 2, fn: function(){
        st.shake = 8;
        events.push({ t: 'shake', amount: 8 });
        var hits = 0;
        for (var i = 0; i < st.enemies.length && hits < 6; i++){
          var e = st.enemies[i];
          if (e.dead || e.leaked) continue;
          events.push({ t: 'explosion', x: e.x, y: e.y, radius: 60, color: '#ff9f43' });
          damageEnemy(e, 220, { anomaly: true });
          hits++;
        }
      }});
    } else if (type === 'goldrush'){
      st.goldRush = true;
      events.push({ t: 'announce', text: 'GOLD RUSH', sub: 'double bounties this wave', color: '#ffd34d' });
      for (var i = 0; i < 10; i++){
        st.spawnQueue.push({ type: 'mite', at: time + i * 0.8, hpMult: st.curHpMult, bountyMult: st.curBountyMult });
      }
      st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    } else if (type === 'elite'){
      events.push({ t: 'announce', text: 'ELITE SQUAD INBOUND', color: '#ff5544' });
      for (var j = 0; j < 4; j++){
        st.spawnQueue.push({ type: 'tank', at: time + j * 0.5, hpMult: st.curHpMult, bountyMult: st.curBountyMult });
      }
      st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    } else if (type === 'ionstorm'){
      st.activeAnomaly = { type: 'ionstorm', speedMult: 1.3, until: time + 25 };
      events.push({ t: 'announce', text: 'ION STORM', sub: 'enemies move faster', color: '#7df9ff' });
    } else if (type === 'solarflare'){
      st.activeAnomaly = { type: 'solarflare', dmgMult: 1.25, until: time + 25 };
      events.push({ t: 'announce', text: 'SOLAR FLARE', sub: 'towers deal bonus damage', color: '#ffb347' });
    }
  }

  /* ---------- wave control ---------- */
  function startWave(){
    if (st.waveActive || st.over) return;
    if (st.waveIndex >= st.wavesTotal) return;
    var waves = lv.waves || [];
    var wave = waves[st.waveIndex];
    if (!wave) return;
    if (st.intermission > 1){
      var eb = CFG.EARLY_BASE + CFG.EARLY_PER_SEC * Math.ceil(st.intermission);
      st.gold += eb;
      st.stats.goldEarned += eb;
      events.push({ t: 'announce', text: 'EARLY START +' + eb + 'g', color: '#ffd34d' });
    }
    var rate = CFG.INTEREST_RATE;
    var treasury = null, i, tw;
    for (i = 0; i < st.towers.length; i++){
      tw = st.towers[i];
      if (tw.def && tw.def.behavior === 'economy'){
        rate += num((tw.stats.special || {}).interestBoost, 0);
        if (!treasury) treasury = tw;
      }
    }
    var ib = Math.floor(st.gold * rate);
    if (ib > 0){
      st.gold += ib;
      st.stats.goldEarned += ib;
      events.push({ t: 'gold', x: treasury ? treasury.x : 70, y: treasury ? treasury.y - 14 : 50, amount: ib });
    }
    for (i = 0; i < st.towers.length; i++){
      tw = st.towers[i];
      if (!tw.def || tw.def.behavior !== 'economy') continue;
      var per = num((tw.stats.special || {}).perWave, 0);
      if (per <= 0) continue;
      var payout = Math.floor(per * synergyMult(tw, 'mintBoost'));
      if (payout > 0){
        st.gold += payout;
        st.stats.goldEarned += payout;
        events.push({ t: 'gold', x: tw.x, y: tw.y - 14, amount: payout });
      }
    }
    st.curHpMult = num(wave.hpMult, 1);
    st.curBountyMult = num(wave.bountyMult, 1);
    st.spawnQueue = [];
    var t0 = st.time;
    var groups = wave.enemies || [];
    for (i = 0; i < groups.length; i++){
      var g = groups[i];
      var count = Math.max(0, Math.round(num(g.count, 0)));
      var gap = (g.gap === undefined) ? 1 : num(g.gap, 1);
      var delay = num(g.delay, 0);
      for (var k = 0; k < count; k++){
        st.spawnQueue.push({ type: g.type, at: t0 + delay + k * gap,
                             hpMult: st.curHpMult, bountyMult: st.curBountyMult });
      }
    }
    st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    st.waveActive = true;
    st.intermission = 0;
    st.goldRush = false;
    events.push({ t: 'waveStart', n: st.waveIndex + 1, note: wave.note || '' });
    var anoms = lv.anomalies || [];
    for (var a = 0; a < anoms.length; a++){
      if (anoms[a].wave === st.waveIndex) applyAnomaly(anoms[a].type);
    }
    var waveNo = st.waveIndex + 1;
    if (waveNo >= 3 && waveNo <= st.wavesTotal - 3 && waveNo % 10 !== 0 && Math.random() < 0.12){
      // Early waves only get helpful anomalies; hostile ones unlock at wave 6.
      var full = ['meteor', 'goldrush', 'elite', 'ionstorm', 'solarflare'];
      var allowed = waveNo < 6 ? ['meteor', 'goldrush', 'solarflare'] : full;
      var pool = allowed.filter(function(x){ return sim.recentAnom.indexOf(x) < 0; });
      if (!pool.length) pool = allowed;
      applyAnomaly(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  function callEarly(){
    if (!st.waveActive || st.over) return;
    var t0 = st.time;
    st.spawnQueue.sort(function(a, b){ return a.at - b.at; });
    for (var i = 0; i < st.spawnQueue.length; i++) st.spawnQueue[i].at = t0 + i * 0.15;
    st.gold += 5;
    st.stats.goldEarned += 5;
    events.push({ t: 'announce', text: 'CALL EARLY +5g', sub: 'remaining enemies rushed in', color: '#ffd34d' });
  }

  function checkWaveEnd(){
    if (!st.waveActive || st.over) return;
    if (st.spawnQueue.length > 0) return;
    if (st.enemies.length > 0) return;
    var cleared = st.waveIndex;
    st.waveActive = false;
    st.goldRush = false;
    var bonus = 20 + cleared * 2;
    st.gold += bonus;
    st.stats.goldEarned += bonus;
    events.push({ t: 'waveClear', n: cleared + 1, bonus: bonus });
    events.push({ t: 'gold', x: CFG.WIDTH / 2, y: 60, amount: bonus });
    if (cleared >= st.wavesTotal - 1){
      st.over = true;
      st.victory = true;
      var lost = st.startLives - st.lives;
      st.stars = lost <= 0 ? 3 : (lost <= st.startLives * 0.25 ? 2 : 1);
      var sc = {};
      for (var k in st.stats) sc[k] = st.stats[k];
      events.push({ t: 'victory', stars: st.stars, stats: sc });
    } else {
      st.waveIndex = cleared + 1;
      st.intermission = CFG.INTERMISSION;
    }
  }

  /* ---------- main update ---------- */
  function update(dtReal){
    if (st.paused || st.over) return;
    dtReal = num(dtReal, 0.016);
    var dt = Math.min(dtReal, 0.05) * st.speed * (st.slowmoT > 0 ? 0.25 : 1);
    if (st.slowmoT > 0) st.slowmoT -= dtReal;
    st.time += dt;

    if (!st.waveActive && st.waveIndex < st.wavesTotal){
      st.intermission -= dt;
      if (st.intermission <= 0) startWave();
    }

    var i;
    for (i = st.delayed.length - 1; i >= 0; i--){
      if (st.delayed[i].at <= st.time){
        var job = st.delayed.splice(i, 1)[0];
        try { job.fn(); } catch (err) { /* keep sim alive */ }
      }
    }

    while (st.spawnQueue.length && st.spawnQueue[0].at <= st.time){
      if (st.enemies.length + st.spawnQueue.length >= 220) break;
      var q = st.spawnQueue.shift();
      spawnEnemy(q.type, 0, q.hpMult, q.bountyMult);
    }

    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);

    for (i = st.beams.length - 1; i >= 0; i--){
      st.beams[i].ttl -= dt;
      if (st.beams[i].ttl <= 0) st.beams.splice(i, 1);
    }

    if (st.activeAnomaly && st.time >= st.activeAnomaly.until){
      st.activeAnomaly = null;
      events.push({ t: 'announce', text: 'ANOMALY FADED', color: '#8fa3b8' });
    }

    for (i = st.enemies.length - 1; i >= 0; i--){
      if (st.enemies[i].dead || st.enemies[i].leaked) st.enemies.splice(i, 1);
    }

    checkWaveEnd();
  }

  /* ---------- player actions ---------- */
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

  function build(plotIndex, towerId){
    if (st.over) return { ok: false, reason: 'over' };
    var def = TOWERS[towerId];
    if (!def) return { ok: false, reason: 'tower' };
    var plots = lv.plots || [];
    if (plotIndex < 0 || plotIndex >= plots.length) return { ok: false, reason: 'plot' };
    for (var i = 0; i < st.towers.length; i++){
      if (st.towers[i].plotIndex === plotIndex) return { ok: false, reason: 'occupied' };
    }
    var cost = num(def.cost, 0);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    var p = plots[plotIndex];
    var t = {
      instId: ++sim.nextInstId, id: towerId, def: def, plotIndex: plotIndex,
      x: p.x, y: p.y, tier: 1, branch: null, cooldown: 0, angle: 0,
      totalSpent: cost, auraT: 0,
      stats: { range: num(def.range, 0), damage: num(def.damage, 0),
               fireRate: num(def.fireRate, 0), special: copySpecial(def.special) },
      buffDmg: 1, buffRate: 1, activeSynergies: []
    };
    st.towers.push(t);
    st.stats.towersBuilt++;
    recompute();
    events.push({ t: 'build', x: t.x, y: t.y, color: def.color || '#8ef' });
    return { ok: true, tower: t };
  }

  function upgrade(instId){
    var t = towerById(instId);
    if (!t) return { ok: false, reason: 'tower' };
    if (t.tier >= 3){
      if (!t.branch) return { ok: false, reason: 'branch' };
      return { ok: false, reason: 'max' };
    }
    var tiers = (t.def && t.def.tiers) || [];
    var td = tiers[t.tier - 1];
    if (!td) return { ok: false, reason: 'max' };
    var cost = num(td.cost, 0);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    t.totalSpent += cost;
    t.tier++;
    applyOverrides(t, td);
    st.stats.upgradesBought++;
    recompute();
    return { ok: true, tower: t };
  }

  function chooseBranch(instId, which){
    if (which !== 'a' && which !== 'b') return { ok: false, reason: 'branch' };
    var t = towerById(instId);
    if (!t) return { ok: false, reason: 'tower' };
    if (t.tier !== 3) return { ok: false, reason: 'tier' };
    if (t.branch) return { ok: false, reason: 'max' };
    var bd = ((t.def && t.def.branch) || {})[which];
    if (!bd) return { ok: false, reason: 'branch' };
    var cost = num(bd.cost, 0);
    if (st.gold < cost) return { ok: false, reason: 'gold' };
    st.gold -= cost;
    t.totalSpent += cost;
    t.branch = which;
    applyOverrides(t, bd);
    recompute();
    events.push({ t: 'announce', text: (bd.name || 'Branch') + ' ONLINE', color: '#7df9ff' });
    return { ok: true, tower: t };
  }

  function sell(instId){
    var t = towerById(instId);
    if (!t) return { ok: false, reason: 'tower' };
    var refund = Math.floor(t.totalSpent * CFG.SELLBACK);
    st.gold += refund;
    st.stats.goldEarned += refund;
    for (var i = 0; i < st.towers.length; i++){
      if (st.towers[i].instId === instId){ st.towers.splice(i, 1); break; }
    }
    recompute();
    return { ok: true, gold: refund };
  }

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

  function previewWave(n){
    var waves = lv.waves || [];
    var w = waves[n];
    if (!w) return null;
    var hpMult = num(w.hpMult, 1), bountyMult = num(w.bountyMult, 1);
    var groups = [], totalHp = 0, estBounty = 0;
    var list = w.enemies || [];
    for (var i = 0; i < list.length; i++){
      var g = list[i];
      var def = ENEMIES[g.type] || {};
      var hp = num(def.hp, 10) * hpMult;
      var count = Math.max(0, Math.round(num(g.count, 0)));
      groups.push({ type: g.type, name: def.name || g.type, count: count, hp: Math.round(hp) });
      totalHp += hp * count;
      estBounty += Math.round(num(def.bounty, 0) * bountyMult) * count;
    }
    return { note: w.note || '', groups: groups, totalHp: Math.round(totalHp), estBounty: estBounty };
  }

  function snapshot(){
    var sc = {};
    for (var k in st.stats) sc[k] = st.stats[k];
    sc.goldEarned = Math.floor(sc.goldEarned);
    return {
      gold: Math.floor(st.gold), lives: st.lives,
      waveIndex: st.waveIndex, wavesTotal: st.wavesTotal,
      waveActive: st.waveActive, intermission: Math.max(0, Math.ceil(st.intermission)),
      towers: st.towers.map(function(t){
        return { instId: t.instId, id: t.id, name: (t.def && t.def.name) || t.id,
                 tier: t.tier, branch: t.branch, x: t.x, y: t.y,
                 range: t.stats.range, damage: t.stats.damage, fireRate: t.stats.fireRate,
                 buffDmg: t.buffDmg, buffRate: t.buffRate,
                 synergies: t.activeSynergies.slice() };
      }),
      enemies: st.enemies.length,
      speed: st.speed, paused: st.paused, over: st.over,
      victory: st.victory, stars: st.stars,
      time: Math.round(st.time * 100) / 100,
      stats: sc
    };
  }

  sim.update = update;
  sim.startWave = startWave;
  sim.callEarly = callEarly;
  sim.build = build;
  sim.upgrade = upgrade;
  sim.chooseBranch = chooseBranch;
  sim.sell = sell;
  sim.setSpeed = setSpeed;
  sim.togglePause = togglePause;
  sim.previewWave = previewWave;
  sim.snapshot = snapshot;

  return sim;
};

})();
