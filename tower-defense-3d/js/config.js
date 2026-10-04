/* Nova Bastion 3D - config */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

NB.CONFIG = {
  /* legacy 2D keys (kept for compatibility) */
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
  INTERMISSION: 20,

  /* 3D grid model */
  COLS: 64,
  ROWS: 40,
  CELL: 2,               /* world units per cell; world is 128 x 80 */

  /* structures */
  WALL_COST: 8,
  WALL_HP: 250,
  REACTOR_COST: 150,
  REACTOR_HP: 400,
  REACTOR_CAP: 30,       /* energy capacity per reactor */
  HQ_HP: 2000,
  TOWER_HP_BASE: 180,
  TOWER_HP_PER_TIER: 40,

  /* tactical uplink network (projected by the Command Spire) */
  UPLINK_BASE: 9,         /* base uplink radius in cells */
  SPIRE_UPGRADE_COSTS: [150, 300, 600],
  SPIRE_RADIUS_PER_TIER: 2,
  OVERCLOCK_RADIUS: 4,
  OVERCLOCK_DMG: 1.25,
  STRAIN_FULL_TIME: 40,   /* seconds of overclock to reach strain 100 */
  STRAIN_DECAY: 6,        /* strain points per second while off */
  OVERCLOCK_COOLDOWN: 60,
  OVERCLOCK_BURN: 0.15,   /* spire takes 15% max HP at strain 100 */

  /* morale */
  MORALE_START: 70,
  MORALE_STRUCT_LOSS: 3,
  MORALE_STRUCT_LOSS_CAP: 9,
  MORALE_BREACH: 4,       /* enemy within 3 cells of the spire, first time per wave */
  MORALE_FLAWLESS: 4,
  MORALE_CLEAR: 2,

  /* blackout surges */
  SURGE_WARN: 20,         /* seconds of warning before a surge wave */
  SURGE_SHRINK: 3,        /* uplink radius penalty during a surge wave */
  SURGE_MIN_RADIUS: 4,
  SURGE_REWARD_GOLD: 150,
  SURGE_REWARD_MORALE: 6,

  /* combat */
  MAX_ENEMIES: 600,
  SYNERGY_RADIUS_CELLS: 5,
  MELEE_RANGE_CELLS: 1.6,
  SEEK_RANGE_CELLS: 14,
  SAPPER_SEEK_RANGE_CELLS: 20,
  BREACH_RANGE_CELLS: 3,

  /* ---- population & economy (colony layer) ---- */
  POP_BASE_CAP: 12,          /* housing without Hab Modules */
  POP_START: 10,
  POP_GROWTH_TIME: 40,       /* seconds per +1 pop when fed, housed, content */
  POP_FOOD_PER_SEC: 0.05,    /* food consumed per colonist per second */
  FOOD_START: 30,
  METAL_START: 20,
  FOOD_SURPLUS_MORALE: 60,   /* above this stockpile, surplus morale ticks */
  STARVE_MORALE_PER_SEC: 0.6,

  EXTRACTOR_COST: 100,
  EXTRACTOR_HP: 350,
  EXTRACTOR_METAL_PER_SEC: 1.2,  /* per assigned laborer */
  EXTRACTOR_SLOTS: 3,
  EXTRACTOR_NODE_RANGE: 3,       /* cells: must build within this of a scrap node */

  HYDRO_COST: 80,
  HYDRO_HP: 300,
  HYDRO_FOOD_PER_SEC: 1.5,   /* per assigned laborer */
  HYDRO_SLOTS: 2,

  HAB_COST: 60,
  HAB_HP: 250,
  HAB_POP: 8,                /* +pop cap per Hab Module */

  ENGINEER_REPAIR_PER_SEC: 6,    /* per engineer, to most-damaged structure in uplink */
  ENGINEER_COST_DISCOUNT: 0.02,  /* per engineer, max ENGINEER_MAX_DISCOUNT */
  ENGINEER_MAX_DISCOUNT: 0.20,
  ENGINEER_GOV_CAP: 3,
  SCIENTIST_RESEARCH_PER_SEC: 1,
  SCIENTIST_GOV_CAP: 3,
  AGE_RESEARCH: [60, 180],       /* research thresholds for Fortification, Dominion */
  GOVERNOR_TICK: 2,

  RANGER_COST_GOLD: 150,
  RANGER_COST_FOOD: 20,
  RANGER_HP: 120,
  RANGER_DMG: 25,
  RANGER_RANGE: 7,           /* cells */
  RANGER_SPEED: 9,           /* world units per second */
  RANGER_FIRE_INTERVAL: 0.9,
  RANGER_CAP: 6,

  TROOP_CAP: 6,                 /* max fielded + training troops (all types) */

  WORKER_CAP: 40,            /* visible worker agents */
  WORKER_SPEED: 4.5,

  /* metal cost table: gold stays the main currency; metal gates the top end */
  METAL_TOWER_FORT: 10,      /* sniper/arc/amplify build */
  METAL_TOWER_DOMINION: 15,  /* chrono build */
  METAL_TIER3: 15,           /* tier-3 upgrade */
  METAL_BRANCH: 25,          /* branch specialization */
  METAL_SPIRE: [20, 40, 80]  /* spire upgrade tiers */
};

/*
 * Commander doctrines. towerCost/wallCost/repairCost scale the acting
 * player's costs; towerDamage/towerHp/wallHp/reactorEnergy scale structures
 * by owner; moraleGain/moraleLoss scale morale deltas; supportMult scales
 * support structures (Uplink Amplifier, Stasis Projector, Fabricator).
 */
NB.DOCTRINES = {
  vanguard: {
    name:'Vanguard',
    desc:'Assault doctrine. Towers cost 15% less and deal 10% more damage, but walls are thinner and pricier.',
    towerCost:0.85, towerDamage:1.10, wallHp:0.7, wallCost:1.2
  },
  engineer: {
    name:'Engineer',
    desc:'Siege doctrine. Cheap sturdy walls, half-price repairs, tougher towers, and reactors with 50% more capacity.',
    wallCost:0.7, reactorEnergy:1.5, repairCost:0.5, towerHp:1.25
  },
  warden: {
    name:'Warden',
    desc:'Steward doctrine. Morale swings soften, and support structures run 30% stronger.',
    moraleGain:1.5, moraleLoss:0.7, supportMult:1.3
  }
};

/* Ages gate the tower roster. See sim towersForAge. */
NB.AGES = ['Reclamation', 'Fortification', 'Dominion'];

})();
