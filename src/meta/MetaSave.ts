export const META_SAVE_VERSION = 1 as const;
export const DAILY_ALGORITHM_VERSION = 1 as const;

export type StandardDifficulty = 'easy' | 'medium' | 'hard';
export type StandardPartition = 'onboarding' | StandardDifficulty;
export type MasteryRank = 'novice' | 'player' | 'tactician' | 'expert' | 'master' | 'grandmaster';

export interface AttemptRecord {
  readonly moves: number;
  readonly activeMs: number;
}

export interface MasteryStageProgress {
  readonly anyWins: number;
  readonly mediumWins: number;
  readonly hardWins: number;
  readonly onTimeDailyWins: number;
}

export interface DailyRecord {
  readonly completed: boolean;
  readonly completedOnTime: boolean;
  readonly attempts: number;
  readonly officialResult?: AttemptRecord;
  readonly personalBest?: AttemptRecord;
  readonly rankingAttemptId?: string;
  readonly hintUsed?: boolean;
}

export interface DailyState {
  readonly algorithmVersion: number;
  readonly records: Readonly<Record<string, DailyRecord>>;
  /** Preserves a legacy all-time best that cannot always be reconstructed from a truncated history. */
  readonly bestStreakFloor: number;
}

export interface StandardProductState {
  readonly selectedDifficulty: StandardDifficulty;
  readonly recentSeeds: readonly number[];
  readonly completed: Readonly<Record<StandardPartition, readonly number[]>>;
  readonly masteryCreditedSeeds: readonly number[];
  readonly onboardingWins: number;
  readonly personalBests: Readonly<Record<string, AttemptRecord>>;
}

export interface StandardWinStreakState {
  readonly current: number;
  readonly best: number;
}

export interface ProductProgressionState {
  readonly startedAttempts: readonly string[];
  readonly completedAttempts: readonly string[];
  readonly receipts: Readonly<Record<string, number>>;
}

export interface MetaSave {
  readonly version: typeof META_SAVE_VERSION;
  readonly daily: DailyState;
  readonly standard: StandardProductState;
  readonly standardWinStreak: StandardWinStreakState;
  readonly progression: ProductProgressionState;
  readonly mastery: {
    readonly rank: MasteryRank;
    readonly stage: MasteryStageProgress;
  };
  readonly futurePrestige: {
    readonly mediumSeeds: readonly number[];
    readonly hardSeeds: readonly number[];
    readonly onTimeDailyDates: readonly string[];
  };
}

const DIFFICULTIES = new Set<StandardDifficulty>(['easy', 'medium', 'hard']);
const PARTITIONS = new Set<StandardPartition>(['onboarding', 'easy', 'medium', 'hard']);
const RANKS = new Set<MasteryRank>(['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster']);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/u;
const ATTEMPT_ID = /^[a-zA-Z0-9_~\-]{1,100}$/u;
const PERSONAL_BEST_KEY = /^(onboarding|easy|medium|hard):[1-9]\d*$/u;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? Math.min(value as number, max)
    : 0;
}

function normalizeSeeds(value: unknown, limit = 40_000): number[] {
  if (!Array.isArray(value)) return [];
  const result: number[] = [];
  for (const raw of value) {
    if (!Number.isSafeInteger(raw) || (raw as number) < 1) continue;
    const seed = raw as number;
    if (!result.includes(seed)) result.push(seed);
  }
  return result.slice(-limit);
}

function normalizeDateKeys(value: unknown, limit = 10_000): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || !DATE_KEY.test(raw) || result.includes(raw)) continue;
    result.push(raw);
  }
  return result.slice(-limit);
}

function normalizeAttempt(value: unknown): AttemptRecord | undefined {
  if (!isObject(value)) return undefined;
  if (!Number.isSafeInteger(value.moves) || (value.moves as number) < 0) return undefined;
  if (!Number.isFinite(value.activeMs) || (value.activeMs as number) < 0) return undefined;
  return { moves: value.moves as number, activeMs: value.activeMs as number };
}

function normalizePersonalBests(value: unknown): Record<string, AttemptRecord> {
  if (!isObject(value)) return {};
  const result: Record<string, AttemptRecord> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!PERSONAL_BEST_KEY.test(key)) continue;
    const attempt = normalizeAttempt(raw);
    if (attempt) result[key] = attempt;
  }
  return result;
}

function normalizeDailyRecord(value: unknown): DailyRecord | null {
  if (!isObject(value)) return null;
  const officialResult = normalizeAttempt(value.officialResult);
  const personalBest = normalizeAttempt(value.personalBest);
  const rankingAttemptId = typeof value.rankingAttemptId === 'string' && ATTEMPT_ID.test(value.rankingAttemptId)
    ? value.rankingAttemptId
    : undefined;
  return {
    completed: value.completed === true,
    completedOnTime: value.completedOnTime === true,
    attempts: nonNegativeInteger(value.attempts),
    ...(officialResult ? { officialResult } : {}),
    ...(personalBest ? { personalBest } : {}),
    ...(rankingAttemptId ? { rankingAttemptId } : {}),
    ...(value.hintUsed === true ? { hintUsed: true } : {}),
  };
}

