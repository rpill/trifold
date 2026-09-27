import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { mergeProfiles } from '../src/meta/profile/ProfileMerge.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { createDeal } from '../src/game/model/deal.ts';

function activeStandard(seed: number, updatedAtMs: number) {
  return {
    version: 1 as const,
    seed,
    partition: 'easy' as const,
    difficulty: 'easy' as const,
    game: new TrifoldGame(createDeal(seed)).exportSave(),
    moves: 3,
    activeMs: 1000,
    assisted: false,
    updatedAtMs,
  };
}

function activeDaily(seed: number, dateKey: string, updatedAtMs: number) {
  return {
    version: 1 as const,
    dailyDateKey: dateKey,
    seed,
    game: new TrifoldGame(createDeal(seed)).exportSave(),
    moves: 4,
    activeMs: 2000,
    updatedAtMs,
  };
}

test('profile merge unions progress without economy or theme fields', () => {
  const local = {
    ...createDefaultProfile(),
    completedStandard: { onboarding: [1], easy: [2], medium: [], hard: [] },
    masteryCreditedStandardSeeds: [2],
    futurePrestige: { mediumSeeds: [10], hardSeeds: [], onTimeDailyDates: ['2026-09-10'] },
  };
  const cloud = {
    ...createDefaultProfile(),
    completedStandard: { onboarding: [1, 3], easy: [], medium: [4], hard: [5] },
    masteryCreditedStandardSeeds: [4, 5],
    futurePrestige: { mediumSeeds: [11], hardSeeds: [12], onTimeDailyDates: ['2026-09-11'] },
  };
  const merged = mergeProfiles(local, cloud);
  assert.deepEqual(merged.completedStandard.onboarding, [1, 3]);
  assert.deepEqual(merged.completedStandard.easy, [2]);
  assert.deepEqual(merged.completedStandard.medium, [4]);
  assert.deepEqual(merged.completedStandard.hard, [5]);
  assert.deepEqual(merged.masteryCreditedStandardSeeds, [2, 4, 5]);
  assert.deepEqual(merged.futurePrestige.mediumSeeds, [10, 11]);
  assert.deepEqual(merged.futurePrestige.hardSeeds, [12]);
  for (const key of ['coins', 'claimedRewardKeys', 'ownedThemeIds', 'activeThemeId']) {
    assert.equal(key in merged, false);
  }
});

test('profile merge keeps better personal records and deterministic Daily official result', () => {
  const local = {
    ...createDefaultProfile(),
    standardPersonalBests: { 'easy:2': { moves: 20, activeMs: 10000 } },
    daily: {
      history: {
        '2026-09-14': {
          dateKey: '2026-09-14', completed: true, completedOnTime: true,
          officialResult: { moves: 40, activeMs: 5000 }, personalBest: { moves: 39, activeMs: 6000 },
        },
      }, active: null, bestStreak: 5,
    },
  };
  const cloud = {
    ...createDefaultProfile(),
    standardPersonalBests: { 'easy:2': { moves: 19, activeMs: 20000 } },
    daily: {
      history: {
        '2026-09-14': {
          dateKey: '2026-09-14', completed: true, completedOnTime: true,
          officialResult: { moves: 41, activeMs: 4000 }, personalBest: { moves: 38, activeMs: 9000 },
        },
      }, active: null, bestStreak: 7,
    },
  };
  const merged = mergeProfiles(local, cloud);
  assert.deepEqual(merged.standardPersonalBests['easy:2'], { moves: 19, activeMs: 20000 });
  assert.deepEqual(merged.daily.history['2026-09-14']?.officialResult, cloud.daily.history['2026-09-14']!.officialResult);
  assert.deepEqual(merged.daily.history['2026-09-14']?.personalBest, { moves: 38, activeMs: 9000 });
  assert.equal(merged.daily.history['2026-09-14']?.completedOnTime, true);
  assert.equal(merged.daily.bestStreak, 7);
});

test('profile merge keeps higher Mastery or max capped counters at equal rank', () => {
  const local = { ...createDefaultProfile(), mastery: { rank: 'player' as const, stage: { anyWins: 0, mediumWins: 12, hardWins: 1, onTimeDailyWins: 0 } } };
  const cloudHigher = { ...createDefaultProfile(), mastery: { rank: 'expert' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 7, onTimeDailyWins: 2 } } };
  assert.equal(mergeProfiles(local, cloudHigher).mastery.rank, 'expert');

  const cloudSame = { ...createDefaultProfile(), mastery: { rank: 'player' as const, stage: { anyWins: 0, mediumWins: 9, hardWins: 3, onTimeDailyWins: 0 } } };
  const same = mergeProfiles(local, cloudSame);
  assert.equal(same.mastery.rank, 'player');
  assert.equal(same.mastery.stage.mediumWins, 12);
  assert.equal(same.mastery.stage.hardWins, 3);
});

test('profile merge keeps newer active saves and local valid preferences', () => {
  const local = {
    ...createDefaultProfile(), selectedStandardDifficulty: 'hard' as const,
    activeStandard: activeStandard(1, 100),
    daily: { ...createDefaultProfile().daily, active: activeDaily(2, '2026-09-14', 400) },
    tutorialCompleted: true,
  };
  const cloud = {
    ...createDefaultProfile(), selectedStandardDifficulty: 'easy' as const,
    activeStandard: activeStandard(3, 300),
    daily: { ...createDefaultProfile().daily, active: activeDaily(4, '2026-09-13', 200) },
  };
  const merged = mergeProfiles(local, cloud);
  assert.equal(merged.activeStandard?.seed, 3);
  assert.equal(merged.daily.active?.seed, 2);
  assert.equal(merged.selectedStandardDifficulty, 'hard');
  assert.equal(merged.tutorialCompleted, true);
});
