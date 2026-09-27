import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, normalizeMetaSave, type MetaSave, type StandardDifficulty, type StandardPartition } from '../src/meta/MetaSave.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';
import { settleDailyWin } from '../src/meta/daily/DailyWinSettlement.ts';
import { deriveCurrentStreak } from '../src/meta/daily/DailyHistory.ts';
import { mergeMetaProfiles } from '../src/meta/ProfileMerge.ts';

function reload(state: MetaSave): MetaSave {
  return normalizeMetaSave(JSON.parse(JSON.stringify(state)));
}

function standardWin(
  state: MetaSave,
  seed: number,
  partition: StandardPartition,
  difficulty: StandardDifficulty,
): MetaSave {
  return settleStandardWin(state, {
    seed,
    partition,
    difficulty,
    moves: 40 + (seed % 7),
    activeMs: 120_000 + seed,
    assisted: false,
  }).state;
}

test('fresh guest meta survives the complete non-economy product loop without duplicate progress', () => {
  let state = createDefaultMetaSave();

  state = standardWin(state, 39_650, 'onboarding', 'easy');
  assert.equal(state.mastery.stage.anyWins, 1);
  assert.deepEqual(state.standard.completed.onboarding, [39_650]);

  for (let index = 0; index < 9; index += 1) {
    state = standardWin(state, 70_001 + index, 'hard', 'hard');
    if ((index + 2) % 3 === 0) state = reload(state);
  }

  assert.equal(state.mastery.rank, 'player');
  assert.equal(state.mastery.stage.anyWins, 0);

  state = settleDailyWin(state, {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 42,
    activeMs: 378_400,
  }).state;
  state = settleDailyWin(state, {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 39,
    activeMs: 300_000,
  }).state;
  assert.deepEqual(state.daily.records['2026-09-14']?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(state.daily.records['2026-09-14']?.personalBest, { moves: 39, activeMs: 300_000 });

  state = settleDailyWin(state, {
    dailyDateKey: '2026-09-13',
    completionDateKey: '2026-09-14',
    moves: 55,
    activeMs: 480_000,
  }).state;
  assert.equal(state.daily.records['2026-09-13']?.completedOnTime, false);
  assert.equal(deriveCurrentStreak(state.daily.records, '2026-09-14'), 1, 'late archive completion must not repair streak');

  const cloud = createDefaultMetaSave();
  const cloudWithProgress: MetaSave = {
    ...cloud,
    standard: {
      ...cloud.standard,
      completed: { ...cloud.standard.completed, easy: [88_888] },
    },
  };
  state = mergeMetaProfiles(state, cloudWithProgress, 'cloud-release-regression');
  assert.equal(state.standard.completed.easy.includes(88_888), true);
  assert.equal(state.standard.completed.hard.includes(70_001), true);

  const masteryBeforeRetry = JSON.stringify(state.mastery);
  state = settleStandardWin(state, {
    seed: 70_001,
    partition: 'hard',
    difficulty: 'hard',
    moves: 30,
    activeMs: 100_000,
    assisted: false,
  }).state;
  assert.equal(JSON.stringify(state.mastery), masteryBeforeRetry, 'replaying a credited Standard seed must not credit Mastery twice');
  state = settleDailyWin(state, {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 38,
    activeMs: 290_000,
  }).state;
  assert.deepEqual(state.daily.records['2026-09-14']?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(state.daily.records['2026-09-14']?.personalBest, { moves: 38, activeMs: 290_000 });
});
