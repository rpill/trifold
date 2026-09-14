import { createHash } from 'node:crypto';
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildVerifiedDealAsset, writeVerifiedDealAssets } from './catalog-format.mjs';
import { DAILY_BANDS, generateDailySchedule } from './daily-schedule.mjs';
import { partitionStandard, scorePopulation, standardQuotasForTotal } from './difficulty.mjs';
import { solveSeed as defaultSolveSeed } from './solver-client.mjs';
import { verifyProofRecord as defaultVerifyProofRecord } from './verify-proof.mjs';

export const STANDARD_SOURCE_START = 1;
export const DAILY_SOURCE_START = 1_000_000_001;
export const DAILY_SCHEDULE_START = '2026-01-01';
export const RELEASE_DAILY_DAYS = 7_305;
const MAX_UINT32 = 0xffff_ffff;
const TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);
const DAY_MS = 86_400_000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_RULE_SOURCE_FILES = Object.freeze([
  'src/game/model/cards.ts',
  'src/game/model/deal.ts',
  'src/game/model/SeededRandom.ts',
  'src/game/model/TrifoldRules.ts',
  'src/game/model/TrifoldGame.ts',
  'src/game/model/DealProof.ts',
  'src/game/model/types.ts',
]);

function assertPositiveUint32(value, label = 'seed') {
  if (!Number.isInteger(value) || value < 1 || value > MAX_UINT32) throw new RangeError(`${label} must be a positive uint32, got ${String(value)}`);
  return value;
}

function ensureParent(filePath) { mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true }); }

const CHECKPOINT_RENAME_RETRY_DELAYS_MS = Object.freeze([10, 25, 50, 100, 200, 400]);
const CHECKPOINT_RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY']);
const CHECKPOINT_SLEEP_BUFFER = new Int32Array(new SharedArrayBuffer(4));
let checkpointTempSequence = 0;

function sleepSync(ms) {
  Atomics.wait(CHECKPOINT_SLEEP_BUFFER, 0, 0, ms);
}

function isTransientCheckpointRenameError(error) {
  return error && typeof error === 'object' && CHECKPOINT_RENAME_RETRY_CODES.has(error.code);
}

export function writeCheckpointAtomic(checkpointPath, checkpoint, {
  renameFile = renameSync,
  sleep = sleepSync,
  retryDelays = CHECKPOINT_RENAME_RETRY_DELAYS_MS,
} = {}) {
  ensureParent(checkpointPath);
  const sequence = checkpointTempSequence++;
  const tmp = `${checkpointPath}.${process.pid}.${Date.now()}.${sequence}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        renameFile(tmp, checkpointPath);
        return;
      } catch (error) {
        if (!isTransientCheckpointRenameError(error) || attempt >= retryDelays.length) throw error;
        sleep(retryDelays[attempt]);
      }
    }
  } catch (error) {
    try { rmSync(tmp, { force: true }); } catch {}
    throw error;
  }
}

export function readCheckpoint(checkpointPath) {
  if (!existsSync(checkpointPath)) return null;
  const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  if (checkpoint?.version !== 1) throw new Error(`Unsupported generation checkpoint version: ${String(checkpoint?.version)}`);
  return checkpoint;
}

export function appendCandidate(outputPath, record) {
  ensureParent(outputPath);
  appendFileSync(outputPath, `${JSON.stringify(record)}\n`, 'utf8');
}

async function* readCompleteJsonl(outputPath) {
  if (!existsSync(outputPath)) return;
  const stream = createReadStream(outputPath);
  let carry = '';
  stream.setEncoding('utf8');
  let lineNumber = 0;
  for await (const chunk of stream) {
    carry += chunk;
    while (true) {
      const newline = carry.indexOf('\n');
      if (newline < 0) break;
      const line = carry.slice(0, newline);
      carry = carry.slice(newline + 1);
      lineNumber += 1;
      if (!line.trim()) continue;
      try { yield JSON.parse(line); }
      catch (error) { throw new Error(`Invalid candidate JSONL ${outputPath}:${lineNumber}: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }
  // Ignore an unterminated trailing fragment. Writer always appends newline, so this is crash residue.
}

export async function readCandidateRecords(outputPath) {
  const records = [];
  for await (const record of readCompleteJsonl(outputPath)) records.push(record);
  return records;
}

async function readCompactCandidateState(outputPath) {
  const compact = new Map();
  for await (const record of readCompleteJsonl(outputPath)) {
    compact.set(record.seed, {
      status: record.status,
      accepted: record.status === 'SOLVED' && record.verification?.metrics !== undefined && !record.rejectionReason,
      rejected: Boolean(record.rejectionReason),
    });
  }
  return compact;
}

