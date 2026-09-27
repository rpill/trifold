import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';
import { deriveCurrentStreak } from '../../meta/daily/DailyHistory.ts';
import type { MasteryRank, MasteryStageProgress, StandardDifficulty } from '../../meta/MetaSave.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { difficultyLabel, rankLabel, tr } from '../../i18n/Localization.ts';
import type { TrifoldProductSnapshot } from '../bridge/TrifoldProductBridge.ts';

export interface HomeViewModel {
  readonly primary: { readonly title: string; readonly subtitle: string; readonly difficulty: StandardDifficulty; readonly hasActiveGame: boolean };
  readonly newDeal: { readonly title: string; readonly subtitle: string; readonly difficulty: StandardDifficulty };
  readonly daily: { readonly title: string; readonly subtitle: string; readonly enabled: boolean };
  readonly mastery: { readonly rank: MasteryRank; readonly title: string; readonly subtitle: string; readonly enabled: boolean };
  readonly leaders: { readonly title: string; readonly subtitle: string; readonly enabled: boolean };
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

export function buildHomeViewModel(snapshot: TrifoldProductSnapshot, language: AppLanguage = 'ru'): HomeViewModel {
  const selected = snapshot.state.standard.selectedDifficulty;
  const hasActiveGame = snapshot.activeMode !== null;
  const primaryDifficulty = snapshot.activeMode === 'standard' ? snapshot.activeDifficulty ?? selected : selected;
  const primarySubtitle = snapshot.activeMode === 'daily'
    ? 'Daily'
    : `Standard · ${difficultyLabel(language, primaryDifficulty)}`;
  const todayKey = snapshot.currentDailyId;
  const streak = todayKey ? deriveCurrentStreak(snapshot.state.daily.records, todayKey) : 0;
  const today = todayKey ? snapshot.state.daily.records[todayKey] : undefined;
  const activeToday = todayKey !== null && snapshot.activeMode === 'daily' && snapshot.activeDailyId === todayKey;

  return {
    primary: {
      title: tr(language, hasActiveGame ? 'common.continue' : 'common.play'),
      subtitle: primarySubtitle,
      difficulty: primaryDifficulty,
      hasActiveGame,
    },
    newDeal: {
      title: tr(language, 'common.newDeal'),
      subtitle: `Standard · ${difficultyLabel(language, selected)}`,
      difficulty: selected,
    },
    daily: {
      title: 'Daily',
      subtitle: today?.completed
        ? tr(language, 'home.dailyCompleted', { streak })
        : activeToday
          ? tr(language, 'home.dailyContinue', { streak })
          : tr(language, 'home.dailyNew', { streak }),
      enabled: todayKey !== null,
    },
    mastery: {
      rank: snapshot.state.mastery.rank,
      title: rankLabel(language, snapshot.state.mastery.rank),
      subtitle: masterySummary(snapshot.state.mastery.rank, snapshot.state.mastery.stage, language),
      enabled: true,
    },
    leaders: {
      title: tr(language, 'leaderboards.title'),
      subtitle: tr(language, snapshot.leaderboardsEnabled ? 'leaderboards.top' : 'leaderboards.unavailable'),
      enabled: true,
    },
  };
}
