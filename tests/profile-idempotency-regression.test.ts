import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave, normalizeMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';
import { settleDailyWin } from '../src/meta/daily/DailyWinSettlement.ts';

function roundTrip(state: MetaSave): MetaSave {
  return normalizeMetaSave(JSON.parse(JSON.stringify(state)));
}

test('Standard first completion and Mastery promotion survive retry after reload exactly once', () => {
  const base = createDefaultMetaSave();
  const prepared: MetaSave = {
    ...base,
    mastery: {
      rank: 'novice',
      stage: { anyWins: 9, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
    },
  };
  const input = { seed: 91_001, partition: 'hard' as const, difficulty: 'hard' as const, moves: 40, activeMs: 100_000, assisted: false };
  const first = settleStandardWin(prepared, input);
  assert.equal(first.rankAdvancedTo, 'player');
  assert.equal(first.state.mastery.rank, 'player');

  const retry = settleStandardWin(roundTrip(first.state), input);
  assert.equal(retry.firstCompletion, false);
  assert.equal(retry.rankAdvancedTo, null);
  assert.equal(retry.state.mastery.rank, 'player');
  assert.equal(retry.state.mastery.stage.anyWins, 0);
});

test('Daily official result and Mastery credit survive retry after reload exactly once', () => {
  const base = createDefaultMetaSave();
  const prepared: MetaSave = {
    ...base,
    mastery: {
      rank: 'expert',
      stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 4 },
    },
  };
  const input = { dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 42, activeMs: 300_000 };
  const first = settleDailyWin(prepared, input);
  assert.deepEqual(first.state.daily.records['2026-09-14']?.officialResult, { moves: 42, activeMs: 300_000 });
  assert.equal(first.state.mastery.stage.onTimeDailyWins, 5);

  const retry = settleDailyWin(roundTrip(first.state), { ...input, moves: 38, activeMs: 250_000 });
  assert.deepEqual(retry.state.daily.records['2026-09-14']?.officialResult, { moves: 42, activeMs: 300_000 });
  assert.deepEqual(retry.state.daily.records['2026-09-14']?.personalBest, { moves: 38, activeMs: 250_000 });
  assert.equal(retry.state.mastery.stage.onTimeDailyWins, 5);
});
