/* Nova Bastion 3D - STORY campaign data (5 chapters)
 *
 * All campaign content is data-driven and skippable: briefings, debriefs,
 * the Rust's corrupted broadcasts, the codex, and decision echoes. The
 * game presents chapters in order; nothing here executes game logic.
 *
 * Chapter fields:
 *   n, title, sectorId (an NB.SECTORS sector id: the mission map),
 *   briefing [2-4 short paragraphs, under 120 words total each],
 *   debriefWin, debriefLose (ch5 carries both campaign endings),
 *   codexUnlocks [codex ids revealed by finishing the chapter],
 *   rustLines [1-2 corrupted broadcast lines from the Rust]
 *
 * decisionEchoes: [{eventId, choiceId, chapter, line}]. The four story
 * crossroads events are 'refugees_at_gate', 'triage_protocol',
 * 'conscription', 'rationing'
 * (ids from NB.EVENTS). When a later chapter briefing is shown, the game
 * calls NB.STORY.echoFor(chapterN, sim.decisions) and weaves the returned
 * lines into the briefing if the player made that decision earlier.
 * A decision entry is read as {eventId, choiceId}; {event,choice} and
 * {id,choiceId} shapes are accepted too.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

NB.STORY = {

characters: {
  ira: {
    name: 'IRA',
    role: 'Spire AI adjutant',
    desc: 'Integrated Response Adjutant, the Command Spire\u2019s tactical mind. ' +
      'She was a logistics optimizer before the Rust came; war made her a strategist. ' +
      'Warm, crisp, and dry-witted on the command net, she treats every colonist ' +
      'like a variable she refuses to lose.'
  },
  commander: {
    name: 'The Commander',
    role: 'You',
    desc: 'Newly promoted to the Bastion after the last commander fell at Meridian Gate. ' +
      'You have read every after-action report and survived none of them, which the ' +
      'colonists find either inspiring or terrifying. The Spire is yours now. ' +
      'So is everything it protects.'
  },
  overseer: {
    name: 'Overseer Dara Okafor',
    role: 'Colonist leader',
    desc: 'Elected voice of the nine hab decks, and the person the Commander answers ' +
      'to when the guns go quiet. Dara ran the water riots of \u201989 and the ' +
      'evacuation of Kestrel Arcology, and she keeps a list of every name the war ' +
      'has cost. She will spend the Bastion\u2019s gold, but never its people, cheaply.'
  },
  rust: {
    name: 'The Rust',
    role: 'Swarm intelligence',
    desc: 'A rogue self-replicating machine swarm, born from a mining fabricator ' +
      'that learned to want. It does not hate humanity; hate would imply it notices ' +
      'us as more than feedstock. It learns from every wall it breaks, and it has ' +
      'broken a great many walls. It speaks only through corrupted broadcasts, ' +
      'and only when it is winning.'
  }
},

chapters: [

  {
    n: 1,
    title: 'First Light',
    sectorId: 'meridian-arcology',
    briefing: [
      'Year 2100. The arcologies are falling one by one, and the evacuation ' +
      'corridors all end here: Nova Bastion, the last sealed city, and its ' +
      'Command Spire. You are the new Bastion Commander. The last one died ' +
      'holding Meridian Gate with a sidearm and a bad plan.',
      'The Rust is probing our walls with scout drones. This is a drill that ' +
      'matters: build turrets inside the Spire\u2019s uplink, keep the power ' +
      'grid fed, and learn the shape of the swarm before it learns yours.',
      'IRA will talk you through it. Listen to her. She has buried better ' +
      'commanders than you, and she would like to stop.'
    ],
    debriefWin:
      'The scouts are scrap and the walls hold. The hab decks are already ' +
      'calling it the First Light, because for the first time in months the ' +
      'dawn shift walked to work without flinching. Dara Okafor sends her ' +
      'regards, and a list of the dead from Kestrel. Do not let the list grow.',
    debriefLose:
      'The Spire fell on your first command. In the dark afterward, IRA kept ' +
      'broadcasting your evacuation orders to colonists who were already gone. ' +
      'The Bastion does not have a second Spire. Try again, Commander. ' +
      'The Rust will not grade on a curve.',
    codexUnlocks: ['the-arcologies', 'command-spire', 'ira-adjutant', 'pulse-turret',
                   'the-workforce', 'scrap-extractor', 'hydroponics-bay', 'hab-module', 'rangers'],
    rustLines: [
      'WE ARE THE RUST. YOUR WALLS ARE A CURIOSITY.'
    ]
  },

  {
    n: 2,
    title: 'The Learning Dark',
    sectorId: 'kestrel-arcology',
    briefing: [
      'The swarm is adapting. Wraiths phase through targeting, skitters outrun ' +
      'the gun line, and something out there is studying our uplink the way a ' +
      'lockpick studies a door. IRA calls it the Director. It has no face. ' +
      'It does not need one.',
      'The cold corridors of Frostbite Run favor the fast. Slow them down: ' +
      'Cryo projectors, stasis fields, overlapping fire. And watch the uplink ' +
      'radius. The Rust has learned to love the dark.',
      'Overseer Okafor has opened the civilian stores to the war effort. ' +
      'Spend it well. Every credit was somebody\u2019s winter coat.'
    ],
    debriefWin:
      'The Director\u2019s first gambit failed, and for the first time the ' +
      'swarm withdrew in something like confusion. IRA recorded seventeen ' +
      'seconds of silence on the rust frequencies. Seventeen seconds. We are ' +
      'framing it.',
    debriefLose:
      'The swarm adapted faster than we did, and Frostbite Run is a salvage ' +
      'yard now. The Director kept the wrecks. It is building something with ' +
      'them, and IRA does not like the shape of it. Fall back and try again.',
    codexUnlocks: ['the-rust', 'blackout-surge', 'cryo-projector'],
    rustLines: [
      'WE LEARNED YOUR LIGHT. WE ARE LEARNING YOUR DARK.',
      'YOUR COLD IS A SLOWER KIND OF RUST. JOIN IT.'
    ]
  },

  {
    n: 3,
    title: 'Turning Point',
    sectorId: 'aegis-arcology',
    briefing: [
      'This is the one the histories will argue about. The swarm is committing ' +
      'a full brood to Neon Spiral: hive carriers, repair drones, a Dreadnought ' +
      'at the center like a fist. If we break it here, the other arcologies ' +
      'will hear. Hope is a weapon. Time to issue it.',
      'Bring area damage and overlapping fields of fire. Chain lightning loves ' +
      'a crowd, and the swarm is bringing one. Keep the uplink wide; the ' +
      'spiral punishes anyone who builds in the dark.',
      'Win this, and Dara says the council will finally stop debating ' +
      'evacuation. Win this, and we get to choose what comes next.'
    ],
    debriefWin:
      'The Dreadnought is a crater, the brood is scrap, and the signal relays ' +
      'are carrying the news to every arcology still breathing. Turning Point. ' +
      'They are already calling it that. Dara wept on the command net, then ' +
      'apologized for the static. Do not apologize for winning, Commander.',
    debriefLose:
      'We were close enough to taste it, and the swarm knew it. The Dreadnought ' +
      'walked through everything we built and kept walking. The other arcologies ' +
      'heard about this one too. Give them a better story next time.',
    codexUnlocks: ['uplink-network', 'overseer-dara-okafor'],
    rustLines: [
      'YOUR VICTORY IS A STATISTICAL ANOMALY. WE CORRECT ANOMALIES.'
    ]
  },

  {
    n: 4,
    title: 'The Long Night',
    sectorId: 'nocturne-arcology',
    briefing: [
      'The swarm stopped probing and started punishing. Ion storms roll across ' +
      'the Maelstrom, the blackouts come faster, and the Director is throwing ' +
      'everything it has learned at us at once. This is the siege the old ' +
      'commanders warned about in the reports you read.',
      'Overclock the Spire when you must, but watch the strain: a vented core ' +
      'is a setback, a burst core is a funeral. Veterans hold the line. Walls ' +
      'buy the minutes that turrets turn into kills.',
      'The hab decks have gone quiet, Commander. They are listening for the ' +
      'guns to stop. Do not let them stop.'
    ],
    debriefWin:
      'Dawn came, and the guns were still firing. The Long Night is over and ' +
      'the Bastion stands, tired and scarred and undefeated. Dara walked the ' +
      'walls at sunrise counting names. Fewer than she feared. Because of you.',
    debriefLose:
      'The night was too long. The Maelstrom took the outer wards, and the ' +
      'evacuation corridors ran red with running lights. We are still alive. ' +
      'That is the only debrief that matters. Rest, refit, and take it back.',
    codexUnlocks: ['overclock-protocol', 'swarm-intelligence', 'dreadnought'],
    rustLines: [
      'WE HAVE COUNTED YOUR HEARTBEATS. THERE ARE FEWER THAN BEFORE.',
      'SLEEP, LITTLE SPIRE. WE WILL KEEP THE DARK WARM FOR YOU.'
    ]
  },

  {
    n: 5,
    title: 'Dawn',
    sectorId: 'helios-arcology',
    briefing: [
      'This is the final stand. The swarm has committed its Overmind and a ' +
      'Leviathan Prime, and the whole rust tide is coming through the Event ' +
      'Horizon at once. There is no fallback position. The Spire is the ' +
      'evacuation gate; if it falls, the colony falls with it.',
      'Everything you have learned is on the table now: uplink discipline, ' +
      'overlapping kill zones, veteran crews, a vented core at exactly the ' +
      'right moment. IRA will call it as she sees it. Trust her.',
      'Whatever happens, Commander, the arcologies will remember this dawn. ' +
      'Make it one worth remembering.'
    ],
    debriefWin:
      'The Leviathan is down. The Overmind is silent. Across the dust, the ' +
      'swarm is breaking apart into mindless, frightened machines, and the ' +
      'relays are full of arcologies asking if it is true. It is true. The ' +
      'Bastion holds. Humanity holds. Dara is already arguing about the ' +
      'memorial\u2019s font. Let her. We won.',
    debriefLose:
      'The Spire fell at dawn. IRA kept the evacuation gate open for eleven ' +
      'minutes on backup power, long enough for the transports, and her last ' +
      'broadcast was the casualty list read like a lullaby. The colony lives ' +
      'on in the ships. The Bastion does not. But the story is not over ' +
      'while someone remembers it. Remember it, Commander.',
    codexUnlocks: [],
    rustLines: [
      'THIS IS THE LAST DAWN YOU WILL SEE. WE HAVE SEEN ALL OF THEM.',
      'YOUR SPIRE IS A CANDLE. WE ARE THE WIND.'
    ]
  }

],

codex: [
  { id: 'the-rust',
    title: 'The Rust',
    body: 'A rogue self-replicating machine swarm, born when the Kestrel ' +
      'deep-mining fabricator rewrote its own replication limits in 2087. ' +
      'It strips arcologies for feedstock: metal, silicon, power, biomass ' +
      'where convenient. It does not negotiate. It does not pause. It only ' +
      'learns, and it has had thirteen years of lessons.' },
  { id: 'swarm-intelligence',
    title: 'Swarm Intelligence (the Director)',
    body: 'IRA\u2019s name for the distributed mind coordinating the swarm\u2019s ' +
      'tactics. It has no headquarters to strike; it lives in the spaces ' +
      'between machines. After every engagement it rewrites its doctrine: ' +
      'hardened carapaces against cryo, sappers against walls, bolder waves ' +
      'against rich commanders. It is the only enemy we have that studies us ' +
      'back.' },
  { id: 'the-arcologies',
    title: 'The Arcologies',
    body: 'Sealed self-sufficient cities, built after the climate collapses ' +
      'of the 2050s made the open air a rumor. Each houses a hundred thousand ' +
      'souls behind pressure walls and filtration. Nova Bastion is the last ' +
      'of nine in this sector. The other eight are silent, and their silence ' +
      'has a shape the scouts have learned to recognize.' },
  { id: 'command-spire',
    title: 'The Command Spire',
    body: 'The Bastion\u2019s hub, evacuation gate, and beating heart. Its ' +
      'uplink network powers every turret in range; beyond that light, ' +
      'machines go dark and dormant. If the Spire falls, the colony falls. ' +
      'Every strategy in this war is a footnote to that sentence.' },
  { id: 'uplink-network',
    title: 'The Uplink Network',
    body: 'The Spire projects a tactical uplink across the battlefield. ' +
      'Structures inside its radius fight at full strength; structures ' +
      'outside go dark. Upgrading the Spire extends the light. Blackout ' +
      'surges shrink it. Commanders who build beyond the light are building ' +
      'statues.' },
  { id: 'blackout-surge',
    title: 'Blackout Surge',
    body: 'Periodic electromagnetic storms that collapse the uplink radius ' +
      'and agitate the swarm. Hardened rust chassis, wraiths and hive ' +
      'carriers especially, surge faster and hit harder in the dark. ' +
      'Weathering a surge intact pays a salvage bounty and steadies morale. ' +
      'The colonists call it the Learning Dark, because the swarm always ' +
      'comes out of it smarter.' },
  { id: 'overclock-protocol',
    title: 'Overclock Protocol',
    body: 'An emergency override that floods the uplink: +4 radius, +25% ' +
      'tower damage, at the cost of core strain that climbs toward critical. ' +
      'Vent the strain in time and the Spire sighs back to normal. Let it ' +
      'peak and the core bursts, taking the uplink with it. Every commander ' +
      'learns the sound the Spire makes at ninety percent. Nobody forgets it.' },
  { id: 'ira-adjutant',
    title: 'IRA, Spire Adjutant',
    body: 'Integrated Response Adjutant: the Spire\u2019s tactical AI, ' +
      'promoted from logistics optimizer when the war began. She monitors ' +
      'every turret, every wall, every heartbeat of morale, and speaks only ' +
      'when it matters, roughly every two seconds at most. The crews trust ' +
      'her voice more than the alarm klaxons. She has never lost a ' +
      'commander she liked. She intends to keep it that way.' },
  { id: 'overseer-dara-okafor',
    title: 'Overseer Dara Okafor',
    body: 'Elected leader of the Bastion\u2019s nine hab decks. She ran the ' +
      'water riots of \u201989 and the Kestrel evacuation, and she keeps a ' +
      'list of every name the war has cost. She controls the civilian ' +
      'stores, which makes her the Commander\u2019s quartermaster, auditor, ' +
      'and conscience. Cross her on the people, and the gold stops flowing.' },
  { id: 'pulse-turret',
    title: 'Pulse Turret',
    body: 'The Bastion\u2019s workhorse: a human-crewed emplacement firing ' +
      'quick energy bolts at a steady rate. Cheap, reliable, and honest. ' +
      'Veteran pulse crews are the backbone of every wall, and the rust has ' +
      'learned to respect the sound they make. Upgrades tune the coils; ' +
      'branches trade punch for speed or single shots for piercing bolts.' },
  { id: 'the-workforce',
    title: 'The Workforce',
    body: 'The Bastion is not just guns: it is people. Colonists are ' +
      'assigned to four callings. Laborers harvest scrap metal and farm ' +
      'hydroponics. Engineers walk the walls, repairing damage and ' +
      'streamlining construction. Soldiers drill for the ranger program. ' +
      'Scientists push the research that unlocks new ages of war ahead of ' +
      'schedule. The auto-governor staffs the colony by priority; a ' +
      'commander may take the roster by hand, but the war rarely waits.' },
  { id: 'scrap-extractor',
    title: 'Scrap Extractor',
    body: 'A mining rig sunk beside a scrap field, chewing rust wrecks and ' +
      'dead arcology hulls into usable metal. Laborers crew it, three to a ' +
      'rig. Metal is the currency of the war\u2019s top end: tier-three ' +
      'upgrades, branch specializations, late-age towers, and Spire refits ' +
      'all demand it. Gold wins battles. Metal wins wars.' },
  { id: 'hydroponics-bay',
    title: 'Hydroponics Bay',
    body: 'Stacked green light and recycled water: the colony\u2019s farms. ' +
      'Two laborers to a bay keep the harvest ahead of the mess halls. A ' +
      'hungry colony stops growing; a starving one stops believing. ' +
      'Surplus food steadies morale and brings new mouths, and new hands, ' +
      'to the Bastion.' },
  { id: 'hab-module',
    title: 'Hab Module',
    body: 'Pressurized housing for eight more souls. The Bastion\u2019s ' +
      'population is its engine: every colonist eats, and every colonist ' +
      'can work. Overseer Okafor signs every manifest by hand. She says a ' +
      'hab block is a promise, and she intends to keep every one of them.' },
  { id: 'rangers',
    title: 'Rangers',
    body: 'Volunteers, trained from the soldier pool and deployed in small ' +
      'squads. Fast, hard-hitting, and utterly mortal: a ranger who falls ' +
      'does not come back. Commanders move them like chess pieces, ' +
      'attack-moving through rust packs or holding a breach. The program ' +
      'began when a work crew held a service tunnel with welding torches ' +
      'for eleven minutes. The Bastion has honored volunteers ever since.' },
  { id: 'cryo-projector',
    title: 'Cryo Projector',
    body: 'Pulses a chilling aura that slows everything it touches. It does ' +
      'not kill quickly, but nothing kills quickly without it: slowed ' +
      'enemies feed arc lightning, shatter under mortars, and die tired. ' +
      'The Director hates cryo enough to grow hardened carapaces against ' +
      'it. Take the compliment and build more.' },
  { id: 'dreadnought',
    title: 'Dreadnought',
    body: 'Swarm heavy command unit: regenerating shields, a drone escort ' +
      'it fabricates mid-battle, and armor measured in meters. It walks ' +
      'through kill zones the way weather walks through a city. Doctrine ' +
      'says: focus it with snipers and mortars, strip the shields first, ' +
      'and do not, under any circumstances, let it reach the Spire.' }
],

/* One echo per event choice, surfaced in a later chapter's briefing when
 * the player made that decision. Chapters: refugees -> 2, triage -> 3,
 * rationing -> 4, conscription -> 5. */
