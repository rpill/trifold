import { claimCoinRewardOnce } from '../economy/CoinRewards.ts';
import { recordMasteryEligibleStandardWin } from '../mastery/Mastery.ts';
import type {
  AttemptRecord,
  MasteryRank,
  MasteryStageProgress,
  PlayerProfileV1,
  StandardDifficulty,
  StandardPartition,
} from '../profile/ProfileTypes.ts';

export interface StandardWinResultInput {
  readonly seed: number;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
}

export interface StandardWinMasterySnapshot {
  readonly rank: MasteryRank;
  readonly stage: MasteryStageProgress;
}

export interface StandardWinSettlementResult {
  readonly profile: PlayerProfileV1;
  readonly baseCoinsGranted: number;
  readonly rankAdvancedTo: MasteryRank | null;
  readonly masteryAdvanced: boolean;
  readonly recordAccepted: boolean;
  readonly firstCompletion: boolean;
  readonly masteryBefore: StandardWinMasterySnapshot;
  readonly masteryAfter: StandardWinMasterySnapshot;
  readonly masteryWasAlreadyCredited: boolean;
}

const BASE_COINS: Readonly<Record<StandardDifficulty, number>> = {
  easy: 5,
  medium: 7,
  hard: 10,
};

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function isBetterAttempt(candidate: AttemptRecord, current: AttemptRecord | undefined): boolean {
  if (!current) return true;
  return candidate.moves < current.moves
    || (candidate.moves === current.moves && candidate.activeMs < current.activeMs);
}

export function settleStandardWin(
  profile: PlayerProfileV1,
  input: StandardWinResultInput,
): StandardWinSettlementResult {
  if (!Number.isSafeInteger(input.seed) || input.seed < 1) throw new Error('Standard seed must be a positive integer.');
  nonNegativeInteger(input.moves, 'moves');
  nonNegativeInteger(input.activeMs, 'activeMs');
  if (input.partition === 'onboarding' && input.difficulty !== 'easy') {
    throw new Error('Onboarding wins must use easy gameplay difficulty.');
  }
  if (input.partition !== 'onboarding' && input.partition !== input.difficulty) {
    throw new Error('Standard partition and gameplay difficulty must match.');
  }

  const completed = profile.completedStandard[input.partition];
  const firstCompletion = !completed.includes(input.seed);
  const masteryBefore: StandardWinMasterySnapshot = profile.mastery;
  const masteryWasAlreadyCredited = profile.masteryCreditedStandardSeeds.includes(input.seed);
  let next: PlayerProfileV1 = profile;
  let baseCoinsGranted = 0;

  if (firstCompletion) {
    next = {
      ...next,
      completedStandard: {
        ...next.completedStandard,
        [input.partition]: [...completed, input.seed],
      },
      onboardingWins: Math.min(5, next.onboardingWins + 1),
    };
    baseCoinsGranted = BASE_COINS[input.difficulty];
    next = claimCoinRewardOnce(
      next,
      `standard:first:${input.partition}:${input.seed}`,
      baseCoinsGranted,
    );
  }

  let recordAccepted = false;
  if (!input.assisted) {
    const key = `${input.partition}:${input.seed}`;
    const candidate: AttemptRecord = { moves: input.moves, activeMs: input.activeMs };
    if (isBetterAttempt(candidate, next.standardPersonalBests[key])) {
      next = {
        ...next,
        standardPersonalBests: { ...next.standardPersonalBests, [key]: candidate },
      };
      recordAccepted = true;
    }
  }

  let masteryAdvanced = false;
  let rankAdvancedTo: MasteryRank | null = null;
  if (!input.assisted && !next.masteryCreditedStandardSeeds.includes(input.seed)) {
    const masteryResult = recordMasteryEligibleStandardWin(next, {
      seed: input.seed,
      difficulty: input.difficulty,
    });
    next = masteryResult.profile;
    masteryAdvanced = masteryResult.masteryAdvanced;
    rankAdvancedTo = masteryResult.rankAdvancedTo;
  }

  return {
    profile: next,
    baseCoinsGranted,
    rankAdvancedTo,
    masteryAdvanced,
    recordAccepted,
    firstCompletion,
    masteryBefore,
    masteryAfter: next.mastery,
    masteryWasAlreadyCredited,
  };
}
