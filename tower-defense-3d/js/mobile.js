/* Nova Bastion 3D - mobile touch UI layer.
 *
 * NB.Mobile builds a mobile-native control surface additively on top of the
 * desktop game: a slim top strip (#m-hud), a bottom action bar (#m-bar), a
 * bottom sheet (#m-sheet) for the extended build menu and the tower
 * inspector, and a floating cancel-placement button (#m-cancel). All DOM is
 * created here so index.html keeps only the script/link tags.
 *
 * Nothing desktop is patched: the full #hud and #palette stay in the DOM
 * (ui.js updates them every frame; we mirror the values), and every action
 * goes through the same game methods the desktop UI uses (togglePlaceMode,
 * startWave, setSpeed, togglePause, upgradeSelected, sellSelected).
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function el(tag, cls, text){
  var d = document.createElement(tag);
  if (cls) d.className = cls;
  if (text != null) d.textContent = text;
  return d;
}

/* row-1 quick towers: the five most generally useful */
var QUICK_TOWERS = ['pulse','frost','arc','mortar','sniper'];
/* "More" sheet: the remaining towers, wall, econ buildings, barracks */
var MORE_ITEMS = [
  { kind:'tower', towerId:'chrono' },
  { kind:'tower', towerId:'mint' },
  { kind:'tower', towerId:'amplify' },
  { kind:'wall' },
  { kind:'reactor' },
  { kind:'extractor' },
  { kind:'hydro' },
  { kind:'hab' },
  { kind:'barracks' }
];
var SPEEDS = [1, 2, 3];

var KIND_LABEL = {
  wall:'Wall', reactor:'Reactor', extractor:'Extractor', hydro:'Hydroponics',
  hab:'Hab Module', barracks:'Barracks'
};
function kindCost(kind){
  var C = NB.CONFIG || {};
  if (kind === 'wall') return C.WALL_COST || 8;
  if (kind === 'reactor') return C.REACTOR_COST || 150;
  if (kind === 'extractor') return C.EXTRACTOR_COST || 100;
  if (kind === 'hydro') return C.HYDRO_COST || 80;
  if (kind === 'hab') return C.HAB_COST || 60;
  if (kind === 'barracks') return C.BARRACKS_COST || 250;
  return 0;
}

