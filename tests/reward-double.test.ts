import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { claimRewardDouble, createRewardDoubleOffer } from '../src/meta/economy/RewardDouble.ts';

test('eligible Standard first-completion offer equals only the base reward', () => {
  const offer = createRewardDoubleOffer({ seed: 42, difficulty: 'hard', baseCoinsGranted: 10, firstCompletion: true });
  assert.deepEqual(offer, { key: 'reward-double:standard:42', bonusCoins: 10 });
});

test('repeat and zero-base wins produce no offer', () => {
  assert.equal(createRewardDoubleOffer({ seed: 42, difficulty: 'hard', baseCoinsGranted: 0, firstCompletion: false }), null);
  assert.equal(createRewardDoubleOffer({ seed: 42, difficulty: 'hard', baseCoinsGranted: 0, firstCompletion: true }), null);
});

test('claim is durable and idempotent', () => {
  const profile = createDefaultProfile();
  const offer = createRewardDoubleOffer({ seed: 7, difficulty: 'medium', baseCoinsGranted: 7, firstCompletion: true });
  assert.ok(offer);
  const first = claimRewardDouble(profile, offer);
  assert.equal(first.coins, 7);
  assert.ok(first.claimedRewardKeys.includes('reward-double:standard:7'));
  const second = claimRewardDouble(first, offer);
  assert.equal(second.coins, 7);
});
