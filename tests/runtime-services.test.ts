import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import { createRuntimeServices, getRuntimeServices, installRuntimeServices } from '../src/meta/RuntimeServices.ts';
import { createUnavailablePlatformServices, type PlayerStorage } from '../src/platform/services.ts';
import { createLegacyProfileFixture } from './fixtures/legacy-profile-v1.ts';

function fixtureCatalog(): VerifiedDealCatalog {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  [11, 21, 31, 41, 51].forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion: 2, rulesVersion: 1, shuffleVersion: 1, seedEncoding: 'uint32-le',
    difficultyModelVersion: 1, dailyAlgorithmVersion: 1,
    standardCounts: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    dailyScheduleStart: '2026-01-01', dailyScheduleLength: 1, verifiedCount: 5,
    crossPoolDuplicateCount: 0, rejectedVerificationCount: 0,
    fastNodeBudget: 100, slowNodeBudget: 1000, sourceScanRanges: [],
    solverSourceHash: 'solver', gameRulesSourceHash: 'rules', productionAssetHash: 'hash',
    offsets: {
      onboarding: { byteOffset: 0, count: 1 }, easy: { byteOffset: 4, count: 1 },
      medium: { byteOffset: 8, count: 1 }, hard: { byteOffset: 12, count: 1 },
      daily: { byteOffset: 16, count: 1 },
    },
  });
}

test('runtime services initialize MetaSession as the only product profile authority', async () => {
  const catalog = fixtureCatalog();
  const services = await createRuntimeServices({
    catalogLoader: async () => catalog,
  });
  installRuntimeServices(services);
  assert.equal(getRuntimeServices(), services);
  assert.equal(services.catalog, catalog);
  assert.equal(services.metaSession.state.version, 1);
  assert.equal(services.metaSession.state.standard.selectedDifficulty, 'easy');
  assert.equal(services.activeGames.load(), null);
  assert.equal('repository' in services, false);
  assert.equal(getRuntimeServices().metaSession, services.metaSession);
  assert.equal('rewardedAds' in services, false);
  assert.equal('payments' in services, false);
});


test('runtime language follows Yandex until explicit Preferences override wins immediately', async () => {
  const basePlatform = createUnavailablePlatformServices(null);
  const services = await createRuntimeServices({
    catalogLoader: async () => fixtureCatalog(),
    platform: { ...basePlatform, language: 'en-US' },
  });
  assert.equal(services.language, 'en');
  services.preferences.setLanguage('ru');
  assert.equal(services.language, 'ru');
});


test('runtime keeps migrated legacy meta in memory when first persistence write fails', async () => {
  const legacyProfile = createLegacyProfileFixture();
  const legacyStorage = {
    getItem(key: string): string | null {
      return key === 'trifoldPlayerProfile' ? JSON.stringify(legacyProfile) : null;
    },
  };
  const playerStorage: PlayerStorage = {
    scope: async () => 'offline-player',
    loadStrict: async () => ({}),
    saveStrict: async () => { throw new Error('offline'); },
    load: async () => ({}),
    save: async () => { throw new Error('offline'); },
  };
  const base = createUnavailablePlatformServices(null);
  const services = await createRuntimeServices({
    catalogLoader: async () => fixtureCatalog(),
    platform: { ...base, playerStorage },
    legacyLocalStorage: legacyStorage,
    preferenceStorage: null,
  });

  assert.equal(services.metaSession.state.standard.selectedDifficulty, 'hard');
  assert.equal(services.metaSession.state.mastery.rank, 'expert');
  assert.equal(services.metaSession.status, 'ready');
  assert.equal(services.metaSession.saveError, true);
});


test('runtime stays usable on migrated local meta when platform storage cannot be read or written', async () => {
  const legacyProfile = createLegacyProfileFixture();
  const legacyStorage = {
    getItem(key: string): string | null {
      return key === 'trifoldPlayerProfile' ? JSON.stringify(legacyProfile) : null;
    },
  };
  const playerStorage: PlayerStorage = {
    scope: async () => 'offline-player',
    loadStrict: async () => { throw new Error('offline'); },
    saveStrict: async () => { throw new Error('offline'); },
    load: async () => { throw new Error('offline'); },
    save: async () => { throw new Error('offline'); },
  };
  const base = createUnavailablePlatformServices(null);
  const services = await createRuntimeServices({
    catalogLoader: async () => fixtureCatalog(),
    platform: { ...base, playerStorage },
    legacyLocalStorage: legacyStorage,
    preferenceStorage: null,
  });

  assert.equal(services.metaSession.state.standard.selectedDifficulty, 'hard');
  assert.equal(services.metaSession.state.mastery.rank, 'expert');
  assert.equal(services.metaSession.status, 'ready');
  assert.equal(services.metaSession.saveError, true);
});
