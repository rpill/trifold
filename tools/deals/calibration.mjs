import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveSeed } from './solver-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'artifacts', 'deals', 'calibration.json');

function percentileNearestRank(sorted, percentile) {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
}

function roundUp(value, quantum) {
  return Math.ceil(value / quantum) * quantum;
}

export function recommendBudgets(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const solvedNodes = [];
  for (const record of records) {
    if (record?.status !== 'SOLVED') continue;
    if (!Number.isSafeInteger(record.nodes) || record.nodes < 0) throw new RangeError(`Invalid solved nodes: ${String(record.nodes)}`);
    solvedNodes.push(record.nodes);
  }
  solvedNodes.sort((a, b) => a - b);
  const p90Nodes = percentileNearestRank(solvedNodes, 0.90);
  const p99Nodes = percentileNearestRank(solvedNodes, 0.99);
  let recommendedFastBudget = Math.max(10_000, roundUp(p90Nodes, 10_000));
  let recommendedSlowBudget = Math.max(50_000, roundUp(2 * p99Nodes, 50_000));
  if (recommendedSlowBudget <= recommendedFastBudget) {
    recommendedSlowBudget = roundUp(recommendedFastBudget + 1, 50_000);
    if (recommendedSlowBudget <= recommendedFastBudget) recommendedSlowBudget += 50_000;
  }
  return {
    solvedCount: solvedNodes.length,
    p90Nodes,
    p99Nodes,
    recommendedFastBudget,
    recommendedSlowBudget,
    sufficient: solvedNodes.length >= 1_000,
  };
}

function parseArgs(argv) {
  const options = { count: 10_000, jobs: 4, start: 1, ceilingBudget: 5_000_000, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      if (index + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return argv[index];
    };
    if (arg === '--count') options.count = Number(next());
    else if (arg === '--jobs') options.jobs = Number(next());
    else if (arg === '--start') options.start = Number(next());
    else if (arg === '--ceiling-budget') options.ceilingBudget = Number(next());
    else if (arg === '--output') options.output = path.resolve(next());
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isSafeInteger(options.count) || options.count < 1) throw new RangeError('--count must be >= 1');
  if (!Number.isSafeInteger(options.jobs) || options.jobs < 1) throw new RangeError('--jobs must be >= 1');
  if (!Number.isSafeInteger(options.start) || options.start < 1 || options.start > 0xffff_ffff) throw new RangeError('--start must be positive uint32');
  if (options.start + options.count - 1 > 0xffff_ffff) throw new RangeError('calibration seed range exceeds uint32');
  if (!Number.isSafeInteger(options.ceilingBudget) || options.ceilingBudget < 1) throw new RangeError('--ceiling-budget must be >= 1');
  return options;
}

async function mapConcurrent(items, jobs, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, () => run()));
  return results;
}

export async function runCalibration({ count = 10_000, jobs = 4, start = 1, ceilingBudget = 5_000_000, output = DEFAULT_OUTPUT, solve = solveSeed } = {}) {
  const seeds = Array.from({ length: count }, (_, index) => start + index);
  const records = await mapConcurrent(seeds, jobs, async (seed, index) => {
    const record = await solve({ seed, budget: ceilingBudget });
    if ((index + 1) % 500 === 0 || index + 1 === seeds.length) {
      process.stdout.write(`[calibration] ${index + 1}/${seeds.length}\n`);
    }
    return record;
  });
  const recommendation = recommendBudgets(records);
  const statusCounts = { SOLVED: 0, UNSOLVABLE: 0, UNDETERMINED: 0 };
  for (const record of records) statusCounts[record.status] += 1;
  const report = {
    version: 1,
    startSeed: start,
    sampleSize: count,
    ceilingBudget,
    statusCounts,
    ...recommendation,
  };
  mkdirSync(path.dirname(output), { recursive: true });
  const tmp = `${output}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(tmp, output);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = await runCalibration(options);
    console.log(JSON.stringify(report, null, 2));
    if (!report.sufficient) console.warn('[calibration] insufficient solved sample for release generation');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