export async function acceptedCandidateRecords(outputPath) {
  const records = [];
  for await (const record of readCompleteJsonl(outputPath)) {
    if (record?.status !== 'SOLVED' || !record?.verification?.metrics || !Array.isArray(record.proof) || record.rejectionReason) continue;
    const compact = { ...record };
    delete compact.proof;
    records.push(compact);
  }
  return records;
}

function freshCheckpoint(source, startSeed, fastBudget, slowBudget) {
  return {
    version: 1,
    source,
    sourceStart: startSeed,
    nextSeed: startSeed,
    scannedCount: 0,
    acceptedCount: 0,
    rejectedVerificationCount: 0,
    unsolvableCount: 0,
    undeterminedCount: 0,
    fastNodeBudget: fastBudget,
    slowNodeBudget: slowBudget,
  };
}

function validateCheckpoint(checkpoint, { source, startSeed, fastBudget, slowBudget }) {
  if (checkpoint.source !== source || checkpoint.sourceStart !== startSeed) throw new Error('Checkpoint source/range mismatch');
  if (checkpoint.fastNodeBudget !== fastBudget || checkpoint.slowNodeBudget !== slowBudget) throw new Error('Checkpoint budget mismatch');
}

function applyExistingCounter(checkpoint, compact) {
  if (compact.accepted) checkpoint.acceptedCount += 1;
  else if (compact.rejected) checkpoint.rejectedVerificationCount += 1;
  else if (compact.status === 'UNSOLVABLE') checkpoint.unsolvableCount += 1;
  else if (compact.status === 'UNDETERMINED') checkpoint.undeterminedCount += 1;
}

function applyNewCounter(checkpoint, record) {
  if (record.status === 'SOLVED' && record.verification?.metrics && !record.rejectionReason) checkpoint.acceptedCount += 1;
  else if (record.status === 'SOLVED' && record.rejectionReason) checkpoint.rejectedVerificationCount += 1;
  else if (record.status === 'UNSOLVABLE') checkpoint.unsolvableCount += 1;
  else if (record.status === 'UNDETERMINED') checkpoint.undeterminedCount += 1;
}

async function solveAndVerify(seed, { solveSeed, verifyProofRecord, fastBudget, slowBudget, solverPath }) {
  let solved = await solveSeed({ seed, budget: fastBudget, solverPath });
  let budget = fastBudget;
  if (solved.status === 'UNDETERMINED') {
    solved = await solveSeed({ seed, budget: slowBudget, solverPath });
    budget = slowBudget;
  }
  const record = { seed, status: solved.status, nodes: solved.nodes, budget };
  if (Array.isArray(solved.proof)) record.proof = solved.proof;
  if (solved.status === 'SOLVED') {
    const replay = await verifyProofRecord(solved);
    if (replay.ok) record.verification = replay.verification;
    else record.rejectionReason = replay.reason ?? 'proof replay rejected';
  }
  return record;
}

async function mapConcurrent(values, jobs, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}

