import { claimCoinRewardOnce } from '../economy/CoinRewards.ts';
import type {
  MasteryRank,
  MasteryStageProgress,
  PlayerProfileV1,
  StandardDifficulty,
} from '../profile/ProfileTypes.ts';

export interface MasteryRequirements extends MasteryStageProgress {
  readonly rewardCoins: number;
}

export interface MasteryStandardWinInput {
  readonly seed: number;
  readonly difficulty: StandardDifficulty;
}

export interface MasteryStandardWinResult {
  readonly profile: PlayerProfileV1;
  readonly masteryAdvanced: boolean;
  readonly rankAdvancedTo: MasteryRank | null;
}

export interface MasteryDailyWinResult {
  readonly profile: PlayerProfileV1;
  readonly masteryAdvanced: boolean;
  readonly rankAdvancedTo: MasteryRank | null;
}

const ZERO_STAGE: MasteryStageProgress = {
  anyWins: 0,
  mediumWins: 0,
  hardWins: 0,
  onTimeDailyWins: 0,
};

const REQUIREMENTS: Readonly<Record<Exclude<MasteryRank, 'grandmaster'>, MasteryRequirements>> = {
  novice: { anyWins: 10, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0, rewardCoins: 100 },
  player: { anyWins: 0, mediumWins: 15, hardWins: 3, onTimeDailyWins: 0, rewardCoins: 150 },
  tactician: { anyWins: 0, mediumWins: 25, hardWins: 10, onTimeDailyWins: 0, rewardCoins: 200 },
  expert: { anyWins: 0, mediumWins: 0, hardWins: 25, onTimeDailyWins: 5, rewardCoins: 300 },
  master: { anyWins: 0, mediumWins: 0, hardWins: 60, onTimeDailyWins: 15, rewardCoins: 500 },
};

const NEXT_RANK: Readonly<Record<Exclude<MasteryRank, 'grandmaster'>, MasteryRank>> = {
  novice: 'player',
  player: 'tactician',
  tactician: 'expert',
  expert: 'master',
  master: 'grandmaster',
};

export function getMasteryRequirements(rank: MasteryRank): MasteryRequirements | null {
  if (rank === 'grandmaster') return null;
  return REQUIREMENTS[rank];
}

function meetsRequirements(stage: MasteryStageProgress, requirements: MasteryRequirements): boolean {
  return stage.anyWins >= requirements.anyWins
    && stage.mediumWins >= requirements.mediumWins
    && stage.hardWins >= requirements.hardWins
    && stage.onTimeDailyWins >= requirements.onTimeDailyWins;
}

function difficultyAdvancesCurrentStage(rank: MasteryRank, difficulty: StandardDifficulty): boolean {
  if (rank === 'novice') return true;
  if (rank === 'player' || rank === 'tactician') return difficulty === 'medium' || difficulty === 'hard';
  if (rank === 'expert' || rank === 'master') return difficulty === 'hard';
  return false;
}

function appendUnique(values: readonly number[], value: number): readonly number[] {
  return values.includes(value) ? values : [...values, value];
}


function appendUniqueString(values: readonly string[], value: string): readonly string[] {
  return values.includes(value) ? values : [...values, value];
}

export function recordMasteryEligibleDailyWin(
  profile: PlayerProfileV1,
  dateKey: string,
): MasteryDailyWinResult {
  if (typeof dateKey !== 'string' || dateKey.length === 0) throw new Error('Mastery Daily date must be non-empty.');
  if (profile.futurePrestige.onTimeDailyDates.includes(dateKey)) {
    return { profile, masteryAdvanced: false, rankAdvancedTo: null };
  }

  const currentRank = profile.mastery.rank;
  const stage: MasteryStageProgress = {
    anyWins: profile.mastery.stage.anyWins + (currentRank === 'novice' ? 1 : 0),
    mediumWins: profile.mastery.stage.mediumWins,
    hardWins: profile.mastery.stage.hardWins,
    onTimeDailyWins: profile.mastery.stage.onTimeDailyWins + (currentRank === 'expert' || currentRank === 'master' ? 1 : 0),
  };
  const advancesStage = stage.anyWins !== profile.mastery.stage.anyWins
    || stage.onTimeDailyWins !== profile.mastery.stage.onTimeDailyWins;

  let next: PlayerProfileV1 = {
    ...profile,
    mastery: { rank: currentRank, stage },
    futurePrestige: {
      ...profile.futurePrestige,
      onTimeDailyDates: appendUniqueString(profile.futurePrestige.onTimeDailyDates, dateKey),
    },
  };

  const requirements = getMasteryRequirements(currentRank);
  if (!requirements || !meetsRequirements(stage, requirements)) {
    return { profile: next, masteryAdvanced: advancesStage, rankAdvancedTo: null };
  }

  const rankAdvancedTo = NEXT_RANK[currentRank as Exclude<MasteryRank, 'grandmaster'>];
  next = {
    ...next,
    mastery: { rank: rankAdvancedTo, stage: { ...ZERO_STAGE } },
  };
  next = claimCoinRewardOnce(next, `mastery-rank:${rankAdvancedTo}`, requirements.rewardCoins);
  return { profile: next, masteryAdvanced: true, rankAdvancedTo };
}

export function recordMasteryEligibleStandardWin(
  profile: PlayerProfileV1,
  input: MasteryStandardWinInput,
): MasteryStandardWinResult {
  if (!Number.isSafeInteger(input.seed) || input.seed < 1) throw new Error('Mastery seed must be a positive integer.');
  if (profile.masteryCreditedStandardSeeds.includes(input.seed)) {
    return { profile, masteryAdvanced: false, rankAdvancedTo: null };
  }

  const currentRank = profile.mastery.rank;
  const advancesStage = difficultyAdvancesCurrentStage(currentRank, input.difficulty);
  const stage: MasteryStageProgress = {
    anyWins: profile.mastery.stage.anyWins + (currentRank === 'novice' ? 1 : 0),
    mediumWins: profile.mastery.stage.mediumWins + (input.difficulty === 'medium' && advancesStage ? 1 : 0),
    hardWins: profile.mastery.stage.hardWins + (input.difficulty === 'hard' && advancesStage ? 1 : 0),
    onTimeDailyWins: profile.mastery.stage.onTimeDailyWins,
  };

  let next: PlayerProfileV1 = {
    ...profile,
    masteryCreditedStandardSeeds: [...profile.masteryCreditedStandardSeeds, input.seed],
    mastery: { rank: currentRank, stage },
    futurePrestige: {
      ...profile.futurePrestige,
      mediumSeeds: input.difficulty === 'medium'
        ? appendUnique(profile.futurePrestige.mediumSeeds, input.seed)
        : profile.futurePrestige.mediumSeeds,
      hardSeeds: input.difficulty === 'hard'
        ? appendUnique(profile.futurePrestige.hardSeeds, input.seed)
        : profile.futurePrestige.hardSeeds,
    },
  };

  const requirements = getMasteryRequirements(currentRank);
  if (!requirements || !meetsRequirements(stage, requirements)) {
    return { profile: next, masteryAdvanced: advancesStage, rankAdvancedTo: null };
  }

  const rankAdvancedTo = NEXT_RANK[currentRank as Exclude<MasteryRank, 'grandmaster'>];
  next = {
    ...next,
    mastery: { rank: rankAdvancedTo, stage: { ...ZERO_STAGE } },
  };
  next = claimCoinRewardOnce(next, `mastery-rank:${rankAdvancedTo}`, requirements.rewardCoins);
  return { profile: next, masteryAdvanced: true, rankAdvancedTo };
}
