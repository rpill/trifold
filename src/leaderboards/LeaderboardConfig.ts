import type { MasteryRank, MetaSave } from '../meta/MetaSave.ts';

export type GlobalLeaderboardMode = 'daily' | 'streak' | 'mastery';

export const DAILY_LEADERBOARD_NAME = 'trifolddaily';
export const STREAK_LEADERBOARD_NAME = 'trifoldstreak';
export const MASTERY_LEADERBOARD_NAME = 'trifoldmastery';

export const LEADERBOARD_NAMES = {
  daily: DAILY_LEADERBOARD_NAME,
  streak: STREAK_LEADERBOARD_NAME,
  mastery: MASTERY_LEADERBOARD_NAME,
} as const satisfies Record<GlobalLeaderboardMode, string>;

export const DAILY_DAY_SCALE = 1_000_000_000_000;
export const DAILY_TIME_SCALE = 100_000_000;
const DAILY_SCORE_BASE = 1_000_000_000_000_000;
const DAY_MS = 86_400_000;
const DAILY_EPOCH_MS = Date.UTC(2026, 0, 1);
const DAILY_MAX_DAY_INDEX = 7304;
const STREAK_SCALE = 100_000;
const STREAK_LIMIT = STREAK_SCALE - 1;
const MASTERY_SCORE_SCALE = 1_000_000_000;
const RANKS: readonly MasteryRank[] = ['novice','player','tactician','expert','master','grandmaster'];

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer.`);
  return value;
}

export function getLeaderboardName(mode: GlobalLeaderboardMode): string {
  return LEADERBOARD_NAMES[mode];
}

export function encodeDailyScore(dailyOffset: number, moves: number, activeMs: number): number {
  safeInteger(dailyOffset, 'dailyOffset');
  safeInteger(moves, 'moves');
  safeInteger(activeMs, 'activeMs');
  if (dailyOffset < 0 || dailyOffset > 7304) throw new RangeError('dailyOffset is outside the release schedule.');
  if (moves <= 0 || moves > 9999) throw new RangeError('moves must be in 1..9999.');
  if (activeMs <= 0 || activeMs >= DAILY_TIME_SCALE) throw new RangeError('activeMs is outside the supported range.');
  const composite = moves * DAILY_TIME_SCALE + activeMs;
  const withinDay = DAILY_DAY_SCALE - 1 - composite;
  if (withinDay < 0) throw new RangeError('Daily composite score exceeds one day block.');
  const score = (dailyOffset + 1) * DAILY_DAY_SCALE + withinDay;
  if (!Number.isSafeInteger(score)) throw new RangeError('Encoded Daily score is not a safe integer.');
  return score;
}

export function decodeDailyScore(score: number): { dailyOffset: number; moves: number; activeMs: number } {
  safeInteger(score, 'score');
  if (score <= 0) throw new RangeError('score must be positive.');
  const dayBlock = Math.floor(score / DAILY_DAY_SCALE);
  const dailyOffset = dayBlock - 1;
  const withinDay = score - dayBlock * DAILY_DAY_SCALE;
  const composite = DAILY_DAY_SCALE - 1 - withinDay;
  const moves = Math.floor(composite / DAILY_TIME_SCALE);
  const activeMs = composite - moves * DAILY_TIME_SCALE;
  encodeDailyScore(dailyOffset, moves, activeMs);
  return { dailyOffset, moves, activeMs };
}


function parseDailyIndex(dailyId: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dailyId)) return null;
  const timestamp = Date.parse(`${dailyId}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== dailyId) return null;
  const delta = timestamp - DAILY_EPOCH_MS;
  if (delta < 0 || delta % DAY_MS !== 0) return null;
  const index = delta / DAY_MS;
  return Number.isSafeInteger(index) && index <= DAILY_MAX_DAY_INDEX ? index : null;
}

function formatDailyIndex(index: number): string | null {
  if (!Number.isSafeInteger(index) || index < 0 || index > DAILY_MAX_DAY_INDEX) return null;
  return new Date(DAILY_EPOCH_MS + index * DAY_MS).toISOString().slice(0, 10);
}

