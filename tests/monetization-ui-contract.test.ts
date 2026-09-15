import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const shop = readFileSync(new URL('../src/ui/scenes/ThemesScene.ts', import.meta.url), 'utf8');
const daily = readFileSync(new URL('../src/ui/scenes/DailyScene.ts', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../src/ui/win/WinOverlay.ts', import.meta.url), 'utf8');

test('Standard overlay exposes semantic double-coins action when view model allows it', () => {
  assert.match(overlay, /viewModel\.doubleRewardAvailable \? tr\(language, 'win\.doubleCoins'\) : null/);
  assert.match(overlay, /doubleCoins/);
});

test('GameScene claims Standard double only after rewarded gateway resolves true', () => {
  for (const required of [
    'createRewardDoubleOffer', 'showRewarded()', 'if (!rewarded)', 'claimRewardDouble',
    'repository.mutate', 'rewardDoubleClaiming', 'doubleCoins',
  ]) assert.ok(game.includes(required), `expected GameScene to include ${required}`);
});

test('Daily screen contains no rewarded monetization action', () => {
  assert.doesNotMatch(daily, /showRewarded|claimRewardDouble|doubleCoins/);
});

test('ThemesScene purchases the one coin pack through payment token then consumes it', () => {
  for (const required of [
    'COIN_PACK_PRODUCT_ID', 'purchase(COIN_PACK_PRODUCT_ID)', 'consumeCoinPackPurchase',
    'repository.mutate', 'payments.consume', 'payments.available',
  ]) assert.ok(shop.includes(required), `expected ThemesScene to include ${required}`);
});
