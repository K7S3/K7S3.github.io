/* Nova Bastion - levels */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/*
 * Level definitions. Paths are waypoint lists on the 960x600 logical canvas;
 * offscreen endpoints (x < 0 or x > 960, y < 0 or y > 600) are the spawn and
 * exit gates. Intermediate waypoints stay inside 40px margins, are at least
 * 90px apart, and the path never self-intersects.
 *
 * waves: {note, hpMult, bountyMult?, boss?, enemies:[{type, count, gap, delay}]}
 *   gap   = seconds between spawns in a group
 *   delay = seconds after wave start before the group starts spawning
 * anomalies: scheduled events by wave number. Types: meteor, goldrush,
 *   elite, ionstorm, solarflare.
 */
NB.LEVELS = [

  /* ---------------- Level 1: Ember Drift ---------------- */
  {
    id:'ember-drift', name:'Ember Drift',
    tagline:'A long, lazy river of starlight. Learn the ropes.',
    difficulty:1, startGold:240, lives:20,
    path:[[-30,380],[260,380],[260,200],[480,200],[480,380],[700,380],[700,200],[920,200],[920,420],[1010,420]],
    plots:[
      {x:130,y:300},{x:370,y:300},{x:590,y:300},{x:810,y:300},
      {x:130,y:460},{x:370,y:120},{x:590,y:460},{x:810,y:120},{x:810,y:420}
    ],
    waves:[
      {note:'Scout drones', hpMult:1.0, enemies:[{type:'drone',count:6,gap:1.0,delay:0}]},
      {note:'Fast movers', hpMult:1.0, enemies:[{type:'drone',count:5,gap:0.9,delay:0},{type:'runner',count:2,gap:0.7,delay:3}]},
      {note:'Swarmling pack', hpMult:1.05, enemies:[{type:'swarmling',count:10,gap:0.5,delay:0},{type:'drone',count:4,gap:0.8,delay:2}]},
      {note:'First armor', hpMult:1.1, enemies:[{type:'tank',count:1,gap:0,delay:2},{type:'drone',count:4,gap:0.9,delay:0}]},
      {note:'Runner rush', hpMult:1.1, enemies:[{type:'runner',count:6,gap:0.5,delay:0}]},
      {note:'Meteor drill', hpMult:1.2, enemies:[{type:'drone',count:8,gap:0.7,delay:0},{type:'swarmling',count:8,gap:0.4,delay:3}]},
      {note:'Shield scouts', hpMult:1.25, enemies:[{type:'shieldbearer',count:3,gap:1.5,delay:0},{type:'drone',count:6,gap:0.8,delay:2}]},
      {note:'Ghosts', hpMult:1.3, enemies:[{type:'phantom',count:2,gap:2.0,delay:1},{type:'runner',count:6,gap:0.6,delay:2}]},
      {note:'Armor column', hpMult:1.4, enemies:[{type:'tank',count:3,gap:2.5,delay:0},{type:'drone',count:8,gap:0.7,delay:3}]},
      {note:'DREADNOUGHT', hpMult:1.0, boss:true, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'drone',count:6,gap:1.2,delay:5}]},
      {note:'Splitters', hpMult:1.5, enemies:[{type:'splitter',count:2,gap:3.0,delay:1},{type:'swarmling',count:6,gap:0.5,delay:2}]},
      {note:'Field medic', hpMult:1.55, enemies:[{type:'medic',count:1,gap:0,delay:3},{type:'tank',count:2,gap:2.5,delay:0},{type:'drone',count:8,gap:0.7,delay:2}]},
      {note:'Gold fever', hpMult:1.6, enemies:[{type:'mite',count:12,gap:0.4,delay:0},{type:'phantom',count:3,gap:1.5,delay:4}]},
      {note:'Shield wall', hpMult:1.65, enemies:[{type:'shieldbearer',count:5,gap:1.5,delay:0},{type:'drone',count:10,gap:0.6,delay:2}]},
      {note:'Swarm storm', hpMult:1.7, enemies:[{type:'swarmling',count:20,gap:0.35,delay:0},{type:'splitter',count:2,gap:2.5,delay:4}]},
      {note:'Brute force', hpMult:1.75, enemies:[{type:'brute',count:1,gap:0,delay:4},{type:'tank',count:3,gap:2.0,delay:0}]},
      {note:'Combat medics', hpMult:1.85, enemies:[{type:'medic',count:2,gap:4.0,delay:2},{type:'shieldbearer',count:4,gap:1.5,delay:0},{type:'drone',count:8,gap:0.6,delay:3}]},
      {note:'Phase split', hpMult:1.95, enemies:[{type:'phantom',count:6,gap:1.0,delay:0},{type:'splitter',count:3,gap:2.5,delay:2}]},
      {note:'Heavy column', hpMult:2.05, enemies:[{type:'tank',count:6,gap:1.8,delay:0},{type:'brute',count:1,gap:0,delay:6},{type:'drone',count:10,gap:0.5,delay:2}]},
      {note:'OVERMIND', hpMult:1.0, boss:true, enemies:[{type:'overmind',count:1,gap:0,delay:2},{type:'phantom',count:4,gap:1.5,delay:6},{type:'drone',count:6,gap:1.0,delay:8}]}
    ],
    anomalies:[
      {wave:6, type:'meteor'},
      {wave:13, type:'goldrush'},
      {wave:17, type:'elite'}
    ],
    par:{minTowers:6}
  },

  /* ---------------- Level 2: Frostbite Run ---------------- */
  {
    id:'frostbite-run', name:'Frostbite Run',
    tagline:'Cold corridors and tighter turns. Watch the skies.',
    difficulty:2, startGold:240, lives:18,
    path:[[-30,140],[240,140],[240,300],[480,300],[480,140],[720,140],[720,460],[990,460]],
    plots:[
      {x:120,y:220},{x:360,y:220},{x:600,y:220},{x:800,y:220},
      {x:360,y:380},{x:240,y:380},{x:800,y:380},{x:920,y:380},
      {x:120,y:60},{x:480,y:60},{x:600,y:60}
    ],
    waves:[
      {note:'Scout drones', hpMult:1.0, enemies:[{type:'drone',count:6,gap:0.9,delay:0}]},
      {note:'Fast movers', hpMult:1.05, enemies:[{type:'runner',count:4,gap:0.6,delay:0},{type:'drone',count:5,gap:0.8,delay:2}]},
      {note:'Swarmling pack', hpMult:1.1, enemies:[{type:'swarmling',count:10,gap:0.45,delay:0},{type:'drone',count:5,gap:0.8,delay:2}]},
      {note:'First armor', hpMult:1.2, enemies:[{type:'tank',count:2,gap:2.0,delay:1},{type:'drone',count:4,gap:0.8,delay:0}]},
      {note:'Solar winds', hpMult:1.25, enemies:[{type:'runner',count:8,gap:0.5,delay:0},{type:'swarmling',count:8,gap:0.4,delay:3}]},
      {note:'Shield scouts', hpMult:1.3, enemies:[{type:'shieldbearer',count:3,gap:1.4,delay:0},{type:'drone',count:7,gap:0.7,delay:2}]},
      {note:'Ghosts', hpMult:1.35, enemies:[{type:'phantom',count:3,gap:1.8,delay:1},{type:'runner',count:6,gap:0.6,delay:2}]},
      {note:'Split and run', hpMult:1.4, enemies:[{type:'splitter',count:2,gap:2.5,delay:1},{type:'runner',count:8,gap:0.5,delay:3}]},
      {note:'Armor column', hpMult:1.45, enemies:[{type:'tank',count:4,gap:2.2,delay:0},{type:'drone',count:8,gap:0.7,delay:3}]},
      {note:'DREADNOUGHT', hpMult:1.0, boss:true, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'drone',count:8,gap:1.0,delay:5}]},
      {note:'Combat medics', hpMult:1.65, enemies:[{type:'medic',count:1,gap:0,delay:3},{type:'shieldbearer',count:4,gap:1.4,delay:0},{type:'drone',count:8,gap:0.7,delay:2}]},
      {note:'Meteor drill', hpMult:1.7, enemies:[{type:'tank',count:4,gap:2.0,delay:0},{type:'swarmling',count:12,gap:0.4,delay:3}]},
      {note:'Phantom wave', hpMult:1.75, enemies:[{type:'phantom',count:6,gap:1.0,delay:0},{type:'runner',count:8,gap:0.5,delay:3}]},
      {note:'Mite rush', hpMult:1.8, enemies:[{type:'mite',count:14,gap:0.35,delay:0},{type:'drone',count:8,gap:0.6,delay:3}]},
      {note:'Brutes', hpMult:1.9, enemies:[{type:'brute',count:1,gap:0,delay:5},{type:'tank',count:4,gap:2.0,delay:0}]},
      {note:'Shield wall', hpMult:2.0, enemies:[{type:'shieldbearer',count:7,gap:1.2,delay:0},{type:'drone',count:10,gap:0.6,delay:2}]},
      {note:'Split storm', hpMult:2.1, enemies:[{type:'splitter',count:4,gap:2.0,delay:0},{type:'swarmling',count:12,gap:0.4,delay:3}]},
      {note:'Gold fever', hpMult:2.2, enemies:[{type:'mite',count:16,gap:0.3,delay:0},{type:'phantom',count:4,gap:1.2,delay:4}]},
      {note:'Medic guard', hpMult:2.3, enemies:[{type:'medic',count:2,gap:3.5,delay:2},{type:'brute',count:1,gap:0,delay:6},{type:'tank',count:4,gap:2.0,delay:0}]},
      {note:'OVERMIND', hpMult:1.0, boss:true, enemies:[{type:'overmind',count:1,gap:0,delay:2},{type:'shieldbearer',count:4,gap:1.5,delay:6},{type:'drone',count:8,gap:0.9,delay:8}]},
      {note:'Last push', hpMult:2.5, bountyMult:1.2, enemies:[{type:'tank',count:6,gap:1.6,delay:0},{type:'phantom',count:6,gap:1.0,delay:3},{type:'splitter',count:3,gap:2.0,delay:5}]},
      {note:'DREADNOUGHT PRIME', hpMult:2.0, boss:true, bountyMult:1.3, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'brute',count:2,gap:4.0,delay:8},{type:'drone',count:10,gap:0.8,delay:10}]}
    ],
    anomalies:[
      {wave:5, type:'solarflare'},
      {wave:12, type:'meteor'},
      {wave:18, type:'goldrush'}
    ],
    par:{minTowers:8}
  },

  /* ---------------- Level 3: Neon Spiral ---------------- */
  {
    id:'neon-spiral', name:'Neon Spiral',
    tagline:'The path coils inward. Bring area damage.',
    difficulty:3, startGold:250, lives:18,
    path:[[-30,100],[880,100],[880,220],[240,220],[240,340],[720,340],[720,460],[990,460]],
    plots:[
      {x:200,y:160},{x:450,y:160},{x:700,y:160},{x:350,y:160},
      {x:120,y:160},{x:150,y:280},{x:450,y:280},{x:800,y:280},
      {x:350,y:400},{x:600,y:400},{x:800,y:400},{x:940,y:400}
    ],
    waves:[
      {note:'Scout drones', hpMult:1.0, enemies:[{type:'drone',count:7,gap:0.8,delay:0}]},
      {note:'Runners', hpMult:1.05, enemies:[{type:'runner',count:5,gap:0.55,delay:0},{type:'drone',count:5,gap:0.7,delay:2}]},
      {note:'Swarm', hpMult:1.1, enemies:[{type:'swarmling',count:12,gap:0.4,delay:0},{type:'drone',count:6,gap:0.7,delay:2}]},
      {note:'Armor', hpMult:1.25, enemies:[{type:'tank',count:2,gap:1.8,delay:1},{type:'runner',count:6,gap:0.6,delay:0}]},
      {note:'Shields', hpMult:1.3, enemies:[{type:'shieldbearer',count:4,gap:1.3,delay:0},{type:'drone',count:8,gap:0.7,delay:2}]},
      {note:'Ghosts', hpMult:1.35, enemies:[{type:'phantom',count:4,gap:1.5,delay:1},{type:'swarmling',count:10,gap:0.4,delay:3}]},
      {note:'Elite vanguard', hpMult:1.4, enemies:[{type:'tank',count:4,gap:1.8,delay:0},{type:'shieldbearer',count:3,gap:1.4,delay:2}]},
      {note:'Splitters', hpMult:1.45, enemies:[{type:'splitter',count:3,gap:2.2,delay:1},{type:'drone',count:10,gap:0.6,delay:2}]},
      {note:'Medic train', hpMult:1.5, enemies:[{type:'medic',count:2,gap:3.0,delay:2},{type:'tank',count:4,gap:1.8,delay:0}]},
      {note:'DREADNOUGHT', hpMult:1.0, boss:true, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'runner',count:8,gap:0.8,delay:5}]},
      {note:'Mite gold', hpMult:2.2, enemies:[{type:'mite',count:14,gap:0.35,delay:0},{type:'drone',count:8,gap:0.6,delay:2}]},
      {note:'Brute pair', hpMult:2.3, enemies:[{type:'brute',count:2,gap:5.0,delay:2},{type:'drone',count:10,gap:0.6,delay:0}]},
      {note:'Phantom flood', hpMult:2.4, enemies:[{type:'phantom',count:8,gap:0.9,delay:0},{type:'runner',count:8,gap:0.5,delay:3}]},
      {note:'Meteor drill', hpMult:2.5, enemies:[{type:'tank',count:6,gap:1.6,delay:0},{type:'splitter',count:3,gap:2.0,delay:3}]},
      {note:'Shield fortress', hpMult:2.6, enemies:[{type:'shieldbearer',count:8,gap:1.1,delay:0},{type:'medic',count:1,gap:0,delay:4},{type:'drone',count:10,gap:0.6,delay:2}]},
      {note:'Swarm storm', hpMult:2.7, enemies:[{type:'swarmling',count:24,gap:0.3,delay:0},{type:'splitter',count:3,gap:2.0,delay:4}]},
      {note:'Heavy armor', hpMult:2.8, enemies:[{type:'tank',count:8,gap:1.5,delay:0},{type:'brute',count:1,gap:0,delay:8}]},
      {note:'Ghost medics', hpMult:2.9, enemies:[{type:'phantom',count:6,gap:1.0,delay:0},{type:'medic',count:2,gap:3.0,delay:3},{type:'drone',count:8,gap:0.6,delay:1}]},
      {note:'Gold fever', hpMult:3.0, bountyMult:1.15, enemies:[{type:'mite',count:18,gap:0.3,delay:0},{type:'runner',count:10,gap:0.5,delay:3}]},
      {note:'OVERMIND', hpMult:1.0, boss:true, enemies:[{type:'overmind',count:1,gap:0,delay:2},{type:'phantom',count:6,gap:1.2,delay:6},{type:'tank',count:4,gap:1.8,delay:8}]},
      {note:'Goldrush grand', hpMult:3.57, bountyMult:1.2, enemies:[{type:'mite',count:20,gap:0.28,delay:0},{type:'brute',count:1,gap:0,delay:6}]},
      {note:'Split horizon', hpMult:3.68, enemies:[{type:'splitter',count:5,gap:1.8,delay:0},{type:'swarmling',count:16,gap:0.35,delay:3}]},
      {note:'Dread column', hpMult:3.79, enemies:[{type:'tank',count:8,gap:1.4,delay:0},{type:'shieldbearer',count:6,gap:1.2,delay:3},{type:'medic',count:2,gap:3.5,delay:5}]},
      {note:'Brute wave', hpMult:3.91, bountyMult:1.25, enemies:[{type:'brute',count:3,gap:4.0,delay:0},{type:'phantom',count:8,gap:0.9,delay:2},{type:'drone',count:12,gap:0.5,delay:4}]},
      {note:'OVERMIND ASCENDANT', hpMult:1.6, boss:true, bountyMult:1.4, enemies:[{type:'overmind',count:1,gap:0,delay:2},{type:'brute',count:2,gap:4.0,delay:8},{type:'phantom',count:6,gap:1.2,delay:10}]}
    ],
    anomalies:[
      {wave:7, type:'elite'},
      {wave:14, type:'meteor'},
      {wave:21, type:'goldrush'}
    ],
    par:{minTowers:10}
  },

  /* ---------------- Level 4: Ion Maelstrom ---------------- */
  {
    id:'ion-maelstrom', name:'Ion Maelstrom',
    tagline:'Charged air, heavy armor, zero mercy.',
    difficulty:4, startGold:280, lives:16,
    path:[[-30,500],[300,500],[300,100],[540,100],[540,500],[780,500],[780,100],[990,100]],
    plots:[
      {x:150,y:420},{x:400,y:400},{x:660,y:420},{x:480,y:420},
      {x:60,y:420},{x:210,y:420},{x:880,y:420},
      {x:210,y:180},{x:420,y:180},{x:640,y:180},{x:880,y:180},
      {x:480,y:45},{x:930,y:40}
    ],
    waves:[
      {note:'Scout drones', hpMult:1.0, enemies:[{type:'drone',count:8,gap:0.75,delay:0}]},
      {note:'Runners', hpMult:1.05, enemies:[{type:'runner',count:5,gap:0.5,delay:0},{type:'drone',count:4,gap:0.7,delay:2}]},
      {note:'Swarm', hpMult:1.1, enemies:[{type:'swarmling',count:12,gap:0.38,delay:0},{type:'drone',count:6,gap:0.7,delay:2}]},
      {note:'Armor', hpMult:1.2, enemies:[{type:'tank',count:2,gap:1.7,delay:1},{type:'drone',count:6,gap:0.6,delay:0}]},
      {note:'Shields', hpMult:1.25, enemies:[{type:'shieldbearer',count:5,gap:1.2,delay:0},{type:'runner',count:6,gap:0.6,delay:2}]},
      {note:'Ghosts', hpMult:1.3, enemies:[{type:'phantom',count:5,gap:1.3,delay:1},{type:'drone',count:8,gap:0.6,delay:2}]},
      {note:'Splitters', hpMult:1.35, enemies:[{type:'splitter',count:3,gap:2.0,delay:1},{type:'swarmling',count:12,gap:0.35,delay:3}]},
      {note:'Solar storm', hpMult:1.4, enemies:[{type:'runner',count:10,gap:0.45,delay:0},{type:'mite',count:10,gap:0.35,delay:3}]},
      {note:'Medic train', hpMult:1.45, enemies:[{type:'medic',count:2,gap:2.8,delay:2},{type:'tank',count:5,gap:1.7,delay:0}]},
      {note:'DREADNOUGHT', hpMult:1.0, boss:true, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'drone',count:6,gap:0.9,delay:5}]},
      {note:'Brutes', hpMult:2.2, enemies:[{type:'brute',count:1,gap:0,delay:5},{type:'tank',count:2,gap:1.8,delay:0}]},
      {note:'Phantom flood', hpMult:2.3, enemies:[{type:'phantom',count:8,gap:0.85,delay:0},{type:'drone',count:10,gap:0.55,delay:3}]},
      {note:'Shield fortress', hpMult:2.4, enemies:[{type:'shieldbearer',count:9,gap:1.0,delay:0},{type:'drone',count:10,gap:0.55,delay:2}]},
      {note:'Swarm storm', hpMult:2.5, enemies:[{type:'swarmling',count:26,gap:0.28,delay:0},{type:'splitter',count:4,gap:1.8,delay:4}]},
      {note:'Elite guard', hpMult:2.6, enemies:[{type:'tank',count:6,gap:1.5,delay:0},{type:'shieldbearer',count:5,gap:1.1,delay:2},{type:'medic',count:2,gap:3.0,delay:4}]},
      {note:'Heavy armor', hpMult:2.7, enemies:[{type:'tank',count:9,gap:1.4,delay:0},{type:'brute',count:1,gap:0,delay:8}]},
      {note:'Ghost medics', hpMult:2.8, enemies:[{type:'phantom',count:8,gap:0.9,delay:0},{type:'medic',count:2,gap:2.8,delay:3},{type:'runner',count:8,gap:0.5,delay:1}]},
      {note:'Mite gold', hpMult:2.9, enemies:[{type:'mite',count:18,gap:0.3,delay:0},{type:'drone',count:10,gap:0.5,delay:2}]},
      {note:'Brute force', hpMult:3.0, enemies:[{type:'brute',count:3,gap:3.5,delay:0},{type:'tank',count:6,gap:1.5,delay:2}]},
      {note:'OVERMIND', hpMult:1.0, boss:true, enemies:[{type:'overmind',count:1,gap:0,delay:2},{type:'shieldbearer',count:6,gap:1.2,delay:6},{type:'phantom',count:6,gap:1.1,delay:8}]},
      {note:'Split horizon', hpMult:3.72, enemies:[{type:'splitter',count:6,gap:1.6,delay:0},{type:'swarmling',count:18,gap:0.32,delay:3}]},
      {note:'Meteor drill', hpMult:3.84, enemies:[{type:'tank',count:8,gap:1.4,delay:0},{type:'brute',count:2,gap:3.5,delay:4}]},
      {note:'Dread column', hpMult:3.96, enemies:[{type:'shieldbearer',count:8,gap:1.0,delay:0},{type:'tank',count:8,gap:1.4,delay:2},{type:'medic',count:3,gap:2.5,delay:5}]},
      {note:'Phantom legion', hpMult:4.08, enemies:[{type:'phantom',count:12,gap:0.8,delay:0},{type:'runner',count:10,gap:0.45,delay:2}]},
      {note:'Gold fever', hpMult:4.08, bountyMult:1.2, enemies:[{type:'mite',count:22,gap:0.28,delay:0},{type:'brute',count:2,gap:3.5,delay:5}]},
      {note:'Siege breakers', hpMult:4.2, bountyMult:1.25, enemies:[{type:'brute',count:4,gap:3.0,delay:0},{type:'tank',count:8,gap:1.3,delay:2},{type:'medic',count:2,gap:2.5,delay:6}]},
      {note:'Final muster', hpMult:4.32, bountyMult:1.3, enemies:[{type:'phantom',count:10,gap:0.8,delay:0},{type:'splitter',count:5,gap:1.6,delay:2},{type:'shieldbearer',count:8,gap:1.0,delay:4},{type:'tank',count:6,gap:1.4,delay:6}]},
      {note:'LEVIATHAN', hpMult:1.3, boss:true, bountyMult:1.5, enemies:[{type:'leviathan',count:1,gap:0,delay:2},{type:'brute',count:2,gap:4.0,delay:10},{type:'phantom',count:8,gap:1.0,delay:12}]}
    ],
    anomalies:[
      {wave:8, type:'solarflare'},
      {wave:15, type:'elite'},
      {wave:22, type:'meteor'},
      {wave:25, type:'goldrush'}
    ],
    par:{minTowers:12}
  },

  /* ---------------- Level 5: Event Horizon ---------------- */
  {
    id:'event-horizon', name:'Event Horizon',
    tagline:'Beyond this point, only legends return.',
    difficulty:5, startGold:300, lives:15,
    path:[[-30,300],[140,300],[140,180],[320,180],[320,300],[500,300],[500,180],[680,180],[680,400],[860,400],[860,640]],
    plots:[
      {x:60,y:220},{x:230,y:240},{x:410,y:240},{x:590,y:240},{x:770,y:240},
      {x:770,y:470},{x:610,y:470},{x:610,y:330},
      {x:410,y:120},{x:230,y:120},{x:590,y:120},
      {x:60,y:380},{x:930,y:470},{x:930,y:340}
    ],
    waves:[
      {note:'Scout drones', hpMult:1.0, enemies:[{type:'drone',count:8,gap:0.7,delay:0}]},
      {note:'Runners', hpMult:1.05, enemies:[{type:'runner',count:5,gap:0.5,delay:0},{type:'drone',count:4,gap:0.65,delay:2}]},
      {note:'Swarm', hpMult:1.1, enemies:[{type:'swarmling',count:12,gap:0.35,delay:0},{type:'drone',count:5,gap:0.6,delay:2}]},
      {note:'Armor', hpMult:1.25, enemies:[{type:'tank',count:3,gap:1.6,delay:1},{type:'runner',count:5,gap:0.55,delay:0}]},
      {note:'Shields', hpMult:1.3, enemies:[{type:'shieldbearer',count:6,gap:1.1,delay:0},{type:'drone',count:8,gap:0.6,delay:2}]},
      {note:'Meteor drill', hpMult:1.35, enemies:[{type:'tank',count:4,gap:1.6,delay:0},{type:'swarmling',count:14,gap:0.32,delay:3}]},
      {note:'Ghosts', hpMult:1.4, enemies:[{type:'phantom',count:6,gap:1.2,delay:1},{type:'runner',count:8,gap:0.5,delay:2}]},
      {note:'Splitters', hpMult:1.45, enemies:[{type:'splitter',count:4,gap:1.8,delay:1},{type:'drone',count:10,gap:0.55,delay:2}]},
      {note:'Medic train', hpMult:1.5, enemies:[{type:'medic',count:2,gap:2.5,delay:2},{type:'tank',count:6,gap:1.5,delay:0}]},
      {note:'DREADNOUGHT', hpMult:1.0, boss:true, enemies:[{type:'dreadnought',count:1,gap:0,delay:2},{type:'runner',count:10,gap:0.7,delay:5}]},
      {note:'Brutes', hpMult:2.4, enemies:[{type:'brute',count:1,gap:0,delay:5},{type:'tank',count:3,gap:1.5,delay:0}]},
      {note:'Elite guard', hpMult:2.5, enemies:[{type:'shieldbearer',count:7,gap:1.0,delay:0},{type:'tank',count:6,gap:1.4,delay:2}]},
      {note:'Phantom flood', hpMult:2.6, enemies:[{type:'phantom',count:10,gap:0.8,delay:0},{type:'swarmling',count:14,gap:0.32,delay:3}]},
      {note:'Swarm storm', hpMult:2.7, enemies:[{type:'swarmling',count:28,gap:0.26,delay:0},{type:'splitter',count:5,gap:1.6,delay:4}]},
      {note:'Heavy armor', hpMult:2.8, enemies:[{type:'tank',count:10,gap:1.3,delay:0},{type:'brute',count:2,gap:3.5,delay:6}]},
      {note:'Ghost medics', hpMult:2.9, enemies:[{type:'phantom',count:10,gap:0.8,delay:0},{type:'medic',count:3,gap:2.5,delay:3},{type:'drone',count:10,gap:0.5,delay:1}]},
      {note:'Mite gold', hpMult:3.0, enemies:[{type:'mite',count:20,gap:0.28,delay:0},{type:'runner',count:10,gap:0.45,delay:2}]},
      {note:'Brute force', hpMult:3.1, enemies:[{type:'brute',count:4,gap:3.0,delay:0},{type:'shieldbearer',count:6,gap:1.0,delay:2}]},
      {note:'Solar storm', hpMult:3.2, enemies:[{type:'phantom',count:12,gap:0.75,delay:0},{type:'runner',count:12,gap:0.4,delay:2}]},
      {note:'OVERMIND', hpMult:1, boss:true, enemies:[{type:'overmind',count:1,gap:0,delay:2},{type:'tank',count:6,gap:1.4,delay:6},{type:'phantom',count:8,gap:1.0,delay:8}]},
      {note:'Shield fortress', hpMult:4.29, enemies:[{type:'shieldbearer',count:10,gap:0.9,delay:0},{type:'medic',count:3,gap:2.2,delay:4},{type:'drone',count:12,gap:0.5,delay:2}]},
      {note:'Split horizon', hpMult:4.42, enemies:[{type:'splitter',count:7,gap:1.5,delay:0},{type:'swarmling',count:20,gap:0.3,delay:3}]},
      {note:'Dread column', hpMult:4.55, enemies:[{type:'tank',count:10,gap:1.25,delay:0},{type:'brute',count:3,gap:3.0,delay:3},{type:'medic',count:3,gap:2.2,delay:6}]},
      {note:'Phantom legion', hpMult:4.68, enemies:[{type:'phantom',count:14,gap:0.7,delay:0},{type:'drone',count:12,gap:0.45,delay:2}]},
      {note:'Siege breakers', hpMult:4.81, bountyMult:1.2, enemies:[{type:'brute',count:5,gap:2.8,delay:0},{type:'tank',count:10,gap:1.2,delay:2},{type:'shieldbearer',count:8,gap:0.9,delay:5}]},
      {note:'Gold fever', hpMult:4.94, bountyMult:1.25, enemies:[{type:'mite',count:24,gap:0.26,delay:0},{type:'phantom',count:10,gap:0.75,delay:4}]},
      {note:'Storm front', hpMult:5.07, enemies:[{type:'runner',count:14,gap:0.32,delay:0},{type:'swarmling',count:20,gap:0.24,delay:2},{type:'splitter',count:5,gap:1.3,delay:5}]},
      {note:'Iron tide', hpMult:5.2, bountyMult:1.3, enemies:[{type:'tank',count:10,gap:1.0,delay:0},{type:'brute',count:4,gap:2.6,delay:4},{type:'medic',count:3,gap:2.0,delay:7}]},
      {note:'Harbingers', hpMult:5.33, bountyMult:1.35, enemies:[{type:'phantom',count:12,gap:0.65,delay:0},{type:'shieldbearer',count:8,gap:0.8,delay:2},{type:'splitter',count:5,gap:1.3,delay:5},{type:'brute',count:3,gap:2.8,delay:8}]},
      {note:'LEVIATHAN PRIME', hpMult:2.2, boss:true, bountyMult:1.5, enemies:[{type:'leviathan',count:1,gap:0,delay:2},{type:'brute',count:5,gap:3.2,delay:10},{type:'phantom',count:12,gap:0.85,delay:12},{type:'tank',count:10,gap:1.1,delay:14}]}
    ],
    anomalies:[
      {wave:6, type:'meteor'},
      {wave:12, type:'elite'},
      {wave:19, type:'solarflare'},
      {wave:26, type:'goldrush'}
    ],
    par:{minTowers:14}
  }

];

})();
