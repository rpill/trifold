import { claimCoinRewardOnce } from '../economy/CoinRewards.ts';
import { recordMasteryEligibleDailyWin } from '../mastery/Mastery.ts';
import type { AttemptRecord, MasteryRank, PlayerProfileV1 } from '../profile/ProfileTypes.ts';
import { deriveBestStreak } from './DailyHistory.ts';
import { parseDateKey } from './DailyDate.ts';

export interface DailyWinInput {
  readonly dailyDateKey: string;
  readonly completionDateKey: string;
  readonly moves: number;
  readonly activeMs: number;
}

export interface DailyWinSettlementResult {
  readonly profile: PlayerProfileV1;
  readonly coinsGranted: number;
  readonly firstCompletion: boolean;
  readonly completedOnTime: boolean;
  readonly officialResult: AttemptRecord | null;
  readonly personalBest: AttemptRecord;
  readonly masteryAdvanced: boolean;
  readonly rankAdvancedTo: MasteryRank | null;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

export function isBetterAttempt(candidate: AttemptRecord, current: AttemptRecord): boolean {
  return candidate.moves < current.moves
    || (candidate.moves === current.moves && candidate.activeMs < current.activeMs);
}

export function settleDailyWin(profile: PlayerProfileV1, input: DailyWinInput): DailyWinSettlementResult {
  parseDateKey(input.dailyDateKey);
  parseDateKey(input.completionDateKey);
  nonNegativeInteger(input.moves, 'moves');
  nonNegativeInteger(input.activeMs, 'activeMs');

  const existing = profile.daily.history[input.dailyDateKey];
  const firstCompletion = existing?.completed !== true;
  const onTimeNow = input.dailyDateKey === input.completionDateKey;
  const completedOnTime = existing?.completedOnTime ?? onTimeNow;
  const candidate: AttemptRecord = { moves: input.moves, activeMs: input.activeMs };
  const officialResult = existing?.officialResult ?? (firstCompletion && onTimeNow ? candidate : null);
  const personalBest = !existing?.personalBest || isBetterAttempt(candidate, existing.personalBest)
    ? candidate
    : existing.personalBest;

  let next: PlayerProfileV1 = {
    ...profile,
    daily: {
      ...profile.daily,
      history: {
        ...profile.daily.history,
        [input.dailyDateKey]: {
          dateKey: input.dailyDateKey,
          completed: true,
          completedOnTime,
          officialResult,
          personalBest,
          firstCompletionRewardClaimed: existing?.firstCompletionRewardClaimed ?? firstCompletion,
        },
      },
    },
  };

  let coinsGranted = 0;
  if (firstCompletion) {
    const amount = onTimeNow ? 15 : 5;
    const beforeCoins = next.coins;
    next = claimCoinRewardOnce(next, `daily:first:${input.dailyDateKey}`, amount);
    coinsGranted = next.coins - beforeCoins;
  }

  let masteryAdvanced = false;
  let rankAdvancedTo: MasteryRank | null = null;
  if (firstCompletion && onTimeNow) {
    const mastery = recordMasteryEligibleDailyWin(next, input.dailyDateKey);
    next = mastery.profile;
    masteryAdvanced = mastery.masteryAdvanced;
    rankAdvancedTo = mastery.rankAdvancedTo;
  }

  const bestStreak = Math.max(next.daily.bestStreak, deriveBestStreak(next.daily.history));
  next = { ...next, daily: { ...next.daily, bestStreak } };

  return {
    profile: next,
    coinsGranted,
    firstCompletion,
    completedOnTime,
    officialResult,
    personalBest,
    masteryAdvanced,
    rankAdvancedTo,
  };
}
