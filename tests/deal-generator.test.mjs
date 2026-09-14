import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DAILY_SOURCE_START,
  STANDARD_SOURCE_START,
  scanRange,
  readCheckpoint,
  readCandidateRecords,
  validateReleaseData,
} from '../tools/deals/generate.mjs';

function tempPaths() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'trifold-deals-'));
  return {
    root,
    outputPath: path.join(root, 'candidates.jsonl'),
    checkpointPath: path.join(root, 'checkpoint.json'),
  };
}

const solved = (seed, nodes = 10) => ({ status: 'SOLVED', seed, nodes, proof: [{ kind: 'fake' }] });

test('scanner slow-retries UNDETERMINED and appends replay-verified solved candidate', async (t) => {
  const paths = tempPaths(); t.after(() => rmSync(paths.root, { recursive: true, force: true }));
  const budgets = [];
  const checkpoint = await scanRange({
    startSeed: 1, maxSeeds: 1, stopAfter: 1, jobs: 1,
    outputPath: paths.outputPath, checkpointPath: paths.checkpointPath,
    fastBudget: 100, slowBudget: 1000,
    solveSeed: async ({ seed, budget }) => {
      budgets.push(budget);
      return budget === 100 ? { status: 'UNDETERMINED', seed, nodes: 100 } : solved(seed, 200);
    },
    verifyProofRecord: async () => ({ ok: true, verification: { seed: 1, actionCount: 1, metrics: {
      decisionActions: 1, rearrangementMoves: 1, freeCellTouches: 0, earlyProgressActions: 1, blockedDragonPressure: 0,
    } } }),
  });
  assert.deepEqual(budgets, [100, 1000]);
  assert.equal(checkpoint.acceptedCount, 1);
  const records = await readCandidateRecords(paths.outputPath);
  assert.equal(records[0].status, 'SOLVED');
  assert.equal(records[0].budget, 1000);
  assert.equal(records[0].verification.metrics.decisionActions, 1);
});

test('scanner records replay rejection and UNSOLVABLE but never accepts them', async (t) => {
  const paths = tempPaths(); t.after(() => rmSync(paths.root, { recursive: true, force: true }));
  await scanRange({
    startSeed: 10, maxSeeds: 2, stopAfter: 2, jobs: 1,
    outputPath: paths.outputPath, checkpointPath: paths.checkpointPath,
    fastBudget: 100, slowBudget: 1000,
    solveSeed: async ({ seed }) => seed === 10 ? solved(seed) : { status: 'UNSOLVABLE', seed, nodes: 5 },
    verifyProofRecord: async () => ({ ok: false, reason: 'proof mismatch' }),
  });
  const checkpoint = readCheckpoint(paths.checkpointPath);
  assert.equal(checkpoint.rejectedVerificationCount, 1);
  assert.equal(checkpoint.unsolvableCount, 1);
  assert.equal(checkpoint.acceptedCount, 0);
  const records = await readCandidateRecords(paths.outputPath);
  assert.equal(records[0].rejectionReason, 'proof mismatch');
});

test('checkpoint resume continues at next unscanned seed without duplicate JSONL rows', async (t) => {
  const paths = tempPaths(); t.after(() => rmSync(paths.root, { recursive: true, force: true }));
  const solveSeed = async ({ seed }) => ({ status: 'UNSOLVABLE', seed, nodes: 1 });
  const verifyProofRecord = async () => { throw new Error('should not verify'); };
  await scanRange({ startSeed: 50, maxSeeds: 3, stopAfter: 1, jobs: 1, outputPath: paths.outputPath, checkpointPath: paths.checkpointPath, fastBudget: 10, slowBudget: 20, solveSeed, verifyProofRecord });
  assert.equal(readCheckpoint(paths.checkpointPath).nextSeed, 51);
  await scanRange({ startSeed: 50, maxSeeds: 3, stopAfter: 2, jobs: 1, outputPath: paths.outputPath, checkpointPath: paths.checkpointPath, fastBudget: 10, slowBudget: 20, solveSeed, verifyProofRecord });
  const records = await readCandidateRecords(paths.outputPath);
  assert.deepEqual(records.map((r) => r.seed), [50, 51, 52]);
});

test('Standard and Daily source ranges are disjoint and release validation rejects overlap', () => {
  assert.equal(STANDARD_SOURCE_START, 1);
  assert.equal(DAILY_SOURCE_START, 1_000_000_001);
  assert.ok(DAILY_SOURCE_START > STANDARD_SOURCE_START);
  const record = (seed, score) => ({ seed, difficultyScore: score });
  assert.throws(() => validateReleaseData({
    standard: { onboarding: [record(1, 1)], easy: [record(2, 20)], medium: [record(3, 40)], hard: [record(4, 70)] },
    quotas: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    dailySchedule: [{ dailyId: '2026-01-01', seed: 4, difficultyScore: 50 }],
    dailyDays: 1, dailyScheduleStart: '2026-01-01',
  }), /overlap/i);
});

test('checkpoint replacement retries transient Windows EPERM/EBUSY rename locks', async (t) => {
  const paths = tempPaths(); t.after(() => rmSync(paths.root, { recursive: true, force: true }));
  const module = await import('../tools/deals/generate.mjs');
  assert.equal(typeof module.writeCheckpointAtomic, 'function');

  const attempts = [];
  const sleeps = [];
  module.writeCheckpointAtomic(paths.checkpointPath, { version: 1, marker: 42 }, {
    renameFile: (from, to) => {
      attempts.push({ from, to });
      if (attempts.length <= 2) {
        const error = new Error('temporarily locked');
        error.code = attempts.length === 1 ? 'EPERM' : 'EBUSY';
        throw error;
      }
      renameSync(from, to);
    },
    sleep: (ms) => sleeps.push(ms),
    retryDelays: [1, 2, 3],
  });

  assert.equal(attempts.length, 3);
  assert.deepEqual(sleeps, [1, 2]);
  assert.match(attempts[0].from, /checkpoint\.json\..+\.tmp$/u);
  assert.equal(attempts[0].to, paths.checkpointPath);
  assert.equal(JSON.parse(readFileSync(paths.checkpointPath, 'utf8')).marker, 42);
});
