import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VerifiedDealCatalog, STANDARD_TIERS } from '../../src/game/model/VerifiedDealCatalog.ts';
import { verifyProductionAssetHash } from './catalog-format.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export function auditProductionCatalog({ binaryPath, manifestPath }) {
  const binary = readFileSync(binaryPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  verifyProductionAssetHash(binary, manifest);
  const catalog = VerifiedDealCatalog.decode(toArrayBuffer(binary), manifest);
  const standardSeeds = STANDARD_TIERS.flatMap((tier) => [...catalog.getStandardSeeds(tier)]);
  const standardSet = new Set(standardSeeds);
  let crossPoolDuplicates = 0;
  const dailySeeds = [];
  for (let offset = 0; offset < catalog.metadata.dailyScheduleLength; offset += 1) {
    const seed = catalog.getDailySeedByOffset(offset);
    dailySeeds.push(seed);
    if (standardSet.has(seed)) crossPoolDuplicates += 1;
  }
  const rejectedVerification = catalog.metadata.rejectedVerificationCount;
  const status = crossPoolDuplicates === 0
    && catalog.metadata.crossPoolDuplicateCount === 0
    && rejectedVerification === 0
    ? 'READY_TO_SHIP'
    : 'NOT_READY';
  return {
    verifiedCount: catalog.metadata.verifiedCount,
    standardCount: standardSeeds.length,
    dailyCount: dailySeeds.length,
    crossPoolDuplicates,
    rejectedVerification,
    status,
    metadata: catalog.metadata,
  };
}

export function printReport(report) {
  const counts = report.metadata.standardCounts;
  console.log('STANDARD');
  console.log(`onboarding=${counts.onboarding} easy=${counts.easy} medium=${counts.medium} hard=${counts.hard} total=${report.standardCount}`);
  console.log('DAILY');
  console.log(`length=${report.dailyCount} start=${report.metadata.dailyScheduleStart}`);
  console.log(`crossPoolDuplicates=${report.crossPoolDuplicates}`);
  console.log(`rejectedVerification=${report.rejectedVerification}`);
  console.log(`verifiedCount=${report.verifiedCount}`);
  console.log(`status=${report.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = auditProductionCatalog({
      binaryPath: path.join(ROOT, 'public', 'assets', 'deals', 'verified-deals.bin'),
      manifestPath: path.join(ROOT, 'public', 'assets', 'deals', 'verified-deals-manifest.json'),
    });
    printReport(report);
    if (report.status !== 'READY_TO_SHIP') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
