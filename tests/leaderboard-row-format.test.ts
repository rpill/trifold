import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLeaderboardValue } from '../src/ui/leaderboards/LeaderboardRowFormat.ts';
import type { LeaderboardRow } from '../src/leaderboards/LeaderboardService.ts';

function row(metric: LeaderboardRow['metric'], value = 0): LeaderboardRow {
  return { rank: 1, publicName: 'Player', value, metric };
}

test('leaderboard values are formatted from normalized product rows', () => {
  assert.equal(formatLeaderboardValue('daily', row({ kind: 'daily', moves: 42, elapsedMs: 198_000 }), 'ru'), '42 хода · 03:18');
  assert.equal(formatLeaderboardValue('streak', row({ kind: 'streak', current: 17, best: 24 }, 17), 'ru'), '17');
  assert.equal(formatLeaderboardValue('mastery', row({ kind: 'mastery', rank: 'tactician', points: 4 }), 'ru'), 'Тактик · 4');
  assert.equal(formatLeaderboardValue('mastery', row({ kind: 'mastery', rank: 'tactician', points: 4 }), 'en'), 'Tactician · 4');
});

test('leaderboard formatter rejects mismatched row metric instead of decoding raw scores', () => {
  assert.equal(formatLeaderboardValue('daily', row({ kind: 'streak', current: 2, best: 3 }, 2), 'ru'), '—');
  assert.equal(formatLeaderboardValue('mastery', row({ kind: 'daily', moves: 5, elapsedMs: 1_000 }), 'ru'), '—');
});
