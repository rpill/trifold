import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { buildDailyCalendar } from '../src/meta/daily/DailyCalendarViewModel.ts';

test('calendar exposes exactly 90 visible days when schedule covers window', () => {
  const days = buildDailyCalendar(createDefaultProfile(), '2026-09-14', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  });
  assert.equal(days.length, 90);
  assert.equal(days[0]?.dateKey, '2026-09-14');
  assert.equal(days[0]?.status, 'today-open');
  assert.equal(days[0]?.rewardCoinsIfFirstWin, 15);
  assert.equal(days.at(-1)?.rewardCoinsIfFirstWin, 5);
});

test('calendar distinguishes on-time and late archive completion', () => {
  const profile = createDefaultProfile();
  const history = {
    '2026-09-13': {
      dateKey: '2026-09-13', completed: true, completedOnTime: true,
      officialResult: { moves: 42, activeMs: 300_000 }, personalBest: { moves: 40, activeMs: 290_000 },
      firstCompletionRewardClaimed: true,
    },
    '2026-09-12': {
      dateKey: '2026-09-12', completed: true, completedOnTime: false,
      officialResult: null, personalBest: { moves: 50, activeMs: 400_000 },
      firstCompletionRewardClaimed: true,
    },
  } as const;
  const days = buildDailyCalendar({ ...profile, daily: { ...profile.daily, history } }, '2026-09-14', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  });
  assert.equal(days.find((day) => day.dateKey === '2026-09-13')?.status, 'archive-complete-on-time');
  assert.equal(days.find((day) => day.dateKey === '2026-09-12')?.status, 'archive-complete-late');
  assert.deepEqual(days.find((day) => day.dateKey === '2026-09-13')?.officialResult, { moves: 42, activeMs: 300_000 });
  assert.deepEqual(days.find((day) => day.dateKey === '2026-09-13')?.personalBest, { moves: 40, activeMs: 290_000 });
});

test('calendar marks completed today separately', () => {
  const profile = createDefaultProfile();
  const entry = {
    dateKey: '2026-09-14', completed: true, completedOnTime: true,
    officialResult: { moves: 42, activeMs: 300_000 }, personalBest: { moves: 42, activeMs: 300_000 },
    firstCompletionRewardClaimed: true,
  } as const;
  const days = buildDailyCalendar({ ...profile, daily: { ...profile.daily, history: { '2026-09-14': entry } } }, '2026-09-14', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  });
  assert.equal(days[0]?.status, 'today-complete');
  assert.equal(days[0]?.rewardCoinsIfFirstWin, 0);
});

test('dates before catalog start are not emitted', () => {
  const days = buildDailyCalendar(createDefaultProfile(), '2026-01-03', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  });
  assert.deepEqual(days.map((day) => day.dateKey), ['2026-01-03', '2026-01-02', '2026-01-01']);
});
