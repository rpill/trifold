import type { AttemptRecord, MetaSave } from '../MetaSave.ts';
import { daysBetween, getArchiveDateKeys } from './DailyDate.ts';

export type DailyCalendarStatus = 'today-open' | 'today-complete' | 'archive-open' | 'archive-complete-on-time' | 'archive-complete-late';
export interface DailyCalendarDay {
  readonly dateKey: string;
  readonly status: DailyCalendarStatus;
  readonly completedOnTime: boolean;
  readonly officialResult: AttemptRecord | null;
  readonly personalBest: AttemptRecord | null;
}
export interface DailyCalendarCatalogMetadata { readonly metadata: { readonly dailyScheduleStart: string; readonly dailyScheduleLength: number } }

export function buildDailyCalendar(state: MetaSave, todayKey: string, catalog: DailyCalendarCatalogMetadata): readonly DailyCalendarDay[] {
  const start = catalog.metadata.dailyScheduleStart;
  const length = catalog.metadata.dailyScheduleLength;
  return getArchiveDateKeys(todayKey, 90)
    .filter((dateKey) => { const offset = daysBetween(start, dateKey); return offset >= 0 && offset < length; })
    .map((dateKey, index) => {
      const entry = state.daily.records[dateKey];
      const today = index === 0 && dateKey === todayKey;
      let status: DailyCalendarStatus;
      if (today) status = entry?.completed ? 'today-complete' : 'today-open';
      else if (!entry?.completed) status = 'archive-open';
      else status = entry.completedOnTime ? 'archive-complete-on-time' : 'archive-complete-late';
      return { dateKey, status, completedOnTime: entry?.completedOnTime ?? false, officialResult: entry?.officialResult ?? null, personalBest: entry?.personalBest ?? null };
    });
}
