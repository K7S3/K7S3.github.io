/* Nova Bastion - audio */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* Procedural WebAudio SFX. No assets. Context is created lazily on the
   first user gesture so autoplay policies never block the page. */

var MUTE_KEY = 'nova_bastion_muted_v1';
var ctx = null;
var master = null;
var muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage unavailable */ }

function ensureCtx() {
  if (!ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') { ctx.resume(); }
  return ctx;
}

/* Short enveloped oscillator blip. f1 null means no pitch sweep. */
function tone(type, f0, f1, dur, vol, delay) {
  if (!ensureCtx()) { return; }
  var t = ctx.currentTime + (delay || 0);
  var o = ctx.createOscillator();
  var g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f0), t);
  if (f1 && f1 !== f0) { o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

/* Filtered noise burst with a decaying envelope. */
function noise(dur, vol, ftype, freq, delay) {
  if (!ensureCtx()) { return; }
  var t = ctx.currentTime + (delay || 0);
  var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * (1 - i / len); }
  var src = ctx.createBufferSource(); src.buffer = buf;
  var f = ctx.createBiquadFilter(); f.type = ftype || 'lowpass'; f.frequency.value = freq || 1000;
  var g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

function arp(notes, type, dur, vol, step, f0shift) {
  for (var i = 0; i < notes.length; i++) {
    tone(type, notes[i] + (f0shift || 0), null, dur, vol, i * (step || 0.08));
  }
}

var S = {
  shoot:   function () { tone('square', 740, 470, 0.06, 0.08); },
  zap:     function () { tone('sawtooth', 1500, 210, 0.18, 0.10); },
  boom:    function () { noise(0.5, 0.45, 'lowpass', 300); tone('sine', 130, 38, 0.42, 0.38); },
  frost:   function () { noise(0.35, 0.14, 'highpass', 5200); tone('sine', 1700, 2500, 0.3, 0.05); },
  build:   function () { arp([440, 554, 659, 880], 'square', 0.09, 0.10, 0.07); },
  upgrade: function () { arp([523, 659, 784], 'triangle', 0.28, 0.12, 0.02); },
  sell:    function () { arp([660, 494, 330], 'square', 0.10, 0.10, 0.08); },
  leak:    function () { tone('sawtooth', 220, 110, 0.45, 0.20); tone('sawtooth', 165, 82, 0.45, 0.16, 0.12); },
  wave:    function () { tone('sawtooth', 174, 174, 0.55, 0.16); tone('sawtooth', 233, 233, 0.55, 0.11, 0.03); },
  victory: function () { arp([523, 659, 784, 1046, 1318], 'triangle', 0.22, 0.13, 0.12); },
  defeat:  function () { tone('sawtooth', 330, 82, 1.1, 0.18); tone('sine', 110, 55, 1.1, 0.18, 0.1); },
  click:   function () { tone('square', 1250, 1250, 0.03, 0.07); },
  error:   function () { tone('square', 160, 120, 0.18, 0.13); },
  coin:    function () { tone('sine', 988, 988, 0.07, 0.11); tone('sine', 1319, 1319, 0.10, 0.11, 0.06); },
  alarm:   function () { tone('sawtooth', 620, 940, 0.22, 0.13); tone('sawtooth', 620, 940, 0.22, 0.13, 0.26); },
  branch:  function () { arp([1568, 2093, 2637], 'sine', 0.12, 0.09, 0.05); }
};

NB.Audio = {
  /* Call from the first user gesture. Safe to call repeatedly. */
  init: function () { ensureCtx(); },
  toggle: function () { return NB.Audio.setMuted(!muted); },
  play: function (name) {
    if (muted) { return; }
    var fn = S[name];
    if (typeof fn !== 'function') { return; }
    try { fn(); } catch (e) { /* audio must never break the game */ }
  },
  setMuted: function (m) {
    muted = !!m;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) { master.gain.value = muted ? 0 : 0.9; }
    return muted;
  }
};

Object.defineProperty(NB.Audio, 'muted', {
  get: function () { return muted; },
  enumerable: true
});

})();