export async function scanRange({
  source = 'test',
  startSeed,
  maxSeeds,
  checkpointPath,
  outputPath,
  stopAfter = Number.POSITIVE_INFINITY,
  batchSize = 64,
  jobs = 1,
  solveSeed = defaultSolveSeed,
  verifyProofRecord = defaultVerifyProofRecord,
  fastBudget = 10_000,
  slowBudget = 50_000,
  solverPath,
} = {}) {
  assertPositiveUint32(startSeed, 'startSeed');
  if (!Number.isSafeInteger(maxSeeds) || maxSeeds < 1) throw new RangeError('maxSeeds must be >= 1');
  const endSeed = startSeed + maxSeeds - 1;
  assertPositiveUint32(endSeed, 'endSeed');
  if (!checkpointPath || !outputPath) throw new Error('checkpointPath and outputPath are required');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new RangeError('batchSize must be >= 1');
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new RangeError('jobs must be >= 1');
  if (!Number.isSafeInteger(fastBudget) || fastBudget < 1 || !Number.isSafeInteger(slowBudget) || slowBudget <= fastBudget) {
    throw new RangeError('slowBudget must be an integer greater than fastBudget >= 1');
  }

  const existing = await readCompactCandidateState(outputPath);
  const checkpoint = readCheckpoint(checkpointPath) ?? freshCheckpoint(source, startSeed, fastBudget, slowBudget);
  validateCheckpoint(checkpoint, { source, startSeed, fastBudget, slowBudget });

  // Crash recovery: JSONL append may have completed before checkpoint rename.
  while (checkpoint.nextSeed <= endSeed && existing.has(checkpoint.nextSeed)) {
    applyExistingCounter(checkpoint, existing.get(checkpoint.nextSeed));
    checkpoint.scannedCount += 1;
    checkpoint.nextSeed += 1;
  }

  let scannedThisRun = 0;
  while (checkpoint.nextSeed <= endSeed && scannedThisRun < stopAfter) {
    const remaining = Number.isFinite(stopAfter) ? stopAfter - scannedThisRun : batchSize;
    const count = Math.min(batchSize, jobs * 4, remaining, endSeed - checkpoint.nextSeed + 1);
    const seeds = Array.from({ length: count }, (_, index) => checkpoint.nextSeed + index);
    const missing = seeds.filter((seed) => !existing.has(seed));
    const records = await mapConcurrent(missing, jobs, (seed) => solveAndVerify(seed, {
      solveSeed, verifyProofRecord, fastBudget, slowBudget, solverPath,
    }));
    const bySeed = new Map(records.map((record) => [record.seed, record]));

    for (const seed of seeds) {
      if (existing.has(seed)) {
        applyExistingCounter(checkpoint, existing.get(seed));
      } else {
        const record = bySeed.get(seed);
        appendCandidate(outputPath, record);
        const compact = {
          status: record.status,
          accepted: record.status === 'SOLVED' && Boolean(record.verification?.metrics) && !record.rejectionReason,
          rejected: Boolean(record.rejectionReason),
        };
        existing.set(seed, compact);
        applyNewCounter(checkpoint, record);
      }
      checkpoint.scannedCount += 1;
      checkpoint.nextSeed = seed + 1;
      scannedThisRun += 1;
    }
    writeCheckpointAtomic(checkpointPath, checkpoint);
  }
  writeCheckpointAtomic(checkpointPath, checkpoint);
  return checkpoint;
}

