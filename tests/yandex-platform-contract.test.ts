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

function baseSdk(overrides: Record<string, unknown> = {}) {
  return {
    getPlayer: async () => fakePlayer(false).player,
    serverTime: () => 123456,
    isAvailableMethod: async () => true,
    auth: { openAuthDialog: async () => undefined },
    ...overrides,
  };
}

test('Yandex storage/auth reacquires player after authorization and exposes trusted time', async () => {
  const first = fakePlayer(false);
  const second = fakePlayer(true);
  let gets = 0;
  let authCalls = 0;
  const sdk = baseSdk({
    getPlayer: async () => (++gets === 1 ? first.player : second.player),
    auth: { openAuthDialog: async () => { authCalls += 1; } },
    environment: { i18n: { lang: 'ru' } },
  });
  const platform = await createYandexPlatformServices(sdk as any);
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(await platform.auth.requestAuthorization(), true);
  assert.equal(authCalls, 1);
  assert.equal(platform.auth.isAuthorized(), true);
  assert.equal(await platform.playerStorage.scope?.(), 'yandex-user-1');
  await platform.playerStorage.save({ meta: { version: 1 } }, true);
  assert.deepEqual(await platform.playerStorage.load(), { meta: { version: 1 } });
  assert.equal(platform.trustedClock.nowMs(), 123456);
  assert.equal(platform.language, 'ru');
});

test('leaderboard player-not-present is null and Yandex ranks remain one-based', async () => {
  const sdk = baseSdk({
    getPlayer: async () => fakePlayer(true).player,
    leaderboards: {
      getEntries: async () => ({ entries: [{
        score: 42, rank: 1, player: { publicName: 'Alex', uniqueID: 'u1', getAvatarSrc: () => 'avatar.png' },
      }] }),
      getPlayerEntry: async () => { throw { code: 'LEADERBOARD_PLAYER_NOT_PRESENT' }; },
      setScore: async () => undefined,
    },
  });
  const platform = await createYandexPlatformServices(sdk as any);
  const rows = await platform.leaderboards.getEntries('x', { quantityTop: 10 });
  assert.equal(rows[0]?.rank, 1);
  assert.equal(rows[0]?.publicName, 'Alex');
  assert.equal(await platform.leaderboards.getPlayerEntry('x'), null);
});

test('missing ad API is unavailable and interstitial errors are fail-soft', async () => {
  const unavailable = await createYandexPlatformServices(baseSdk() as any);
  assert.equal(unavailable.ads.available, false);
  assert.equal(await unavailable.ads.showInterstitial(), false);

  const failing = await createYandexPlatformServices(baseSdk({
    adv: { showFullscreenAdv: () => { throw new Error('ad fail'); } },
  }) as any);
  assert.equal(failing.ads.available, true);
  assert.equal(await failing.ads.showInterstitial(), false);
});

test('LoadingAPI ready is one-shot and pause follows sdk events', async () => {
  const listeners = new Map<string, Set<() => void>>();
  let readyCalls = 0;
  const sdk = baseSdk({
    features: { LoadingAPI: { ready: () => { readyCalls += 1; } } },
    on: (name: string, fn: () => void) => {
      const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set);
    },
    off: (name: string, fn: () => void) => listeners.get(name)?.delete(fn),
  });
  const platform = await createYandexPlatformServices(sdk as any);
  platform.ready();
  platform.ready();
  assert.equal(readyCalls, 1);
  const states: boolean[] = [];
  const unsubscribe = platform.platformPause.subscribe((paused) => states.push(paused));
  for (const fn of listeners.get('game_api_pause') ?? []) fn();
  for (const fn of listeners.get('game_api_resume') ?? []) fn();
  unsubscribe();
  assert.deepEqual(states, [true, false]);
});

test('Yandex SDK loading policy uses HTTPS production/dev proxy and plain local dev remains guest', async () => {
  assert.equal(shouldAttemptYandexSdkLoad('localhost', false), false);
  assert.equal(shouldAttemptYandexSdkLoad('127.0.0.1', false), false);
  assert.equal(shouldAttemptYandexSdkLoad('localhost', true), true);
  assert.equal(shouldAttemptYandexSdkLoad('games.yandex.ru', false), true);
  const platform = await loadPlatformServices();
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(platform.ads.available, false);
});
