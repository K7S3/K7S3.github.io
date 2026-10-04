/* Nova Bastion - ui */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* DOM layer: screens, HUD, panels, toasts, save data.
   All game actions are delegated to NB.Game. Defensive: every data file
   (config, towers, enemies, levels) is optional and has a fallback. */

function $(id) { return document.getElementById(id); }

function saveKey() {
  return (NB.CONFIG && NB.CONFIG.STORAGE_KEY) || 'nova_bastion_save_v1';
}

function levels() { return NB.LEVELS || []; }
function towers() { return NB.TOWERS || {}; }
function enemies() { return NB.ENEMIES || {}; }
function synergies() { return NB.SYNERGIES || []; }

/* Small inline SVG glyph per tower behavior. No external assets. */
function towerIcon(behavior, color) {
  var c = color || '#22d3ee';
  var inner = '';
  switch (behavior) {
    case 'frost':
      inner = '<path d="M14 3v22M4.5 8.5l19 11M23.5 8.5l-19 11" stroke="' + c + '" stroke-width="2.4"/>' +
              '<circle cx="14" cy="14" r="3" fill="#e0faff"/>';
      break;
    case 'arc':
      inner = '<path d="M14 4v20" stroke="' + c + '" stroke-width="2.4"/>' +
              '<path d="M6 10a9 9 0 0 1 16 0M6 18a9 9 0 0 1 16 0" stroke="' + c + '" stroke-width="2" fill="none"/>' +
              '<circle cx="14" cy="3" r="2.4" fill="#fff"/>';
      break;
    case 'mortar':
      inner = '<circle cx="11" cy="15" r="7" fill="none" stroke="' + c + '" stroke-width="2.4"/>' +
              '<rect x="15" y="11" width="10" height="8" rx="2" fill="' + c + '"/>';
      break;
    case 'sniper':
      inner = '<path d="M3 14h22" stroke="' + c + '" stroke-width="3"/>' +
              '<circle cx="10" cy="14" r="4.4" fill="none" stroke="' + c + '" stroke-width="2.4"/>';
      break;
    case 'chrono':
      inner = '<circle cx="14" cy="14" r="9" fill="none" stroke="' + c + '" stroke-width="2.4"/>' +
              '<circle cx="14" cy="14" r="4.6" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-dasharray="3 3"/>' +
              '<circle cx="14" cy="14" r="1.8" fill="#fff"/>';
      break;
    case 'mint':
      inner = '<ellipse cx="14" cy="18" rx="9" ry="4" fill="#d9a821"/>' +
              '<ellipse cx="14" cy="13" rx="9" ry="4" fill="#d9a821"/>' +
              '<ellipse cx="14" cy="8" rx="9" ry="4" fill="#ffe9a8"/>';
      break;
    case 'amplify':
      inner = '<path d="M6 20a11 11 0 0 1 16 0" fill="none" stroke="' + c + '" stroke-width="2.4"/>' +
              '<path d="M9 15a7 7 0 0 1 10 0M11.5 11a3.5 3.5 0 0 1 5 0" fill="none" stroke="' + c + '" stroke-width="1.8"/>' +
              '<path d="M14 20v5" stroke="' + c + '" stroke-width="2.4"/>';
      break;
    default: /* pulse */
      inner = '<circle cx="14" cy="14" r="7" fill="none" stroke="' + c + '" stroke-width="2.4"/>' +
              '<circle cx="14" cy="14" r="3.4" fill="' + c + '"/>' +
              '<rect x="19" y="12" width="7" height="4" rx="1.5" fill="' + c + '"/>';
      break;
  }
  return '<svg viewBox="0 0 28 28" aria-hidden="true">' + inner + '</svg>';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var UI = {
  game: null,
  els: {},
  save: { stars: {}, best: {}, unlocked: 1 },
  selPlot: -1,
  selTower: null,

  init: function (game) {
    this.game = game;
    var ids = ['hud', 'hud-gold-v', 'hud-lives-v', 'hud-wave-v', 'speed-seg',
      'btn-pause', 'btn-restart', 'btn-mute', 'btn-menu', 'btn-wave',
      'toast-wrap', 'banner', 'banner-title', 'banner-sub',
      'panel-build', 'build-grid', 'build-title',
      'panel-tower', 'tower-name', 'tower-tier', 'tower-desc', 'tower-stats',
      'tower-synergy', 'btn-upgrade', 'btn-sell', 'branch-row', 'btn-branch-a', 'btn-branch-b',
      'panel-wave', 'wave-title', 'wave-list', 'wave-note', 'wave-bonus', 'btn-wave-start', 'btn-wave-early',
      'screen-title', 'screen-howto', 'screen-levels', 'screen-pause', 'screen-end',
      'btn-title-start', 'btn-title-howto', 'btn-howto-back',
      'howto-towers', 'howto-enemies', 'howto-synergies',
      'level-grid', 'btn-levels-back',
      'btn-resume', 'btn-pause-restart', 'btn-pause-howto', 'btn-quit',
      'end-kicker', 'end-title', 'end-stars', 'end-stats', 'btn-end-next', 'btn-end-retry', 'btn-end-levels'];
    for (var i = 0; i < ids.length; i++) { this.els[ids[i]] = $(ids[i]); }
    this.loadSave();
    this.wire();
    this.buildHowto();
    this.setMuteIcon(NB.Audio && NB.Audio.muted);
  },

  /* ---------- save ---------- */
  loadSave: function () {
    try {
      var raw = localStorage.getItem(saveKey());
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          this.save.stars = s.stars || {};
          this.save.best = s.best || {};
          this.save.unlocked = Math.max(1, s.unlocked | 0 || 1);
        }
      }
    } catch (e) { /* corrupted save: start fresh */ }
    this.save.unlocked = Math.min(this.save.unlocked, Math.max(1, levels().length));
  },
  persist: function () {
    try { localStorage.setItem(saveKey(), JSON.stringify(this.save)); } catch (e) { /* ignore */ }
  },
  recordVictory: function (levelId, stars, stats) {
    var prev = this.save.stars[levelId] || 0;
    if (stars > prev) { this.save.stars[levelId] = stars; }
    var lv = levels();
    var idx = -1;
    for (var i = 0; i < lv.length; i++) { if (lv[i].id === levelId) { idx = i; break; } }
    if (idx >= 0) {
      this.save.unlocked = Math.min(lv.length, Math.max(this.save.unlocked, idx + 2));
      var b = this.save.best[levelId] || {};
      if (stats) {
        if (stats.time != null && (b.time == null || stats.time < b.time)) { b.time = stats.time; }
        if (stats.lives != null && (b.lives == null || stats.lives > b.lives)) { b.lives = stats.lives; }
      }
      this.save.best[levelId] = b;
    }
    this.persist();
  },

  /* ---------- screens ---------- */
  show: function (name) {
    var screens = ['screen-title', 'screen-howto', 'screen-levels', 'screen-pause', 'screen-end'];
    for (var i = 0; i < screens.length; i++) {
      var el = this.els[screens[i]];
      if (el) { el.classList.add('hidden'); }
    }
    var hudOn = false;
    if (name) {
      var target = this.els['screen-' + name];
      if (target) { target.classList.remove('hidden'); }
      hudOn = (name === 'pause');
    } else {
      hudOn = true;
    }
    if (this.els.hud) { this.els.hud.classList.toggle('hidden', !hudOn); }
    if (name === 'levels') { this.renderLevels(); }
  },

  /* ---------- wiring ---------- */
  wire: function () {
    var self = this;
    function on(id, fn) {
      var el = self.els[id];
      if (el) { el.addEventListener('click', function (ev) { ev.preventDefault(); fn(); }); }
    }
    on('btn-title-start', function () { self.game.titleStart(); NB.Audio.play('click'); });
    on('btn-title-howto', function () { self.game.howtoReturn = 'title'; self.show('howto'); NB.Audio.play('click'); });
    on('btn-howto-back', function () { self.game.howtoBack(); NB.Audio.play('click'); });
    on('btn-levels-back', function () { self.game.levelsBack(); NB.Audio.play('click'); });
    on('btn-pause', function () { self.game.togglePause(); });
    on('btn-restart', function () { self.game.restart(); NB.Audio.play('click'); });
    on('btn-menu', function () { self.game.quitToLevels(); NB.Audio.play('click'); });
    on('btn-mute', function () { self.game.toggleMute(); NB.Audio.play('click'); });
    on('btn-wave', function () { self.openWave(); NB.Audio.play('click'); });
    on('btn-wave-start', function () { self.game.startWave(); });
    on('btn-wave-early', function () { self.game.callEarly(); });
    on('btn-upgrade', function () { self.game.upgradeSelected(); });
    on('btn-sell', function () { self.game.sellSelected(); });
    on('btn-branch-a', function () { self.game.branchSelected('a'); });
    on('btn-branch-b', function () { self.game.branchSelected('b'); });
    on('btn-resume', function () { self.game.togglePause(); NB.Audio.play('click'); });
    on('btn-pause-restart', function () { self.game.restart(); NB.Audio.play('click'); });
    on('btn-pause-howto', function () { self.game.howtoReturn = 'pause'; self.show('howto'); NB.Audio.play('click'); });
    on('btn-quit', function () { self.game.quitToLevels(); NB.Audio.play('click'); });
    on('btn-end-next', function () { self.game.nextLevel(); NB.Audio.play('click'); });
    on('btn-end-retry', function () { self.game.restart(); NB.Audio.play('click'); });
    on('btn-end-levels', function () { self.game.quitToLevels(); NB.Audio.play('click'); });

    var closes = document.querySelectorAll('[data-close]');
    for (var i = 0; i < closes.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          var p = $(el.getAttribute('data-close'));
          if (p) { p.classList.add('hidden'); }
          self.selPlot = -1; self.selTower = null;
          self.game.clearSelection();
          NB.Audio.play('click');
        });
      })(closes[i]);
    }

    var segBtns = document.querySelectorAll('#speed-seg .seg-btn');
    for (var s = 0; s < segBtns.length; s++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.game.setSpeed(parseInt(btn.getAttribute('data-speed'), 10) || 1);
          NB.Audio.play('click');
        });
      })(segBtns[s]);
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.key === ' ') {
        ev.preventDefault();
        self.game.togglePause();
      } else if (ev.key === '1') { self.game.setSpeed(1); }
      else if (ev.key === '2') { self.game.setSpeed(2); }
      else if (ev.key === '3') { self.game.setSpeed(3); }
      else if (ev.key === 'Escape') {
        if (!self.allPanelsHidden()) { self.closePanels(); self.game.clearSelection(); }
        else { self.game.togglePause(); }
      }
    });
  },

  allPanelsHidden: function () {
    return this.els['panel-build'].classList.contains('hidden') &&
      this.els['panel-tower'].classList.contains('hidden') &&
      this.els['panel-wave'].classList.contains('hidden');
  },

  closePanels: function () {
    this.els['panel-build'].classList.add('hidden');
    this.els['panel-tower'].classList.add('hidden');
    this.els['panel-wave'].classList.add('hidden');
    this.selPlot = -1;
    this.selTower = null;
  },

  /* ---------- HUD ---------- */
  updateHUD: function (snap) {
    if (!snap) { return; }
    this.els['hud-gold-v'].textContent = snap.gold | 0;
    this.els['hud-lives-v'].textContent = snap.lives | 0;
    var wv = '-';
    if (snap.wavesTotal > 0) {
      var cur = Math.min(snap.waveIndex + 1, snap.wavesTotal);
      wv = snap.waveActive ? (cur + '/' + snap.wavesTotal) : ('next ' + cur + '/' + snap.wavesTotal);
    }
    this.els['hud-wave-v'].textContent = wv;
    var btns = document.querySelectorAll('#speed-seg .seg-btn');
    for (var i = 0; i < btns.length; i++) {
      var sp = parseInt(btns[i].getAttribute('data-speed'), 10) || 1;
      btns[i].classList.toggle('active', sp === snap.speed);
    }
    this.els['btn-pause'].innerHTML = snap.paused ? '&#9654;' : '&#10074;&#10074;';
    this.els['btn-wave'].classList.toggle('hidden', !(snap.intermission > 0 && !snap.over));
  },

  setMuteIcon: function (m) {
    if (this.els['btn-mute']) { this.els['btn-mute'].textContent = m ? '\u00d7♪' : '♪'; }
  },

  /* ---------- toasts ---------- */
  toast: function (text, sub, color) {
    var wrap = this.els['toast-wrap'];
    if (!wrap) { return; }
    while (wrap.children.length >= 3) { wrap.removeChild(wrap.firstChild); }
    var d = document.createElement('div');
    d.className = 'toast';
    if (color) { d.style.borderLeftColor = color; }
    d.innerHTML = '<span>' + esc(text) + '</span>' +
      (sub ? '<span class="t-sub">' + esc(sub) + '</span>' : '');
    wrap.appendChild(d);
    setTimeout(function () {
      d.classList.add('out');
      setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 350);
    }, 3000);
  },

  /* ---------- build panel ---------- */
  openBuild: function (plotIndex, gold) {
    this.closePanels();
    this.selPlot = plotIndex;
    this.selTower = null;
    var grid = this.els['build-grid'];
    grid.innerHTML = '';
    var defs = towers();
    var ids = Object.keys(defs);
    this.els['build-title'].textContent = 'Build Tower - Plot ' + (plotIndex + 1);
    if (!ids.length) {
      grid.innerHTML = '<p class="muted">No tower data loaded.</p>';
    }
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var def = defs[id];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'build-btn';
        var afford = (gold | 0) >= (def.cost | 0);
        if (afford) { b.classList.add('afford'); } else { b.disabled = true; }
        b.style.color = def.color || '#22d3ee';
        b.innerHTML = towerIcon(def.behavior, def.color) +
          '<span class="b-name">' + esc(def.name || id) + '</span>' +
          '<span class="b-tag">' + esc(def.tag || '') + '</span>' +
          '<span class="b-cost">' + (def.cost | 0) + 'g</span>';
        b.title = def.desc || '';
        b.addEventListener('click', function () { UI.game.buildAt(UI.selPlot, id); });
        grid.appendChild(b);
      })(ids[i]);
    }
    this.els['panel-build'].classList.remove('hidden');
  },

  /* ---------- tower panel ---------- */
  towerById: function (instId) {
    var list = (this.game.sim && this.game.sim.state && this.game.sim.state.towers) || [];
    for (var i = 0; i < list.length; i++) { if (list[i].instId === instId) { return list[i]; } }
    return null;
  },

  openTower: function (instId) {
    this.closePanels();
    this.selTower = instId;
    this.selPlot = -1;
    this.refreshTowerPanel();
    this.els['panel-tower'].classList.remove('hidden');
  },

  refreshTowerPanel: function () {
    var t = this.towerById(this.selTower);
    if (!t) { this.els['panel-tower'].classList.add('hidden'); return; }
    var def = towers()[t.id] || {};
    this.els['tower-name'].textContent = def.name || t.id;
    this.els['tower-name'].style.color = def.color || '#22d3ee';
    var pips = this.els['tower-tier'];
    pips.innerHTML = '';
    var maxTiers = (def.tiers && def.tiers.length) || 3;
    for (var i = 0; i < maxTiers; i++) {
      var p = document.createElement('span');
      p.className = 'pip' + (i < t.tier ? ' on' : '') + (t.branch ? ' branch' : '');
      pips.appendChild(p);
    }
    this.els['tower-desc'].textContent = def.desc || '';
    var st = t.stats || {};
    var dps = (st.damage || 0) * (st.fireRate || 0);
    var rows = [
      ['Damage', (st.damage != null ? st.damage : '-')],
      ['Fire rate', (st.fireRate != null ? (+st.fireRate).toFixed(2) + '/s' : '-')],
      ['Range', (st.range != null ? Math.round(st.range) : '-')],
      ['DPS', dps ? dps.toFixed(1) : '-'],
      ['Spent', (t.totalSpent | 0) + 'g']
    ];
    var html = '';
    for (var r = 0; r < rows.length; r++) {
      html += '<div class="stat"><b>' + rows[r][0] + '</b><span>' + esc(rows[r][1]) + '</span></div>';
    }
    this.els['tower-stats'].innerHTML = html;
    var syn = this.els['tower-synergy'];
    if (t.activeSynergies && t.activeSynergies.length) {
      syn.classList.remove('hidden');
      syn.textContent = '\u2726 Synergy: ' + t.activeSynergies.join(', ');
    } else { syn.classList.add('hidden'); }

    var upBtn = this.els['btn-upgrade'];
    var branchRow = this.els['branch-row'];
    var tiers = def.tiers || [];
    var atMax = t.tier >= tiers.length;
    if (!atMax) {
      var next = tiers[t.tier] || {};
      upBtn.classList.remove('hidden');
      upBtn.disabled = false;
      upBtn.textContent = 'Upgrade (' + (next.cost | 0) + 'g)' + (next.note ? ' - ' + next.note : '');
      branchRow.classList.add('hidden');
    } else if (def.branch && !t.branch) {
      upBtn.classList.add('hidden');
      branchRow.classList.remove('hidden');
      var ba = def.branch.a || {}, bb = def.branch.b || {};
      this.els['btn-branch-a'].innerHTML = '<b>' + esc(ba.name || 'Branch A') + '</b><br><span class="b-cost">' +
        (ba.cost | 0) + 'g</span><br><span class="muted tiny">' + esc(ba.desc || '') + '</span>';
      this.els['btn-branch-b'].innerHTML = '<b>' + esc(bb.name || 'Branch B') + '</b><br><span class="b-cost">' +
        (bb.cost | 0) + 'g</span><br><span class="muted tiny">' + esc(bb.desc || '') + '</span>';
    } else {
      upBtn.classList.remove('hidden');
      upBtn.disabled = true;
      upBtn.textContent = t.branch ? 'Specialized' : 'Max Tier';
      branchRow.classList.add('hidden');
    }
  },

  /* ---------- wave panel ---------- */
  openWave: function () {
    this.closePanels();
    var pv = this.game.previewWave();
    var list = this.els['wave-list'];
    list.innerHTML = '';
    if (!pv) {
      list.innerHTML = '<p class="muted">No wave data.</p>';
    } else {
      var n = pv.n != null ? pv.n : (pv.wave != null ? pv.wave : '?');
      this.els['wave-title'].textContent = 'Wave ' + n + ' Preview';
      var rows = pv.enemies || pv.groups || [];
      if (!rows.length && pv.note) {
        list.innerHTML = '<p class="muted">' + esc(pv.note) + '</p>';
      }
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var ed = enemies()[row.type] || {};
        var d = document.createElement('div');
        d.className = 'wave-row';
        d.innerHTML = '<span class="dot" style="background:' + esc(ed.color || '#ff5d5d') +
          ';box-shadow:0 0 8px ' + esc(ed.color || '#ff5d5d') + '"></span>' +
          '<span class="w-name">' + esc(ed.name || row.type) + '</span>' +
          '<span class="w-count">x' + (row.count | 0 || '?') + '</span>';
        list.appendChild(d);
      }
      this.els['wave-note'].textContent = pv.note || '';
      var bonus = pv.earlyBonus != null ? pv.earlyBonus : pv.bonus;
      this.els['wave-bonus'].textContent = (bonus != null && bonus > 0)
        ? 'Call early for +' + bonus + 'g bonus gold.' : '';
      var active = this.game.sim && this.game.sim.state && this.game.sim.state.waveActive;
      this.els['btn-wave-start'].disabled = !!active;
      this.els['btn-wave-early'].disabled = !!active;
    }
    this.els['panel-wave'].classList.remove('hidden');
  },

  /* ---------- how to ---------- */
  buildHowto: function () {
    var tw = this.els['howto-towers'];
    if (tw) {
      var defs = towers(), ids = Object.keys(defs), html = '';
      for (var i = 0; i < ids.length; i++) {
        var d = defs[ids[i]];
        html += '<div class="roster-card"><h3 style="color:' + esc(d.color || '#22d3ee') + '">' +
          esc(d.name || ids[i]) + '</h3>' +
          '<div class="cost">' + (d.cost | 0) + 'g &middot; ' + esc(d.tag || '') + '</div>' +
          '<p>' + esc(d.desc || '') + '</p></div>';
      }
      tw.innerHTML = html || '<p class="muted">Tower data not loaded.</p>';
    }
    var en = this.els['howto-enemies'];
    if (en) {
      var edefs = enemies(), eids = Object.keys(edefs), eh = '';
      for (var k = 0; k < eids.length; k++) {
        var e = edefs[eids[k]];
        eh += '<div class="roster-card"><h3 style="color:' + esc(e.color || '#ff5d5d') + '">' +
          esc(e.name || eids[k]) + '</h3><p>' + esc(e.desc || '') + '</p></div>';
      }
      en.innerHTML = eh || '<p class="muted">Enemy data not loaded.</p>';
    }
    var sy = this.els['howto-synergies'];
    if (sy) {
      var list = synergies(), sh = '';
      for (var s = 0; s < list.length; s++) {
        sh += '<div class="roster-card"><h3 style="color:#ffd166">' + esc(list[s].name || list[s].id) + '</h3>' +
          '<p>' + esc(list[s].desc || '') + '</p></div>';
      }
      sy.innerHTML = sh || '<p class="muted">No synergies defined.</p>';
    }
  },

  /* ---------- level select ---------- */
  renderLevels: function () {
    var grid = this.els['level-grid'];
    if (!grid) { return; }
    grid.innerHTML = '';
    var lv = levels();
    for (var i = 0; i < lv.length; i++) {
      (function (idx) {
        var L = lv[idx];
        var locked = idx >= UI.save.unlocked;
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'level-card';
        card.disabled = locked;
        var stars = UI.save.stars[L.id] || 0;
        var starStr = '';
        for (var s = 0; s < 3; s++) { starStr += s < stars ? '\u2605' : '\u2606'; }
        var pips = '';
        var diff = L.difficulty | 0 || 1;
        for (var d = 0; d < 5; d++) { pips += d < diff ? '\u25cf' : '\u25cb'; }
        var best = UI.save.best[L.id] || {};
        var bestStr = best.time != null ? ('Best: ' + Math.round(best.time) + 's' + (best.lives != null ? ', ' + best.lives + ' lives' : '')) : 'Not cleared yet';
        card.innerHTML = '<h3>' + (locked ? '\u1f512 ' : '') + esc(L.name || ('Sector ' + (idx + 1))) + '</h3>' +
          '<div class="diff">' + pips + '</div>' +
          '<div class="l-stars">' + starStr + '</div>' +
          '<div class="l-best">' + esc(L.tagline || '') + '<br>' + esc(bestStr) + '</div>';
        if (!locked) {
          card.addEventListener('click', function () { UI.game.startLevel(idx); });
        }
        grid.appendChild(card);
      })(i);
    }
    if (!lv.length) {
      grid.innerHTML = '<p class="muted">No sectors defined yet.</p>';
    }
  },

  /* ---------- end screen ---------- */
  showEnd: function (win, data) {
    data = data || {};
    this.els['end-kicker'].textContent = win ? 'Victory' : 'Defeat';
    this.els['end-kicker'].style.color = win ? '#4ade80' : '#ff4d6d';
    this.els['end-title'].textContent = data.levelName || (win ? 'Sector Cleared' : 'Sector Lost');
    var stars = win ? (data.stars | 0 || 1) : 0;
    var html = '';
    for (var i = 0; i < 3; i++) {
      html += '<span class="' + (i < stars ? '' : 'dim') + '">\u2605</span>';
    }
    this.els['end-stars'].innerHTML = html;
    var stats = data.stats || {};
    var rows = [
      ['Waves cleared', stats.wavesCleared != null ? stats.wavesCleared : (data.wave != null ? data.wave : '-')],
      ['Enemies destroyed', stats.kills != null ? stats.kills : '-'],
      ['Gold earned', stats.goldEarned != null ? stats.goldEarned : '-'],
      ['Lives left', stats.lives != null ? stats.lives : '-'],
      ['Time', stats.time != null ? Math.round(stats.time) + 's' : '-']
    ];
    if (!win && data.reason) { rows.push(['Cause', data.reason]); }
    var th = '';
    for (var r = 0; r < rows.length; r++) {
      th += '<tr><td>' + esc(rows[r][0]) + '</td><td>' + esc(rows[r][1]) + '</td></tr>';
    }
    this.els['end-stats'].querySelector('tbody').innerHTML = th;
    var hasNext = win && this.game.levelIndex + 1 < levels().length;
    this.els['btn-end-next'].classList.toggle('hidden', !hasNext);
    this.show('end');
  }
};

NB.UI = UI;

})();
