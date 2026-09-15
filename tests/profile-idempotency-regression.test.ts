import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';
import { settleDailyWin } from '../src/meta/daily/DailyWinSettlement.ts';
import { createRewardDoubleOffer, claimRewardDouble } from '../src/meta/economy/RewardDouble.ts';
import { purchaseTheme } from '../src/meta/economy/ShopService.ts';
import { consumeCoinPackPurchase } from '../src/meta/economy/CoinPack.ts';
import type { PlayerProfileV1 } from '../src/meta/profile/ProfileTypes.ts';

function roundTrip(profile: PlayerProfileV1): PlayerProfileV1 {
  return parsePlayerProfile(JSON.parse(JSON.stringify(profile)));
}

test('Standard first completion and Mastery rank reward survive retry after reload exactly once', () => {
  const prepared: PlayerProfileV1 = {
    ...createDefaultProfile(),
    mastery: {
      rank: 'novice',
      stage: { anyWins: 9, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
    },
  };
  const input = { seed: 91_001, partition: 'hard' as const, difficulty: 'hard' as const, moves: 40, activeMs: 100_000, assisted: false };
  const first = settleStandardWin(prepared, input);
  assert.equal(first.rankAdvancedTo, 'player');
  assert.equal(first.profile.coins, 110);

  const retry = settleStandardWin(roundTrip(first.profile), input);
  assert.equal(retry.baseCoinsGranted, 0);
  assert.equal(retry.rankAdvancedTo, null);
  assert.equal(retry.profile.coins, 110);
  assert.equal(retry.profile.claimedRewardKeys.filter((key) => key === 'mastery-rank:player').length, 1);
});

test('Daily first reward survives retry after reload exactly once', () => {
  const input = { dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 42, activeMs: 300_000 };
  const first = settleDailyWin(createDefaultProfile(), input);
  assert.equal(first.profile.coins, 15);
  const retry = settleDailyWin(roundTrip(first.profile), input);
  assert.equal(retry.coinsGranted, 0);
  assert.equal(retry.profile.coins, 15);
  assert.equal(retry.profile.claimedRewardKeys.filter((key) => key === 'daily:first:2026-09-14').length, 1);
});

test('reward double survives retry after reload exactly once', () => {
  const offer = createRewardDoubleOffer({ seed: 123, difficulty: 'easy', baseCoinsGranted: 5, firstCompletion: true });
  assert.ok(offer);
  const first = claimRewardDouble(createDefaultProfile(), offer);
  assert.equal(first.coins, 5);
  const retry = claimRewardDouble(roundTrip(first), offer);
  assert.equal(retry.coins, 5);
  assert.equal(retry.claimedRewardKeys.filter((key) => key === offer.key).length, 1);
});

test('theme purchase survives retry after reload without a second charge', () => {
  const funded: PlayerProfileV1 = { ...createDefaultProfile(), coins: 600 };
  const first = purchaseTheme(funded, 'launch_01');
  assert.equal(first.status, 'purchased');
  assert.equal(first.profile.coins, 300);
  const retry = purchaseTheme(roundTrip(first.profile), 'launch_01');
  assert.equal(retry.status, 'already-owned');
  assert.equal(retry.profile.coins, 300);
  assert.equal(retry.profile.ownedThemeIds.filter((id) => id === 'launch_01').length, 1);
});

test('coin pack purchase token survives retry after reload exactly once', () => {
  const receipt = { productId: 'trifold_coins_1800', purchaseToken: 'receipt-abc' };
  const first = consumeCoinPackPurchase(createDefaultProfile(), receipt);
  assert.equal(first.coins, 1800);
  const retry = consumeCoinPackPurchase(roundTrip(first), receipt);
  assert.equal(retry.coins, 1800);
  assert.equal(retry.claimedRewardKeys.filter((key) => key === 'purchase:receipt-abc').length, 1);
});