var Mobile = {
  active: false,
  _built: false,
  _sheet: null,          /* null | 'more' | 'tower' */
  _sheetTowerId: null,
  _rszT: null,
  _tickT: null,

  game: function(){ return NB.Game || null; },

  detect: function(){
    var touch = false;
    try { touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); } catch (e){}
    var minSide = Infinity;
    try { minSide = Math.min(screen.width, screen.height); } catch (e){}
    this.active = !!(touch && minSide < 820);
    try { document.body.classList.toggle('mobile-ui', this.active); } catch (e){}
    return this.active;
  },

  /* called once from NB.Game.init, after the desktop UI is built */
  init: function(){
    this.detect();
    if (!this._built){ this._build(); this._built = true; }
    var self = this;
    try {
      window.addEventListener('resize', function(){
        if (self._rszT) clearTimeout(self._rszT);
        self._rszT = setTimeout(function(){ self._rszT = null; self.detect(); }, 200);
      });
    } catch (e){}
    /* mirror loop: cheap 250ms cadence, no frame-rate cost */
    var self2 = this;
    try {
      if (this._tickT) clearInterval(this._tickT);
      this._tickT = setInterval(function(){ try { self2._tick(); } catch (e){} }, 250);
    } catch (e){}
    this._tick();
  },

  /* ---------------- DOM ---------------- */

  _build: function(){
    var g = this.game();
    var self = this;

    /* slim top strip: mirrors #hud-gold-v / #hud-wave-v / #hud-hq-v */
    var hud = el('div', null); hud.id = 'm-hud';
    hud.appendChild(el('span', 'm-ico gold', '\u25CF'));
    var gold = el('span', null, '0'); gold.id = 'm-gold'; hud.appendChild(gold);
    hud.appendChild(el('span', 'm-sep', '\u2022'));
    hud.appendChild(el('span', 'm-lab', 'Wave'));
    var wave = el('span', null, '-'); wave.id = 'm-wave'; hud.appendChild(wave);
    hud.appendChild(el('span', 'm-sep', '\u2022'));
    hud.appendChild(el('span', 'm-ico hq', '\u25C6'));
    var hq = el('span', null, ''); hq.id = 'm-hq'; hud.appendChild(hq);
    var inter = el('span', 'm-inter', ''); inter.id = 'm-inter'; hud.appendChild(inter);
    document.body.appendChild(hud);

    /* floating cancel-placement button */
    var cancel = el('button', 'hidden', '\u2715');
    cancel.id = 'm-cancel';
    cancel.setAttribute('aria-label', 'Cancel placement');
    cancel.addEventListener('click', function(){
      try { if (g) g.cancelPlaceMode(); } catch (e){}
      self._sync();
    });
    document.body.appendChild(cancel);

    /* bottom action bar */
    var bar = el('div', null); bar.id = 'm-bar';
    var row1 = el('div', 'm-row');
    for (var i = 0; i < QUICK_TOWERS.length; i++) row1.appendChild(this._towerBtn(QUICK_TOWERS[i]));
    var more = el('button', 'm-btn more', 'More');
    more.id = 'm-more';
    more.addEventListener('click', function(){ self._openMore(); });
    row1.appendChild(more);
    var row2 = el('div', 'm-row');
    var start = el('button', 'm-btn primary', 'Start Wave');
    start.id = 'm-start';
    start.addEventListener('click', function(){ try { if (g) g.startWave(); } catch (e){} });
    var speed = el('button', 'm-btn', '1x');
    speed.id = 'm-speed';
    speed.addEventListener('click', function(){ self._cycleSpeed(); });
    var pause = el('button', 'm-btn', '\u275A\u275A');
    pause.id = 'm-pause';
    pause.setAttribute('aria-label', 'Pause');
    pause.addEventListener('click', function(){ try { if (g) g.togglePause(); } catch (e){} });
    row2.appendChild(start); row2.appendChild(speed); row2.appendChild(pause);
    bar.appendChild(row1); bar.appendChild(row2);
    document.body.appendChild(bar);

    /* bottom sheet + backdrop */
    var bd = el('div', 'hidden', null); bd.id = 'm-sheet-backdrop';
    bd.addEventListener('click', function(){ self._closeSheet(); });
    document.body.appendChild(bd);
    var sheet = el('div', null); sheet.id = 'm-sheet';
    var handle = el('div', null); handle.id = 'm-sheet-handle'; sheet.appendChild(handle);
    var head = el('div', null); head.id = 'm-sheet-head';
    var title = el('div', null, ''); title.id = 'm-sheet-title'; head.appendChild(title);
    var close = el('button', null, '\u2715'); close.id = 'm-sheet-close';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', function(){ self._closeSheet(); });
    head.appendChild(close);
    sheet.appendChild(head);
    var body = el('div', null); body.id = 'm-sheet-body'; sheet.appendChild(body);
    document.body.appendChild(sheet);
  },

  _towerBtn: function(tid){
    var g = this.game();
    var def = (NB.TOWERS || {})[tid] || {};
    var b = el('button', 'm-btn m-tower', def.name || tid);
    b.setAttribute('data-tower', tid);
    var cost = el('span', 'cost', (def.cost != null ? def.cost + 'g' : ''));
    b.appendChild(cost);
    b.addEventListener('click', (function(t){
      return function(){
        try { if (g) g.togglePlaceMode('tower', t); } catch (e){}
      };
    })(tid));
    return b;
  },

  _buildBtn: function(item){
    var g = this.game();
    var self = this;
    var label, cost;
    if (item.kind === 'tower'){
      var def = (NB.TOWERS || {})[item.towerId] || {};
      label = def.name || item.towerId;
      cost = (def.cost != null ? def.cost + 'g' : '');
    } else {
      label = KIND_LABEL[item.kind] || item.kind;
      cost = kindCost(item.kind) + 'g';
    }
    var b = el('button', 'm-btn', label);
    var c = el('span', 'cost', cost);
    b.appendChild(c);
    b.addEventListener('click', (function(it){
      return function(){
        try {
          if (g) g.togglePlaceMode(it.kind, it.towerId || null);
        } catch (e){}
        self._closeSheet();
      };
    })(item));
    return b;
  },

  /* ---------------- sheet ---------------- */

  _openSheet: function(kind, title){
    this._sheet = kind;
    $('m-sheet-title').textContent = title;
    $('m-sheet').classList.add('open');
    $('m-sheet-backdrop').classList.remove('hidden');
  },

  _closeSheet: function(){
    this._sheet = null;
    this._sheetTowerId = null;
    try {
      $('m-sheet').classList.remove('open');
      $('m-sheet-backdrop').classList.add('hidden');
    } catch (e){}
  },

  _openMore: function(){
    if (this._sheet === 'more'){ this._closeSheet(); return; }
    var body = $('m-sheet-body');
    body.innerHTML = '';
    var grid = el('div', 'm-grid');
    for (var i = 0; i < MORE_ITEMS.length; i++) grid.appendChild(this._buildBtn(MORE_ITEMS[i]));
    body.appendChild(grid);
    this._openSheet('more', 'Build');
  },

  _openTowerInspector: function(){
    var g = this.game();
    if (!g || !g.ui) return;
    var sel = g.selection;
    if (!sel || sel.kind !== 'tower') return;
    var t = g.ui.findTower(sel.id);
    if (!t){ this._closeSheet(); return; }
    var def = (NB.TOWERS || {})[t.id] || {};
    /* reuse the desktop panel logic for costs/disabled states, then mirror
       the results into the big mobile buttons */
    try { g.ui.refreshTowerPanel(); } catch (e){}
    this._sheetTowerId = sel.id;

    var body = $('m-sheet-body');
    body.innerHTML = '';
    var stats = el('div', 'insp-stats');
    stats.innerHTML = '<span>Tier</span><b>' + esc(t.tier + (t.branch ? ' + ' + String(t.branch).toUpperCase() : '')) + '</b>' +
      '<span>HP</span><b>' + esc(t.hp + '/' + t.maxHp) + '</b>';
    var live = null;
    try { live = g.towerLiveStats ? g.towerLiveStats(t.instId) : null; } catch (e){}
    if (t.range) stats.innerHTML += '<span>Range</span><b>' + esc((Math.round(t.range * 10) / 10) + 'm') + '</b>';
    if (live && live.damage && live.fireRate){
      stats.innerHTML += '<span>DPS</span><b>' + esc(String(Math.round(live.damage * live.fireRate * 10) / 10)) + '</b>';
    }
    body.appendChild(stats);

    var actions = el('div', 'insp-actions');
    var upgSrc = $('btn-upgrade'), rowSrc = $('branch-row');
    var self = this;
    if (upgSrc && upgSrc.style.display !== 'none'){
      var upg = el('button', 'm-btn primary', upgSrc.textContent || 'Upgrade');
      upg.disabled = !!upgSrc.disabled;
      upg.addEventListener('click', function(){
        try { g.upgradeSelected(); } catch (e){}
        self._openTowerInspector(); /* refresh costs/states */
      });
      actions.appendChild(upg);
    } else if (rowSrc && !rowSrc.classList.contains('hidden')){
      var branches = el('div', 'branch-row');
      var ba = $('btn-branch-a'), bb = $('btn-branch-b');
      if (ba){
        var bA = el('button', 'm-btn', '');
        bA.innerHTML = ba.innerHTML;
        bA.disabled = !!ba.disabled;
        bA.addEventListener('click', function(){ try { g.branchSelected('a'); } catch (e){} self._openTowerInspector(); });
        branches.appendChild(bA);
      }
      if (bb){
        var bB = el('button', 'm-btn', '');
        bB.innerHTML = bb.innerHTML;
        bB.disabled = !!bb.disabled;
        bB.addEventListener('click', function(){ try { g.branchSelected('b'); } catch (e){} self._openTowerInspector(); });
        branches.appendChild(bB);
      }
      body.appendChild(branches);
    }
    var sell = el('button', 'm-btn danger', 'Sell');
    sell.addEventListener('click', function(){
      try { g.sellSelected(); } catch (e){}
      /* the desktop confirm modal appears; the sheet closes on sell */
      self._closeSheet();
    });
    actions.appendChild(sell);
    body.appendChild(actions);

    this._openSheet('tower', t.name || def.name || t.id);
  },

  _cycleSpeed: function(){
    var g = this.game();
    if (!g) return;
    var cur = 1;
    try { cur = (g.lastSnap && g.lastSnap.speed) || 1; } catch (e){}
    var idx = SPEEDS.indexOf(cur);
    var next = SPEEDS[(idx + 1) % SPEEDS.length];
    try { g.setSpeed(next); } catch (e){}
  },

  /* ---------------- mirror loop ---------------- */

  _copy: function(srcId, dstId){
    try {
      var s = $(srcId), d = $(dstId);
      if (s && d && d.textContent !== s.textContent) d.textContent = s.textContent;
    } catch (e){}
  },

  _tick: function(){
    if (!this.active) return;
    var g = this.game();
    /* mirror the desktop HUD values into the slim strip */
    this._copy('hud-gold-v', 'm-gold');
    this._copy('hud-wave-v', 'm-wave');
    this._copy('hud-hq-v', 'm-hq');
    this._copy('hud-inter-v', 'm-inter');

    var snap = g ? g.lastSnap : null;
    var speed = (snap && snap.speed) || 1;
    var spBtn = $('m-speed');
    if (spBtn){
      var lbl = speed + 'x';
      if (spBtn.textContent !== lbl) spBtn.textContent = lbl;
    }
    var pauseBtn = $('m-pause');
    if (pauseBtn){
      var pl = (snap && snap.paused) ? '\u25B6' : '\u275A\u275A';
      if (pauseBtn.textContent !== pl) pauseBtn.textContent = pl;
    }
    var startBtn = $('m-start');
    if (startBtn && snap){
      var canStart = !snap.waveActive && !snap.over && !snap.paused &&
                     !snap.pendingEvent && !snap.pendingEdict &&
                     snap.waveIndex < snap.wavesTotal;
      if (startBtn.disabled === canStart) startBtn.disabled = !canStart;
    }

    /* active place-mode highlighting + cancel button */
    var mode = g ? g.placeMode : null;
    var kids = document.querySelectorAll('#m-bar .m-tower');
    for (var i = 0; i < kids.length; i++){
      var on = !!(mode && mode.kind === 'tower' && mode.towerId === kids[i].getAttribute('data-tower'));
      kids[i].classList.toggle('active', on);
    }
    var moreBtn = $('m-more');
    if (moreBtn) moreBtn.classList.toggle('active', !!(mode && mode.kind !== 'tower'));
    var cancelBtn = $('m-cancel');
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !mode);

    /* tower selection drives the inspector sheet */
    var sel = g ? g.selection : null;
    if (sel && sel.kind === 'tower'){
      if (this._sheet !== 'tower' || this._sheetTowerId !== sel.id) this._openTowerInspector();
    } else if (this._sheet === 'tower'){
      /* tapping empty ground clears the selection: close the inspector */
      this._closeSheet();
    }
  },

  _sync: function(){ try { this._tick(); } catch (e){} }
};

NB.Mobile = Mobile;
/* shorter wave-to-wave pacing on phones; read by sim.js at both
   intermission assignment points (falls back to CONFIG when absent) */
NB.mobileIntermissionSecs = function(){
  return (NB.Mobile && NB.Mobile.active) ? 12 : null;
};

})();
