/* Nova Bastion - towers */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/*
 * Tower definitions. Tier entries (tiers[0] = tier 2, tiers[1] = tier 3) and
 * branch entries are ABSOLUTE stat overrides: the sim replaces
 * damage / range / fireRate / special wholesale when the tower is upgraded.
 * Every tier and branch entry below therefore carries complete numbers.
 *
 * Balance anchor: pulse base deals ~15.6 dps for 100g (~6.4 gold per dps).
 * Other towers trade raw dps for range, splash, slow, or economy.
 */
NB.TOWERS = {

  pulse: {
    name:'Pulse', tag:'Balanced blaster', color:'#22d3ee', projColor:'#a5f3fc',
    cost:100, range:135, damage:12, fireRate:1.3, projSpeed:460,
    behavior:'projectile', special:{},
    desc:'Reliable all-rounder. Fires quick energy bolts at a steady rate.',
    tiers:[
      {cost:90,  range:145, damage:22, fireRate:1.5, special:{}, note:'Tuned coils'},
      {cost:200, range:155, damage:38, fireRate:1.7, special:{}, note:'Overcharged core'}
    ],
    branch:{
      a:{name:'Overdrive', cost:340, desc:'Trades punch for blistering speed. Shreds light enemies.', range:155, damage:30, fireRate:3.4, special:{}, note:''},
      b:{name:'Obliterator', cost:340, desc:'Slow, colossal bolts that pierce through two extra targets.', range:170, damage:120, fireRate:0.9, special:{pierce:2}, note:''}
    }
  },

  frost: {
    name:'Frost', tag:'Chilling aura', color:'#7dd3fc', projColor:'#e0f2fe',
    cost:110, range:110, damage:6, fireRate:1.4, projSpeed:0,
    behavior:'aura',
    special:{slowFactor:0.55, slowDuration:1.6, tick:0.7, radius:100},
    desc:'Chills nearby enemies with a pulsing frost aura, slowing their advance.',
    tiers:[
      {cost:80,  range:120, damage:10, fireRate:1.6, special:{slowFactor:0.5, slowDuration:1.8, tick:0.6, radius:110}, note:'Deeper chill'},
      {cost:180, range:135, damage:16, fireRate:1.8, special:{slowFactor:0.45, slowDuration:2.0, tick:0.5, radius:125}, note:'Cryo lattice'}
    ],
    branch:{
      a:{name:'Deep Freeze', cost:320, desc:'Bitter cold that can freeze enemies solid in place.', range:135, damage:18, fireRate:2.0, special:{slowFactor:0.35, slowDuration:2.2, tick:0.5, radius:125, freezeChance:0.25, freezeDuration:1.2}, note:''},
      b:{name:'Blizzard', cost:320, desc:'A huge storm front that slows everything in a wide area.', range:170, damage:14, fireRate:2.2, special:{slowFactor:0.5, slowDuration:2.0, tick:0.45, radius:150}, note:''}
    }
  },

  arc: {
    name:'Arc', tag:'Chain lightning', color:'#facc15', projColor:'#fef08a',
    cost:120, range:150, damage:20, fireRate:0.9, projSpeed:0,
    behavior:'chain',
    special:{chains:3, chainRange:130, falloff:0.75, stunChance:0, stunDuration:0},
    desc:'Hurls instant chain lightning that jumps between clustered enemies.',
    tiers:[
      {cost:95,  range:160, damage:30, fireRate:1.0, special:{chains:4, chainRange:140, falloff:0.75, stunChance:0, stunDuration:0}, note:'Wider arcs'},
      {cost:190, range:175, damage:45, fireRate:1.1, special:{chains:5, chainRange:150, falloff:0.78, stunChance:0.1, stunDuration:0.5}, note:'Charged atmosphere'}
    ],
    branch:{
      a:{name:'Stormlord', cost:360, desc:'Calls down a storm that chains across seven targets.', range:190, damage:55, fireRate:1.2, special:{chains:7, chainRange:150, falloff:0.8, stunChance:0.1, stunDuration:0.5}, note:''},
      b:{name:'Tesla', cost:360, desc:'High-voltage arcs that stun enemies on hit.', range:175, damage:70, fireRate:1.1, special:{chains:4, chainRange:150, falloff:0.8, stunChance:0.3, stunDuration:0.8}, note:''}
    }
  },

  mortar: {
    name:'Mortar', tag:'Splash artillery', color:'#fb923c', projColor:'#fed7aa',
    cost:130, range:220, damage:40, fireRate:0.5, projSpeed:300,
    behavior:'lobbed',
    special:{splash:65, minRange:60},
    desc:'Lobs explosive shells over obstacles, dealing splash damage on impact.',
    tiers:[
      {cost:100, range:230, damage:60, fireRate:0.55, special:{splash:70, minRange:60}, note:'Heavy shells'},
      {cost:200, range:245, damage:95, fireRate:0.6, special:{splash:80, minRange:60}, note:'Siege loader'}
    ],
    branch:{
      a:{name:'Barrage', cost:380, desc:'Each shell bursts into four submunitions for wide coverage.', range:245, damage:70, fireRate:0.8, special:{splash:55, minRange:60, submunitions:4, subSplash:40}, note:''},
      b:{name:'Siege', cost:380, desc:'Enormous shells with a massive blast radius.', range:270, damage:160, fireRate:0.45, special:{splash:120, minRange:60}, note:''}
    }
  },

  sniper: {
    name:'Sniper', tag:'Long-range precision', color:'#f472b6', projColor:'#fbcfe8',
    cost:140, range:320, damage:80, fireRate:0.4, projSpeed:900,
    behavior:'projectile',
    special:{critChance:0.15, critMult:2.5},
    desc:'Extreme range, massive damage, slow to fire. Rewards good placement.',
    tiers:[
      {cost:90,  range:340, damage:120, fireRate:0.45, special:{critChance:0.2, critMult:2.5}, note:'Longer barrel'},
      {cost:170, range:360, damage:180, fireRate:0.5, special:{critChance:0.25, critMult:3}, note:'Hypervelocity rounds'}
    ],
    branch:{
      a:{name:'Deadeye', cost:400, desc:'Never misses the mark: huge crit chance and crit damage.', range:400, damage:200, fireRate:0.5, special:{critChance:0.5, critMult:4}, note:''},
      b:{name:'Railgun', cost:400, desc:'Fires an instant beam that pierces everything in a line.', range:380, damage:160, fireRate:0.7, special:{pierce:99, beam:true}, note:''}
    }
  },

  chrono: {
    name:'Chrono', tag:'Time distortion', color:'#c084fc', projColor:'#e9d5ff',
    cost:120, range:95, damage:0, fireRate:0, projSpeed:0,
    behavior:'field',
    special:{radius:95, slowFactor:0.6},
    desc:'Projects a permanent time field that slows everything inside it.',
    tiers:[
      {cost:85,  range:105, damage:0, fireRate:0, special:{radius:105, slowFactor:0.55}, note:'Dense field'},
      {cost:160, range:115, damage:0, fireRate:0, special:{radius:115, slowFactor:0.5}, note:'Time well'}
    ],
    branch:{
      a:{name:'Stasis', cost:300, desc:'Nearly stops time. Victims inside also take bonus damage.', range:110, damage:0, fireRate:0, special:{radius:110, slowFactor:0.35, damageTakenMult:1.25}, note:''},
      b:{name:'Accelerator', cost:300, desc:'Slows enemies while speeding up allied towers inside.', range:120, damage:0, fireRate:0, special:{radius:120, slowFactor:0.5, allyRateMult:1.35}, note:''}
    }
  },

  mint: {
    name:'Mint', tag:'Gold generator', color:'#4ade80', projColor:'#bbf7d0',
    cost:130, range:0, damage:0, fireRate:0, projSpeed:0,
    behavior:'economy',
    special:{perWave:30, interestBoost:0},
    desc:'Prints gold at the start of every wave. Pays for itself, then profits.',
    tiers:[
      {cost:70,  range:0, damage:0, fireRate:0, special:{perWave:45, interestBoost:0}, note:'Press plates'},
      {cost:150, range:0, damage:0, fireRate:0, special:{perWave:65, interestBoost:0.01}, note:'Reserve vault'}
    ],
    branch:{
      a:{name:'Treasury', cost:280, desc:'A gold reserve that also boosts your interest rate.', range:0, damage:0, fireRate:0, special:{perWave:55, interestBoost:0.03}, note:''},
      b:{name:'Alchemist', cost:280, desc:'Transmutes nearby kills into bonus gold.', range:0, damage:0, fireRate:0, special:{perWave:35, interestBoost:0, killGoldRadius:160, killGoldBonus:4}, note:''}
    }
  },

  amplify: {
    name:'Amplify', tag:'Tower booster', color:'#e879f9', projColor:'#f5d0fe',
    cost:150, range:115, damage:0, fireRate:0, projSpeed:0,
    behavior:'buff',
    special:{radius:115, damageMult:1.25, rateMult:1.15},
    desc:'Boosts the damage and fire rate of nearby damage towers.',
    tiers:[
      {cost:100, range:125, damage:0, fireRate:0, special:{radius:125, damageMult:1.3, rateMult:1.2}, note:'Clean signal'},
      {cost:180, range:135, damage:0, fireRate:0, special:{radius:135, damageMult:1.35, rateMult:1.25}, note:'Harmonic array'}
    ],
    branch:{
      a:{name:'Overclock', cost:320, desc:'Pushes nearby towers far past their safe limits.', range:135, damage:0, fireRate:0, special:{radius:135, damageMult:1.5, rateMult:1.3}, note:''},
      b:{name:'Relay', cost:320, desc:'Broadcasts its boost across a huge radius.', range:170, damage:0, fireRate:0, special:{radius:170, damageMult:1.3, rateMult:1.2}, note:''}
    }
  }

};

