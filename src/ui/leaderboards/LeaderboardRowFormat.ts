import type { AppLanguage } from '../../i18n/Language.ts';
import { formatMoveCount, rankLabel } from '../../i18n/Localization.ts';
import { decodeMasteryScore } from '../../leaderboards/LeaderboardConfig.ts';
import type { DailyLeaderboardEntry } from '../../leaderboards/LeaderboardService.ts';
import type { LeaderboardEntry } from '../../platform/services.ts';
import { formatActiveTime } from '../game/GameHudViewModel.ts';

export type LeaderboardDisplayTab = 'daily' | 'streak' | 'mastery';

function isDailyEntry(entry: LeaderboardEntry): entry is DailyLeaderboardEntry {
  const candidate = entry as Partial<DailyLeaderboardEntry>;
  return Number.isFinite(candidate.moves) && Number.isFinite(candidate.activeMs);
}

export function formatLeaderboardValue(
  tab: LeaderboardDisplayTab,
  entry: LeaderboardEntry,
  language: AppLanguage,
): string {
  if (tab === 'daily') {
    if (!isDailyEntry(entry)) return '—';
    return `${formatMoveCount(language, entry.moves)} · ${formatActiveTime(entry.activeMs)}`;
  }
  if (tab === 'streak') return String(Math.max(0, Math.floor(entry.score)));
  try {
    const mastery = decodeMasteryScore(entry.score);
    return `${rankLabel(language, mastery.rank)} · ${mastery.points}`;
  } catch {
    return '—';
  }
}
