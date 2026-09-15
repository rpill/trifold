import { claimCoinRewardOnce } from './CoinRewards.ts';
import type { PlayerProfileV1 } from '../profile/ProfileTypes.ts';
import type { PurchaseReceipt } from '../../platform/MonetizationGateways.ts';

export const COIN_PACK_PRODUCT_ID = 'trifold_coins_1800';
export const COIN_PACK_AMOUNT = 1800;

export function consumeCoinPackPurchase(profile: PlayerProfileV1, purchase: PurchaseReceipt): PlayerProfileV1 {
  if (purchase.productId !== COIN_PACK_PRODUCT_ID) {
    throw new Error(`Unexpected coin pack product: ${purchase.productId}`);
  }
  if (typeof purchase.purchaseToken !== 'string' || purchase.purchaseToken.length === 0) {
    throw new Error('Purchase token must be non-empty.');
  }
  return claimCoinRewardOnce(profile, `purchase:${purchase.purchaseToken}`, COIN_PACK_AMOUNT);
}
