import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildVerifiedDealAsset } from '../tools/deals/catalog-format.mjs';
import { auditProductionCatalog } from '../tools/deals/report.mjs';

const audit = {
  fastNodeBudget: 10000, slowNodeBudget: 50000, sourceScanRanges: [],
  rejectedVerificationCount: 0, crossPoolDuplicateCount: 0,
  solverSourceHash: 'solver', gameRulesSourceHash: 'rules',
};

test('report decodes production asset, verifies hash, and reports zero cross-pool duplicates', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'trifold-report-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const built = buildVerifiedDealAsset({
    standard: { onboarding: [1], easy: [2], medium: [3], hard: [4] },
    daily: [5, 6], dailyScheduleStart: '2026-01-01', audit,
  });
  const binaryPath = path.join(root, 'verified-deals.bin');
  const manifestPath = path.join(root, 'verified-deals-manifest.json');
  writeFileSync(binaryPath, built.binary);
  writeFileSync(manifestPath, JSON.stringify(built.manifest));
  const report = auditProductionCatalog({ binaryPath, manifestPath });
  assert.equal(report.verifiedCount, 6);
  assert.equal(report.crossPoolDuplicates, 0);
  assert.equal(report.rejectedVerification, 0);
  assert.equal(report.status, 'READY_TO_SHIP');
});
