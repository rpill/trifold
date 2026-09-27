import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { TrifoldProductSnapshot } from '../src/ui/bridge/TrifoldProductBridge.ts';
import { buildHomeViewModel } from '../src/ui/home/HomeViewModel.ts';

function snapshot(overrides: Partial<TrifoldProductSnapshot> = {}): TrifoldProductSnapshot {
  return {
    state: createDefaultMetaSave(),
    activeMode: null,
    activeDifficulty: null,
    currentDailyId: '2026-09-14',
    activeDailyId: null,
    leaderboardsEnabled: false,
    ...overrides,
  };
}

test('Home primary action is Play with remembered difficulty when no Standard save exists', () => {
  const base = createDefaultMetaSave();
  const vm = buildHomeViewModel(snapshot({ state: { ...base, standard: { ...base.standard, selectedDifficulty: 'hard' } } }));
  assert.equal(vm.primary.title, 'Играть');
  assert.equal(vm.primary.difficulty, 'hard');
  assert.match(vm.primary.subtitle, /Сложн/i);
});

test('Home primary action becomes Continue and shows active Standard difficulty', () => {
  const base = createDefaultMetaSave();
  const vm = buildHomeViewModel(snapshot({
    state: { ...base, standard: { ...base.standard, selectedDifficulty: 'easy' } },
    activeMode: 'standard', activeDifficulty: 'medium',
  }));
  assert.equal(vm.primary.title, 'Продолжить');
  assert.equal(vm.primary.difficulty, 'medium');
  assert.equal(vm.primary.hasActiveGame, true);
  assert.match(vm.primary.subtitle, /Средн/i);
});

test('Home exposes literal Mastery counters instead of generic XP', () => {
  const base = createDefaultMetaSave();
  const vm = buildHomeViewModel(snapshot({ state: {
    ...base,
    mastery: { rank: 'player', stage: { anyWins: 0, mediumWins: 4, hardWins: 1, onTimeDailyWins: 0 } },
  } }));
  assert.equal(vm.mastery.rank, 'player');
  assert.match(vm.mastery.subtitle, /4 \/ 15/);
  assert.match(vm.mastery.subtitle, /1 \/ 3/);
});

test('Home Daily card uses MetaSave streak and active Daily identity', () => {
  const base = createDefaultMetaSave();
  const state = { ...base, daily: { ...base.daily, records: {
    '2026-09-12': { completed: true, completedOnTime: true, attempts: 1 },
    '2026-09-13': { completed: true, completedOnTime: true, attempts: 1 },
  } } };
  const vm = buildHomeViewModel(snapshot({ state, activeMode: 'daily', activeDailyId: '2026-09-14' }));
  assert.equal(vm.daily.enabled, true);
  assert.match(vm.daily.subtitle, /2/);
  assert.match(vm.daily.subtitle, /продолж/i);
});

test('Home Leaders remains a live product destination even when the SDK leaderboard is unavailable', () => {
  const unavailable = buildHomeViewModel(snapshot());
  const available = buildHomeViewModel(snapshot({ leaderboardsEnabled: true }));
  assert.equal(unavailable.leaders.enabled, true);
  assert.equal(available.leaders.enabled, true);
  assert.notEqual(unavailable.leaders.subtitle, available.leaders.subtitle);
});

test('Home view model renders English copy from the same product snapshot', () => {
  const base = createDefaultMetaSave();
  const vm = buildHomeViewModel(snapshot({ state: { ...base, standard: { ...base.standard, selectedDifficulty: 'hard' } } }), 'en');
  assert.equal(vm.primary.title, 'Play');
  assert.equal(vm.newDeal.title, 'New deal');
  assert.match(vm.primary.subtitle, /Hard/);
  assert.match(vm.daily.subtitle, /Today/);
});

test('Home primary resumes an active Daily as the highest-priority unfinished game', () => {
  const vm = buildHomeViewModel(snapshot({ activeMode: 'daily', activeDailyId: '2026-09-14' }));
  assert.equal(vm.primary.hasActiveGame, true);
  assert.equal(vm.primary.title, 'Продолжить');
  assert.equal(vm.primary.subtitle, 'Daily');
});
