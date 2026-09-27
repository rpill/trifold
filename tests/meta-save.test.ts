import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DAILY_ALGORITHM_VERSION,
  META_SAVE_VERSION,
  createDefaultMetaSave,
  normalizeMetaSave,
} from '../src/meta/MetaSave.ts';

test('default meta save contains product progress only and starts empty', () => {
  const meta = createDefaultMetaSave();

  assert.equal(meta.version, META_SAVE_VERSION);
  assert.equal(meta.standard.selectedDifficulty, 'easy');
  assert.deepEqual(meta.standard.completed, { onboarding: [], easy: [], medium: [], hard: [] });
  assert.deepEqual(meta.standard.masteryCreditedSeeds, []);
  assert.deepEqual(meta.standard.personalBests, {});
  assert.equal(meta.standard.onboardingWins, 0);
  assert.deepEqual(meta.daily, {
    algorithmVersion: DAILY_ALGORITHM_VERSION,
    records: {},
    bestStreakFloor: 0,
  });
  assert.deepEqual(meta.mastery, {
    rank: 'novice',
    stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
  });
  assert.deepEqual(meta.futurePrestige, { mediumSeeds: [], hardSeeds: [], onTimeDailyDates: [] });
  assert.deepEqual(meta.standardWinStreak, { current: 0, best: 0 });

  const keys = new Set(Object.keys(meta));
  for (const removed of ['coins', 'claimedRewardKeys', 'ownedThemeIds', 'activeThemeId']) {
    assert.equal(keys.has(removed), false, `${removed} must not exist in MetaSave`);
  }
});

test('normalizer preserves safe Trifold product data, deduplicates numeric seeds and drops removed economy/theme keys', () => {
  const meta = normalizeMetaSave({
    version: 999,
    coins: 9999,
    claimedRewardKeys: ['rank:player'],
    ownedThemeIds: ['base', 'gold'],
    activeThemeId: 'gold',
    standard: {
      selectedDifficulty: 'hard',
      recentSeeds: [3, 3, 0, -1, 4, 4.5, 5],
      completed: {
        onboarding: [1, 1, 2],
        easy: [10, 10, 11],
        medium: [20],
        hard: [30, '31'],
      },
      masteryCreditedSeeds: [10, 10, 20, -1],
      onboardingWins: 99,
      personalBests: {
        'easy:10': { moves: 50, activeMs: 12_000 },
        'bad:key': { moves: -1, activeMs: 0 },
      },
    },
    standardWinStreak: { current: 3, best: 2 },
    mastery: {
      rank: 'expert',
      stage: { anyWins: 15, mediumWins: 4, hardWins: 2, onTimeDailyWins: 3 },
    },
    futurePrestige: {
      mediumSeeds: [20, 20, 21],
      hardSeeds: [30],
      onTimeDailyDates: ['2026-09-27', 'bad-date', '2026-09-27'],
    },
    daily: {
      algorithmVersion: -1,
      bestStreakFloor: 7,
      records: {
        '2026-09-27': {
          completed: true,
          completedOnTime: true,
          attempts: 2,
          officialResult: { moves: 80, activeMs: 50_000 },
          personalBest: { moves: 70, activeMs: 45_000 },
          rankingAttemptId: 'daily~2026-09-27~1',
          hintUsed: true,
        },
        invalid: { completed: true },
      },
    },
  });

  assert.equal(meta.version, META_SAVE_VERSION);
  assert.deepEqual(meta.standard.recentSeeds, [3, 4, 5]);
  assert.deepEqual(meta.standard.completed, { onboarding: [1, 2], easy: [10, 11], medium: [20], hard: [30] });
  assert.deepEqual(meta.standard.masteryCreditedSeeds, [10, 20]);
  assert.equal(meta.standard.onboardingWins, 5);
  assert.deepEqual(meta.standard.personalBests, { 'easy:10': { moves: 50, activeMs: 12_000 } });
  assert.deepEqual(meta.standardWinStreak, { current: 3, best: 3 });
  assert.equal(meta.mastery.rank, 'expert');
  assert.deepEqual(meta.futurePrestige, {
    mediumSeeds: [20, 21],
    hardSeeds: [30],
    onTimeDailyDates: ['2026-09-27'],
  });
  assert.equal(meta.daily.algorithmVersion, DAILY_ALGORITHM_VERSION);
  assert.equal(meta.daily.bestStreakFloor, 7);
  assert.deepEqual(Object.keys(meta.daily.records), ['2026-09-27']);
  assert.deepEqual(meta.daily.records['2026-09-27'], {
    completed: true,
    completedOnTime: true,
    attempts: 2,
    officialResult: { moves: 80, activeMs: 50_000 },
    personalBest: { moves: 70, activeMs: 45_000 },
    rankingAttemptId: 'daily~2026-09-27~1',
    hintUsed: true,
  });
  assert.equal('coins' in meta, false);
  assert.equal('ownedThemeIds' in meta, false);
});

test('normalizer returns safe defaults for corrupt input', () => {
  assert.deepEqual(normalizeMetaSave(null), createDefaultMetaSave());
  assert.deepEqual(normalizeMetaSave('broken'), createDefaultMetaSave());
});
