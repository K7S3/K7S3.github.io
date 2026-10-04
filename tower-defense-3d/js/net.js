/* Nova Bastion 3D - multiplayer networking (host-authoritative, PeerJS)
 *
 * Roles:
 *   Host runs the REAL sim. Guests never run a sim; they render from
 *   snapshots broadcast by the host at 5 Hz and send intents over a
 *   reliable data channel. The host applies every intent through
 *   sim.applyIntent, so guests get the same validation, costs, and rules
 *   as local players.
 *
 * Signaling uses the free public PeerJS cloud with the default config
 * (no keys). The PeerJS build is vendored at js/vendor/peerjs.min.js, so
 * there is no runtime CDN dependency. If P2P setup fails, hostRoom and
 * joinRoom reject with a clear error; single-player never touches this
 * file and always works.
 *
 * Transport injection for tests: override NB.Net.peerFactory(id) and
 * NB.Net.connectFactory(peer, id, opts) with stubs. Everything else
 * (protocol, heartbeats, timeouts) runs unchanged.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

var ROOM_PREFIX = 'novabastion-v1-';
var PROTOCOL_VERSION = 1;
var SNAP_MS = 200;                 /* host -> guest at 5 Hz */
var HEARTBEAT_MS = 5000;
var HOST_SILENCE_MS = 15000;       /* guest: no snap -> reconnecting */
var GUEST_SILENCE_MS = 15000;      /* host: silent guest gets dropped */
var RECONNECT_GRACE_MS = 30000;
var JOIN_TIMEOUT_MS = 15000;
var MAX_PLAYERS = 4;

var PLAYER_COLORS = ['#7df9ff', '#ffb347', '#a78bfa', '#a3e635'];

