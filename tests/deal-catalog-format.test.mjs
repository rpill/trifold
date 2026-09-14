import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVerifiedDealAsset,
  verifyProductionAssetHash,
} from '../tools/deals/catalog-format.mjs';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';

const audit = {
  fastNodeBudget: 10000,
  slowNodeBudget: 50000,
  sourceScanRanges: [],
  rejectedVerificationCount: 0,
  crossPoolDuplicateCount: 0,
  solverSourceHash: 'solver',
  gameRulesSourceHash: 'rules',
};

test('catalog binary order and manifest offsets match runtime v2 contract', () => {
  const { binary, manifest } = buildVerifiedDealAsset({
    standard: { onboarding: [11], easy: [21, 22], medium: [31], hard: [41] },
    daily: [51, 52], dailyScheduleStart: '2026-01-01', audit,
  });
  assert.deepEqual(Array.from({ length: binary.length / 4 }, (_, i) => binary.readUInt32LE(i * 4)), [11, 21, 22, 31, 41, 51, 52]);
  assert.deepEqual(manifest.offsets, {
    onboarding: { byteOffset: 0, count: 1 },
    easy: { byteOffset: 4, count: 2 },
    medium: { byteOffset: 12, count: 1 },
    hard: { byteOffset: 16, count: 1 },
    daily: { byteOffset: 20, count: 2 },
  });
  assert.equal(manifest.catalogVersion, 2);
  assert.equal(manifest.rulesVersion, 1);
  assert.equal(manifest.shuffleVersion, 1);
  assert.equal(manifest.seedEncoding, 'uint32-le');
  assert.equal(manifest.verifiedCount, 7);
  assert.equal(verifyProductionAssetHash(binary, manifest), true);

  const arrayBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
  const catalog = VerifiedDealCatalog.decode(arrayBuffer, manifest);
  assert.deepEqual(catalog.getStandardSeeds('easy'), [21, 22]);
  assert.equal(catalog.getDailySeedByOffset(1), 52);
});

test('production SHA changes on binary mutation and verification rejects mismatch', () => {
  const built = buildVerifiedDealAsset({
    standard: { onboarding: [1], easy: [2], medium: [3], hard: [4] },
    daily: [5], dailyScheduleStart: '2026-01-01', audit,
  });
  const mutated = Buffer.from(built.binary);
  mutated[0] ^= 1;
  assert.throws(() => verifyProductionAssetHash(mutated, built.manifest), /hash mismatch/i);
});

test('catalog builder rejects duplicate and cross-pool seeds', () => {
  assert.throws(() => buildVerifiedDealAsset({
    standard: { onboarding: [1], easy: [1], medium: [3], hard: [4] }, daily: [5], dailyScheduleStart: '2026-01-01', audit,
  }), /duplicate standard/i);
  assert.throws(() => buildVerifiedDealAsset({
    standard: { onboarding: [1], easy: [2], medium: [3], hard: [4] }, daily: [5, 5], dailyScheduleStart: '2026-01-01', audit,
  }), /duplicate daily/i);
  assert.throws(() => buildVerifiedDealAsset({
    standard: { onboarding: [1], easy: [2], medium: [3], hard: [4] }, daily: [4, 5], dailyScheduleStart: '2026-01-01', audit,
  }), /overlap/i);
});
