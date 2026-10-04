/* Nova Bastion - game */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* Controller: owns sim + renderer + UI, runs the rAF loop, routes pointer
   input, and maps sim events to audio cues and UI toasts.
   The renderer drains sim.events inside draw() and forwards each event to
   renderer.eventListener, which is wired to Game._onEvent below. */

function levelList() { return NB.LEVELS || []; }

var Game = {
  canvas: null,
  renderer: null,
  ui: null,
  sim: null,
  level: null,
  levelIndex: 0,
  mode: 'title', /* title | levels | game */
  W: 960, H: 600,
  view: null,
  lastT: 0,
  _loop: null,
  _lastKillSnd: 0,
  _simFailed: false,
  howtoReturn: 'title',

  init: function (canvas) {
    this.canvas = canvas;
    if (NB.CONFIG) {
      this.W = NB.CONFIG.WIDTH || 960;
      this.H = NB.CONFIG.HEIGHT || 600;
    }
    canvas.width = this.W;
    canvas.height = this.H;
    this.renderer = new NB.Renderer(canvas);
    this.ui = NB.UI;
    this.ui.init(this);
    var self = this;
    this.renderer.eventListener = function (e) { self._onEvent(e); };
    this._loop = function (t) { self.frame(t); };
    this.resetView();
    canvas.addEventListener('pointerdown', function (ev) { self.onPointerDown(ev); });
    canvas.addEventListener('pointermove', function (ev) { self.onPointerMove(ev); });
    canvas.addEventListener('pointerleave', function () {
      self.view.hoverPlot = -1; self.view.hoverTower = null;
    });
    this.ui.show('title');
    this.updateTitleButton();
    requestAnimationFrame(this._loop);
  },

  resetView: function () {
    this.view = { level: this.level, selectedPlot: -1, selectedTower: null,
      hoverPlot: -1, hoverTower: null };
  },

  updateTitleButton: function () {
    var btn = document.getElementById('btn-title-start');
    if (!btn) { return; }
    var s = this.ui.save;
    var hasProgress = this.ui.save.unlocked > 1 || Object.keys(s.stars || {}).length > 0;
    btn.textContent = hasProgress ? 'Continue' : 'Start';
  },

  /* ---------------- flow ---------------- */

  titleStart: function () {
    var hasProgress = this.ui.save.unlocked > 1 || Object.keys(this.ui.save.stars || {}).length > 0;
    if (hasProgress) {
      this.mode = 'levels';
      this.howtoReturn = 'levels';
      this.ui.show('levels');
    } else {
      this.startLevel(0);
    }
  },

  howtoBack: function () {
    if (this.howtoReturn === 'pause') { this.ui.show('pause'); }
    else if (this.howtoReturn === 'levels') { this.mode = 'levels'; this.ui.show('levels'); }
    else { this.ui.show('title'); this.updateTitleButton(); }
  },

  levelsBack: function () {
    this.mode = 'title';
    this.howtoReturn = 'title';
    this.ui.show('title');
    this.updateTitleButton();
  },

  startLevel: function (i) {
    var lv = levelList();
    if (!lv[i]) { this.ui.toast('Sector unavailable', 'Level data is missing.'); return; }
    if (typeof NB.createSim !== 'function') {
      this.ui.toast('Simulation not loaded', 'The sim layer (js/sim.js) failed to load.');
      return;
    }
    this.levelIndex = i;
    this.level = lv[i];
    this._simFailed = false;
    try {
      this.sim = NB.createSim(this.level, {});
    } catch (e) {
      this.ui.toast('Could not start sector', String((e && e.message) || e));
      this.sim = null;
      return;
    }
    this.mode = 'game';
    this.resetView();
    this.ui.closePanels();
    this.ui.show(null);
    this.ui.updateHUD(this.safeSnapshot());
    this.ui.toast(this.level.name || ('Sector ' + (i + 1)), this.level.tagline || '');
  },

  restart: function () {
    if (this.mode !== 'game') { return; }
    this.startLevel(this.levelIndex);
  },

  nextLevel: function () {
    this.startLevel(this.levelIndex + 1);
  },

  quitToLevels: function () {
    this.mode = 'levels';
    this.sim = null;
    this.howtoReturn = 'levels';
    this.ui.closePanels();
    this.ui.show('levels');
    this.updateTitleButton();
  },

  togglePause: function () {
    if (this.mode !== 'game' || !this.sim || !this.sim.state) { return; }
    if (this.sim.state.over) { return; }
    try { this.sim.togglePause(); } catch (e) { return; }
    NB.Audio.play('click');
    if (this.sim.state.paused) { this.ui.show('pause'); }
    else { this.ui.show(null); this.ui.updateHUD(this.safeSnapshot()); }
  },

  setSpeed: function (n) {
    var speeds = (NB.CONFIG && NB.CONFIG.SPEEDS) || [1, 2, 3];
    if (speeds.indexOf(n) < 0) { return; }
    if (this.sim && this.mode === 'game') {
      try { this.sim.setSpeed(n); } catch (e) { /* ignore */ }
      this.ui.updateHUD(this.safeSnapshot());
    }
  },

  toggleMute: function () {
    var m = NB.Audio.toggle();
    this.ui.setMuteIcon(m);
    this.ui.toast(m ? 'Sound off' : 'Sound on');
  },

  startWave: function () {
    if (!this.sim) { return; }
    try { this.sim.startWave(); } catch (e) { this.ui.toast('Cannot start wave'); return; }
    this.ui.closePanels();
    this.clearSelection();
  },

  callEarly: function () {
    if (!this.sim) { return; }
    try { this.sim.callEarly(); NB.Audio.play('coin'); } catch (e) { NB.Audio.play('error'); }
    this.ui.closePanels();
  },

  /* ---------------- build / upgrade ---------------- */

  buildAt: function (plotIndex, towerId) {
    if (!this.sim || plotIndex == null || plotIndex < 0) { return; }
    var before = this.sim.state.towers.length;
    try { this.sim.build(plotIndex, towerId); }
    catch (e) { NB.Audio.play('error'); this.ui.toast('Cannot build', String((e && e.message) || e)); return; }
    if (this.sim.state.towers.length > before) {
      NB.Audio.play('build');
      var plot = (this.level.plots || [])[plotIndex];
      var nt = null;
      if (plot) {
        var list = this.sim.state.towers;
        for (var i = list.length - 1; i >= 0; i--) {
          var dx = list[i].x - plot.x, dy = list[i].y - plot.y;
          if (dx * dx + dy * dy < 64) { nt = list[i]; break; }
        }
      }
      if (nt) { this.selectTower(nt.instId); }
      else { this.ui.closePanels(); this.clearSelection(); }
    } else {
      NB.Audio.play('error');
    }
  },

  upgradeSelected: function () {
    var id = this.ui.selTower;
    var t = this.ui.towerById(id);
    if (!this.sim || !t) { return; }
    var before = t.tier;
    try { this.sim.upgrade(id); }
    catch (e) { NB.Audio.play('error'); this.ui.toast('Cannot upgrade', String((e && e.message) || e)); return; }
    if (t.tier > before) { NB.Audio.play('upgrade'); } else { NB.Audio.play('error'); }
    this.ui.refreshTowerPanel();
  },

  branchSelected: function (side) {
    var id = this.ui.selTower;
    if (!this.sim || !id) { return; }
    try { this.sim.chooseBranch(id, side); NB.Audio.play('branch'); }
    catch (e) { NB.Audio.play('error'); this.ui.toast('Cannot specialize', String((e && e.message) || e)); return; }
    this.ui.refreshTowerPanel();
  },

  sellSelected: function () {
    var id = this.ui.selTower;
    var t = this.ui.towerById(id);
    if (!this.sim || !t) { return; }
    var before = this.sim.state.towers.length;
    try { this.sim.sell(id); }
    catch (e) { NB.Audio.play('error'); return; }
    if (this.sim.state.towers.length < before) { NB.Audio.play('sell'); }
    this.ui.closePanels();
    this.clearSelection();
  },

  previewWave: function () {
    if (!this.sim || typeof this.sim.previewWave !== 'function') { return null; }
    var st = this.sim.state;
    var n = st.waveIndex + (st.waveActive ? 1 : 0);
    try { return this.sim.previewWave(n); } catch (e) { return null; }
  },

  /* ---------------- selection ---------------- */

  clearSelection: function () {
    this.view.selectedPlot = -1;
    this.view.selectedTower = null;
    this.view.hoverTower = null;
  },

  selectTower: function (instId) {
    this.view.selectedPlot = -1;
    this.view.selectedTower = instId;
    this.ui.openTower(instId);
  },

  overlayOpen: function () {
    var ids = ['screen-pause', 'screen-end', 'screen-howto', 'screen-levels', 'screen-title'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && !el.classList.contains('hidden')) { return true; }
    }
    return false;
  },

  toGame: function (ev) {
    var r = this.canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (this.W / Math.max(1, r.width)),
      y: (ev.clientY - r.top) * (this.H / Math.max(1, r.height))
    };
  },

  hitTower: function (x, y) {
    var list = (this.sim && this.sim.state && this.sim.state.towers) || [];
    for (var i = list.length - 1; i >= 0; i--) {
      var dx = list[i].x - x, dy = list[i].y - y;
      if (dx * dx + dy * dy < 26 * 26) { return list[i]; }
    }
    return null;
  },

  hitPlot: function (x, y) {
    var plots = (this.level && this.level.plots) || [];
    for (var i = 0; i < plots.length; i++) {
      var dx = plots[i].x - x, dy = plots[i].y - y;
      if (dx * dx + dy * dy < 30 * 30) { return i; }
    }
    return -1;
  },

  onPointerDown: function (ev) {
    if (this.mode !== 'game' || !this.sim || this.overlayOpen()) { return; }
    if (this.sim.state.paused || this.sim.state.over) { return; }
    ev.preventDefault();
    try { NB.Audio.init(); } catch (e) { /* ignore */ }
    var p = this.toGame(ev);
    var tw = this.hitTower(p.x, p.y);
    if (tw) {
      NB.Audio.play('click');
      this.selectTower(tw.instId);
      return;
    }
    var pi = this.hitPlot(p.x, p.y);
    if (pi >= 0) {
      NB.Audio.play('click');
      this.view.selectedTower = null;
      this.view.selectedPlot = pi;
      this.ui.openBuild(pi, this.sim.state.gold);
      return;
    }
    this.ui.closePanels();
    this.clearSelection();
  },

  onPointerMove: function (ev) {
    if (this.mode !== 'game' || !this.sim) { return; }
    var p = this.toGame(ev);
    var tw = this.hitTower(p.x, p.y);
    this.view.hoverTower = tw ? tw.instId : null;
    this.view.hoverPlot = tw ? -1 : this.hitPlot(p.x, p.y);
    this.canvas.style.cursor = (tw || this.view.hoverPlot >= 0) ? 'pointer' : 'crosshair';
  },

  /* ---------------- events: audio + UI ---------------- */

  _onEvent: function (e) {
    if (!e || !e.t) { return; }
    var A = NB.Audio;
    switch (e.t) {
      case 'announce':
        this.ui.toast(e.text, e.sub, e.color);
        break;
      case 'kill': {
        var now = this.timeNow();
        if (now - this._lastKillSnd > 0.15) {
          this._lastKillSnd = now;
          A.play('click');
        }
        break;
      }
      case 'explosion': A.play('boom'); break;
      case 'leak': A.play('leak'); break;
      case 'waveStart':
        A.play('wave');
        if (e.boss || /boss/i.test(e.note || '') || /elite/i.test(e.note || '')) { A.play('alarm'); }
        break;
      case 'waveClear': A.play('coin'); break;
      case 'anomaly':
        this.ui.toast('Anomaly', e.text, '#ff2fd6');
        A.play(/boss|elite/i.test(e.type || '') ? 'alarm' : 'zap');
        break;
      case 'synergy':
        this.ui.toast('Synergy online: ' + e.name, e.desc, '#ffd166');
        A.play('branch');
        break;
      case 'victory':
        A.play('victory');
        this.onVictory(e);
        break;
      case 'defeat':
        A.play('defeat');
        this.onDefeat(e);
        break;
      default:
        break; /* build/sell/upgrade sounds are played by the action methods */
    }
  },

  timeNow: function () {
    try { return performance.now() / 1000; } catch (e) { return 0; }
  },

  onVictory: function (e) {
    var stars = Math.max(1, Math.min(3, e.stars | 0 || 1));
    var levelId = this.level ? this.level.id : ('sector-' + (this.levelIndex + 1));
    this.ui.recordVictory(levelId, stars, e.stats);
    this.ui.updateHUD(this.safeSnapshot());
    this.ui.showEnd(true, {
      stars: stars,
      stats: e.stats,
      levelName: (this.level && this.level.name) || 'Sector Cleared'
    });
  },

  onDefeat: function (e) {
    this.ui.updateHUD(this.safeSnapshot());
    this.ui.showEnd(false, {
      reason: e.reason,
      wave: this.sim && this.sim.state ? this.sim.state.waveIndex + 1 : null,
      stats: e.stats,
      levelName: (this.level && this.level.name) || 'Sector Lost'
    });
  },

  safeSnapshot: function () {
    if (!this.sim || typeof this.sim.snapshot !== 'function') { return null; }
    try { return this.sim.snapshot(); } catch (e) { return null; }
  },

  /* ---------------- main loop ---------------- */

  frame: function (t) {
    var now = t / 1000;
    var dt = this.lastT ? Math.min(0.1, now - this.lastT) : 0.016;
    this.lastT = now;
    if (this.mode === 'game' && this.sim) {
      if (!this._simFailed) {
        try { this.sim.update(dt); }
        catch (e) {
          this._simFailed = true;
          this.ui.toast('Simulation error', String((e && e.message) || e));
        }
      }
      this.renderer.draw(this.sim, this.view);
      this.ui.updateHUD(this.safeSnapshot());
    } else {
      this.renderer.drawAmbient(now);
    }
    requestAnimationFrame(this._loop);
  }
};

NB.Game = Game;

})();
