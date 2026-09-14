import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildVerifiedDealAsset } from '../tools/deals/catalog-format.mjs';
import { verifyAllSeeds } from '../tools/deals/verify-all.mjs';

function makeAsset() {
  return buildVerifiedDealAsset({
    standard: {
      onboarding: [1],
      easy: [2],
      medium: [3],
      hard: [4],
    },
    daily: [1_000_000_001],
    dailyScheduleStart: '2026-01-01',
    audit: {
      fastNodeBudget: 10_000,
      slowNodeBudget: 50_000,
      sourceScanRanges: [],
      solverSourceHash: 'solver',
      gameRulesSourceHash: 'rules',
      crossPoolDuplicateCount: 0,
      rejectedVerificationCount: 0,
    },
  });
}

function writeAsset(asset) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'trifold-verify-all-'));
  const binaryPath = path.join(dir, 'verified-deals.bin');
  const manifestPath = path.join(dir, 'verified-deals-manifest.json');
  writeFileSync(binaryPath, asset.binary);
  writeFileSync(manifestPath, JSON.stringify(asset.manifest));
  return { binaryPath, manifestPath };
}

test('verify-all solves every Standard and Daily seed with the manifest slow budget', async () => {
  const paths = writeAsset(makeAsset());
  const solved = [];
  const replayed = [];
  const result = await verifyAllSeeds({
    ...paths,
    jobs: 2,
    solveSeed: async ({ seed, budget }) => {
      solved.push({ seed, budget });
      return { status: 'SOLVED', seed, nodes: seed, proof: [{ kind: 'fake' }] };
    },
    verifyProofRecord: async (record) => {
      replayed.push(record.seed);
      return { ok: true, verification: { seed: record.seed } };
    },
  });

  assert.equal(result.verified, 5);
  assert.equal(result.total, 5);
  assert.deepEqual(solved.map((entry) => entry.seed).sort((a, b) => a - b), [1, 2, 3, 4, 1_000_000_001]);
  assert.ok(solved.every((entry) => entry.budget === 50_000));
  assert.deepEqual(replayed.sort((a, b) => a - b), [1, 2, 3, 4, 1_000_000_001]);
});

test('verify-all fails with seed context when the solver no longer solves a shipped seed', async () => {
  const paths = writeAsset(makeAsset());
  await assert.rejects(
    verifyAllSeeds({
      ...paths,
      jobs: 1,
      solveSeed: async ({ seed }) => seed === 3
        ? { status: 'UNSOLVABLE', seed, nodes: 1 }
        : { status: 'SOLVED', seed, nodes: 1, proof: [{ kind: 'fake' }] },
      verifyProofRecord: async () => ({ ok: true, verification: {} }),
    }),
    /seed 3.*UNSOLVABLE/u,
  );
});
