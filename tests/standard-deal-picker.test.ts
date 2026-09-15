import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStandardSeed } from '../src/meta/standard/StandardDealPicker.ts';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';

function fixtureCatalog(): VerifiedDealCatalog {
  const seeds = [11, 12, 21, 22, 23, 31, 32, 41, 42, 51];
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
    standardCounts: { onboarding: 2, easy: 3, medium: 2, hard: 2 },
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: 1,
    verifiedCount: 10,
    crossPoolDuplicateCount: 0,
    rejectedVerificationCount: 0,
    fastNodeBudget: 100,
    slowNodeBudget: 1000,
    sourceScanRanges: [],
    solverSourceHash: 'solver',
    gameRulesSourceHash: 'rules',
    productionAssetHash: 'hash',
    offsets: {
      onboarding: { byteOffset: 0, count: 2 },
      easy: { byteOffset: 8, count: 3 },
      medium: { byteOffset: 20, count: 2 },
      hard: { byteOffset: 28, count: 2 },
      daily: { byteOffset: 36, count: 1 },
    },
  });
}

const noneCompleted = { onboarding: [], easy: [], medium: [], hard: [] } as const;

test('normal Play uses onboarding until five Standard wins', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'easy',
    onboardingWins: 2,
    completedByPartition: noneCompleted,
    randomIndex: () => 0,
  });
  assert.deepEqual(result, { seed: 11, partition: 'onboarding', difficulty: 'easy', isReplayPoolFallback: false });
});

test('explicit Hard selection bypasses onboarding immediately', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'hard',
    onboardingWins: 0,
    completedByPartition: noneCompleted,
    randomIndex: () => 0,
  });
  assert.equal(result.partition, 'hard');
  assert.equal(result.seed, 41);
});

test('picker excludes completed seeds while unfinished seeds remain', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'easy',
    onboardingWins: 5,
    completedByPartition: { ...noneCompleted, easy: [21] },
    randomIndex: () => 0,
  });
  assert.equal(result.partition, 'easy');
  assert.equal(result.seed, 22);
  assert.equal(result.isReplayPoolFallback, false);
});

test('exhausted partition falls back to replay pool without ever sampling Daily', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'hard',
    onboardingWins: 5,
    completedByPartition: { ...noneCompleted, hard: [41, 42] },
    randomIndex: (size) => size - 1,
  });
  assert.deepEqual(result, { seed: 42, partition: 'hard', difficulty: 'hard', isReplayPoolFallback: true });
});

test('invalid random picker index is rejected', () => {
  assert.throws(() => pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'medium',
    onboardingWins: 5,
    completedByPartition: noneCompleted,
    randomIndex: (size) => size,
  }), /index/i);
});
