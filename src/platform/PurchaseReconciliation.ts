import { COIN_PACK_PRODUCT_ID, consumeCoinPackPurchase } from '../meta/economy/CoinPack.ts';
import type { ProfileRepository } from '../meta/profile/ProfileRepository.ts';
import type { PaymentsGateway } from './MonetizationGateways.ts';

export async function reconcileCoinPackPurchases(
  repository: ProfileRepository,
  payments: PaymentsGateway,
): Promise<void> {
  if (!payments.available) return;
  let purchases;
  try {
    purchases = await payments.getUnconsumedPurchases();
  } catch {
    return;
  }
  for (const purchase of purchases) {
    if (purchase.productId !== COIN_PACK_PRODUCT_ID) continue;
    try {
      await repository.mutate((profile) => consumeCoinPackPurchase(profile, purchase));
      await payments.consume(purchase.purchaseToken);
    } catch (error) {
      console.warn('[Trifold] purchase reconciliation deferred', error);
    }
  }
}