/*
 * Synergy combos. The sim implements these kinds:
 *  dmgVsSlowed : to-tower deals mult damage vs slowed/frozen enemies while a
 *                from-tower is within SYNERGY_RADIUS of the to-tower.
 *  dmgVsFrozen : like dmgVsSlowed, but only vs frozen enemies.
 *  mintBoost   : mint output multiplied while a from-tower is in radius.
 *  buffBoost   : amplify buffs are stronger while a chrono is in radius.
 *  rateVsSlowed: to-tower fire rate multiplied vs slowed enemies.
 *  critVsSlowed: to-tower gains bonus crit chance vs slowed enemies.
 */
NB.SYNERGIES = [
  {id:'superconduct', name:'Superconduct', kind:'dmgVsSlowed',
   from:'frost', to:'arc', mult:1.4,
   desc:'Arc towers deal 40% more damage to slowed or frozen enemies while a Frost tower is nearby.'},
  {id:'shatter', name:'Shatter', kind:'dmgVsFrozen',
   from:'frost', to:['mortar','sniper'], mult:1.6,
   desc:'Mortars and Snipers shatter frozen enemies for 60% bonus damage while a Frost tower is nearby.'},
  {id:'golden-age', name:'Golden Age', kind:'mintBoost',
   from:'amplify', to:'mint', mult:1.5,
   desc:'Mints near an Amplify tower produce 50% more gold.'},
  {id:'temporal-lock', name:'Temporal Lock', kind:'critVsSlowed',
   from:'chrono', to:'sniper', bonus:0.2,
   desc:'Snipers near a Chrono field gain +20% crit chance against slowed enemies.'},
  {id:'overcharge', name:'Overcharge', kind:'rateVsSlowed',
   from:'frost', to:'pulse', mult:1.25,
   desc:'Pulse towers fire 25% faster at slowed enemies while a Frost tower is nearby.'}
];

})();
