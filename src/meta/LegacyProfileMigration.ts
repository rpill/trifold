import { normalizeMetaSave, type MetaSave } from './MetaSave.ts';
import { parsePlayerProfile } from './profile/ProfileSchema.ts';
import type { PlayerProfileV1, SavedDailyAttempt, SavedStandardAttempt } from './profile/ProfileTypes.ts';
import type { TrifoldActiveGameSave } from '../persistence/ActiveGameSave.ts';

export interface LegacyPreferenceSnapshot {
  readonly language: 'ru' | 'en' | null;
  readonly soundEnabled: boolean;
  readonly tutorialCompleted: boolean;
}

export interface LegacyProfileMigrationResult {
  readonly meta: MetaSave;
  readonly activeGame: TrifoldActiveGameSave | null;
  readonly preferences: LegacyPreferenceSnapshot;
}

const DEFAULT_PREFERENCES: LegacyPreferenceSnapshot = {
  language: null,
  soundEnabled: true,
  tutorialCompleted: false,
};

function migrateStandardActive(active: SavedStandardAttempt): TrifoldActiveGameSave {
  return {
    version: 1,
    mode: 'standard',
    seed: active.seed,
    game: active.game,
    moves: active.moves,
    activeMs: active.activeMs,
    assisted: active.assisted,
    updatedAtMs: active.updatedAtMs,
    standard: { partition: active.partition, difficulty: active.difficulty },
  };
}

function migrateDailyActive(active: SavedDailyAttempt): TrifoldActiveGameSave {
  return {
    version: 1,
    mode: 'daily',
    seed: active.seed,
    game: active.game,
    moves: active.moves,
    activeMs: active.activeMs,
    assisted: false,
    updatedAtMs: active.updatedAtMs,
    // Legacy snapshots do not encode whether the date is still "today" at migration time.
    // Archive is the conservative choice: it cannot accidentally grant on-time product credit.
    daily: { dateKey: active.dailyDateKey, kind: 'archive' },
  };
}

function chooseActiveGame(profile: PlayerProfileV1): TrifoldActiveGameSave | null {
  const candidates: TrifoldActiveGameSave[] = [];
  if (profile.activeStandard) candidates.push(migrateStandardActive(profile.activeStandard));
  if (profile.daily.active) candidates.push(migrateDailyActive(profile.daily.active));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0] ?? null;
}

function migrateMeta(profile: PlayerProfileV1): MetaSave {
  const records = Object.fromEntries(Object.entries(profile.daily.history).map(([dateKey, entry]) => [
    dateKey,
    {
      completed: entry.completed,
      completedOnTime: entry.completedOnTime,
      attempts: entry.completed ? 1 : 0,
      ...(entry.officialResult ? { officialResult: entry.officialResult } : {}),
      ...(entry.personalBest ? { personalBest: entry.personalBest } : {}),
    },
  ]));

  return normalizeMetaSave({
    standard: {
      selectedDifficulty: profile.selectedStandardDifficulty,
      recentSeeds: [],
      completed: profile.completedStandard,
      masteryCreditedSeeds: profile.masteryCreditedStandardSeeds,
      onboardingWins: profile.onboardingWins,
      personalBests: profile.standardPersonalBests,
    },
    standardWinStreak: { current: 0, best: 0 },
    mastery: profile.mastery,
    futurePrestige: profile.futurePrestige,
    daily: {
      records,
      bestStreakFloor: profile.daily.bestStreak,
    },
  });
}

export function migrateLegacyProfile(raw: unknown): LegacyProfileMigrationResult {
  let profile: PlayerProfileV1;
  try {
    profile = parsePlayerProfile(raw);
  } catch {
    return {
      meta: normalizeMetaSave(null),
      activeGame: null,
      preferences: DEFAULT_PREFERENCES,
    };
  }

  return {
    meta: migrateMeta(profile),
    activeGame: chooseActiveGame(profile),
    preferences: {
      language: profile.settings.language,
      soundEnabled: profile.settings.sfxEnabled,
      tutorialCompleted: profile.tutorialCompleted,
    },
  };
}
