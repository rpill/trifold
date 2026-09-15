import { claimCoinRewardOnce } from './CoinRewards.ts';
import type { StandardDifficulty } from '../profile/ProfileTypes.ts';
import type { PlayerProfileV1 } from '../profile/ProfileTypes.ts';

export interface RewardDoubleSource {
  readonly seed: number;
  readonly difficulty: StandardDifficulty;
  readonly baseCoinsGranted: number;
  readonly firstCompletion: boolean;
}

export interface RewardDoubleOffer {
  readonly key: string;
  readonly bonusCoins: number;
}

export function createRewardDoubleOffer(source: RewardDoubleSource): RewardDoubleOffer | null {
  if (!source.firstCompletion || !Number.isSafeInteger(source.baseCoinsGranted) || source.baseCoinsGranted <= 0) return null;
  if (!Number.isSafeInteger(source.seed) || source.seed < 1) throw new Error('Standard seed must be a positive integer.');
  return {
    key: `reward-double:standard:${source.seed}`,
    bonusCoins: source.baseCoinsGranted,
  };
}

export function claimRewardDouble(profile: PlayerProfileV1, offer: RewardDoubleOffer): PlayerProfileV1 {
  return claimCoinRewardOnce(profile, offer.key, offer.bonusCoins);
}
