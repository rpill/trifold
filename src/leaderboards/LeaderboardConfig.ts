import type { MasteryRank, PlayerProfileV1 } from '../meta/profile/ProfileTypes.ts';

export const DAILY_LEADERBOARD_NAME = 'trifolddaily';
export const STREAK_LEADERBOARD_NAME = 'trifoldstreak';
export const MASTERY_LEADERBOARD_NAME = 'trifoldmastery';

export const DAILY_DAY_SCALE = 1_000_000_000_000;
export const DAILY_TIME_SCALE = 100_000_000;

const RANK_ORDINAL: Readonly<Record<MasteryRank, number>> = {
  novice: 1,
  player: 2,
  tactician: 3,
  expert: 4,
  master: 5,
  grandmaster: 6,
};

const MASTERY_RANK_BY_ORDINAL: Readonly<Record<number, MasteryRank>> = Object.freeze({
  1: 'novice',
  2: 'player',
  3: 'tactician',
  4: 'expert',
  5: 'master',
  6: 'grandmaster',
});

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer.`);
  return value;
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

export function encodeStreakScore(bestStreak: number): number {
  safeInteger(bestStreak, 'bestStreak');
  if (bestStreak < 0) throw new RangeError('bestStreak must be non-negative.');
  return bestStreak;
}

export function lifetimeMasteryPoints(profile: PlayerProfileV1): number {
  const medium = new Set(profile.futurePrestige.mediumSeeds).size;
  const hard = new Set(profile.futurePrestige.hardSeeds).size;
  const daily = new Set(profile.futurePrestige.onTimeDailyDates).size;
  return Math.min(999_999_999, medium + 3 * hard + 5 * daily);
}

export function encodeMasteryScore(profile: PlayerProfileV1): number {
  const score = RANK_ORDINAL[profile.mastery.rank] * 1_000_000_000 + lifetimeMasteryPoints(profile);
  if (!Number.isSafeInteger(score)) throw new RangeError('Mastery score is not a safe integer.');
  return score;
}


export function decodeMasteryScore(score: number): { rank: MasteryRank; points: number } {
  safeInteger(score, 'score');
  if (score <= 0) throw new RangeError('score must be positive.');
  const ordinal = Math.floor(score / 1_000_000_000);
  const rank = MASTERY_RANK_BY_ORDINAL[ordinal];
  const points = score - ordinal * 1_000_000_000;
  if (!rank || points < 0 || points > 999_999_999) throw new RangeError('Mastery score is invalid.');
  return { rank, points };
}
