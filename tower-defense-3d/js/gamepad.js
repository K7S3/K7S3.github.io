/* Nova Bastion 3D - gamepad support (Gamepad API).
 *
 * NB.Gamepad makes the whole game playable controller-only (Xbox via Edge):
 * a virtual cursor driven by the left stick feeds the exact same hover /
 * tap entry points the mouse uses (game.updateGhost, game.hoverTip,
 * game.onTap -> game.tapWorld), wall drawing reuses the drag-line path
 * (game._wallDrag, game.updateWallGhost, game.buildWallDrag), and menus get
 * a roving focus ring driven by the D-pad.
 *
 * Poll from the rAF loop: NB.Gamepad.poll(game, dt) every frame.
 * No dead controls: every mapped button does something sane in every state.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* standard-mapping button indices */
var BTN = { A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7,
            BACK:8, START:9, LS:10, RS:11, UP:12, DOWN:13, LEFT:14, RIGHT:15 };

var DEAD = 0.2;            /* stick dead zone */
var CURSOR_ACCEL = 5200;   /* px/s^2 */
var CURSOR_MAX = 1500;     /* px/s */
var CURSOR_DAMP = 7;       /* velocity damping per second */
var PAN_SPEED = 34;        /* camera world units per second at full deflection */
var ZOOM_RATE = 1.7;       /* zoom multiplier per second while LB/RB held */
var ROT_RATE = 1.5;        /* camera radians per second while LT/RT held */
var HINT_MS = 6000;        /* hints stay up this long after last pad input */
var DPAD_DELAY = 0.32;     /* s before D-pad auto-repeat starts */
var DPAD_REPEAT = 0.13;    /* s between D-pad repeats */

