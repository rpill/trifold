import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { buildDailyViewModel, dailyCellState } from '../src/ui/daily/DailyViewModel.ts';

const catalog = { metadata: { dailyScheduleStart: '2026-01-01', dailyScheduleLength: 7305 } };
test('Daily view model exposes streak, today CTA and archive from MetaSave', () => {
  const vm = buildDailyViewModel(createDefaultMetaSave(), null, '2026-09-14', catalog);
  assert.equal(vm.currentStreak, 0);
  assert.equal(vm.today.ctaLabel, 'Играть сегодня');
  assert.equal(vm.archive.length, 90);
  assert.equal(dailyCellState(vm, '2026-09-15'), 'future');
});
test('active Daily save controls Continue while product records remain in MetaSave', () => {
  const base = createDefaultMetaSave();
  const state = { ...base, daily:{ ...base.daily, records:{ '2026-09-13':{completed:true,completedOnTime:true,attempts:1}, '2026-09-12':{completed:true,completedOnTime:true,attempts:1} } } };
  const vm = buildDailyViewModel(state, '2026-09-14', '2026-09-14', catalog);
  assert.equal(vm.currentStreak, 2);
  assert.equal(vm.activeDateKey, '2026-09-14');
  assert.equal(vm.today.ctaLabel, 'Продолжить');
});
test('completed on-time and archive have different cell states and English CTA works', () => {
  const base = createDefaultMetaSave();
  const state = { ...base, daily:{...base.daily,records:{ '2026-09-13':{completed:true,completedOnTime:true,attempts:1}, '2026-09-12':{completed:true,completedOnTime:false,attempts:1} } } };
  const vm = buildDailyViewModel(state, null, '2026-09-14', catalog, 'en');
  assert.equal(vm.today.ctaLabel, 'Play today');
  assert.equal(dailyCellState(vm,'2026-09-13'),'completed-on-time');
  assert.equal(dailyCellState(vm,'2026-09-12'),'completed-archive');
});
