/* Nova Bastion - render */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* Canvas renderer: starfield, path, plots, towers, enemies, projectiles,
   beams, particles, floating text, banners. Visual state is fed by draining
   sim.events inside draw(); non-visual consumers can subscribe via
   renderer.eventListener = fn(ev), which is called for every drained event. */

var TAU = Math.PI * 2;
var FONT = '"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';
var PMAX = 420;   /* particle cap */
var RMAX = 60;    /* shockwave ring cap */
var TMAX = 40;    /* floating text cap */

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (var i = 0; i < 6; i++) {
    var a = Math.PI / 6 + i * TAU / 6;
    var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
  }
  ctx.closePath();
}

function Renderer(canvas) {
  this.cv = canvas;
  this.ctx = canvas.getContext('2d');
  this.W = canvas.width || 960;
  this.H = canvas.height || 600;
  this.parts = [];
  this.rings = [];
  this.texts = [];
  this.stars = [];
  this.dust = [];
  this.neb = [
    { x: 0.18, y: 0.30, r: 0.42, c: '88,40,180' },
    { x: 0.82, y: 0.62, r: 0.48, c: '20,120,170' },
    { x: 0.55, y: 0.12, r: 0.30, c: '170,30,140' },
    { x: 0.35, y: 0.85, r: 0.34, c: '30,60,160' }
  ];
  var i;
  for (i = 0; i < 170; i++) {
    this.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.4,
      s: Math.random() * 12 + 4, tw: Math.random() * TAU });
  }
  for (i = 0; i < 36; i++) {
    this.dust.push({ x: Math.random(), y: Math.random(), r: Math.random() * 2.4 + 0.8,
      vx: (Math.random() - 0.5) * 0.008, vy: (Math.random() - 0.5) * 0.008,
      a: Math.random() * 0.22 + 0.06, hue: Math.random() < 0.5 ? '34,211,238' : '255,47,214' });
  }
  this.time = 0;
  this.lastT = 0;
  this.banner = null;
  this.synPop = null;
  this.slowT = 0;
  this.flashT = 0;
  this.bump = 0;
  this.eventListener = null;
  this.bgGrad = null;
  try { this.ctx.letterSpacing = '2px'; } catch (e) { /* unsupported */ }
}

/* ---------------- event intake ---------------- */

Renderer.prototype._burst = function (x, y, color, n, speed, size) {
  for (var i = 0; i < n; i++) {
    if (this.parts.length >= PMAX) { this.parts.shift(); }
    var a = Math.random() * TAU;
    var sp = speed * (0.35 + Math.random() * 0.85);
    this.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      ttl: 0.5 + Math.random() * 0.5, life: 0, size: (size || 3) * (0.6 + Math.random() * 0.8),
      color: color, drag: 2.2 });
  }
};

Renderer.prototype._ring = function (x, y, color, vr, width, ttl) {
  if (this.rings.length >= RMAX) { this.rings.shift(); }
  this.rings.push({ x: x, y: y, r: 6, vr: vr || 160, width: width || 3,
    ttl: ttl || 0.5, life: 0, color: color });
};

Renderer.prototype._text = function (x, y, text, color, size) {
  if (this.texts.length >= TMAX) { this.texts.shift(); }
  this.texts.push({ x: x, y: y, vy: -46, ttl: 1.4, life: 0,
    text: String(text), color: color || '#fff', size: size || 15 });
};

