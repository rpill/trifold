import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCoinPackPurchases } from '../src/platform/PurchaseReconciliation.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { ProfileRepository, type ProfileStore } from '../src/meta/profile/ProfileRepository.ts';
import type { PaymentsGateway } from '../src/platform/MonetizationGateways.ts';

class Store implements ProfileStore {
  profile = createDefaultProfile();
  async load() { return structuredClone(this.profile); }
  async save(profile: typeof this.profile) { this.profile = structuredClone(profile); }
}

test('startup reconciliation grants known coin pack once then consumes it', async () => {
  const store = new Store();
  const repo = await ProfileRepository.open(store);
  const consumed: string[] = [];
  const payments: PaymentsGateway = {
    available: true,
    purchase: async () => ({ productId: 'trifold_coins_1800', purchaseToken: 'unused' }),
    getUnconsumedPurchases: async () => [
      { productId: 'trifold_coins_1800', purchaseToken: 'tok-1' },
      { productId: 'unknown', purchaseToken: 'tok-x' },
    ],
    consume: async (token) => { consumed.push(token); },
  };
  await reconcileCoinPackPurchases(repo, payments);
  assert.equal(repo.current.coins, 1800);
  assert.deepEqual(consumed, ['tok-1']);
  await reconcileCoinPackPurchases(repo, payments);
  assert.equal(repo.current.coins, 1800);
});

test('reconciliation is a no-op when payments unavailable', async () => {
  const repo = await ProfileRepository.open(new Store());
  const payments: PaymentsGateway = {
    available: false,
    purchase: async () => { throw new Error('no'); },
    getUnconsumedPurchases: async () => { throw new Error('must not call'); },
    consume: async () => { throw new Error('must not call'); },
  };
  await reconcileCoinPackPurchases(repo, payments);
  assert.equal(repo.current.coins, 0);
});