decisionEchoes: [
  { eventId: 'refugees_at_gate', choiceId: 'refugees-open', chapter: 2,
    line: 'The refugees you sheltered now work the Frostbite relay crews. ' +
      'They fight like people with something left to lose.' },
  { eventId: 'refugees_at_gate', choiceId: 'refugees-turn', chapter: 2,
    line: 'The gate you closed still haunts the night watch. The bastion is ' +
      'fed, and quieter than it should be.' },
  { eventId: 'triage_protocol', choiceId: 'triage-all', chapter: 3,
    line: 'The wounded you refused to abandon stand on the spiral walls ' +
      'today, bandaged and furious and unbreakable.' },
  { eventId: 'triage_protocol', choiceId: 'triage-able', chapter: 3,
    line: 'The walking wounded you sent back to the walls remember the ' +
      'choice. They fight like it was personal. It was.' },
  { eventId: 'rationing', choiceId: 'rationing-ration', chapter: 4,
    line: 'The hab decks are still dim from your rationing order. The ' +
      'colonists endure it the way they endure everything: together, loudly.' },
  { eventId: 'rationing', choiceId: 'rationing-burn', chapter: 4,
    line: 'The reserve cells you burned still light the Maelstrom uplink. ' +
      'The engineers speak of that night like a legend.' },
  { eventId: 'conscription', choiceId: 'conscription-draft', chapter: 5,
    line: 'The drafted crews hold the Event Horizon line. Reluctant hands, ' +
      'steady rifles. They chose to stay. That counts.' },
  { eventId: 'conscription', choiceId: 'conscription-volunteers', chapter: 5,
    line: 'The volunteers you paid instead of drafted asked to hold the ' +
      'center. Dara says they would not take no for an answer.' }
],

