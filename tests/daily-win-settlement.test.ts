import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { beginDailyAttempt, isBetterAttempt, settleDailyWin } from '../src/meta/daily/DailyWinSettlement.ts';

test('first on-time ranked Daily stores immutable official result and personal best', () => {
  const begun = beginDailyAttempt(createDefaultMetaSave(), '2026-09-14', { attemptId: 'daily-2026-09-14~1', rankingEligible: true });
  const result = settleDailyWin(begun, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', attemptId: 'daily-2026-09-14~1', moves: 42, activeMs: 378_400,
  });
  const entry = result.state.daily.records['2026-09-14'];
  assert.equal(entry?.attempts, 1);
  assert.deepEqual(entry?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(entry?.personalBest, { moves: 42, activeMs: 378_400 });
  assert.equal(entry?.completedOnTime, true);
  assert.deepEqual(result.state.futurePrestige.onTimeDailyDates, ['2026-09-14']);
});

test('replay can improve personal best but cannot replace first official result', () => {
  const firstBegin = beginDailyAttempt(createDefaultMetaSave(), '2026-09-14', { attemptId: 'daily-2026-09-14~1', rankingEligible: true });
  const first = settleDailyWin(firstBegin, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', attemptId: 'daily-2026-09-14~1', moves: 42, activeMs: 378_400,
  });
  const replayBegin = beginDailyAttempt(first.state, '2026-09-14', { attemptId: 'daily-2026-09-14~2', rankingEligible: false });
  const replay = settleDailyWin(replayBegin, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', attemptId: 'daily-2026-09-14~2', moves: 39, activeMs: 300_000,
  });
  const entry = replay.state.daily.records['2026-09-14'];
  assert.equal(entry?.attempts, 2);
  assert.deepEqual(entry?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(entry?.personalBest, { moves: 39, activeMs: 300_000 });
  assert.equal(replay.firstCompletion, false);
  assert.equal(replay.improvedBest, true);
  assert.equal(replay.state.futurePrestige.onTimeDailyDates.length, 1);
});

test('only the captured first ranking attempt may create the official result', () => {
  let state = beginDailyAttempt(createDefaultMetaSave(), '2026-09-14', { attemptId: 'daily-2026-09-14~1', rankingEligible: true });
  state = beginDailyAttempt(state, '2026-09-14', { attemptId: 'daily-2026-09-14~2', rankingEligible: true });
  const result = settleDailyWin(state, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', attemptId: 'daily-2026-09-14~2', moves: 30, activeMs: 200_000,
  });
  assert.equal(result.state.daily.records['2026-09-14']?.rankingAttemptId, 'daily-2026-09-14~1');
  assert.equal(result.state.daily.records['2026-09-14']?.officialResult, undefined);
  assert.deepEqual(result.state.daily.records['2026-09-14']?.personalBest, { moves: 30, activeMs: 200_000 });
});

test('archive first completion is late, has no official result and gives no on-time Mastery credit', () => {
  const base = createDefaultMetaSave();
  const state = { ...base, mastery: { rank: 'expert' as const, stage: { anyWins: 0, mediumWins: 0, hardWins: 20, onTimeDailyWins: 2 } } };
  const begun = beginDailyAttempt(state, '2026-09-13', { attemptId: 'daily-2026-09-13~1', rankingEligible: false });
  const result = settleDailyWin(begun, {
    dailyDateKey: '2026-09-13', completionDateKey: '2026-09-14', attemptId: 'daily-2026-09-13~1', moves: 55, activeMs: 480_000,
  });
  const entry = result.state.daily.records['2026-09-13'];
  assert.equal(entry?.completedOnTime, false);
  assert.equal(entry?.officialResult, undefined);
  assert.deepEqual(entry?.personalBest, { moves: 55, activeMs: 480_000 });
  assert.equal(result.state.mastery.stage.onTimeDailyWins, 2);
  assert.deepEqual(result.state.futurePrestige.onTimeDailyDates, []);
});

test('hint-assisted Daily marks the record but still follows first-result/on-time policy', () => {
  const base = createDefaultMetaSave();
  const begun = beginDailyAttempt(base, '2026-09-14', { attemptId: 'daily-2026-09-14~1', rankingEligible: true });
  const result = settleDailyWin(begun, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', attemptId: 'daily-2026-09-14~1', moves: 44, activeMs: 390_000, assisted: true,
  });
  const entry = result.state.daily.records['2026-09-14'];
  assert.equal(entry?.hintUsed, true);
  assert.deepEqual(entry?.officialResult, { moves: 44, activeMs: 390_000 });
  assert.equal(entry?.completedOnTime, true);
});

test('attempt comparison is moves first and active time second', () => {
  assert.equal(isBetterAttempt({ moves: 39, activeMs: 999_999 }, { moves: 40, activeMs: 1 }), true);
  assert.equal(isBetterAttempt({ moves: 40, activeMs: 299_999 }, { moves: 40, activeMs: 300_000 }), true);
  assert.equal(isBetterAttempt({ moves: 40, activeMs: 300_001 }, { moves: 40, activeMs: 300_000 }), false);
});
