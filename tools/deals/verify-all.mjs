import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyProductionAssetHash } from './catalog-format.mjs';
import { solveSeed as defaultSolveSeed } from './solver-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PARTITIONS = Object.freeze(['onboarding', 'easy', 'medium', 'hard', 'daily']);

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new RangeError(`${label} must be a positive integer`);
  return number;
}

function readCatalogSeeds(binary, manifest) {
  if (manifest?.catalogVersion !== 2) throw new Error(`Unsupported catalogVersion ${String(manifest?.catalogVersion)}`);
  if (binary.byteLength % 4 !== 0) throw new Error('Verified deal binary must be 4-byte aligned');
  if (!manifest.offsets || typeof manifest.offsets !== 'object') throw new Error('Verified deal manifest offsets are required');
  const expectedCount = positiveInteger(manifest.verifiedCount, 'verifiedCount');
  if (binary.byteLength !== expectedCount * 4) throw new Error('Verified deal binary length does not match verifiedCount');

  const seeds = [];
  let expectedOffset = 0;
  for (const partition of PARTITIONS) {
    const entry = manifest.offsets[partition];
    if (!entry || !Number.isSafeInteger(entry.byteOffset) || !Number.isSafeInteger(entry.count) || entry.count < 0) {
      throw new Error(`Invalid manifest offset for ${partition}`);
    }
    if (entry.byteOffset !== expectedOffset) throw new Error(`Manifest offsets are not contiguous at ${partition}`);
    for (let index = 0; index < entry.count; index += 1) {
      const seed = binary.readUInt32LE(entry.byteOffset + index * 4);
      if (seed < 1) throw new Error(`Invalid seed 0 in ${partition}`);
      seeds.push(seed);
    }
    expectedOffset += entry.count * 4;
  }
  if (seeds.length !== expectedCount || expectedOffset !== binary.byteLength) {
    throw new Error('Manifest partition counts do not match verifiedCount');
  }
  if (new Set(seeds).size !== seeds.length) throw new Error('Verified catalog contains duplicate seeds');
  return seeds;
}

async function parallelForEach(items, jobs, worker) {
  let cursor = 0;
  let firstError;
  const run = async () => {
    while (firstError === undefined) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        await worker(items[index], index);
      } catch (error) {
        firstError = error;
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, Math.max(1, items.length)) }, run));
  if (firstError !== undefined) throw firstError;
}

export async function verifyAllSeeds({
  binaryPath,
  manifestPath,
  jobs = 1,
  solveSeed = defaultSolveSeed,
  verifyProofRecord,
  onProgress,
} = {}) {
  const normalizedJobs = positiveInteger(jobs, 'jobs');
  if (typeof solveSeed !== 'function') throw new TypeError('solveSeed must be a function');
  if (typeof verifyProofRecord !== 'function') throw new TypeError('verifyProofRecord must be a function');

  const binary = readFileSync(binaryPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  verifyProductionAssetHash(binary, manifest);
  const seeds = readCatalogSeeds(binary, manifest);
  const slowNodeBudget = positiveInteger(manifest.slowNodeBudget, 'slowNodeBudget');
  let verified = 0;

  await parallelForEach(seeds, normalizedJobs, async (seed) => {
    const solved = await solveSeed({ seed, budget: slowNodeBudget });
    if (solved.status !== 'SOLVED') {
      throw new Error(`verify-all failed for seed ${seed}: solver returned ${solved.status}`);
    }
    const replay = await verifyProofRecord(solved);
    if (!replay?.ok) {
      throw new Error(`verify-all failed for seed ${seed}: proof replay rejected: ${String(replay?.reason ?? 'unknown reason')}`);
    }
    verified += 1;
    if (typeof onProgress === 'function') onProgress({ verified, total: seeds.length, seed });
  });

  return { verified, total: seeds.length, slowNodeBudget };
}

function parseArgs(argv) {
  const options = { jobs: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--jobs') options.jobs = positiveInteger(argv[++index], 'jobs');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { verifyProofRecord } = await import('./verify-proof.mjs');
    const result = await verifyAllSeeds({
      binaryPath: path.join(ROOT, 'public', 'assets', 'deals', 'verified-deals.bin'),
      manifestPath: path.join(ROOT, 'public', 'assets', 'deals', 'verified-deals-manifest.json'),
      jobs: options.jobs,
      verifyProofRecord,
      onProgress: ({ verified, total }) => {
        if (verified % 1000 === 0 || verified === total) console.log(`verified=${verified}/${total}`);
      },
    });
    console.log(`status=VERIFIED ${result.verified}/${result.total}`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
