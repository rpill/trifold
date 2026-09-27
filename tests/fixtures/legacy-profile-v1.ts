import { createDeal } from '../../src/game/model/deal.ts';
import { TrifoldGame } from '../../src/game/model/TrifoldGame.ts';
import { createDefaultProfile } from '../../src/meta/profile/ProfileSchema.ts';

export function createLegacyProfileFixture() {
  const profile = createDefaultProfile();
  return {
    ...profile,
    selectedStandardDifficulty: 'hard' as const,
    completedStandard: {
      onboarding: [1, 1, 2],
      easy: [10, 10],
      medium: [20],
      hard: [30, 31],
    },
    masteryCreditedStandardSeeds: [10, 10, 20, 30],
    standardPersonalBests: {
      'easy:10': { moves: 44, activeMs: 21_000 },
      'hard:30': { moves: 62, activeMs: 40_000 },
    },
    onboardingWins: 3,
    mastery: {
      rank: 'expert' as const,
      stage: { anyWins: 14, mediumWins: 4, hardWins: 2, onTimeDailyWins: 3 },
    },
    futurePrestige: {
      mediumSeeds: [20, 20, 22],
      hardSeeds: [30, 31],
      onTimeDailyDates: ['2026-09-20', '2026-09-20', '2026-09-21'],
    },
    daily: {
      history: {
        '2026-09-20': {
          dateKey: '2026-09-20',
          completed: true,
          completedOnTime: true,
          officialResult: { moves: 88, activeMs: 54_000 },
          personalBest: { moves: 80, activeMs: 50_000 },
        },
        '2026-09-19': {
          dateKey: '2026-09-19',
          completed: true,
          completedOnTime: false,
          officialResult: null,
          personalBest: { moves: 91, activeMs: 60_000 },
        },
      },
      active: {
        version: 1 as const,
        dailyDateKey: '2026-09-18',
        seed: 118,
        game: new TrifoldGame(createDeal(118)).exportSave(),
        moves: 9,
        activeMs: 12_000,
        updatedAtMs: 300,
      },
      bestStreak: 9,
    },
    activeStandard: {
      version: 1 as const,
      seed: 44,
      partition: 'medium' as const,
      difficulty: 'medium' as const,
      game: new TrifoldGame(createDeal(44)).exportSave(),
      moves: 6,
      activeMs: 9_000,
      assisted: true,
      updatedAtMs: 200,
    },
    tutorialCompleted: true,
    settings: { sfxEnabled: false, language: 'en' as const },
    // Removed product fields are accepted as loose legacy input and intentionally ignored.
    coins: 500,
    claimedRewardKeys: ['rank:player'],
    ownedThemeIds: ['base', 'royal'],
    activeThemeId: 'royal',
  };
}
