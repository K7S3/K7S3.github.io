/* Nova Bastion 3D - sectors
 *
 * Year 2100. Humanity holds sealed arcologies against the RUST, a rogue
 * machine swarm. Each sector defends a COMMAND SPIRE at its heart.
 *
 * Sector def shape (sim-compatible: NB.createSim(sector) works directly):
 *   id, chapterId, chapter:{n,title}, name, tagline, difficulty,
 *   cols, rows, blocked:[{x,z,w,h}] (cell coords, unbuildable + unpathable),
 *   hq:{x,z} (cell), gates:[{x,z}] (edge cells, rust spawn points),
 *   hills:[{x,z,r,h}] (cell coords, plateau radius r, height h: high-ground
 *     tower spots; passable but costly in the flow field),
 *   barrels:[{x,z}] (cell coords, volatile barrels near gates),
 *   overclockCharges (per-sector overdrive budget),
 *   startGold, startMorale, lives, heatRadius (uplink radius is sim-side),
 *   waves:[{note, hpMult, bountyMult, boss?, surge?, enemies:[{type,count,gap,delay}]}],
 *   surges:[wave indices with BLACKOUT SURGE (EMP) events],
 *   eventWaves:[after clearing these waves, a random dilemma triggers],
 *   storyEvents:{waveIndex: storyEventId} (fixed story beats),
 *   edictsAt:[after clearing these waves, an edict choice triggers],
 *   anomalies:[{wave, type}] (meteor, goldrush, elite, ionstorm, solarflare),
 *   path (pixel waypoints, sim spawn route), plots:[{x,y}] (pixel build plots)
 *
 * Grid: 64 x 40 cells, 15 px per cell, on the 960 x 600 logical canvas.
 * Tower and enemy internal ids are unchanged from towers.js / enemies.js.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/* Global tower unlocks by AGE are owned by the sim (see sim towersForAge):
 * Reclamation: pulse, frost, mortar, mint; Fortification adds sniper, arc,
 * amplify; Dominion adds chrono. Ages advance automatically at wave thirds.
 * (An earlier draft defined NB.AGES here; removed: config.js owns NB.AGES
 * as the age name list and the sim reads it.) */

function wg(type, count, gap, delay){
  return { type:type, count:count, gap:gap, delay:(delay || 0) };
}
function wave(note, hpMult, bountyMult, groups, flags){
  var w = { note:note, hpMult:hpMult, bountyMult:bountyMult, enemies:groups };
  if (flags){
    for (var k in flags){
      if (Object.prototype.hasOwnProperty.call(flags, k)) w[k] = flags[k];
    }
  }
  return w;
}
function anom(waveIdx, type){ return { wave:waveIdx, type:type }; }

