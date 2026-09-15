import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LEADERBOARD_NAME,
  STREAK_LEADERBOARD_NAME,
  MASTERY_LEADERBOARD_NAME,
  encodeDailyScore,
  decodeDailyScore,
  encodeMasteryScore,
  encodeStreakScore,
} from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';

test('daily encoding sorts later date first, then fewer moves, then faster time', () => {
  const slowFew = encodeDailyScore(10, 20, 90000);
  const fastMore = encodeDailyScore(10, 21, 1000);
  assert.ok(slowFew > fastMore);
  assert.ok(encodeDailyScore(10, 20, 1000) > encodeDailyScore(10, 20, 2000));
  assert.ok(encodeDailyScore(11, 9999, 99_999_999) > encodeDailyScore(10, 1, 1));
  assert.deepEqual(decodeDailyScore(encodeDailyScore(10, 20, 1234)), { dailyOffset: 10, moves: 20, activeMs: 1234 });
});

test('daily encoding validates bounds and stays safe through final schedule day', () => {
  const score = encodeDailyScore(7304, 9999, 99_999_999);
  assert.equal(Number.isSafeInteger(score), true);
  for (const [moves, activeMs] of [[0, 1], [10000, 1], [1, 0], [1, 100_000_000]]) {
    assert.throws(() => encodeDailyScore(0, moves, activeMs));
  }
});

test('streak and Mastery scores use approved ranking weights', () => {
  assert.equal(encodeStreakScore(12), 12);
  const profile = {
    ...createDefaultProfile(),
    mastery: { rank: 'expert' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 3, onTimeDailyWins: 1 } },
    futurePrestige: { mediumSeeds: [1, 2], hardSeeds: [3, 4], onTimeDailyDates: ['2026-09-14'] },
  };
  assert.equal(encodeMasteryScore(profile), 4_000_000_000 + 13);
});

test('technical leaderboard names are stable release constants', () => {
  assert.equal(DAILY_LEADERBOARD_NAME, 'trifolddaily');
  assert.equal(STREAK_LEADERBOARD_NAME, 'trifoldstreak');
  assert.equal(MASTERY_LEADERBOARD_NAME, 'trifoldmastery');
});
