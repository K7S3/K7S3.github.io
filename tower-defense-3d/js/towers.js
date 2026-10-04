/* Nova Bastion 3D - towers */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/*
 * Tower definitions, retuned for 3D swarm scale (hundreds of weak enemies).
 *
 * Units: range and radius are in CELLS (cell = 2 world units). The sim
 * converts to world units when firing. projSpeed is cells/sec.
 * damage / fireRate are per-tower base numbers before buffs, veterancy,
 * hope state, overdrive, and edict modifiers.
 *
 * Tier entries (tiers[0] = tier 2, tiers[1] = tier 3) and branch entries are
 * ABSOLUTE stat overrides: the sim replaces damage / range / fireRate /
 * special wholesale when the tower is upgraded. Every tier and branch entry
 * therefore carries complete numbers.
 *
 * energy: energy capacity consumed while the tower stands (arc 10, chrono 15,
 * amplify 12, +5 per branch tier). Reactors provide 30 capacity each.
 * Unpowered towers go dormant.
 *
 * Balance anchor: pulse base deals ~10 dps for 100g. Swarm enemies sit at
 * 6-12 hp, so the pulse two-shots drones and one-shots swarmlings at tier 2.
 */
NB.TOWERS = {

  pulse: {
    name:'Pulse Turret', tag:'Balanced blaster', color:'#22d3ee', projColor:'#a5f3fc',
    cost:100, range:6, damage:8, fireRate:1.3, projSpeed:60,
    energy:0,
    behavior:'projectile', special:{},
    desc:'Human-crewed emplacement. Fires quick energy bolts at a steady rate.',
    tiers:[
      {cost:90,  range:6.5, damage:14, fireRate:1.5, special:{}, note:'Tuned coils'},
      {cost:200, range:7,   damage:24, fireRate:1.7, special:{}, note:'Overcharged core'}
    ],
    branch:{
      a:{name:'Overdrive', cost:340, desc:'Trades punch for blistering speed. Shreds light enemies.', range:7, damage:18, fireRate:3.4, special:{}, note:''},
      b:{name:'Obliterator', cost:340, desc:'Slow, colossal bolts that pierce through two extra targets.', range:7.5, damage:70, fireRate:0.9, special:{pierce:2}, note:''}
    }
  },

  frost: {
    name:'Cryo Projector', tag:'Chilling aura', color:'#7dd3fc', projColor:'#e0f2fe',
    cost:110, range:5, damage:4, fireRate:1.4, projSpeed:0,
    energy:0,
    behavior:'aura',
    special:{slowFactor:0.55, slowDuration:1.6, tick:0.7, radius:5},
    desc:'Chills nearby enemies with a pulsing frost aura, slowing their advance.',
    tiers:[
      {cost:80,  range:5.5, damage:7,  fireRate:1.6, special:{slowFactor:0.5, slowDuration:1.8, tick:0.6, radius:5.5}, note:'Deeper chill'},
      {cost:180, range:6,   damage:11, fireRate:1.8, special:{slowFactor:0.45, slowDuration:2.0, tick:0.5, radius:6}, note:'Cryo lattice'}
    ],
    branch:{
      a:{name:'Deep Freeze', cost:320, desc:'Bitter cold that can freeze enemies solid in place.', range:6, damage:12, fireRate:2.0, special:{slowFactor:0.35, slowDuration:2.2, tick:0.5, radius:6, freezeChance:0.25, freezeDuration:1.2}, note:''},
      b:{name:'Blizzard', cost:320, desc:'A huge storm front that slows everything in a wide area.', range:7, damage:10, fireRate:2.2, special:{slowFactor:0.5, slowDuration:2.0, tick:0.45, radius:7}, note:''}
    }
  },

  arc: {
    name:'Arc Tesla Coil', tag:'Chain lightning', color:'#facc15', projColor:'#fef08a',
    cost:120, range:7, damage:14, fireRate:0.9, projSpeed:0,
    energy:10,
    behavior:'chain',
    special:{chains:3, chainRange:6, falloff:0.75, stunChance:0, stunDuration:0},
    desc:'Hurls instant chain lightning that jumps between clustered enemies.',
    tiers:[
      {cost:95,  range:7.5, damage:22, fireRate:1.0, special:{chains:4, chainRange:6.5, falloff:0.75, stunChance:0, stunDuration:0}, note:'Wider arcs'},
      {cost:190, range:8,   damage:32, fireRate:1.1, special:{chains:5, chainRange:7, falloff:0.78, stunChance:0.1, stunDuration:0.5}, note:'Charged atmosphere'}
    ],
    branch:{
      a:{name:'Stormlord', cost:360, desc:'Calls down a storm that chains across seven targets.', range:8.5, damage:38, fireRate:1.2, special:{chains:7, chainRange:7, falloff:0.8, stunChance:0.1, stunDuration:0.5}, note:''},
      b:{name:'Tesla', cost:360, desc:'High-voltage arcs that stun enemies on hit.', range:8, damage:48, fireRate:1.1, special:{chains:4, chainRange:7, falloff:0.8, stunChance:0.3, stunDuration:0.8}, note:''}
    }
  },

  mortar: {
    name:'Mortar Battery', tag:'Splash artillery', color:'#fb923c', projColor:'#fed7aa',
    cost:130, range:10, damage:30, fireRate:0.5, projSpeed:30,
    energy:0,
    behavior:'lobbed',
    special:{splash:2.5, minRange:3},
    desc:'Lobs explosive shells over obstacles, dealing splash damage on impact.',
    tiers:[
      {cost:100, range:10.5, damage:45, fireRate:0.55, special:{splash:3, minRange:3}, note:'Heavy shells'},
      {cost:200, range:11,   damage:70, fireRate:0.6,  special:{splash:3.5, minRange:3}, note:'Siege loader'}
    ],
    branch:{
      a:{name:'Barrage', cost:380, desc:'Each shell bursts into four submunitions for wide coverage.', range:11, damage:52, fireRate:0.8, special:{splash:2.5, minRange:3, submunitions:4, subSplash:2}, note:''},
      b:{name:'Siege', cost:380, desc:'Enormous shells with a massive blast radius.', range:12, damage:120, fireRate:0.45, special:{splash:5, minRange:3}, note:''}
    }
  },

  sniper: {
    name:'Sniper Nest', tag:'Long-range precision', color:'#f472b6', projColor:'#fbcfe8',
    cost:140, range:14, damage:60, fireRate:0.4, projSpeed:120,
    energy:0,
    behavior:'projectile',
    special:{critChance:0.15, critMult:2.5},
    desc:'Extreme range, massive damage, slow to fire. Rewards good placement.',
    tiers:[
      {cost:90,  range:14.5, damage:90,  fireRate:0.45, special:{critChance:0.2, critMult:2.5}, note:'Longer barrel'},
      {cost:170, range:15,   damage:135, fireRate:0.5,  special:{critChance:0.25, critMult:3}, note:'Hypervelocity rounds'}
    ],
    branch:{
      a:{name:'Deadeye', cost:400, desc:'Never misses the mark: huge crit chance and crit damage.', range:16, damage:150, fireRate:0.5, special:{critChance:0.5, critMult:4}, note:''},
      b:{name:'Railgun', cost:400, desc:'Fires an instant beam that pierces everything in a line.', range:15, damage:120, fireRate:0.7, special:{pierce:99, beam:true}, note:''}
    }
  },

  chrono: {
    name:'Stasis Projector', tag:'Time distortion', color:'#c084fc', projColor:'#e9d5ff',
    cost:120, range:4, damage:0, fireRate:0, projSpeed:0,
    energy:15,
    behavior:'field',
    special:{radius:4, slowFactor:0.6},
    desc:'Projects a permanent time field that slows everything inside it.',
    tiers:[
      {cost:85,  range:4.5, damage:0, fireRate:0, special:{radius:4.5, slowFactor:0.55}, note:'Dense field'},
      {cost:160, range:5,   damage:0, fireRate:0, special:{radius:5, slowFactor:0.5}, note:'Time well'}
    ],
    branch:{
      a:{name:'Stasis', cost:300, desc:'Nearly stops time. Victims inside also take bonus damage.', range:5, damage:0, fireRate:0, special:{radius:5, slowFactor:0.35, damageTakenMult:1.25}, note:''},
      b:{name:'Accelerator', cost:300, desc:'Slows enemies while speeding up allied towers inside.', range:5.5, damage:0, fireRate:0, special:{radius:5.5, slowFactor:0.5, allyRateMult:1.35}, note:''}
    }
  },

  mint: {
    name:'Fabricator', tag:'Credit printer', color:'#4ade80', projColor:'#bbf7d0',
    cost:130, range:0, damage:0, fireRate:0, projSpeed:0,
    energy:0,
    behavior:'economy',
    special:{perWave:30, interestBoost:0},
    desc:'Prints credits at the start of every wave. Pays for itself, then profits.',
    tiers:[
      {cost:70,  range:0, damage:0, fireRate:0, special:{perWave:45, interestBoost:0}, note:'Press plates'},
      {cost:150, range:0, damage:0, fireRate:0, special:{perWave:65, interestBoost:0.01}, note:'Reserve vault'}
    ],
    branch:{
      a:{name:'Treasury', cost:280, desc:'A gold reserve that also boosts your interest rate.', range:0, damage:0, fireRate:0, special:{perWave:55, interestBoost:0.03}, note:''},
      b:{name:'Alchemist', cost:280, desc:'Transmutes nearby kills into bonus gold.', range:0, damage:0, fireRate:0, special:{perWave:35, interestBoost:0, killGoldRadius:7, killGoldBonus:4}, note:''}
    }
  },

  amplify: {
    name:'Uplink Amplifier', tag:'Tower booster', color:'#e879f9', projColor:'#f5d0fe',
    cost:150, range:5, damage:0, fireRate:0, projSpeed:0,
    energy:12,
    behavior:'buff',
    special:{radius:5, damageMult:1.25, rateMult:1.15},
    desc:'Boosts the damage and fire rate of nearby damage towers.',
    tiers:[
      {cost:100, range:5.5, damage:0, fireRate:0, special:{radius:5.5, damageMult:1.3, rateMult:1.2}, note:'Clean signal'},
      {cost:180, range:6,   damage:0, fireRate:0, special:{radius:6, damageMult:1.35, rateMult:1.25}, note:'Harmonic array'}
    ],
    branch:{
      a:{name:'Overclock', cost:320, desc:'Pushes nearby towers far past their safe limits.', range:6, damage:0, fireRate:0, special:{radius:6, damageMult:1.5, rateMult:1.3}, note:''},
      b:{name:'Relay', cost:320, desc:'Broadcasts its boost across a huge radius.', range:7, damage:0, fireRate:0, special:{radius:7, damageMult:1.3, rateMult:1.2}, note:''}
    }
  }

};

