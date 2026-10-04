/* Nova Bastion - enemies */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/*
 * Enemy roster. hp / speed / bounty are base numbers; waves may multiply hp
 * via hpMult and bounty via bountyMult. Speed is px/sec. lives is the life
 * cost when the enemy leaks.
 */
NB.ENEMIES = {

  drone: {
    name:'Drone', hp:34, speed:72, bounty:6, lives:1, size:10,
    color:'#38bdf8', glow:'#0ea5e9', abilities:{},
    desc:'Standard scout. Weak alone, dangerous in numbers.'
  },

  runner: {
    name:'Runner', hp:22, speed:125, bounty:7, lives:1, size:8,
    color:'#f472b6', glow:'#ec4899', abilities:{},
    desc:'Fast and fragile. Blink and it slips past.'
  },

  swarmling: {
    name:'Swarmling', hp:14, speed:85, bounty:3, lives:1, size:6,
    color:'#fbbf24', glow:'#f59e0b', abilities:{},
    desc:'Tiny and expendable. Always travels in packs.'
  },

  tank: {
    name:'Tank', hp:220, speed:45, bounty:14, lives:2, size:16,
    color:'#94a3b8', glow:'#64748b', abilities:{},
    desc:'Slow, armored, and stubborn. Costs two lives if it leaks.'
  },

  shieldbearer: {
    name:'Shieldbearer', hp:90, speed:60, bounty:12, lives:1, size:12,
    color:'#4ade80', glow:'#22c55e',
    abilities:{shield:60},
    desc:'Carries an energy shield that absorbs damage before its hull takes a hit.'
  },

  phantom: {
    name:'Phantom', hp:70, speed:95, bounty:13, lives:1, size:10,
    color:'#c084fc', glow:'#a855f7',
    abilities:{phase:{every:6, duration:2}},
    desc:'Phases out of reality every few seconds, becoming untargetable.'
  },

  medic: {
    name:'Medic', hp:80, speed:65, bounty:15, lives:1, size:11,
    color:'#34d399', glow:'#10b981',
    abilities:{heal:{radius:90, amount:12, interval:2}},
    desc:'Repairs nearby allies. Take it out first.'
  },

  splitter: {
    name:'Splitter', hp:110, speed:70, bounty:10, lives:1, size:13,
    color:'#fb7185', glow:'#f43f5e',
    abilities:{split:{into:'swarmling', count:3}},
    desc:'Bursts into three swarmlings when destroyed.'
  },

  mite: {
    name:'Mite', hp:10, speed:90, bounty:4, lives:1, size:6,
    color:'#fde68a', glow:'#facc15', abilities:{},
    desc:'Golden pest. Worth triple during a gold rush.'
  },

  brute: {
    name:'Brute', hp:900, speed:40, bounty:30, lives:3, size:18,
    color:'#f97316', glow:'#ea580c', abilities:{},
    desc:'Late-game heavy. A walking wall of hit points.'
  },

  dreadnought: {
    name:'Dreadnought', hp:2600, speed:32, bounty:150, lives:10, size:26,
    color:'#ef4444', glow:'#dc2626',
    abilities:{
      shield:400,
      shieldRegen:{amount:25, interval:3},
      spawn:{type:'drone', count:2, interval:9}
    },
    desc:'First boss. Regenerating shields and a drone escort.'
  },

  overmind: {
    name:'Overmind', hp:7000, speed:30, bounty:300, lives:15, size:30,
    color:'#a855f7', glow:'#9333ea',
    abilities:{
      slowResist:0.5,
      allyShield:{radius:110, amount:150, interval:12}
    },
    desc:'Second boss. Resists slows and shields its allies.'
  },

  leviathan: {
    name:'Leviathan', hp:12000, speed:36, bounty:600, lives:20, size:34,
    color:'#06b6d4', glow:'#0891b2',
    abilities:{
      split:{into:'tank', count:2},
      enrage:{hpFrac:0.3, speedMult:1.6}
    },
    desc:'Final boss. Splits into tanks and enrages when wounded.'
  }

};

})();
