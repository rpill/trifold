import { parseTrifoldGameSave } from '../../game/model/TrifoldGame.ts';
import { parseDateKey } from '../daily/DailyDate.ts';
import { BASE_THEME_ID, getLaunchThemes, isThemeId } from '../../theme/ThemeCatalog.ts';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import { parseLanguageOverride } from '../../i18n/Language.ts';
import type {
  AttemptRecord,
  MasteryRank,
  MasteryStageProgress,
  PlayerProfileV1,
  StandardDifficulty,
  StandardPartition,
  SavedDailyAttempt,
  SavedStandardAttempt,
} from './ProfileTypes.ts';

const DIFFICULTIES: readonly StandardDifficulty[] = ['easy', 'medium', 'hard'];
const PARTITIONS: readonly StandardPartition[] = ['onboarding', 'easy', 'medium', 'hard'];
const MASTERY_RANKS: readonly MasteryRank[] = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function positiveSeed(value: unknown, label: string): number {
  const seed = nonNegativeInteger(value, label);
  if (seed === 0) throw new Error(`${label} must be a positive seed.`);
  return seed;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`);
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function uniqueSeeds(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const result: number[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < value.length; index += 1) {
    const seed = positiveSeed(value[index], `${label}[${index}]`);
    if (!seen.has(seed)) {
      seen.add(seed);
      result.push(seed);
    }
  }
  return result;
}

function uniqueStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = stringValue(value[index], `${label}[${index}]`);
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function parseAttemptRecord(value: unknown, label: string): AttemptRecord {
  const source = record(value, label);
  return {
    moves: nonNegativeInteger(source.moves, `${label}.moves`),
    activeMs: nonNegativeInteger(source.activeMs, `${label}.activeMs`),
  };
}

function parseAttemptRecords(value: unknown): Record<string, AttemptRecord> {
  const source = record(value, 'standardPersonalBests');
  const result: Record<string, AttemptRecord> = {};
  for (const [key, attempt] of Object.entries(source)) {
    if (key.length === 0) throw new Error('standardPersonalBests key must be non-empty.');
    result[key] = parseAttemptRecord(attempt, `standardPersonalBests.${key}`);
  }
  return result;
}

function parseStage(value: unknown): MasteryStageProgress {
  const source = record(value, 'mastery.stage');
  return {
    anyWins: nonNegativeInteger(source.anyWins, 'mastery.stage.anyWins'),
    mediumWins: nonNegativeInteger(source.mediumWins, 'mastery.stage.mediumWins'),
    hardWins: nonNegativeInteger(source.hardWins, 'mastery.stage.hardWins'),
    onTimeDailyWins: nonNegativeInteger(source.onTimeDailyWins, 'mastery.stage.onTimeDailyWins'),
  };
}

function parseRank(value: unknown): MasteryRank {
  if (typeof value !== 'string' || !MASTERY_RANKS.includes(value as MasteryRank)) {
    throw new Error('mastery.rank is invalid.');
  }
  return value as MasteryRank;
}

function parseDifficulty(value: unknown): StandardDifficulty {
  if (typeof value !== 'string' || !DIFFICULTIES.includes(value as StandardDifficulty)) {
    throw new Error('selectedStandardDifficulty is invalid.');
  }
  return value as StandardDifficulty;
}

function parsePartition(value: unknown): StandardPartition {
  if (typeof value !== 'string' || !PARTITIONS.includes(value as StandardPartition)) {
    throw new Error('activeStandard.partition is invalid.');
  }
  return value as StandardPartition;
}

function parseActiveStandard(value: unknown): SavedStandardAttempt | null {
  if (value === null) return null;
  const source = record(value, 'activeStandard');
  if (source.version !== 1) throw new Error('Unsupported activeStandard version.');
  const seed = positiveSeed(source.seed, 'activeStandard.seed');
  const partition = parsePartition(source.partition);
  const difficulty = parseDifficulty(source.difficulty);
  if (partition === 'onboarding' && difficulty !== 'easy') {
    throw new Error('Onboarding Standard attempts must use easy gameplay difficulty.');
  }
  const game = parseTrifoldGameSave(source.game);
  if (game.seed !== seed) throw new Error('activeStandard seed does not match game save seed.');
  return {
    version: 1,
    seed,
    partition,
    difficulty,
    game,
    moves: nonNegativeInteger(source.moves, 'activeStandard.moves'),
    activeMs: nonNegativeInteger(source.activeMs, 'activeStandard.activeMs'),
    assisted: booleanValue(source.assisted, 'activeStandard.assisted'),
    updatedAtMs: nonNegativeInteger(source.updatedAtMs, 'activeStandard.updatedAtMs'),
  };
}

function parseCompletedStandard(value: unknown): Record<StandardPartition, readonly number[]> {
  const source = record(value, 'completedStandard');
  const result = {} as Record<StandardPartition, readonly number[]>;
  for (const partition of PARTITIONS) {
    result[partition] = uniqueSeeds(source[partition], `completedStandard.${partition}`);
  }
  return result;
}

function parseDailyDateKey(value: unknown, label: string): string {
  const key = stringValue(value, label);
  try {
    parseDateKey(key);
  } catch {
    throw new Error(`${label} must be a valid Daily date key.`);
  }
  return key;
}

function parseNullableAttempt(value: unknown, label: string): AttemptRecord | null {
  return value === null ? null : parseAttemptRecord(value, label);
}

function parseActiveDaily(value: unknown): SavedDailyAttempt | null {
  if (value === null) return null;
  const source = record(value, 'daily.active');
  if (source.version !== 1) throw new Error('Unsupported daily.active version.');
  const seed = positiveSeed(source.seed, 'daily.active.seed');
  const game = parseTrifoldGameSave(source.game);
  if (game.seed !== seed) throw new Error('daily.active seed does not match game save seed.');
  return {
    version: 1,
    dailyDateKey: parseDailyDateKey(source.dailyDateKey, 'daily.active.dailyDateKey'),
    seed,
    game,
    moves: nonNegativeInteger(source.moves, 'daily.active.moves'),
    activeMs: nonNegativeInteger(source.activeMs, 'daily.active.activeMs'),
    updatedAtMs: nonNegativeInteger(source.updatedAtMs, 'daily.active.updatedAtMs'),
  };
}

function parseDaily(value: unknown): PlayerProfileV1['daily'] {
  const source = record(value, 'daily');
  const rawHistory = record(source.history, 'daily.history');
  const history: Record<string, PlayerProfileV1['daily']['history'][string]> = {};
  for (const [key, rawEntry] of Object.entries(rawHistory)) {
    const validKey = parseDailyDateKey(key, `daily.history.${key}.key`);
    const entry = record(rawEntry, `daily.history.${key}`);
    const dateKey = parseDailyDateKey(entry.dateKey, `daily.history.${key}.dateKey`);
    if (dateKey !== validKey) throw new Error(`daily.history.${key} dateKey must match its key.`);
    const completed = booleanValue(entry.completed, `daily.history.${key}.completed`);
    const completedOnTime = booleanValue(entry.completedOnTime, `daily.history.${key}.completedOnTime`);
    const officialResult = parseNullableAttempt(entry.officialResult, `daily.history.${key}.officialResult`);
    const personalBest = parseNullableAttempt(entry.personalBest, `daily.history.${key}.personalBest`);
    const firstCompletionRewardClaimed = booleanValue(
      entry.firstCompletionRewardClaimed,
      `daily.history.${key}.firstCompletionRewardClaimed`,
    );
    if (completed && personalBest === null) throw new Error(`daily.history.${key} completed entry requires personalBest.`);
    if (completedOnTime && officialResult === null) throw new Error(`daily.history.${key} on-time entry requires officialResult.`);
    if (!completedOnTime && officialResult !== null) throw new Error(`daily.history.${key} late entry cannot have officialResult.`);
    history[key] = {
      dateKey,
      completed,
      completedOnTime,
      officialResult,
      personalBest,
      firstCompletionRewardClaimed,
    };
  }
  return {
    history,
    active: parseActiveDaily(source.active),
    bestStreak: nonNegativeInteger(source.bestStreak, 'daily.bestStreak'),
  };
}

export function createDefaultProfile(): PlayerProfileV1 {
  return {
    version: 1,
    selectedStandardDifficulty: 'easy',
    completedStandard: { onboarding: [], easy: [], medium: [], hard: [] },
    masteryCreditedStandardSeeds: [],
    standardPersonalBests: {},
    activeStandard: null,
    onboardingWins: 0,
    mastery: {
      rank: 'novice',
      stage: { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
    },
    futurePrestige: { mediumSeeds: [], hardSeeds: [], onTimeDailyDates: [] },
    daily: { history: {}, active: null, bestStreak: 0 },
    coins: 0,
    claimedRewardKeys: [],
    ownedThemeIds: ['base'],
    activeThemeId: 'base',
    tutorialCompleted: false,
    settings: { sfxEnabled: true, language: null },
  };
}

export function parsePlayerProfile(raw: unknown): PlayerProfileV1 {
  const source = record(raw, 'profile');
  if (source.version !== 1) throw new Error(`Unsupported profile version: ${String(source.version)}.`);
  const mastery = record(source.mastery, 'mastery');
  const futurePrestige = record(source.futurePrestige, 'futurePrestige');
  const settings = record(source.settings, 'settings');
  const persistedThemeIds = Array.isArray(source.ownedThemeIds) ? source.ownedThemeIds : [];
  const persistedOwned = new Set<ThemeId>();
  for (const value of persistedThemeIds) {
    if (isThemeId(value)) persistedOwned.add(value);
  }
  persistedOwned.add(BASE_THEME_ID);
  const ownedThemeIds = getLaunchThemes()
    .map((theme) => theme.id)
    .filter((id) => persistedOwned.has(id));
  const requestedActiveThemeId = isThemeId(source.activeThemeId) ? source.activeThemeId : BASE_THEME_ID;
  const activeThemeId = ownedThemeIds.includes(requestedActiveThemeId) ? requestedActiveThemeId : BASE_THEME_ID;

  return {
    version: 1,
    selectedStandardDifficulty: parseDifficulty(source.selectedStandardDifficulty),
    completedStandard: parseCompletedStandard(source.completedStandard),
    masteryCreditedStandardSeeds: uniqueSeeds(source.masteryCreditedStandardSeeds, 'masteryCreditedStandardSeeds'),
    standardPersonalBests: parseAttemptRecords(source.standardPersonalBests),
    activeStandard: parseActiveStandard(source.activeStandard),
    onboardingWins: nonNegativeInteger(source.onboardingWins, 'onboardingWins'),
    mastery: {
      rank: parseRank(mastery.rank),
      stage: parseStage(mastery.stage),
    },
    futurePrestige: {
      mediumSeeds: uniqueSeeds(futurePrestige.mediumSeeds, 'futurePrestige.mediumSeeds'),
      hardSeeds: uniqueSeeds(futurePrestige.hardSeeds, 'futurePrestige.hardSeeds'),
      onTimeDailyDates: uniqueStrings(futurePrestige.onTimeDailyDates, 'futurePrestige.onTimeDailyDates'),
    },
    daily: parseDaily(source.daily),
    coins: nonNegativeInteger(source.coins, 'coins'),
    claimedRewardKeys: uniqueStrings(source.claimedRewardKeys, 'claimedRewardKeys'),
    ownedThemeIds,
    activeThemeId,
    tutorialCompleted: booleanValue(source.tutorialCompleted, 'tutorialCompleted'),
    settings: {
      sfxEnabled: booleanValue(settings.sfxEnabled, 'settings.sfxEnabled'),
      language: parseLanguageOverride(settings.language),
    },
  };
}