Renderer.prototype._handleEvent = function (e) {
  if (this.eventListener) {
    try { this.eventListener(e); } catch (err) { /* never break render */ }
  }
  switch (e.t) {
    case 'kill':
      this._burst(e.x, e.y, e.color || '#9df', Math.min(26, 8 + (e.size || 8)), 130, 3);
      break;
    case 'explosion':
      this._ring(e.x, e.y, e.color || '#fd5', e.radius * 3.2, 4, 0.55);
      this._burst(e.x, e.y, e.color || '#fd5', 26, 220, 3.4);
      this._burst(e.x, e.y, '#ffffff', 8, 120, 2);
      this.bump += Math.min(7, (e.radius || 40) * 0.06);
      break;
    case 'float':
      this._text(e.x, e.y, e.text, e.color, e.size);
      break;
    case 'gold':
      this._text(e.x, e.y - 6, '+' + e.amount + 'g', '#ffd166', 14);
      break;
    case 'build':
      this._ring(e.x, e.y, e.color || '#22d3ee', 120, 3, 0.45);
      this._burst(e.x, e.y, e.color || '#22d3ee', 10, 90, 2.4);
      break;
    case 'leak':
      this._burst(e.x, e.y, '#ff4d6d', 18, 170, 3);
      this.flashT = 0.35;
      this.bump += 4;
      break;
    case 'shake':
      this.bump += e.amount || 3;
      break;
    case 'slowmo':
      this.slowT = 1.4;
      break;
    case 'waveStart':
      this.banner = { title: 'WAVE ' + e.n, sub: e.note || '', ttl: 2.6, life: 0, color: '#22d3ee' };
      break;
    case 'waveClear':
      this.banner = { title: 'WAVE ' + e.n + ' CLEAR', sub: '+' + (e.bonus || 0) + 'g bonus',
        ttl: 2.0, life: 0, color: '#4ade80' };
      break;
    case 'anomaly':
      this.banner = { title: 'ANOMALY', sub: e.text || '', ttl: 2.8, life: 0, color: '#ff2fd6' };
      break;
    case 'synergy':
      this.synPop = { name: e.name, desc: e.desc || '', ttl: 3.2, life: 0 };
      break;
    case 'victory':
      this.banner = { title: 'SECTOR SECURED', sub: '', ttl: 3.0, life: 0, color: '#ffd166' };
      break;
    case 'defeat':
      this.banner = { title: 'BASTION FALLEN', sub: e.reason || '', ttl: 4.0, life: 0, color: '#ff4d6d' };
      break;
    default:
      break; /* announce and the rest are handled by UI/audio */
  }
};

/* ---------------- background ---------------- */

