import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCandidateSnapshot, probeReadiness } from '../tools/deals/probe.mjs';

const metrics = { decisionActions: 1, rearrangementMoves: 0, freeCellTouches: 0, earlyProgressActions: 0, blockedDragonPressure: 0 };
function accepted(seed) {
  return { seed, status: 'SOLVED', nodes: seed, proof: [{ kind: 'x' }], verification: { seed, actionCount: 1, metrics } };
}

test('probe reads a file-size snapshot and ignores unterminated trailing JSON', async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'trifold-probe-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'candidates.jsonl');
  writeFileSync(file, `${JSON.stringify(accepted(1))}\n${JSON.stringify({ seed: 2, status: 'UNSOLVABLE', nodes: 3 })}\n`);
  appendFileSync(file, '{"seed":3,"status":"SOL');
  const snapshot = await readCandidateSnapshot(file);
  assert.equal(snapshot.records.length, 2);
  assert.equal(snapshot.trailingIgnored, true);
  assert.ok(snapshot.size > 0);
});

test('probe reports scanned/verified counts and quota shortages for both pools', async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'trifold-probe-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const standard = path.join(root, 'standard.jsonl');
  const daily = path.join(root, 'daily.jsonl');
  writeFileSync(standard, `${JSON.stringify(accepted(1))}\n`);
  writeFileSync(daily, `${JSON.stringify(accepted(1_000_000_001))}\n`);
  const result = await probeReadiness({
    standardCandidatesPath: standard,
    dailyCandidatesPath: daily,
    standardTotal: 4,
    dailyDays: 7,
    dailyStart: '2026-01-01',
  });
  assert.equal(result.standard.scanned, 1);
  assert.equal(result.standard.verified, 1);
  assert.equal(result.standard.status, 'NOT_READY');
  assert.equal(result.daily.scanned, 1);
  assert.equal(result.daily.verified, 1);
  assert.equal(result.daily.status, 'NOT_READY');
  assert.equal(Object.values(result.daily.requiredByWeekday).reduce((a, b) => a + b, 0), 7);
});
