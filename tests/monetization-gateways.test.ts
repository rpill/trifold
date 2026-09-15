import test from 'node:test';
import assert from 'node:assert/strict';
import { UnavailablePaymentsGateway, UnavailableRewardedAdGateway, MonetizationUnavailableError } from '../src/platform/MonetizationGateways.ts';

test('unavailable rewarded ad gateway fails closed without crashing gameplay', async () => {
  const gateway = new UnavailableRewardedAdGateway();
  assert.equal(gateway.available, false);
  assert.equal(await gateway.showRewarded(), false);
});

test('unavailable payments gateway reports unavailable and rejects purchase with typed error', async () => {
  const gateway = new UnavailablePaymentsGateway();
  assert.equal(gateway.available, false);
  await assert.rejects(() => gateway.purchase('coins_1800'), MonetizationUnavailableError);
  assert.deepEqual(await gateway.getUnconsumedPurchases(), []);
  await assert.rejects(() => gateway.consume('token'), MonetizationUnavailableError);
});