Renderer.prototype._bg = function (ctx, dt) {
  var W = this.W, H = this.H, i, s;
  if (!this.bgGrad) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b26');
    g.addColorStop(0.55, '#070718');
    g.addColorStop(1, '#050510');
    this.bgGrad = g;
  }
  ctx.fillStyle = this.bgGrad;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  var n;
  for (n = 0; n < this.neb.length; n++) {
    var nb = this.neb[n];
    var nx = nb.x * W, ny = nb.y * H, nr = nb.r * W;
    var rg = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    rg.addColorStop(0, 'rgba(' + nb.c + ',0.16)');
    rg.addColorStop(1, 'rgba(' + nb.c + ',0)');
    ctx.fillStyle = rg;
    ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
  }
  for (i = 0; i < this.stars.length; i++) {
    s = this.stars[i];
    var sx = (s.x * W - this.time * s.s) % W; if (sx < 0) { sx += W; }
    var tw = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 1.7 + s.tw));
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(sx, s.y * H, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  for (i = 0; i < this.dust.length; i++) {
    var d = this.dust[i];
    d.x = (d.x + d.vx * dt + 1) % 1; d.y = (d.y + d.vy * dt + 1) % 1;
    ctx.globalAlpha = d.a * (0.7 + 0.3 * Math.sin(this.time * 2 + i));
    ctx.fillStyle = 'rgb(' + d.hue + ')';
    ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  /* grid */
  ctx.strokeStyle = 'rgba(60,60,140,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (var gx = 0; gx <= W; gx += 48) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
  for (var gy = 0; gy <= H; gy += 48) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
  ctx.stroke();
};

/* ---------------- path & plots ---------------- */

Renderer.prototype._pathCache = function (lvl) {
  if (lvl._rc) { return lvl._rc; }
  var pts = lvl.path || [];
  var segs = [];
  var total = 0;
  for (var i = 0; i + 1 < pts.length; i++) {
    var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    segs.push({ x: pts[i][0], y: pts[i][1], dx: dx / len, dy: dy / len, len: len, start: total });
    total += len;
  }
  lvl._rc = { segs: segs, total: total };
  return lvl._rc;
};

Renderer.prototype._path = function (ctx, lvl) {
  var pts = lvl.path;
  if (!pts || pts.length < 2) { return; }
  var i;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (i = 1; i < pts.length; i++) { ctx.lineTo(pts[i][0], pts[i][1]); }
  /* dark bed */
  ctx.strokeStyle = 'rgba(4,4,16,0.9)';
  ctx.lineWidth = 26; ctx.stroke();
  /* glow */
  ctx.save();
  ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(34,211,238,0.55)';
  ctx.lineWidth = 9; ctx.stroke();
  ctx.restore();
  /* animated core dashes */
  ctx.save();
  ctx.strokeStyle = '#bff6ff';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([16, 20]);
  ctx.lineDashOffset = -this.time * 46;
  ctx.stroke();
  ctx.restore();
  /* direction chevrons */
  var rc = this._pathCache(lvl);
  ctx.save();
  ctx.fillStyle = 'rgba(190,250,255,' + (0.55 + 0.3 * Math.sin(this.time * 4)) + ')';
  for (var d = 60; d < rc.total; d += 110) {
    var s = null;
    for (i = 0; i < rc.segs.length; i++) {
      if (d >= rc.segs[i].start && d <= rc.segs[i].start + rc.segs[i].len) { s = rc.segs[i]; break; }
    }
    if (!s) { continue; }
    var along = d - s.start;
    var cx = s.x + s.dx * along, cy = s.y + s.dy * along;
    var ang = Math.atan2(s.dy, s.dx);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-4, -7); ctx.lineTo(-4, 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

Renderer.prototype._plots = function (ctx, lvl, sim, view) {
  var plots = lvl.plots || [];
  var towers = (sim && sim.state && sim.state.towers) || [];
  for (var i = 0; i < plots.length; i++) {
    var p = plots[i];
    var occupied = false;
    for (var k = 0; k < towers.length; k++) {
      var dx = towers[k].x - p.x, dy = towers[k].y - p.y;
      if (dx * dx + dy * dy < 36) { occupied = true; break; }
    }
    var isSel = view && view.selectedPlot === i;
    var isHov = view && view.hoverPlot === i;
    var pulse = 0.45 + 0.25 * Math.sin(this.time * 3 + i * 1.3);
    ctx.save();
    hexPath(ctx, p.x, p.y, 26);
    if (occupied) {
      ctx.strokeStyle = 'rgba(80,80,160,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      if (isSel) {
        ctx.shadowColor = '#ff2fd6'; ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ff2fd6'; ctx.lineWidth = 3;
      } else if (isHov) {
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
        ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = 'rgba(34,211,238,' + pulse.toFixed(3) + ')';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(34,211,238,' + (isSel || isHov ? 0.14 : 0.05).toFixed(3) + ')';
      ctx.fill();
    }
    ctx.restore();
  }
};

/* ---------------- towers ---------------- */

function towerDef(id) {
  var T = NB.TOWERS || {};
  return T[id] || { name: 'Turret', color: '#22d3ee', behavior: 'pulse' };
}

/* Draw the neon silhouette for a behavior, centered at 0,0. Barrel parts
   rotate with the tower angle; base parts do not. */
Renderer.prototype._silhouette = function (ctx, behavior, color, angle, tier, branch, t) {
  var i;
  /* base */
  ctx.save();
  ctx.fillStyle = '#0a0a22';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  hexPath(ctx, 0, 0, 20);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  switch (behavior) {
    case 'frost':
      ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2.4;
      ctx.shadowColor = '#a5f3fc'; ctx.shadowBlur = 10;
      for (i = 0; i < 6; i++) {
        var a = i * TAU / 6 + t * 0.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#e0faff';
      ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
      break;
    case 'arc':
      ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2.2;
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -12); ctx.stroke();
      for (i = 0; i < 3; i++) {
        var yy = 8 - i * 8;
        ctx.beginPath(); ctx.arc(0, yy, 6, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, yy, 6, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
      }
      ctx.fillStyle = '#ede9fe';
      ctx.beginPath(); ctx.arc(0, -13, 3, 0, TAU); ctx.fill();
      break;
    case 'mortar':
      ctx.rotate(angle);
      ctx.fillStyle = '#1c1c44';
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(2, -7, 16, 14);
      ctx.fillStyle = '#0a0a22';
      ctx.fillRect(14, -4.5, 4, 9);
      break;
    case 'sniper':
      ctx.rotate(angle);
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(24, 0); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(22, -1.5, 5, 3);
      break;
    case 'chrono':
      ctx.strokeStyle = color; ctx.lineWidth = 2.4;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.save(); ctx.rotate(t * 0.8);
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.rotate(-t * 1.2);
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
      break;
    case 'mint':
      for (i = 0; i < 3; i++) {
        ctx.fillStyle = i === 2 ? '#ffe9a8' : '#d9a821';
        ctx.strokeStyle = '#8a5f0b'; ctx.lineWidth = 1;
        ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(0, 4 - i * 6, 10, 4.6, 0, 0, TAU);
        ctx.fill(); ctx.stroke();
      }
      break;
    case 'amplify':
      ctx.strokeStyle = color; ctx.lineWidth = 2.2;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(0, 4, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 12); ctx.stroke();
      for (i = 1; i <= 2; i++) {
        ctx.globalAlpha = 0.75 - i * 0.25;
        ctx.beginPath(); ctx.arc(0, -4, 6 + i * 5 + Math.sin(t * 3) * 1.5, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    default: /* pulse: orb turret */
      ctx.rotate(angle);
      ctx.fillStyle = '#1c1c44';
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.fillRect(4, -3, 13, 6);
      var pr = 3.4 + Math.sin(t * 5) * 1.1;
      ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.fill();
      break;
  }
  ctx.restore();
  /* tier pips */
  if (tier > 0) {
    ctx.save();
    ctx.fillStyle = branch ? (branch === 'a' ? '#ffd166' : '#ff2fd6') : '#22d3ee';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
    for (i = 0; i < tier; i++) {
      ctx.beginPath(); ctx.arc(-14 + i * 9, 24, 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /* branch accent arc */
  if (branch) {
    ctx.save();
    ctx.strokeStyle = branch === 'a' ? '#ffd166' : '#ff2fd6';
    ctx.lineWidth = 3; ctx.shadowBlur = 8; ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(0, 0, 23, -0.6, 0.6); ctx.stroke();
    ctx.restore();
  }
};

Renderer.prototype._towers = function (ctx, sim, view) {
  var towers = sim.state.towers || [];
  for (var i = 0; i < towers.length; i++) {
    var tw = towers[i];
    var def = towerDef(tw.id);
    var behavior = def.behavior || 'pulse';
    var color = def.color || '#22d3ee';
    var sel = view && view.selectedTower === tw.instId;
    var hov = view && view.hoverTower === tw.instId;
    /* faint buff radius for aura towers */
    if ((behavior === 'amplify' || behavior === 'chrono') && tw.stats) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tw.x, tw.y, tw.stats.range || 90, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    /* range ring for selected / hovered */
    if ((sel || hov) && tw.stats && tw.stats.range) {
      ctx.save();
      ctx.strokeStyle = sel ? '#ff2fd6' : 'rgba(34,211,238,0.7)';
      ctx.lineWidth = sel ? 2.5 : 1.5;
      ctx.setLineDash([10, 8]);
      if (sel) { ctx.shadowColor = '#ff2fd6'; ctx.shadowBlur = 12; }
      ctx.beginPath(); ctx.arc(tw.x, tw.y, tw.stats.range, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(tw.x, tw.y);
    this._silhouette(ctx, behavior, color, tw.angle || 0, tw.tier || 0, tw.branch, this.time + i);
    ctx.restore();
    /* synergy sparkle */
    if (tw.activeSynergies && tw.activeSynergies.length) {
      ctx.save();
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 8;
      var sy = tw.y - 30 + Math.sin(this.time * 3 + i) * 2;
      ctx.font = '12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('\u2726', tw.x + 16, sy);
      ctx.restore();
    }
  }
};

/* ---------------- enemies ---------------- */

function enemyShape(type) {
  var t = (type || '').toLowerCase();
  if (t.indexOf('boss') >= 0) { return 'boss'; }
  switch (t) {
    case 'drone': return 'drone';
    case 'runner': return 'runner';
    case 'swarmling': return 'swarmling';
    case 'tank': return 'tank';
    case 'shieldbearer': return 'shieldbearer';
    case 'phantom': return 'phantom';
    case 'medic': return 'medic';
    case 'splitter': return 'splitter';
    case 'mite': return 'mite';
    case 'brute': return 'brute';
    default: return 'circle';
  }
}

Renderer.prototype._enemies = function (ctx, sim) {
  var list = sim.state.enemies || [];
  var now = sim.state.time || 0;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    var r = Math.max(4, e.size || 10);
    var color = e.color || '#ff5d5d';
    var shape = enemyShape(e.type);
    var frozen = e.frozenUntil && e.frozenUntil > now;
    var slowed = !frozen && e.slowUntil && e.slowUntil > now;
    var untarget = e.untargetableUntil && e.untargetableUntil > now;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (shape === 'phantom') { ctx.globalAlpha = 0.45 + 0.2 * Math.sin(this.time * 6 + i); }
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    switch (shape) {
      case 'drone':
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, -r * 0.75); ctx.lineTo(-r * 0.8, r * 0.75);
        ctx.closePath(); ctx.fill();
        break;
      case 'runner':
        ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.7, r * 0.5);
        ctx.closePath(); ctx.fill();
        break;
      case 'swarmling':
        ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill();
        break;
      case 'tank':
        hexPath(ctx, 0, 0, r); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        hexPath(ctx, 0, 0, r * 0.55); ctx.fill();
        break;
      case 'shieldbearer':
        ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.shadowColor = '#7dd3fc';
        ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.stroke();
        break;
      case 'phantom':
        ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.8, Math.PI, 0); ctx.fill();
        ctx.fillRect(-r * 0.8, -r * 0.2, r * 1.6, r * 0.7);
        ctx.beginPath();
        for (var w = 0; w <= 4; w++) {
          var wx = -r * 0.8 + (w / 4) * r * 1.6;
          ctx.lineTo(wx, r * 0.5 + (w % 2 ? r * 0.25 : 0));
        }
        ctx.lineTo(r * 0.8, -r * 0.2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0b0b26';
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.25, r * 0.16, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.25, r * 0.16, 0, TAU); ctx.fill();
        break;
      case 'medic':
        ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-r * 0.5, -r * 0.16, r, r * 0.32);
        ctx.fillRect(-r * 0.16, -r * 0.5, r * 0.32, r);
        break;
      case 'splitter':
        ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.62, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.35, r * 0.1, r * 0.55, 0, TAU); ctx.fill();
        break;
      case 'mite':
        ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill();
        break;
      case 'brute':
        hexPath(ctx, 0, 0, r); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        hexPath(ctx, 0, 0, r * 0.6); ctx.stroke();
        break;
      case 'boss':
        hexPath(ctx, 0, 0, r); ctx.fill();
        ctx.fillStyle = '#ffd166';
        for (var sN = 0; sN < 8; sN++) {
          var sa = sN * TAU / 8 + this.time * 0.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sa) * r * 1.05, Math.sin(sa) * r * 1.05);
          ctx.lineTo(Math.cos(sa + 0.18) * r * 1.05, Math.sin(sa + 0.18) * r * 1.05);
          ctx.lineTo(Math.cos(sa + 0.09) * r * 1.45, Math.sin(sa + 0.09) * r * 1.45);
          ctx.closePath(); ctx.fill();
        }
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
        break;
    }
    ctx.restore();

    /* status overlays */
    if (frozen) {
      ctx.save();
      ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 10;
      ctx.strokeRect(e.x - r - 3, e.y - r - 3, (r + 3) * 2, (r + 3) * 2);
      ctx.restore();
    } else if (slowed) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (untarget) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 7, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    /* shield ring */
    if (e.maxShield > 0 && e.shield > 0) {
      ctx.save();
      ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#7dd3fc'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * (e.shield / e.maxShield));
      ctx.stroke();
      ctx.restore();
    }
    /* hp bar */
    if (e.maxHp > 0 && e.hp < e.maxHp) {
      var bw = Math.max(22, r * 2.1);
      var pct = Math.max(0, e.hp / e.maxHp);
      var bx = e.x - bw / 2, by = e.y - r - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = pct > 0.55 ? '#4ade80' : (pct > 0.25 ? '#ffd166' : '#ff4d6d');
      ctx.fillRect(bx, by, bw * pct, 4);
    }
  }
};

/* ---------------- projectiles & beams ---------------- */

Renderer.prototype._projectiles = function (ctx, sim) {
  var list = sim.state.projectiles || [];
  ctx.save();
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var r = p.size || 3;
    ctx.shadowColor = p.color || '#fff'; ctx.shadowBlur = 12;
    ctx.fillStyle = p.color || '#fff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.1, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

Renderer.prototype._beams = function (ctx, sim) {
  var list = sim.state.beams || [];
  for (var i = 0; i < list.length; i++) {
    var b = list[i];
    var alpha = Math.max(0, Math.min(1, (b.ttl || 0.2) * 4));
    var segs = 7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = b.color || '#c4b5fd';
    ctx.shadowColor = b.color || '#c4b5fd'; ctx.shadowBlur = 10;
    ctx.lineWidth = b.width || 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    var dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    for (var s = 1; s < segs; s++) {
      var f = s / segs;
      var off = (s === 0 || s === segs) ? 0 : (Math.random() * 2 - 1) * len * 0.09;
      ctx.lineTo(b.x1 + dx * f + nx * off, b.y1 + dy * f + ny * off);
    }
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.restore();
  }
};

/* ---------------- fx update & draw ---------------- */

Renderer.prototype._updateFx = function (dt) {
  var i, a;
  for (i = this.parts.length - 1; i >= 0; i--) {
    a = this.parts[i];
    a.life += dt;
    if (a.life >= a.ttl) { this.parts.splice(i, 1); continue; }
    var dr = 1 - Math.min(1, (a.drag || 0) * dt);
    a.vx *= dr; a.vy *= dr;
    a.x += a.vx * dt; a.y += a.vy * dt;
  }
  for (i = this.rings.length - 1; i >= 0; i--) {
    a = this.rings[i];
    a.life += dt;
    if (a.life >= a.ttl) { this.rings.splice(i, 1); continue; }
    a.r += a.vr * dt;
  }
  for (i = this.texts.length - 1; i >= 0; i--) {
    a = this.texts[i];
    a.life += dt;
    if (a.life >= a.ttl) { this.texts.splice(i, 1); continue; }
    a.y += a.vy * dt;
    a.vy *= (1 - 1.6 * dt);
  }
  if (this.banner) {
    this.banner.life += dt;
    if (this.banner.life >= this.banner.ttl) { this.banner = null; }
  }
  if (this.synPop) {
    this.synPop.life += dt;
    if (this.synPop.life >= this.synPop.ttl) { this.synPop = null; }
  }
  this.slowT = Math.max(0, this.slowT - dt);
  this.flashT = Math.max(0, this.flashT - dt);
};

Renderer.prototype._fx = function (ctx) {
  var i, a, alpha;
  for (i = 0; i < this.rings.length; i++) {
    a = this.rings[i];
    alpha = 1 - a.life / a.ttl;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = a.color; ctx.lineWidth = a.width;
    ctx.shadowColor = a.color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  for (i = 0; i < this.parts.length; i++) {
    a = this.parts[i];
    alpha = 1 - a.life / a.ttl;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = a.color;
    ctx.fillRect(a.x - a.size / 2, a.y - a.size / 2, a.size, a.size);
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  for (i = 0; i < this.texts.length; i++) {
    a = this.texts[i];
    alpha = 1 - a.life / a.ttl;
    ctx.globalAlpha = Math.min(1, alpha * 1.6);
    ctx.font = '700 ' + a.size + 'px ' + FONT;
    ctx.fillStyle = a.color;
    ctx.shadowColor = a.color; ctx.shadowBlur = 8;
    ctx.fillText(a.text, a.x, a.y);
  }
  ctx.restore();
};

/* ---------------- overlays ---------------- */

Renderer.prototype._vignette = function (ctx) {
  var W = this.W, H = this.H;
  if (this.slowT > 0) {
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(20,40,120,0)');
    g.addColorStop(1, 'rgba(20,60,180,' + (0.45 * Math.min(1, this.slowT)).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (this.flashT > 0) {
    ctx.fillStyle = 'rgba(255,40,70,' + (0.10 * this.flashT / 0.35).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
};

Renderer.prototype._bannerDraw = function (ctx) {
  if (!this.banner) { return; }
  var b = this.banner;
  var f = b.life / b.ttl;
  var alpha = f < 0.12 ? f / 0.12 : (f > 0.8 ? (1 - f) / 0.2 : 1);
  var scale = f < 0.12 ? 0.8 + 0.2 * (f / 0.12) : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(this.W / 2, this.H * 0.36);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  try { ctx.letterSpacing = '8px'; } catch (e) { /* ignore */ }
  ctx.font = '700 44px ' + FONT;
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color; ctx.shadowBlur = 26;
  ctx.fillText(b.title, 0, 0);
  if (b.sub) {
    try { ctx.letterSpacing = '3px'; } catch (e2) { /* ignore */ }
    ctx.font = '400 17px ' + FONT;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#e8ecff';
    ctx.fillText(b.sub, 0, 34);
  }
  ctx.restore();
};

Renderer.prototype._synPopDraw = function (ctx) {
  if (!this.synPop) { return; }
  var s = this.synPop;
  var f = s.life / s.ttl;
  var alpha = f < 0.1 ? f / 0.1 : (f > 0.75 ? (1 - f) / 0.25 : 1);
  var w = 300, h = 74;
  var x = this.W / 2 - w / 2, y = 54;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = 'rgba(20,8,28,0.92)';
  ctx.strokeStyle = '#ff2fd6'; ctx.lineWidth = 2;
  ctx.shadowColor = '#ff2fd6'; ctx.shadowBlur = 16;
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, 12); } else { ctx.rect(x, y, w, h); }
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 16px ' + FONT;
  ctx.fillText('\u2726 SYNERGY: ' + s.name.toUpperCase(), this.W / 2, y + 28);
  ctx.fillStyle = '#e8c8f2';
  ctx.font = '400 13px ' + FONT;
  var desc = s.desc.length > 52 ? s.desc.slice(0, 52) + '...' : s.desc;
  ctx.fillText(desc, this.W / 2, y + 50);
  ctx.restore();
};

/* ---------------- public draw ---------------- */

Renderer.prototype.draw = function (sim, view) {
  var now = 0;
  try { now = performance.now() / 1000; } catch (e) { now = this.time + 0.016; }
  var dt = this.lastT ? Math.min(0.05, now - this.lastT) : 0.016;
  this.lastT = now;
  this.time += dt;
  var ctx = this.ctx;

  if (sim && sim.events && sim.events.length) {
    var evs = sim.events;
    for (var i = 0; i < evs.length; i++) { this._handleEvent(evs[i]); }
    evs.length = 0;
  }
  this._updateFx(dt);

  ctx.save();
  var sh = this.bump;
  if (sim && sim.state && sim.state.shake) { sh += sim.state.shake; }
  this.bump *= Math.pow(0.002, dt);
  if (sh > 0.05) {
    ctx.translate((Math.random() * 2 - 1) * sh, (Math.random() * 2 - 1) * sh);
  }

  this._bg(ctx, dt);
  var lvl = (view && view.level) || (sim && sim.level) || null;
  if (lvl) {
    this._path(ctx, lvl);
    this._plots(ctx, lvl, sim, view);
  }
  if (sim && sim.state) {
    this._towers(ctx, sim, view);
    this._enemies(ctx, sim);
    this._projectiles(ctx, sim);
    this._beams(ctx, sim);
  }
  this._fx(ctx);
  ctx.restore();

  this._vignette(ctx);
  this._bannerDraw(ctx);
  this._synPopDraw(ctx);
};

/* Ambient background for menus: starfield plus slow drifting motes. */
Renderer.prototype.drawAmbient = function (t) {
  this.time = (typeof t === 'number') ? t : this.time + 0.016;
  var now = 0;
  try { now = performance.now() / 1000; } catch (e) { now = this.time; }
  var dt = this.lastT ? Math.min(0.05, now - this.lastT) : 0.016;
  this.lastT = now;
  this._updateFx(dt);
  var ctx = this.ctx;
  ctx.save();
  this._bg(ctx, dt);
  /* a few orbiting sparks for life */
  var i;
  for (i = 0; i < 7; i++) {
    var a = this.time * (0.12 + i * 0.03) + i * 2.1;
    var x = this.W / 2 + Math.cos(a) * (140 + i * 34);
    var y = this.H / 2 + Math.sin(a * 1.3) * (90 + i * 22);
    var hue = i % 2 ? '#22d3ee' : '#ff2fd6';
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.time * 2 + i);
    ctx.fillStyle = hue;
    ctx.shadowColor = hue; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  this._fx(ctx);
  ctx.restore();
};

NB.Renderer = Renderer;

})();
