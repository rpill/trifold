import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { buildHomeViewModel } from '../src/ui/home/HomeViewModel.ts';

function activeStandard() {
  return {
    version: 1 as const,
    seed: 21,
    partition: 'medium' as const,
    difficulty: 'medium' as const,
    game: {
      version: 1 as const,
      seed: 21,
      snapshot: {
        seed: 21,
        tableau: [[], [], [], [], [], [], [], []],
        freeCells: [
          { kind: 'dragons' as const, family: 'red' as const, cardIds: ['dragon-red-1', 'dragon-red-2', 'dragon-red-3', 'dragon-red-4'] },
          { kind: 'dragons' as const, family: 'green' as const, cardIds: ['dragon-green-1', 'dragon-green-2', 'dragon-green-3', 'dragon-green-4'] },
          { kind: 'dragons' as const, family: 'white' as const, cardIds: ['dragon-white-1', 'dragon-white-2', 'dragon-white-3', 'dragon-white-4'] },
        ],
        foundations: { coins: [], bamboo: [], characters: [] },
        flowerFoundation: null,
      },
      history: { version: 1 as const, entries: [] },
    },
    moves: 12,
    activeMs: 3456,
    assisted: false,
    updatedAtMs: 999,
  };
}

test('Home primary action is Play with remembered difficulty when no save exists', () => {
  const profile = { ...createDefaultProfile(), selectedStandardDifficulty: 'hard' as const };
  const vm = buildHomeViewModel(profile);
  assert.equal(vm.primary.title, 'Играть');
  assert.equal(vm.primary.difficulty, 'hard');
  assert.match(vm.primary.subtitle, /Сложн/i);
});

test('Home primary action becomes Continue and shows saved attempt difficulty', () => {
  const profile = { ...createDefaultProfile(), selectedStandardDifficulty: 'easy' as const, activeStandard: activeStandard() };
  const vm = buildHomeViewModel(profile);
  assert.equal(vm.primary.title, 'Продолжить');
  assert.equal(vm.primary.difficulty, 'medium');
  assert.match(vm.primary.subtitle, /Средн/i);
});

test('Home exposes literal Mastery counters instead of generic XP', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: {
      rank: 'player' as const,
      stage: { anyWins: 0, mediumWins: 4, hardWins: 1, onTimeDailyWins: 0 },
    },
    coins: 125,
    ownedThemeIds: ['base', 'launch_01'] as const,
  };
  const vm = buildHomeViewModel(profile);
  assert.equal(vm.mastery.rank, 'player');
  assert.match(vm.mastery.subtitle, /4 \/ 15/);
  assert.match(vm.mastery.subtitle, /1 \/ 3/);
  assert.equal(vm.coins, 125);
  assert.equal(vm.themes.owned, 2);
  assert.equal(vm.themes.total, 7);
});

test('delivered Home destinations become live while future leaderboards remain disabled', () => {
  const vm = buildHomeViewModel(createDefaultProfile());
  assert.equal(vm.daily.enabled, true);
  assert.equal(vm.themes.enabled, true);
  assert.equal(vm.leaderboardsEnabled, false);
});


test('saved Standard exposes a separate new-deal action using the newly selected difficulty', () => {
  const profile = { ...createDefaultProfile(), selectedStandardDifficulty: 'hard' as const, activeStandard: activeStandard() };
  const vm = buildHomeViewModel(profile);
  assert.equal(vm.primary.title, 'Продолжить');
  assert.equal(vm.primary.difficulty, 'medium');
  assert.equal(vm.newDeal.title, 'Новая раздача');
  assert.equal(vm.newDeal.difficulty, 'hard');
  assert.match(vm.newDeal.subtitle, /Сложн/i);
});

test('Home Daily card is live and preserves current streak before today is played', () => {
  const base = createDefaultProfile();
  const entry = (dateKey: string) => ({
    dateKey, completed: true, completedOnTime: true,
    officialResult: { moves: 40, activeMs: 300_000 }, personalBest: { moves: 40, activeMs: 300_000 },
    firstCompletionRewardClaimed: true,
  } as const);
  const profile = {
    ...base,
    daily: { ...base.daily, history: { '2026-09-12': entry('2026-09-12'), '2026-09-13': entry('2026-09-13') } },
  };
  const vm = buildHomeViewModel(profile, '2026-09-14');
  assert.equal(vm.daily.enabled, true);
  assert.match(vm.daily.subtitle, /2/);
  assert.match(vm.daily.subtitle, /сегодня/i);
});


test('Home view model renders English copy when English is active', () => {
  const vm = buildHomeViewModel({ ...createDefaultProfile(), selectedStandardDifficulty: 'hard' }, '2026-09-14', true, 'en');
  assert.equal(vm.primary.title, 'Play');
  assert.equal(vm.newDeal.title, 'New deal');
  assert.match(vm.primary.subtitle, /Hard/);
  assert.match(vm.daily.subtitle, /Today/);
});