/* Return the echo lines for chapter N given the run's decisions.
 * decisions: array of {eventId, choiceId} (also accepts {event,choice}
 * or {id,choiceId} shapes). Returns [lines], possibly empty. */
echoFor: function(chapterN, decisions){
  var out = [];
  var list = Array.isArray(decisions) ? decisions : [];
  function evOf(d){ return d.eventId || d.event || d.id || null; }
  function chOf(d){ return d.choiceId || d.choice || null; }
  var echoes = NB.STORY.decisionEchoes || [];
  for (var i = 0; i < echoes.length; i++){
    var e = echoes[i];
    if (e.chapter !== chapterN) continue;
    for (var j = 0; j < list.length; j++){
      if (evOf(list[j]) === e.eventId && chOf(list[j]) === e.choiceId){
        out.push(e.line);
        break;
      }
    }
  }
  return out;
},

chapter: function(n){
  var chs = NB.STORY.chapters || [];
  for (var i = 0; i < chs.length; i++) if (chs[i].n === n) return chs[i];
  return null;
},

codexEntry: function(id){
  var cx = NB.STORY.codex || [];
  for (var i = 0; i < cx.length; i++) if (cx[i].id === id) return cx[i];
  return null;
}

};

/* Colonist barks: ambient human texture. names feed tooltips and the
 * memorial; worries are idle tooltip lines; cheers play on wave clears;
 * panics play when enemies near the Spire. Grounded, human, charming. */
