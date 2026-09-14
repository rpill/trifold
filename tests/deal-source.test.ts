import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentDealSource, VerifiedCatalogDealSource } from '../src/game/model/DealSource.ts';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';

function catalog(): VerifiedDealCatalog {
  const seeds = [11, 21, 22, 31, 41, 51, 52];
  const buffer = new ArrayBuffer(seeds.length * 4);
  const view = new DataView(buffer);
  seeds.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion: 2,
    rulesVersion: 1,
    shuffleVersion: 1,
    seedEncoding: 'uint32-le',
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 1,
    standardCounts: { onboarding: 1, easy: 2, medium: 1, hard: 1 },
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: 2,
    verifiedCount: 7,
    crossPoolDuplicateCount: 0,
    rejectedVerificationCount: 0,
    fastNodeBudget: 10000,
    slowNodeBudget: 50000,
    sourceScanRanges: [],
    solverSourceHash: 'solver',
    gameRulesSourceHash: 'rules',
    productionAssetHash: 'test-hash',
    offsets: {
      onboarding: { byteOffset: 0, count: 1 },
      easy: { byteOffset: 4, count: 2 },
      medium: { byteOffset: 12, count: 1 },
      hard: { byteOffset: 16, count: 1 },
      daily: { byteOffset: 20, count: 2 },
    },
  });
}

test('development source advances deterministic positive uint32 seeds', () => {
  const source = new DevelopmentDealSource(7);
  assert.equal(source.nextSeed(), 7);
  assert.equal(source.nextSeed(7), 8);
  assert.equal(source.nextSeed(0xffff_ffff), 1);
  assert.throws(() => new DevelopmentDealSource(0), RangeError);
});

test('verified source samples only standard partitions and never daily seeds', () => {
  const c = catalog();
  const standard = [11, 21, 22, 31, 41];
  for (let index = 0; index < standard.length; index += 1) {
    const source = new VerifiedCatalogDealSource(c, () => index);
    assert.equal(source.nextSeed(), standard[index]);
  }
  assert.notEqual(new VerifiedCatalogDealSource(c, () => 4).nextSeed(), c.getDailySeedByOffset(0));
});

test('verified source rejects invalid picker indices', () => {
  const source = new VerifiedCatalogDealSource(catalog(), () => 5);
  assert.throws(() => source.nextSeed(), RangeError);
});
