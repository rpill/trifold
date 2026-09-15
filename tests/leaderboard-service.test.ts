import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import { encodeDailyScore, encodeMasteryScore, MASTERY_LEADERBOARD_NAME, STREAK_LEADERBOARD_NAME, DAILY_LEADERBOARD_NAME } from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { PlatformAuth, PlatformLeaderboards } from '../src/platform/services.ts';

function auth(authorized: boolean): PlatformAuth {
  return { available: true, isAuthorized: () => authorized, requestAuthorization: async () => authorized };
}

function board(overrides: Partial<PlatformLeaderboards> = {}): PlatformLeaderboards {
  return {
    available: true,
    getEntries: async () => ({ entries: [], userRank: null }),
    getPlayerEntry: async () => null,
    setScore: async () => undefined,
    ...overrides,
  };
}

const catalog = {
  metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  getDailySeedByOffset: (offset: number) => offset + 1,
};

test('unauthorized guests load public Daily top but have no player entry', async () => {
  const rows = [{ score: encodeDailyScore(256, 40, 5000), rank: 1, publicName: 'A', uniqueId: null, avatarUrl: null, extraData: '' }];
  const service = new LeaderboardService(board({ getEntries: async () => ({ entries: rows, userRank: null }) }), auth(false));
  const result = await service.loadDaily({ dateKey: '2026-09-14', offset: 256, seed: 1 });
  assert.equal(result.status, 'ready');
  assert.equal(result.entries.length, 1);
  assert.equal(result.playerEntry, null);
});

test('Daily loader filters stale encoded dates from shared technical board', async () => {
  const rows = [
    { score: encodeDailyScore(255, 30, 1000), rank: 1, publicName: 'old', uniqueId: null, avatarUrl: null, extraData: '' },
    { score: encodeDailyScore(256, 40, 5000), rank: 2, publicName: 'today', uniqueId: null, avatarUrl: null, extraData: '' },
  ];
  const service = new LeaderboardService(board({ getEntries: async () => ({ entries: rows, userRank: null }) }), auth(false));
  const result = await service.loadDaily({ dateKey: '2026-09-14', offset: 256, seed: 1 });
  assert.deepEqual(result.entries.map((e) => e.publicName), ['today']);
});

test('sync submits official Daily, best streak and Mastery only for authorized player', async () => {
  const calls: Array<[string, number]> = [];
  const lb = board({
    getPlayerEntry: async () => null,
    setScore: async (name, score) => { calls.push([name, score]); },
  });
  const profile = {
    ...createDefaultProfile(),
    daily: {
      history: {
        '2026-09-14': { dateKey: '2026-09-14', completed: true, completedOnTime: true, officialResult: { moves: 40, activeMs: 5000 }, personalBest: { moves: 30, activeMs: 4000 }, firstCompletionRewardClaimed: true },
      }, active: null, bestStreak: 12,
    },
    mastery: { rank: 'player' as const, stage: { anyWins: 0, mediumWins: 3, hardWins: 1, onTimeDailyWins: 0 } },
  };
  const service = new LeaderboardService(lb, auth(true));
  await service.syncFromProfile(profile, '2026-09-14', catalog);
  const daily = calls.find(([name]) => name === DAILY_LEADERBOARD_NAME);
  assert.equal(daily?.[1], encodeDailyScore(256, 40, 5000));
  assert.ok(calls.some(([name, score]) => name === STREAK_LEADERBOARD_NAME && score === 12));
  assert.ok(calls.some(([name, score]) => name === MASTERY_LEADERBOARD_NAME && score === encodeMasteryScore(profile)));
});

test('sync skips network errors and unavailable/guest services', async () => {
  const unavailable = new LeaderboardService({ ...board(), available: false }, auth(true));
  assert.equal((await unavailable.loadStreak()).status, 'unavailable');
  const failing = new LeaderboardService(board({ getEntries: async () => { throw new Error('offline'); } }), auth(false));
  assert.equal((await failing.loadStreak()).status, 'error');
  await new LeaderboardService(board({ setScore: async () => { throw new Error('offline'); } }), auth(true))
    .syncFromProfile(createDefaultProfile(), '2026-09-14', catalog);
});

test('leaderboard top requests respect Yandex quantityTop maximum of 20', async () => {
  const quantities: number[] = [];
  const lb = board({
    getEntries: async (_name, options) => {
      quantities.push(options?.quantityTop ?? 0);
      return { entries: [], userRank: null };
    },
  });
  const service = new LeaderboardService(lb, auth(false));
  await service.loadDaily({ dateKey: '2026-09-14', offset: 256, seed: 1 });
  await service.loadStreak();
  await service.loadMastery();
  assert.deepEqual(quantities, [20, 20, 20]);
});