function parseDailyId(dailyId) {
  if (typeof dailyId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(dailyId)) throw new Error(`Invalid daily ID: ${String(dailyId)}`);
  const millis = Date.parse(`${dailyId}T00:00:00Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== dailyId) throw new Error(`Invalid daily ID: ${dailyId}`);
  return millis;
}

export function validateReleaseData({ standard, dailySchedule, quotas, dailyDays, dailyScheduleStart }) {
  const standardSeen = new Set();
  for (const tier of TIERS) {
    if (!Array.isArray(standard?.[tier])) throw new Error(`Missing Standard tier ${tier}`);
    if (standard[tier].length !== quotas[tier]) throw new Error(`Standard ${tier} count mismatch`);
    for (const record of standard[tier]) {
      assertPositiveUint32(record.seed, `Standard ${tier} seed`);
      if (Number(record.difficultyScore) > 95) throw new Error(`Standard seed ${record.seed} exceeds score 95`);
      if (standardSeen.has(record.seed)) throw new Error(`Duplicate Standard seed ${record.seed}`);
      standardSeen.add(record.seed);
    }
  }
  if (dailySchedule.length !== dailyDays) throw new Error(`Daily length mismatch: expected ${dailyDays}, got ${dailySchedule.length}`);
  const startMillis = parseDailyId(dailyScheduleStart);
  const dailySeen = new Set();
  for (let index = 0; index < dailySchedule.length; index += 1) {
    const row = dailySchedule[index];
    const expectedId = new Date(startMillis + index * DAY_MS).toISOString().slice(0, 10);
    if (row.dailyId !== expectedId) throw new Error(`Daily schedule date mismatch at offset ${index}`);
    const weekday = new Date(startMillis + index * DAY_MS).getUTCDay();
    const [low, high] = DAILY_BANDS[weekday];
    if (!Number.isFinite(row.difficultyScore) || row.difficultyScore < low || row.difficultyScore > high || row.difficultyScore > 95) {
      throw new Error(`Daily ${row.dailyId} violates weekday band ${low}..${high}`);
    }
    if (dailySeen.has(row.seed)) throw new Error(`Duplicate Daily seed ${row.seed}`);
    if (standardSeen.has(row.seed)) throw new Error(`Standard/Daily seed overlap at ${row.seed}`);
    dailySeen.add(row.seed);
  }
  return true;
}

function hashSourceFiles(root, files) {
  const hash = createHash('sha256');
  for (const relative of files) {
    hash.update(relative); hash.update('\0'); hash.update(readFileSync(path.join(root, relative))); hash.update('\0');
  }
  return hash.digest('hex');
}

function releasePaths(root) {
  return {
    calibration: path.join(root, 'artifacts', 'deals', 'calibration.json'),
    standardCandidates: path.join(root, 'artifacts', 'deals', 'standard', 'candidates.jsonl'),
    standardCheckpoint: path.join(root, 'artifacts', 'deals', 'standard', 'checkpoint.json'),
    dailyCandidates: path.join(root, 'artifacts', 'deals', 'daily', 'candidates.jsonl'),
    dailyCheckpoint: path.join(root, 'artifacts', 'deals', 'daily', 'checkpoint.json'),
    binary: path.join(root, 'public', 'assets', 'deals', 'verified-deals.bin'),
    manifest: path.join(root, 'public', 'assets', 'deals', 'verified-deals-manifest.json'),
  };
}

function tryStandard(records, quotas) {
  if (records.length < Object.values(quotas).reduce((sum, value) => sum + value, 0)) return null;
  try { return partitionStandard(scorePopulation(records), quotas); }
  catch (error) { if (/cannot fill/iu.test(String(error?.message ?? error))) return null; throw error; }
}

function tryDaily(records, startDailyId, length) {
  if (records.length < length) return null;
  const scored = scorePopulation(records);
  try { return { scored, schedule: generateDailySchedule(scored, { startDailyId, length }) }; }
  catch (error) { if (/insufficient daily candidates/iu.test(String(error?.message ?? error))) return null; throw error; }
}

function readCalibration(calibrationPath) {
  if (!existsSync(calibrationPath)) return null;
  return JSON.parse(readFileSync(calibrationPath, 'utf8'));
}

function resolveBudgets({ root, standardTotal, dailyDays, fastBudget, slowBudget }) {
  if (fastBudget !== undefined || slowBudget !== undefined) {
    if (!Number.isSafeInteger(fastBudget) || fastBudget < 1 || !Number.isSafeInteger(slowBudget) || slowBudget <= fastBudget) {
      throw new RangeError('explicit --fast-budget/--slow-budget must satisfy 1 <= fast < slow');
    }
    if (standardTotal === 40_000 && dailyDays === RELEASE_DAILY_DAYS) {
      const calibration = readCalibration(releasePaths(root).calibration);
      if (!calibration?.sufficient) throw new Error('Release-sized generation requires sufficient calibration.json');
    }
    return { fastBudget, slowBudget };
  }
  const calibration = readCalibration(releasePaths(root).calibration);
  if (!calibration?.sufficient) throw new Error('Generation requires sufficient artifacts/deals/calibration.json or explicit development budgets');
  return { fastBudget: calibration.recommendedFastBudget, slowBudget: calibration.recommendedSlowBudget };
}

function checkpointRange(source, checkpoint) {
  return {
    source,
    startSeed: checkpoint.sourceStart,
    scannedCount: checkpoint.scannedCount,
    endSeed: checkpoint.scannedCount > 0 ? checkpoint.sourceStart + checkpoint.scannedCount - 1 : checkpoint.sourceStart - 1,
  };
}

export async function generateReleaseCatalog({
  standardTotal = 40_000,
  dailyDays = RELEASE_DAILY_DAYS,
  jobs = 4,
  scanBatch = Math.max(128, jobs * 32),
  dailyScheduleStart = DAILY_SCHEDULE_START,
  root = ROOT,
  solveSeed = defaultSolveSeed,
  verifyProofRecord = defaultVerifyProofRecord,
  fastBudget,
  slowBudget,
} = {}) {
  const quotas = standardQuotasForTotal(standardTotal);
  const paths = releasePaths(root);
  const budgets = resolveBudgets({ root, standardTotal, dailyDays, fastBudget, slowBudget });
  let standard = null;
  let daily = null;
  let standardCheckpoint = readCheckpoint(paths.standardCheckpoint);
  let dailyCheckpoint = readCheckpoint(paths.dailyCheckpoint);

  while (standard === null || daily === null) {
    if (standard === null) {
      standard = tryStandard(await acceptedCandidateRecords(paths.standardCandidates), quotas);
      if (standard === null) {
        standardCheckpoint = await scanRange({
          source: 'standard', startSeed: STANDARD_SOURCE_START, maxSeeds: DAILY_SOURCE_START - STANDARD_SOURCE_START,
          checkpointPath: paths.standardCheckpoint, outputPath: paths.standardCandidates,
          stopAfter: scanBatch, batchSize: scanBatch, jobs, solveSeed, verifyProofRecord, ...budgets,
        });
        process.stdout.write(`[deals] standard scanned=${standardCheckpoint.scannedCount} verified=${standardCheckpoint.acceptedCount}\n`);
      }
    }
    if (daily === null) {
      daily = tryDaily(await acceptedCandidateRecords(paths.dailyCandidates), dailyScheduleStart, dailyDays);
      if (daily === null) {
        dailyCheckpoint = await scanRange({
          source: 'daily', startSeed: DAILY_SOURCE_START, maxSeeds: MAX_UINT32 - DAILY_SOURCE_START + 1,
          checkpointPath: paths.dailyCheckpoint, outputPath: paths.dailyCandidates,
          stopAfter: scanBatch, batchSize: scanBatch, jobs, solveSeed, verifyProofRecord, ...budgets,
        });
        process.stdout.write(`[deals] daily scanned=${dailyCheckpoint.scannedCount} verified=${dailyCheckpoint.acceptedCount}\n`);
      }
    }
  }

  standardCheckpoint = readCheckpoint(paths.standardCheckpoint) ?? standardCheckpoint;
  dailyCheckpoint = readCheckpoint(paths.dailyCheckpoint) ?? dailyCheckpoint;
  const rejectedVerificationCount = (standardCheckpoint?.rejectedVerificationCount ?? 0) + (dailyCheckpoint?.rejectedVerificationCount ?? 0);
  if (rejectedVerificationCount !== 0) throw new Error(`Release blocked: rejected verification count is ${rejectedVerificationCount}`);
  validateReleaseData({ standard, dailySchedule: daily.schedule, quotas, dailyDays, dailyScheduleStart });

  const standardSeeds = Object.fromEntries(TIERS.map((tier) => [tier, standard[tier].map((record) => record.seed)]));
  const dailySeeds = daily.schedule.map((row) => row.seed);
  const audit = {
    fastNodeBudget: budgets.fastBudget,
    slowNodeBudget: budgets.slowBudget,
    sourceScanRanges: [
      ...(standardCheckpoint ? [checkpointRange('standard', standardCheckpoint)] : []),
      ...(dailyCheckpoint ? [checkpointRange('daily', dailyCheckpoint)] : []),
    ],
    rejectedVerificationCount,
    crossPoolDuplicateCount: 0,
    solverSourceHash: hashSourceFiles(root, ['tools/trifold_solver.cpp']),
    gameRulesSourceHash: hashSourceFiles(root, GAME_RULE_SOURCE_FILES),
  };
  const asset = buildVerifiedDealAsset({ standard: standardSeeds, daily: dailySeeds, dailyScheduleStart, audit });
  writeVerifiedDealAssets({ binary: asset.binary, manifest: asset.manifest, binaryPath: paths.binary, manifestPath: paths.manifest });

  process.stdout.write(`standard onboarding=${quotas.onboarding} easy=${quotas.easy} medium=${quotas.medium} hard=${quotas.hard} total=${standardTotal}\n`);
  process.stdout.write(`daily length=${dailyDays} start=${dailyScheduleStart}\n`);
  process.stdout.write('crossPoolDuplicates=0\n');
  process.stdout.write('rejectedVerification=0\n');
  process.stdout.write('status=READY_TO_SHIP\n');
  return { ...asset, standard, dailySchedule: daily.schedule };
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error(`Invalid argument near ${key}`);
    options[key.slice(2)] = argv[++index];
  }
  const integer = (key, fallback, min = 1) => {
    if (options[key] === undefined) return fallback;
    const value = Number(options[key]);
    if (!Number.isSafeInteger(value) || value < min) throw new RangeError(`--${key} must be >= ${min}`);
    return value;
  };
  return {
    standardTotal: integer('standard-total', 40_000, 4),
    dailyDays: integer('daily-days', RELEASE_DAILY_DAYS),
    jobs: integer('jobs', 4),
    scanBatch: integer('scan-batch', undefined) ?? undefined,
    dailyScheduleStart: options['daily-start'] ?? DAILY_SCHEDULE_START,
    fastBudget: options['fast-budget'] === undefined ? undefined : integer('fast-budget', undefined),
    slowBudget: options['slow-budget'] === undefined ? undefined : integer('slow-budget', undefined),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await generateReleaseCatalog(parseCli(process.argv.slice(2))); }
  catch (error) { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; }
}
