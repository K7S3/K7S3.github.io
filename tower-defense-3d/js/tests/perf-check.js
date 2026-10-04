/* Perf governor test: simulated fps series -> correct step up/down with
 * hysteresis, cooldown, and manual lock. Run: node js/tests/perf-check.js
 */
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'perf.js'));

const NB = globalThis.NB;
let failures = 0;
function ok(cond, label){
  if (!cond){ failures++; console.error('FAIL:', label); }
  else console.log('ok:', label);
}
/* run the governor for `secs` at a fixed fps */
function run(gov, fps, secs){
  const dt = 1 / fps, steps = Math.round(secs / dt);
  for (let i = 0; i < steps; i++) gov.update(dt);
}

/* 1. auto-detect returns a valid tier */
const det = NB.Perf.autoDetect();
ok(['low', 'medium', 'high'].includes(det), 'autoDetect -> valid tier (' + det + ')');

/* 2. sustained low fps steps down high -> medium -> low */
let changes = [];
let g = NB.Perf.create({ initial: 'high', onChange: (q, why) => changes.push(q + ':' + why) });
run(g, 30, 3.5);
ok(g.tier === 'medium', '30fps for 3.5s steps high->medium (got ' + g.tier + ')');
ok(changes.length === 1 && changes[0] === 'medium:fps-low', 'onChange fired once with reason');
run(g, 30, 9); /* 5s cooldown + 3s low */
ok(g.tier === 'low', 'sustained 30fps steps medium->low (got ' + g.tier + ')');

/* 3. sustained high fps steps back up low -> medium -> high */
run(g, 65, 16); /* 10s high + cooldown margin */
ok(g.tier === 'medium', '65fps for 16s steps low->medium (got ' + g.tier + ')');
run(g, 65, 16);
ok(g.tier === 'high', '65fps steps medium->high (got ' + g.tier + ')');

/* 4. hysteresis: mid-band fps never changes the tier */
g = NB.Perf.create({ initial: 'medium', onChange: () => { throw new Error('should not change'); } });
run(g, 50, 20);
ok(g.tier === 'medium', '50fps for 20s holds tier (hysteresis band)');
run(g, 57, 20);
ok(g.tier === 'medium', '57fps holds tier (just under up-threshold)');
run(g, 46, 20);
ok(g.tier === 'medium', '46fps holds tier (just over down-threshold)');

/* 5. cooldown prevents flapping */
g = NB.Perf.create({ initial: 'high' });
run(g, 30, 3.5);
ok(g.tier === 'medium', 'first step down ok');
const c0 = g.changeCount;
run(g, 30, 4); /* inside 5s cooldown: no further change */
ok(g.tier === 'medium' && g.changeCount === c0, 'cooldown suppresses immediate second step');

/* 6. manual lock freezes the tier */
g = NB.Perf.create({ initial: 'high' });
g.setManual('high');
run(g, 25, 12);
ok(g.tier === 'high', 'manual lock holds high through 25fps');
ok(g.manual === 'high', 'manual getter reports lock');
g.setManual('auto');
run(g, 25, 4);
ok(g.tier === 'medium', 'unlocking resumes auto govern');
ok(g.manual === null, 'manual cleared');

/* 7. setManual to a tier applies immediately */
g = NB.Perf.create({ initial: 'high' });
g.setManual('low');
ok(g.tier === 'low', 'setManual(low) applies at once');

/* 8. EMA reacts fast to drops (no 10s lag before stepping down) */
g = NB.Perf.create({ initial: 'high' });
run(g, 60, 5);
run(g, 20, 3.2);
ok(g.tier === 'medium', 'sharp drop to 20fps steps down within ~3.2s');

if (failures){ console.error(failures + ' FAILURES'); process.exit(1); }
console.log('perf-check: all green');
