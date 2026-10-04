/* Nova Bastion 3D - crossroads events and edicts */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

/*
 * Crossroads events. Each event is offered once per run, after the wave
 * listed in the sector def's eventWaves. While a pending event is unresolved,
 * startWave is blocked.
 *
 * Choice effects are pure DATA, applied by the sim. Supported keys:
 *   gold         : number, added to gold (may be negative)
 *   morale       : number, added to morale (may be negative)
 *   uplinkTemp   : {cells, waves}, temporary uplink radius bonus for N waves
 *   freeTowers   : [towerId], one free build credit per id listed
 *   nextWaveMult : number, multiplies the NEXT wave's hpMult
 *   reactorBoost : number, extra energy capacity per reactor (permanent)
 *   costMultTemp : {mult, waves}, temporary build/upgrade cost multiplier
 *   dmgMultTemp  : {mult, waves}, temporary tower damage multiplier
 *
 * Every choice carries an outcome string shown after the choice is made.
 *
 * Four events carry fixed story ids and are raised by sector defs via
 * storyEvents:{waveIndex:eventId} instead of the random crossroads draw:
 * refugees_at_gate (ch1), triage_protocol (ch2), conscription (ch3),
 * rationing (ch4).
 */
NB.EVENTS = [

  {
    id:'refugees_at_gate',
    title:'Refugees at the Gate',
    text:'A ragged column of survivors from a fallen arcology stumbles out of the dust, begging for shelter behind your walls. Feeding them strains the stores, but the noise of a crowd draws the rust.',
    choices:[
      {id:'refugees-open', label:'Open the gates', colonistFriendly:true,
       hint:'+8 morale, -100 gold, next wave +10% HP',
       effects:{morale:8, gold:-100, nextWaveMult:1.1},
       outcome:'The gates swing open. The halls fill with grateful voices, but the rust heard the commotion too. (+8 morale, -100 gold, next wave +10% HP)'},
      {id:'refugees-turn', label:'Turn them away',
       hint:'-8 morale, +50 gold, next wave -5% HP',
       effects:{morale:-8, gold:50, nextWaveMult:0.95},
       outcome:'You watch them vanish into the dust. The bastion stays quiet and fed, and the guilt stays with you. (-8 morale, +50 gold, next wave -5% HP)'}
    ]
  },

  {
    id:'conscription',
    title:'Conscription',
    text:'The militia is understrength and the next assault is coming. The council asks you to draft colonists straight off the work crews to hold the walls.',
    choices:[
      {id:'conscription-draft', label:'Draft the crews',
       hint:'-4 morale, -50 gold, +15% tower damage for 2 waves',
       effects:{morale:-4, gold:-50, dmgMultTemp:{mult:1.15, waves:2}},
       outcome:'Reluctant hands take up rifles. They fight hard, because the alternative is unthinkable. (-4 morale, -50 gold, +15% tower damage for 2 waves)'},
      {id:'conscription-volunteers', label:'Volunteers only', colonistFriendly:true,
       hint:'+8 morale, -150 gold',
       effects:{morale:8, gold:-150},
       outcome:'You pay signing bonuses instead of issuing orders. The volunteers stand taller for having chosen. (+8 morale, -150 gold)'}
    ]
  },

  {
    id:'rationing',
    title:'Rationing',
    text:'The reactor grid is stretched thin. The engineers propose rolling power rationing across the civilian decks to keep the uplink network at full strength.',
    choices:[
      {id:'rationing-ration', label:'Ration the decks',
       hint:'+100 gold saved, -6 morale',
       effects:{gold:100, morale:-6},
       outcome:'The lights dim in the hab blocks and the complaints do not stop for days. The treasury thanks you. (+100 gold, -6 morale)'},
      {id:'rationing-burn', label:'Burn the reserves', colonistFriendly:true,
       hint:'-120 gold, +4 uplink radius for 1 wave',
       effects:{gold:-120, uplinkTemp:{cells:4, waves:1}},
       outcome:'Reserve cells flood the grid. The uplink shines bright over every wall, and the colonists notice. (-120 gold, +4 uplink radius for 1 wave)'}
    ]
  },

  {
    id:'triage_protocol',
    title:'Triage',
    text:'The field hospital overflows after the last assault. There are not enough med supplies for every wounded defender, and the surgeons are waiting on your word.',
    choices:[
      {id:'triage-all', label:'Treat everyone', colonistFriendly:true,
       hint:'+8 morale, -150 gold',
       effects:{morale:8, gold:-150},
       outcome:'No one is left to die in the corridor. The whole bastion hears about it by nightfall. (+8 morale, -150 gold)'},
      {id:'triage-able', label:'Save the able-bodied first',
       hint:'-4 morale, -50 gold, +15% tower damage for 2 waves',
       effects:{morale:-4, gold:-50, dmgMultTemp:{mult:1.15, waves:2}},
       outcome:'The walking wounded return to the walls grateful and furious, and they fight like it. (-4 morale, -50 gold, +15% tower damage for 2 waves)'}
    ]
  },

  {
    id:'black-market',
    title:'Black Market Salvage',
    text:'A scavenger with dust-caked goggles offers military arc cores pulled from a dead convoy, no questions asked, no receipts given. The quartermaster wants her arrested.',
    choices:[
      {id:'market-buy', label:'Buy the cores',
       hint:'-180 gold, one free Arc Tesla Coil',
       effects:{gold:-180, freeTowers:['arc']},
       outcome:'The cores hum with illegal promise. Your engineers swear they can mount one by tomorrow. (-180 gold, one free Arc Tesla Coil build)'},
      {id:'market-arrest', label:'Arrest her',
       hint:'+4 morale, +60 gold',
       effects:{morale:4, gold:60},
       outcome:'Her confiscated stash funds the hospital for a week, and the bastion sees that the law still holds. (+4 morale, +60 gold)'}
    ]
  },

  {
    id:'infiltrator',
    title:'Rust Infiltrator',
    text:'A rust spy-drone cut the uplink relays in the night. The infiltrator is still inside the walls, and the reactors are running hot.',
    choices:[
      {id:'infiltrator-lockdown', label:'Lockdown and hunt',
       hint:'-100 gold, +5 reactor capacity each, -3 morale',
       effects:{gold:-100, reactorBoost:5, morale:-3},
       outcome:'The lockdown finds the drone by dawn. The rebuilt relays run cleaner than the originals. (-100 gold, +5 reactor capacity each, -3 morale)'},
      {id:'infiltrator-quiet', label:'Quiet repairs', colonistFriendly:true,
       hint:'-50 gold, +2 morale',
       effects:{gold:-50, morale:2},
       outcome:'The relays are patched before most of the bastion wakes. Rumors stay rumors. (-50 gold, +2 morale)'}
    ]
  },

  {
    id:'veteran',
    title:'The Veteran',
    text:'A grey commander from the first rust war offers to drill your tower crews. Her methods are brutal, her results legendary, and she wants hazard pay.',
    choices:[
      {id:'veteran-hire', label:'Put her to work',
       hint:'-80 gold, +15% tower damage for 3 waves',
       effects:{gold:-80, dmgMultTemp:{mult:1.15, waves:3}},
       outcome:'Her voice echoes across the drill yard at dawn. By the second day the crews are hitting targets they could barely see. (-80 gold, +15% tower damage for 3 waves)'},
      {id:'veteran-rest', label:'Let her rest', colonistFriendly:true,
       hint:'+6 morale',
       effects:{morale:6},
       outcome:'You give her a quiet bunk instead of a parade ground. The old stories she tells by the spire do their own kind of work. (+6 morale)'}
    ]
  },

  {
    id:'scouts-report',
    title:"Scout's Report",
    text:'Your scouts found an exposed rust staging ground in a collapsed transit tunnel. A raid could cripple the next assault, but the raiders do not work for thanks.',
    choices:[
      {id:'scouts-raid', label:'Raid it now',
       hint:'-200 gold, next wave -20% HP',
       effects:{gold:-200, nextWaveMult:0.8},
       outcome:'The raid burns the staging ground to slag. The next wave arrives thin and disorganized. (-200 gold, next wave -20% HP)'},
      {id:'scouts-fortify', label:'Fortify instead', colonistFriendly:true,
       hint:'-20% build costs for 2 waves, +2 morale',
       effects:{costMultTemp:{mult:0.8, waves:2}, morale:2},
       outcome:'You spend the coin on plating and cable instead. The crews work double shifts, proud of the rising walls. (-20% build costs for 2 waves, +2 morale)'}
    ]
  },

  {
    id:'derelict-cache',
    title:'Derelict Cache',
    text:'A supply cache glints in the ruins a half mile out, richer than a month of fabricator output. The hauling crew would be exposed to rust patrols the whole way.',
    choices:[
      {id:'cache-haul', label:'Haul it in',
       hint:'+250 gold, -5 morale',
       effects:{gold:250, morale:-5},
       outcome:'The haulers come back heavy with crates. Two of them do not come back at all. (+250 gold, -5 morale)'},
      {id:'cache-leave', label:'Leave it', colonistFriendly:true,
       hint:'+6 morale',
       effects:{morale:6},
       outcome:'You recall the crew. Nobody says it aloud, but everyone knows you chose their lives over the gold. (+6 morale)'}
    ]
  },

  {
    id:'signal-choir',
    title:'The Signal Choir',
    text:'A group of children has started broadcasting music on the colony net to keep spirits up. Morale is soaring, but the work gangs are short-handed and the foremen want them put to work.',
    choices:[
      {id:'choir-sing', label:'Let them broadcast', colonistFriendly:true,
       hint:'+10 morale, -40 gold',
       effects:{morale:10, gold:-40},
       outcome:'The music carries through every speaker in the bastion. Even the crews on the walls stand a little straighter. (+10 morale, -40 gold)'},
      {id:'choir-work', label:'Everyone works',
       hint:'+80 gold, -8 morale',
       effects:{gold:80, morale:-8},
       outcome:'Small hands learn the supply lines quickly. The net goes quiet, and the quiet feels heavier than the work. (+80 gold, -8 morale)'}
    ]
  }

];

