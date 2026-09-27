import type { DailyRecord } from '../MetaSave.ts';
import { addDays, dateKeyToDayNumber, parseDateKey } from './DailyDate.ts';

export type DailyHistory = Readonly<Record<string, DailyRecord>>;

function isOnTimeCompletion(entry: DailyRecord | undefined): boolean {
  return entry?.completed === true && entry.completedOnTime;
}

export function deriveCurrentStreak(records: DailyHistory, todayKey: string): number {
  parseDateKey(todayKey);
  let cursor = isOnTimeCompletion(records[todayKey]) ? todayKey : addDays(todayKey, -1);
  let count = 0;
  while (isOnTimeCompletion(records[cursor])) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function deriveBestStreak(records: DailyHistory, floor = 0): number {
  const days = Object.entries(records)
    .filter(([, entry]) => entry.completed && entry.completedOnTime)
    .map(([dateKey]) => dateKeyToDayNumber(dateKey))
    .sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  let previous: number | null = null;
  for (const day of days) {
    if (day === previous) continue;
    current = previous !== null && day === previous + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = day;
  }
  return Math.max(floor, best);
}

export function mergeDailyRecord(
  records: DailyHistory,
  dateKey: string,
  record: DailyRecord,
): Readonly<Record<string, DailyRecord>> {
  parseDateKey(dateKey);
  return { ...records, [dateKey]: record };
}
