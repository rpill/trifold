import type { TrifoldGameSaveV1 } from '../../game/model/TrifoldGame.ts';
import type { AppLanguage } from '../../i18n/Language.ts';

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

export interface SavedStandardAttempt {
  readonly version: 1;
  readonly seed: number;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly game: TrifoldGameSaveV1;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
  readonly updatedAtMs: number;
}

export interface DailyHistoryEntry {
  readonly dateKey: string;
  readonly completed: boolean;
  readonly completedOnTime: boolean;
  readonly officialResult: AttemptRecord | null;
  readonly personalBest: AttemptRecord | null;
}

export interface SavedDailyAttempt {
  readonly version: 1;
  readonly dailyDateKey: string;
  readonly seed: number;
  readonly game: TrifoldGameSaveV1;
  readonly moves: number;
  readonly activeMs: number;
  readonly updatedAtMs: number;
}

export interface DailyProfileState {
  readonly history: Readonly<Record<string, DailyHistoryEntry>>;
  readonly active: SavedDailyAttempt | null;
  readonly bestStreak: number;
}

export interface PlayerProfileV1 {
  readonly version: 1;
  readonly selectedStandardDifficulty: StandardDifficulty;
  readonly completedStandard: Readonly<Record<StandardPartition, readonly number[]>>;
  readonly masteryCreditedStandardSeeds: readonly number[];
  readonly standardPersonalBests: Readonly<Record<string, AttemptRecord>>;
  readonly activeStandard: SavedStandardAttempt | null;
  readonly onboardingWins: number;
  readonly mastery: {
    readonly rank: MasteryRank;
    readonly stage: MasteryStageProgress;
  };
  readonly futurePrestige: {
    readonly mediumSeeds: readonly number[];
    readonly hardSeeds: readonly number[];
    readonly onTimeDailyDates: readonly string[];
  };
  readonly daily: DailyProfileState;
  readonly tutorialCompleted: boolean;
  readonly settings: { readonly sfxEnabled: boolean; readonly language: AppLanguage | null };
}
