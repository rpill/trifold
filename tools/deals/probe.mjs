import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DAILY_BANDS, generateDailySchedule } from './daily-schedule.mjs';
import { isOnboardingCandidate, partitionStandard, scorePopulation, standardQuotasForTotal } from './difficulty.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DAY_MS = 86_400_000;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function readCandidateSnapshot(filePath) {
  if (!existsSync(filePath)) return { records: [], size: 0, trailingIgnored: false };
  const size = statSync(filePath).size;
  if (size === 0) return { records: [], size: 0, trailingIgnored: false };
  const input = createReadStream(filePath, { start: 0, end: size - 1 });
  input.setEncoding('utf8');
  let carry = '';
  const records = [];
  let lineNumber = 0;
  for await (const chunk of input) {
    carry += chunk;
    while (true) {
      const newline = carry.indexOf('\n');
      if (newline < 0) break;
      const line = carry.slice(0, newline);
      carry = carry.slice(newline + 1);
      lineNumber += 1;
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (Array.isArray(record?.proof)) delete record.proof;
        records.push(record);
      } catch (error) {
        throw new Error(`Invalid candidate JSONL ${filePath}:${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { records, size, trailingIgnored: carry.trim().length > 0 };
}

function verified(records) {
  return records.filter((record) => record?.status === 'SOLVED' && record?.verification?.metrics && !record?.rejectionReason);
}

function requiredWeekdays(startDailyId, length) {
  const start = Date.parse(`${startDailyId}T00:00:00Z`);
  if (!Number.isFinite(start)) throw new Error(`Invalid daily start: ${startDailyId}`);
  const counts = Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, 0]));
  for (let offset = 0; offset < length; offset += 1) {
    const weekday = new Date(start + offset * DAY_MS).getUTCDay();
    counts[weekday] += 1;
  }
  return counts;
}

export async function probeReadiness({
  standardCandidatesPath,
  dailyCandidatesPath,
  standardTotal = 40_000,
  dailyDays = 7_305,
  dailyStart = '2026-01-01',
} = {}) {
  const [standardSnapshot, dailySnapshot] = await Promise.all([
    readCandidateSnapshot(standardCandidatesPath),
    readCandidateSnapshot(dailyCandidatesPath),
  ]);
  const quotas = standardQuotasForTotal(standardTotal);
  const standardVerified = verified(standardSnapshot.records);
  const dailyVerified = verified(dailySnapshot.records);

  let standardStatus = 'NOT_READY';
  let standardPartitions = null;
  if (standardVerified.length >= standardTotal) {
    try {
      standardPartitions = partitionStandard(scorePopulation(standardVerified), quotas);
      standardStatus = 'READY';
    } catch (error) {
      if (!/cannot fill/iu.test(String(error?.message ?? error))) throw error;
    }
  }
  const standardScored = standardVerified.length > 0 ? scorePopulation(standardVerified) : [];
  const onboardingCandidates = standardScored.filter(isOnboardingCandidate).filter((record) => record.difficultyScore <= 95).length;
  const eligibleStandard = standardScored.filter((record) => record.difficultyScore <= 95).length;

  const requiredByWeekday = requiredWeekdays(dailyStart, dailyDays);
  const dailyScored = dailyVerified.length > 0 ? scorePopulation(dailyVerified) : [];
  const candidatesByWeekday = {};
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const [low, high] = DAILY_BANDS[weekday];
    candidatesByWeekday[weekday] = dailyScored.filter(
      (record) => record.difficultyScore >= low && record.difficultyScore <= high && record.difficultyScore <= 95,
    ).length;
  }
  let dailyStatus = 'NOT_READY';
  if (dailyVerified.length >= dailyDays) {
    try {
      generateDailySchedule(dailyScored, { startDailyId: dailyStart, length: dailyDays });
      dailyStatus = 'READY';
    } catch (error) {
      if (!/insufficient daily candidates/iu.test(String(error?.message ?? error))) throw error;
    }
  }

  return {
    standard: {
      scanned: standardSnapshot.records.length,
      verified: standardVerified.length,
      size: standardSnapshot.size,
      trailingIgnored: standardSnapshot.trailingIgnored,
      target: standardTotal,
      quotas,
      onboardingCandidates,
      eligibleStandard,
      partitions: standardPartitions,
      status: standardStatus,
    },
    daily: {
      scanned: dailySnapshot.records.length,
      verified: dailyVerified.length,
      size: dailySnapshot.size,
      trailingIgnored: dailySnapshot.trailingIgnored,
      target: dailyDays,
      start: dailyStart,
      requiredByWeekday,
      candidatesByWeekday,
      status: dailyStatus,
    },
  };
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error(`Invalid argument near ${key}`);
    options[key.slice(2)] = argv[++index];
  }
  const int = (key, fallback) => {
    if (options[key] === undefined) return fallback;
    const value = Number(options[key]);
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`--${key} must be >= 1`);
    return value;
  };
  return {
    standardTotal: int('standard-total', 40_000),
    dailyDays: int('daily-days', 7_305),
    dailyStart: options['daily-start'] ?? '2026-01-01',
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}

export function printProbe(result) {
  const s = result.standard;
  console.log('STANDARD');
  console.log(`snapshot scanned=${s.scanned} verified=${s.verified} size=${formatBytes(s.size)} trailingIgnored=${s.trailingIgnored ? 1 : 0}`);
  console.log(`target=${s.target} onboarding=${s.quotas.onboarding} easy=${s.quotas.easy} medium=${s.quotas.medium} hard=${s.quotas.hard}`);
  console.log(`onboardingCandidates=${s.onboardingCandidates} eligibleScoreLe95=${s.eligibleStandard}`);
  console.log(`status=${s.status}`);
  console.log('');
  const d = result.daily;
  console.log('DAILY');
  console.log(`snapshot scanned=${d.scanned} verified=${d.verified} size=${formatBytes(d.size)} trailingIgnored=${d.trailingIgnored ? 1 : 0}`);
  console.log(`target=${d.target} start=${d.start}`);
  for (let weekday = 1; weekday <= 6; weekday += 1) {
    const [low, high] = DAILY_BANDS[weekday];
    console.log(`${WEEKDAY_NAMES[weekday]} band=${low}..${high} required=${d.requiredByWeekday[weekday]} candidates=${d.candidatesByWeekday[weekday]}`);
  }
  const [low, high] = DAILY_BANDS[0];
  console.log(`Sun band=${low}..${high} required=${d.requiredByWeekday[0]} candidates=${d.candidatesByWeekday[0]}`);
  console.log(`status=${d.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseCli(process.argv.slice(2));
    const result = await probeReadiness({
      ...options,
      standardCandidatesPath: path.join(ROOT, 'artifacts', 'deals', 'standard', 'candidates.jsonl'),
      dailyCandidatesPath: path.join(ROOT, 'artifacts', 'deals', 'daily', 'candidates.jsonl'),
    });
    printProbe(result);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  }
}
