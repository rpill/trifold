import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { getMasteryRequirements, recordMasteryEligibleDailyWin, recordMasteryEligibleStandardWin } from '../src/meta/mastery/Mastery.ts';

test('Mastery requirements match Cascade ladder', () => {
  assert.deepEqual(getMasteryRequirements('novice'), { anyWins:10, mediumWins:0, hardWins:0, onTimeDailyWins:0 });
  assert.deepEqual(getMasteryRequirements('player'), { anyWins:0, mediumWins:15, hardWins:3, onTimeDailyWins:0 });
  assert.deepEqual(getMasteryRequirements('tactician'), { anyWins:0, mediumWins:25, hardWins:10, onTimeDailyWins:0 });
  assert.deepEqual(getMasteryRequirements('expert'), { anyWins:0, mediumWins:0, hardWins:25, onTimeDailyWins:5 });
  assert.deepEqual(getMasteryRequirements('master'), { anyWins:0, mediumWins:0, hardWins:60, onTimeDailyWins:15 });
  assert.equal(getMasteryRequirements('grandmaster'), null);
});

test('Standard credit is idempotent and promotion resets stage exactly once', () => {
  let state=createDefaultMetaSave();
  for(let seed=1;seed<=10;seed+=1) state=recordMasteryEligibleStandardWin(state,{seed,difficulty:'easy'}).state;
  assert.equal(state.mastery.rank,'player');
  assert.deepEqual(state.mastery.stage,{anyWins:0,mediumWins:0,hardWins:0,onTimeDailyWins:0});
  const first=recordMasteryEligibleStandardWin(state,{seed:42,difficulty:'hard'}).state;
  const second=recordMasteryEligibleStandardWin(first,{seed:42,difficulty:'hard'}).state;
  assert.equal(second.mastery.stage.hardWins,1);
  assert.deepEqual(second.standard.masteryCreditedSeeds.slice(-1),[42]);
});

test('Daily credit only records lifetime on-time input and stage credit when applicable', () => {
  const base=createDefaultMetaSave();
  const expert={...base,mastery:{rank:'expert' as const,stage:{anyWins:0,mediumWins:0,hardWins:25,onTimeDailyWins:4}}};
  const promoted=recordMasteryEligibleDailyWin(expert,'2026-09-14',true);
  assert.equal(promoted.rankAdvancedTo,'master');
  assert.deepEqual(promoted.state.futurePrestige.onTimeDailyDates,['2026-09-14']);
  const duplicate=recordMasteryEligibleDailyWin(promoted.state,'2026-09-14',true);
  assert.equal(duplicate.masteryAdvanced,false);
  const late=recordMasteryEligibleDailyWin(promoted.state,'2026-09-15',false);
  assert.deepEqual(late.state.futurePrestige.onTimeDailyDates,['2026-09-14']);
});
