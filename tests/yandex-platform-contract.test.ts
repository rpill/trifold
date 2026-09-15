import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createYandexPlatformServices,
  loadPlatformServices,
  shouldAttemptYandexSdkLoad,
} from '../src/platform/yandex.ts';

function fakePlayer(initialAuthorized = false) {
  let authorized = initialAuthorized;
  let data: Record<string, unknown> = {};
  return {
    player: {
      isAuthorized: () => authorized,
      getUniqueID: () => authorized ? 'user-1' : 'guest-1',
      getData: async () => ({ ...data }),
      setData: async (next: Record<string, unknown>) => { data = { ...next }; },
    },
    authorize: () => { authorized = true; },
    data: () => ({ ...data }),
  };
}

test('Yandex storage/auth refreshes player after openAuthDialog', async () => {
  const first = fakePlayer(false);
  const second = fakePlayer(true);
  let gets = 0;
  let authCalls = 0;
  const sdk = {
    getPlayer: async () => (++gets === 1 ? first.player : second.player),
    auth: { openAuthDialog: async () => { authCalls += 1; } },
    serverTime: () => 123456,
    environment: { i18n: { lang: 'ru' } },
  };
  const platform = await createYandexPlatformServices(sdk);
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(await platform.auth.requestAuthorization(), true);
  assert.equal(authCalls, 1);
  assert.equal(platform.auth.isAuthorized(), true);
  assert.equal(await platform.storage.scope(), 'yandex:user-1');
  await platform.storage.save({ profile: { version: 1 } }, true);
  assert.deepEqual(await platform.storage.load(), { profile: { version: 1 } });
  assert.equal(platform.clock.nowMs(), 123456);
  assert.equal(platform.language, 'ru');
});

test('rewarded resolves true only when onRewarded fired', async () => {
  let callbacks: any = null;
  const sdk = {
    getPlayer: async () => fakePlayer(true).player,
    adv: { showRewardedVideo: (input: any) => { callbacks = input.callbacks; } },
  };
  const platform = await createYandexPlatformServices(sdk);
  const result = platform.ads.showRewarded();
  callbacks.onClose(true);
  assert.equal(await result, false);

  const result2 = platform.ads.showRewarded();
  callbacks.onRewarded();
  callbacks.onClose(true);
  assert.equal(await result2, true);
});

test('payments normalize productID and purchaseToken', async () => {
  const sdk = {
    getPlayer: async () => fakePlayer(true).player,
    payments: {
      purchase: async ({ id }: { id: string }) => ({ productID: id, purchaseToken: 'tok-1' }),
      getPurchases: async () => [{ productID: 'trifold_coins_1800', purchaseToken: 'tok-2' }],
      consumePurchase: async () => undefined,
    },
  };
  const platform = await createYandexPlatformServices(sdk);
  assert.deepEqual(await platform.payments.purchase('trifold_coins_1800'), {
    productId: 'trifold_coins_1800', purchaseToken: 'tok-1',
  });
  assert.deepEqual(await platform.payments.getUnconsumedPurchases(), [{
    productId: 'trifold_coins_1800', purchaseToken: 'tok-2',
  }]);
});

test('leaderboards preserve Yandex one-based ranks without adding one again', async () => {
  const sdk = {
    getPlayer: async () => fakePlayer(true).player,
    leaderboards: {
      getEntries: async () => ({ userRank: 1, entries: [{
        score: 42, rank: 1, extraData: 'x', player: {
          publicName: 'Alex', uniqueID: 'u1', getAvatarSrc: () => 'avatar.png',
        },
      }] }),
      getPlayerEntry: async () => ({
        score: 42, rank: 1, extraData: '', player: { publicName: 'Alex', uniqueID: 'u1' },
      }),
      setScore: async () => undefined,
    },
  };
  const platform = await createYandexPlatformServices(sdk);
  const rows = await platform.leaderboards.getEntries('x');
  assert.equal(rows.entries[0]?.rank, 1);
  assert.equal(rows.userRank, 1);
  assert.equal(rows.entries[0]?.publicName, 'Alex');
  assert.equal((await platform.leaderboards.getPlayerEntry('x'))?.rank, 1);
});

test('LoadingAPI ready is called once and platform pause follows sdk events', async () => {
  const listeners = new Map<string, () => void>();
  let readyCalls = 0;
  const sdk = {
    getPlayer: async () => fakePlayer(false).player,
    features: { LoadingAPI: { ready: () => { readyCalls += 1; } } },
    on: (name: string, fn: () => void) => listeners.set(name, fn),
    off: (name: string) => listeners.delete(name),
  };
  const platform = await createYandexPlatformServices(sdk);
  await platform.ready;
  assert.equal(readyCalls, 0);
  await platform.signalReady();
  await platform.signalReady();
  assert.equal(readyCalls, 1);
  const states: boolean[] = [];
  const unsubscribe = platform.pause.subscribe((paused) => states.push(paused));
  listeners.get('game_api_pause')?.();
  listeners.get('game_api_resume')?.();
  unsubscribe();
  assert.deepEqual(states, [true, false]);
});

test('Yandex SDK loading can be enabled explicitly on localhost for the dev proxy', () => {
  assert.equal(shouldAttemptYandexSdkLoad('localhost', false), false);
  assert.equal(shouldAttemptYandexSdkLoad('127.0.0.1', false), false);
  assert.equal(shouldAttemptYandexSdkLoad('localhost', true), true);
  assert.equal(shouldAttemptYandexSdkLoad('127.0.0.1', true), true);
  assert.equal(shouldAttemptYandexSdkLoad('games.yandex.ru', false), true);
});

test('plain local development stays in guest mode without trying to read Vite-only env state', async () => {
  const originalWarn = console.warn;
  let warnings = 0;
  console.warn = () => { warnings += 1; };
  try {
    const platform = await loadPlatformServices();
    assert.equal(platform.language, null);
    assert.equal(platform.auth.isAuthorized(), false);
    assert.equal(warnings, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test('Yandex auth exposes availability only when openAuthDialog is provided', async () => {
  const withAuth = await createYandexPlatformServices({
    getPlayer: async () => fakePlayer(false).player,
    auth: { openAuthDialog: async () => undefined },
  });
  const withoutAuth = await createYandexPlatformServices({
    getPlayer: async () => fakePlayer(false).player,
  });

  assert.equal(withAuth.auth.available, true);
  assert.equal(withoutAuth.auth.available, false);
});

test('Yandex authorization failure is logged instead of being swallowed', async () => {
  const platform = await createYandexPlatformServices({
    getPlayer: async () => fakePlayer(false).player,
    auth: { openAuthDialog: async () => { throw new Error('mock auth failed'); } },
  });
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    assert.equal(await platform.auth.requestAuthorization(), false);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.equal(String(warnings[0]?.[0]), '[Trifold] Yandex authorization failed.');
  assert.match(String(warnings[0]?.[1]), /mock auth failed/);
});
