/* Nova Bastion 3D - enemies (the RUST machine swarm) */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/*
 * Enemy roster, retuned for 3D swarm scale (hundreds-strong waves).
 *
 * hp / speed / bounty are base numbers; waves may multiply hp via hpMult and
 * bounty via bountyMult. speed is CELLS per second (cell = 2 world units).
 * melee is damage per second dealt to structures (walls, towers, reactors,
 * the Command Spire) when the machine reaches them.
 *
 * affinity:'hardened' marks hardened chassis types (Wraith, Hive Carrier):
 * during blackout surges they gain +30% speed and +20% HP.
 * insulated:true (default false) makes a unit immune to slows; the Director
 * can grant it to skitters and wraiths late in a run.
 */
NB.ENEMIES = {

  drone: {
    name:'Scout Drone', hp:12, speed:3.5, bounty:4, size:10, melee:8,
    affinity:null, insulated:false,
    color:'#38bdf8', glow:'#0ea5e9', abilities:{},
    desc:'Standard rust scout. Weak alone, dangerous in numbers.'
  },

  runner: {
    name:'Skitter', hp:8, speed:5.5, bounty:5, size:8, melee:6,
    affinity:null, insulated:false,
    color:'#f472b6', glow:'#ec4899', abilities:{},
    desc:'Fast spider-bot. Blink and it slips past the line.'
  },

  swarmling: {
    name:'Shredder', hp:6, speed:4, bounty:2, size:6, melee:4,
    affinity:null, insulated:false,
    color:'#fbbf24', glow:'#f59e0b', abilities:{},
    desc:'Tiny buzzsaw bot. Always travels in packs.'
  },

  tank: {
    name:'Siege Walker', hp:80, speed:2.2, bounty:12, size:16, melee:20,
    affinity:null, insulated:false,
    color:'#94a3b8', glow:'#64748b', abilities:{},
    desc:'Slow, armored walker. Chews through barricades.'
  },

  shieldbearer: {
    name:'Aegis Shield-bot', hp:36, speed:3, bounty:10, size:12, melee:12,
    affinity:null, insulated:false,
    color:'#4ade80', glow:'#22c55e',
    abilities:{shield:24},
    desc:'Projects a shield screen that absorbs fire before its hull takes a hit.'
  },

  phantom: {
    name:'Wraith', hp:28, speed:4.5, bounty:11, size:10, melee:14,
    affinity:'hardened', insulated:false,
    color:'#c084fc', glow:'#a855f7',
    abilities:{phase:{every:6, duration:2}},
    desc:'Hardened camo unit. Phases out of targeting every few seconds, and surges with the blackouts.'
  },

  medic: {
    name:'Repair Drone', hp:32, speed:3, bounty:13, size:11, melee:5,
    affinity:null, insulated:false,
    color:'#34d399', glow:'#10b981',
    abilities:{heal:{radius:4.5, amount:6, interval:2}},
    desc:'Welds nearby rust units back together. Take it out first.'
  },

  splitter: {
    name:'Hive Carrier', hp:44, speed:3.2, bounty:8, size:13, melee:12,
    affinity:'hardened', insulated:false,
    color:'#fb7185', glow:'#f43f5e',
    abilities:{split:{into:'swarmling', count:3}},
    desc:'Hardened brood chassis. Bursts into three shredders when destroyed.'
  },

  mite: {
    name:'Tick', hp:5, speed:4.5, bounty:4, size:6, melee:4,
    affinity:null, insulated:false,
    color:'#fde68a', glow:'#facc15', abilities:{},
    desc:'Golden scavenger bot. Worth extra during a salvage surge.'
  },

  sapper: {
    name:'Sapper', hp:18, speed:5, bounty:8, size:9, melee:120,
    affinity:null, insulated:false,
    color:'#f97316', glow:'#c2410c', abilities:{},
    desc:'Fast demolition unit. Ignores the spire and tears through walls and towers.'
  },

  brute: {
    name:'Juggernaut', hp:350, speed:2, bounty:25, size:18, melee:45,
    affinity:null, insulated:false,
    color:'#f97316', glow:'#ea580c', abilities:{},
    desc:'Late-war heavy. A walking wall of rusted armor.'
  },

  dreadnought: {
    name:'Dreadnought', hp:2500, speed:1.6, bounty:150, size:26, melee:100,
    affinity:null, insulated:false, boss:true,
    color:'#ef4444', glow:'#dc2626',
    abilities:{
      shield:400,
      shieldRegen:{amount:25, interval:3},
      spawn:{type:'drone', count:2, interval:9}
    },
    desc:'Swarm-intelligence boss. Regenerating shields and a drone escort.'
  },

  overmind: {
    name:'Overmind', hp:6500, speed:1.5, bounty:300, size:30, melee:120,
    affinity:null, insulated:false, boss:true,
    color:'#a855f7', glow:'#9333ea',
    abilities:{
      slowResist:0.5,
      allyShield:{radius:5.5, amount:150, interval:12}
    },
    desc:'Swarm-intelligence boss. Resists slows and shields its allies.'
  },

  leviathan: {
    name:'Leviathan', hp:11000, speed:1.8, bounty:600, size:34, melee:150,
    affinity:null, insulated:false, boss:true,
    color:'#06b6d4', glow:'#0891b2',
    abilities:{
      split:{into:'tank', count:2},
      enrage:{hpFrac:0.3, speedMult:1.6}
    },
    desc:'Swarm-intelligence boss. Splits into siege walkers and enrages when wounded.'
  }

};

})();
