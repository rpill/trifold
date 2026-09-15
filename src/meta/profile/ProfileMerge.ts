import { getMasteryRequirements } from '../mastery/Mastery.ts';
import { getLaunchThemes } from '../../theme/ThemeCatalog.ts';
import { parsePlayerProfile } from './ProfileSchema.ts';
import type {
  AttemptRecord,
  DailyHistoryEntry,
  MasteryRank,
  MasteryStageProgress,
  PlayerProfileV1,
  SavedDailyAttempt,
  SavedStandardAttempt,
  StandardPartition,
} from './ProfileTypes.ts';

const RANKS: readonly MasteryRank[] = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'];
const PARTITIONS: readonly StandardPartition[] = ['onboarding', 'easy', 'medium', 'hard'];

function unionNumbers(a: readonly number[], b: readonly number[]): number[] {
  return [...new Set([...a, ...b])];
}
function unionStrings(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}
function better(a: AttemptRecord | null | undefined, b: AttemptRecord | null | undefined): AttemptRecord | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  return a.moves < b.moves || (a.moves === b.moves && a.activeMs <= b.activeMs) ? { ...a } : { ...b };
}
function newest<T extends { readonly updatedAtMs: number }>(a: T | null, b: T | null): T | null {
  if (!a) return b ? structuredClone(b) : null;
  if (!b) return structuredClone(a);
  return structuredClone(a.updatedAtMs >= b.updatedAtMs ? a : b);
}
function mergeMastery(local: PlayerProfileV1, cloud: PlayerProfileV1): PlayerProfileV1['mastery'] {
  const li = RANKS.indexOf(local.mastery.rank);
  const ci = RANKS.indexOf(cloud.mastery.rank);
  if (li > ci) return structuredClone(local.mastery);
  if (ci > li) return structuredClone(cloud.mastery);
  const rank = local.mastery.rank;
  const req = getMasteryRequirements(rank);
  const cap = (key: keyof MasteryStageProgress, value: number): number => req ? Math.min(value, req[key]) : value;
  return {
    rank,
    stage: {
      anyWins: cap('anyWins', Math.max(local.mastery.stage.anyWins, cloud.mastery.stage.anyWins)),
      mediumWins: cap('mediumWins', Math.max(local.mastery.stage.mediumWins, cloud.mastery.stage.mediumWins)),
      hardWins: cap('hardWins', Math.max(local.mastery.stage.hardWins, cloud.mastery.stage.hardWins)),
      onTimeDailyWins: cap('onTimeDailyWins', Math.max(local.mastery.stage.onTimeDailyWins, cloud.mastery.stage.onTimeDailyWins)),
    },
  };
}
function mergeDailyEntry(local: DailyHistoryEntry | undefined, cloud: DailyHistoryEntry | undefined): DailyHistoryEntry | undefined {
  if (!local) return cloud ? structuredClone(cloud) : undefined;
  if (!cloud) return structuredClone(local);
  return {
    dateKey: local.dateKey,
    completed: local.completed || cloud.completed,
    completedOnTime: local.completedOnTime || cloud.completedOnTime,
    officialResult: cloud.officialResult ? structuredClone(cloud.officialResult) : (local.officialResult ? structuredClone(local.officialResult) : null),
    personalBest: better(local.personalBest, cloud.personalBest),
    firstCompletionRewardClaimed: local.firstCompletionRewardClaimed || cloud.firstCompletionRewardClaimed,
  };
}
function mergeRecordMap(local: Readonly<Record<string, AttemptRecord>>, cloud: Readonly<Record<string, AttemptRecord>>): Record<string, AttemptRecord> {
  const result: Record<string, AttemptRecord> = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const best = better(local[key], cloud[key]);
    if (best) result[key] = best;
  }
  return result;
}

export function mergeProfiles(localInput: PlayerProfileV1, cloudInput: PlayerProfileV1): PlayerProfileV1 {
  const local = parsePlayerProfile(localInput);
  const cloud = parsePlayerProfile(cloudInput);
  const completedStandard = {} as Record<StandardPartition, readonly number[]>;
  for (const partition of PARTITIONS) {
    completedStandard[partition] = unionNumbers(local.completedStandard[partition], cloud.completedStandard[partition]);
  }
  const history: Record<string, DailyHistoryEntry> = {};
  for (const key of new Set([...Object.keys(local.daily.history), ...Object.keys(cloud.daily.history)])) {
    const merged = mergeDailyEntry(local.daily.history[key], cloud.daily.history[key]);
    if (merged) history[key] = merged;
  }
  const ownedSet = new Set([...local.ownedThemeIds, ...cloud.ownedThemeIds]);
  const ownedThemeIds = getLaunchThemes().map((theme) => theme.id).filter((id) => ownedSet.has(id));
  const activeThemeId = ownedThemeIds.includes(local.activeThemeId)
    ? local.activeThemeId
    : (ownedThemeIds.includes(cloud.activeThemeId) ? cloud.activeThemeId : 'base');

  const merged: PlayerProfileV1 = {
    version: 1,
    selectedStandardDifficulty: local.selectedStandardDifficulty,
    completedStandard,
    masteryCreditedStandardSeeds: unionNumbers(local.masteryCreditedStandardSeeds, cloud.masteryCreditedStandardSeeds),
    standardPersonalBests: mergeRecordMap(local.standardPersonalBests, cloud.standardPersonalBests),
    activeStandard: newest<SavedStandardAttempt>(local.activeStandard, cloud.activeStandard),
    onboardingWins: Math.max(local.onboardingWins, cloud.onboardingWins),
    mastery: mergeMastery(local, cloud),
    futurePrestige: {
      mediumSeeds: unionNumbers(local.futurePrestige.mediumSeeds, cloud.futurePrestige.mediumSeeds),
      hardSeeds: unionNumbers(local.futurePrestige.hardSeeds, cloud.futurePrestige.hardSeeds),
      onTimeDailyDates: unionStrings(local.futurePrestige.onTimeDailyDates, cloud.futurePrestige.onTimeDailyDates),
    },
    daily: {
      history,
      active: newest<SavedDailyAttempt>(local.daily.active, cloud.daily.active),
      bestStreak: Math.max(local.daily.bestStreak, cloud.daily.bestStreak),
    },
    coins: Math.max(local.coins, cloud.coins),
    claimedRewardKeys: unionStrings(local.claimedRewardKeys, cloud.claimedRewardKeys),
    ownedThemeIds,
    activeThemeId,
    tutorialCompleted: local.tutorialCompleted || cloud.tutorialCompleted,
    settings: {
      ...local.settings,
      language: local.settings.language ?? cloud.settings.language,
    },
  };
  return parsePlayerProfile(merged);
}
