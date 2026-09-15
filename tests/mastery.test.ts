import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import {
  getMasteryRequirements,
  recordMasteryEligibleStandardWin,
} from '../src/meta/mastery/Mastery.ts';

test('Mastery requirements match approved stage-local ladder', () => {
  assert.deepEqual(getMasteryRequirements('novice'), { anyWins: 10, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0, rewardCoins: 100 });
  assert.deepEqual(getMasteryRequirements('player'), { anyWins: 0, mediumWins: 15, hardWins: 3, onTimeDailyWins: 0, rewardCoins: 150 });
  assert.deepEqual(getMasteryRequirements('tactician'), { anyWins: 0, mediumWins: 25, hardWins: 10, onTimeDailyWins: 0, rewardCoins: 200 });
  assert.deepEqual(getMasteryRequirements('expert'), { anyWins: 0, mediumWins: 0, hardWins: 25, onTimeDailyWins: 5, rewardCoins: 300 });
  assert.deepEqual(getMasteryRequirements('master'), { anyWins: 0, mediumWins: 0, hardWins: 60, onTimeDailyWins: 15, rewardCoins: 500 });
  assert.equal(getMasteryRequirements('grandmaster'), null);
});

test('promotion advances exactly one rank, pays once and resets stage', () => {
  const profile = createDefaultProfile();
  let current = profile;
  for (let seed = 1; seed <= 10; seed += 1) {
    current = recordMasteryEligibleStandardWin(current, { seed, difficulty: 'easy' }).profile;
  }
  assert.equal(current.mastery.rank, 'player');
  assert.deepEqual(current.mastery.stage, { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 });
  assert.equal(current.coins, 100);
  assert.ok(current.claimedRewardKeys.includes('mastery-rank:player'));
});

test('same Standard seed cannot credit a later Mastery stage twice', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: {
      rank: 'player' as const,
      stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
    },
  };
  const first = recordMasteryEligibleStandardWin(profile, { seed: 42, difficulty: 'hard' }).profile;
  const second = recordMasteryEligibleStandardWin(first, { seed: 42, difficulty: 'hard' }).profile;
  assert.equal(second.mastery.stage.hardWins, 1);
  assert.deepEqual(second.masteryCreditedStandardSeeds, [42]);
});
