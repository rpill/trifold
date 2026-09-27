import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserPlayerStorage,
  createUnavailablePlatformServices,
  type BrowserStorageLike,
} from '../src/platform/services.ts';

class MemoryStorage implements BrowserStorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('unavailable Cascade-style services keep local gameplay usable', async () => {
  const platform = createUnavailablePlatformServices(new MemoryStorage());
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(await platform.auth.requestAuthorization(), false);
  assert.equal(platform.leaderboards.available, false);
  assert.equal(platform.ads.available, false);
  assert.equal(await platform.ads.showInterstitial(), false);
  assert.equal(platform.trustedClock.nowMs(), null);
  assert.equal(platform.platformPause.isPaused(), false);
  assert.doesNotThrow(() => platform.ready());
  assert.equal('payments' in platform, false);
  assert.equal('rewardedAds' in platform, false);
});

test('browser player storage uses trifoldPlayerData and supports strict and fail-soft reads', async () => {
  const storage = new MemoryStorage();
  const playerStorage = createBrowserPlayerStorage(storage);
  assert.equal(await playerStorage.scope?.(), 'browser-local');
  assert.deepEqual(await playerStorage.load(), {});
  await playerStorage.save({ hello: 'world', count: 3 }, true);
  assert.deepEqual(await playerStorage.loadStrict?.(), { hello: 'world', count: 3 });
  assert.ok(storage.values.has('trifoldPlayerData'));

  storage.values.set('trifoldPlayerData', '{broken');
  await assert.rejects(async () => playerStorage.loadStrict?.());
  assert.deepEqual(await playerStorage.load(), { hello: 'world', count: 3 }, 'soft load preserves last valid memory state');
});

test('fallback auth subscription, pause and gameplay markup are safe no-ops', () => {
  const platform = createUnavailablePlatformServices(new MemoryStorage());
  let accountEvents = 0;
  const offAccount = platform.auth.onAccountSelectionClosed(() => { accountEvents += 1; });
  let pauseEvents = 0;
  const offPause = platform.platformPause.subscribe(() => { pauseEvents += 1; });
  platform.gameplay.start();
  platform.gameplay.start();
  platform.gameplay.stop();
  platform.gameplay.stop();
  offAccount();
  offPause();
  assert.equal(accountEvents, 0);
  assert.equal(pauseEvents, 0);
});
