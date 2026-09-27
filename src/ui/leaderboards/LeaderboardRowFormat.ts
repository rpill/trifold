import type { AppLanguage } from '../../i18n/Language.ts';
import { formatMoveCount, rankLabel } from '../../i18n/Localization.ts';
import type { LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';
import { formatActiveTime } from '../game/GameHudViewModel.ts';

export type LeaderboardDisplayTab = 'daily' | 'streak' | 'mastery';

export function formatLeaderboardValue(
  tab: LeaderboardDisplayTab,
  entry: LeaderboardRow,
  language: AppLanguage,
): string {
  if (tab === 'daily') {
    if (entry.metric.kind !== 'daily') return '—';
    return `${formatMoveCount(language, entry.metric.moves)} · ${formatActiveTime(entry.metric.elapsedMs)}`;
  }
  if (tab === 'streak') {
    if (entry.metric.kind !== 'streak') return '—';
    return String(entry.metric.current);
  }
  if (entry.metric.kind !== 'mastery') return '—';
  return `${rankLabel(language, entry.metric.rank)} · ${entry.metric.points}`;
}