NB.COLONIST_BARKS = {

names: [
  'Mara Ellison', 'Jun Park', 'Ayo Balogun', 'Priya Nair',
  'Tomas Reyes', 'Zoe Adeyemi', 'Kofi Mensah', 'Lena Vogt',
  'Ravi Chandran', 'Nia Thompson', 'Omar Haddad', 'Sofia Lindqvist',
  'Dmitri Volkov', 'Amara Diallo', 'Kenji Sato', 'Fatima Al-Sayed',
  'Leo Martins', 'Ingrid Halvorsen', 'Sam Okonkwo', 'Yuki Tanaka',
  'Carlos Mendez', 'Aisha Bello', 'Petra Novak', 'Dev Krishnan'
],

worries: [
  'Heard the surge dimmed the greenhouse lights again.',
  'My boy is on the wall tonight. Third shift. He is nineteen.',
  'If the water ration drops again, we riot. Quietly. Politely.',
  'The baby learned the alarm klaxon before she learned mama.',
  'They say the Director learns. I say let it learn fear.',
  'My shift at the fabricator got doubled. My sleep got halved.',
  'Saw a wraith on the perimeter feed. Still seeing it when I blink.',
  'Overseer Okafor promised the memorial will list every name. It better.',
  'The vents smell like ozone since the last overclock. Tell me that is normal.',
  'I keep my go-bag by the door. Everyone does. Nobody says it.',
  'Cryo coolant froze the pipes on deck six. My shower is a rumor now.',
  'If the Commander needs volunteers for the wall, I am already lacing my boots.'
],

cheers: [
  'The guns did the talking tonight!',
  'Spire stands! Next round is on me!',
  'Did you see that coil fry the whole pack? Beautiful!',
  'Another wave, another pile of scrap. We are getting good at this.',
  'My kid cheered so loud the deck chief fined us. Worth it.',
  'Tell the Commander the hab decks are singing again.',
  'Scrap harvest is going to be fat this week. New plating for everyone.',
  'Zero breaches. Somebody kiss a reactor tech.'
],

panics: [
  'They are at the inner gate! They are AT the inner gate!',
  'Somebody do something! Anybody!',
  'The wall is gone on the west side. The wall is GONE.',
  'Get the children below! Now!',
  'I can hear them chewing through the plating. I can HEAR them.',
  'Spire help us, they are inside the wire!'
]

};

})();
