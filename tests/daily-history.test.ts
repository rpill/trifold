import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBestStreak, deriveCurrentStreak, mergeDailyRecord } from '../src/meta/daily/DailyHistory.ts';
import type { DailyRecord } from '../src/meta/MetaSave.ts';

function completed(completedOnTime: boolean): DailyRecord {
  return { completed: true, completedOnTime, attempts: 1, personalBest: { moves: 40, activeMs: 300_000 } };
}
function records(keys: readonly string[]): Record<string, DailyRecord> {
  return Object.fromEntries(keys.map((key) => [key, completed(true)]));
}

test('unplayed today preserves yesterday ending streak during the current day', () => {
  assert.equal(deriveCurrentStreak(records(['2026-09-11', '2026-09-12', '2026-09-13']), '2026-09-14'), 3);
});
test('missing yesterday means streak is already broken today', () => {
  assert.equal(deriveCurrentStreak(records(['2026-09-11', '2026-09-12']), '2026-09-14'), 0);
});
test('late archive completion does not count toward streak', () => {
  assert.equal(deriveCurrentStreak({ '2026-09-13': completed(false), '2026-09-14': completed(true) }, '2026-09-14'), 1);
});
test('best streak respects persisted legacy floor', () => {
  const history = { ...records(['2026-09-01','2026-09-02','2026-09-03','2026-09-05','2026-09-06']), '2026-09-04': completed(false) };
  assert.equal(deriveBestStreak(history, 7), 7);
  assert.equal(deriveBestStreak(history, 0), 3);
});
test('merge validates date key and stores MetaSave DailyRecord without embedding identity', () => {
  const entry = completed(true);
  assert.deepEqual(mergeDailyRecord({}, '2026-09-14', entry)['2026-09-14'], entry);
  assert.throws(() => mergeDailyRecord({}, 'bad', entry), /date/i);
});