NB.SECTORS = [

/* ================= CHAPTER 1: Meridian Arcology ================= */
{
  id:'meridian-arcology',
  chapterId:1,
  chapter:{ n:1, title:'First Light' },
  name:'Meridian Arcology',
  tagline:'The outer arcology. Hold the perimeter while the spire wakes.',
  difficulty:1,
  env:{
    skyTop:'#3a1f33', skyHorizon:'#c4552a', skyBottom:'#1c0f14',
    fog:'#6e3524', fogDensity:0.0058,
    sunColor:'#ffb36b', sunIntensity:1.7, sunElev:24, sunAzim:145,
    hemiSky:'#c48a6a', hemiGround:'#3a2418', hemiIntensity:1.2,
    ground:['#6b5a4e','#7a5f4a','#5e4f45'], dust:'#c47a3a', stars:0.0, aurora:0.0
  },
  cols:64, rows:40,
  blocked:[
    {x:4,z:14,w:5,h:5},{x:16,z:4,w:6,h:3},{x:18,z:18,w:5,h:6},
    {x:24,z:32,w:6,h:4},{x:34,z:6,w:5,h:4},{x:36,z:18,w:4,h:3},
    {x:46,z:6,w:5,h:5},{x:48,z:28,w:6,h:5},{x:54,z:14,w:5,h:6},
    {x:26,z:33,w:4,h:3}
  ],
  hq:{x:32,z:20},
  gates:[{x:0,z:8},{x:63,z:28}],
  startGold:450, startMorale:70, lives:20,
  heatRadius:9,
  hills:[
    {x:6,z:5,r:3,h:2.5},{x:24,z:27,r:2.5,h:2},
    {x:40,z:14,r:2.5,h:2.5},{x:52,z:24,r:3,h:2}
  ],
  barrels:[{x:3,z:10},{x:5,z:6},{x:60,z:26},{x:58,z:30}],
  overclockCharges:3,
  waves:[
    wave('First contact', 1.0, 1.0, [
      wg('drone',14,0.9)]),
    wave('Rust tide incoming', 1.0, 1.0, [
      wg('drone',10,0.8), wg('runner',8,0.6,3)]),
    wave('Skitter pack', 1.05, 1.0, [
      wg('swarmling',24,0.4), wg('drone',8,0.8,2)]),
    wave('BLACKOUT SURGE', 1.1, 1.0, [
      wg('drone',18,0.7), wg('runner',10,0.5,2), wg('shieldbearer',3,1.5,4)], {surge:true}),
    wave('Siege walkers', 1.15, 1.0, [
      wg('tank',1,2.5,2), wg('drone',16,0.7)]),
    wave('Skitter tide', 1.2, 1.0, [
      wg('swarmling',30,0.35), wg('runner',12,0.5,3), wg('splitter',1,0.25,5)]),
    wave('Wraiths in the wire', 1.25, 1.0, [
      wg('phantom',2,1.8,1), wg('drone',22,0.7,2), wg('shieldbearer',4,1.4,4)]),
    wave('Armor column', 1.3, 1.0, [
      wg('tank',3,2.2), wg('drone',22,0.6,2)]),
    wave('BLACKOUT SURGE', 1.35, 1.1, [
      wg('runner',22,0.45), wg('swarmling',30,0.35,3), wg('tank',2,2.5,6)], {surge:true}),
    wave('SIEGE ENGINE', 0.9, 1.2, [
      wg('dreadnought',1,0.25,2), wg('drone',20,1,5)], {boss:true}),
    wave('The rust learns', 1.35, 1.0, [
      wg('drone',32,0.6), wg('shieldbearer',6,1.2,3), wg('phantom',3,1.5,5)]),
    wave('Medic escort', 1.4, 1.0, [
      wg('medic',2,3.5,2), wg('tank',4,2), wg('drone',24,0.6,3)]),
    wave('Gold seam', 1.55, 1.25, [
      wg('mite',40,0.3), wg('runner',20,0.5,3)]),
    wave('BLACKOUT SURGE', 1.5, 1.1, [
      wg('tank',5,1.8), wg('shieldbearer',6,1.2,3), wg('splitter',2,2,6),
      wg('drone',32,0.5,2)], {surge:true}),
    wave('Swarm tide', 1.5, 1.0, [
      wg('swarmling',56,0.3), wg('splitter',3,2,4)]),
    wave('Heavy armor', 1.6, 1.1, [
      wg('tank',6,1.6), wg('brute',1,0.25,8), wg('drone',30,0.5,2)]),
    wave('Wraith pack', 1.65, 1.0, [
      wg('phantom',8,0.9), wg('runner',24,0.45,2), wg('medic',1,3,4)]),
    wave('Iron push', 1.7, 1.2, [
      wg('shieldbearer',8,1.1), wg('tank',5,1.5,2), wg('brute',1,4,6)]),
    wave('The long dark', 1.4, 1.2, [
      wg('drone',36,0.45), wg('runner',20,0.4,4), wg('tank',2,1.5,8)]),
    wave('FINAL SWARM', 1.0, 1.3, [
      wg('brute',2,3,2), wg('swarmling',48,0.25,4), wg('drone',32,0.4,8),
      wg('runner',18,0.35,10), wg('tank',4,1.5,12)], {surge:true})
  ],
  surges:[3,8,13,19],
  eventWaves:[3,6,9,12],
  storyEvents:{ 2:'refugees_at_gate' },
  edictsAt:[4,9,14],
  anomalies:[ anom(6,'meteor'), anom(12,'goldrush'), anom(16,'elite') ],
  path:[[-30,127],[200,127],[200,427],[420,427],[420,187],[640,187],[640,367],[488,367],[488,322]],
  plots:[
    {x:130,y:60},{x:280,y:200},{x:130,y:340},{x:300,y:400},{x:350,y:240},
    {x:500,y:260},{x:500,y:120},{x:560,y:260},{x:720,y:260},{x:720,y:60},
    {x:560,y:430},{x:400,y:300},{x:860,y:430}
  ]
},

/* ================= CHAPTER 2: Kestrel Arcology ================= */
{
  id:'kestrel-arcology',
  chapterId:2,
  chapter:{ n:2, title:'The Learning Dark' },
  name:'Kestrel Arcology',
  tagline:'Canyon approaches. The rust is learning the ground.',
  difficulty:2,
  env:{
    skyTop:'#02040c', skyHorizon:'#14406b', skyBottom:'#05070f',
    fog:'#0a1826', fogDensity:0.0062,
    sunColor:'#9ab8ff', sunIntensity:0.7, sunElev:55, sunAzim:230,
    hemiSky:'#3a5a8a', hemiGround:'#0c1420', hemiIntensity:0.85,
    ground:['#5a6478','#626c82','#4f586c'], dust:'#4a6a9a', stars:1.0, aurora:0.85
  },
  cols:64, rows:40,
  blocked:[
    {x:8,z:12,w:22,h:3},{x:34,z:12,w:22,h:3},
    {x:8,z:26,w:22,h:3},{x:34,z:26,w:22,h:3}
  ],
  hq:{x:32,z:20},
  gates:[{x:0,z:6},{x:63,z:16},{x:30,z:0}],
  startGold:480, startMorale:70, lives:18,
  heatRadius:9,
  hills:[
    {x:14,z:6,r:3,h:3},{x:28,z:18,r:2.5,h:2.5},
    {x:48,z:20,r:3,h:3},{x:59,z:10,r:2.5,h:2}
  ],
  barrels:[{x:3,z:8},{x:5,z:4},{x:60,z:14},{x:28,z:3}],
  overclockCharges:3,
  waves:[
    wave('First contact', 1.0, 1.0, [
      wg('drone',20,0.85)]),
    wave('Rust tide incoming', 1.05, 1.0, [
      wg('runner',12,0.55), wg('drone',14,0.75,2)]),
    wave('Skitter pack', 1.1, 1.0, [
      wg('swarmling',34,0.38), wg('drone',12,0.7,2)]),
    wave('Shielded vanguard', 1.15, 1.0, [
      wg('shieldbearer',4,1.4), wg('drone',24,0.7,2)]),
    wave('BLACKOUT SURGE', 1.2, 1.0, [
      wg('runner',24,0.5), wg('drone',30,0.65,2), wg('phantom',3,1.6,5)], {surge:true}),
    wave('Wraiths in the wire', 1.25, 1.0, [
      wg('phantom',5,1.4,1), wg('runner',18,0.55,2)]),
    wave('Medic detail', 1.3, 1.0, [
      wg('medic',1,0.25,3), wg('shieldbearer',6,1.3), wg('drone',28,0.65,2)]),
    wave('Splitter cell', 1.35, 1.0, [
      wg('splitter',3,2.2,1), wg('swarmling',40,0.35,3), wg('runner',16,0.5,4)]),
    wave('Armor column', 1.4, 1.0, [
      wg('tank',5,2), wg('drone',34,0.6,2)]),
    wave('SIEGE ENGINE', 1.0, 1.2, [
      wg('dreadnought',1,0.25,2), wg('drone',28,0.9,5), wg('shieldbearer',3,1.5,8)], {boss:true}),
    wave('BLACKOUT SURGE', 1.55, 1.1, [
      wg('swarmling',60,0.3), wg('runner',30,0.45,3), wg('tank',4,2,6)], {surge:true}),
    wave('Shield wall', 1.6, 1.0, [
      wg('shieldbearer',10,1.1), wg('drone',40,0.55,2), wg('medic',1,0.25,5)]),
    wave('Heavy escort', 1.7, 1.0, [
      wg('tank',7,1.7), wg('phantom',6,1,3), wg('runner',24,0.5,4)]),
    wave('Gold seam', 1.8, 1.25, [
      wg('mite',50,0.28), wg('drone',30,0.5,3)]),
    wave('Wraith tide', 1.9, 1.0, [
      wg('phantom',12,0.85), wg('runner',30,0.45,2), wg('splitter',3,2,5)]),
    wave('BLACKOUT SURGE', 2.0, 1.15, [
      wg('tank',8,1.6), wg('brute',2,4,5), wg('shieldbearer',8,1.1,3),
      wg('drone',50,0.5,2)], {surge:true}),
    wave('Swarm tide', 2.1, 1.0, [
      wg('swarmling',80,0.28), wg('splitter',5,1.8,4), wg('phantom',8,0.9,6)]),
    wave('Iron push', 2.2, 1.2, [
      wg('tank',10,1.5), wg('brute',2,4,4), wg('medic',2,3,6),
      wg('runner',30,0.45,2)]),
    wave('Medic phalanx', 2.3, 1.0, [
      wg('medic',3,3,2), wg('shieldbearer',10,1.1), wg('drone',50,0.5,3),
      wg('tank',6,1.6,5)]),
    wave('The learning dark', 2.45, 1.25, [
      wg('phantom',14,0.8), wg('runner',50,0.4,3), wg('tank',8,1.5,6)]),
    wave('Hammerfall', 2.55, 1.3, [
      wg('brute',4,3.2), wg('tank',10,1.4,2), wg('shieldbearer',8,1,4),
      wg('drone',60,0.45,3)]),
    wave('OVERMIND', 1.3, 1.5, [
      wg('overmind',1,0.25,2), wg('phantom',20,0.9,8), wg('brute',4,3.5,10),
      wg('drone',100,0.4,12), wg('shieldbearer',10,1.1,14), wg('runner',80,0.35,10),
      wg('swarmling',140,0.25,16)], {boss:true, surge:true})
  ],
  surges:[4,10,15,21],
  eventWaves:[3,7,11,15],
  storyEvents:{ 4:'triage_protocol' },
  edictsAt:[6,12,18],
  anomalies:[ anom(5,'solarflare'), anom(11,'ionstorm'), anom(17,'meteor') ],
  path:[[-30,97],[465,97],[465,442],[860,442],[860,247],[560,247],[560,380],[488,380],[488,322]],
  plots:[
    {x:150,y:60},{x:300,y:60},{x:540,y:60},{x:540,y:140},{x:390,y:140},
    {x:390,y:320},{x:540,y:320},{x:700,y:320},{x:930,y:320},{x:700,y:500},
    {x:400,y:500},{x:620,y:300},{x:480,y:300},{x:480,y:450}
  ]
},

/* ================= CHAPTER 3: Aegis Arcology ================= */
{
  id:'aegis-arcology',
  chapterId:3,
  chapter:{ n:3, title:'Turning Point' },
  name:'Aegis Arcology',
  tagline:'The scrap basin. Everything the rust discarded, weaponized.',
  difficulty:3,
  env:{
    skyTop:'#3f7fc2', skyHorizon:'#e8b96a', skyBottom:'#8a6a3a',
    fog:'#c89858', fogDensity:0.0048,
    sunColor:'#fff2d8', sunIntensity:2.0, sunElev:68, sunAzim:100,
    hemiSky:'#9ac2e8', hemiGround:'#6a5232', hemiIntensity:1.35,
    ground:['#8a7355','#96795a','#7d6850'], dust:'#d8a85e', stars:0.0, aurora:0.0
  },
  cols:64, rows:40,
  blocked:[
    {x:25,z:11,w:14,h:12},
    {x:6,z:20,w:6,h:6},{x:52,z:22,w:6,h:5},{x:44,z:4,w:8,h:3}
  ],
  hq:{x:32,z:30},
  gates:[{x:0,z:8},{x:63,z:8},{x:32,z:39},{x:0,z:32}],
  startGold:520, startMorale:70, lives:16,
  heatRadius:9,
  hills:[
    {x:16,z:8,r:3,h:2.5},{x:52,z:10,r:2.5,h:2},
    {x:48,z:32,r:3,h:3},{x:16,z:32,r:3,h:2},{x:40,z:30,r:2.5,h:2}
  ],
  barrels:[{x:3,z:10},{x:60,z:10},{x:30,z:36},{x:3,z:30}],
  overclockCharges:4,
  waves:[
    wave('First contact', 1.0, 1.0, [
      wg('drone',22,0.8)]),
    wave('Rust tide incoming', 1.05, 1.0, [
      wg('runner',14,0.5), wg('drone',16,0.7,2)]),
    wave('Skitter pack', 1.1, 1.0, [
      wg('swarmling',38,0.36), wg('drone',14,0.65,2)]),
    wave('Siege walkers', 1.2, 1.0, [
      wg('tank',3,1.8,1), wg('drone',24,0.65)]),
    wave('Shielded vanguard', 1.25, 1.0, [
      wg('shieldbearer',6,1.2), wg('runner',18,0.5,2)]),
    wave('BLACKOUT SURGE', 1.3, 1.0, [
      wg('drone',44,0.6), wg('runner',28,0.45,2), wg('phantom',4,1.4,5)], {surge:true}),
    wave('Splitter cell', 1.35, 1.0, [
      wg('splitter',4,2,1), wg('swarmling',44,0.33,3)]),
    wave('Wraiths in the wire', 1.4, 1.0, [
      wg('phantom',7,1.2,1), wg('drone',36,0.6,2)]),
    wave('Medic detail', 1.45, 1.0, [
      wg('medic',2,3,2), wg('tank',5,1.8), wg('shieldbearer',6,1.2,3)]),
    wave('SIEGE ENGINE', 1.0, 1.2, [
      wg('dreadnought',1,0.25,2), wg('runner',30,0.7,5), wg('tank',3,2,8)], {boss:true}),
    wave('Armor column', 1.65, 1.0, [
      wg('tank',7,1.6), wg('drone',44,0.55,2)]),
    wave('Brute force', 1.7, 1.0, [
      wg('brute',1,0.25,6), wg('tank',5,1.7,1), wg('runner',28,0.5,3)]),
    wave('BLACKOUT SURGE', 1.8, 1.15, [
      wg('swarmling',70,0.28), wg('splitter',4,1.8,4), wg('drone',50,0.5,2),
      wg('phantom',6,1,6)], {surge:true}),
    wave('Shield fortress', 1.9, 1.0, [
      wg('shieldbearer',12,1), wg('medic',2,2.8,4), wg('drone',44,0.55,2)]),
    wave('Gold seam', 2.0, 1.3, [
      wg('mite',60,0.26), wg('runner',30,0.45,3)]),
    wave('Wraith tide', 2.1, 1.0, [
      wg('phantom',14,0.8), wg('runner',40,0.4,2), wg('drone',40,0.5,4)]),
    wave('Heavy armor', 2.2, 1.15, [
      wg('tank',10,1.4), wg('brute',2,4,6), wg('shieldbearer',8,1,3)]),
    wave('Swarm tide', 2.3, 1.0, [
      wg('swarmling',90,0.26), wg('splitter',6,1.6,4), wg('drone',50,0.45,2)]),
    wave('BLACKOUT SURGE', 2.4, 1.2, [
      wg('brute',3,3.4), wg('tank',10,1.4,2), wg('phantom',10,0.85,4),
      wg('runner',40,0.4,3)], {surge:true}),
    wave('Iron push', 2.55, 1.25, [
      wg('shieldbearer',12,0.95), wg('tank',10,1.4,2), wg('medic',3,2.6,5),
      wg('drone',60,0.45,3)]),
    wave('The turning point', 2.85, 1.3, [
      wg('brute',5,3.2), wg('phantom',18,0.8,2), wg('runner',65,0.4,4),
      wg('tank',12,1.4,3)]),
    wave('Hammerfall', 2.95, 1.3, [
      wg('tank',14,1.3), wg('brute',10,0.6,4), wg('shieldbearer',12,0.95,2),
      wg('drone',90,0.42,3)]),
    wave('Swarm horizon', 3.05, 1.0, [
      wg('swarmling',140,0.25), wg('splitter',8,1.5,4), wg('phantom',16,0.8,6),
      wg('runner',65,0.38,3)]),
    wave('Siege breakers', 3.15, 1.35, [
      wg('brute',12,0.55), wg('tank',15,1.3,2), wg('medic',4,2.4,6),
      wg('shieldbearer',13,0.95,4)]),
    wave('DREADNOUGHT PRIME', 1.7, 1.5, [
      wg('dreadnought',1,0.25,2), wg('brute',14,0.5,10), wg('tank',15,1.2,12),
      wg('phantom',20,0.85,14), wg('drone',160,0.38,8), wg('swarmling',200,0.25,16),
      wg('runner',110,0.35,10), wg('shieldbearer',15,1,18), wg('medic',4,2.5,20),
      wg('splitter',8,1.5,22)], {boss:true, surge:true})
  ],
  surges:[5,12,18,24],
  eventWaves:[4,9,14,19],
  storyEvents:{ 3:'conscription' },
  edictsAt:[7,13,20],
  anomalies:[ anom(7,'elite'), anom(13,'goldrush'), anom(19,'ionstorm') ],
  path:[[-30,127],[345,127],[615,127],[615,472],[488,472],[488,457]],
  plots:[
    {x:200,y:60},{x:450,y:60},{x:800,y:60},{x:700,y:250},{x:700,y:400},
    {x:560,y:540},{x:320,y:540},{x:200,y:400},{x:200,y:250},{x:420,y:120},
    {x:640,y:180},{x:420,y:380},{x:560,y:380},{x:300,y:300},{x:640,y:140}
  ]
},

/* ================= CHAPTER 4: Nocturne Arcology ================= */
{
  id:'nocturne-arcology',
  chapterId:4,
  chapter:{ n:4, title:'The Long Night' },
  name:'Nocturne Arcology',
  tagline:'Ridge maze. Long night, short sightlines.',
  difficulty:4,
  env:{
    skyTop:'#150d2e', skyHorizon:'#7a3fa0', skyBottom:'#0d0817',
    fog:'#241a38', fogDensity:0.0068,
    sunColor:'#c48aff', sunIntensity:0.9, sunElev:18, sunAzim:300,
    hemiSky:'#5a3f8a', hemiGround:'#1a1226', hemiIntensity:1.0,
    ground:['#655a76','#6e6380','#5a5068'], dust:'#8a5fc2', stars:0.55, aurora:0.0
  },
  cols:64, rows:40,
  blocked:[
    {x:14,z:0,w:3,h:26},
    {x:28,z:14,w:3,h:26},
    {x:44,z:0,w:3,h:26}
  ],
  hq:{x:32,z:20},
  gates:[{x:0,z:30},{x:63,z:6},{x:63,z:32},{x:20,z:0}],
  startGold:560, startMorale:70, lives:14,
  heatRadius:9,
  hills:[
    {x:8,z:30,r:3,h:2.5},{x:22,z:6,r:3,h:3},
    {x:36,z:30,r:3,h:2.5},{x:52,z:6,r:2.5,h:2},{x:52,z:34,r:2.5,h:3}
  ],
  barrels:[{x:3,z:28},{x:60,z:8},{x:60,z:30},{x:22,z:3}],
  overclockCharges:4,
  waves:[
    wave('First contact', 1.0, 1.0, [
      wg('drone',24,0.75)]),
    wave('Rust tide incoming', 1.05, 1.0, [
      wg('runner',16,0.5), wg('drone',18,0.65,2)]),
    wave('Skitter pack', 1.1, 1.0, [
      wg('swarmling',42,0.34), wg('drone',16,0.6,2)]),
    wave('Siege walkers', 1.2, 1.0, [
      wg('tank',4,1.7,1), wg('drone',28,0.6)]),
    wave('Shielded vanguard', 1.25, 1.0, [
      wg('shieldbearer',7,1.15), wg('runner',22,0.5,2)]),
    wave('Splitter cell', 1.3, 1.0, [
      wg('splitter',4,1.9,1), wg('swarmling',50,0.32,3)]),
    wave('BLACKOUT SURGE', 1.35, 1.0, [
      wg('drone',50,0.55), wg('runner',34,0.42,2), wg('phantom',5,1.3,5)], {surge:true}),
    wave('Wraiths in the wire', 1.4, 1.0, [
      wg('phantom',8,1.1,1), wg('drone',40,0.55,2)]),
    wave('Medic detail', 1.45, 1.0, [
      wg('medic',2,2.8,2), wg('tank',6,1.7), wg('shieldbearer',7,1.15,3)]),
    wave('SIEGE ENGINE', 1.0, 1.2, [
      wg('dreadnought',1,0.25,2), wg('drone',44,0.8,5), wg('runner',30,0.6,8)], {boss:true}),
    wave('Brute force', 1.75, 1.0, [
      wg('brute',2,4.5,4), wg('tank',6,1.6), wg('runner',30,0.48,2)]),
    wave('Armor column', 1.8, 1.0, [
      wg('tank',9,1.5), wg('drone',50,0.5,2)]),
    wave('Wraith tide', 1.9, 1.0, [
      wg('phantom',12,0.85), wg('runner',40,0.4,2), wg('swarmling',50,0.3,4)]),
    wave('BLACKOUT SURGE', 2.0, 1.15, [
      wg('shieldbearer',12,1), wg('tank',9,1.5,2), wg('brute',2,4,6),
      wg('drone',60,0.48,3)], {surge:true}),
    wave('Gold seam', 2.1, 1.3, [
      wg('mite',70,0.25), wg('runner',36,0.42,3)]),
    wave('Swarm tide', 2.2, 1.0, [
      wg('swarmling',100,0.25), wg('splitter',6,1.6,4), wg('drone',55,0.45,2)]),
    wave('Heavy armor', 2.3, 1.15, [
      wg('tank',11,1.4), wg('brute',3,3.8,5), wg('shieldbearer',9,1,3)]),
    wave('Medic phalanx', 2.4, 1.0, [
      wg('medic',3,2.6,2), wg('tank',9,1.5), wg('phantom',10,0.85,4),
      wg('runner',40,0.4,3)]),
    wave('Iron push', 2.5, 1.2, [
      wg('brute',4,3.4), wg('tank',11,1.4,2), wg('shieldbearer',11,0.95,4),
      wg('drone',65,0.44,3)]),
    wave('The long night', 2.65, 1.25, [
      wg('phantom',16,0.8), wg('runner',60,0.38,3), wg('tank',10,1.4,5),
      wg('splitter',6,1.5,7)]),
    wave('BLACKOUT SURGE', 3.4, 1.2, [
      wg('tank',26,1.1), wg('brute',12,0.5,4), wg('swarmling',160,0.25,2),
      wg('phantom',24,0.7,6), wg('medic',5,2.2,8)], {surge:true}),
    wave('Hammerfall', 3.6, 1.3, [
      wg('brute',14,0.45), wg('tank',24,1.1,2), wg('shieldbearer',20,0.85,4),
      wg('runner',60,0.34,3)]),
    wave('Wraith legion', 3.7, 1.0, [
      wg('phantom',40,0.65), wg('runner',130,0.32,2), wg('drone',140,0.38,4)]),
    wave('Swarm horizon', 3.8, 1.0, [
      wg('swarmling',240,0.25), wg('splitter',14,1.3,4), wg('drone',140,0.36,2),
      wg('tank',20,1.2,6)]),
    wave('Siege breakers', 3.9, 1.35, [
      wg('brute',18,0.4), wg('tank',26,1.1,2), wg('medic',7,2,6),
      wg('shieldbearer',22,0.85,4)]),
    wave('Gold fever', 4.0, 1.4, [
      wg('mite',160,0.25), wg('runner',130,0.32,3), wg('phantom',30,0.68,5)]),
    wave('Iron tide', 4.1, 1.4, [
      wg('brute',12,0.42), wg('tank',26,1.05,2), wg('shieldbearer',22,0.85,4),
      wg('runner',80,0.32,3), wg('drone',80,0.36,5)]),
    wave('OVERMIND SUPREME', 2.2, 1.5, [
      wg('overmind',1,0.25,2), wg('brute',22,0.4,10), wg('tank',34,1.05,12),
      wg('phantom',44,0.7,14), wg('drone',260,0.34,8), wg('swarmling',340,0.25,16),
      wg('runner',200,0.3,10), wg('shieldbearer',26,0.85,18), wg('medic',8,2,20),
      wg('splitter',14,1.3,22), wg('mite',110,0.25,24)], {boss:true, surge:true})
  ],
  surges:[6,13,20,27],
  eventWaves:[4,10,16,22],
  storyEvents:{ 5:'rationing' },
  edictsAt:[8,15,22],
  anomalies:[ anom(8,'solarflare'), anom(14,'meteor'), anom(21,'elite'), anom(24,'goldrush') ],
  path:[[-30,457],[195,457],[270,457],[270,97],[480,97],[480,457],[640,457],[640,97],[560,97],[560,457],[488,457],[488,315]],
  plots:[
    {x:100,y:380},{x:100,y:540},{x:340,y:380},{x:340,y:180},{x:340,y:540},
    {x:600,y:150},{x:560,y:380},{x:560,y:540},{x:600,y:230},{x:740,y:180},
    {x:740,y:380},{x:740,y:540},{x:400,y:240},{x:600,y:300},{x:200,y:240},{x:760,y:300}
  ]
},

/* ================= CHAPTER 5: Helios Arcology ================= */
{
  id:'helios-arcology',
  chapterId:5,
  chapter:{ n:5, title:'Dawn' },
  name:'Helios Arcology',
  tagline:'The killing field before the Command Spire. Dawn or nothing.',
  difficulty:5,
  env:{
    skyTop:'#2e6b9e', skyHorizon:'#f2c078', skyBottom:'#4a3040',
    fog:'#8a6a4a', fogDensity:0.0052,
    sunColor:'#ffe8b0', sunIntensity:1.9, sunElev:32, sunAzim:75,
    hemiSky:'#8ab8d8', hemiGround:'#4a3a28', hemiIntensity:1.3,
    ground:['#6e6258','#7a6a58','#655a50'], dust:'#e8b878', stars:0.0, aurora:0.0
  },
  cols:64, rows:40,
  blocked:[
    {x:10,z:12,w:4,h:4},{x:22,z:2,w:5,h:3},{x:36,z:13,w:4,h:4},
    {x:48,z:3,w:5,h:3},{x:14,z:26,w:5,h:4},{x:30,z:34,w:4,h:4},
    {x:44,z:26,w:5,h:5},{x:56,z:20,w:4,h:4}
  ],
  hq:{x:32,z:20},
  gates:[{x:0,z:8},{x:63,z:8},{x:0,z:32},{x:63,z:32}],
  startGold:600, startMorale:70, lives:12,
  heatRadius:9,
  hills:[
    {x:6,z:8,r:2.5,h:2.5},{x:6,z:32,r:2.5,h:2.5},
    {x:56,z:8,r:2.5,h:2.5},{x:56,z:32,r:2.5,h:2.5},{x:32,z:16,r:3,h:3}
  ],
  barrels:[{x:3,z:10},{x:60,z:10},{x:3,z:30},{x:60,z:30}],
  overclockCharges:5,
  waves:[
    wave('First contact', 1.0, 1.0, [
      wg('drone',26,0.7)]),
    wave('Rust tide incoming', 1.05, 1.0, [
      wg('runner',18,0.48), wg('drone',20,0.6,2)]),
    wave('Skitter pack', 1.1, 1.0, [
      wg('swarmling',46,0.32), wg('drone',18,0.58,2)]),
    wave('Siege walkers', 1.2, 1.0, [
      wg('tank',5,1.6,1), wg('drone',30,0.58)]),
    wave('Shielded vanguard', 1.25, 1.0, [
      wg('shieldbearer',8,1.1), wg('runner',24,0.48,2)]),
    wave('Splitter cell', 1.3, 1.0, [
      wg('splitter',5,1.8,1), wg('swarmling',54,0.3,3)]),
    wave('Wraiths in the wire', 1.35, 1.0, [
      wg('phantom',9,1.05,1), wg('drone',44,0.52,2)]),
    wave('BLACKOUT SURGE', 1.4, 1.0, [
      wg('runner',40,0.4), wg('drone',55,0.5,2), wg('tank',5,1.6,5),
      wg('phantom',6,1,7)], {surge:true}),
    wave('Medic detail', 1.45, 1.0, [
      wg('medic',3,2.6,2), wg('tank',7,1.6), wg('shieldbearer',8,1.1,3)]),
    wave('SIEGE ENGINE', 1.0, 1.2, [
      wg('dreadnought',1,0.25,2), wg('drone',50,0.75,5), wg('runner',36,0.55,8)], {boss:true}),
    wave('Brute force', 1.9, 1.0, [
      wg('brute',2,4.2,4), wg('tank',7,1.5), wg('runner',36,0.45,2)]),
    wave('Armor column', 2.0, 1.0, [
      wg('tank',10,1.4), wg('drone',60,0.48,2)]),
    wave('Wraith tide', 2.1, 1.0, [
      wg('phantom',14,0.8), wg('runner',46,0.38,2), wg('swarmling',60,0.28,4)]),
    wave('Shield fortress', 2.2, 1.0, [
      wg('shieldbearer',14,0.95), wg('medic',3,2.4,4), wg('drone',60,0.48,2)]),
    wave('BLACKOUT SURGE', 2.3, 1.2, [
      wg('swarmling',110,0.25), wg('splitter',7,1.5,4), wg('tank',9,1.4,2),
      wg('phantom',10,0.8,6), wg('runner',46,0.38,3)], {surge:true}),
    wave('Gold seam', 2.4, 1.35, [
      wg('mite',80,0.25), wg('runner',42,0.4,3)]),
    wave('Heavy armor', 2.5, 1.2, [
      wg('tank',12,1.35), wg('brute',3,3.6,5), wg('shieldbearer',10,0.95,3)]),
    wave('Swarm tide', 2.6, 1.0, [
      wg('swarmling',130,0.25), wg('splitter',8,1.4,4), wg('drone',65,0.42,2)]),
    wave('Medic phalanx', 2.7, 1.0, [
      wg('medic',4,2.4,2), wg('tank',11,1.4), wg('phantom',14,0.78,4),
      wg('shieldbearer',10,0.95,6)]),
    wave('Iron push', 2.8, 1.25, [
      wg('brute',5,3.2), wg('tank',12,1.3,2), wg('runner',60,0.36,3),
      wg('drone',70,0.4,4)]),
    wave('The rust adapts', 3.7, 1.3, [
      wg('phantom',38,0.65), wg('runner',140,0.32,2), wg('tank',24,1.15,4),
      wg('splitter',14,1.3,6)]),
    wave('BLACKOUT SURGE', 3.8, 1.25, [
      wg('tank',30,1.1), wg('brute',28,0.45,4), wg('shieldbearer',24,0.85,2),
      wg('swarmling',200,0.25,3), wg('medic',7,2,7)], {surge:true}),
    wave('Hammerfall', 3.9, 1.3, [
      wg('brute',36,0.4), wg('tank',30,1.1,2), wg('phantom',24,0.68,4),
      wg('runner',80,0.32,3)]),
    wave('Wraith legion', 4.0, 1.0, [
      wg('phantom',48,0.62), wg('runner',150,0.3,2), wg('drone',150,0.36,4)]),
    wave('Swarm horizon', 4.1, 1.0, [
      wg('swarmling',300,0.25), wg('splitter',16,1.25,4), wg('drone',150,0.34,2),
      wg('tank',24,1.15,6)]),
    wave('Siege breakers', 4.2, 1.35, [
      wg('brute',44,0.38), wg('tank',30,1.05,2), wg('medic',8,2,6),
      wg('shieldbearer',26,0.82,4)]),
    wave('Gold fever', 4.3, 1.4, [
      wg('mite',190,0.25), wg('runner',140,0.3,3), wg('phantom',34,0.65,5)]),
    wave('Iron tide', 4.4, 1.4, [
      wg('tank',34,1), wg('brute',40,0.4,4), wg('shieldbearer',28,0.8,2),
      wg('runner',150,0.3,3), wg('drone',160,0.34,5)]),
    wave('Harbingers', 4.5, 1.45, [
      wg('phantom',42,0.62), wg('tank',30,1,2), wg('brute',40,0.4,5),
      wg('splitter',16,1.25,7), wg('shieldbearer',26,0.8,4), wg('runner',150,0.3,3)]),
    wave('LEVIATHAN', 2.4, 1.5, [
      wg('leviathan',1,0,2), wg('brute',50,0.38,6), wg('tank',40,1.0,12),
      wg('phantom',36,0.62,14), wg('drone',180,0.32,8), wg('swarmling',200,0.25,16),
      wg('runner',140,0.29,10), wg('shieldbearer',32,0.8,18), wg('medic',10,1.9,20),
      wg('splitter',14,1.25,22), wg('mite',100,0.25,24)], {boss:true, surge:true})
  ],
  surges:[7,14,21,29],
  eventWaves:[6,12,18,24],
  storyEvents:{},
  edictsAt:[9,16,23],
  anomalies:[ anom(6,'ionstorm'), anom(13,'elite'), anom(20,'solarflare'), anom(26,'goldrush') ],
  path:[[-30,127],[930,127],[930,472],[30,472],[30,307],[480,307]],
  plots:[
    {x:120,y:60},{x:300,y:60},{x:480,y:60},{x:660,y:60},{x:840,y:60},
    {x:860,y:220},{x:860,y:380},{x:860,y:540},{x:660,y:540},{x:560,y:540},
    {x:300,y:540},{x:120,y:540},{x:120,y:220},{x:120,y:380},{x:300,y:220},
    {x:480,y:220},{x:660,y:220},{x:480,y:400}
  ]
}

];

})();
