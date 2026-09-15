import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { settleDailyWin, isBetterAttempt } from '../src/meta/daily/DailyWinSettlement.ts';

test('first on-time Daily stores immutable official result and grants 15 coins', () => {
  const result = settleDailyWin(createDefaultProfile(), {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 42, activeMs: 378_400,
  });
  const entry = result.profile.daily.history['2026-09-14'];
  assert.deepEqual(entry?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(entry?.personalBest, { moves: 42, activeMs: 378_400 });
  assert.equal(entry?.completedOnTime, true);
  assert.equal(result.coinsGranted, 15);
  assert.equal(result.profile.coins, 15);
  assert.deepEqual(result.profile.futurePrestige.onTimeDailyDates, ['2026-09-14']);
});

test('replay can improve personal best but cannot replace official first win or pay again', () => {
  const first = settleDailyWin(createDefaultProfile(), {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 42, activeMs: 378_400,
  });
  const replay = settleDailyWin(first.profile, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 39, activeMs: 300_000,
  });
  const entry = replay.profile.daily.history['2026-09-14'];
  assert.deepEqual(entry?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(entry?.personalBest, { moves: 39, activeMs: 300_000 });
  assert.equal(replay.coinsGranted, 0);
  assert.equal(replay.profile.coins, 15);
  assert.equal(replay.profile.futurePrestige.onTimeDailyDates.length, 1);
});

test('archive first completion grants 5 coins and never creates official result or on-time Mastery credit', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: { rank: 'expert' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } },
  };
  const result = settleDailyWin(profile, {
    dailyDateKey: '2026-09-13', completionDateKey: '2026-09-14', moves: 55, activeMs: 480_000,
  });
  const entry = result.profile.daily.history['2026-09-13'];
  assert.equal(entry?.completedOnTime, false);
  assert.equal(entry?.officialResult, null);
  assert.deepEqual(entry?.personalBest, { moves: 55, activeMs: 480_000 });
  assert.equal(result.coinsGranted, 5);
  assert.equal(result.profile.mastery.stage.onTimeDailyWins, 0);
  assert.deepEqual(result.profile.futurePrestige.onTimeDailyDates, []);
});

test('on-time Daily advances current Mastery Daily requirement once', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: { rank: 'expert' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 20, onTimeDailyWins: 2 } },
  };
  const first = settleDailyWin(profile, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 50, activeMs: 400_000,
  });
  assert.equal(first.profile.mastery.stage.onTimeDailyWins, 3);
  const replay = settleDailyWin(first.profile, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 49, activeMs: 390_000,
  });
  assert.equal(replay.profile.mastery.stage.onTimeDailyWins, 3);
});

test('Daily win can complete novice any-win requirement', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: { rank: 'novice' as const, stage: { anyWins: 9, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } },
  };
  const result = settleDailyWin(profile, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 50, activeMs: 400_000,
  });
  assert.equal(result.rankAdvancedTo, 'player');
  assert.equal(result.profile.mastery.rank, 'player');
});

test('attempt comparison is moves first and active time second', () => {
  assert.equal(isBetterAttempt({ moves: 39, activeMs: 999_999 }, { moves: 40, activeMs: 1 }), true);
  assert.equal(isBetterAttempt({ moves: 40, activeMs: 299_999 }, { moves: 40, activeMs: 300_000 }), true);
  assert.equal(isBetterAttempt({ moves: 40, activeMs: 300_001 }, { moves: 40, activeMs: 300_000 }), false);
});
