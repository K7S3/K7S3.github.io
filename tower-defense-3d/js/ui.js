/* Nova Bastion 3D - DOM UI layer.
 *
 * NB.UI owns every screen, panel, modal, toast and the HUD. It reads game
 * state through the controller (game.sim / game.snapshot / NB.TOWERS) and
 * never touches WebGL internals. Tower display names always come from
 * NB.TOWERS[id].name; nothing is hardcoded.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

var SAVE_KEY = 'nova_bastion_3d_v1';
var TOWER_ORDER = ['pulse','frost','arc','mortar','sniper','chrono','mint','amplify'];
var PLAYER_COLORS = ['#7df9ff','#ffb347','#4ade80','#ff5a36','#c084fc','#f472b6'];

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

var UI = {
  game: null,
  save: { stars:{}, unlocked:1, codex:[], iraMuted:false },
  lobbyDoctrine: 'vanguard',
  lobbySectorIdx: 0,
  _bannerT: 0,
  _iraT: 0,

  /* ---------------- save ---------------- */

  loadSave: function(){
    var s = { stars:{}, unlocked:1, codex:[], iraMuted:false, brightness:1, quality:'auto' };
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw){
        var p = JSON.parse(raw);
        if (p && typeof p === 'object'){
          if (p.stars && typeof p.stars === 'object') s.stars = p.stars;
          if (typeof p.unlocked === 'number' && p.unlocked >= 1) s.unlocked = Math.floor(p.unlocked);
          if (Array.isArray(p.codex)) s.codex = p.codex.filter(function(x){ return typeof x === 'string'; });
          if (typeof p.iraMuted === 'boolean') s.iraMuted = p.iraMuted;
          if (typeof p.brightness === 'number' && isFinite(p.brightness)) s.brightness = Math.max(0.55, Math.min(1.8, p.brightness));
          if (typeof p.quality === 'string' && /^(auto|high|medium|low)$/.test(p.quality)) s.quality = p.quality;
        }
      }
    } catch (e){}
    var n = (NB.SECTORS || []).length || 5;
    s.unlocked = Math.max(1, Math.min(n, s.unlocked));
    this.save = s;
  },

  persist: function(){
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e){}
  },

  recordVictory: function(levelId, stars, levelIndex){
    var prev = this.save.stars[levelId] || 0;
    if (stars > prev) this.save.stars[levelId] = stars;
    var n = (NB.SECTORS || []).length || 5;
    var want = Math.min(n, (levelIndex | 0) + 2);
    if (want > this.save.unlocked) this.save.unlocked = want;
    this.persist();
    this.buildLevels();
    /* a sector victory marks the player as a veteran: no more tutorial hints */
    try { localStorage.setItem('nb_veteran', '1'); } catch (e){}
  },

  unlockCodex: function(ids){
    var changed = false;
    for (var i = 0; i < ids.length; i++){
      if (this.save.codex.indexOf(ids[i]) < 0){ this.save.codex.push(ids[i]); changed = true; }
    }
    if (changed) this.persist();
  },

  /* ---------------- boot ---------------- */

  init: function(game){
    this.game = game;
    this.loadSave();
    this.buildHowto();
    this.buildLevels();
    this.buildDoctrineCards();
    this.setIRAMuted(!!this.save.iraMuted);
    this.wireButtons();
    this.setMuteIcon(false);
    /* brightness slider reflects the saved value; applied once the renderer exists */
    var rng = $('rng-bright');
    if (rng) rng.value = Math.round((this.save.brightness || 1) * 100);
  },

  /* ---------------- screens ---------------- */

  SCREENS: ['screen-loading','screen-title','screen-howto','screen-levels',
            'screen-lobby','screen-pause','screen-end','screen-codex','screen-disconnect'],

  show: function(id){
    for (var i = 0; i < this.SCREENS.length; i++){
      var e = $(this.SCREENS[i]);
      if (e) e.classList.toggle('hidden', this.SCREENS[i] !== id);
    }
    var inGame = (id === null);
    var hud = $('hud'), pal = $('palette'), ira = $('ira-line');
    if (hud) hud.classList.toggle('hidden', !inGame);
    if (pal) pal.classList.toggle('hidden', !inGame);
    if (ira && !inGame) ira.classList.add('hidden');
    var rw = $('rotate-widget');
    if (rw) rw.classList.toggle('hidden', !inGame);
    if (inGame) this.updateAutoplayBtn(this.game && this.game.autoplay);
    else {
      var ab = $('autoplay-banner');
      if (ab) ab.classList.add('hidden');
    }
    if (!inGame){ this.closePanels(); this.hideModals(); }
  },

  anyScreenOpen: function(){
    for (var i = 0; i < this.SCREENS.length; i++){
      var e = $(this.SCREENS[i]);
      if (e && !e.classList.contains('hidden')) return true;
    }
    return false;
  },

  MODALS: ['modal-event','modal-edict','modal-briefing','modal-debrief','modal-confirm'],

  anyModalOpen: function(){
    for (var i = 0; i < this.MODALS.length; i++){
      var e = $(this.MODALS[i]);
      if (e && !e.classList.contains('hidden')) return true;
    }
    return false;
  },

  hideModals: function(){
    for (var i = 0; i < this.MODALS.length; i++){
      var e = $(this.MODALS[i]);
      if (e) e.classList.add('hidden');
    }
  },

  updateTitleButton: function(){
    var b = $('btn-title-start');
    if (!b) return;
    var s = this.save;
    b.textContent = (s.unlocked > 1 || Object.keys(s.stars || {}).length > 0) ? 'Continue' : 'Start';
  },

  /* ---------------- toasts & banners ---------------- */

  toast: function(title, sub, color){
    var wrap = $('toast-wrap');
    if (!wrap) return;
    while (wrap.children.length >= 4 && wrap.firstChild) wrap.removeChild(wrap.firstChild);
    var d = el('div', 'toast');
    if (color) d.style.borderColor = color;
    var t = el('div', null, title || '');
    if (color) t.style.color = color;
    d.appendChild(t);
    if (sub) d.appendChild(el('div', 'sub', sub));
    wrap.appendChild(d);
    setTimeout(function(){
      d.classList.add('out');
      setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 450);
    }, 3000);
  },

  banner: function(title, sub, color, ms){
    var b = $('banner');
    if (!b) return;
    $('banner-title').textContent = title || '';
    $('banner-sub').textContent = sub || '';
    b.style.color = color || '#22d3ee';
    b.classList.remove('hidden');
    void b.offsetWidth;
    b.classList.add('show');
    var self = this;
    if (this._bannerT) clearTimeout(this._bannerT);
    this._bannerT = setTimeout(function(){
      b.classList.remove('show');
      setTimeout(function(){ b.classList.add('hidden'); }, 400);
    }, ms || 2200);
  },

  /* ---------------- autoplay toggle + slim banner ---------------- */

  updateAutoplayBtn: function(on){
    on = !!on;
    var g = this.game;
    var b = $('btn-autoplay');
    if (b){
      var guest = !!(g && g.netMode === 'guest');
      b.classList.toggle('hidden', guest);
      b.classList.toggle('autoplay-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    var ban = $('autoplay-banner');
    if (ban){
      var show = on && !(g && g.netMode === 'guest') && !!(g && g.mode === 'game');
      ban.classList.toggle('hidden', !show);
    }
  },

  /* ---------------- generic confirm modal ---------------- */

  _confirmCb: null,

  showConfirm: function(title, body, okLabel, onOk){
    var t = $('confirm-title'), bo = $('confirm-body'), ok = $('btn-confirm-ok');
    if (t) t.textContent = title || 'Confirm';
    if (bo) bo.textContent = body || '';
    if (ok) ok.textContent = okLabel || 'Confirm';
    this._confirmCb = (typeof onOk === 'function') ? onOk : null;
    var m = $('modal-confirm');
    if (m) m.classList.remove('hidden');
  },

  /* ---------------- IRA line ---------------- */

  setIRA: function(text){
    var line = $('ira-line');
    if (!line) return;
    if (text){
      $('ira-text').textContent = text;
      line.classList.remove('hidden');
      var self = this;
      if (this._iraT) clearTimeout(this._iraT);
      var ttl = (NB.IRA && NB.IRA.LINE_TTL_MS) || 6000;
      this._iraT = setTimeout(function(){ line.classList.add('hidden'); }, ttl);
    } else {
      line.classList.add('hidden');
    }
  },

  setIRAMuted: function(m){
    if (NB.IRA) NB.IRA.muted = !!m;
    this.save.iraMuted = !!m;
    this.persist();
    var b = $('btn-pause-ira');
    if (b) b.textContent = 'IRA Voice: ' + (m ? 'Off' : 'On');
    if (m) this.setIRA(null);
  },

  /* display brightness: persisted, applied to the 3D renderer */
  setBrightness: function(v, fromSlider){
    v = Math.max(0.55, Math.min(1.8, (typeof v === 'number' && isFinite(v)) ? v : 1));
    this.save.brightness = v;
    this.persist();
    var r = this.game && this.game.renderer;
    if (r && typeof r.setBrightness === 'function'){
      try { r.setBrightness(v); } catch (e){}
    }
    if (!fromSlider){
      var el = $('rng-bright');
      if (el) el.value = Math.round(v * 100);
    }
  },
  applyBrightness: function(){
    this.setBrightness(this.save.brightness || 1);
  },

  /* graphics quality: 'auto' lets the FPS governor drive the tiers,
     otherwise the chosen tier is locked. Persisted like brightness. */
  setQuality: function(q){
    q = /^(auto|high|medium|low)$/.test(q) ? q : 'auto';
    this.save.quality = q;
    this.persist();
    var r = this.game && this.game.renderer;
    if (r && typeof r.perfSetManual === 'function'){
      try { r.perfSetManual(q); } catch (e){}
    }
    var el = $('sel-quality');
    if (el && el.value !== q) el.value = q;
  },

  /* ---------------- HUD ---------------- */

  moraleColor: function(state){
    return { inspired:'#ffb347', steady:'#7df9ff', despair:'#ff9f43', unrest:'#ff5a36' }[state] || '#7df9ff';
  },

  updateHUD: function(snap){
    var g = this.game;
    if (!g || !snap) return;
    $('hud-gold-v').textContent = Math.floor(snap.gold);
    $('hud-energy-v').textContent = (snap.energyUsed | 0) + '/' + (snap.energyCap | 0);
    /* colony resources */
    var mv = $('hud-metal-v');
    if (mv){
      mv.textContent = Math.floor(snap.metal || 0);
      var mr = $('hud-metal-r');
      if (mr) mr.textContent = '+' + (snap.metalRate || 0).toFixed(1) + '/s';
    }
    var fv = $('hud-food-v');
    if (fv){
      fv.textContent = Math.floor(snap.food || 0);
      var fr = $('hud-food-r');
      if (fr){
        var frr = snap.foodRate || 0;
        fr.textContent = (frr >= 0 ? '+' : '') + frr.toFixed(1) + '/s';
        fr.style.color = snap.starving ? '#ff5a36' : (frr < 0 ? '#ff9f43' : '');
      }
    }
    var pv = $('hud-pop-v');
    if (pv){
      var pop = snap.pop || {};
      pv.textContent = (pop.total || 0) + '/' + (pop.cap || 0);
      var pw = $('hud-pop-wrap');
      if (pw) pw.style.borderColor = snap.starving ? '#ff5a36' : '';
    }
    /* army: fielded / cap, upkeep eats into the food rate */
    var av = $('hud-army-v');
    if (av){
      var fielded = (snap.troops || []).length + (snap.training || []).length;
      av.textContent = fielded + '/' + (snap.troopCap || 6);
      var armyUp = snap.troopUpkeep || 0;
      var aw = $('hud-army-wrap');
      if (aw) aw.title = 'Army (tap for army panel)' +
        (armyUp > 0 ? ' - upkeep ' + armyUp.toFixed(2) + ' food/s' : '');
    }
    var hqFrac = snap.hqMaxHp > 0 ? snap.hqHp / snap.hqMaxHp : 0;
    $('hud-hq-v').textContent = snap.hqHp + '/' + snap.hqMaxHp;
    $('hud-hq-fill').style.width = Math.max(0, Math.min(100, hqFrac * 100)) + '%';
    $('hud-hq-fill').style.background = hqFrac > 0.5 ? '' : (hqFrac > 0.25 ? '#ff9f43' : '#ff5a36');
    var mState = snap.moraleState || 'steady';
    $('hud-morale-v').textContent = Math.round(snap.morale);
    $('hud-morale-fill').style.width = Math.max(0, Math.min(100, snap.morale)) + '%';
    $('hud-morale-fill').style.background = this.moraleColor(mState);
    var msEl = $('hud-morale-state');
    msEl.textContent = mState;
    msEl.className = 'morale-state ' + mState;

    var wv = Math.min(snap.waveIndex + 1, snap.wavesTotal);
    $('hud-wave-v').textContent = snap.wavesTotal ? (wv + '/' + snap.wavesTotal) : '-';
    $('hud-inter-v').textContent = (!snap.waveActive && !snap.over && snap.waveIndex < snap.wavesTotal)
      ? ('next in ' + snap.intermission + 's') : '';

    /* surge banner + flicker */
    var surge = snap.surge || {};
    var sb = $('surge-banner'), app = $('app');
    if (surge.warningIn > 0 && !snap.waveActive && !snap.over){
      sb.textContent = 'BLACKOUT SURGE INCOMING: ' + Math.ceil(surge.warningIn) + 's';
      sb.classList.remove('hidden');
    } else if (surge.active){
      sb.textContent = 'BLACKOUT SURGE ACTIVE';
      sb.classList.remove('hidden');
    } else {
      sb.classList.add('hidden');
    }
    var flick = !!surge.active;
    $('hud').classList.toggle('surge-flicker', flick);
    if (app) app.classList.toggle('surge-active', flick);
    if (g.renderer && typeof g.renderer.setSurge === 'function'){
      try { g.renderer.setSurge(!!surge.active, surge.active ? 1 : 0); }
      catch (e){}
    } else if (g.renderer && typeof g.renderer.setStorm === 'function'){
      try { g.renderer.setStorm(!!surge.active); } catch (e){}
    }

    /* speed segment */
    var btns = $('speed-seg').querySelectorAll('.seg-btn');
    for (var i = 0; i < btns.length; i++){
      btns[i].classList.toggle('active', Number(btns[i].getAttribute('data-speed')) === snap.speed);
    }

    /* quick start */
    var quick = $('btn-start-quick');
    var showQuick = !snap.waveActive && !snap.over && !snap.paused &&
                    !snap.pendingEvent && !snap.pendingEdict &&
                    snap.waveIndex < snap.wavesTotal && !this.anyScreenOpen() && !this.anyModalOpen();
    quick.classList.toggle('hidden', !showQuick);
    if (showQuick) quick.textContent = 'Start ' + (snap.waveIndex + 1);

    $('btn-pause').innerHTML = snap.paused ? '&#9654;' : '&#10074;&#10074;';

    /* net status */
    var netV = $('hud-net-v');
    if (netV) netV.textContent = g.netMode === 'guest' ? 'GUEST LINK'
      : (g.netMode === 'host' ? 'HOSTING' : '');

    /* palette states */
    var mode = g.placeMode;
    var kids = $('palette-grid').children;
    for (var k = 0; k < kids.length; k++){
      (function(btn){
        var kind = btn.getAttribute('data-kind');
        var active = false, cant = false;
        if (kind === 'tower'){
          var tid = btn.getAttribute('data-tower');
          active = !!(mode && mode.kind === 'tower' && mode.towerId === tid);
          var def = (NB.TOWERS || {})[tid];
          cant = snap.gold < (def ? def.cost || 0 : 0);
          if ((snap.availableTowers || []).indexOf(tid) < 0) cant = true;
        } else if (kind === 'wall'){
          active = !!(mode && mode.kind === 'wall');
          cant = snap.gold < ((NB.CONFIG && NB.CONFIG.WALL_COST) || 8);
        } else if (kind === 'reactor'){
          active = !!(mode && mode.kind === 'reactor');
          cant = snap.gold < ((NB.CONFIG && NB.CONFIG.REACTOR_COST) || 150);
        } else if (kind === 'extractor'){
          active = !!(mode && mode.kind === 'extractor');
          cant = snap.gold < ((NB.CONFIG && NB.CONFIG.EXTRACTOR_COST) || 100);
        } else if (kind === 'hydro'){
          active = !!(mode && mode.kind === 'hydro');
          cant = snap.gold < ((NB.CONFIG && NB.CONFIG.HYDRO_COST) || 80);
        } else if (kind === 'hab'){
          active = !!(mode && mode.kind === 'hab');
          cant = snap.gold < ((NB.CONFIG && NB.CONFIG.HAB_COST) || 60);
        } else if (kind === 'barracks'){
          active = !!(mode && mode.kind === 'barracks');
          cant = snap.gold < ((NB.CONFIG && NB.CONFIG.BARRACKS_COST) || 250) ||
                 snap.metal < ((NB.CONFIG && NB.CONFIG.BARRACKS_METAL) || 15);
        } else if (kind === 'colony'){
          active = !$('panel-pop').classList.contains('hidden');
        } else if (kind === 'sell'){
          active = !!(mode && mode.kind === 'sell');
        } else if (kind === 'spire'){
          active = false;
        }
        btn.classList.toggle('active', active);
        btn.classList.toggle('cant', cant);
      })(kids[k]);
    }

    /* placement hint */
    var hint = $('place-hint');
    if (mode){
      var label = mode.kind === 'tower' ? (((NB.TOWERS || {})[mode.towerId] || {}).name || mode.towerId)
        : mode.kind === 'wall' ? 'Wall (drag to draw)'
        : mode.kind === 'reactor' ? 'Reactor'
        : mode.kind === 'extractor' ? 'Extractor (near a scrap node)'
        : mode.kind === 'hydro' ? 'Hydroponics Bay'
        : mode.kind === 'hab' ? 'Hab Module'
        : mode.kind === 'barracks' ? 'Barracks (+6 troop cap)'
        : mode.kind === 'rally' ? 'Rally point: tap the battlefield'
        : mode.kind === 'sell' ? 'Sell mode: click a structure' : mode.kind;
      hint.innerHTML = '';
      hint.appendChild(el('span', null, 'Placing ' + label + ' - click the battlefield. '));
      hint.appendChild(el('span', 'cancel', 'Right-click / Esc to cancel'));
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }

    /* live panel refresh */
    if (g.selection){
      if (g.selection.kind === 'tower' && !$('panel-tower').classList.contains('hidden')) this.refreshTowerPanel();
      if (g.selection.kind === 'wall' && !$('panel-wall').classList.contains('hidden')) this.refreshWallPanel();
      if (g.selection.kind === 'reactor' && !$('panel-reactor').classList.contains('hidden')) this.refreshReactorPanel();
      if (g.selection.kind === 'troop' && !$('panel-troop').classList.contains('hidden')) this.refreshTroopPanel();
      if (g.selection.kind === 'barracks' && !$('panel-barracks').classList.contains('hidden')) this.refreshBarracksPanel();
    }
    if (!$('panel-spire').classList.contains('hidden')) this.refreshSpirePanel();
    if (!$('panel-wave').classList.contains('hidden')) this.openWave();
    if (!$('panel-pop').classList.contains('hidden')) this.refreshPopPanel();
    if (!$('panel-army').classList.contains('hidden')) this.refreshArmyPanel();
  },

  setMuteIcon: function(muted){
    var b = $('btn-mute');
    if (b) b.innerHTML = muted ? '&#215;' : '&#9834;';
  },

  /* ---------------- palette ---------------- */

  buildPalette: function(){
    var grid = $('palette-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var self = this;
    function btn(kind, towerId, dotColor, name, cost, title, tool){
      var b = el('button', 'pal-btn' + (tool ? ' tool' : ''));
      b.type = 'button';
      b.setAttribute('data-kind', kind);
      if (towerId) b.setAttribute('data-tower', towerId);
      b.title = title || name;
      var dot = el('span', 'dot');
      dot.style.color = dotColor;
      dot.style.background = dotColor;
      b.appendChild(dot);
      b.appendChild(el('span', null, name));
      if (cost != null) b.appendChild(el('span', 'cost', cost + 'g'));
      b.addEventListener('click', function(){ self.game.togglePlaceMode(kind, towerId); });
      grid.appendChild(b);
      return b;
    }
    for (var i = 0; i < TOWER_ORDER.length; i++){
      (function(tid){
        var def = NB.TOWERS[tid];
        if (!def) return;
        btn('tower', tid, def.color || '#fff', def.name || tid, def.cost || 0,
            (def.name || tid) + ' - ' + (def.tag || '') + '. ' + (def.desc || ''));
      })(TOWER_ORDER[i]);
    }
    var CFG = NB.CONFIG || {};
    btn('wall', null, '#9a8a66', 'Wall', CFG.WALL_COST || 8, 'Drag on the battlefield to draw walls.');
    btn('reactor', null, '#facc15', 'Reactor', CFG.REACTOR_COST || 150, 'Adds energy capacity.');
    btn('extractor', null, '#c47a3a', 'Extractor', CFG.EXTRACTOR_COST || 100,
        'Mining rig. Build within 3 cells of a scrap node; staff with laborers for metal.');
    btn('hydro', null, '#4ade80', 'Hydroponics', CFG.HYDRO_COST || 80,
        'Food farm. Staff with laborers to feed the colony.');
    btn('hab', null, '#a78bfa', 'Hab', CFG.HAB_COST || 60,
        'Housing. +8 population cap per module.');
    btn('barracks', null, '#a3e635', 'Barracks', CFG.BARRACKS_COST || 250,
        'Muster hall. Trains Riflemen and Breachers, +6 troop cap each. ' +
        'Costs ' + (CFG.BARRACKS_METAL || 15) + ' metal.');
    var col = btn('colony', null, '#7df9ff', 'Colony', null, 'Population, classes, and the ranger program.', true);
    col.addEventListener('click', function(){ self.openPop(); }, true);
    btn('sell', null, '#ff5a36', 'Sell', null, 'Click a structure to sell it.', true);
    var sp = btn('spire', null, '#22d3ee', 'Spire', null, 'Command Spire: uplink, overclock, upgrades.', true);
    sp.addEventListener('click', function(){ self.openSpire(); }, true);
  },

  /* ---------------- panels ---------------- */

  PANELS: ['panel-tower','panel-wall','panel-reactor','panel-spire','panel-wave','panel-pop','panel-troop','panel-barracks','panel-army'],

  closePanels: function(){
    for (var i = 0; i < this.PANELS.length; i++){
      var e = $(this.PANELS[i]);
      if (e) e.classList.add('hidden');
    }
  },

  openPanel: function(id){
    for (var i = 0; i < this.PANELS.length; i++){
      var e = $(this.PANELS[i]);
      if (e) e.classList.toggle('hidden', this.PANELS[i] !== id);
    }
  },

  findTower: function(instId){
    var snap = this.game && this.game.lastSnap;
    var list = (snap && snap.towers) || [];
    for (var i = 0; i < list.length; i++) if (list[i].instId === instId) return list[i];
    return null;
  },
  findWall: function(id){
    var snap = this.game && this.game.lastSnap;
    var list = (snap && snap.walls) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },
  findReactor: function(instId){
    var snap = this.game && this.game.lastSnap;
    var list = (snap && snap.reactors) || [];
    for (var i = 0; i < list.length; i++) if (list[i].instId === instId) return list[i];
    return null;
  },

  openTower: function(ref){
    this.game.selection = { kind:'tower', id: ref.instId, ref: ref };
    this.refreshTowerPanel();
    this.openPanel('panel-tower');
  },

  statHtml: function(label, value){
    return '<div class="stat"><b>' + esc(label) + '</b>' + esc(value) + '</div>';
  },

  refreshTowerPanel: function(){
    var sel = this.game.selection;
    var t = sel && sel.kind === 'tower' ? this.findTower(sel.id) : null;
    if (!t){ this.closePanels(); this.game.selection = null; return; }
    var def = (NB.TOWERS || {})[t.id] || {};
    var snap = this.game.lastSnap || {};
    var gold = snap.gold || 0;
    $('tower-name').textContent = t.name || def.name || t.id;
    $('tower-tag').textContent = def.tag || '';
    $('tower-desc').textContent = def.desc || '';
    var pips = '';
    for (var i = 1; i <= 3; i++) pips += '<span class="pip' + (i <= t.tier ? ' on' : '') + '"></span>';
    if (t.branch) pips += '<span class="pip branch"></span>';
    $('tower-tier').innerHTML = pips;

    var badges = '';
    if (t.dark) badges += '<span class="badge dark">DARK / OFFLINE</span>';
    else if (t.powered === false) badges += '<span class="badge dark">UNPOWERED</span>';
    if (t.veteran >= 2) badges += '<span class="badge vet">ELITE VETERAN</span>';
    else if (t.veteran >= 1) badges += '<span class="badge vet">VETERAN</span>';
    if (t.highGround) badges += '<span class="hg-badge">HIGH GROUND +15% range</span>';
    if (t.branch){
      var bd = ((def.branch || {})[t.branch]) || {};
      badges += '<span class="badge buff">' + esc(bd.name || t.branch) + '</span>';
    }
    var syns = t.synergies || [];
    for (var s = 0; s < syns.length; s++){
      var sd = this.synById(syns[s]);
      if (sd) badges += '<span class="badge">' + esc(sd.name) + '</span>';
    }
    var br = $('tower-badges');
    br.innerHTML = badges;
    br.style.display = badges ? '' : 'none';

    var hpLine = $('tower-hp');
    hpLine.classList.remove('hidden');
    $('tower-hp-fill').style.width = Math.max(0, Math.min(100, t.hp / Math.max(1, t.maxHp) * 100)) + '%';
    $('tower-hp-v').textContent = t.hp + '/' + t.maxHp;

    var html = this.statHtml('Tier', t.tier + (t.branch ? ' + ' + t.branch.toUpperCase() : ''));
    var st = this.game.towerLiveStats ? this.game.towerLiveStats(t.instId) : null;
    if (t.range) html += this.statHtml('Range', (Math.round(t.range * 10) / 10) + 'm');
    if (st){
      if (st.damage) html += this.statHtml('Damage', Math.round(st.damage));
      if (st.fireRate) html += this.statHtml('Fire rate', (Math.round(st.fireRate * 100) / 100) + '/s');
      if (st.damage && st.fireRate) html += this.statHtml('DPS', (Math.round(st.damage * st.fireRate * 10) / 10));
    }
    if (def.energy) html += this.statHtml('Energy', def.energy);
    if (t.dark) html += this.statHtml('Status', 'Outside uplink range: DARK');
    $('tower-stats').innerHTML = html;

    var synLine = $('tower-synergy');
    if (syns.length){
      var names = [];
      for (var q = 0; q < syns.length; q++){
        var s2 = this.synById(syns[q]);
        if (s2) names.push('<span class="syn-name">' + esc(s2.name) + '</span>: ' + esc(s2.desc || ''));
      }
      synLine.innerHTML = '&#9670; ' + names.join('<br>&#9670; ');
      synLine.classList.remove('hidden');
    } else { synLine.classList.add('hidden'); synLine.innerHTML = ''; }

    var upg = $('btn-upgrade'), row = $('branch-row');
    if (t.tier < 3){
      row.classList.add('hidden');
      upg.style.display = '';
      var td = (def.tiers || [])[t.tier - 1] || {};
      var cost = td.cost || 0;
      upg.disabled = gold < cost;
      upg.textContent = 'Upgrade to T' + (t.tier + 1) + ' (' + cost + 'g)' + (td.note ? ' - ' + td.note : '');
    } else if (!t.branch){
      upg.style.display = 'none';
      row.classList.remove('hidden');
      var ba = (def.branch || {}).a || {}, bb = (def.branch || {}).b || {};
      var btnA = $('btn-branch-a'), btnB = $('btn-branch-b');
      btnA.disabled = gold < (ba.cost || 0);
      btnA.innerHTML = '<b>A: ' + esc(ba.name || 'A') + '</b><br><span class="cost">' + (ba.cost || 0) + 'g</span><br><span class="muted small">' + esc(ba.desc || '') + '</span>';
      btnB.disabled = gold < (bb.cost || 0);
      btnB.innerHTML = '<b>B: ' + esc(bb.name || 'B') + '</b><br><span class="cost">' + (bb.cost || 0) + 'g</span><br><span class="muted small">' + esc(bb.desc || '') + '</span>';
    } else {
      upg.style.display = 'none';
      row.classList.add('hidden');
    }
    var sellRate = (NB.CONFIG && NB.CONFIG.SELLBACK) || 0.7;
    $('btn-sell').textContent = 'Sell';
    $('btn-sell').title = 'Refund ' + Math.round(sellRate * 100) + '% of gold spent';
  },

  synById: function(id){
    var list = NB.SYNERGIES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },

  openWall: function(ref){
    this.game.selection = { kind:'wall', id: ref.id, ref: ref };
    this.refreshWallPanel();
    this.openPanel('panel-wall');
  },

  refreshWallPanel: function(){
    var sel = this.game.selection;
    var w = sel && sel.kind === 'wall' ? this.findWall(sel.id) : null;
    if (!w){ this.closePanels(); this.game.selection = null; return; }
    $('wall-hp-fill').style.width = Math.max(0, Math.min(100, w.hp / Math.max(1, w.maxHp) * 100)) + '%';
    $('wall-hp-v').textContent = w.hp + '/' + w.maxHp;
    var missing = w.maxHp - w.hp;
    var btn = $('btn-wall-repair');
    btn.disabled = missing <= 0;
    btn.textContent = missing > 0 ? 'Repair' : 'At full integrity';
  },

  openReactor: function(ref){
    this.game.selection = { kind:'reactor', id: ref.instId, ref: ref };
    this.refreshReactorPanel();
    this.openPanel('panel-reactor');
  },

  refreshReactorPanel: function(){
    var sel = this.game.selection;
    var r = sel && sel.kind === 'reactor' ? this.findReactor(sel.id) : null;
    if (!r){ this.closePanels(); this.game.selection = null; return; }
    $('reactor-hp-fill').style.width = Math.max(0, Math.min(100, r.hp / Math.max(1, r.maxHp) * 100)) + '%';
    $('reactor-hp-v').textContent = r.hp + '/' + r.maxHp;
    var cap = (NB.CONFIG && NB.CONFIG.REACTOR_CAP) || 30;
    $('reactor-stats').innerHTML = this.statHtml('Energy capacity', '+' + cap) +
      (r.dark ? this.statHtml('Status', 'Outside uplink range: DARK') : this.statHtml('Status', 'Online'));
  },

  /* ---------------- Command Spire panel ---------------- */

  openSpire: function(){
    this.game.selection = null;
    this.refreshSpirePanel();
    this.openPanel('panel-spire');
  },

  /* ---------------- colony population panel ---------------- */

  CLASS_META: [
    { id: 'laborer', name: 'Laborers', color: '#ffb347',
      desc: 'Harvest scrap, farm hydroponics.' },
    { id: 'engineer', name: 'Engineers', color: '#a3e635',
      desc: 'Repair structures, cut build costs.' },
    { id: 'soldier', name: 'Soldiers', color: '#ff5a36',
      desc: 'Pool for ranger training.' },
    { id: 'scientist', name: 'Scientists', color: '#c084fc',
      desc: 'Research new ages early.' }
  ],

  openPop: function(){
    this.game.selection = null;
    this.refreshPopPanel();
    this.openPanel('panel-pop');
  },

  refreshPopPanel: function(){
    var g = this.game, snap = g.lastSnap || {};
    var pop = snap.pop || { total: 0, cap: 0, idle: 0, governor: true, classes: {} };
    var cls = pop.classes || {};
    $('pop-count').textContent = (pop.total || 0) + ' / ' + (pop.cap || 0);
    var econ = $('pop-econ-line');
    if (econ){
      var fr = snap.foodRate || 0;
      econ.innerHTML = '';
      econ.appendChild(el('span', null,
        'Food ' + Math.floor(snap.food || 0) +
        ' (' + (fr >= 0 ? '+' : '') + fr.toFixed(1) + '/s, need ' +
        (snap.foodCons || 0).toFixed(1) + '/s)' +
        (snap.starving ? ' STARVING' : '')));
      econ.appendChild(el('span', null,
        'Metal ' + Math.floor(snap.metal || 0) +
        ' (+' + (snap.metalRate || 0).toFixed(1) + '/s)'));
      if ((snap.researchNeed || 0) > 0)
        econ.appendChild(el('span', null,
          'Research ' + (snap.research || 0) + ' / ' + snap.researchNeed));
    }
    var grid = $('pop-classes');
    if (grid){
      grid.innerHTML = '';
      var self = this;
      this.CLASS_META.forEach(function(m){
        var row = el('div', 'class-row');
        var dot = el('span', 'dot');
        dot.style.color = m.color; dot.style.background = m.color;
        row.appendChild(dot);
        var info = el('div', 'class-info');
        info.appendChild(el('b', null, m.name));
        info.appendChild(el('span', 'class-desc', m.desc));
        row.appendChild(info);
        var n = el('span', 'class-n', String(cls[m.id] || 0));
        row.appendChild(n);
        var minus = el('button', 'btn step-btn', '-');
        minus.type = 'button';
        minus.setAttribute('aria-label', 'Fewer ' + m.name);
        var plus = el('button', 'btn step-btn', '+');
        plus.type = 'button';
        plus.setAttribute('aria-label', 'More ' + m.name);
        minus.addEventListener('click', function(){ g.assignClass(m.id, (cls[m.id] || 0) - 1); });
        plus.addEventListener('click', function(){ g.assignClass(m.id, (cls[m.id] || 0) + 1); });
        row.appendChild(minus);
        row.appendChild(plus);
        grid.appendChild(row);
      });
      var idleRow = el('div', 'class-row idle');
      idleRow.appendChild(el('span', 'dot idle-dot'));
      var ii = el('div', 'class-info');
      ii.appendChild(el('b', null, 'Idle civilians'));
      ii.appendChild(el('span', 'class-desc', 'Unassigned. The governor staffs them.'));
      idleRow.appendChild(ii);
      idleRow.appendChild(el('span', 'class-n', String(pop.idle || 0)));
      grid.appendChild(idleRow);
    }
    var gb = $('btn-governor');
    if (gb) gb.textContent = 'Auto-governor: ' + (pop.governor ? 'ON' : 'OFF');
    this.refreshTroopTrain();
  },

  refreshTroopTrain: function(){
    var g = this.game, snap = g.lastSnap || {};
    var list = $('troop-train-list');
    if (!list) return;
    list.innerHTML = '';
    var self = this;
    var TROOPS = NB.TROOPS || {};
    var order = NB.TROOP_ORDER || Object.keys(TROOPS);
    var pop = snap.pop || {};
    var cls = pop.classes || {};
    order.forEach(function(type){
      var def = TROOPS[type];
      if (!def) return;
      var row = el('div', 'train-row');
      var dot = el('span', 'dot');
      dot.style.color = def.color; dot.style.background = def.color;
      row.appendChild(dot);
      var info = el('div', 'class-info');
      info.appendChild(el('b', null, def.name || type));
      info.appendChild(el('span', 'class-desc',
        (def.costGold || 0) + 'g + ' + (def.costFood || 0) + ' food + 1 soldier (' +
        (def.trainTime || 0) + 's)'));
      row.appendChild(info);
      var b = el('button', 'btn', 'Train');
      b.type = 'button';
      var can = (cls.soldier || 0) >= 1 && (snap.gold || 0) >= (def.costGold || 0) &&
                (snap.food || 0) >= (def.costFood || 0) &&
                ((snap.troops || []).length + (snap.training || []).length) < (snap.troopCap || 6);
      b.disabled = !can;
      b.addEventListener('click', function(){ g.trainTroop(type); });
      row.appendChild(b);
      list.appendChild(row);
    });
    /* training queue progress */
    var tq = snap.training || [];
    for (var i = 0; i < tq.length; i++){
      var def2 = TROOPS[tq[i].type] || {};
      list.appendChild(el('div', 'train-prog',
        'Training ' + (def2.name || tq[i].type) + ': ' + tq[i].pct + '%'));
    }
    var st = $('troop-status');
    if (st){
      st.innerHTML = '';
      var troops = snap.troops || [];
      st.appendChild(el('span', null,
        'Fielded: ' + troops.length + '/' + (snap.troopCap || 6) +
        ' - tap a troop, then tap the battlefield to order it.'));
    }
  },

  /* ---------------- troop inspector ---------------- */

  openTroop: function(ref){
    this.game.selection = { kind: 'troop', id: ref.id, ref: ref };
    this.refreshTroopPanel();
    this.openPanel('panel-troop');
  },

  findTroop: function(id){
    var snap = this.game && this.game.lastSnap;
    var list = (snap && snap.troops) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },

  refreshTroopPanel: function(){
    var sel = this.game.selection;
    var t = sel && sel.kind === 'troop' ? this.findTroop(sel.id) : null;
    if (!t){ this.closePanels(); this.game.selection = null; return; }
    var def = (NB.TROOPS || {})[t.type] || {};
    $('troop-name').textContent = def.name || t.type || 'Troop';
    $('troop-hp-v').textContent = t.hp + ' / ' + t.maxHp;
    var frac = t.maxHp > 0 ? t.hp / t.maxHp : 0;
    $('troop-hp-fill').style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
    $('troop-stats').innerHTML = '';
    $('troop-stats').appendChild(this.statHtml('Damage', String(def.dmg || 0)));
    $('troop-stats').appendChild(this.statHtml('Range', (def.range || 0) + ' cells'));
    $('troop-stats').appendChild(this.statHtml('Order',
      (t.order && t.order.kind) || 'attackmove'));
    /* order mode buttons: pick the order kind for the next battlefield tap */
    var modes = $('troop-order-modes');
    if (modes){
      modes.innerHTML = '';
      var self = this, g = this.game;
      (NB.TROOP_ORDERS || ['move', 'attackmove', 'hold']).forEach(function(k){
        var b = el('button', 'btn seg-btn' + (g.troopOrderKind === k ? ' active' : ''));
        b.type = 'button';
        b.textContent = k === 'move' ? 'Move' : k === 'attackmove' ? 'Attack-move' : 'Hold';
        b.addEventListener('click', function(){ g.setTroopOrderKind(k); });
        modes.appendChild(b);
      });
    }
  },

  /* ---------------- barracks ---------------- */

  _barracksRef: null,

  squadForBarracks: function(barracksInstId){
    var snap = this.game && this.game.lastSnap;
    var squads = (snap && snap.squads) || [];
    for (var i = 0; i < squads.length; i++){
      if (squads[i].barracksId === barracksInstId) return squads[i];
    }
    return null;
  },

  openBarracks: function(ref){
    this._barracksRef = ref || null;
    this.game.selection = { kind: 'barracks', id: ref && ref.instId, ref: ref };
    this.refreshBarracksPanel();
    this.openPanel('panel-barracks');
  },

  findBarracks: function(instId){
    var snap = this.game && this.game.lastSnap;
    var list = (snap && snap.barracks) || [];
    for (var i = 0; i < list.length; i++){
      if (list[i].instId === instId) return list[i];
    }
    return null;
  },

  refreshBarracksPanel: function(){
    var g = this.game, snap = g.lastSnap || {};
    var b = this._barracksRef && this.findBarracks(this._barracksRef.instId);
    if (!b){ this.closePanels(); this._barracksRef = null; return; }
    this._barracksRef = b;
    $('barracks-hp-v').textContent = b.hp + ' / ' + b.maxHp;
    var frac = b.maxHp > 0 ? b.hp / b.maxHp : 0;
    $('barracks-hp-fill').style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
    var sq = this.squadForBarracks(b.instId);
    var sl = $('barracks-squad-line');
    if (sl){
      sl.innerHTML = '';
      if (sq){
        sl.appendChild(el('span', null,
          sq.name + ': ' + sq.alive + '/' + sq.cap + ' fielded' +
          (sq.queued ? ' (+' + sq.queued + ' training)' : '') +
          (sq.order ? ' - ' + sq.order : '')));
      } else {
        sl.appendChild(el('span', 'muted', 'No squad mustered here yet.'));
      }
    }
    var list = $('barracks-train-list');
    if (list){
      list.innerHTML = '';
      var self = this;
      var TROOPS = NB.TROOPS || {};
      var order = NB.TROOP_ORDER || Object.keys(TROOPS);
      var pop = snap.pop || {};
      var cls = pop.classes || {};
      var fielded = (snap.troops || []).length + (snap.training || []).length;
      order.forEach(function(type){
        var def = TROOPS[type];
        if (!def) return;
        var row = el('div', 'train-row');
        var dot = el('span', 'dot');
        dot.style.color = def.color; dot.style.background = def.color;
        row.appendChild(dot);
        var info = el('div', 'class-info');
        info.appendChild(el('b', null, def.name || type));
        info.appendChild(el('span', 'class-desc',
          (def.costGold || 0) + 'g + ' + (def.costFood || 0) + ' food + 1 soldier (' +
          (def.trainTime || 0) + 's) - ' + (def.tag || '')));
        row.appendChild(info);
        var bb = el('button', 'btn', 'Train');
        bb.type = 'button';
        var squadFull = sq && (sq.alive + sq.queued) >= sq.cap;
        var can = sq && !squadFull && (cls.soldier || 0) >= 1 &&
                  (snap.gold || 0) >= (def.costGold || 0) &&
                  (snap.food || 0) >= (def.costFood || 0) &&
                  fielded < (snap.troopCap || 6);
        bb.disabled = !can;
        bb.title = !sq ? 'No squad here' : squadFull ? 'Squad full' : 'Train ' + (def.name || type);
        (function(tp, sqId){
          bb.addEventListener('click', function(){ g.trainTroopAt(tp, sqId); });
        })(type, sq && sq.id);
        row.appendChild(bb);
        list.appendChild(row);
      });
    }
    var ql = $('barracks-queue');
    if (ql){
      ql.innerHTML = '';
      var tq = snap.training || [];
      var TROOPS2 = NB.TROOPS || {};
      for (var i = 0; i < tq.length; i++){
        if (sq && tq[i].squadId && tq[i].squadId !== sq.id) continue;
        var def2 = TROOPS2[tq[i].type] || {};
        ql.appendChild(el('div', 'train-prog',
          'Training ' + (def2.name || tq[i].type) + ': ' + tq[i].pct + '%'));
      }
    }
    var ul = $('barracks-upgrades');
    if (ul){
      ul.innerHTML = '';
      var upg = snap.troopUpg || { weapon: 0, armor: 0 };
      var res = snap.troopResearch;
      var tracks = [
        ['weapon', 'Weapon', '+25% troop damage per tier'],
        ['armor', 'Armor', '+30% troop HP per tier']
      ];
      tracks.forEach(function(pair){
        var track = pair[0], tier = upg[track] || 0;
        var row = el('div', 'train-row');
        var dot = el('span', 'dot');
        dot.style.color = '#c4b5fd'; dot.style.background = '#c4b5fd';
        row.appendChild(dot);
        var info = el('div', 'class-info');
        info.appendChild(el('b', null, pair[1] + ' MK' + (tier + 1)));
        var cost = ((NB.CONFIG || {}).TROOP_UPGRADE_COST || [])[tier];
        var busy = !!res;
        var label;
        if (tier >= 2) label = 'MAX TIER';
        else if (res && res.track === track) label = 'Researching ' + res.pct + '%';
        else if (busy) label = 'Lab busy';
        else label = pair[2] + ' - ' + (cost ? cost.gold + 'g + ' + cost.metal + ' metal' : '');
        info.appendChild(el('span', 'class-desc', label));
        row.appendChild(info);
        var rb = el('button', 'btn', tier >= 2 ? 'MAX' : 'Research');
        rb.type = 'button';
        rb.disabled = tier >= 2 || busy ||
          (snap.gold || 0) < (cost ? cost.gold : 0) ||
          (snap.metal || 0) < (cost ? cost.metal : 0);
        rb.title = 'Scientists speed research';
        (function(tr){ rb.addEventListener('click', function(){ g.researchTroopUpgrade(tr); }); })(track);
        row.appendChild(rb);
        ul.appendChild(row);
      });
    }
    var rfb = $('btn-reinforce');
    if (rfb && sq){
      var missing = sq.cap - sq.alive - sq.queued;
      rfb.textContent = missing > 0 ? 'Reinforce squad (' + missing + ' empty)' : 'Squad full';
      rfb.disabled = missing <= 0;
    }
  },

  /* ---------------- army overview ---------------- */

  openArmy: function(){
    this.refreshArmyPanel();
    this.openPanel('panel-army');
  },

  refreshArmyPanel: function(){
    var g = this.game, snap = g.lastSnap || {};
    var ul = $('army-upkeep-line');
    if (ul){
      ul.innerHTML = '';
      var fielded = (snap.troops || []).length;
      var training = (snap.training || []).length;
      var up = snap.troopUpkeep || 0;
      ul.appendChild(el('span', null,
        'Fielded ' + fielded + '/' + (snap.troopCap || 6) +
        (training ? ' (+' + training + ' training)' : '') +
        (up > 0 ? ' - upkeep ' + up.toFixed(2) + ' food/s' : '')));
    }
    var list = $('army-squads');
    if (list){
      list.innerHTML = '';
      var squads = snap.squads || [];
      var troops = snap.troops || [];
      var TROOPS = NB.TROOPS || {};
      squads.forEach(function(sq){
        var row = el('div', 'train-row');
        var dot = el('span', 'dot');
        dot.style.color = '#a3e635'; dot.style.background = '#a3e635';
        row.appendChild(dot);
        var info = el('div', 'class-info');
        info.appendChild(el('b', null, sq.name || sq.id));
        var hp = 0, maxHp = 0, mix = {};
        for (var i = 0; i < troops.length; i++){
          if (troops[i].squadId === sq.id){
            hp += troops[i].hp; maxHp += troops[i].maxHp;
            mix[troops[i].type] = (mix[troops[i].type] || 0) + 1;
          }
        }
        var mixStr = Object.keys(mix).map(function(tp){
          return ((TROOPS[tp] || {}).name || tp) + ' x' + mix[tp];
        }).join(', ') || 'empty';
        var dead = Math.max(0, sq.cap - sq.alive - sq.queued);
        info.appendChild(el('span', 'class-desc',
          sq.alive + '/' + sq.cap + (sq.queued ? ' (+' + sq.queued + ' training)' : '') +
          (dead > 0 ? ' - ' + dead + ' empty' : '') + ' - ' + mixStr +
          (sq.order ? ' - ' + sq.order : '')));
        var bar = el('div', 'bar slim');
        var fill = el('div', 'fill');
        fill.style.width = (maxHp > 0 ? Math.max(0, Math.min(100, hp / maxHp * 100)) : 0) + '%';
        bar.appendChild(fill);
        info.appendChild(bar);
        row.appendChild(info);
        var sb = el('button', 'btn', 'Command');
        sb.type = 'button';
        sb.disabled = sq.alive <= 0;
        sb.title = 'Select this squad, then tap the battlefield to order it';
        (function(sqId){ sb.addEventListener('click', function(){ g.selectSquad(sqId); }); })(sq.id);
        row.appendChild(sb);
        var sel = g.selection;
        if (sel && sel.kind === 'squad' && sel.squadId === sq.id) row.classList.add('active');
        list.appendChild(row);
      });
      if (!squads.length){
        list.appendChild(el('div', 'muted', 'No squads yet. Build a Barracks to muster troops.'));
      }
    }
    var modes = $('army-order-modes');
    if (modes){
      modes.innerHTML = '';
      (NB.TROOP_ORDERS || ['move', 'attackmove', 'hold']).forEach(function(k){
        var b = el('button', 'btn seg-btn' + (g.troopOrderKind === k ? ' active' : ''));
        b.type = 'button';
        b.textContent = k === 'move' ? 'Move' : k === 'attackmove' ? 'Attack-move' : 'Hold';
        b.addEventListener('click', function(){ g.setTroopOrderKind(k); });
        modes.appendChild(b);
      });
    }
  },

  refreshSpirePanel: function(){
    var g = this.game, snap = g.lastSnap || {};
    var CFG = NB.CONFIG || {};
    var ul = null;
    try { ul = g.sim ? g.sim.getUplink() : null; } catch (e){ ul = null; }
    var radius = ul ? ul.radius : (snap.uplinkRadius || 0);
    var oc = (ul && ul.overclock) || snap.overclock || {};
    var tier = (snap.spireUpgrades != null ? snap.spireUpgrades : 0);
    var html = this.statHtml('Uplink', Math.round(radius * 10) / 10 + ' cells') +
               this.statHtml('Spire tier', tier + ' / 3');
    var costs = CFG.SPIRE_UPGRADE_COSTS || [150, 300, 600];
    if (tier < 3){
      var per = CFG.SPIRE_RADIUS_PER_TIER || 2;
      html += this.statHtml('Next tier', '+' + per + ' uplink radius (' + costs[tier] + 'g)');
    } else {
      html += this.statHtml('Next tier', 'MAX');
    }
    $('spire-stats').innerHTML = html;

    $('oc-strain-fill').style.width = Math.max(0, Math.min(100, oc.strain || 0)) + '%';
    this.setOverclockPips(snap.overclockCharges || 0, 3);
    var ocBtn = $('btn-overclock'), ocState = $('oc-state');
    if (oc.active){
      ocBtn.textContent = 'Release Overclock';
      ocState.textContent = 'ACTIVE - strain climbing';
    } else if ((oc.cooldown || 0) > 0){
      ocBtn.textContent = 'Overclock (cooldown ' + Math.ceil(oc.cooldown) + 's)';
      ocBtn.disabled = true;
      ocState.textContent = 'cooling down';
    } else {
      ocBtn.textContent = 'Overclock the Spire';
      ocBtn.disabled = false;
      ocState.textContent = 'ready';
    }
    var upBtn = $('btn-spire-upgrade');
    if (tier >= 3){ upBtn.disabled = true; upBtn.textContent = 'Spire at Max Tier'; }
    else {
      upBtn.disabled = (snap.gold || 0) < (costs[tier] || 0);
      upBtn.textContent = 'Upgrade Spire (' + (costs[tier] || 0) + 'g)';
    }
  },

  /* ---------------- wave preview ---------------- */

  openWave: function(){
    var g = this.game;
    if (!g || !g.lastSnap) return;
    var snap = g.lastSnap;
    var n = snap.waveIndex + (snap.waveActive ? 1 : 0);
    var pv = null;
    try { pv = g.sim ? g.sim.previewWave(n) : (g.remotePreview ? g.remotePreview(n) : null); }
    catch (e){ pv = null; }
    if (n >= snap.wavesTotal){
      $('wave-title').textContent = 'All waves cleared';
      $('wave-list').innerHTML = '';
      $('wave-totals').innerHTML = '';
      $('wave-note').textContent = '';
      $('wave-bonus').textContent = '';
      $('wave-anomaly').classList.add('hidden');
      $('btn-wave-start').disabled = true;
      $('btn-wave-early').disabled = true;
      this.openPanel('panel-wave');
      return;
    }
    $('wave-title').textContent = 'Wave ' + (n + 1) + ' of ' + snap.wavesTotal;

    var anEl = $('wave-anomaly');
    var surge = snap.surge || {};
    if (surge.warningIn > 0 && !snap.waveActive){
      anEl.textContent = '!! BLACKOUT SURGE INCOMING: ' + Math.ceil(surge.warningIn) + 's !!';
      anEl.classList.remove('hidden');
    } else if (surge.active){
      anEl.textContent = '!! BLACKOUT SURGE ACTIVE !!';
      anEl.classList.remove('hidden');
    } else {
      anEl.classList.add('hidden');
    }

    var listEl = $('wave-list');
    listEl.innerHTML = '';
    if (pv && pv.groups){
      for (var i = 0; i < pv.groups.length; i++){
        (function(gr){
          var def = (NB.ENEMIES || {})[gr.type] || {};
          var row = el('div', 'wave-group');
          var left = el('span');
          var dot = el('span', 'dot');
          dot.style.background = def.color || '#fff';
          left.appendChild(dot);
          left.appendChild(document.createTextNode((gr.name || gr.type) + ' x' + gr.count));
          var right = el('span', 'muted', gr.count + ' x ' + gr.hp + ' hp');
          row.appendChild(left);
          row.appendChild(right);
          listEl.appendChild(row);
        })(pv.groups[i]);
      }
      $('wave-totals').innerHTML = this.statHtml('Total HP', String(pv.totalHp)) +
        this.statHtml('Est. bounty', pv.estBounty + 'g');
      $('wave-note').textContent = pv.note || '';
    } else {
      $('wave-totals').innerHTML = '';
      $('wave-note').textContent = 'Wave data unavailable.';
    }
    var bonusEl = $('wave-bonus');
    if (!snap.waveActive && snap.intermission > 1){
      var eb = (NB.CONFIG.EARLY_BASE || 10) + (NB.CONFIG.EARLY_PER_SEC || 2) * Math.ceil(snap.intermission);
      bonusEl.textContent = 'Starting now grants +' + eb + 'g early bonus.';
    } else {
      bonusEl.textContent = '';
    }
    $('btn-wave-start').disabled = snap.waveActive || snap.pendingEvent || snap.pendingEdict;
    $('btn-wave-early').disabled = !snap.waveActive;
    if (!g.tipOnce('nb_hint_wave')) this.toast('Press Start Wave when ready');
    this.openPanel('panel-wave');
  },

  /* ---------------- crossroads event modal ---------------- */

  pollModals: function(){
    var g = this.game;
    if (!g || g.mode !== 'game') return;
    if (this.anyModalOpen()) return;
    var snap = g.lastSnap;
    if (!snap || snap.over) return;
    if (snap.pendingEvent && g.sim && typeof g.sim.getEvent === 'function'){
      var ev = null;
      try { ev = g.sim.getEvent(); } catch (e){}
      if (ev) this.showEventModal(ev);
    } else if (snap.pendingEdict && g.sim && typeof g.sim.getEdictOffer === 'function'){
      var offer = null;
      try { offer = g.sim.getEdictOffer(); } catch (e){}
      if (offer) this.showEdictModal(offer);
    }
  },

  showEventModal: function(ev){
    $('event-title').textContent = ev.title || 'Crossroads';
    $('event-text').textContent = ev.text || '';
    var box = $('event-choices');
    box.innerHTML = '';
    var self = this;
    var votes = this.game.netVotes && this.game.netVotes.event;
    (ev.choices || []).forEach(function(ch){
      var b = el('button', 'btn choice-btn');
      b.type = 'button';
      b.appendChild(el('b', null, ch.label || ch.id));
      if (ch.hint) b.appendChild(el('div', 'hint', ch.hint));
      b.addEventListener('click', function(){ self.game.chooseEvent(ch.id); });
      box.appendChild(b);
    });
    var vl = $('event-votes');
    if (votes){
      vl.classList.remove('hidden');
      var parts = [];
      for (var pid in votes){
        var p = self.game.playerById(pid);
        parts.push((p ? p.name : pid) + ': ' + votes[pid]);
      }
      vl.textContent = parts.length ? 'Votes: ' + parts.join(' | ') : 'Votes: awaiting commanders...';
    } else {
      vl.classList.add('hidden');
    }
    $('modal-event').classList.remove('hidden');
  },

  showEdictModal: function(offer){
    var box = $('edict-cards');
    box.innerHTML = '';
    var self = this;
    var votes = this.game.netVotes && this.game.netVotes.edict;
    (offer.pair || []).forEach(function(ed){
      var b = el('button', 'btn edict-card');
      b.type = 'button';
      b.appendChild(el('b', null, ed.name || ed.id));
      b.appendChild(el('p', null, ed.desc || ''));
      b.addEventListener('click', function(){ self.game.chooseEdict(ed.id); });
      box.appendChild(b);
    });
    var vl = $('edict-votes');
    if (votes){
      vl.classList.remove('hidden');
      var parts = [];
      for (var pid in votes){
        var p = self.game.playerById(pid);
        parts.push((p ? p.name : pid) + ': ' + votes[pid]);
      }
      vl.textContent = parts.length ? 'Votes: ' + parts.join(' | ') : 'Votes: awaiting commanders...';
    } else {
      vl.classList.add('hidden');
    }
    $('modal-edict').classList.remove('hidden');
  },

  /* ---------------- story ---------------- */

  showBriefing: function(ch, done){
    this._briefingDone = done;
    $('briefing-title').textContent = ch.title || ('Chapter ' + (ch.n || ''));
    var box = $('briefing-lines');
    box.innerHTML = '';
    ((ch.briefing) || []).forEach(function(line){
      box.appendChild(el('p', null, line));
    });
    var self = this;
    $('btn-briefing-skip').onclick = function(){ self.finishBriefing(ch, false); };
    $('btn-briefing-go').onclick = function(){ self.finishBriefing(ch, true); };
    $('modal-briefing').classList.remove('hidden');
  },

  finishBriefing: function(ch, viewed){
    $('modal-briefing').classList.add('hidden');
    if (ch && ch.codexUnlocks){
      this.unlockCodex(ch.codexUnlocks);
    }
    var done = this._briefingDone;
    this._briefingDone = null;
    if (done) done();
  },

  showDebrief: function(ch, win, done){
    var d = win ? ch.debriefWin : ch.debriefLose;
    $('debrief-title').textContent = (win ? 'Sector Secured: ' : 'Sector Lost: ') + (ch.title || '');
    var box = $('debrief-lines');
    box.innerHTML = '';
    if (d) box.appendChild(el('p', null, d));
    var self = this;
    $('btn-debrief-ok').onclick = function(){
      $('modal-debrief').classList.add('hidden');
      if (done) done();
    };
    $('modal-debrief').classList.remove('hidden');
  },

  buildCodex: function(){
    var list = $('codex-list');
    if (!list) return;
    list.innerHTML = '';
    var entries = (((NB.STORY || {}).codex) || []);
    var unlocked = this.save.codex;
    if (!entries.length){
      list.appendChild(el('p', 'muted', 'No records recovered yet.'));
      return;
    }
    entries.forEach(function(entry){
      var has = unlocked.indexOf(entry.id) >= 0;
      var card = el('div', 'codex-entry' + (has ? '' : ' locked'));
      card.appendChild(el('b', null, has ? entry.title : '???'));
      card.appendChild(el('p', null, has ? entry.body : 'Recover this record by viewing the sector briefing.'));
      list.appendChild(card);
    });
  },

  /* ---------------- howto / levels ---------------- */

  buildHowto: function(){
    var tw = $('howto-towers');
    if (tw){
      tw.innerHTML = '';
      for (var i = 0; i < TOWER_ORDER.length; i++){
        (function(tid){
          var def = NB.TOWERS[tid];
          if (!def) return;
          var card = el('div', 'roster-card');
          var head = el('b', null, (def.name || tid) + ' (' + (def.cost || 0) + 'g)');
          head.style.color = def.color || '#fff';
          card.appendChild(head);
          card.appendChild(el('div', 'tag', def.tag || ''));
          card.appendChild(el('p', null, def.desc || ''));
          tw.appendChild(card);
        })(TOWER_ORDER[i]);
      }
    }
    var sy = $('howto-synergies');
    if (sy){
      sy.innerHTML = '';
      var list = NB.SYNERGIES || [];
      list.forEach(function(s){
        var card = el('div', 'roster-card');
        var head = el('b', null, s.name || s.id);
        head.style.color = '#ffb347';
        card.appendChild(head);
        card.appendChild(el('p', null, s.desc || ''));
        sy.appendChild(card);
      });
      /* pairings generated from live data; names never hardcoded */
      var hint = $('howto-synergy-hint');
      if (hint){
        var pairs = [];
        list.forEach(function(s){
          var fromDef = (NB.TOWERS || {})[s.from];
          var toList = Array.isArray(s.to) ? s.to : [s.to];
          var toNames = [];
          toList.forEach(function(tid){
            var td = (NB.TOWERS || {})[tid];
            if (td) toNames.push(td.name || tid);
          });
          if (fromDef && toNames.length) pairs.push((fromDef.name || s.from) + ' empowers ' + toNames.join(', '));
        });
        hint.textContent = 'Certain towers empower each other when built near one another. ' +
          (pairs.length ? 'Pairings: ' + pairs.join('; ') + '.' : '');
      }
    }
  },

  buildLevels: function(){
    var grid = $('level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var levels = NB.SECTORS || [];
    var self = this;
    levels.forEach(function(lv, idx){
      var locked = idx >= self.save.unlocked;
      var stars = self.save.stars[lv.id] || 0;
      var card = el('button', 'level-card' + (locked ? ' locked' : ''));
      card.type = 'button';
      card.appendChild(el('h3', null, (locked ? 'Locked - ' : '') + (lv.name || ('Sector ' + (idx + 1)))));
      card.appendChild(el('div', 'diff', 'Difficulty ' + (lv.difficulty || 1) + ' / 5 - ' + (lv.tagline || '')));
      card.appendChild(el('div', 'stars', locked ? '' : ('\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars))));
      if (!locked) card.addEventListener('click', function(){ self.game.startSector(idx); });
      grid.appendChild(card);
    });
  },

  /* ---------------- lobby ---------------- */

  buildDoctrineCards: function(){
    var box = $('doctrine-cards');
    if (!box) return;
    box.innerHTML = '';
    var docs = NB.DOCTRINES || {};
    var self = this;
    Object.keys(docs).forEach(function(key){
      var d = docs[key];
      var card = el('button', 'doctrine-card' + (self.lobbyDoctrine === key ? ' picked' : ''));
      card.type = 'button';
      card.appendChild(el('b', null, d.name || key));
      card.appendChild(el('p', null, d.desc || ''));
      card.addEventListener('click', function(){
        self.lobbyDoctrine = key;
        self.buildDoctrineCards();
      });
      box.appendChild(card);
    });
  },

  buildLobbySectors: function(){
    var grid = $('lobby-sectors');
    if (!grid) return;
    grid.innerHTML = '';
    var self = this;
    (NB.SECTORS || []).forEach(function(lv, idx){
      var locked = idx >= self.save.unlocked;
      var card = el('button', 'level-card small' + (locked ? ' locked' : '') +
        (self.lobbySectorIdx === idx ? ' picked' : ''));
      card.type = 'button';
      card.appendChild(el('h3', null, lv.name || ('Sector ' + (idx + 1))));
      if (!locked) card.addEventListener('click', function(){
        self.lobbySectorIdx = idx;
        self.buildLobbySectors();
      });
      grid.appendChild(card);
    });
  },

  showLobby: function(){
    this.buildDoctrineCards();
    this.buildLobbySectors();
    $('lobby-setup').classList.remove('hidden');
    $('lobby-room').classList.add('hidden');
    $('lobby-host-only').classList.remove('hidden');
    $('lobby-join-row').classList.add('hidden');
    $('lobby-note').classList.add('hidden');
    var nm = $('lobby-name');
    if (nm && !nm.value) nm.value = 'Commander';
    this.show('screen-lobby');
  },

  lobbyRoom: function(code, players, isHost){
    $('lobby-setup').classList.add('hidden');
    $('lobby-room').classList.remove('hidden');
    $('lobby-room-code').textContent = code;
    var box = $('lobby-players');
    box.innerHTML = '';
    (players || []).forEach(function(p){
      var row = el('div', 'player-row');
      var dot = el('span', 'pdot');
      dot.style.color = p.color || '#fff';
      dot.style.background = p.color || '#fff';
      row.appendChild(dot);
      row.appendChild(el('span', 'pname', p.name || 'Commander'));
      var docs = NB.DOCTRINES || {};
      var dn = (docs[p.doctrine] || {}).name || p.doctrine || '';
      row.appendChild(el('span', 'ptag', (p.isAI ? 'AI - ' : '') + dn));
      box.appendChild(row);
    });
    $('btn-lobby-start').style.display = isHost ? '' : 'none';
    $('lobby-wait').classList.toggle('hidden', isHost);
  },

  lobbyNote: function(txt){
    var n = $('lobby-note');
    if (!n) return;
    if (txt){ n.textContent = txt; n.classList.remove('hidden'); }
    else n.classList.add('hidden');
  },

  /* ---------------- post-game ---------------- */

  showEnd: function(data){
    data = data || {};
    var win = !!data.win;
    $('end-kicker').textContent = win ? 'Victory' : 'Defeat';
    $('end-title').textContent = data.levelName || (win ? 'Sector Cleared' : 'Sector Lost');
    var stars = win ? (data.stars | 0) : 0;
    $('end-stars').textContent = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars);

    /* per-player cards + MVP */
    var cards = $('end-players');
    cards.innerHTML = '';
    var players = data.players || [{ id:'p0', name:'Commander', color:'#7df9ff', doctrine:'vanguard', isAI:false }];
    var statsByPlayer = data.statsByPlayer || {};
    var docs = NB.DOCTRINES || {};
    var mvpId = null, mvpKills = -1;
    players.forEach(function(p){
      var ps = statsByPlayer[p.id] || { kills:0, goldEarned:0, wallsBuilt:0, structuresLost:0 };
      if (ps.kills > mvpKills){ mvpKills = ps.kills; mvpId = p.id; }
      var card = el('div', 'player-card');
      var nm = el('div', 'pname', p.name || 'Commander');
      nm.style.color = p.color || '#fff';
      card.appendChild(nm);
      card.appendChild(el('div', 'pdoc', ((docs[p.doctrine] || {}).name || p.doctrine || '') + (p.isAI ? ' (AI)' : '')));
      [['Kills', ps.kills], ['Gold earned', ps.goldEarned + 'g'],
       ['Walls built', ps.wallsBuilt], ['Structures lost', ps.structuresLost]].forEach(function(pair){
        var row = el('div', 'prow');
        row.appendChild(el('span', null, pair[0]));
        row.appendChild(el('b', null, String(pair[1])));
        card.appendChild(row);
      });
      cards.appendChild(card);
    });
    var mvpEl = $('end-mvp');
    var mvp = players.filter(function(p){ return p.id === mvpId; })[0];
    if (mvp && mvpKills > 0){
      mvpEl.textContent = 'MVP: ' + (mvp.name || 'Commander') + ' (' + mvpKills + ' kills)';
      mvpEl.classList.remove('hidden');
      var mvpCards = cards.children;
      for (var i = 0; i < mvpCards.length; i++){
        if (players[i] && players[i].id === mvpId) mvpCards[i].classList.add('mvp-card');
      }
    } else {
      mvpEl.classList.add('hidden');
    }

    /* sparkline: kills over time */
    this.drawSparkline($('sparkline'), data.killSeries || []);

    /* stats table */
    var tb = $('end-stats').querySelector('tbody');
    tb.innerHTML = '';
    function row(label, value){
      var tr = el('tr');
      tr.appendChild(el('td', null, label));
      tr.appendChild(el('td', null, value));
      tb.appendChild(tr);
    }
    if (!win && data.reason) row('Cause', data.reason);
    if (data.wave) row('Reached wave', data.wave);
    var stats = data.stats || {};
    if (stats.kills != null) row('Enemies destroyed', String(stats.kills));
    if (stats.bossesKilled != null) row('Bosses killed', String(stats.bossesKilled));
    if (stats.surgesSurvived != null) row('Surges weathered', String(stats.surgesSurvived));
    if (stats.towersBuilt != null) row('Towers built', String(stats.towersBuilt));
    if (stats.upgradesBought != null) row('Upgrades bought', String(stats.upgradesBought));
    if (stats.structuresLost != null) row('Structures lost', String(stats.structuresLost));
    if (stats.goldEarned != null) row('Gold earned', Math.floor(stats.goldEarned) + 'g');
    if (stats.wavesCleared != null) row('Waves cleared', String(stats.wavesCleared));
    this.show('screen-end');
  },

  drawSparkline: function(canvas, series){
    if (!canvas) return;
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e){}
    if (!ctx) return;
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!series || series.length < 2){
      ctx.fillStyle = '#8fa8c0';
      ctx.font = '13px sans-serif';
      ctx.fillText('No battle record.', 12, H / 2);
      return;
    }
    var max = 1;
    for (var i = 0; i < series.length; i++) if (series[i] > max) max = series[i];
    ctx.strokeStyle = 'rgba(34,211,238,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 8);
    ctx.lineTo(W, H - 8);
    ctx.stroke();
    /* amber area + cyan line */
    ctx.beginPath();
    for (i = 0; i < series.length; i++){
      var x = (i / (series.length - 1)) * (W - 16) + 8;
      var y = H - 10 - (series[i] / max) * (H - 30);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(W - 8, H - 8);
    ctx.lineTo(8, H - 8);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(255,179,71,0.35)');
    grad.addColorStop(1, 'rgba(255,179,71,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = '#8fa8c0';
    ctx.font = '11px sans-serif';
    ctx.fillText('kills / wave', 8, 14);
    ctx.fillText(String(max), W - 30, 14);
  },

  /* ---------------- disconnect ---------------- */

  showDisconnect: function(show, secs){
    $('screen-disconnect').classList.toggle('hidden', !show);
    if (show) $('dc-count').textContent = Math.ceil(secs);
  },

  tickDisconnect: function(secs){
    $('dc-count').textContent = Math.ceil(secs);
  },

  /* ---------------- wiring ---------------- */

  on: function(id, fn){
    var e = $(id);
    if (e) e.addEventListener('click', fn);
  },

  wireButtons: function(){
    var self = this;
    var g = function(){ return self.game; };

    this.on('btn-title-start', function(){ g().titleStart(); });
    this.on('btn-title-coop', function(){ g().titleCoop(); });
    this.on('btn-title-howto', function(){ g().howtoReturn = 'title'; self.show('screen-howto'); });
    this.on('btn-title-codex', function(){ self.buildCodex(); g().howtoReturn = 'title'; self.show('screen-codex'); });
    this.on('btn-howto-back', function(){ g().howtoBack(); });
    this.on('btn-codex-back', function(){ g().howtoBack(); });
    this.on('btn-levels-back', function(){ g().levelsBack(); });

    this.on('btn-pause', function(){ g().togglePause(); });
    this.on('btn-menu', function(){ g().quitToLevels(); });
    this.on('btn-mute', function(){ g().toggleMute(); });
    this.on('btn-wave', function(){ self.openWave(); });
    this.on('btn-start-quick', function(){ g().startWave(); });
    this.on('btn-autoplay', function(){ var gg = g(); if (gg) gg.setAutoplay(!gg.autoplay); });
    this.on('btn-confirm-ok', function(){
      var m = $('modal-confirm');
      if (m) m.classList.add('hidden');
      var cb = self._confirmCb;
      self._confirmCb = null;
      if (cb) cb();
    });
    this.on('btn-confirm-cancel', function(){
      var m = $('modal-confirm');
      if (m) m.classList.add('hidden');
      self._confirmCb = null;
    });
    /* rotate widget: tap steps, press-and-hold rotates continuously */
    (function(){
      var bindRot = function(id, dir){
        var b = $(id);
        if (!b) return;
        var iv = null;
        var stop = function(){ if (iv){ clearInterval(iv); iv = null; } };
        b.addEventListener('pointerdown', function(ev){
          ev.preventDefault();
          var gg = g();
          if (gg && typeof gg.rotStep === 'function') gg.rotStep(dir);
          stop();
          iv = setInterval(function(){
            var gg2 = g();
            if (gg2 && typeof gg2.rotStep === 'function') gg2.rotStep(dir);
          }, 90);
        });
        b.addEventListener('pointerup', stop);
        b.addEventListener('pointerleave', stop);
        b.addEventListener('pointercancel', stop);
      };
      bindRot('btn-rot-l', 1);
      bindRot('btn-rot-r', -1);
    })();
    this.on('btn-wave-start', function(){ g().startWave(); });
    this.on('btn-wave-early', function(){ g().callEarly(); });

    var seg = $('speed-seg');
    if (seg){
      var btns = seg.querySelectorAll('.seg-btn');
      for (var i = 0; i < btns.length; i++){
        (function(b){
          b.addEventListener('click', function(){
            g().setSpeed(Number(b.getAttribute('data-speed')) || 1);
          });
        })(btns[i]);
      }
    }

    this.on('btn-upgrade', function(){ g().upgradeSelected(); });
    this.on('btn-sell', function(){ g().sellSelected(); });
    this.on('btn-branch-a', function(){ g().branchSelected('a'); });
    this.on('btn-branch-b', function(){ g().branchSelected('b'); });
    this.on('btn-wall-repair', function(){ g().repairSelected(); });
    this.on('btn-wall-sell', function(){ g().sellSelected(); });
    this.on('btn-reactor-sell', function(){ g().sellSelected(); });
    this.on('btn-governor', function(){ g().toggleGovernor(); });
    var popWrap = $('hud-pop-wrap');
    if (popWrap){
      var openPop = function(){ self.openPop(); };
      popWrap.addEventListener('click', openPop);
      popWrap.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openPop(); }
      });
    }
    var armyWrap = $('hud-army-wrap');
    if (armyWrap){
      var openArmy = function(){ self.openArmy(); };
      armyWrap.addEventListener('click', openArmy);
      armyWrap.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openArmy(); }
      });
    }
    this.on('btn-select-all-troops', function(){ g().selectAllTroops(); });
    this.on('btn-rally', function(){
      var b = self._barracksRef;
      if (b) g().setRallyMode(b.instId);
    });
    this.on('btn-reinforce', function(){
      var b = self._barracksRef;
      var sq = b && self.squadForBarracks(b.instId);
      if (sq) g().reinforceSquad(sq.id);
    });
    this.on('btn-overclock', function(){ g().toggleOverclock(); });
    this.on('btn-spire-upgrade', function(){ g().upgradeSpire(); });

    this.on('btn-resume', function(){ g().togglePause(); });
    this.on('btn-pause-restart', function(){ g().restart(); });
    this.on('btn-pause-howto', function(){ g().howtoReturn = 'pause'; self.show('screen-howto'); });
    this.on('btn-pause-ira', function(){ g().toggleIRAMute(); });
    var rngB = $('rng-bright');
    if (rngB){
      rngB.addEventListener('input', function(){
        self.setBrightness((parseInt(rngB.value, 10) || 100) / 100, true);
      });
      rngB.addEventListener('change', function(){
        self.setBrightness((parseInt(rngB.value, 10) || 100) / 100, true);
      });
    }
    /* graphics quality: auto (FPS governor) or a locked tier */
    var selQ = $('sel-quality');
    if (selQ){
      selQ.value = self.save.quality || 'auto';
      selQ.addEventListener('change', function(){
        self.setQuality(selQ.value);
      });
    }
    this.on('btn-quit', function(){ g().quitToLevels(); });

    this.on('btn-end-replay', function(){ g().endReplay(); });
    this.on('btn-end-sectors', function(){ g().endSectors(); });
    this.on('btn-end-title', function(){ g().endTitle(); });
    this.on('btn-dc-quit', function(){ g().disconnectQuit(); });

    /* lobby */
    this.on('btn-lobby-create', function(){
      g().hostCreate({
        name: ($('lobby-name') || {}).value || 'Commander',
        doctrine: self.lobbyDoctrine,
        sectorIdx: self.lobbySectorIdx,
        aiFill: !!($('lobby-aifill') || {}).checked
      });
    });
    this.on('btn-lobby-join', function(){
      var jr = $('lobby-join-row');
      if (jr.classList.contains('hidden')){
        jr.classList.remove('hidden');
        $('lobby-host-only').classList.add('hidden');
        self.lobbyNote('Enter the host\u2019s room code, then press Join Room again.');
      } else {
        g().hostJoin(($('lobby-code') || {}).value || '', {
          name: ($('lobby-name') || {}).value || 'Commander',
          doctrine: self.lobbyDoctrine
        });
      }
    });
    this.on('btn-lobby-start', function(){ g().lobbyStart(); });
    this.on('btn-lobby-leave', function(){ g().lobbyLeave(); });
    this.on('btn-lobby-back', function(){ g().levelsBack(); });

    var closes = document.querySelectorAll('[data-close]');
    for (var c = 0; c < closes.length; c++){
      (function(e){
        e.addEventListener('click', function(){
          var p = $(e.getAttribute('data-close'));
          if (p) p.classList.add('hidden');
          if (self.game){ self.game.selection = null; }
        });
      })(closes[c]);
    }
  },

  /* ================= REFINEMENT: tooltip ================= */

  showTooltip: function(html, x, y){
    var t = $('tooltip');
    if (!t) return;
    t.innerHTML = html;
    t.classList.remove('hidden');
    /* keep inside the viewport */
    var w = 270, h = t.offsetHeight || 120;
    var lx = Math.min(x + 16, window.innerWidth - w - 8);
    var ly = Math.min(y + 18, window.innerHeight - h - 8);
    t.style.left = Math.max(8, lx) + 'px';
    t.style.top = Math.max(8, ly) + 'px';
  },

  hideTooltip: function(){
    var t = $('tooltip');
    if (t) t.classList.add('hidden');
  },

  /* ================= REFINEMENT: combo + style grade ================= */

  updateCombo: function(count){
    var m = $('combo-meter');
    if (!m) return;
    if (count >= 2){
      m.classList.remove('hidden');
      $('combo-x').textContent = 'x' + count;
    } else {
      m.classList.add('hidden');
    }
  },

  popCombo: function(count){
    var m = $('combo-meter');
    if (!m) return;
    this.updateCombo(count);
    m.classList.remove('pop');
    void m.offsetWidth;
    m.classList.add('pop');
  },

  showStyleGrade: function(grade, waveNum){
    var b = $('banner');
    if (!b) return;
    var label = { S:'FLAWLESS', A:'SUPERB', B:'STEADY', C:'COSTLY' }[grade] || '';
    $('banner-title').textContent = 'WAVE ' + waveNum + ' CLEARED';
    $('banner-sub').innerHTML = 'style grade <span class="grade ' + grade + '">' + grade + '</span> ' + label;
    b.style.color = '#e9d5ff';
    b.classList.remove('hidden');
    void b.offsetWidth;
    b.classList.add('show');
    var self = this;
    if (this._bannerT) clearTimeout(this._bannerT);
    this._bannerT = setTimeout(function(){
      b.classList.remove('show');
      setTimeout(function(){ b.classList.add('hidden'); }, 400);
    }, 2600);
  },

  /* ================= REFINEMENT: minimap ================= */

  initMinimap: function(){
    var wrap = $('minimap-wrap'), cv = $('minimap');
    if (!wrap || !cv || this._minimapInit) return;
    this._minimapInit = true;
    var self = this;
    var drag = false;
    function toWorld(ev){
      var r = cv.getBoundingClientRect();
      var px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
      var g = self.game ? self.game.gridInfo() : { cols: 64, rows: 40, cell: 2 };
      return { x: px * g.cols * g.cell, z: py * g.rows * g.cell };
    }
    cv.addEventListener('pointerdown', function(ev){
      drag = true;
      cv.setPointerCapture && cv.setPointerCapture(ev.pointerId);
      var w = toWorld(ev);
      if (self.game) self.game.jumpCamera(w.x, w.z);
      ev.preventDefault();
    });
    cv.addEventListener('pointermove', function(ev){
      if (!drag) return;
      var w = toWorld(ev);
      if (self.game) self.game.jumpCamera(w.x, w.z);
    });
    cv.addEventListener('pointerup', function(){ drag = false; });
    cv.addEventListener('pointercancel', function(){ drag = false; });
  },

  drawMinimap: function(){
    var cv = $('minimap'), wrap = $('minimap-wrap');
    if (!cv || !wrap) return;
    var g = this.game;
    var show = !!(g && g.mode === 'game');
    wrap.classList.toggle('hidden', !show);
    if (!show) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var snap = g.lastSnap;
    var gi = g.gridInfo();
    var W = cv.width, H = cv.height;
    var sx = W / (gi.cols * gi.cell), sz = H / (gi.rows * gi.cell);
    function X(x){ return x * sx; }
    function Z(z){ return z * sz; }
    /* terrain */
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, 0, W, H);
    var sector = g.sector;
    if (sector && sector.blocked){
      ctx.fillStyle = '#1c2740';
      for (var bi = 0; bi < sector.blocked.length; bi++){
        var br = sector.blocked[bi];
        ctx.fillRect(X(br.x * gi.cell), Z(br.z * gi.cell), (br.w * gi.cell) * sx, (br.h * gi.cell) * sz);
      }
    }
    if (!snap) return;
    /* uplink ring */
    var hq = snap.hq || {};
    var ur = (snap.uplinkRadius || 0) * gi.cell;
    if (ur > 0 && hq.x != null){
      ctx.strokeStyle = 'rgba(34,211,238,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(hq.x), Z(hq.z), ur * sx, 0, Math.PI * 2);
      ctx.stroke();
      /* spire */
      ctx.fillStyle = '#7df9ff';
      ctx.fillRect(X(hq.x) - 2, Z(hq.z) - 2, 4, 4);
    }
    /* walls */
    ctx.fillStyle = '#8a97ad';
    var walls = snap.walls || [];
    for (var wi = 0; wi < walls.length; wi++){
      ctx.fillRect(X(walls[wi].x) - 1, Z(walls[wi].z) - 1, 2, 2);
    }
    /* towers + reactors */
    var towers = snap.towers || [];
    for (var ti = 0; ti < towers.length; ti++){
      ctx.fillStyle = towers[ti].dark ? '#4a5568' : '#22d3ee';
      ctx.fillRect(X(towers[ti].x) - 1.5, Z(towers[ti].z) - 1.5, 3, 3);
    }
    var reactors = snap.reactors || [];
    ctx.fillStyle = '#4ade80';
    for (var ri = 0; ri < reactors.length; ri++){
      ctx.fillRect(X(reactors[ri].x) - 1.5, Z(reactors[ri].z) - 1.5, 3, 3);
    }
    /* enemies */
    var enemies = snap.enemies || [];
    ctx.fillStyle = '#ff5a36';
    for (var ei = 0; ei < enemies.length; ei++){
      var er = Math.max(1.5, (enemies[ei].size || 8) * 0.12);
      ctx.beginPath();
      ctx.arc(X(enemies[ei].x), Z(enemies[ei].z), er, 0, Math.PI * 2);
      ctx.fill();
    }
    /* camera viewport rect */
    var vp = g.viewportRect && g.viewportRect();
    if (vp){
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(X(vp.x1), Z(vp.z1), (vp.x2 - vp.x1) * sx, (vp.z2 - vp.z1) * sz);
    }
  },

  /* ================= REFINEMENT: colonists ================= */

  _barkPick: function(arr){
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  },

  colonistBark: function(kind){
    var barks = NB.COLONIST_BARKS;
    if (!barks) return;
    var line = this._barkPick(barks[kind || 'cheers']);
    if (!line) return;
    var name = this._barkPick(barks.names) || 'Colonist';
    /* flavor fallback if the story worker only shipped worries */
    this.toast(name, line, '#9fd8ff');
  },

  setPanic: function(on){
    var v = $('panic-vignette');
    if (v) v.classList.toggle('hidden', !on);
  },

  /* ================= REFINEMENT: fx ================= */

  screenPulse: function(){
    var p = $('screen-pulse');
    if (!p) return;
    p.classList.remove('hidden', 'go');
    void p.offsetWidth;
    p.classList.add('go');
    var self = this;
    setTimeout(function(){ p.classList.add('hidden'); }, 560);
  },

  clickRipple: function(x, y){
    var fx = $('click-fx');
    if (!fx) return;
    var r = document.createElement('div');
    r.className = 'click-ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    fx.appendChild(r);
    setTimeout(function(){ if (r.parentNode) r.parentNode.removeChild(r); }, 450);
    while (fx.children.length > 12) fx.removeChild(fx.firstChild);
  },

  setOverclockPips: function(n, max){
    var p = $('oc-pips');
    if (!p) return;
    max = max || 3;
    p.innerHTML = '';
    for (var i = 0; i < max; i++){
      var d = document.createElement('span');
      d.className = 'oc-pip' + (i < n ? ' full' : '');
      p.appendChild(d);
    }
  },

  /* ================= REFINEMENT: tilt + parallax ================= */

  initTilt: function(){
    if (this._tiltInit) return;
    this._tiltInit = true;
    function arm(card){
      if (!card || card._tiltArmed) return;
      card._tiltArmed = true;
      card.classList.add('tilt');
      card.addEventListener('pointermove', function(ev){
        var r = card.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width - 0.5;
        var py = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(700px) rotateY(' + (px * 10).toFixed(2) +
          'deg) rotateX(' + (-py * 10).toFixed(2) + 'deg) translateZ(4px)';
      });
      card.addEventListener('pointerleave', function(){
        card.style.transform = '';
      });
    }
    var self = this;
    /* arm existing cards, and re-arm when lists rebuild */
    this._tiltArm = arm;
    setInterval(function(){
      var cards = document.querySelectorAll('.doctrine-card, .edict-card, .event-card, .roster-card');
      for (var i = 0; i < cards.length; i++) arm(cards[i]);
    }, 1500);
  },

  initParallax: function(){
    if (this._parInit) return;
    this._parInit = true;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener('pointermove', function(ev){
      tx = (ev.clientX / window.innerWidth - 0.5);
      ty = (ev.clientY / window.innerHeight - 0.5);
    }, { passive: true });
    setInterval(function(){
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      var layers = document.querySelectorAll('.parallax-layer');
      for (var i = 0; i < layers.length; i++){
        var depth = (i + 1) * 14;
        layers[i].style.transform = 'translate(' + (-cx * depth).toFixed(1) + 'px,' + (-cy * depth).toFixed(1) + 'px)';
      }
    }, 50);
  },

  /* wire the refinement bits that need one-time setup */
  initRefinement: function(){
    this.initMinimap();
    this.initTilt();
    this.initParallax();
    var self = this;
    var ira = $('ira-line');
    if (ira && !ira._reportArmed){
      ira._reportArmed = true;
      var ask = function(){
        if (self.game && typeof self.game.iraReport === 'function') self.game.iraReport();
      };
      ira.addEventListener('click', ask);
      ira.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); ask(); }
      });
    }
  },
};

NB.UI = UI;

})();
