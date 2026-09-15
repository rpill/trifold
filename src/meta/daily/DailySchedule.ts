import type { VerifiedDealCatalog } from '../../game/model/VerifiedDealCatalog.ts';
import { daysBetween, parseDateKey } from './DailyDate.ts';

export interface DailyCatalogAccess {
  readonly metadata: Pick<VerifiedDealCatalog['metadata'], 'dailyScheduleStart' | 'dailyScheduleLength'>;
  getDailySeedByOffset(offset: number): number;
}

export interface DailySelection {
  readonly dateKey: string;
  readonly offset: number;
  readonly seed: number;
}

export function getDailySelection(catalog: DailyCatalogAccess, dateKey: string): DailySelection {
  parseDateKey(dateKey);
  const start = catalog.metadata.dailyScheduleStart;
  parseDateKey(start);
  const offset = daysBetween(start, dateKey);
  if (offset < 0 || offset >= catalog.metadata.dailyScheduleLength) {
    throw new RangeError(`Daily date ${dateKey} is outside the verified schedule.`);
  }
  return { dateKey, offset, seed: catalog.getDailySeedByOffset(offset) };
}
