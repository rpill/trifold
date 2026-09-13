import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentDealSource, VerifiedCatalogDealSource } from '../src/game/model/DealSource.ts';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';

function catalog(seeds: number[]): VerifiedDealCatalog {
  const buffer = new ArrayBuffer(seeds.length * 4);
  const view = new DataView(buffer);
  seeds.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion: 1,
    rulesVersion: 1,
    shuffleVersion: 1,
    seedEncoding: 'uint32-le',
    verifiedCount: seeds.length,
  });
}

test('development source advances deterministic positive uint32 seeds', () => {
  const source = new DevelopmentDealSource(7);
  assert.equal(source.nextSeed(), 7);
  assert.equal(source.nextSeed(7), 8);
  assert.equal(source.nextSeed(0xffff_ffff), 1);
  assert.throws(() => new DevelopmentDealSource(0), RangeError);
});

test('verified source returns catalog members only', () => {
  const source = new VerifiedCatalogDealSource(catalog([11, 22, 33]), () => 1);
  assert.equal(source.nextSeed(), 22);
  assert.equal(source.nextSeed(11), 22);
});

test('verified source rejects empty catalog and invalid picker indices', () => {
  assert.throws(() => new VerifiedCatalogDealSource(catalog([]), () => 0), /empty/i);
  const source = new VerifiedCatalogDealSource(catalog([11]), () => 1);
  assert.throws(() => source.nextSeed(), RangeError);
});
