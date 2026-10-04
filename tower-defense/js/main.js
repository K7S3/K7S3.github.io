/* Nova Bastion - main */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* Boot: wire first-gesture audio unlock, start the game controller,
   and show the title screen. The ambient starfield behind the title
   is drawn by the game loop itself. */

function armAudioUnlock() {
  var events = ['pointerdown', 'keydown', 'touchstart'];
  function unlock() {
    try { if (NB.Audio) { NB.Audio.init(); } } catch (e) { /* ignore */ }
    for (var i = 0; i < events.length; i++) {
      window.removeEventListener(events[i], unlock);
    }
  }
  for (var k = 0; k < events.length; k++) {
    window.addEventListener(events[k], unlock, { once: true, passive: true });
  }
}

function boot() {
  armAudioUnlock();
  var canvas = document.getElementById('game');
  if (!canvas) { return; }
  if (!NB.Game || !NB.UI || !NB.Renderer) {
    var wrap = document.getElementById('stage-wrap');
    if (wrap) {
      wrap.innerHTML = '<p style="padding:40px;color:#ff4d6d">Failed to load game scripts. ' +
        'Check that all js/ files listed in index.html are present.</p>';
    }
    return;
  }
  NB.Game.init(canvas);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();
