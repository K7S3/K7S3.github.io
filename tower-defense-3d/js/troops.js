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
 * in seconds.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

NB.TROOPS = {

  ranger: {
    name: 'Ranger',
    tag: 'Recon infantry',
    desc: 'Fast volunteer infantry. Fragile but lethal at range; ' +
          'every casualty is a colonist who does not come back.',
    color: '#a5f3fc',
    costGold: 150, costFood: 20, trainTime: 8,
    hp: 120, dmg: 25, range: 7, speed: 9, fireInterval: 0.9,
    model: 'engineer',   /* models3d key suffix: struct_<model> */
    accent: 0x7df9ff
  }

};

/* roster order for train menus */
NB.TROOP_ORDER = ['ranger'];

/* order kinds every troop type understands:
 *   move       - go to the point, do not stop to fight
 *   attackmove - go to the point, engage enemies in weapon range on the way
 *   hold       - stay put, engage enemies in weapon range
 */
NB.TROOP_ORDERS = ['move', 'attackmove', 'hold'];

})();
