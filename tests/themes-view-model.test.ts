import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { buildThemesViewModel } from '../src/ui/themes/ThemesViewModel.ts';

test('Themes view model exposes exactly seven launch cards and one action per card', () => {
  const profile = {
    ...createDefaultProfile(),
    coins: 650,
    ownedThemeIds: ['base', 'launch_02'] as const,
    activeThemeId: 'launch_02' as const,
  };
  const vm = buildThemesViewModel(profile);
  assert.equal(vm.coins, 650);
  assert.equal(vm.cards.length, 7);
  assert.equal(vm.cards.filter((card) => card.priceCoins === 0).length, 1);
  assert.equal(vm.cards.filter((card) => card.priceCoins === 300).length, 6);
  assert.deepEqual(vm.cards.map((card) => card.action), ['apply', 'buy', 'none', 'buy', 'buy', 'buy', 'buy']);
});
