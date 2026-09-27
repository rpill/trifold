import type { StandardDifficulty } from '../MetaSave.ts';

export const STANDARD_MASTERY_POINTS: Readonly<Record<StandardDifficulty, number>> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const ON_TIME_DAILY_MASTERY_POINTS = 2;

export function standardMasteryPoints(difficulty: StandardDifficulty): number {
  return STANDARD_MASTERY_POINTS[difficulty];
}
