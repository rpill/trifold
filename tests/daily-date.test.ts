import test from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, getArchiveDateKeys, toLocalDateKey } from '../src/meta/daily/DailyDate.ts';

test('local date key uses local calendar fields rather than UTC ISO date', () => {
  const date = new Date(2026, 8, 14, 23, 30, 0);
  assert.equal(toLocalDateKey(date), '2026-09-14');
});

test('day arithmetic is calendar-based and ignores DST hour length', () => {
  assert.equal(daysBetween('2026-03-28', '2026-03-29'), 1);
  assert.equal(daysBetween('2026-10-24', '2026-10-25'), 1);
});

test('archive contains today plus exactly previous 89 dates', () => {
  const keys = getArchiveDateKeys('2026-09-14', 90);
  assert.equal(keys.length, 90);
  assert.equal(keys[0], '2026-09-14');
  assert.equal(keys.at(-1), '2026-06-17');
});

test('invalid calendar date keys are rejected', () => {
  assert.throws(() => daysBetween('2026-02-30', '2026-03-01'), /date/i);
  assert.throws(() => getArchiveDateKeys('nope', 90), /date/i);
});
