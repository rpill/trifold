import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { COIN_PACK_AMOUNT, COIN_PACK_PRODUCT_ID, consumeCoinPackPurchase } from '../src/meta/economy/CoinPack.ts';

test('launch coin pack grants exactly 1800 coins', () => {
  assert.equal(COIN_PACK_AMOUNT, 1800);
  assert.equal(COIN_PACK_PRODUCT_ID, 'trifold_coins_1800');
});

test('coin pack accepts only expected product and same token cannot grant twice', () => {
  const profile = createDefaultProfile();
  assert.throws(() => consumeCoinPackPurchase(profile, { productId: 'wrong', purchaseToken: 'a' }), /product/i);
  const first = consumeCoinPackPurchase(profile, { productId: COIN_PACK_PRODUCT_ID, purchaseToken: 'token-1' });
  assert.equal(first.coins, 1800);
  assert.ok(first.claimedRewardKeys.includes('purchase:token-1'));
  const second = consumeCoinPackPurchase(first, { productId: COIN_PACK_PRODUCT_ID, purchaseToken: 'token-1' });
  assert.equal(second.coins, 1800);
});