/*
 * Edicts. At the sector def's edictsAt wave clears, the sim offers a random
 * PAIR (no repeats within a run) and the player picks one. Edicts are
 * permanent for the run.
 *
 * modifiers are DATA, merged into the sim's modifier table:
 *   towerDmg     : multiplier on all tower damage
 *   moralePerClear: extra morale on every wave clear
 *   structRegen  : fraction of max HP regenerated per second by structures
 *   buildCost    : multiplier on build/upgrade costs
 *   darkBonus    : extra cells of uplink reach before structures go dark
 *   bountyMult   : multiplier on kill bounties
 *   wallHp       : multiplier on wall max HP (applied to existing walls too)
 *   strainMult   : multiplier on overclock strain build rate
 *   flawlessMorale: morale granted on a flawless wave (replaces the base 4)
 *   immediate    : {gold, morale} applied once when the edict is chosen
 */
NB.EDICTS = [

  {id:'martial-law', name:'Martial Law',
   desc:'+15% tower damage. The curfews and patrols cost the colony 10 morale now.',
   modifiers:{towerDmg:1.15, immediate:{morale:-10}}},

  {id:'field-hospitals', name:'Field Hospitals',
   desc:'+3 morale on every wave clear. Structures regenerate 1% of max HP per second.',
   modifiers:{moralePerClear:3, structRegen:0.01}},

  {id:'emergency-shifts', name:'Emergency Shifts',
   desc:'Build and upgrade costs -20%. The double shifts cost the colony 15 morale now.',
   modifiers:{buildCost:0.8, immediate:{morale:-15}}},

  {id:'hardened-relays', name:'Hardened Relays',
   desc:'Shielded relay hardening: structures go dark only beyond +2 cells of uplink reach.',
   modifiers:{darkBonus:2}},

  {id:'salvage-crews', name:'Salvage Crews',
   desc:'Wrecker teams strip every kill: +25% kill bounties.',
   modifiers:{bountyMult:1.25}},

  {id:'reinforced-barricades', name:'Reinforced Barricades',
   desc:'Walls gain +50% max HP, including walls already built.',
   modifiers:{wallHp:1.5}},

  {id:'overclock-governors', name:'Overclock Governors',
   desc:'Tuned governors: overclock strain builds 30% slower.',
   modifiers:{strainMult:0.7}},

  {id:'memorial-hall', name:'Memorial Hall',
   desc:'A quiet hall by the spire: flawless waves grant 6 morale instead of 4.',
   modifiers:{flawlessMorale:6}}

];

})();
