export type DailyDateKey = `${number}-${number}-${number}`;

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function parseDateKey(key: string): { readonly year: number; readonly month: number; readonly day: number } {
  const match = DATE_RE.exec(key);
  if (!match) throw new Error(`Invalid Daily date key: ${key}.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error(`Invalid Daily calendar date: ${key}.`);
  }
  return { year, month, day };
}

export function toLocalDateKey(date: Date): DailyDateKey {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('Invalid date.');
  return `${date.getFullYear().toString().padStart(4, '0')}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` as DailyDateKey;
}

export function dateKeyToDayNumber(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function dayNumberToDateKey(dayNumber: number): DailyDateKey {
  if (!Number.isSafeInteger(dayNumber)) throw new Error('Daily day number must be an integer.');
  const date = new Date(dayNumber * DAY_MS);
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}` as DailyDateKey;
}

export function daysBetween(a: string, b: string): number {
  return dateKeyToDayNumber(b) - dateKeyToDayNumber(a);
}

export function addDays(key: string, delta: number): DailyDateKey {
  if (!Number.isSafeInteger(delta)) throw new Error('Daily day delta must be an integer.');
  return dayNumberToDateKey(dateKeyToDayNumber(key) + delta);
}

export function getArchiveDateKeys(todayKey: string, count: number): readonly DailyDateKey[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Archive day count must be a positive integer.');
  const today = dateKeyToDayNumber(todayKey);
  return Array.from({ length: count }, (_, index) => dayNumberToDateKey(today - index));
}
