import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { StandardWinSettlementResult } from '../src/meta/standard/StandardWinSettlement.ts';
import { buildStandardWinViewModel } from '../src/ui/win/StandardWinViewModel.ts';

function settlement(overrides: Partial<StandardWinSettlementResult> = {}): StandardWinSettlementResult {
  return {
    profile: createDefaultProfile(),
    baseCoinsGranted: 5,
    rankAdvancedTo: null,
    masteryAdvanced: true,
    recordAccepted: true,
    firstCompletion: true,
    masteryBefore: { rank: 'novice', stage: { anyWins: 3, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } },
    masteryAfter: { rank: 'novice', stage: { anyWins: 4, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 } },
    masteryWasAlreadyCredited: false,
    ...overrides,
  };
}

test('normal first Standard win shows personal result, coins and double-reward eligibility', () => {
  const vm = buildStandardWinViewModel(settlement(), {
    difficulty: 'easy', moves: 42, activeMs: 65_400, assisted: false,
  });
  assert.equal(vm.title, 'Победа');
  assert.match(vm.resultLine, /42/);
  assert.match(vm.resultLine, /01:05/);
  assert.equal(vm.baseCoins, 5);
  assert.equal(vm.doubleRewardAvailable, true);
  assert.equal(vm.assistedLabel, null);
});

test('assisted win explicitly says Mastery and official record are not credited', () => {
  const vm = buildStandardWinViewModel(settlement({ masteryAdvanced: false, recordAccepted: false }), {
    difficulty: 'medium', moves: 30, activeMs: 30_000, assisted: true,
  });
  assert.match(vm.assistedLabel ?? '', /подсказ/i);
  assert.match(vm.masteryLine, /не засчит/i);
});

test('rank-up win names the new rank and its one-time reward', () => {
  const vm = buildStandardWinViewModel(settlement({ rankAdvancedTo: 'player' }), {
    difficulty: 'easy', moves: 20, activeMs: 20_000, assisted: false,
  });
  assert.match(vm.title, /Игрок/);
  assert.equal(vm.rankRewardCoins, 100);
});

test('repeat completion has no first-completion reward or double action', () => {
  const vm = buildStandardWinViewModel(settlement({ baseCoinsGranted: 0, firstCompletion: false }), {
    difficulty: 'hard', moves: 70, activeMs: 90_000, assisted: false,
  });
  assert.equal(vm.baseCoins, 0);
  assert.equal(vm.doubleRewardAvailable, false);
});


test('win view shows the actual Mastery counter change instead of generic credited copy', () => {
  const vm = buildStandardWinViewModel(settlement(), {
    difficulty: 'easy', moves: 24, activeMs: 199_000, assisted: false,
  });
  assert.match(vm.masteryLine, /Победы: 3 → 4 \/ 10/);
  assert.equal(vm.masteryLine.includes('прогресс засчитан'), false);
});

test('irrelevant Easy win explains why current Mastery did not move', () => {
  const vm = buildStandardWinViewModel(settlement({
    masteryAdvanced: false,
    masteryBefore: { rank: 'player', stage: { anyWins: 0, mediumWins: 4, hardWins: 1, onTimeDailyWins: 0 } },
    masteryAfter: { rank: 'player', stage: { anyWins: 0, mediumWins: 4, hardWins: 1, onTimeDailyWins: 0 } },
  }), { difficulty: 'easy', moves: 20, activeMs: 20_000, assisted: false });
  assert.match(vm.masteryLine, /Лёгкие победы не требуются/i);
});


test('Standard win view model renders English result copy', () => {
  const vm = buildStandardWinViewModel(settlement(), {
    difficulty: 'easy', moves: 42, activeMs: 65_400, assisted: false,
  }, 'en');
  assert.equal(vm.title, 'Victory');
  assert.equal(vm.difficultyLabel, 'Easy');
  assert.equal(vm.resultLine, '42 moves · 01:05');
  assert.match(vm.masteryLine, /Wins: 3 → 4 \/ 10/);
});