export function encodeDailyLeaderboardScore(dailyId: string, moves: number, elapsedMs: number): number {
  const dayIndex = parseDailyIndex(dailyId);
  const roundedMoves = Math.round(moves);
  const duration = Math.round(elapsedMs);
  if (dayIndex === null || !Number.isSafeInteger(roundedMoves) || roundedMoves <= 0 || roundedMoves > 9999
      || !Number.isSafeInteger(duration) || duration <= 0 || duration >= DAILY_TIME_SCALE) {
    throw new RangeError('Daily leaderboard score requires a valid day, positive moves, and bounded duration.');
  }
  const rankWithinDay = (10_000 - roundedMoves) * DAILY_TIME_SCALE + (DAILY_TIME_SCALE - duration);
  const score = DAILY_SCORE_BASE + dayIndex * DAILY_DAY_SCALE + rankWithinDay;
  if (!Number.isSafeInteger(score) || score <= 0) throw new RangeError('Daily leaderboard score exceeds safe integer range.');
  return score;
}

export function decodeDailyLeaderboardScore(score: number): { readonly dailyId: string; readonly moves: number; readonly elapsedMs: number } | null {
  if (!Number.isSafeInteger(score) || score < DAILY_SCORE_BASE) return null;
  const payload = score - DAILY_SCORE_BASE;
  const dayIndex = Math.floor(payload / DAILY_DAY_SCALE);
  const rankWithinDay = payload - dayIndex * DAILY_DAY_SCALE;
  const dailyId = formatDailyIndex(dayIndex);
  if (dailyId === null || rankWithinDay <= 0 || rankWithinDay >= DAILY_DAY_SCALE) return null;
  const invertedMoves = Math.floor(rankWithinDay / DAILY_TIME_SCALE);
  const timeRemainder = rankWithinDay - invertedMoves * DAILY_TIME_SCALE;
  const moves = 10_000 - invertedMoves;
  const elapsedMs = DAILY_TIME_SCALE - timeRemainder;
  if (moves <= 0 || moves > 9999 || elapsedMs <= 0 || elapsedMs >= DAILY_TIME_SCALE) return null;
  return { dailyId, moves, elapsedMs };
}

export function encodeStreakScore(current: number, best = current): number {
  safeInteger(current, 'current');
  safeInteger(best, 'best');
  if (current < 0 || current > STREAK_LIMIT || best < current || best > STREAK_LIMIT) {
    throw new RangeError('Daily streak is outside the supported range.');
  }
  return 1 + current * STREAK_SCALE + best;
}

export function decodeStreakScore(score: number): { readonly current: number; readonly best: number } {
  safeInteger(score, 'score');
  if (score <= 0) throw new RangeError('score must be positive.');
  const payload = score - 1;
  const current = Math.floor(payload / STREAK_SCALE);
  const best = payload - current * STREAK_SCALE;
  if (current < 0 || current > STREAK_LIMIT || best < current || best > STREAK_LIMIT) {
    throw new RangeError('Daily streak score is invalid.');
  }
  return { current, best };
}

export function lifetimeMasteryPoints(meta: MetaSave): number {
  const onboarding = new Set(meta.standard.completed.onboarding).size;
  const easy = new Set(meta.standard.completed.easy).size;
  const medium = new Set(meta.standard.completed.medium).size;
  const hard = new Set(meta.standard.completed.hard).size;
  const daily = new Set(meta.futurePrestige.onTimeDailyDates).size;
  return Math.min(999_999_999, onboarding + easy + 2 * medium + 3 * hard + 2 * daily);
}

export function encodeMasteryScore(meta: MetaSave): number {
  const ordinal = RANKS.indexOf(meta.mastery.rank) + 1;
  const points = lifetimeMasteryPoints(meta);
  if (ordinal <= 0 || !Number.isSafeInteger(points) || points < 0 || points >= MASTERY_SCORE_SCALE) {
    throw new RangeError('Mastery score is outside the supported range.');
  }
  return ordinal * MASTERY_SCORE_SCALE + points;
}

export function decodeMasteryScore(score: number): { rank: MasteryRank; points: number } {
  safeInteger(score, 'score');
  if (score <= 0) throw new RangeError('score must be positive.');
  const ordinal = Math.floor(score / MASTERY_SCORE_SCALE);
  const rank = RANKS[ordinal - 1];
  const points = score - ordinal * MASTERY_SCORE_SCALE;
  if (!rank || points < 0 || points >= MASTERY_SCORE_SCALE) throw new RangeError('Mastery score is invalid.');
  return { rank, points };
}
