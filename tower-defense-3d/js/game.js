/* Nova Bastion 3D - game controller.
 *
 * NB.Game owns the sim (local mode) or a remote snapshot stream (guest
 * mode), the 3D renderer, and the DOM UI. It runs the rAF loop, routes
 * pointer/keyboard input (tap select/place, wall-drag, pan/zoom/rotate,
 * pinch), drains sim events into toasts/banners/audio, polls the IRA
 * advisor, and hosts the multiplayer lobby seam.
 *
 * Guest mode: no local sim. Snapshots from net.onSnapshot() are rendered
 * directly; placement clicks become net.sendIntent() calls.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

var TAP_SLOP = 12;
var IRA_POLL_MS = 2000;
var DC_TIMEOUT = 30;
var PLAYER_COLORS = ['#7df9ff','#ffb347','#4ade80','#ff5a36','#c084fc','#f472b6'];

function sectors(){ return NB.SECTORS || []; }
function genCode(){
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'NOVA-' + s;
}

var Game = {
  canvas: null,
  renderer: null,
  demo: null,
  ui: null,
  sim: null,
  sector: null,
  sectorIndex: 0,
  mode: 'title',            /* title | levels | lobby | game */
  netMode: 'local',         /* local | host | guest */
  net: null,
  playerId: 'p0',
  lobby: null,              /* {code, players, isHost, sectorIdx, aiFill} */
  remoteSnap: null,
  remoteEvent: null,
  netVotes: null,
  lastSnap: null,
  placeMode: null,          /* {kind:'tower',towerId}|{kind:'wall'}|{kind:'reactor'}|{kind:'sell'} */
  selection: null,          /* {kind:'tower'|'wall'|'reactor', id, ref} */
  view: null,
  howtoReturn: 'title',
  killSeries: [],
  _killsAtWaveStart: 0,
  _lastWaveIndex: -1,
  _ended: false,
  _iraCtx: null,
  _iraLast: 0,
  _lastKillSnd: 0,
  _simFailed: false,
  _down: null,
  _wallDrag: null,
  _rotDrag: null,
  _pinch: null,
  _dcLeft: 0,
  _loop: null,
  _lastT: 0,

  /* ---------------- boot ---------------- */

  init: function(canvas, demo){
    this.canvas = canvas;
    this.demo = demo || null;
    this.ui = NB.UI;
    this.ui.init(this);
    this._iraCtx = { cooldowns: {}, time: 0 };
    this.view = { ghost: null, selected: null };
    var self = this;

    try {
      if (typeof NB.Renderer3D !== 'function') throw new Error('renderer missing');
      this.renderer = NB.Renderer3D(canvas);
      if (this.renderer && typeof this.renderer.init === 'function') this.renderer.init();
      if (this.renderer) this.renderer.eventListener = function(e){ self._onEvent(e); };
    } catch (e){
      this.renderer = null;
      var fb = document.getElementById('fallback');
      if (fb){
        fb.classList.remove('hidden');
        fb.textContent = 'The 3D battlefield could not start on this device (' +
          String((e && e.message) || e) + '). The menus still work; try a browser with WebGL.';
      }
    }

    this._loop = function(t){ self.frame(t); };
    this.wireInput();
    if (NB.Gamepad && typeof NB.Gamepad.attach === 'function'){
      try { NB.Gamepad.attach(this); } catch (e){}
    }
    this.ui.initRefinement();
    this.ui.show('screen-title');
    this.ui.updateTitleButton();
    this.setIRAMuteUI();
    requestAnimationFrame(this._loop);
  },

  setIRAMuteUI: function(){
    this.ui.setIRAMuted(!!this.ui.save.iraMuted);
  },

  safeSnapshot: function(){
    if (this.netMode === 'guest') return this.remoteSnap;
    if (!this.sim || typeof this.sim.snapshot !== 'function') return null;
    try { return this.sim.snapshot(); } catch (e){ return null; }
  },

  /* ---------------- flow ---------------- */

  titleStart: function(){
    this.snd('click');
    var s = this.ui.save;
    var has = s.unlocked > 1 || Object.keys(s.stars || {}).length > 0;
    if (has){ this.mode = 'levels'; this.howtoReturn = 'levels'; this.ui.show('screen-levels'); }
    else this.startSector(0);
  },

  titleCoop: function(){
    this.snd('click');
    this.mode = 'lobby';
    this.howtoReturn = 'lobby';
    this.ui.showLobby();
  },

  howtoBack: function(){
    if (this.howtoReturn === 'pause') this.ui.show('screen-pause');
    else if (this.howtoReturn === 'levels'){ this.mode = 'levels'; this.ui.show('screen-levels'); }
    else if (this.howtoReturn === 'lobby'){ this.mode = 'lobby'; this.ui.show('screen-lobby'); }
    else { this.mode = 'title'; this.ui.show('screen-title'); this.ui.updateTitleButton(); }
  },

  levelsBack: function(){
    this.mode = 'title';
    this.howtoReturn = 'title';
    this.ui.show('screen-title');
    this.ui.updateTitleButton();
  },

  quitToLevels: function(){
    this.snd('click');
    this._leaveGame();
    this.mode = 'levels';
    this.howtoReturn = 'levels';
    this.ui.buildLevels();
    this.ui.show('screen-levels');
  },

  quitToTitle: function(){
    this.snd('click');
    this._leaveGame();
    this.mode = 'title';
    this.howtoReturn = 'title';
    this.ui.show('screen-title');
    this.ui.updateTitleButton();
  },

  _leaveGame: function(){
    this.sim = null;
    this.remoteSnap = null;
    this.netMode = 'local';
    this.net = null;
    this.placeMode = null;
    this.selection = null;
    this._ended = false;
    this.view = { ghost: null, selected: null };
    if (this.demo && this.renderer){
      try { this.demo.start(); } catch (e){}
    }
  },

  startSector: function(i, opts){
    opts = opts || {};
    var list = sectors();
    if (!list[i]){ this.ui.toast('Sector unavailable', 'Sector data is missing.'); return; }
    if (typeof NB.createSim !== 'function'){
      this.ui.toast('Simulation not loaded', 'The sim layer (js/sim.js) failed to load.');
      return;
    }
    var self = this;
    var chapters = ((NB.STORY || {}).chapters) || [];
    var ch = chapters[i];
    var begin = function(){ self._beginSector(i, opts); };
    if (ch && ch.briefing){
      this.ui.showBriefing(ch, begin);
    } else {
      begin();
    }
  },

  _beginSector: function(i, opts){
    opts = opts || {};
    var list = sectors();
    this.sectorIndex = i;
    this.sector = list[i];
    this._simFailed = false;
    this._ended = false;
    this.killSeries = [];
    this._killsAtWaveStart = 0;
    this._lastWaveIndex = -1;
    this.netVotes = null;
    try {
      this.sim = NB.createSim(this.sector, { doctrine: opts.doctrine || 'vanguard', seed: (Date.now() % 100000) | 0 });
    } catch (e){
      this.ui.toast('Could not start sector', String((e && e.message) || e));
      this.sim = null;
      return;
    }
    /* co-op players */
    var players = opts.players || [{ id:'p0', name: opts.playerName || 'Commander',
      color: PLAYER_COLORS[0], doctrine: opts.doctrine || 'vanguard', isAI: false }];
    this.playerId = players[0].id || 'p0';
    for (var k = 1; k < players.length; k++){
      try { this.sim.addPlayer(players[k]); } catch (e){}
    }
    this.mode = 'game';
    this.netMode = opts.netMode || 'local';
    this.placeMode = null;
    this.selection = null;
    this.view = { ghost: null, selected: null };
    if (this.demo){ try { this.demo.stop(); } catch (e){} }
    if (this.renderer && this.renderer.camera){
      try {
        var snap0 = this.safeSnapshot();
        var hq = (snap0 && snap0.hq) || { x: 64, z: 40 };
        this.renderer.camera.reset(hq.x, hq.z);
      } catch (e){}
    }
    this.ui.closePanels();
    this.ui.hideModals();
    this.ui.show(null);
    this.ui.buildPalette();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
    this.ui.toast(this.sector.name || ('Sector ' + (i + 1)), this.sector.tagline || '');
  },

  restart: function(){
    if (this.mode !== 'game') return;
    this.snd('click');
    this.startSector(this.sectorIndex);
  },

  endReplay: function(){ this.snd('click'); this.startSector(this.sectorIndex); },
  endSectors: function(){ this.quitToLevels(); },
  endTitle: function(){ this.quitToTitle(); },

  playerById: function(pid){
    var snap = this.lastSnap;
    var players = (snap && snap.players) || [];
    for (var i = 0; i < players.length; i++) if (players[i].id === pid) return players[i];
    return null;
  },

  /* ---------------- multiplayer lobby ---------------- */

  hostCreate: function(opts){
    opts = opts || {};
    this.snd('click');
    var name = (opts.name || 'Commander').slice(0, 16) || 'Commander';
    var backend = NB.Net || null;
    if (backend && typeof backend.createRoom === 'function'){
      var self = this;
      try {
        backend.createRoom(opts, function(room){
          self._enterLobby(room, true);
        });
        return;
      } catch (e){
        this.ui.lobbyNote('Network uplink failed: ' + String((e && e.message) || e));
        return;
      }
    }
    /* no network layer: run a local room (host + optional AI commanders) */
    var players = [{ id:'p0', name:name, color:PLAYER_COLORS[0],
                     doctrine:opts.doctrine || 'vanguard', isAI:false }];
    if (opts.aiFill){
      var aiNames = ['IRA-Sigma','IRA-Kappa','IRA-Theta'];
      var aiDocs = ['engineer','warden','vanguard'];
      for (var i = 0; i < 3; i++){
        players.push({ id:'p' + (i + 1), name:aiNames[i], color:PLAYER_COLORS[i + 1],
                       doctrine: aiDocs[i % 3] === opts.doctrine ? 'vanguard' : aiDocs[i % 3], isAI:true });
      }
    }
    this.lobby = { code: genCode(), players: players, isHost: true,
                   sectorIdx: opts.sectorIdx || 0, aiFill: !!opts.aiFill,
                   hostName: name, hostDoctrine: opts.doctrine || 'vanguard' };
    this.netMode = 'local';
    this.ui.lobbyRoom(this.lobby.code, players, true);
    this.ui.lobbyNote(backend ? '' : 'Local room: no network uplink in this build, AI commanders fill the empty slots.');
  },

  hostJoin: function(code, opts){
    opts = opts || {};
    this.snd('click');
    code = String(code || '').trim().toUpperCase();
    if (!code){
      this.ui.lobbyNote('Enter a room code first.');
      return;
    }
    var backend = NB.Net || null;
    if (backend && typeof backend.joinRoom === 'function'){
      var self = this;
      try {
        backend.joinRoom(code, opts, function(room){
          self._enterLobby(room, false);
        });
      } catch (e){
        this.ui.lobbyNote('Join failed: ' + String((e && e.message) || e));
      }
      return;
    }
    this.ui.lobbyNote('No network uplink in this build: cannot join remote rooms.');
  },

  _enterLobby: function(room, isHost){
    /* room: {code, players:[{id,name,color,doctrine,isAI}], net} */
    this.lobby = { code: room.code, players: room.players || [], isHost: !!isHost,
                   sectorIdx: room.sectorIdx || 0, aiFill: !!room.aiFill,
                   hostName: '', hostDoctrine: 'vanguard' };
    if (room.net) this._attachNet(room.net, isHost);
    this.ui.lobbyRoom(room.code, this.lobby.players, !!isHost);
  },

  lobbyStart: function(){
    if (!this.lobby || !this.lobby.isHost) return;
    this.snd('click');
    var self = this;
    var opts = {
      players: self.lobby.players,
      doctrine: (self.lobby.players[0] || {}).doctrine || 'vanguard',
      playerName: (self.lobby.players[0] || {}).name || 'Commander',
      netMode: self.netMode
    };
    /* go through startSector so the chapter briefing still shows */
    var begin = function(){ self.startSector(self.lobby.sectorIdx, opts); };
    if (this.net && typeof this.net.startGame === 'function'){
      try { this.net.startGame(begin); } catch (e){ begin(); }
    } else {
      begin();
    }
  },

  lobbyLeave: function(){
    this.snd('click');
    if (this.net && typeof this.net.leave === 'function'){
      try { this.net.leave(); } catch (e){}
    }
    this.net = null;
    this.netMode = 'local';
    this.lobby = null;
    this.mode = 'lobby';
    this.ui.showLobby();
  },

  /* ---------------- guest (remote) mode ---------------- */

  enterGuestMode: function(net, playerId){
    /* net: {onSnapshot(cb), sendIntent(intent), onEvent(cb), getPlayers()} */
    this.net = net;
    this.playerId = playerId || 'guest';
    this.netMode = 'guest';
    this.sim = null;
    this.remoteSnap = null;
    this.mode = 'game';
    this.placeMode = null;
    this.selection = null;
    this.view = { ghost: null, selected: null };
    if (this.demo){ try { this.demo.stop(); } catch (e){} }
    var self = this;
    try {
      net.onSnapshot(function(snap){ self.remoteSnap = snap; });
      net.onEvent(function(ev){ self._onNetEvent(ev); });
    } catch (e){
      this.ui.toast('Link failed', String((e && e.message) || e));
    }
    this.ui.closePanels();
    this.ui.show(null);
    this.ui.buildPalette();
    this.ui.toast('Guest link established', 'Snapshots inbound. Your orders go to the host.');
  },

  sendIntent: function(intent){
    intent = intent || {};
    intent.playerId = this.playerId;
    if (this.netMode === 'guest' && this.net && typeof this.net.sendIntent === 'function'){
      try { this.net.sendIntent(intent); } catch (e){}
      return { ok: true, remote: true };
    }
    if (this.sim && typeof this.sim.applyIntent === 'function'){
      try { return this.sim.applyIntent(intent); } catch (e){ return { ok: false, reason: 'error' }; }
    }
    return { ok: false, reason: 'nosim' };
  },

  _onNetEvent: function(ev){
    if (!ev) return;
    if (ev.t === 'snapshot-players' && ev.players){
      /* refresh lobby player list if still in lobby */
    } else if (ev.t === 'start'){
      this.ui.toast('Operation started', 'The host has begun the defense.');
    } else if (ev.t === 'event'){
      this.remoteEvent = ev.event || null;
      this.netVotes = ev.votes || null;
      if (this.remoteEvent) this.ui.showEventModal(this.remoteEvent);
    } else if (ev.t === 'edict'){
      this.remoteEvent = null;
      this.netVotes = ev.votes || null;
      if (ev.offer) this.ui.showEdictModal(ev.offer);
    } else if (ev.t === 'votes'){
      this.netVotes = ev.votes || null;
      /* live-update open vote modals */
      if (this.remoteEvent && !document.getElementById('modal-event').classList.contains('hidden')){
        this.ui.showEventModal(this.remoteEvent);
      }
    } else if (ev.t === 'disconnect'){
      this._startDisconnect();
    } else if (ev.t === 'reconnect'){
      this._stopDisconnect();
    } else if (ev.t === 'end'){
      this._stopDisconnect();
      this._endGameRemote(ev.win, ev.data);
    }
  },

  _startDisconnect: function(){
    this._dcLeft = DC_TIMEOUT;
    this.ui.showDisconnect(true, this._dcLeft);
  },

  _stopDisconnect: function(){
    this._dcLeft = 0;
    this.ui.showDisconnect(false, 0);
    this.ui.toast('Link restored', 'Reconnected to the host.');
  },

  _tickDisconnect: function(dt){
    if (this._dcLeft > 0){
      this._dcLeft -= dt;
      this.ui.tickDisconnect(Math.max(0, this._dcLeft));
      if (this._dcLeft <= 0){
        this.ui.showDisconnect(false, 0);
        this.ui.showEnd({ win:false, levelName:'Run Ended',
          reason:'Connection to the host was lost.',
          players:this.lastSnap && this.lastSnap.players, statsByPlayer:this.lastSnap && this.lastSnap.statsByPlayer,
          stats:this.lastSnap && this.lastSnap.stats, killSeries:this.killSeries });
        this.mode = 'levels';
      }
    }
  },

  disconnectQuit: function(){
    this._dcLeft = 0;
    this.ui.showDisconnect(false, 0);
    this.quitToLevels();
  },

  /* ---------------- placement & actions ---------------- */

  togglePlaceMode: function(kind, towerId){
    if (this.mode !== 'game') return;
    if (kind === 'spire'){ this.ui.openSpire(); return; }
    var cur = this.placeMode;
    if (cur && cur.kind === kind && cur.towerId === towerId){
      this.placeMode = null;
    } else {
      this.placeMode = towerId ? { kind: kind, towerId: towerId } : { kind: kind };
      this.selection = null;
      this.ui.closePanels();
    }
    this.view.ghost = null;
    this.snd('click');
    this.ui.updateHUD(this.lastSnap);
  },

  cancelPlaceMode: function(){
    if (this.placeMode){
      this.placeMode = null;
      this.view.ghost = null;
      this.hideGhostHg();
      this.ui.updateHUD(this.lastSnap);
    }
  },

  reasonText: function(reason){
    var map = {
      gold:'Not enough gold.', blocked:'Cannot build there.', occupied:'Tile occupied.',
      locked:'Locked: advance to a later age.', over:'The sector is decided.',
      event:'Resolve the crossroads first.', unrest:'Unrest: construction frozen.',
      max:'Already at max.', full:'Already at full integrity.', wall:'Wall not found.',
      tower:'Unknown tower.', branch:'Pick a branch at max tier first.',
      tier:'Needs tier 3 to specialize.', choice:'Invalid choice.', none:'Nothing pending.',
      cooldown:'Overclock cooling down.', age:'Requires a later age.', kind:'Unknown order.'
    };
    return map[reason] || 'Order refused.';
  },

  buildAt: function(cx, cz, towerId){
    var res;
    if (this.netMode === 'guest'){
      this.sendIntent({ kind:'buildTower', cx:cx, cz:cz, towerId:towerId });
      return;
    }
    try { res = this.sim.buildTower(cx, cz, towerId, this.playerId); }
    catch (e){ this.snd('error'); return; }
    if (res && res.ok){
      this.snd('build');
      this.selection = null;
      this.ui.closePanels();
    } else {
      this.snd('error');
      this.ui.toast('Cannot build', this.reasonText(res && res.reason));
    }
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  buildWallDrag: function(x1, z1, x2, z2){
    var res;
    if (this.netMode === 'guest'){
      this.sendIntent({ kind:'buildWall', x1:x1, z1:z1, x2:x2, z2:z2 });
      return;
    }
    try { res = this.sim.buildWall(x1, z1, x2, z2, this.playerId); }
    catch (e){ this.snd('error'); return; }
    if (res && res.ok){
      this.snd('build');
      this.ui.toast('Wall raised', res.built + ' segment' + (res.built === 1 ? '' : 's') +
        (res.ranOut ? ' (gold ran out)' : ''), '#ffb347');
    } else {
      this.snd('error');
      this.ui.toast('Cannot build wall', this.reasonText(res && res.reason));
    }
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  buildReactorAt: function(cx, cz){
    var res;
    if (this.netMode === 'guest'){
      this.sendIntent({ kind:'buildReactor', cx:cx, cz:cz });
      return;
    }
    try { res = this.sim.buildReactor(cx, cz, this.playerId); }
    catch (e){ this.snd('error'); return; }
    if (res && res.ok){
      this.snd('build');
      this.selection = null;
      this.ui.closePanels();
    } else {
      this.snd('error');
      this.ui.toast('Cannot build reactor', this.reasonText(res && res.reason));
    }
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  upgradeSelected: function(){
    var sel = this.selection;
    if (!sel || sel.kind !== 'tower') return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'upgrade', instId:sel.id }); return; }
    var res = null;
    try { res = this.sim.upgrade(sel.id, this.playerId); } catch (e){}
    if (res && res.ok){ this.snd('upgrade'); }
    else { this.snd('error'); this.ui.toast('Cannot upgrade', this.reasonText(res && res.reason)); }
    this.ui.refreshTowerPanel();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  branchSelected: function(side){
    var sel = this.selection;
    if (!sel || sel.kind !== 'tower') return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'branch', instId:sel.id, which:side }); return; }
    var res = null;
    try { res = this.sim.chooseBranch(sel.id, side, this.playerId); } catch (e){}
    if (res && res.ok){ this.snd('branch'); }
    else { this.snd('error'); this.ui.toast('Cannot specialize', this.reasonText(res && res.reason)); }
    this.ui.refreshTowerPanel();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  sellSelected: function(){
    var sel = this.selection;
    if (!sel) return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'sell', instId:sel.id }); return; }
    var res = null;
    try { res = this.sim.sell(sel.id, this.playerId); } catch (e){}
    if (res && res.ok){
      this.snd('sell');
      this.ui.toast('Structure sold', '+' + (res.gold || 0) + 'g refunded');
    } else {
      this.snd('error');
      if (res && !res.ok) this.ui.toast('Cannot sell', this.reasonText(res.reason));
    }
    this.selection = null;
    this.ui.closePanels();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  repairSelected: function(){
    var sel = this.selection;
    if (!sel || sel.kind !== 'wall') return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'repair', instId:sel.id }); return; }
    var res = null;
    try { res = this.sim.repairWall(sel.id, this.playerId); } catch (e){}
    if (res && res.ok){
      this.snd('upgrade');
      this.ui.toast('Wall repaired', '-' + (res.cost || 0) + 'g');
    } else {
      this.snd('error');
      this.ui.toast('Cannot repair', this.reasonText(res && res.reason));
    }
    this.ui.refreshWallPanel();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  toggleOverclock: function(){
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'overclock' }); return; }
    if (!this.sim) return;
    var res = null;
    try { res = this.sim.toggleOverclock(); } catch (e){}
    if (res && res.ok){
      if (res.active){
        /* the big red button: slam + screen pulse */
        this.snd('overclock');
        this.ui.screenPulse();
      } else {
        this.snd('click');
      }
    } else {
      this.snd('error');
      this.ui.toast('Overclock refused', this.reasonText(res && res.reason));
    }
    this.ui.refreshSpirePanel();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  upgradeSpire: function(){
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'spireUpgrade' }); return; }
    if (!this.sim) return;
    var res = null;
    try { res = this.sim.upgradeSpire(this.playerId); } catch (e){}
    if (res && res.ok){ this.snd('upgrade'); }
    else { this.snd('error'); this.ui.toast('Cannot upgrade Spire', this.reasonText(res && res.reason)); }
    this.ui.refreshSpirePanel();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  towerLiveStats: function(instId){
    /* Reconstruct current damage/fireRate from definitions: tiers and
       branches are absolute overrides in NB.TOWERS. */
    var t = this.ui.findTower(instId);
    if (!t) return null;
    var def = (NB.TOWERS || {})[t.id] || {};
    var st = { damage: def.damage || 0, fireRate: def.fireRate || 0 };
    if (t.tier > 1){
      var td = (def.tiers || [])[t.tier - 2];
      if (td){ st.damage = td.damage || 0; st.fireRate = td.fireRate || 0; }
    }
    if (t.branch){
      var bd = ((def.branch || {})[t.branch]) || {};
      if (bd.damage != null) st.damage = bd.damage;
      if (bd.fireRate != null) st.fireRate = bd.fireRate;
    }
    return st;
  },

  chooseEvent: function(choiceId){
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'eventVote', choiceId:choiceId }); return; }
    if (!this.sim) return;
    var res = null;
    try { res = this.sim.chooseEvent(choiceId, this.playerId); } catch (e){}
    document.getElementById('modal-event').classList.add('hidden');
    if (res && res.ok){
      this.snd('branch');
      if (res.outcomeText) this.ui.toast('Decision made', res.outcomeText, '#ffb347');
    } else {
      this.snd('error');
    }
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  chooseEdict: function(id){
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'edictVote', edictId:id }); return; }
    if (!this.sim) return;
    var res = null;
    try { res = this.sim.chooseEdict(id, this.playerId); } catch (e){}
    document.getElementById('modal-edict').classList.add('hidden');
    if (res && res.ok){
      this.snd('upgrade');
      this.ui.toast('Edict signed', (res.name || id) + ' is now colony law.', '#ffb347');
    } else {
      this.snd('error');
    }
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  startWave: function(){
    if (this.mode !== 'game') return { ok:false };
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'startWave' }); return { ok:true }; }
    if (!this.sim) return { ok:false };
    var res = null;
    try { res = this.sim.startWave(); } catch (e){ res = { ok:false, reason:'error' }; }
    if (!(res && res.ok)) this.ui.toast('Cannot start wave', this.reasonText(res && res.reason));
    else this.snd('wavehorn');
    this.ui.closePanels();
    this.selection = null;
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
    return res || { ok:false };
  },

  callEarly: function(){
    if (this.mode !== 'game') return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'callEarly' }); return; }
    if (!this.sim) return;
    try { this.sim.callEarly(); this.snd('coin'); } catch (e){ this.snd('error'); }
    this.ui.closePanels();
    this.lastSnap = this.safeSnapshot();
    this.ui.updateHUD(this.lastSnap);
  },

  setSpeed: function(n){
    var speeds = (NB.CONFIG && NB.CONFIG.SPEEDS) || [1, 2, 3];
    if (speeds.indexOf(n) < 0) return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'speed', n:n }); return; }
    if (this.sim && this.mode === 'game'){
      try { this.sim.setSpeed(n); } catch (e){}
      this.snd('click');
      this.ui.updateHUD(this.safeSnapshot());
    }
  },

  togglePause: function(){
    if (this.mode !== 'game') return;
    if (this.netMode === 'guest'){ this.sendIntent({ kind:'pause' }); return; }
    if (!this.sim) return;
    var pre = this.safeSnapshot();
    if (pre && pre.over) return;
    try { this.sim.togglePause(); } catch (e){ return; }
    this.snd('click');
    var post = this.safeSnapshot();
    if (post && post.paused) this.ui.show('screen-pause');
    else { this.ui.show(null); if (post) this.ui.updateHUD(post); }
  },

  toggleMute: function(){
    if (!NB.Audio) return;
    var m = NB.Audio.toggle();
    this.ui.setMuteIcon(m);
    this.ui.toast(m ? 'Sound off' : 'Sound on');
  },

  toggleIRAMute: function(){
    this.ui.setIRAMuted(!this.ui.save.iraMuted);
    this.snd('click');
  },

  /* ---------------- input ---------------- */

  groundPoint: function(clientX, clientY){
    if (!this.renderer || typeof this.renderer.screenToGround !== 'function') return null;
    try { return this.renderer.screenToGround(clientX, clientY); }
    catch (e){ return null; }
  },

  groundCell: function(clientX, clientY){
    var p = this.groundPoint(clientX, clientY);
    if (!p) return null;
    var c = this.cellFromGround(p.x, p.z);
    return { cx: c.cx, cz: c.cz, x: p.x, z: p.z };
  },

  /* Grid geometry without depending on a local sim (guests have none).
   * Mirrors sim.worldToCell: cell = floor(world / cellSize). */
  gridInfo: function(){
    if (this.sim && typeof this.sim.gridSize === 'function'){
      try { return this.sim.gridSize(); } catch (e){}
    }
    if (this.sector){
      return { cols: this.sector.cols || 64, rows: this.sector.rows || 40, cell: 2 };
    }
    return { cols: 64, rows: 40, cell: 2 };
  },

  cellFromGround: function(x, z){
    var g = this.gridInfo();
    var cell = g.cell || 2;
    return { cx: Math.floor(x / cell), cz: Math.floor(z / cell) };
  },

  pickAt: function(clientX, clientY){
    /* Prefer the renderer's raycast pick; fall back to a snapshot scan. */
    if (this.renderer && typeof this.renderer.pickStructure === 'function'){
      try {
        var hit = this.renderer.pickStructure(clientX, clientY);
        if (hit && hit.ref){
          var kind = hit.kind || 'tower';
          var id = (kind === 'wall') ? hit.ref.id : hit.ref.instId;
          return { kind: kind, id: id, ref: hit.ref };
        }
      } catch (e){}
    }
    var p = this.groundPoint(clientX, clientY);
    if (!p || !this.lastSnap) return null;
    var snap = this.lastSnap, best = null, bestD = 2.2 * 2.2, i, d2, dx, dz;
    var lists = [
      { kind:'tower', arr: snap.towers || [], idf: function(r){ return r.instId; } },
      { kind:'reactor', arr: snap.reactors || [], idf: function(r){ return r.instId; } },
      { kind:'wall', arr: snap.walls || [], idf: function(r){ return r.id; } }
    ];
    for (var l = 0; l < lists.length; l++){
      var arr = lists[l].arr;
      for (i = 0; i < arr.length; i++){
        dx = arr[i].x - p.x; dz = arr[i].z - p.z; d2 = dx * dx + dz * dz;
        if (d2 < bestD){ bestD = d2; best = { kind: lists[l].kind, id: lists[l].idf(arr[i]), ref: arr[i] }; }
      }
    }
    return best;
  },

  selectAt: function(clientX, clientY){
    var hit = this.pickAt(clientX, clientY);
    if (hit){
      this.selection = hit;
      this.view.selected = hit;
      this.snd('click');
      if (hit.kind === 'tower') this.ui.openTower(hit.ref);
      else if (hit.kind === 'wall') this.ui.openWall(hit.ref);
      else if (hit.kind === 'reactor') this.ui.openReactor(hit.ref);
      return true;
    }
    return false;
  },

  clearSelection: function(){
    this.selection = null;
    this.view.selected = null;
  },

  updateGhost: function(clientX, clientY){
    var mode = this.placeMode;
    if (!mode || !this.sim || this.netMode === 'guest'){ this.view.ghost = null; this.hideGhostHg(); return; }
    if (mode.kind === 'wall'){ return; /* drag ghost handled separately */ }
    var cell = this.groundCell(clientX, clientY);
    if (!cell){ this.view.ghost = null; this.hideGhostHg(); return; }
    var valid = false;
    try {
      if (mode.kind === 'tower'){
        var r = this.sim.canPlaceTower(cell.cx, cell.cz, mode.towerId, this.playerId);
        valid = !!(r && r.ok);
      } else if (mode.kind === 'reactor'){
        valid = this._reactorCellOk(cell.cx, cell.cz);
      }
    } catch (e){ valid = false; }
    this.view.ghost = { cells: [{ cx: cell.cx, cz: cell.cz }], valid: valid };
    /* high-ground indicator on the placement ghost */
    var hg = false;
    try {
      if (mode.kind === 'tower' && typeof this.sim.cellHeight === 'function'){
        hg = this.sim.cellHeight(cell.cx, cell.cz) >= 2.0;
      }
    } catch (e){}
    if (hg) this.showGhostHg(clientX, clientY);
    else this.hideGhostHg();
  },

  showGhostHg: function(x, y){
    var d = document.getElementById('ghost-hg');
    if (!d){
      d = document.createElement('div');
      d.id = 'ghost-hg';
      d.className = 'ghost-hg';
      d.textContent = 'HIGH GROUND +15% range';
      document.getElementById('app').appendChild(d);
    }
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.display = 'block';
  },

  hideGhostHg: function(){
    var d = document.getElementById('ghost-hg');
    if (d) d.style.display = 'none';
  },

  _reactorCellOk: function(cx, cz){
    /* mirror of the sim's reactor placement preconditions for the ghost */
    try {
      if (typeof this.sim.isBuildable === 'function') return !!this.sim.isBuildable(cx, cz);
    } catch (e){}
    return true;
  },

  updateWallGhost: function(x1, z1, x2, z2){
    if (!this.sim || typeof this.sim.wallCells !== 'function'){ this.view.ghost = null; return; }
    var plan = null;
    try { plan = this.sim.wallCells(x1, z1, x2, z2); } catch (e){}
    if (!plan){ this.view.ghost = null; return; }
    var gold = (this.lastSnap && this.lastSnap.gold) || 0;
    var cost = (NB.CONFIG && NB.CONFIG.WALL_COST) || 8;
    var afford = Math.floor(gold / cost);
    var cells = (plan.cells || []).slice(0, Math.max(0, afford));
    this.view.ghost = { cells: cells, valid: cells.length > 0 };
  },

  wireInput: function(){
    var self = this;
    var cv = this.canvas;

    cv.addEventListener('contextmenu', function(ev){ ev.preventDefault(); });

    cv.addEventListener('pointerdown', function(ev){ self.onPointerDown(ev); });
    cv.addEventListener('pointermove', function(ev){ self.onPointerMove(ev); });
    cv.addEventListener('pointerup', function(ev){ self.onPointerUp(ev); });
    cv.addEventListener('pointercancel', function(ev){ self.onPointerCancel(ev); });
    cv.addEventListener('pointerleave', function(){
      self.view.ghost = null;
      self._down = null; self._wallDrag = null; self._rotDrag = null;
      self.ui.hideTooltip();
      self.hideGhostHg();
    });
    cv.addEventListener('wheel', function(ev){
      if (self.mode !== 'game' || !self.renderer) return;
      ev.preventDefault();
      try { self.renderer.camera.zoomBy(ev.deltaY > 0 ? 1.12 : 0.89); } catch (e){}
    }, { passive: false });

    window.addEventListener('keydown', function(ev){ self.onKey(ev); });
    window.addEventListener('resize', function(){
      if (self.renderer && typeof self.renderer.resize === 'function'){
        try { self.renderer.resize(); } catch (e){}
      }
    });
  },

  _pointers: {},

  onPointerDown: function(ev){
    if (this.mode !== 'game') return;
    if (this.ui.anyScreenOpen() || this.ui.anyModalOpen()) return;
    this._pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var n = Object.keys(this._pointers).length;
    if (n === 2){
      var ids = Object.keys(this._pointers);
      var a = this._pointers[ids[0]], b = this._pointers[ids[1]];
      this._pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      this._down = null; this._wallDrag = null; this._rotDrag = null;
      return;
    }
    try { if (NB.Audio) NB.Audio.init(); } catch (e){}
    if (ev.button === 2){
      /* right button: rotate on drag, cancel placement on plain click */
      this._rotDrag = { x: ev.clientX, y: ev.clientY, moved: false };
      return;
    }
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    var snap = this.lastSnap;
    if (snap && (snap.paused || snap.over)) return;
    if (this.placeMode && this.placeMode.kind === 'wall'){
      var cell = this.groundCell(ev.clientX, ev.clientY);
      if (cell){
        this._wallDrag = { x1: cell.cx, z1: cell.cz, x2: cell.cx, z2: cell.cz };
        this.updateWallGhost(cell.cx, cell.cz, cell.cx, cell.cz);
      }
      return;
    }
    this._down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, panning: false };
  },

  onPointerMove: function(ev){
    if (this.mode !== 'game') return;
    var pt = this._pointers[ev.pointerId];
    if (pt){ pt.x = ev.clientX; pt.y = ev.clientY; }
    var ids = Object.keys(this._pointers);
    if (ids.length === 2 && this._pinch){
      var a = this._pointers[ids[0]], b = this._pointers[ids[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._pinch.d > 0 && this.renderer){
        try { this.renderer.camera.zoomBy(this._pinch.d / Math.max(1, d)); } catch (e){}
      }
      this._pinch.d = d;
      return;
    }
    if (this._rotDrag){
      var rdx = ev.clientX - this._rotDrag.x, rdy = ev.clientY - this._rotDrag.y;
      if (Math.abs(rdx) + Math.abs(rdy) > TAP_SLOP){
        this._rotDrag.moved = true;
        if (this.renderer){
          try { this.renderer.camera.rotateBy(rdx * 0.005); } catch (e){}
        }
        this._rotDrag.x = ev.clientX; this._rotDrag.y = ev.clientY;
      }
      return;
    }
    if (this._wallDrag){
      var cell = this.groundCell(ev.clientX, ev.clientY);
      if (cell){
        this._wallDrag.x2 = cell.cx; this._wallDrag.z2 = cell.cz;
        this.updateWallGhost(this._wallDrag.x1, this._wallDrag.z1, cell.cx, cell.cz);
      }
      return;
    }
    if (this._down){
      var mdx = ev.clientX - this._down.x, mdy = ev.clientY - this._down.y;
      if (!this._down.panning && Math.abs(mdx) + Math.abs(mdy) > TAP_SLOP){
        this._down.panning = true;
      }
      if (this._down.panning && this.renderer){
        var scale = (this.renderer.camera && this.renderer.camera.dist ? 1 : 1);
        try { this.renderer.camera.panBy(-mdx * 0.12, -mdy * 0.12); } catch (e){}
        this._down.x = ev.clientX; this._down.y = ev.clientY;
      }
      return;
    }
    /* hover ghost */
    this.updateGhost(ev.clientX, ev.clientY);
    /* rich hover tooltip (throttled) */
    this.hoverTip(ev.clientX, ev.clientY);
  },

  onPointerUp: function(ev){
    delete this._pointers[ev.pointerId];
    this._pinch = null;
    if (this.mode !== 'game') return;
    if (this._rotDrag){
      var wasDrag = this._rotDrag.moved;
      this._rotDrag = null;
      if (!wasDrag){
        /* plain right-click: cancel placement / deselect */
        this.cancelPlaceMode();
        this.clearSelection();
        this.ui.closePanels();
      }
      return;
    }
    if (this._wallDrag){
      var w = this._wallDrag;
      this._wallDrag = null;
      this.view.ghost = null;
      if (w.x1 !== w.x2 || w.z1 !== w.z2){
        this.buildWallDrag(w.x1, w.z1, w.x2, w.z2);
      } else {
        this.updateGhost(ev.clientX, ev.clientY);
      }
      return;
    }
    var d = this._down;
    this._down = null;
    if (!d || d.id !== ev.pointerId) return;
    if (d.panning) return;
    if (this.ui.anyScreenOpen() || this.ui.anyModalOpen()) return;
    var snap = this.lastSnap;
    if (snap && (snap.paused || snap.over)) return;
    this.onTap(ev.clientX, ev.clientY);
  },

  onPointerCancel: function(ev){
    delete this._pointers[ev.pointerId];
    this._pinch = null;
    this._down = null; this._wallDrag = null; this._rotDrag = null;
    this.view.ghost = null;
  },

  onTap: function(clientX, clientY){
    /* every canvas tap gets tactile feedback */
    this.ui.clickRipple(clientX, clientY);
    var mode = this.placeMode;
    if (mode && mode.kind === 'sell'){
      var hit = this.pickAt(clientX, clientY);
      if (hit){
        this.selection = hit;
        this.sellSelected();
      }
      return;
    }
    if (mode && (mode.kind === 'tower' || mode.kind === 'reactor')){
      var cell = this.groundCell(clientX, clientY);
      if (!cell) return;
      if (mode.kind === 'tower') this.buildAt(cell.cx, cell.cz, mode.towerId);
      else this.buildReactorAt(cell.cx, cell.cz);
      return;
    }
    /* no placement mode: interactive world objects first */
    if (this.tapWorld(clientX, clientY)) return;
    /* ...then structures, else deselect + clear focus */
    if (this.selectAt(clientX, clientY)) return;
    this.clearFocus();
    this.clearSelection();
    this.ui.closePanels();
  },

  /* Clickable world objects: enemies (focus fire), barrels, drops, Spire.
   * Returns true when something handled the tap. */
  tapWorld: function(clientX, clientY){
    /* focus fire: enemy click (no placement mode is already guaranteed) */
    var enemyId = this.pickEnemyAt(clientX, clientY);
    if (enemyId != null){
      this.setFocus(enemyId);
      return true;
    }
    var p = this.groundPoint(clientX, clientY);
    if (!p || !this.lastSnap) return false;
    var snap = this.lastSnap;
    /* barrels: volatile, click to detonate */
    var barrels = snap.barrels || [];
    for (var i = 0; i < barrels.length; i++){
      var b = barrels[i];
      if (!b.alive) continue;
      var dx = b.x - p.x, dz = b.z - p.z;
      if (dx * dx + dz * dz < 4.5){
        this.detonateBarrel(b.id);
        return true;
      }
    }
    /* supply drops: click to collect */
    var drops = snap.drops || [];
    for (var j = 0; j < drops.length; j++){
      var d = drops[j];
      var ddx = d.x - p.x, ddz = d.z - p.z;
      if (ddx * ddx + ddz * ddz < 4.5){
        this.collectDrop(d.id);
        return true;
      }
    }
    /* the Command Spire itself opens its panel */
    var hq = snap.hq || {};
    if (hq.x != null){
      var hx = hq.x - p.x, hz = hq.z - p.z;
      if (hx * hx + hz * hz < 20){
        this.ui.openSpire();
        this.snd('click');
        return true;
      }
    }
    return false;
  },

  pickEnemyAt: function(clientX, clientY){
    if (!this.renderer || typeof this.renderer.pickEnemy !== 'function') return null;
    try { return this.renderer.pickEnemy(clientX, clientY); }
    catch (e){ return null; }
  },

  enemyById: function(id){
    var snap = this.lastSnap;
    if (!snap || id == null) return null;
    var arr = snap.enemies || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  },

  setFocus: function(enemyId){
    var e = this.enemyById(enemyId);
    var name = e ? ((NB.ENEMIES[e.type] || {}).name || e.type) : 'target';
    if (this.netMode === 'guest'){
      this.sendIntent({ kind: 'focus', enemyId: enemyId });
    } else if (this.sim && typeof this.sim.setFocusFire === 'function'){
      try { this.sim.setFocusFire(enemyId); } catch (err){}
    }
    this.view.focusId = enemyId;
    this.snd('focus');
    this.ui.toast('Focus fire: ' + name, 'all towers prioritize this target', '#ffd34d');
  },

  clearFocus: function(){
    if (this.view.focusId == null) return;
    this.view.focusId = null;
    if (this.netMode === 'guest'){
      this.sendIntent({ kind: 'focus', enemyId: null });
    } else if (this.sim && typeof this.sim.setFocusFire === 'function'){
      try { this.sim.setFocusFire(null); } catch (err){}
    }
  },

  detonateBarrel: function(id){
    if (this.netMode === 'guest'){
      this.sendIntent({ kind: 'detonate', barrelId: id });
      return;
    }
    if (!this.sim || typeof this.sim.detonateBarrel !== 'function') return;
    var r = null;
    try { r = this.sim.detonateBarrel(id); } catch (e){}
    if (r && r.ok){
      this.snd('boom');
      this.ui.toast('Barrel detonated', 'the Rust burns', '#ffb347');
    } else {
      this.snd('error');
    }
  },

  collectDrop: function(id){
    if (this.netMode === 'guest'){
      this.sendIntent({ kind: 'collect', dropId: id });
      return;
    }
    if (!this.sim || typeof this.sim.collectDrop !== 'function') return;
    var r = null;
    try { r = this.sim.collectDrop(id); } catch (e){}
    if (r && r.ok){
      this.snd('coin');
      this.ui.toast('Supply secured', '+' + (r.amount || 0) + 'g', '#4ade80');
      this.lastSnap = this.safeSnapshot();
      this.ui.updateHUD(this.lastSnap);
    } else {
      this.snd('error');
    }
  },

  iraReport: function(){
    if (!NB.IRA || typeof NB.IRA.report !== 'function') return;
    var snap = this.iraSnapshot() || this.lastSnap;
    var line = null;
    try { line = NB.IRA.report(snap); } catch (e){ line = null; }
    if (line){
      this._iraLast = this.timeNow() * 1000;
      this.ui.setIRA(line);
      this.snd('ira');
    }
  },

  onKey: function(ev){
    if (ev.code === 'Space'){
      ev.preventDefault();
      if (this.mode === 'game' && !this.ui.anyScreenOpen() && !this.ui.anyModalOpen()) this.togglePause();
      return;
    }
    if (ev.key === 'Escape' || ev.key === 'Esc'){
      if (this.placeMode){ this.cancelPlaceMode(); return; }
      if (this.mode === 'game' && !this.ui.anyScreenOpen() && !this.ui.anyModalOpen()){
        this.ui.closePanels();
        this.clearSelection();
      }
      return;
    }
    if (this.mode !== 'game' || !this.renderer) return;
    if (this.ui.anyScreenOpen() || this.ui.anyModalOpen()) return;
    if (ev.key === '1') this.setSpeed(1);
    else if (ev.key === '2') this.setSpeed(2);
    else if (ev.key === '3') this.setSpeed(3);
    else if (ev.key === 'q' || ev.key === 'Q'){ try { this.renderer.camera.rotateBy(0.18); } catch (e){} }
    else if (ev.key === 'e' || ev.key === 'E'){ try { this.renderer.camera.rotateBy(-0.18); } catch (e){} }
  },

  /* ---------------- rich hover tooltips ---------------- */

  _hoverLast: 0,
  _hoverKey: '',

  hoverTip: function(clientX, clientY){
    if (this.mode !== 'game' || this.ui.anyScreenOpen() || this.ui.anyModalOpen()){
      this.ui.hideTooltip();
      this._hoverKey = '';
      return;
    }
    var now = this.timeNow();
    if (now - this._hoverLast < 0.09) return;
    this._hoverLast = now;
    var html = this.tipHtml(clientX, clientY);
    var key = html ? html.length + ':' + html.slice(0, 40) : '';
    if (key !== this._hoverKey){
      this._hoverKey = key;
      if (html) this.ui.showTooltip(html, clientX, clientY);
      else this.ui.hideTooltip();
    } else if (html){
      /* follow the mouse */
      this.ui.showTooltip(html, clientX, clientY);
    }
  },

  tipHtml: function(clientX, clientY){
    var snap = this.lastSnap;
    if (!snap) return '';
    /* enemies first */
    var eid = this.pickEnemyAt(clientX, clientY);
    if (eid != null){
      var e = this.enemyById(eid);
      if (e) return this.enemyTip(e);
    }
    /* structures */
    var hit = this.pickAt(clientX, clientY);
    if (hit && hit.ref){
      if (hit.kind === 'tower') return this.towerTip(hit.ref);
      if (hit.kind === 'wall') return this.wallTip(hit.ref);
      if (hit.kind === 'reactor') return this.reactorTip(hit.ref);
    }
    var p = this.groundPoint(clientX, clientY);
    if (p){
      /* barrels */
      var barrels = snap.barrels || [];
      for (var i = 0; i < barrels.length; i++){
        var b = barrels[i];
        if (!b.alive) continue;
        var dx = b.x - p.x, dz = b.z - p.z;
        if (dx * dx + dz * dz < 4.5){
          return '<div class="tt-name">VOLATILE BARREL</div>' +
            '<div class="tt-sub">Unstable fuel cell.</div>' +
            '<div class="tt-weak">Volatile. Click to detonate.</div>';
        }
      }
      /* supply drops */
      var drops = snap.drops || [];
      for (var j = 0; j < drops.length; j++){
        var d = drops[j];
        var ddx = d.x - p.x, ddz = d.z - p.z;
        if (ddx * ddx + ddz * ddz < 4.5){
          return '<div class="tt-name">SUPPLY DROP</div>' +
            '<div class="tt-row"><span>Salvage</span><b class="tt-good">+' + (d.amount || 0) + 'g</b></div>' +
            '<div class="tt-sub">Click to collect. Fades in ' + (d.expiresIn || 0) + 's.</div>';
        }
      }
      /* colonists near the Spire */
      var hq = snap.hq || {};
      if (hq.x != null){
        var hx = hq.x - p.x, hz = hq.z - p.z;
        if (hx * hx + hz * hz < 30){
          return this.colonistTip();
        }
      }
    }
    return '';
  },

  enemyTip: function(e){
    var def = (NB.ENEMIES || {})[e.type] || {};
    var name = def.name || e.type;
    var hpFrac = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0;
    var weak = this.enemyWeakness(def);
    var html = '<div class="tt-name tt-bad">' + name + '</div>' +
      '<div class="bar"><div class="fill" style="width:' + Math.round(hpFrac * 100) + '%"></div></div>' +
      '<div class="tt-row"><span>HP</span><b>' + e.hp + ' / ' + e.maxHp + '</b></div>' +
      '<div class="tt-row"><span>Bounty</span><b class="tt-good">' + (def.bounty || 0) + 'g</b></div>';
    if (weak) html += '<div class="tt-weak">' + weak + '</div>';
    html += '<div class="tt-sub">Click to focus fire.</div>';
    return html;
  },

  enemyWeakness: function(def){
    if (!def) return '';
    if (def.affinity === 'hardened') return 'Hardened chassis: heavy ordnance (mortar) cracks it.';
    if (def.insulated) return 'Insulated: shrugs off arc and cryo.';
    if ((def.speed || 0) >= 4.5) return 'Fast: slow it with cryo before it slips past.';
    if ((def.hp || 0) >= 200) return 'Armored bulk: focus fire and barrels.';
    return def.desc || '';
  },

  towerTip: function(t){
    var def = (NB.TOWERS || {})[t.id] || {};
    var dps = this.towerDps(t);
    var html = '<div class="tt-name">' + (def.name || t.id) + ' <span class="tt-sub">T' + (t.tier || 1) + '</span></div>' +
      '<div class="tt-row"><span>DPS</span><b>' + dps + '</b></div>' +
      '<div class="tt-row"><span>Kills</span><b>' + (t.kills || 0) + '</b></div>';
    if (t.veteran) html += '<div class="tt-good">VETERAN: +damage, +range</div>';
    if (t.highGround) html += '<div><span class="hg-badge">HIGH GROUND +15% range</span></div>';
    if (t.dark) html += '<div class="tt-bad">DARK: outside uplink range</div>';
    else if (!t.powered) html += '<div class="tt-bad">UNPOWERED</div>';
    return html;
  },

  towerDps: function(t){
    var s = t.liveStats || t.stats || {};
    var dmg = s.damage || 0, rate = s.fireRate || 0;
    if (!dmg || !rate) return '-';
    return (Math.round(dmg * rate * 10) / 10);
  },

  wallTip: function(w){
    var frac = w.maxHp > 0 ? Math.max(0, w.hp / w.maxHp) : 0;
    return '<div class="tt-name">BASTION WALL</div>' +
      '<div class="bar"><div class="fill" style="width:' + Math.round(frac * 100) + '%"></div></div>' +
      '<div class="tt-row"><span>Integrity</span><b>' + Math.ceil(w.hp) + ' / ' + Math.ceil(w.maxHp) + '</b></div>' +
      '<div class="tt-sub">Click to repair or sell.</div>';
  },

  reactorTip: function(r){
    var html = '<div class="tt-name">REACTOR</div>' +
      '<div class="tt-row"><span>Output</span><b class="tt-good">+energy</b></div>';
    if (r.dark) html += '<div class="tt-bad">DARK: outside uplink range</div>';
    html += '<div class="tt-sub">Click to manage.</div>';
    return html;
  },

  colonistTip: function(){
    var barks = NB.COLONIST_BARKS || {};
    var names = barks.names || ['Colonist'];
    var worries = barks.worries || ['Holding the line.'];
    var name = names[Math.floor(Math.random() * names.length)];
    var worry = worries[Math.floor(Math.random() * worries.length)];
    return '<div class="tt-name">' + name + '</div>' +
      '<div class="tt-sub">Colonist, Hab Deck</div>' +
      '<div style="margin-top:3px;font-style:italic">"'+ worry + '"</div>';
  },

  snd: function(name){
    try {
      if (NB.Audio && typeof NB.Audio.play === 'function') NB.Audio.play(name);
    } catch (e){}
  },

  timeNow: function(){
    try { return performance.now() / 1000; } catch (e){ return 0; }
  },

  /* ---------------- sim events ---------------- */

  _onEvent: function(e){
    if (!e || !e.t) return;
    switch (e.t){
      case 'announce': {
        var txt = String(e.text || '');
        if (/ AGE$/.test(txt)){
          /* age-up: momentous banner + sting */
          this.ui.banner(txt, e.sub || 'new options unlocked', '#ffb347', 3200);
          this.snd('sting');
          this.snd('upgrade');
        } else if (txt === 'BLACKOUT SURGE'){
          this.ui.banner(txt, e.sub || '', '#ff5a36', 2600);
          this.snd('alarm');
        } else if (/^RAMPAGE x(\d+)$/.test(txt)){
          /* combo milestone: pop the meter */
          var n = parseInt(RegExp.$1, 10) || 0;
          this.ui.popCombo(n);
          this.snd('combo');
        } else if (/^STYLE ([SABC])$/.test(txt)){
          var grade = RegExp.$1;
          var waveNum = 0;
          var m = /wave (\d+) graded/.exec(String(e.sub || ''));
          if (m) waveNum = parseInt(m[1], 10) || 0;
          this.ui.showStyleGrade(grade, waveNum);
          this.snd(grade === 'S' ? 'victory' : 'upgrade');
        } else if (/^WAVE \d+ CLEARED$/.test(txt)){
          this.ui.toast(txt, e.sub || '', e.color || '#4ade80');
          /* ambient colonist cheer, not every time */
          if (Math.random() < 0.45) this.ui.colonistBark('cheers');
        } else {
          this.ui.toast(txt, e.sub || '', e.color || '#7df9ff');
        }
        break;
      }
      case 'boom': this.snd('boom'); break;
      case 'structureDown':
        this.snd('leak');
        this.ui.toast('Structure lost', e.sub || '', '#ff5a36');
        break;
      case 'wallHit': {
        var now = this.timeNow();
        if (now - this._lastKillSnd > 0.4){ this._lastKillSnd = now; this.snd('click'); }
        break;
      }
      case 'gold': break; /* too frequent for audio */
      default: break;
    }
  },

  drainAndRoute: function(){
    if (!this.sim || typeof this.sim.drainEvents !== 'function') return;
    var evs = null;
    try { evs = this.sim.drainEvents(); } catch (e){ return; }
    if (!evs) return;
    for (var i = 0; i < evs.length; i++) this._onEvent(evs[i]);
  },

  /* ---------------- IRA advisor ---------------- */

  iraSnapshot: function(){
    var s = this.lastSnap;
    if (!s) return null;
    var out = {
      gold: s.gold, energyUsed: s.energyUsed, energyCap: s.energyCap,
      morale: s.morale, moraleState: s.moraleState,
      surge: s.surge, uplinkRadius: s.uplinkRadius,
      waveIndex: s.waveIndex, waveActive: s.waveActive,
      overclock: s.overclock, players: s.players,
      cols: 64, rows: 40, gates: (this.sector && this.sector.gates) || [],
      breached: false,
      towers: (s.towers || []).map(function(t){
        return { id: t.id, name: t.name, dark: t.dark, powered: t.powered,
                 veteran: t.veteran, activeSynergies: t.synergies || [] };
      }),
      walls: (s.walls || []).map(function(w){ return { hp: w.hp, maxHp: w.maxHp }; }),
      enemies: s.enemies || []
    };
    if (this.sim && typeof this.sim.gridSize === 'function'){
      try { var gs = this.sim.gridSize(); out.cols = gs.cols; out.rows = gs.rows; } catch (e){}
    }
    return out;
  },

  pollIRA: function(nowMs){
    if (!NB.IRA || typeof NB.IRA.advise !== 'function') return;
    if (this.mode !== 'game' || this.netMode === 'guest') return;
    if (nowMs - this._iraLast < IRA_POLL_MS) return;
    this._iraLast = nowMs;
    var snap = this.iraSnapshot();
    if (!snap || snap.over) return;
    this._iraCtx.time = nowMs / 1000;
    var line = null;
    try { line = NB.IRA.advise(snap, this._iraCtx); } catch (e){ line = null; }
    if (line) this.ui.setIRA(line);
  },

  /* ---------------- end of run ---------------- */

  _endGame: function(win){
    if (this._ended) return;
    this._ended = true;
    var snap = this.lastSnap || {};
    this.snd(win ? 'victory' : 'defeat');
    var levelId = this.sector ? this.sector.id : ('sector-' + (this.sectorIndex + 1));
    var stars = win ? Math.max(1, Math.min(3, snap.stars | 0 || 1)) : 0;
    if (win) this.ui.recordVictory(levelId, stars, this.sectorIndex);
    var chapters = ((NB.STORY || {}).chapters) || [];
    var ch = chapters[this.sectorIndex];
    var self = this;
    var showStats = function(){
      self.ui.showEnd({
        win: win,
        stars: stars,
        levelName: (self.sector && self.sector.name) || (win ? 'Sector Cleared' : 'Sector Lost'),
        reason: win ? '' : 'The Command Spire fell.',
        wave: !win && snap.wavesTotal ? ('Wave ' + Math.min(snap.waveIndex + 1, snap.wavesTotal) + ' / ' + snap.wavesTotal) : '',
        players: snap.players,
        statsByPlayer: snap.statsByPlayer,
        stats: snap.stats,
        killSeries: self.killSeries
      });
    };
    if (ch){
      this.ui.showDebrief(ch, win, showStats);
    } else {
      showStats();
    }
  },

  _endGameRemote: function(win, data){
    this.ui.showEnd({
      win: !!win,
      stars: (data && data.stars) | 0,
      levelName: (data && data.levelName) || (win ? 'Sector Cleared' : 'Run Ended'),
      reason: (data && data.reason) || '',
      players: (data && data.players) || (this.lastSnap && this.lastSnap.players),
      statsByPlayer: (data && data.statsByPlayer) || (this.lastSnap && this.lastSnap.statsByPlayer),
      stats: (data && data.stats) || (this.lastSnap && this.lastSnap.stats),
      killSeries: this.killSeries
    });
  },

  /* ---------------- main loop ---------------- */

  frame: function(t){
    var nowMs = t || 0;
    var now = nowMs / 1000;
    var dt = this._lastT ? Math.min(0.1, now - this._lastT) : 0.016;
    this._lastT = now;

    if (NB.Gamepad && typeof NB.Gamepad.poll === 'function'){
      try { NB.Gamepad.poll(this, dt); } catch (e){}
    }

    if (this.mode === 'game' && this.renderer){
      var snap = null;
      if (this.netMode === 'guest'){
        snap = this.remoteSnap;
        this.lastSnap = snap;
        this._tickDisconnect(dt);
        if (snap){
          if (snap.focusId !== this.view.focusId) this.view.focusId = snap.focusId || null;
          var gcombo = snap.combo || {};
          this.ui.updateCombo(gcombo.count || 0);
          this.updatePanic(snap);
          if (nowMs - (this._mmLast || 0) > 100){
            this._mmLast = nowMs;
            this.ui.drawMinimap();
          }
          try {
            this.renderer.draw({ snapshot: function(){ return snap; }, drainEvents: function(){ return []; } },
              this.view, dt);
          } catch (e){}
          this.ui.updateHUD(snap);
          /* guest vote modals */
          if (snap.pendingEvent && this.remoteEvent && !this.ui.anyModalOpen()){
            this.ui.showEventModal(this.remoteEvent);
          }
        }
      } else if (this.sim){
        if (!this._simFailed){
          /* The sim exposes paused/over through the snapshot; never assume
           * an internal state field exists. */
          var pre = this.safeSnapshot();
          if (pre && !pre.paused && !pre.over){
            try { this.sim.update(dt); }
            catch (e){
              this._simFailed = true;
              this.ui.toast('Simulation error', String((e && e.message) || e));
            }
          }
        }
        this.drainAndRoute();
        try { this.renderer.draw(this.sim, this.view, dt); } catch (e){}
        snap = this.safeSnapshot();
        this.lastSnap = snap;
        if (snap){
          /* kill series for the post-game sparkline */
          if (snap.waveIndex !== this._lastWaveIndex){
            if (this._lastWaveIndex >= 0 && snap.stats){
              this.killSeries.push(Math.max(0, (snap.stats.kills | 0) - this._killsAtWaveStart));
            }
            this._lastWaveIndex = snap.waveIndex;
            this._killsAtWaveStart = snap.stats ? (snap.stats.kills | 0) : 0;
          }
          /* sync focus marker from sim (clears when the target dies) */
          if (snap.focusId !== this.view.focusId) this.view.focusId = snap.focusId || null;
          /* combo meter follows the rolling kill window */
          var combo = snap.combo || {};
          this.ui.updateCombo(combo.count || 0);
          /* panic vignette: rust near the Spire */
          this.updatePanic(snap);
          /* minimap at ~10Hz */
          if (nowMs - (this._mmLast || 0) > 100){
            this._mmLast = nowMs;
            this.ui.drawMinimap();
          }
          this.ui.updateHUD(snap);
          this.ui.pollModals();
          if (snap.over && !this._ended) this._endGame(!!snap.victory);
        }
      }
      this.pollIRA(nowMs);
    }
    requestAnimationFrame(this._loop);
  },

  /* red vignette while enemies press the Spire */
  updatePanic: function(snap){
    var hq = snap.hq || {};
    var panic = false;
    if (hq.x != null && snap.enemies){
      for (var i = 0; i < snap.enemies.length; i++){
        var e = snap.enemies[i];
        var dx = e.x - hq.x, dz = e.z - hq.z;
        if (dx * dx + dz * dz < 220){ panic = true; break; }
      }
    }
    if (panic !== this._panicOn){
      this._panicOn = panic;
      this.ui.setPanic(panic);
      if (panic) this.ui.colonistBark('panics');
    }
  },

  /* camera jump for the minimap */
  jumpCamera: function(x, z){
    if (!this.renderer || !this.renderer.camera) return;
    try {
      if (typeof this.renderer.camera.cinematicTo === 'function'){
        this.renderer.camera.cinematicTo(x, z, 0, 0.45);
      }
    } catch (e){}
  },

  /* approximate visible rect for the minimap, via ground projection */
  viewportRect: function(){
    if (!this.renderer || typeof this.renderer.screenToGround !== 'function') return null;
    try {
      var cv = this.canvas;
      var w = cv.clientWidth || cv.width || 960, h = cv.clientHeight || cv.height || 600;
      var c = this.renderer.screenToGround(w / 2, h / 2);
      var e = this.renderer.screenToGround(w / 2 + 120, h / 2);
      if (!c || !e) return null;
      var perPx = Math.abs(e.x - c.x) / 120 || 0.2;
      var hw = (w / 2) * perPx, hh = (h / 2) * perPx;
      return { x1: c.x - hw, z1: c.z - hh, x2: c.x + hw, z2: c.z + hh };
    } catch (err){ return null; }
  }
};

NB.Game = Game;

})();
