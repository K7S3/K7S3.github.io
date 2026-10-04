/* Nova Bastion 3D - main entry point.
 *
 * Boot sequence: show the loading screen with rotating lore tips, unlock
 * WebAudio on first gesture, start the 3D demo vista behind the title,
 * then hand the canvas to the game controller.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

var TIPS = [
  'Year 2100: humanity endures inside sealed arcologies.',
  'The RUST is a rogue machine swarm. It does not negotiate.',
  'The Command Spire projects the tactical uplink. Build inside its light.',
  'Structures outside uplink range go DARK and dormant.',
  'OVERCLOCK the Spire for wider uplink and harder hits. Watch the strain.',
  'At 100% strain the Spire burns itself. Vent before that.',
  'Blackout surges shrink the uplink. Weather them for salvage.',
  'Colony morale shifts every wave. Unrest freezes construction.'
];

function armAudioUnlock(){
  var events = ['pointerdown', 'keydown', 'touchstart'];
  function unlock(){
    try { if (NB.Audio) NB.Audio.init(); } catch (e){}
    for (var i = 0; i < events.length; i++) window.removeEventListener(events[i], unlock);
  }
  for (var k = 0; k < events.length; k++){
    window.addEventListener(events[k], unlock, { once: true, passive: true });
  }
}

function rotateTips(){
  var tipEl = document.getElementById('loading-tip');
  if (!tipEl) return null;
  var i = 0;
  tipEl.textContent = TIPS[0];
  return setInterval(function(){
    i = (i + 1) % TIPS.length;
    tipEl.textContent = TIPS[i];
  }, 2600);
}

function scriptMissing(msg){
  var fb = document.getElementById('fallback');
  if (fb){
    fb.classList.remove('hidden');
    fb.textContent = msg || 'Failed to load game scripts.';
  }
  var load = document.getElementById('screen-loading');
  if (load) load.classList.add('hidden');
}

function boot(){
  armAudioUnlock();
  var tipTimer = rotateTips();
  var canvas = document.getElementById('game');
  if (!canvas){ scriptMissing(); return; }
  if (!NB.Game || !NB.UI){
    scriptMissing('Failed to load game scripts. Check that every js/ file listed in index.html is present.');
    return;
  }

  /* start the demo vista behind the title (best effort) */
  var demo = null;
  try {
    if (typeof NB.DemoVista === 'function'){
      demo = new NB.DemoVista(canvas);
      demo.start();
    }
  } catch (e){
    demo = null;
  }

  /* let the loading screen breathe for a beat, then enter.
     Model preload runs in parallel with a hard timeout; the game boots
     either way, falling back to primitives for anything not loaded. */
  var bootStarted = false;
  function enterGame(){
    if (bootStarted) return;
    bootStarted = true;
    if (tipTimer) clearInterval(tipTimer);
    try {
      NB.Game.init(canvas, demo);
    } catch (e){
      scriptMissing('The game controller failed to start: ' + String((e && e.message) || e));
      try { console.error(e); } catch (err){}
    }
  }
  function bootModelsThenGame(){
    var ML = (globalThis.NB && NB.ModelLib) || null;
    var bar = null;
    try {
      bar = document.querySelector('#screen-loading .loader-bar');
    } catch (e){ bar = null; }
    if (!ML || !ML.preload){ enterGame(); return; }
    try {
      ML.preload(function(done, total){
        if (bar && total > 0){
          try { bar.style.width = Math.round(done / total * 100) + '%'; } catch (e2){}
        }
      }, function(){
        enterGame();
      }, 10000);
    } catch (e){
      enterGame();
    }
  }
  setTimeout(bootModelsThenGame, 900);
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();
