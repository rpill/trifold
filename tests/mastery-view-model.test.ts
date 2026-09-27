import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, type MasteryRank, type MetaSave } from '../src/meta/MetaSave.ts';
import { buildMasteryViewModel, MASTERY_RANK_ORDER } from '../src/ui/mastery/MasteryViewModel.ts';

const EXPECTED_REQUIREMENTS: Readonly<Record<MasteryRank, readonly [string, number][]>> = {
  novice: [['anyWins', 10]],
  player: [['mediumWins', 15], ['hardWins', 3]],
  tactician: [['mediumWins', 25], ['hardWins', 10]],
  expert: [['hardWins', 25], ['onTimeDailyWins', 5]],
  master: [['hardWins', 60], ['onTimeDailyWins', 15]],
  grandmaster: [],
};

for (const rank of MASTERY_RANK_ORDER) {
  test(`Mastery ${rank} exposes literal stage-local requirements from MetaSave`, () => {
    const base = createDefaultMetaSave();
    const state: MetaSave = { ...base, mastery: { ...base.mastery, rank } };
    const vm = buildMasteryViewModel(state);
    assert.equal(vm.rank, rank);
    assert.deepEqual(vm.requirements.map((item) => [item.key, item.total]), EXPECTED_REQUIREMENTS[rank]);
    assert.equal(vm.path.length, 6);
    assert.equal(vm.path.find((item) => item.rank === rank)?.current, true);
  });
}

test('Mastery shows real MetaSave counters without currency reward state', () => {
  const base = createDefaultMetaSave();
  const state: MetaSave = {
    ...base,
    mastery: {
      rank: 'expert',
      stage: { anyWins: 0, mediumWins: 0, hardWins: 18, onTimeDailyWins: 3 },
    },
  };
  const vm = buildMasteryViewModel(state);
  assert.deepEqual(vm.requirements.map((item) => [item.label, item.current, item.total]), [
    ['Сложные', 18, 25],
    ['Daily', 3, 5],
  ]);
  assert.equal('nextRewardCoins' in vm, false);
});

test('Mastery view model renders English rank and requirement labels from MetaSave', () => {
  const base = createDefaultMetaSave();
  const state: MetaSave = {
    ...base,
    mastery: { rank: 'expert', stage: { anyWins: 0, mediumWins: 0, hardWins: 18, onTimeDailyWins: 3 } },
  };
  const vm = buildMasteryViewModel(state, 'en');
  assert.equal(vm.rankLabel, 'Expert');
  assert.deepEqual(vm.requirements.map((item) => item.label), ['Hard wins', 'Daily']);
});