var GP = {
  game: null,
  _attached: false,
  _prev: [],
  _cursor: { x: 640, y: 400, vx: 0, vy: 0 },
  _focusEl: null,
  _focusList: [],
  _ctx: null,
  _ctxSig: '',
  _wallHeld: false,
  _dpad: { btn: -1, next: 0 },
  _lastPad: 0,
  _lastMouse: 0,
  _els: null,

  /* ---------------- setup ---------------- */

  attach: function(game){
    if (game) this.game = game;
    if (this._attached) return;
    this._attached = true;
    var self = this;
    function on(el, ev, fn, opt){
      if (el && el.addEventListener){ try { el.addEventListener(ev, fn, opt); } catch (e){} }
    }
    on(window, 'gamepadconnected', function(e){ self.onConnected(e); });
    on(window, 'gamepaddisconnected', function(e){ self.onDisconnected(e); });
    on(window, 'pointerdown', function(){ self._lastMouse = self.now(); }, true);
    on(window, 'wheel', function(){ self._lastMouse = self.now(); }, { passive: true });
    on(window, 'pointermove', function(e){
      if (e && (e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen')){
        self._lastMouse = self.now();
      }
    }, { passive: true });
    this.ensureDom();
  },

  ensureDom: function(){
    if (this._els || typeof document === 'undefined') return;
    var badge = document.getElementById('gamepad-badge');
    var hints = document.getElementById('gamepad-hints');
    var cursor = document.getElementById('gamepad-cursor');
    this._els = { badge: badge, hints: hints, cursor: cursor };
  },

  now: function(){
    try { return performance.now() / 1000; } catch (e){ return 0; }
  },

  onConnected: function(){
    this.ensureDom();
    this.markPad();
    this.showBadge(true);
    var ui = NB.UI;
    if (ui && typeof ui.toast === 'function'){
      try { ui.toast('Controller connected', 'Left stick moves the cursor. D-pad moves through menus.'); }
      catch (e){}
    }
  },

  onDisconnected: function(){
    this.showBadge(false);
    this.hideCursor();
    this.clearFocus();
    this._prev = [];
    this._wallHeld = false;
    this._dpad = { btn: -1, next: 0 };
    var ui = NB.UI;
    if (ui && typeof ui.toast === 'function'){
      try { ui.toast('Controller disconnected', 'Mouse and touch still work.'); }
      catch (e){}
    }
  },

  markPad: function(){ this._lastPad = this.now(); },
  padActiveInput: function(){
    if (!this.pad()) return false;
    var t = this.now();
    return (t - this._lastPad) < HINT_MS && this._lastPad >= this._lastMouse;
  },

  pad: function(){
    var nav = (typeof navigator !== 'undefined') ? navigator : null;
    if (!nav || typeof nav.getGamepads !== 'function') return null;
    var pads = null;
    try { pads = nav.getGamepads(); } catch (e){ return null; }
    if (!pads) return null;
    for (var i = 0; i < pads.length; i++){
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  },

  /* ---------------- per-frame poll ---------------- */

  poll: function(game, dt){
    if (game) this.game = game;
    var g = this.game;
    if (!g) return;
    this.ensureDom();
    var p = this.pad();
    this.showBadge(!!p);
    if (!p){
      this._prev = [];
      this.hideCursor();
      this.hideHints();
      if (this._wallHeld){ this._wallHeld = false; }
      return;
    }
    var now = this.now();
    dt = Math.min(0.1, Math.max(0.0001, dt || 0.016));

    this.pollSticks(p, dt, now);
    this.pollButtons(p, dt, now);
    this.syncFocus();
    this.refreshFocusClass();
    this.updateCursorDom();
    this.updateHints();
  },

  pollSticks: function(p, dt, now){
    var ax = this.axis(p, 0), ay = this.axis(p, 1);
    var rx = this.axis(p, 2), ry = this.axis(p, 3);
    var c = this._cursor;
    if (Math.abs(ax) > 0 || Math.abs(ay) > 0){
      this.markPad();
      c.vx += ax * CURSOR_ACCEL * dt;
      c.vy += ay * CURSOR_ACCEL * dt;
    }
    var damp = Math.max(0, 1 - CURSOR_DAMP * dt);
    c.vx *= damp; c.vy *= damp;
    var sp = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    if (sp > CURSOR_MAX){ c.vx *= CURSOR_MAX / sp; c.vy *= CURSOR_MAX / sp; }
    c.x += c.vx * dt; c.y += c.vy * dt;
    var w = this.viewW(), h = this.viewH();
    if (c.x < 8) { c.x = 8; c.vx = 0; }
    if (c.y < 8) { c.y = 8; c.vy = 0; }
    if (c.x > w - 8) { c.x = w - 8; c.vx = 0; }
    if (c.y > h - 8) { c.y = h - 8; c.vy = 0; }

    /* right stick: camera pan (game world only, no modal up) */
    if ((Math.abs(rx) > 0 || Math.abs(ry) > 0) && this.worldInputOk()){
      this.markPad();
      var g = this.game;
      if (g && g.renderer && g.renderer.camera){
        try { g.renderer.camera.panBy(-rx * PAN_SPEED * dt, -ry * PAN_SPEED * dt); }
        catch (e){}
      }
    }

    /* wall line preview follows the cursor while A is held */
    if (this._wallHeld){
      var cell = this.game.groundCell(c.x, c.y);
      var wd = this.game._wallDrag;
      if (cell && wd){
        wd.x2 = cell.cx; wd.z2 = cell.cz;
        this.game.updateWallGhost(wd.x1, wd.z1, cell.cx, cell.cz);
      }
    }

    /* hover ghost + tooltip ride the cursor, same path as the mouse */
    if (this.cursorVisible() && !this._wallHeld){
      try {
        this.game.updateGhost(c.x, c.y);
        this.game.hoverTip(c.x, c.y);
      } catch (e){}
    }
  },

  axis: function(p, i){
    var v = (p.axes && p.axes.length > i) ? p.axes[i] : 0;
    if (typeof v !== 'number' || Math.abs(v) < DEAD) return 0;
    /* rescale so the dead zone edge maps to 0 */
    var s = (Math.abs(v) - DEAD) / (1 - DEAD);
    return (v < 0 ? -1 : 1) * Math.min(1, s);
  },

  viewW: function(){ return (typeof window !== 'undefined' && window.innerWidth) || 1280; },
  viewH: function(){ return (typeof window !== 'undefined' && window.innerHeight) || 800; },

  pressed: function(p, i){
    var b = p.buttons && p.buttons[i];
    return !!(b && b.pressed);
  },

  btnVal: function(p, i){
    var b = p.buttons && p.buttons[i];
    var v = b ? b.value : 0;
    return typeof v === 'number' ? v : (b && b.pressed ? 1 : 0);
  },

  pollButtons: function(p, dt, now){
    var self = this;
    function edge(i){ return self.pressed(p, i) && !self._prev[i]; }
    function held(i){ return self.pressed(p, i); }
    var anyHeld = false;
    for (var i = 0; i < 17; i++){ if (this.pressed(p, i)){ anyHeld = true; break; } }
    if (anyHeld) this.markPad();

    if (edge(BTN.A)) this.onAPress();
    if (!held(BTN.A) && this._prev[BTN.A]) this.onARelease();
    if (edge(BTN.B)) this.onBPress();
    if (edge(BTN.X)) this.onXPress();
    if (edge(BTN.Y)) this.onYPress();
    if (edge(BTN.START)) this.onStartPress();
    if (edge(BTN.BACK)) this.onBackPress();
    if (edge(BTN.LS)) this.onLSPress();
    if (edge(BTN.RS)) this.onRSPress();

    /* LB/RB: zoom while held in the world; focus-step in menus */
    var inWorld = this.worldInputOk();
    var cam = this.game && this.game.renderer && this.game.renderer.camera;
    if (inWorld && cam){
      if (held(BTN.RB)){ try { cam.zoomBy(Math.pow(ZOOM_RATE, dt)); } catch (e){} }
      if (held(BTN.LB)){ try { cam.zoomBy(Math.pow(ZOOM_RATE, -dt)); } catch (e){} }
      /* LT/RT: rotate while held */
      var lt = this.btnVal(p, BTN.LT), rt = this.btnVal(p, BTN.RT);
      if (lt > 0.25){ try { cam.rotateBy(ROT_RATE * dt * lt); } catch (e){} }
      if (rt > 0.25){ try { cam.rotateBy(-ROT_RATE * dt * rt); } catch (e){} }
    } else {
      if (edge(BTN.LB)) this.moveFocus(-1);
      if (edge(BTN.RB)) this.moveFocus(1);
      if (edge(BTN.LT)) this.moveFocus(-1);
      if (edge(BTN.RT)) this.moveFocus(1);
    }

    this.pollDpad(p, now);

    var next = [];
    for (var k = 0; k < 17; k++) next[k] = this.pressed(p, k);
    this._prev = next;
  },

  pollDpad: function(p, now){
    var dirs = [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT];
    var active = -1;
    for (var i = 0; i < dirs.length; i++){
      if (this.pressed(p, dirs[i])){ active = dirs[i]; break; }
    }
    if (active < 0){ this._dpad.btn = -1; return; }
    if (!this._prev[active]){
      /* fresh press */
      this.navDir(active);
      this._dpad.btn = active;
      this._dpad.next = now + DPAD_DELAY;
    } else if (active === this._dpad.btn && now >= this._dpad.next){
      this.navDir(active);
      this._dpad.next = now + DPAD_REPEAT;
    }
  },

  navDir: function(btn){
    this.markPad();
    this.moveFocus((btn === BTN.LEFT || btn === BTN.UP) ? -1 : 1);
  },

  /* true when the world (not a menu) should take controller input */
  worldInputOk: function(){
    var g = this.game;
    if (!g || g.mode !== 'game') return false;
    if (!g.ui) return false;
    if (g.ui.anyScreenOpen() || g.ui.anyModalOpen()) return false;
    return true;
  },

  /* ---------------- A / B / X / Y / Start / Back ---------------- */

  onAPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    var ctx = this._ctx || this.topContext();
    if (ctx.type !== 'game' || !this.worldInputOk()){
      /* menu, modal, panel, or screen: A confirms the focused item */
      this.activateFocus();
      return;
    }
    /* in-world: a roving palette/HUD focus wins over the cursor */
    if (this._focusEl){
      this.activateFocus();
      this.clearFocus();
      return;
    }
    var snap = g.lastSnap;
    if (snap && (snap.paused || snap.over)) return;
    var c = this._cursor;
    var mode = g.placeMode;
    if (mode && mode.kind === 'wall'){
      /* hold A and move the cursor: wall line preview */
      var cell = null;
      try { cell = g.groundCell(c.x, c.y); } catch (e){}
      if (cell){
        g._wallDrag = { x1: cell.cx, z1: cell.cz, x2: cell.cx, z2: cell.cz };
        try { g.updateWallGhost(cell.cx, cell.cz, cell.cx, cell.cz); } catch (e){}
        this._wallHeld = true;
      }
      return;
    }
    /* same tap path as a mouse click */
    try { g.onTap(c.x, c.y); } catch (e){}
  },

  onARelease: function(){
    if (!this._wallHeld) return;
    this._wallHeld = false;
    var g = this.game;
    if (!g) return;
    /* same commit path as the mouse wall-drag release */
    var w = g._wallDrag;
    g._wallDrag = null;
    if (g.view) g.view.ghost = null;
    if (w && (w.x1 !== w.x2 || w.z1 !== w.z2)){
      try { g.buildWallDrag(w.x1, w.z1, w.x2, w.z2); } catch (e){}
    } else {
      try { g.updateGhost(this._cursor.x, this._cursor.y); } catch (e){}
    }
  },

  onBPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    var ctx = this._ctx || this.topContext();
    if (ctx.type === 'modal'){
      /* briefing/debrief can be backed out of; event/edict need a choice */
      if (ctx.id === 'modal-briefing') this.clickById('btn-briefing-skip');
      else if (ctx.id === 'modal-debrief') this.clickById('btn-debrief-ok');
      return;
    }
    if (ctx.type === 'screen'){ this.goBack(ctx.id); return; }
    /* game world or panel: cancel placement, clear selection, close panels */
    this.clearFocus();
    try {
      if (this._wallHeld){
        this._wallHeld = false;
        g._wallDrag = null;
        if (g.view) g.view.ghost = null;
      }
      g.cancelPlaceMode();
      g.clearSelection();
      if (g.ui) g.ui.closePanels();
    } catch (e){}
  },

  onXPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    if (!this.worldInputOk()){ this.activateFocus(); return; }
    var snap = g.lastSnap;
    if (snap && (snap.paused || snap.over)) return;
    /* same as the HUD Start button: send the next wave early for bonus gold */
    try { g.startWave(); } catch (e){}
  },

  onYPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    if (!this.worldInputOk()){ this.activateFocus(); return; }
    var order = [1, 2, 3];
    var cur = (g.lastSnap && g.lastSnap.speed) || 1;
    var next = order[(order.indexOf(cur) + 1) % order.length] || 1;
    try { g.setSpeed(next); } catch (e){}
  },

  onStartPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    var ctx = this._ctx || this.topContext();
    if (ctx.type === 'modal') return; /* resolve the modal first */
    if (ctx.type === 'screen'){
      if (ctx.id === 'screen-title'){ try { g.titleStart(); } catch (e){} }
      else if (ctx.id === 'screen-pause'){ try { g.togglePause(); } catch (e){} }
      else if (ctx.id === 'screen-end'){ try { g.endReplay(); } catch (e){} }
      else this.goBack(ctx.id);
      return;
    }
    if (ctx.type === 'panel'){
      try { if (g.ui) g.ui.closePanels(); g.clearSelection(); } catch (e){}
      this.clearFocus();
      return;
    }
    /* game world: pause menu toggle */
    try { g.togglePause(); } catch (e){}
  },

  onBackPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    if (this.worldInputOk()){
      /* IRA situation report, same as tapping the IRA line */
      try { g.iraReport(); } catch (e){}
      return;
    }
    this.onBPress();
  },

  onLSPress: function(){
    this.markPad();
    if (this.worldInputOk()){
      /* recenter the cursor */
      this._cursor.x = this.viewW() / 2;
      this._cursor.y = this.viewH() / 2;
      this._cursor.vx = 0; this._cursor.vy = 0;
    } else {
      this.focusFirst();
    }
  },

  onRSPress: function(){
    this.markPad();
    var g = this.game;
    if (!g) return;
    if (this.worldInputOk()){
      /* jump the camera back to the Command Spire */
      var hq = (g.lastSnap && g.lastSnap.hq) || null;
      if (hq && hq.x != null && typeof g.jumpCamera === 'function'){
        try { g.jumpCamera(hq.x, hq.z); } catch (e){}
      }
      return;
    }
    this.focusLast();
  },

  goBack: function(screenId){
    var g = this.game;
    if (!g) return;
    try {
      if (screenId === 'screen-howto' || screenId === 'screen-codex') g.howtoBack();
      else if (screenId === 'screen-levels' || screenId === 'screen-lobby') g.levelsBack();
      else if (screenId === 'screen-pause') g.togglePause();
      else if (screenId === 'screen-end') g.endSectors();
      /* screen-title and screen-disconnect: nothing sane to go back to */
    } catch (e){}
  },

  clickById: function(id){
    if (typeof document === 'undefined') return;
    var el = document.getElementById(id);
    if (el && typeof el.click === 'function'){
      try { el.click(); } catch (e){}
    }
  },

  /* ---------------- roving focus ---------------- */

  topContext: function(){
    var g = this.game;
    var ui = g ? g.ui : (NB.UI || null);
    var MODALS = (ui && ui.MODALS) || ['modal-event','modal-edict','modal-briefing','modal-debrief'];
    var PANELS = (ui && ui.PANELS) || ['panel-tower','panel-wall','panel-reactor','panel-spire','panel-wave'];
    var SCREENS = (ui && ui.SCREENS) || ['screen-loading','screen-title','screen-howto','screen-levels',
      'screen-lobby','screen-pause','screen-end','screen-codex','screen-disconnect'];
    var i, el;
    for (i = 0; i < MODALS.length; i++){
      el = this.byId(MODALS[i]);
      if (this.vis(el)) return { type: 'modal', id: MODALS[i] };
    }
    for (i = 0; i < PANELS.length; i++){
      el = this.byId(PANELS[i]);
      if (this.vis(el)) return { type: 'panel', id: PANELS[i] };
    }
    for (i = 0; i < SCREENS.length; i++){
      el = this.byId(SCREENS[i]);
      if (this.vis(el)) return { type: 'screen', id: SCREENS[i] };
    }
    return { type: 'game', id: 'game' };
  },

  byId: function(id){
    if (typeof document === 'undefined') return null;
    try { return document.getElementById(id); } catch (e){ return null; }
  },

  vis: function(el){
    if (!el) return false;
    var n = el;
    while (n){
      if (n.classList && n.classList.contains && n.classList.contains('hidden')) return false;
      n = n.parentNode;
    }
    return true;
  },

  qsa: function(sel){
    var out = [];
    if (typeof document === 'undefined' || !document.querySelectorAll) return out;
    var parts = String(sel).split(',');
    for (var i = 0; i < parts.length; i++){
      var s = parts[i].replace(/^\s+|\s+$/g, '');
      if (!s) continue;
      try {
        var nodes = document.querySelectorAll(s);
        for (var k = 0; k < nodes.length; k++) out.push(nodes[k]);
      } catch (e){}
    }
    return out;
  },

  buildFocusList: function(ctx){
    var list = [];
    function push(sel){
      var nodes = this.qsa(sel);
      for (var i = 0; i < nodes.length; i++){
        var n = nodes[i];
        if (this.vis(n) && !n.classList.contains('locked') && list.indexOf(n) < 0) list.push(n);
      }
    }
    push = push.bind(this);
    if (ctx.type === 'modal'){
      if (ctx.id === 'modal-event') push('#event-choices .choice-btn');
      else if (ctx.id === 'modal-edict') push('#edict-cards .edict-card');
      else if (ctx.id === 'modal-briefing') push('#modal-briefing .btn');
      else if (ctx.id === 'modal-debrief') push('#modal-debrief .btn');
    } else if (ctx.type === 'panel'){
      push('#' + ctx.id + ' .btn');
    } else if (ctx.type === 'screen'){
      if (ctx.id === 'screen-title') push('#screen-title .btn');
      else if (ctx.id === 'screen-howto') push('#screen-howto .btn');
      else if (ctx.id === 'screen-codex') push('#screen-codex .btn');
      else if (ctx.id === 'screen-levels'){ push('#level-grid .level-card'); push('#btn-levels-back'); }
      else if (ctx.id === 'screen-lobby'){
        push('#doctrine-cards .doctrine-card');
        push('#lobby-sectors .level-card');
        push('#btn-lobby-create, #btn-lobby-join, #btn-lobby-start, #btn-lobby-leave, #btn-lobby-back');
      }
      else if (ctx.id === 'screen-pause') push('#screen-pause .btn');
      else if (ctx.id === 'screen-end') push('#screen-end .btn');
      else if (ctx.id === 'screen-disconnect') push('#btn-dc-quit');
    } else {
      /* game world: build palette, then the HUD action buttons */
      push('#palette-grid .pal-btn');
      push('#btn-wave, #btn-start-quick, #speed-seg .seg-btn, #btn-pause, #btn-mute, #btn-menu');
    }
    return list;
  },

  syncFocus: function(){
    var ctx = this.topContext();
    var sig = ctx.type + ':' + ctx.id;
    if (sig !== this._ctxSig){
      this._ctx = ctx;
      this._ctxSig = sig;
      this._focusList = this.buildFocusList(ctx);
      /* modals, panels and screens land on their first actionable item */
      if (ctx.type !== 'game') this.setFocus(this._focusList[0] || null);
      else this.setFocus(null);
      return;
    }
    /* list contents can change under us (palette rebuild, vote re-render) */
    if (this._focusEl && !this.vis(this._focusEl)){
      this._focusList = this.buildFocusList(ctx);
      this.setFocus(this._focusList[0] || null);
    }
  },

  setFocus: function(el){
    if (this._focusEl === el) return;
    this._focusEl = el || null;
    this.refreshFocusClass();
  },

  clearFocus: function(){ this.setFocus(null); },

  refreshFocusClass: function(){
    var show = this.padActiveInput();
    if (this._focusEl){
      if (show){
        if (!this._focusEl.classList.contains('gamepad-focus')){
          try { this._focusEl.classList.add('gamepad-focus'); } catch (e){}
        }
      } else {
        try { this._focusEl.classList.remove('gamepad-focus'); } catch (e){}
      }
    }
  },

  moveFocus: function(dir){
    var list = this._focusList || [];
    if (!list.length){
      this._focusList = this.buildFocusList(this._ctx || this.topContext());
      list = this._focusList;
    }
    if (!list.length) return;
    var idx = list.indexOf(this._focusEl);
    if (idx < 0) idx = (dir > 0) ? 0 : list.length - 1;
    else idx = (idx + dir + list.length) % list.length;
    this.setFocus(list[idx]);
  },

  focusFirst: function(){
    var list = this._focusList || [];
    if (list.length) this.setFocus(list[0]);
  },

  focusLast: function(){
    var list = this._focusList || [];
    if (list.length) this.setFocus(list[list.length - 1]);
  },

  activateFocus: function(){
    var el = this._focusEl;
    if (!el){
      /* nothing focused: focus the first item so A always does something */
      var list = this._focusList || [];
      if (list.length){ this.setFocus(list[0]); el = list[0]; }
    }
    if (el && typeof el.click === 'function'){
      try { el.click(); } catch (e){}
    }
  },

  /* ---------------- badge / hints / cursor DOM ---------------- */

  showBadge: function(on){
    this.ensureDom();
    var b = this._els && this._els.badge;
    if (!b) return;
    try { b.classList.toggle('hidden', !on); } catch (e){}
  },

  hideHints: function(){
    var h = this._els && this._els.hints;
    if (!h) return;
    try { h.classList.add('hidden'); } catch (e){}
  },

  cursorVisible: function(){
    return this.padActiveInput() && this.worldInputOk() && !this._focusEl;
  },

  hideCursor: function(){
    var c = this._els && this._els.cursor;
    if (!c) return;
    try { c.classList.add('hidden'); } catch (e){}
  },

  updateCursorDom: function(){
    var c = this._els && this._els.cursor;
    if (!c) return;
    var show = this.cursorVisible();
    try {
      c.classList.toggle('hidden', !show);
      if (show){
        c.style.transform = 'translate(' + Math.round(this._cursor.x) + 'px,' +
          Math.round(this._cursor.y) + 'px)';
      }
    } catch (e){}
  },

  hintText: function(){
    var ctx = this._ctx || { type: 'game', id: 'game' };
    var g = this.game;
    if (ctx.type === 'modal'){
      if (ctx.id === 'modal-event' || ctx.id === 'modal-edict') return 'D-pad: choose    A: confirm';
      if (ctx.id === 'modal-briefing') return 'D-pad: choose    A: deploy    B: skip';
      if (ctx.id === 'modal-debrief') return 'A: continue    B: continue';
      return 'D-pad: choose    A: confirm';
    }
    if (ctx.type === 'panel') return 'D-pad: choose    A: confirm    B: close';
    if (ctx.type === 'screen'){
      if (ctx.id === 'screen-title') return 'D-pad: choose    A: confirm    Start: start';
      if (ctx.id === 'screen-pause') return 'D-pad: choose    A: confirm    B: resume    Start: resume';
      if (ctx.id === 'screen-end') return 'D-pad: choose    A: replay    B: sectors';
      if (ctx.id === 'screen-disconnect') return 'A: abandon    B: back';
      if (ctx.id === 'screen-levels') return 'D-pad: choose    A: play    B: back';
      if (ctx.id === 'screen-lobby') return 'D-pad: choose    A: confirm    B: back';
      return 'D-pad: choose    A: confirm    B: back';
    }
    /* game world */
    var mode = g && g.placeMode;
    if (mode && mode.kind === 'wall') return 'Hold A + move: draw wall    release: build    B: cancel    LB/RB: zoom';
    if (mode) return 'A: place    B: cancel    LB/RB: zoom    Y: speed';
    if (this._focusEl) return 'A: select    B: back    D-pad: move';
    return 'A: select    Y: speed    X: wave    Start: pause    LB/RB: zoom';
  },

  updateHints: function(){
    var h = this._els && this._els.hints;
    if (!h) return;
    var show = this.padActiveInput();
    try {
      if (show){
        h.textContent = this.hintText();
        h.classList.remove('hidden');
      } else {
        h.classList.add('hidden');
      }
    } catch (e){}
  }
};

NB.Gamepad = GP;

})();