function normalizeDaily(value: unknown): DailyState {
  const raw = isObject(value) ? value : {};
  const recordsRaw = isObject(raw.records) ? raw.records : {};
  const records: Record<string, DailyRecord> = {};
  for (const [dateKey, entry] of Object.entries(recordsRaw)) {
    if (!DATE_KEY.test(dateKey)) continue;
    const normalized = normalizeDailyRecord(entry);
    if (normalized) records[dateKey] = normalized;
  }
  return {
    algorithmVersion: DAILY_ALGORITHM_VERSION,
    records,
    bestStreakFloor: nonNegativeInteger(raw.bestStreakFloor),
  };
}

function normalizeStandard(value: unknown): StandardProductState {
  const raw = isObject(value) ? value : {};
  const completedRaw = isObject(raw.completed) ? raw.completed : {};
  const selectedDifficulty = typeof raw.selectedDifficulty === 'string' && DIFFICULTIES.has(raw.selectedDifficulty as StandardDifficulty)
    ? raw.selectedDifficulty as StandardDifficulty
    : 'easy';
  return {
    selectedDifficulty,
    recentSeeds: normalizeSeeds(raw.recentSeeds, 256),
    completed: {
      onboarding: normalizeSeeds(completedRaw.onboarding),
      easy: normalizeSeeds(completedRaw.easy),
      medium: normalizeSeeds(completedRaw.medium),
      hard: normalizeSeeds(completedRaw.hard),
    },
    masteryCreditedSeeds: normalizeSeeds(raw.masteryCreditedSeeds),
    onboardingWins: nonNegativeInteger(raw.onboardingWins, 5),
    personalBests: normalizePersonalBests(raw.personalBests),
  };
}

function normalizeMastery(value: unknown): MetaSave['mastery'] {
  const raw = isObject(value) ? value : {};
  const stageRaw = isObject(raw.stage) ? raw.stage : {};
  const rank = typeof raw.rank === 'string' && RANKS.has(raw.rank as MasteryRank)
    ? raw.rank as MasteryRank
    : 'novice';
  return {
    rank,
    stage: {
      anyWins: nonNegativeInteger(stageRaw.anyWins, 100_000),
      mediumWins: nonNegativeInteger(stageRaw.mediumWins, 100_000),
      hardWins: nonNegativeInteger(stageRaw.hardWins, 100_000),
      onTimeDailyWins: nonNegativeInteger(stageRaw.onTimeDailyWins, 100_000),
    },
  };
}

function normalizeFuturePrestige(value: unknown): MetaSave['futurePrestige'] {
  const raw = isObject(value) ? value : {};
  return {
    mediumSeeds: normalizeSeeds(raw.mediumSeeds),
    hardSeeds: normalizeSeeds(raw.hardSeeds),
    onTimeDailyDates: normalizeDateKeys(raw.onTimeDailyDates),
  };
}


function normalizeStrings(value: unknown, limit = 128): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 100 || result.includes(raw)) continue;
    result.push(raw);
  }
  return result.slice(-limit);
}

function normalizeProgression(value: unknown): ProductProgressionState {
  const raw = isObject(value) ? value : {};
  const receipts: Record<string, number> = {};
  if (isObject(raw.receipts)) {
    for (const [key, sequence] of Object.entries(raw.receipts)) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/u.test(key)) continue;
      if (!Number.isSafeInteger(sequence) || (sequence as number) < 0) continue;
      receipts[key] = sequence as number;
    }
  }
  return {
    startedAttempts: normalizeStrings(raw.startedAttempts),
    completedAttempts: normalizeStrings(raw.completedAttempts),
    receipts,
  };
}

function normalizeStreak(value: unknown): StandardWinStreakState {
  const raw = isObject(value) ? value : {};
  const current = nonNegativeInteger(raw.current);
  return { current, best: Math.max(current, nonNegativeInteger(raw.best)) };
}

export function createDefaultMetaSave(): MetaSave {
  return {
    version: META_SAVE_VERSION,
    daily: { algorithmVersion: DAILY_ALGORITHM_VERSION, records: {}, bestStreakFloor: 0 },
    standard: {
      selectedDifficulty: 'easy',
      recentSeeds: [],
      completed: { onboarding: [], easy: [], medium: [], hard: [] },
      masteryCreditedSeeds: [],
      onboardingWins: 0,
      personalBests: {},
    },
    standardWinStreak: { current: 0, best: 0 },
    progression: { startedAttempts: [], completedAttempts: [], receipts: {} },
    mastery: {
      rank: 'novice',
      stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
    },
    futurePrestige: { mediumSeeds: [], hardSeeds: [], onTimeDailyDates: [] },
  };
}

export function normalizeMetaSave(raw: unknown): MetaSave {
  if (!isObject(raw)) return createDefaultMetaSave();
  return {
    version: META_SAVE_VERSION,
    daily: normalizeDaily(raw.daily),
    standard: normalizeStandard(raw.standard),
    standardWinStreak: normalizeStreak(raw.standardWinStreak),
    progression: normalizeProgression(raw.progression),
    mastery: normalizeMastery(raw.mastery),
    futurePrestige: normalizeFuturePrestige(raw.futurePrestige),
  };
}

export function isStandardPartition(value: unknown): value is StandardPartition {
  return typeof value === 'string' && PARTITIONS.has(value as StandardPartition);
}
