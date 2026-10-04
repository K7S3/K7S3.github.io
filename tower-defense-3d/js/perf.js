/* Nova Bastion 3D - adaptive quality governor.
 *
 * Rolling-FPS auto quality with hysteresis:
 *   fps < 45 sustained 3s  -> step quality down (high -> medium -> low)
 *   fps > 58 sustained 10s -> step quality up   (low -> medium -> high)
 * A 5s cooldown after any change prevents flapping. Manual override locks
 * the tier until cleared. Pure logic, no THREE dependency, fully testable.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

var TIERS = ['low', 'medium', 'high'];
var DOWN_FPS = 45, DOWN_TIME = 3.0;
var UP_FPS = 58, UP_TIME = 10.0;
var COOLDOWN = 5.0;

function clampTier(q){
  q = String(q || 'high').toLowerCase();
  return TIERS.indexOf(q) >= 0 ? q : 'high';
}

function autoDetect(){
  try {
    var ua = String((globalThis.navigator && globalThis.navigator.userAgent) || '');
    var mobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
    var cores = 4;
    try { cores = globalThis.navigator.hardwareConcurrency || 4; } catch (e){}
    if (mobile && cores <= 4) return 'low';
    if (mobile) return 'medium';
    return 'high';
  } catch (e){ return 'high'; }
}

function create(opts){
  opts = opts || {};
  var state = {
    tier: clampTier(opts.initial || autoDetect()),
    manual: null,          /* locked tier, or null for auto */
    ema: 60,
    lowT: 0, highT: 0, cool: 0,
    onChange: (typeof opts.onChange === 'function') ? opts.onChange : null,
    changes: 0
  };

  function applyTier(q, why){
    q = clampTier(q);
    if (q === state.tier) return false;
    state.tier = q;
    state.lowT = 0; state.highT = 0; state.cool = COOLDOWN;
    state.changes++;
    if (state.onChange){ try { state.onChange(q, why || 'auto'); } catch (e){} }
    return true;
  }

  var api = {
    /* test + UI hooks */
    get tier(){ return state.tier; },
    get fps(){ return state.ema; },
    get manual(){ return state.manual; },
    get changeCount(){ return state.changes; },
    autoDetect: autoDetect,

    setManual: function(q){
      if (q == null || q === 'auto'){ state.manual = null; return state.tier; }
      state.manual = clampTier(q);
      applyTier(state.manual, 'manual');
      return state.tier;
    },

    /* Force a tier immediately (used at boot). */
    setTier: function(q, why){ return applyTier(q, why || 'set'); },

    stepDown: function(why){ 
      var i = TIERS.indexOf(state.tier);
      return applyTier(TIERS[Math.max(0, i - 1)], why || 'auto-down');
    },
    stepUp: function(why){
      var i = TIERS.indexOf(state.tier);
      return applyTier(TIERS[Math.min(TIERS.length - 1, i + 1)], why || 'auto-up');
    },

    /* Call once per frame with the frame dt (seconds). Returns current tier. */
    update: function(dt){
      dt = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? Math.min(dt, 0.5) : 1 / 60;
      var fps = 1 / dt;
      /* EMA that reacts fast to drops, slow to recoveries (avoids yo-yo). */
      var a = fps < state.ema ? 0.12 : 0.04;
      state.ema += (fps - state.ema) * a;
      if (state.cool > 0){ state.cool -= dt; state.lowT = 0; state.highT = 0; return state.tier; }
      if (state.manual){ state.lowT = 0; state.highT = 0; return state.tier; }
      if (state.ema < DOWN_FPS){
        state.lowT += dt; state.highT = 0;
        if (state.lowT >= DOWN_TIME) api.stepDown('fps-low');
      } else if (state.ema > UP_FPS){
        state.highT += dt; state.lowT = 0;
        if (state.highT >= UP_TIME) api.stepUp('fps-high');
      } else {
        state.lowT = 0; state.highT = 0;
      }
      return state.tier;
    },

    reset: function(){
      state.ema = 60; state.lowT = 0; state.highT = 0; state.cool = 0;
    }
  };
  return api;
}

NB.Perf = {
  create: create,
  autoDetect: autoDetect,
  TIERS: TIERS.slice(),
  /* test hooks: the tuned constants */
  _consts: { DOWN_FPS: DOWN_FPS, DOWN_TIME: DOWN_TIME, UP_FPS: UP_FPS,
             UP_TIME: UP_TIME, COOLDOWN: COOLDOWN }
};

})();
