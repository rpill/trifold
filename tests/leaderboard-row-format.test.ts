import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeDailyScore, encodeMasteryScore } from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { formatLeaderboardValue } from '../src/ui/leaderboards/LeaderboardRowFormat.ts';
import type { LeaderboardEntry } from '../src/platform/services.ts';

function entry(score: number): LeaderboardEntry {
  return { score, rank: 1, publicName: 'Player', uniqueId: null, avatarUrl: null, extraData: '' };
}

test('leaderboard values are formatted for players instead of exposing composite scores', () => {
  const daily = { ...entry(encodeDailyScore(256, 42, 198_000)), moves: 42, activeMs: 198_000, dailyOffset: 256 };
  assert.equal(formatLeaderboardValue('daily', daily, 'ru'), '42 хода · 03:18');
  assert.equal(formatLeaderboardValue('streak', entry(17), 'ru'), '17');

  const profile = { ...createDefaultProfile(), mastery: { rank: 'tactician' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } }, futurePrestige: { mediumSeeds: [1], hardSeeds: [2], onTimeDailyDates: [] } };
  assert.equal(formatLeaderboardValue('mastery', entry(encodeMasteryScore(profile)), 'ru'), 'Тактик · 4');
  assert.equal(formatLeaderboardValue('mastery', entry(encodeMasteryScore(profile)), 'en'), 'Tactician · 4');
});
