import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { buildDailyCalendar } from '../src/meta/daily/DailyCalendarViewModel.ts';

const catalog = { metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 } };

test('calendar exposes exactly 90 visible days when schedule covers window', () => {
  const days = buildDailyCalendar(createDefaultMetaSave(), '2026-09-14', catalog);
  assert.equal(days.length, 90);
  assert.equal(days[0]?.dateKey, '2026-09-14');
  assert.equal(days[0]?.status, 'today-open');
});
test('calendar distinguishes on-time and late archive completion', () => {
  const base = createDefaultMetaSave();
  const records = {
    '2026-09-13': { completed: true, completedOnTime: true, attempts: 1, officialResult: { moves: 42, activeMs: 300_000 }, personalBest: { moves: 40, activeMs: 290_000 } },
    '2026-09-12': { completed: true, completedOnTime: false, attempts: 1, personalBest: { moves: 50, activeMs: 400_000 } },
  } as const;
  const days = buildDailyCalendar({ ...base, daily: { ...base.daily, records } }, '2026-09-14', catalog);
  assert.equal(days.find((day) => day.dateKey === '2026-09-13')?.status, 'archive-complete-on-time');
  assert.equal(days.find((day) => day.dateKey === '2026-09-12')?.status, 'archive-complete-late');
  assert.deepEqual(days.find((day) => day.dateKey === '2026-09-13')?.officialResult, { moves: 42, activeMs: 300_000 });
});
test('dates before catalog start are not emitted', () => {
  const days = buildDailyCalendar(createDefaultMetaSave(), '2026-01-03', catalog);
  assert.deepEqual(days.map((day) => day.dateKey), ['2026-01-03','2026-01-02','2026-01-01']);
});
