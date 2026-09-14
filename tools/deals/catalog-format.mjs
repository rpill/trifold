import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const MAX_UINT32 = 0xffff_ffff;
const UINT32_BYTES = 4;

function positiveUint32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > MAX_UINT32) {
    throw new RangeError(`${label} must be a positive uint32, got ${String(value)}`);
  }
  return number;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer`);
  return value;
}

function sha256(binary) {
  return createHash('sha256').update(binary).digest('hex');
}

export function verifyProductionAssetHash(binary, manifest) {
  const actual = sha256(binary);
  if (manifest?.productionAssetHash !== actual) {
    throw new Error(`Production asset hash mismatch: expected ${String(manifest?.productionAssetHash)}, got ${actual}`);
  }
  return true;
}

function normalizePools(standard, daily) {
  if (!standard || typeof standard !== 'object') throw new TypeError('standard is required');
  if (!Array.isArray(daily)) throw new TypeError('daily must be an array');
  const normalizedStandard = {};
  for (const tier of TIERS) {
    if (!Array.isArray(standard[tier])) throw new TypeError(`standard.${tier} must be an array`);
    normalizedStandard[tier] = standard[tier].map((seed, index) => positiveUint32(seed, `${tier}[${index}]`));
  }
  const normalizedDaily = daily.map((seed, index) => positiveUint32(seed, `daily[${index}]`));

  const standardSeen = new Set();
  for (const tier of TIERS) {
    for (const seed of normalizedStandard[tier]) {
      if (standardSeen.has(seed)) throw new Error(`Duplicate Standard seed ${seed}`);
      standardSeen.add(seed);
    }
  }
  const dailySeen = new Set();
  for (const seed of normalizedDaily) {
    if (dailySeen.has(seed)) throw new Error(`Duplicate Daily seed ${seed}`);
    if (standardSeen.has(seed)) throw new Error(`Standard/Daily seed overlap at ${seed}`);
    dailySeen.add(seed);
  }
  return { standard: normalizedStandard, daily: normalizedDaily };
}

function validateDailyStart(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`Invalid dailyScheduleStart: ${String(value)}`);
  const millis = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid dailyScheduleStart: ${String(value)}`);
  }
  return value;
}

export function buildVerifiedDealAsset({ standard, daily, dailyScheduleStart, audit }) {
  if (!audit || typeof audit !== 'object') throw new TypeError('audit is required');
  const pools = normalizePools(standard, daily);
  const start = validateDailyStart(dailyScheduleStart);
  const fastNodeBudget = positiveInteger(audit.fastNodeBudget, 'fastNodeBudget');
  const slowNodeBudget = positiveInteger(audit.slowNodeBudget, 'slowNodeBudget');
  if (slowNodeBudget <= fastNodeBudget) throw new Error('slowNodeBudget must be greater than fastNodeBudget');
  if (!Array.isArray(audit.sourceScanRanges)) throw new TypeError('sourceScanRanges must be an array');
  if (typeof audit.solverSourceHash !== 'string' || audit.solverSourceHash.length === 0) throw new Error('solverSourceHash is required');
  if (typeof audit.gameRulesSourceHash !== 'string' || audit.gameRulesSourceHash.length === 0) throw new Error('gameRulesSourceHash is required');

  const offsets = {};
  const standardCounts = {};
  let byteOffset = 0;
  let verifiedCount = 0;
  for (const tier of TIERS) {
    const count = pools.standard[tier].length;
    offsets[tier] = { byteOffset, count };
    standardCounts[tier] = count;
    byteOffset += count * UINT32_BYTES;
    verifiedCount += count;
  }
  offsets.daily = { byteOffset, count: pools.daily.length };
  verifiedCount += pools.daily.length;

  const binary = Buffer.alloc(verifiedCount * UINT32_BYTES);
  let cursor = 0;
  for (const tier of TIERS) {
    for (const seed of pools.standard[tier]) {
      binary.writeUInt32LE(seed, cursor);
      cursor += UINT32_BYTES;
    }
  }
  for (const seed of pools.daily) {
    binary.writeUInt32LE(seed, cursor);
    cursor += UINT32_BYTES;
  }

  const manifest = {
    catalogVersion: 2,
    rulesVersion: 1,
    shuffleVersion: 1,
    seedEncoding: 'uint32-le',
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 1,
    standardCounts,
    dailyScheduleStart: start,
    dailyScheduleLength: pools.daily.length,
    verifiedCount,
    crossPoolDuplicateCount: nonNegativeInteger(audit.crossPoolDuplicateCount, 'crossPoolDuplicateCount'),
    rejectedVerificationCount: nonNegativeInteger(audit.rejectedVerificationCount, 'rejectedVerificationCount'),
    fastNodeBudget,
    slowNodeBudget,
    sourceScanRanges: structuredClone(audit.sourceScanRanges),
    solverSourceHash: audit.solverSourceHash,
    gameRulesSourceHash: audit.gameRulesSourceHash,
    productionAssetHash: sha256(binary),
    offsets,
  };
  verifyProductionAssetHash(binary, manifest);
  return { binary, manifest };
}

export function writeVerifiedDealAssets({ binary, manifest, binaryPath, manifestPath }) {
  verifyProductionAssetHash(binary, manifest);
  mkdirSync(path.dirname(path.resolve(binaryPath)), { recursive: true });
  mkdirSync(path.dirname(path.resolve(manifestPath)), { recursive: true });
  writeFileSync(binaryPath, binary);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
