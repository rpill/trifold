import type { MetaSave } from '../../meta/MetaSave.ts';
import { buildDailyCalendar, type DailyCalendarCatalogMetadata, type DailyCalendarDay } from '../../meta/daily/DailyCalendarViewModel.ts';
import { deriveBestStreak, deriveCurrentStreak } from '../../meta/daily/DailyHistory.ts';
import type { DailyWinSettlementResult } from '../../meta/daily/DailyWinSettlement.ts';
import type { DailySessionViewState } from '../../meta/daily/DailySessionController.ts';
import { formatActiveTime } from '../game/GameHudViewModel.ts';
import type { WinOverlayContent } from '../win/WinOverlay.ts';
import { dateKeyToDayNumber } from '../../meta/daily/DailyDate.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { formatMoveCount, tr } from '../../i18n/Localization.ts';

export type DailyCellState = 'today' | 'completed-on-time' | 'completed-archive' | 'missed' | 'future' | 'outside-archive';
export interface DailyDashboardViewModel {
  readonly todayKey: string; readonly currentStreak: number; readonly bestStreak: number; readonly activeDateKey: string | null;
  readonly today: { readonly completed: boolean; readonly ctaLabel: string; readonly officialResult: DailyCalendarDay['officialResult']; readonly personalBest: DailyCalendarDay['personalBest'] };
  readonly archive: readonly DailyCalendarDay[];
}

export function buildDailyViewModel(
  state: MetaSave,
  activeDailyId: string | null,
  todayKey: string,
  catalog: DailyCalendarCatalogMetadata,
  language: AppLanguage = 'ru',
): DailyDashboardViewModel {
  const archive = buildDailyCalendar(state, todayKey, catalog);
  const todayDay = archive.find((day) => day.dateKey === todayKey) ?? null;
  const completed = todayDay?.status === 'today-complete';
  const activeDateKey = activeDailyId;
  const activeToday = activeDateKey === todayKey;
  return {
    todayKey,
    currentStreak: deriveCurrentStreak(state.daily.records, todayKey),
    bestStreak: deriveBestStreak(state.daily.records, state.daily.bestStreakFloor),
    activeDateKey,
    today: {
      completed,
      ctaLabel: activeToday ? tr(language, 'common.continue') : completed ? tr(language, 'common.replay') : tr(language, 'daily.playToday'),
      officialResult: todayDay?.officialResult ?? null,
      personalBest: todayDay?.personalBest ?? null,
    },
    archive,
  };
}

export function dailyCellState(viewModel: DailyDashboardViewModel, dateKey: string): DailyCellState {
  const target = dateKeyToDayNumber(dateKey); const today = dateKeyToDayNumber(viewModel.todayKey);
  if (target > today) return 'future';
  if (dateKey === viewModel.todayKey) return 'today';
  const day = viewModel.archive.find((item) => item.dateKey === dateKey);
  if (!day) return 'outside-archive';
  if (day.status === 'archive-complete-on-time') return 'completed-on-time';
  if (day.status === 'archive-complete-late') return 'completed-archive';
  return 'missed';
}

function formatAttempt(attempt: { readonly moves:number; readonly activeMs:number }, language:AppLanguage):string {
  return `${formatMoveCount(language,attempt.moves)} · ${formatActiveTime(attempt.activeMs)}`;
}

export function buildDailyWinOverlayContent(settlement:DailyWinSettlementResult, attempt:DailySessionViewState, todayKey:string, language:AppLanguage='ru'):WinOverlayContent {
  const official=settlement.officialResult; const personal=settlement.personalBest; const details:string[]=[];
  if(official) details.push(tr(language,'daily.officialShort',{result:formatAttempt(official,language)}));
  if(!official || personal.moves!==official.moves || personal.activeMs!==official.activeMs) details.push(tr(language,'daily.personalShort',{result:formatAttempt(personal,language)}));
  return {
    title:tr(language,attempt.kind==='today'?'daily.winToday':'daily.winArchive'), kicker:attempt.dailyDateKey,
    resultLine:formatAttempt(attempt,language), detailLine:details.length>0?details.join(' · '):null,
    noticeLine:tr(language,'daily.streak',{streak:deriveCurrentStreak(settlement.state.daily.records,todayKey)}),
    primaryActionLabel:tr(language,'common.replay'), secondaryActionLabel:tr(language,'common.home'),
  };
}
