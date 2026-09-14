export const DIFFICULTY_MODEL_VERSION = 1;

export const DIFFICULTY_WEIGHTS = Object.freeze({
  solverNodes: 0.30,
  decisionActions: 0.20,
  rearrangementMoves: 0.20,
  freeCellTouches: 0.15,
  earlyProgressActions: 0.10,
  blockedDragonPressure: 0.05,
});

const METRIC_KEYS = Object.freeze(Object.keys(DIFFICULTY_WEIGHTS));
export const STANDARD_40K_QUOTAS = Object.freeze({
  onboarding: 500,
  easy: 13_167,
  medium: 15_361,
  hard: 10_972,
});
const STANDARD_TIERS = Object.freeze(['onboarding', 'easy', 'medium', 'hard']);

function requireFiniteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${label} must be a non-negative finite number`);
  return number;
}

function averageRankPercentiles(values) {
  if (values.length === 0) return [];
  if (values.length === 1) return [0];
  const sorted = values.map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const result = new Array(values.length);
  for (let cursor = 0; cursor < sorted.length;) {
    let end = cursor + 1;
    while (end < sorted.length && Object.is(sorted[end].value, sorted[cursor].value)) end += 1;
    const averageRank = (cursor + end - 1) / 2;
    const percentile = averageRank / (sorted.length - 1) * 100;
    for (let index = cursor; index < end; index += 1) result[sorted[index].index] = percentile;
    cursor = end;
  }
  return result;
}

function readMetrics(record) {
  const metrics = record?.verification?.metrics;
  if (!metrics || typeof metrics !== 'object') throw new TypeError(`seed ${String(record?.seed)} missing verification.metrics`);
  return {
    decisionActions: requireFiniteNumber(metrics.decisionActions, 'decisionActions'),
    rearrangementMoves: requireFiniteNumber(metrics.rearrangementMoves, 'rearrangementMoves'),
    freeCellTouches: requireFiniteNumber(metrics.freeCellTouches, 'freeCellTouches'),
    earlyProgressActions: requireFiniteNumber(metrics.earlyProgressActions, 'earlyProgressActions'),
    blockedDragonPressure: requireFiniteNumber(metrics.blockedDragonPressure, 'blockedDragonPressure'),
  };
}

export function scorePopulation(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (records.length === 0) return [];
  const enriched = records.map((record) => {
    const solverNodes = requireFiniteNumber(record.nodes ?? record.solverNodes, `seed ${String(record.seed)} solver nodes`);
    const metrics = readMetrics(record);
    return {
      ...record,
      difficultyMetrics: metrics,
      difficultyInputs: { solverNodes: Math.log1p(solverNodes), ...metrics },
    };
  });
  const columns = Object.fromEntries(METRIC_KEYS.map((key) => [
    key,
    averageRankPercentiles(enriched.map((record) => record.difficultyInputs[key])),
  ]));
  const composite = enriched.map((record, index) => {
    const difficultyPercentiles = Object.fromEntries(METRIC_KEYS.map((key) => [key, columns[key][index]]));
    const difficultyCompositeScore = METRIC_KEYS.reduce(
      (sum, key) => sum + difficultyPercentiles[key] * DIFFICULTY_WEIGHTS[key], 0,
    );
    return { ...record, difficultyPercentiles, difficultyCompositeScore };
  });
  const scores = averageRankPercentiles(composite.map((record) => record.difficultyCompositeScore));
  return composite.map((record, index) => ({ ...record, difficultyScore: scores[index] }));
}

export function isOnboardingCandidate(record) {
  const p = record?.difficultyPercentiles;
  return Number(record?.difficultyScore) <= 20
    && Number(p?.freeCellTouches) <= 35
    && Number(p?.rearrangementMoves) <= 35
    && Number(p?.earlyProgressActions) <= 25;
}

export function standardQuotasForTotal(total) {
  if (!Number.isSafeInteger(total) || total < 4) throw new RangeError(`standard-total must be >= 4, got ${String(total)}`);
  if (total === 40_000) return { ...STANDARD_40K_QUOTAS };
  const exact = STANDARD_TIERS.map((tier, index) => ({
    tier, index,
    exact: STANDARD_40K_QUOTAS[tier] * total / 40_000,
    value: Math.max(1, Math.floor(STANDARD_40K_QUOTAS[tier] * total / 40_000)),
  }));
  const onboarding = exact.find((row) => row.tier === 'onboarding');
  onboarding.value = Math.min(500, onboarding.value);
  let assigned = exact.reduce((sum, row) => sum + row.value, 0);
  const byRemainder = [...exact].sort((a, b) =>
    (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) || a.index - b.index);
  while (assigned < total) {
    let progressed = false;
    for (const row of byRemainder) {
      if (assigned >= total) break;
      if (row.tier === 'onboarding' && row.value >= 500) continue;
      row.value += 1;
      assigned += 1;
      progressed = true;
    }
    if (!progressed) throw new Error('Unable to scale Standard quotas');
  }
  while (assigned > total) {
    let progressed = false;
    for (const row of [...byRemainder].reverse()) {
      if (assigned <= total) break;
      if (row.value <= 1) continue;
      row.value -= 1;
      assigned -= 1;
      progressed = true;
    }
    if (!progressed) throw new Error('Unable to scale Standard quotas');
  }
  return Object.fromEntries(exact.map((row) => [row.tier, row.value]));
}

function quotaValue(quotas, key) {
  const value = quotas[key];
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`Invalid ${key} quota: ${String(value)}`);
  return value;
}

export function partitionStandard(records, quotas = STANDARD_40K_QUOTAS) {
  const required = Object.fromEntries(STANDARD_TIERS.map((tier) => [tier, quotaValue(quotas, tier)]));
  const eligible = records.filter((record) => Number(record.difficultyScore) <= 95);
  const onboardingCandidates = eligible.filter(isOnboardingCandidate)
    .sort((a, b) => a.difficultyScore - b.difficultyScore || a.seed - b.seed);
  if (onboardingCandidates.length < required.onboarding) {
    throw new Error(`Cannot fill onboarding quota: need ${required.onboarding}, have ${onboardingCandidates.length}`);
  }
  const onboarding = onboardingCandidates.slice(0, required.onboarding);
  const onboardingSeeds = new Set(onboarding.map((record) => record.seed));
  const remaining = eligible.filter((record) => !onboardingSeeds.has(record.seed))
    .sort((a, b) => a.difficultyScore - b.difficultyScore || a.seed - b.seed);
  const remainingNeeded = required.easy + required.medium + required.hard;
  if (remaining.length < remainingNeeded) {
    throw new Error(`Cannot fill Standard quota: need ${remainingNeeded} non-onboarding deals, have ${remaining.length}`);
  }
  let cursor = 0;
  const take = (count) => { const slice = remaining.slice(cursor, cursor + count); cursor += count; return slice; };
  const partitions = { onboarding, easy: take(required.easy), medium: take(required.medium), hard: take(required.hard) };
  const allSeeds = Object.values(partitions).flat().map((record) => record.seed);
  if (new Set(allSeeds).size !== allSeeds.length) throw new Error('Standard partition contains duplicate seeds');
  return partitions;
}
