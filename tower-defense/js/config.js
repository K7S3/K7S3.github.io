/* Nova Bastion - config */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

NB.CONFIG = {
  WIDTH: 960,
  HEIGHT: 600,
  INTEREST_RATE: 0.05,
  SELLBACK: 0.7,
  EARLY_BASE: 10,
  EARLY_PER_SEC: 2,
  SYNERGY_RADIUS: 150,
  MAX_PARTICLES: 400,
  STORAGE_KEY: 'nova-bastion-save-v1',
  SPEEDS: [1, 2, 3],
  INTERMISSION: 20
};

})();
