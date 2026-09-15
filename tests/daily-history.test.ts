import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBestStreak, deriveCurrentStreak, mergeDailyHistoryEntry } from '../src/meta/daily/DailyHistory.ts';
import type { DailyHistoryEntry } from '../src/meta/profile/ProfileTypes.ts';

function completedEntry(dateKey: string, completedOnTime: boolean): DailyHistoryEntry {
  return {
    dateKey,
    completed: true,
    completedOnTime,
    officialResult: completedOnTime ? { moves: 40, activeMs: 300_000 } : null,
    personalBest: { moves: 40, activeMs: 300_000 },
    firstCompletionRewardClaimed: true,
  };
}

function entries(keys: readonly string[]): Record<string, DailyHistoryEntry> {
  return Object.fromEntries(keys.map((key) => [key, completedEntry(key, true)]));
}

test('unplayed today preserves yesterday ending streak during the current day', () => {
  const history = entries(['2026-09-11', '2026-09-12', '2026-09-13']);
  assert.equal(deriveCurrentStreak(history, '2026-09-14'), 3);
});

test('missing yesterday means streak is already broken today', () => {
  const history = entries(['2026-09-11', '2026-09-12']);
  assert.equal(deriveCurrentStreak(history, '2026-09-14'), 0);
});

test('archive completion does not count because completedOnTime is false', () => {
  const history = {
    '2026-09-13': completedEntry('2026-09-13', false),
    '2026-09-14': completedEntry('2026-09-14', true),
  };
  assert.equal(deriveCurrentStreak(history, '2026-09-14'), 1);
});

test('best streak considers only consecutive on-time days', () => {
  const history = {
    ...entries(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-09-06']),
    '2026-09-04': completedEntry('2026-09-04', false),
  };
  assert.equal(deriveBestStreak(history), 3);
});

test('merge keeps date-key identity and rejects mismatches', () => {
  const entry = completedEntry('2026-09-14', true);
  const merged = mergeDailyHistoryEntry({}, entry);
  assert.deepEqual(merged['2026-09-14'], entry);
  assert.throws(() => mergeDailyHistoryEntry({}, { ...entry, dateKey: 'bad' }), /date/i);
});
