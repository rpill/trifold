import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LEADERBOARD_NAME,
  STREAK_LEADERBOARD_NAME,
  MASTERY_LEADERBOARD_NAME,
  decodeDailyScore,
  decodeDailyLeaderboardScore,
  decodeMasteryScore,
  decodeStreakScore,
  encodeDailyScore,
  encodeDailyLeaderboardScore,
  encodeMasteryScore,
  encodeStreakScore,
  getLeaderboardName,
  lifetimeMasteryPoints,
} from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';

test('daily encoding isolates dates then sorts fewer moves before faster time', () => {
  const slowFew = encodeDailyScore(10, 20, 90000);
  const fastMore = encodeDailyScore(10, 21, 1000);
  assert.ok(slowFew > fastMore);
  assert.ok(encodeDailyScore(10, 20, 1000) > encodeDailyScore(10, 20, 2000));
  assert.ok(encodeDailyScore(11, 9999, 99_999_999) > encodeDailyScore(10, 1, 1));
  assert.deepEqual(decodeDailyScore(encodeDailyScore(10, 20, 1234)), { dailyOffset: 10, moves: 20, activeMs: 1234 });
});


test('date-key Daily leaderboard helpers preserve date isolation', () => {
  const score = encodeDailyLeaderboardScore('2026-09-16', 40, 80000);
  assert.deepEqual(decodeDailyLeaderboardScore(score), { dailyId: '2026-09-16', moves: 40, elapsedMs: 80000 });
  assert.ok(encodeDailyLeaderboardScore('2026-09-17', 9999, 99_999_999) > encodeDailyLeaderboardScore('2026-09-16', 1, 1));
  assert.throws(() => encodeDailyLeaderboardScore('bad', 10, 1000));
});

test('streak encoding round-trips current and best with monotonic current priority', () => {
  const score = encodeStreakScore(12, 18);
  assert.deepEqual(decodeStreakScore(score), { current: 12, best: 18 });
  assert.ok(encodeStreakScore(13, 13) > encodeStreakScore(12, 99));
  assert.throws(() => encodeStreakScore(5, 4));
});

test('Mastery points use unique Trifold credited inputs with approved weights', () => {
  const base = createDefaultMetaSave();
  const meta = {
    ...base,
    standard: {
      ...base.standard,
      completed: { onboarding: [1, 1], easy: [2, 2, 3], medium: [4, 4], hard: [5] },
    },
    futurePrestige: { mediumSeeds: [], hardSeeds: [], onTimeDailyDates: ['2026-09-14', '2026-09-14'] },
    mastery: { rank: 'expert' as const, stage: base.mastery.stage },
  };
  assert.equal(lifetimeMasteryPoints(meta), 1 + 2 + 2 + 3 + 2);
  const encoded = encodeMasteryScore(meta);
  assert.deepEqual(decodeMasteryScore(encoded), { rank: 'expert', points: 10 });
});

test('technical names and generic lookup remain Trifold-specific', () => {
  assert.equal(DAILY_LEADERBOARD_NAME, 'trifolddaily');
  assert.equal(STREAK_LEADERBOARD_NAME, 'trifoldstreak');
  assert.equal(MASTERY_LEADERBOARD_NAME, 'trifoldmastery');
  assert.equal(getLeaderboardName('daily'), DAILY_LEADERBOARD_NAME);
  assert.equal(getLeaderboardName('streak'), STREAK_LEADERBOARD_NAME);
  assert.equal(getLeaderboardName('mastery'), MASTERY_LEADERBOARD_NAME);
});
