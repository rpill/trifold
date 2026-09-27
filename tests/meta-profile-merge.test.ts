import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { hasMergedMetaScope, mergeMetaProfiles, profileMergeReceiptKey } from '../src/meta/ProfileMerge.ts';

function stateWith(overrides: Partial<MetaSave>): MetaSave {
  return { ...createDefaultMetaSave(), ...overrides };
}

test('meta profile merge unions Trifold progress and keeps better records', () => {
  const targetBase = createDefaultMetaSave();
  const sourceBase = createDefaultMetaSave();
  const target = stateWith({
    standard: {
      ...targetBase.standard,
      selectedDifficulty: 'easy',
      completed: { onboarding: [], easy: [10], medium: [20], hard: [] },
      masteryCreditedSeeds: [20],
      personalBests: { 'easy:10': { moves: 30, activeMs: 30_000 } },
    },
    daily: {
      ...targetBase.daily,
      bestStreakFloor: 3,
      records: {
        '2026-09-14': {
          completed: true, completedOnTime: true, attempts: 1,
          rankingAttemptId: 'remote~1', officialResult: { moves: 40, activeMs: 50_000 },
          personalBest: { moves: 39, activeMs: 60_000 },
        },
      },
    },
    mastery: { rank: 'player', stage: { anyWins: 0, mediumWins: 8, hardWins: 2, onTimeDailyWins: 0 } },
    futurePrestige: { mediumSeeds: [20], hardSeeds: [], onTimeDailyDates: ['2026-09-14'] },
  });
  const source = stateWith({
    standard: {
      ...sourceBase.standard,
      selectedDifficulty: 'hard',
      completed: { onboarding: [1], easy: [], medium: [], hard: [30] },
      masteryCreditedSeeds: [30],
      personalBests: { 'easy:10': { moves: 29, activeMs: 70_000 }, 'hard:30': { moves: 50, activeMs: 90_000 } },
    },
    daily: {
      ...sourceBase.daily,
      bestStreakFloor: 7,
      records: {
        '2026-09-14': {
          completed: true, completedOnTime: true, attempts: 2,
          rankingAttemptId: 'guest~1', officialResult: { moves: 38, activeMs: 55_000 },
          personalBest: { moves: 38, activeMs: 55_000 }, hintUsed: true,
        },
        '2026-09-13': { completed: true, completedOnTime: false, attempts: 1, personalBest: { moves: 55, activeMs: 100_000 } },
      },
    },
    mastery: { rank: 'player', stage: { anyWins: 0, mediumWins: 12, hardWins: 1, onTimeDailyWins: 1 } },
    futurePrestige: { mediumSeeds: [31], hardSeeds: [30], onTimeDailyDates: ['2026-09-13'] },
  });

  const merged = mergeMetaProfiles(target, source, 'browser-local');
  assert.deepEqual(merged.standard.completed, { onboarding: [1], easy: [10], medium: [20], hard: [30] });
  assert.deepEqual(merged.standard.masteryCreditedSeeds, [20, 30]);
  assert.equal(merged.standard.selectedDifficulty, 'hard');
  assert.deepEqual(merged.standard.personalBests['easy:10'], { moves: 29, activeMs: 70_000 });
  assert.deepEqual(merged.standard.personalBests['hard:30'], { moves: 50, activeMs: 90_000 });
  assert.deepEqual(merged.daily.records['2026-09-14']?.officialResult, { moves: 40, activeMs: 50_000 }, 'authorized target official result wins when both have ranking evidence');
  assert.deepEqual(merged.daily.records['2026-09-14']?.personalBest, { moves: 38, activeMs: 55_000 });
  assert.equal(merged.daily.records['2026-09-14']?.attempts, 3);
  assert.equal(merged.daily.records['2026-09-14']?.hintUsed, true);
  assert.equal(merged.daily.bestStreakFloor, 7);
  assert.equal(merged.mastery.rank, 'player');
  assert.equal(merged.mastery.stage.mediumWins, 12);
  assert.equal(merged.mastery.stage.hardWins, 2);
  assert.deepEqual(merged.futurePrestige.mediumSeeds, [20, 31]);
  assert.deepEqual(merged.futurePrestige.hardSeeds, [30]);
  assert.deepEqual(merged.futurePrestige.onTimeDailyDates, ['2026-09-14', '2026-09-13']);
  assert.equal(hasMergedMetaScope(merged, 'browser-local'), true);
});

test('meta profile merge is idempotent per source scope so attempts are not double-counted', () => {
  const target = createDefaultMetaSave();
  const sourceBase = createDefaultMetaSave();
  const source = {
    ...sourceBase,
    daily: { ...sourceBase.daily, records: { '2026-09-14': { completed: true, completedOnTime: true, attempts: 2 } } },
  } satisfies MetaSave;
  const once = mergeMetaProfiles(target, source, 'guest-a');
  const twice = mergeMetaProfiles(once, source, 'guest-a');
  assert.deepEqual(twice, once);
  assert.equal(twice.daily.records['2026-09-14']?.attempts, 2);
  assert.equal(twice.progression.receipts[profileMergeReceiptKey('guest-a')], 1);
});

test('higher mastery rank wins during profile merge', () => {
  const target = createDefaultMetaSave();
  const source = { ...createDefaultMetaSave(), mastery: { rank: 'expert' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 9, onTimeDailyWins: 2 } } };
  const merged = mergeMetaProfiles(target, source, 'guest-b');
  assert.equal(merged.mastery.rank, 'expert');
  assert.equal(merged.mastery.stage.hardWins, 9);
});
