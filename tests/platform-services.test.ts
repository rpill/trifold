import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnavailablePlatformServices,
  type KeyValueStorageLike,
} from '../src/platform/services.ts';

class MemoryStorage implements KeyValueStorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('unavailable services keep guest gameplay usable', async () => {
  const platform = createUnavailablePlatformServices(new MemoryStorage());
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(platform.leaderboards.available, false);
  assert.equal(platform.payments.available, false);
  assert.equal(platform.ads.available, false);
  assert.equal(await platform.ads.showRewarded(), false);
  assert.equal(platform.clock.nowMs(), null);
  assert.equal(platform.pause.isPaused(), false);
});

test('fallback player storage round-trips data without network services', async () => {
  const platform = createUnavailablePlatformServices(new MemoryStorage());
  assert.equal(await platform.storage.scope(), 'guest');
  assert.deepEqual(await platform.storage.load(), {});
  await platform.storage.save({ hello: 'world', count: 3 }, true);
  assert.deepEqual(await platform.storage.load(), { hello: 'world', count: 3 });
});

test('fallback pause subscription and gameplay markup are safe no-ops', () => {
  const platform = createUnavailablePlatformServices(new MemoryStorage());
  let calls = 0;
  const unsubscribe = platform.pause.subscribe(() => { calls += 1; });
  platform.gameplay.start();
  platform.gameplay.start();
  platform.gameplay.stop();
  platform.gameplay.stop();
  unsubscribe();
  assert.equal(calls, 0);
});
