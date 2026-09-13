import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';

function encode(seeds: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(seeds.length * 4);
  const view = new DataView(buffer);
  seeds.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return buffer;
}

function manifest(verifiedCount = 3): unknown {
  return {
    catalogVersion: 1,
    rulesVersion: 1,
    shuffleVersion: 1,
    seedEncoding: 'uint32-le',
    verifiedCount,
  };
}

test('decodes exact little-endian uint32 seeds with membership and bounds', () => {
  const catalog = VerifiedDealCatalog.decode(encode([11, 22, 33]), manifest());
  assert.equal(catalog.size, 3);
  assert.equal(catalog.seedAt(0), 11);
  assert.equal(catalog.seedAt(2), 33);
  assert.equal(catalog.has(22), true);
  assert.equal(catalog.has(44), false);
  assert.throws(() => catalog.seedAt(-1), RangeError);
  assert.throws(() => catalog.seedAt(3), RangeError);
});

test('rejects zero and duplicate seeds', () => {
  assert.throws(() => VerifiedDealCatalog.decode(encode([11, 0, 33]), manifest()), /positive uint32/i);
  assert.throws(() => VerifiedDealCatalog.decode(encode([11, 22, 22]), manifest()), /duplicate/i);
});

test('rejects malformed binary size', () => {
  assert.throws(() => VerifiedDealCatalog.decode(new ArrayBuffer(5), manifest()), /4-byte/i);
});

test('rejects manifest contract mismatches', () => {
  const base = manifest() as Record<string, unknown>;
  for (const patch of [
    { rulesVersion: 2 },
    { shuffleVersion: 2 },
    { catalogVersion: 2 },
    { seedEncoding: 'text' },
    { verifiedCount: 2 },
  ]) {
    assert.throws(() => VerifiedDealCatalog.decode(encode([11, 22, 33]), { ...base, ...patch }));
  }
});