/*
 * Synergy combos. The sim implements these kinds:
 *  dmgVsSlowed : to-tower deals mult damage vs slowed/frozen enemies while a
 *                from-tower is within SYNERGY_RADIUS_CELLS of the to-tower.
 *  dmgVsFrozen : like dmgVsSlowed, but only vs frozen enemies.
 *  mintBoost   : mint output multiplied while a from-tower is in radius.
 *  rateVsSlowed: to-tower fire rate multiplied vs slowed enemies.
 *  critVsSlowed: to-tower gains bonus crit chance vs slowed enemies.
 */
NB.SYNERGIES = [
  {id:'superconduct', name:'Superconduct', kind:'dmgVsSlowed',
   from:'frost', to:'arc', mult:1.4,
   desc:'Arc towers deal 40% more damage to slowed or frozen enemies while a Cryo Projector is nearby.'},
  {id:'shatter', name:'Shatter', kind:'dmgVsFrozen',
   from:'frost', to:['mortar','sniper'], mult:1.6,
   desc:'Mortars and Snipers shatter frozen enemies for 60% bonus damage while a Cryo Projector is nearby.'},
  {id:'golden-age', name:'Golden Age', kind:'mintBoost',
   from:'amplify', to:'mint', mult:1.5,
   desc:'Fabricators near an Uplink Amplifier produce 50% more credits.'},
  {id:'temporal-lock', name:'Temporal Lock', kind:'critVsSlowed',
   from:'chrono', to:'sniper', bonus:0.2,
   desc:'Sniper Nests near a Stasis Projector gain +20% crit chance against slowed enemies.'},
  {id:'overcharge', name:'Overcharge', kind:'rateVsSlowed',
   from:'frost', to:'pulse', mult:1.25,
   desc:'Pulse towers fire 25% faster at slowed enemies while a Cryo Projector is nearby.'}
];

})();
