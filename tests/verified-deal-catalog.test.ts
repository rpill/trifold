import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';

function encode(seeds: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(seeds.length * 4);
  const view = new DataView(buffer);
  seeds.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return buffer;
}

function manifest(overrides: Record<string, unknown> = {}): unknown {
  return {
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
    ...overrides,
  };
}

const SEEDS = [11, 21, 22, 31, 41, 51, 52];

test('decodes partitioned standard tiers and explicit daily offsets', () => {
  const catalog = VerifiedDealCatalog.decode(encode(SEEDS), manifest());
  assert.deepEqual(catalog.getStandardSeeds('onboarding'), [11]);
  assert.deepEqual(catalog.getStandardSeeds('easy'), [21, 22]);
  assert.deepEqual(catalog.getStandardSeeds('medium'), [31]);
  assert.deepEqual(catalog.getStandardSeeds('hard'), [41]);
  assert.equal(catalog.getDailySeedByOffset(0), 51);
  assert.equal(catalog.getDailySeedByOffset(1), 52);
  assert.equal(catalog.has(22), true);
  assert.equal(catalog.has(999), false);
  assert.equal(catalog.metadata.dailyScheduleStart, '2026-01-01');
  assert.throws(() => catalog.getDailySeedByOffset(-1), RangeError);
  assert.throws(() => catalog.getDailySeedByOffset(2), RangeError);
});

test('rejects zero, duplicate, and standard-daily overlapping seeds', () => {
  assert.throws(() => VerifiedDealCatalog.decode(encode([11, 21, 0, 31, 41, 51, 52]), manifest()), /positive uint32/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode([11, 21, 21, 31, 41, 51, 52]), manifest()), /duplicate/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode([11, 21, 22, 31, 41, 11, 52]), manifest()), /overlap|duplicate/i);
});

test('rejects malformed offsets, byte length, counts, and versions', () => {
  assert.throws(() => VerifiedDealCatalog.decode(new ArrayBuffer(5), manifest()), /4-byte/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode(SEEDS), manifest({ rulesVersion: 2 })), /rulesVersion/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode(SEEDS), manifest({ shuffleVersion: 2 })), /shuffleVersion/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode(SEEDS), manifest({ catalogVersion: 1 })), /catalogVersion/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode(SEEDS), manifest({ seedEncoding: 'text' })), /seedEncoding/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode(SEEDS), manifest({ verifiedCount: 6 })), /verifiedCount|count/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode(SEEDS), manifest({
    offsets: {
      onboarding: { byteOffset: 0, count: 1 },
      easy: { byteOffset: 8, count: 2 },
      medium: { byteOffset: 16, count: 1 },
      hard: { byteOffset: 20, count: 1 },
      daily: { byteOffset: 24, count: 2 },
    },
  })), /offset|contiguous/i);
});
