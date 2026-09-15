import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { claimCoinRewardOnce } from '../src/meta/economy/CoinRewards.ts';

test('claimCoinRewardOnce cannot duplicate a retry', () => {
  const p1 = claimCoinRewardOnce(createDefaultProfile(), 'standard:first:easy:42', 5);
  const p2 = claimCoinRewardOnce(p1, 'standard:first:easy:42', 5);
  assert.equal(p2.coins, 5);
  assert.equal(p2.claimedRewardKeys.length, 1);
  assert.equal(p2, p1);
});

test('coin reward rejects invalid amounts and empty keys', () => {
  assert.throws(() => claimCoinRewardOnce(createDefaultProfile(), 'x', -1), /amount/i);
  assert.throws(() => claimCoinRewardOnce(createDefaultProfile(), '', 5), /key/i);
});
