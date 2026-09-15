import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { PlayerProfileV1 } from '../src/meta/profile/ProfileTypes.ts';
import type { ProfileStore } from '../src/meta/profile/ProfileRepository.ts';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import { createRuntimeServices, getRuntimeServices, installRuntimeServices } from '../src/meta/RuntimeServices.ts';
import { createUnavailablePlatformServices } from '../src/platform/services.ts';

class MemoryProfileStore implements ProfileStore {
  profile: PlayerProfileV1 = createDefaultProfile();
  async load() { return structuredClone(this.profile); }
  async save(profile: PlayerProfileV1) { this.profile = structuredClone(profile); }
}

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

test('runtime services initialize one shared repository and verified catalog', async () => {
  const catalog = fixtureCatalog();
  const services = await createRuntimeServices({
    store: new MemoryProfileStore(),
    catalogLoader: async () => catalog,
  });
  installRuntimeServices(services);
  assert.equal(getRuntimeServices(), services);
  assert.equal(services.catalog, catalog);
  await services.repository.mutate((profile) => ({ ...profile, coins: 7 }));
  assert.equal(getRuntimeServices().repository.current.coins, 7);
});


test('runtime language follows Yandex on automatic setting and manual profile override wins immediately', async () => {
  const basePlatform = createUnavailablePlatformServices(null);
  const services = await createRuntimeServices({
    store: new MemoryProfileStore(),
    catalogLoader: async () => fixtureCatalog(),
    platform: { ...basePlatform, language: 'en-US' },
  });
  assert.equal(services.language, 'en');
  await services.repository.mutate((profile) => ({
    ...profile,
    settings: { ...profile.settings, language: 'ru' },
  }));
  assert.equal(services.language, 'ru');
});
