import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { applyTheme, getShopCards, purchaseTheme } from '../src/meta/economy/ShopService.ts';

test('base theme is already owned and cannot be purchased', () => {
  const profile = createDefaultProfile();
  const result = purchaseTheme(profile, 'base');
  assert.equal(result.status, 'free-theme');
  assert.deepEqual(result.profile, profile);
});

test('paid theme costs exactly 300 coins and repeat purchase never charges twice', () => {
  const profile = { ...createDefaultProfile(), coins: 600 };
  const first = purchaseTheme(profile, 'launch_01');
  assert.equal(first.status, 'purchased');
  assert.equal(first.profile.coins, 300);
  assert.deepEqual(first.profile.ownedThemeIds, ['base', 'launch_01']);
  const second = purchaseTheme(first.profile, 'launch_01');
  assert.equal(second.status, 'already-owned');
  assert.equal(second.profile.coins, 300);
});

test('insufficient balance returns without mutation', () => {
  const profile = { ...createDefaultProfile(), coins: 299 };
  const result = purchaseTheme(profile, 'launch_02');
  assert.equal(result.status, 'insufficient-coins');
  assert.deepEqual(result.profile, profile);
});

test('only owned themes can be applied and applying changes only activeThemeId', () => {
  const profile = { ...createDefaultProfile(), coins: 900 };
  const rejected = applyTheme(profile, 'launch_03');
  assert.equal(rejected.status, 'not-owned');
  const purchased = purchaseTheme(profile, 'launch_03');
  assert.equal(purchased.status, 'purchased');
  const applied = applyTheme(purchased.profile, 'launch_03');
  assert.equal(applied.status, 'applied');
  assert.equal(applied.profile.activeThemeId, 'launch_03');
  assert.equal(applied.profile.coins, purchased.profile.coins);
  assert.deepEqual(applied.profile.ownedThemeIds, purchased.profile.ownedThemeIds);
});

test('shop card data exposes exactly one action per launch theme', () => {
  const profile = { ...createDefaultProfile(), coins: 500, ownedThemeIds: ['base', 'launch_02'] as const };
  const cards = getShopCards(profile);
  assert.equal(cards.length, 7);
  assert.deepEqual(cards.map((card) => card.action), ['none', 'buy', 'apply', 'buy', 'buy', 'buy', 'buy']);
  assert.equal(cards[0]?.active, true);
  assert.equal(cards[2]?.owned, true);
});
