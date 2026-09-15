import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { buildDailyViewModel, dailyCellState } from '../src/ui/daily/DailyViewModel.ts';

test('Daily view model exposes current streak, today CTA and 90-day archive', () => {
  const profile = createDefaultProfile();
  const vm = buildDailyViewModel(profile, '2026-09-14', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  });
  assert.equal(vm.currentStreak, 0);
  assert.equal(vm.today.ctaLabel, 'Играть сегодня');
  assert.equal(vm.archive.length, 90);
  assert.equal(dailyCellState(vm, '2026-09-14'), 'today');
  assert.equal(dailyCellState(vm, '2026-09-15'), 'future');
});

test('unplayed today preserves yesterday streak and active today becomes Continue', () => {
  const base = createDefaultProfile();
  const onTime = (dateKey: string) => ({
    dateKey, completed: true, completedOnTime: true,
    officialResult: { moves: 40, activeMs: 300_000 }, personalBest: { moves: 40, activeMs: 300_000 },
    firstCompletionRewardClaimed: true,
  } as const);
  const profile = {
    ...base,
    daily: {
      ...base.daily,
      history: { '2026-09-12': onTime('2026-09-12'), '2026-09-13': onTime('2026-09-13') },
      active: {
        version: 1 as const, dailyDateKey: '2026-09-14', seed: 1,
        game: { version: 1 as const, seed: 1, snapshot: { seed: 1, tableau: [[],[],[],[],[],[],[],[]], freeCells: [{kind:'empty' as const},{kind:'empty' as const},{kind:'empty' as const}], foundations: { coins: [], bamboo: [], characters: [] }, flowerFoundation: null }, history: { version: 1 as const, entries: [] } },
        moves: 2, activeMs: 1000, updatedAtMs: 1,
      },
    },
  };
  const vm = buildDailyViewModel(profile, '2026-09-14', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  });
  assert.equal(vm.currentStreak, 2);
  assert.equal(vm.today.ctaLabel, 'Продолжить');
});

test('completed on-time and completed archive have different calendar cell states', () => {
  const base = createDefaultProfile();
  const profile = {
    ...base,
    daily: {
      ...base.daily,
      history: {
        '2026-09-13': { dateKey: '2026-09-13', completed: true, completedOnTime: true, officialResult: { moves: 42, activeMs: 1 }, personalBest: { moves: 42, activeMs: 1 }, firstCompletionRewardClaimed: true },
        '2026-09-12': { dateKey: '2026-09-12', completed: true, completedOnTime: false, officialResult: null, personalBest: { moves: 50, activeMs: 2 }, firstCompletionRewardClaimed: true },
      },
    },
  };
  const vm = buildDailyViewModel(profile, '2026-09-14', { metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 } });
  assert.equal(dailyCellState(vm, '2026-09-13'), 'completed-on-time');
  assert.equal(dailyCellState(vm, '2026-09-12'), 'completed-archive');
  assert.equal(dailyCellState(vm, '2026-08-01'), 'missed');
});


test('Daily view model renders English CTA', () => {
  const vm = buildDailyViewModel(createDefaultProfile(), '2026-09-14', {
    metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 },
  }, 'en');
  assert.equal(vm.today.ctaLabel, 'Play today');
});
