import type { DailyHistoryEntry } from '../profile/ProfileTypes.ts';
import { addDays, dateKeyToDayNumber, parseDateKey } from './DailyDate.ts';

export type DailyHistory = Readonly<Record<string, DailyHistoryEntry>>;

function isOnTimeCompletion(entry: DailyHistoryEntry | undefined): boolean {
  return entry?.completed === true && entry.completedOnTime;
}

export function deriveCurrentStreak(history: DailyHistory, todayKey: string): number {
  parseDateKey(todayKey);
  let cursor = isOnTimeCompletion(history[todayKey]) ? todayKey : addDays(todayKey, -1);
  let count = 0;
  while (isOnTimeCompletion(history[cursor])) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function deriveBestStreak(history: DailyHistory): number {
  const days = Object.values(history)
    .filter((entry) => entry.completed && entry.completedOnTime)
    .map((entry) => dateKeyToDayNumber(entry.dateKey))
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
  return best;
}

export function mergeDailyHistoryEntry(
  history: DailyHistory,
  entry: DailyHistoryEntry,
): Readonly<Record<string, DailyHistoryEntry>> {
  parseDateKey(entry.dateKey);
  return { ...history, [entry.dateKey]: entry };
}