function makeCode(){
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var out = '';
  for (var i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
function noop(){}

var Net = {
  VERSION: PROTOCOL_VERSION,
  MAX_PLAYERS: MAX_PLAYERS,

  /* ---- session state ---- */
  role: null,            /* 'host' | 'guest' | null */
  state: 'idle',         /* guest: idle|connecting|playing|reconnecting|closed */
  code: null,
  playerId: null,
  peer: null,
  sim: null,             /* host only: the real sim */
  ai: null,              /* host only: NB.AI manager */
  roster: [],            /* [{id,name,color,doctrine,isAI}] display truth */
  guests: [],            /* host only: [{conn,playerId,name,lastSeen,helloTimer}] */
  guestConn: null,       /* guest only */
  seq: 0,                /* host snap seq */
  guestSeq: 0,
  pendingAcks: {},       /* guest: seq -> resolve */
  snapA: null, snapB: null, snapT_A: 0, snapT_B: 0,
  lastSnapAt: 0,
  lastEvent: null, lastEdict: null, lastPreview: null,
  reconnectDeadline: 0,
  _timers: [],
  _snapCount: 0,

  /* ---- callbacks (assign before hostRoom/joinRoom) ---- */
  onPlayers: noop,   /* (players) roster changed */
  onSnapshot: noop,  /* (snap) guest received a snapshot */
  onEvent: noop,     /* (event) toast/banner/audio event object */
  onClose: noop,     /* (reason) session ended unexpectedly */
  onError: noop,     /* (message) non-fatal error surfaced to UI */

  /* ---- transport (override in tests) ---- */
  peerFactory: function(id){
    if (typeof Peer === 'undefined'){
      throw new Error('Multiplayer library failed to load (js/vendor/peerjs.min.js). Single-player still works.');
    }
    return new Peer(id, {}); /* default PeerJS cloud config, no keys */
  },
  connectFactory: function(peer, id, opts){
    return peer.connect(id, opts || { reliable: true });
  },

  isHost: function(){ return Net.role === 'host'; },
  isGuest: function(){ return Net.role === 'guest'; },
  connected: function(){ return Net.role === 'host' || Net.role === 'guest'; },

  reconnectLeft: function(){
    if (Net.state !== 'reconnecting') return 0;
    return Math.max(0, Math.ceil((Net.reconnectDeadline - now()) / 1000));
  },

  _later: function(ms, fn){
    var id = setInterval(fn, ms);
    Net._timers.push(id);
    return id;
  },
  _clearTimers: function(){
    for (var i = 0; i < Net._timers.length; i++){
      try { clearInterval(Net._timers[i]); } catch (e){}
    }
    Net._timers = [];
  },

  /* ============================================================
   * HOST
   * ============================================================ */
  hostRoom: function(opts){
    opts = opts || {};
    return new Promise(function(resolve, reject){
      var attempts = 0;
      function attempt(){
        attempts++;
        var code = makeCode();
        var peer;
        try {
          peer = Net.peerFactory(ROOM_PREFIX + code);
        } catch (e){
          reject(e);
          return;
        }
        var done = false;
        peer.on('open', function(){
          if (done) return;
          done = true;
          try {
            Net._startHost(peer, code, opts);
            resolve({ code: code });
          } catch (e){
            try { peer.destroy(); } catch (x){}
            reject(e);
          }
        });
        peer.on('error', function(err){
          if (!done && err && err.type === 'unavailable-id' && attempts < 4){
            try { peer.destroy(); } catch (x){}
            attempt(); /* room code collision: mint another */
            return;
          }
          if (!done){
            done = true;
            try { peer.destroy(); } catch (x){}
            reject(new Error('Could not reach the PeerJS signaling cloud (' +
                             ((err && err.type) || 'network error') +
                             '). Check your connection. Single-player still works.'));
          } else {
            Net.onError('Peer error: ' + ((err && err.type) || 'unknown'));
          }
        });
      }
      attempt();
    });
  },

  _startHost: function(peer, code, opts){
    Net.leave(true); /* clean slate, silent */
    var sectorList = NB.SECTORS || NB.LEVELS || [];
    var sectorDef = sectorList[opts.sectorIndex || 0] || {};
    var sim;
    try {
      sim = NB.createSim(sectorDef, { doctrine: opts.doctrine || 'vanguard' });
    } catch (e){
      throw new Error('Could not create the sector sim: ' + (e && e.message));
    }
    Net.role = 'host';
    Net.state = 'playing';
    Net.code = code;
    Net.peer = peer;
    Net.sim = sim;
    Net.playerId = 'p0';
    Net.seq = 0;
    Net.roster = [{
      id: 'p0', name: opts.name || 'Commander',
      color: PLAYER_COLORS[0], doctrine: opts.doctrine || 'vanguard', isAI: false
    }];
    /* AI commanders fill empty seats (host-only bots) */
    if (NB.AI && typeof NB.AI.createManager === 'function'){
      Net.ai = NB.AI.createManager(sim);
      if (opts.aiFill !== false){
        var added = Net.ai.fillSeats({ aiFill: true,
                                       difficulty: opts.difficulty || 'regular' });
        for (var i = 0; i < added.length; i++){
          var p = added[i].player;
          Net.roster.push({ id: p.id, name: p.name, color: p.color,
                            doctrine: p.doctrine, isAI: true });
        }
      }
    }
    peer.on('connection', function(conn){ Net._onGuestConnection(conn); });
    peer.on('disconnected', function(){
      try { peer.reconnect(); } catch (e){}
    });

    /* host loop: AI ticks at 10 Hz, snapshots at 5 Hz, heartbeat sweep */
    var aiAcc = 0;
    Net._later(100, function(){
      if (Net.role !== 'host') return;
      try {
        if (Net.ai) Net.ai.tick(0.1);
      } catch (e){ /* a bot must never kill the host loop */ }
      aiAcc++;
      if (aiAcc % 2 === 0) Net._broadcastSnap();
      if (aiAcc % 50 === 0) Net._sweepGuests();
    });
    Net.onPlayers(Net.roster.slice());
  },

  _enrichedSnap: function(){
    var snap = Net.sim.snapshot();
    var ev = null, ed = null;
    try { ev = Net.sim.getEvent(); } catch (e){}
    try { ed = Net.sim.getEdictOffer(); } catch (e){}
    return {
      t: 'snap', seq: ++Net.seq, snap: snap,
      event: ev, edict: ed,
      preview: Net.sim.previewWave(snap.waveIndex)
    };
  },

  _broadcastSnap: function(){
    if (!Net.guests.length) return;
    var msg = Net._enrichedSnap();
    Net._sendAll(msg);
    /* sim events + AI announces -> every guest's toast/banner/audio feed */
    var evs = [];
    try { evs = Net.sim.drainEvents() || []; } catch (e){}
    try {
      if (Net.ai){
        var aevs = Net.ai.drainEvents();
        for (var i = 0; i < aevs.length; i++) evs.push(aevs[i]);
      }
    } catch (e){}
    if (evs.length) Net._sendAll({ t: 'ev', events: evs });
  },

  _sendAll: function(msg){
    for (var i = 0; i < Net.guests.length; i++){
      var g = Net.guests[i];
      try {
        if (g.conn && g.conn.open) g.conn.send(msg);
      } catch (e){ /* drop on sweep */ }
    }
  },

  _announceAll: function(text, color){
    Net._sendAll({ t: 'ev', events: [{ t: 'announce', x: 0, z: 0,
                                       color: color || '#7df9ff',
                                       text: text, sub: '' }] });
  },

  _syncRoster: function(){
    Net._sendAll({ t: 'players', players: Net.roster.slice() });
    Net.onPlayers(Net.roster.slice());
  },

  _onGuestConnection: function(conn){
    var rec = { conn: conn, playerId: null, name: 'guest',
                lastSeen: now(), helloTimer: null };
    conn.on('open', function(){
      rec.helloTimer = setTimeout(function(){
        if (!rec.playerId){
          try { conn.send({ t: 'bye', reason: 'no-hello' }); } catch (e){}
          setTimeout(function(){ try { conn.close(); } catch (e){} }, 300);
        }
      }, 10000);
    });
    conn.on('data', function(msg){ Net._onGuestData(rec, msg); });
    var gone = function(){
      if (rec.helloTimer) clearTimeout(rec.helloTimer);
      Net._dropGuest(rec, 'left');
    };
    conn.on('close', gone);
    conn.on('error', function(){ /* handled by close */ });
  },

  _onGuestData: function(rec, msg){
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello'){
      Net._admitGuest(rec, msg);
      return;
    }
    if (!rec.playerId) return; /* ignore pre-hello chatter */
    rec.lastSeen = now();
    if (msg.t === 'hb') return;
    if (msg.t === 'intent'){
      var res;
      try {
        res = Net.sim.applyIntent({
          seq: msg.seq, playerId: rec.playerId, kind: msg.kind,
          cx: msg.cx, cz: msg.cz, towerId: msg.towerId,
          x1: msg.x1, z1: msg.z1, x2: msg.x2, z2: msg.z2,
          instId: msg.instId, which: msg.which,
          choiceId: msg.choiceId, edictId: msg.edictId, n: msg.n
        });
      } catch (e){
        res = { ok: false, reason: 'exception' };
      }
      /* force the guest's seat; a forged playerId never validates */
      try {
        rec.conn.send({ t: 'ack', seq: msg.seq,
                        ok: !!res.ok, reason: res.reason });
      } catch (e){}
      return;
    }
  },

  _admitGuest: function(rec, hello){
    if (rec.helloTimer) clearTimeout(rec.helloTimer);
    var name = String((hello && hello.name) || 'Commander').slice(0, 24) || 'Commander';
    var doctrine = (NB.DOCTRINES && NB.DOCTRINES[hello.doctrine])
      ? hello.doctrine : 'vanguard';
    var seatId = null, color = PLAYER_COLORS[1];
    if (Net.roster.length < MAX_PLAYERS){
      seatId = 'p' + Net.roster.length;
      color = PLAYER_COLORS[Net.roster.length % PLAYER_COLORS.length];
      var added = Net.sim.addPlayer({ id: seatId, name: name,
                                      color: color, doctrine: doctrine });
      if (!added.ok) seatId = null;
    }
    if (!seatId && Net.ai){
      /* full room: a human takes over an AI commander's seat */
      var bot = null;
      for (var i = 0; i < Net.ai.commanders.length; i++){
        bot = Net.ai.commanders[i];
        break;
      }
      if (bot){
        Net.ai.remove(bot.id);
        seatId = bot.id;
        Net._announceAll(bot.name + ' stands down. ' + name + ' takes the seat.',
                         '#a3e635');
      }
    }
    if (!seatId){
      try { rec.conn.send({ t: 'bye', reason: 'full' }); } catch (e){}
      setTimeout(function(){ try { rec.conn.close(); } catch (e){} }, 300);
      return;
    }
    rec.playerId = seatId;
    rec.name = name;
    rec.lastSeen = now();
    var entry = null;
    for (var j = 0; j < Net.roster.length; j++){
      if (Net.roster[j].id === seatId) entry = Net.roster[j];
    }
    if (entry){
      entry.name = name; entry.color = color;
      entry.doctrine = doctrine; entry.isAI = false;
    } else {
      Net.roster.push({ id: seatId, name: name, color: color,
                        doctrine: doctrine, isAI: false });
    }
    Net.guests.push(rec);
    var snap = Net._enrichedSnap();
    try {
      rec.conn.send({ t: 'welcome', playerId: seatId, code: Net.code,
                      players: Net.roster.slice(),
                      snap: snap.snap, event: snap.event,
                      edict: snap.edict, preview: snap.preview });
    } catch (e){}
    Net._announceAll(name + ' joined the bastion', color);
    Net._syncRoster();
  },

  _dropGuest: function(rec, why){
    var idx = Net.guests.indexOf(rec);
    if (idx < 0) return;
    Net.guests.splice(idx, 1);
    var name = rec.name || 'a commander';
    Net._announceAll(name + ' disconnected (' + why + ')', '#ff8a5c');
    /* an AI takes over the dropped seat so the colony does not go dark */
    var seatId = rec.playerId;
    if (seatId && Net.ai){
      var botName = name + '-AI';
      var cmd = new NB.AI.Commander(Net.sim,
        { id: seatId, name: botName, color: '#a3e635',
          doctrine: 'engineer', isAI: true },
        { difficulty: 'regular' });
      Net.ai.commanders.push(cmd);
      for (var i = 0; i < Net.roster.length; i++){
        if (Net.roster[i].id === seatId){
          Net.roster[i].name = botName;
          Net.roster[i].isAI = true;
          break;
        }
      }
      Net._announceAll(botName + ' assuming control of the empty seat.', '#a3e635');
    }
    Net._syncRoster();
  },

  _sweepGuests: function(){
    var t = now();
    for (var i = Net.guests.length - 1; i >= 0; i--){
      var g = Net.guests[i];
      if (t - g.lastSeen > GUEST_SILENCE_MS){
        try { g.conn.close(); } catch (e){}
        Net._dropGuest(g, 'silent too long');
      }
    }
  },

  /* ============================================================
   * GUEST
   * ============================================================ */
  joinRoom: function(code, opts){
    opts = opts || {};
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return new Promise(function(resolve, reject){
      if (!code){
        reject(new Error('Enter the 4-character room code shown on the host screen.'));
        return;
      }
      var peer;
      try {
        peer = Net.peerFactory(undefined); /* random guest id */
      } catch (e){
        reject(e);
        return;
      }
      var done = false;
      var finish = function(err, value){
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err){
          try { peer.destroy(); } catch (e){}
          Net._reset();
          reject(err);
        } else resolve(value);
      };
      var timer = setTimeout(function(){
        finish(new Error('Could not reach host "' + code +
                         '": no answer within 15s. Check the room code and your connection.'));
      }, JOIN_TIMEOUT_MS);
      peer.on('open', function(){
        var conn;
        try {
          conn = Net.connectFactory(peer, ROOM_PREFIX + code);
        } catch (e){
          finish(e);
          return;
        }
        conn.on('open', function(){
          Net._startGuest(peer, conn, code, opts);
          try {
            conn.send({ t: 'hello', v: PROTOCOL_VERSION,
                        name: opts.name || 'Commander',
                        doctrine: opts.doctrine || 'vanguard' });
          } catch (e){
            finish(new Error('Lost the connection before saying hello.'));
          }
        });
        conn.on('data', function(msg){ Net._onHostData(msg, finish); });
        conn.on('close', function(){
          if (!done) finish(new Error('The host closed the connection.'));
          else Net._onHostGone('closed');
        });
        conn.on('error', function(){ /* close follows */ });
      });
      peer.on('error', function(err){
        if (err && err.type === 'peer-unavailable'){
          finish(new Error('No host found for room code "' + code +
                           '". Check the code with the host.'));
        } else if (!done){
          Net.onError('Peer error: ' + ((err && err.type) || 'unknown'));
        }
      });
    });
  },

  _startGuest: function(peer, conn, code, opts){
    Net.leave(true);
    Net.role = 'guest';
    Net.state = 'connecting';
    Net.code = code;
    Net.peer = peer;
    Net.guestConn = conn;
    Net.pendingAcks = {};
    Net.snapA = null; Net.snapB = null;
    Net.lastSnapAt = now();
    /* heartbeat to the host */
    Net._later(HEARTBEAT_MS, function(){
      if (Net.role !== 'guest') return;
      try {
        if (Net.guestConn && Net.guestConn.open)
          Net.guestConn.send({ t: 'hb', playerId: Net.playerId, at: Date.now() });
      } catch (e){}
    });
    /* host-silence watchdog: reconnecting overlay, then give up */
    Net._later(1000, function(){
      if (Net.role !== 'guest') return;
      var t = now();
      if (Net.state === 'playing' && t - Net.lastSnapAt > HOST_SILENCE_MS){
        Net.state = 'reconnecting';
        Net.reconnectDeadline = t + RECONNECT_GRACE_MS;
      } else if (Net.state === 'reconnecting' && t > Net.reconnectDeadline){
        Net._teardown();
        Net.onClose('host-lost');
      }
    });
  },

  _onHostData: function(msg, finish){
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'welcome'){
      Net.playerId = msg.playerId;
      Net.roster = msg.players || [];
      Net.state = 'playing';
      Net.lastSnapAt = now();
      Net._pushSnap(msg);
      Net.onPlayers(Net.roster.slice());
      if (finish) finish(null, { playerId: msg.playerId, players: Net.roster.slice() });
      return;
    }
    if (msg.t === 'bye'){
      var reason = msg.reason === 'full' ? 'Room is full (4 commanders).'
                                         : 'Kicked by host.';
      if (finish) finish(new Error(reason));
      else { Net._teardown(); Net.onClose('kicked'); }
      return;
    }
    if (Net.role !== 'guest') return;
    if (msg.t === 'snap'){
      Net._pushSnap(msg);
      Net.onSnapshot(msg.snap);
    } else if (msg.t === 'ev'){
      var evs = msg.events || [];
      for (var i = 0; i < evs.length; i++) Net.onEvent(evs[i]);
    } else if (msg.t === 'ack'){
      var res = Net.pendingAcks[msg.seq];
      if (res){ delete Net.pendingAcks[msg.seq]; res({ ok: !!msg.ok, reason: msg.reason }); }
    } else if (msg.t === 'players'){
      Net.roster = msg.players || [];
      Net.onPlayers(Net.roster.slice());
    }
  },

  _onHostGone: function(reason){
    if (Net.role !== 'guest') return;
    Net._teardown();
    Net.onClose(reason || 'host-lost');
  },

  _pushSnap: function(msg){
    Net.snapA = Net.snapB;
    Net.snapT_A = Net.snapT_B;
    Net.snapB = msg.snap;
    Net.snapT_B = now();
    Net.lastSnapAt = Net.snapT_B;
    Net.lastEvent = msg.event || null;
    Net.lastEdict = msg.edict || null;
    Net.lastPreview = msg.preview || null;
    if (Net.state === 'reconnecting') Net.state = 'playing';
  },

  /* Interpolated render state for guests: enemy and projectile positions
   * are lerped between the last two snapshots so 5 Hz updates still look
   * smooth. Everything else is taken from the newest snapshot. */
  getRenderState: function(){
    if (Net.role !== 'guest' || !Net.snapB) return null;
    if (!Net.snapA || Net.snapT_B <= Net.snapT_A) return Net.snapB;
    var span = Net.snapT_B - Net.snapT_A;
    var alpha = (now() - Net.snapT_B) / span;
    if (alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;
    var out = {};
    for (var k in Net.snapB){
      if (Object.prototype.hasOwnProperty.call(Net.snapB, k)) out[k] = Net.snapB[k];
    }
    out.enemies = Net._interpEnemies(alpha);
    out.projectiles = Net._interpProjectiles(alpha);
    out._interp = alpha;
    return out;
  },

  _interpEnemies: function(alpha){
    var A = {}, i;
    var ea = (Net.snapA && Net.snapA.enemies) || [];
    for (i = 0; i < ea.length; i++) A[ea[i].id] = ea[i];
    var eb = Net.snapB.enemies || [];
    var out = [];
    for (i = 0; i < eb.length; i++){
      var b = eb[i], a = A[b.id], e = {};
      for (var k in b){
        if (Object.prototype.hasOwnProperty.call(b, k)) e[k] = b[k];
      }
      if (a){
        e.x = a.x + (b.x - a.x) * alpha;
        e.z = a.z + (b.z - a.z) * alpha;
      }
      out.push(e);
    }
    return out;
  },

  _interpProjectiles: function(alpha){
    var pa = (Net.snapA && Net.snapA.projectiles) || [];
    var pb = Net.snapB.projectiles || [];
    if (pa.length !== pb.length) return pb;
    var out = [];
    for (var i = 0; i < pb.length; i++){
      var b = pb[i], a = pa[i], p = {};
      for (var k in b){
        if (Object.prototype.hasOwnProperty.call(b, k)) p[k] = b[k];
      }
      if (typeof a.x === 'number' && typeof b.x === 'number'){
        p.x = a.x + (b.x - a.x) * alpha;
        p.z = a.z + (b.z - a.z) * alpha;
      }
      out.push(p);
    }
    return out;
  },

  /* Send an intent. Host: applied to the real sim immediately and the
   * ack resolves at once. Guest: forwarded to the host; the returned
   * promise resolves with the host's {ok, reason} ack. */
  sendIntent: function(intent){
    var self = this;
    intent = intent || {};
    if (Net.role === 'host' && Net.sim){
      var res;
      try {
        res = Net.sim.applyIntent({
          playerId: Net.playerId, kind: intent.kind,
          cx: intent.cx, cz: intent.cz, towerId: intent.towerId,
          x1: intent.x1, z1: intent.z1, x2: intent.x2, z2: intent.z2,
          instId: intent.instId, which: intent.which,
          choiceId: intent.choiceId, edictId: intent.edictId, n: intent.n
        });
      } catch (e){
        res = { ok: false, reason: 'exception' };
      }
      return Promise.resolve(res);
    }
    if (Net.role === 'guest' && Net.guestConn){
      return new Promise(function(resolve){
        var seq = ++Net.guestSeq;
        Net.pendingAcks[seq] = resolve;
        var msg = { t: 'intent', seq: seq, playerId: Net.playerId,
                    kind: intent.kind,
                    cx: intent.cx, cz: intent.cz, towerId: intent.towerId,
                    x1: intent.x1, z1: intent.z1, x2: intent.x2, z2: intent.z2,
                    instId: intent.instId, which: intent.which,
                    choiceId: intent.choiceId, edictId: intent.edictId,
                    n: intent.n };
        try {
          Net.guestConn.send(msg);
        } catch (e){
          delete Net.pendingAcks[seq];
          resolve({ ok: false, reason: 'send-failed' });
          return;
        }
        setTimeout(function(){
          if (Net.pendingAcks[seq]){
            delete Net.pendingAcks[seq];
            resolve({ ok: false, reason: 'ack-timeout' });
          }
        }, 5000);
      });
    }
    return Promise.resolve({ ok: false, reason: 'not-connected' });
  },

  /* Leave the room. silent=true skips onClose (used internally). */
  leave: function(silent){
    var wasGuest = Net.role === 'guest';
    Net._teardown();
    if (!silent && wasGuest) Net.onClose('left');
  },

  _reset: function(){
    Net.role = null;
    Net.state = 'idle';
    Net.code = null;
    Net.playerId = null;
    Net.roster = [];
    Net.snapA = null; Net.snapB = null;
    Net.lastEvent = null; Net.lastEdict = null; Net.lastPreview = null;
    Net.pendingAcks = {};
  },

  _teardown: function(){
    Net._clearTimers();
    for (var i = 0; i < Net.guests.length; i++){
      try { Net.guests[i].conn.close(); } catch (e){}
    }
    Net.guests = [];
    if (Net.guestConn){
      try { Net.guestConn.close(); } catch (e){}
      Net.guestConn = null;
    }
    if (Net.peer){
      try { Net.peer.destroy(); } catch (e){}
      Net.peer = null;
    }
    Net.sim = null;
    Net.ai = null;
    Net._reset();
  }
};

NB.Net = Net;

})();
