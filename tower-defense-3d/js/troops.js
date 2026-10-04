/* Nova Bastion 3D - troop-type registry
 *
 * The general foundation for the TROOPS system. Every troop type lives
 * here: stats, costs, and training time. The sim (training queue, orders,
 * combat), the UI (train buttons, order toggles), and the renderer (models,
 * accents) are all written against this registry -- nothing outside this
 * file hardcodes per-type numbers.
 *
 * The Barracks task will add more types (riflemen line infantry, heavy
 * breachers, ...) simply by extending NB.TROOPS and NB.TROOP_ORDER.
 *
 * Units: range in CELLS (cell = 2 world units), speed in world units/sec,
 * trainTime in seconds, costs in gold/food, dmg per shot, fireInterval
 * in seconds, upkeep in food/sec per fielded troop.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* Enemy types the Breacher's shaped charges are tuned against:
 * heavy armor and bosses. */
NB.ARMORED_TYPES = ['tank', 'brute', 'dreadnought', 'overmind', 'leviathan',
                    'shieldbearer'];

NB.TROOPS = {

  ranger: {
    name: 'Ranger',
    tag: 'Recon infantry',
    desc: 'Fast volunteer infantry. Fragile but lethal at range; ' +
          'every casualty is a colonist who does not come back.',
    color: '#a5f3fc',
    costGold: 150, costFood: 20, trainTime: 8,
    hp: 120, dmg: 25, range: 7, speed: 9, fireInterval: 0.9,
    upkeep: 0.02,
    model: 'engineer',   /* models3d key suffix: struct_<model> */
    accent: 0x7df9ff,
    scale: 1.0,
    weapon: 'rifle'
  },

  rifleman: {
    name: 'Rifleman',
    tag: 'Line infantry',
    desc: 'The backbone of the Bastion militia. Cheaper and sturdier than ' +
          'a Ranger, steady against the swarm. Holds a line; does not chase glory.',
    color: '#fbbf24',
    costGold: 100, costFood: 15, trainTime: 10,
    hp: 170, dmg: 18, range: 6, speed: 7, fireInterval: 0.8,
    upkeep: 0.02,
    model: 'engineer',
    accent: 0xfbbf24,
    scale: 1.0,
    weapon: 'rifle'
  },

  breacher: {
    name: 'Breacher',
    tag: 'Heavy anti-armor',
    desc: 'Walking siege engine in salvaged plate. Slow, near-immune to ' +
          'panic, and carries shaped charges tuned for hardened Rust armor ' +
          'and bosses. Do not send it chasing skitterers.',
    color: '#ff6b4a',
    costGold: 220, costFood: 30, trainTime: 14,
    hp: 450, dmg: 65, range: 5, speed: 4.5, fireInterval: 1.6,
    upkeep: 0.04,
    bonusVs: NB.ARMORED_TYPES.slice(),
    bonusMult: 1.6,
    model: 'engineer',
    accent: 0xff5533,
    scale: 1.28,
    weapon: 'cannon'
  }

};

/* roster order for train menus */
NB.TROOP_ORDER = ['ranger', 'rifleman', 'breacher'];

/* order kinds every troop type understands:
 *   move       - go to the point, do not stop to fight
 *   attackmove - go to the point, engage enemies in weapon range on the way
 *   hold       - stay put, engage enemies in weapon range
 */
NB.TROOP_ORDERS = ['move', 'attackmove', 'hold'];

})();
