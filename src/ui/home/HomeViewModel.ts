import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';
import { deriveCurrentStreak } from '../../meta/daily/DailyHistory.ts';
import { toLocalDateKey } from '../../meta/daily/DailyDate.ts';
import type { MasteryRank, MasteryStageProgress, PlayerProfileV1, StandardDifficulty } from '../../meta/profile/ProfileTypes.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { difficultyLabel, rankLabel, tr } from '../../i18n/Localization.ts';

export interface HomeViewModel {
  readonly primary: { readonly title: string; readonly subtitle: string; readonly difficulty: StandardDifficulty; readonly hasSave: boolean };
  readonly newDeal: { readonly title: string; readonly subtitle: string; readonly difficulty: StandardDifficulty };
  readonly daily: { readonly title: string; readonly subtitle: string; readonly enabled: boolean };
  readonly mastery: { readonly rank: MasteryRank; readonly title: string; readonly subtitle: string; readonly enabled: boolean };
  readonly themes: { readonly owned: number; readonly total: 7; readonly subtitle: string; readonly enabled: boolean };
  readonly coins: number;
  readonly leaderboardsEnabled: boolean;
}

function masterySummary(rank: MasteryRank, stage: MasteryStageProgress, language: AppLanguage): string {
  const requirements = getMasteryRequirements(rank);
  if (!requirements) return tr(language, 'home.masteryMax');
  const parts: string[] = [];
  if (requirements.anyWins > 0) parts.push(tr(language, 'home.masteryWins', { current: stage.anyWins, total: requirements.anyWins }));
  if (requirements.mediumWins > 0) parts.push(tr(language, 'home.masteryMedium', { current: stage.mediumWins, total: requirements.mediumWins }));
  if (requirements.hardWins > 0) parts.push(tr(language, 'home.masteryHard', { current: stage.hardWins, total: requirements.hardWins }));
  if (requirements.onTimeDailyWins > 0) parts.push(tr(language, 'home.masteryDaily', { current: stage.onTimeDailyWins, total: requirements.onTimeDailyWins }));
  return parts.join(' · ');
}

export function buildHomeViewModel(
  profile: PlayerProfileV1,
  todayKey = toLocalDateKey(new Date()),
  leaderboardsEnabled = false,
  language: AppLanguage = 'ru',
): HomeViewModel {
  const saved = profile.activeStandard;
  const primaryDifficulty = saved?.difficulty ?? profile.selectedStandardDifficulty;
  const streak = deriveCurrentStreak(profile.daily.history, todayKey);
  const today = profile.daily.history[todayKey];
  return {
    primary: {
      title: tr(language, saved ? 'common.continue' : 'common.play'),
      subtitle: `Standard · ${difficultyLabel(language, primaryDifficulty)}`,
      difficulty: primaryDifficulty,
      hasSave: saved !== null,
    },
    newDeal: {
      title: tr(language, 'common.newDeal'),
      subtitle: `Standard · ${difficultyLabel(language, profile.selectedStandardDifficulty)}`,
      difficulty: profile.selectedStandardDifficulty,
    },
    daily: {
      title: 'Daily',
      subtitle: today?.completed
        ? tr(language, 'home.dailyCompleted', { streak })
        : profile.daily.active?.dailyDateKey === todayKey
          ? tr(language, 'home.dailyContinue', { streak })
          : tr(language, 'home.dailyNew', { streak }),
      enabled: true,
    },
    mastery: {
      rank: profile.mastery.rank,
      title: rankLabel(language, profile.mastery.rank),
      subtitle: masterySummary(profile.mastery.rank, profile.mastery.stage, language),
      enabled: true,
    },
    themes: {
      owned: profile.ownedThemeIds.length,
      total: 7,
      subtitle: `${profile.ownedThemeIds.length} / 7`,
      enabled: true,
    },
    coins: profile.coins,
    leaderboardsEnabled,
  };
}
