import type { PlayerProfileV1 } from '../profile/ProfileTypes.ts';

export function claimCoinRewardOnce(
  profile: PlayerProfileV1,
  key: string,
  amount: number,
): PlayerProfileV1 {
  if (typeof key !== 'string' || key.length === 0) throw new Error('Reward key must be non-empty.');
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Reward amount must be a non-negative integer.');
  if (profile.claimedRewardKeys.includes(key)) return profile;
  if (!Number.isSafeInteger(profile.coins + amount)) throw new Error('Coin balance exceeds safe integer range.');
  return {
    ...profile,
    coins: profile.coins + amount,
    claimedRewardKeys: [...profile.claimedRewardKeys, key],
  };
}
