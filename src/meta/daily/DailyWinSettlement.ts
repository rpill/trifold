import { recordMasteryEligibleDailyWin } from '../mastery/Mastery.ts';
import type { AttemptRecord, DailyRecord, MasteryRank, MetaSave } from '../MetaSave.ts';
import { deriveBestStreak } from './DailyHistory.ts';
import { parseDateKey } from './DailyDate.ts';

export interface BeginDailyAttemptOptions {
  readonly attemptId: string;
  readonly rankingEligible: boolean;
}

export interface DailyWinInput {
  readonly dailyDateKey: string;
  readonly completionDateKey: string;
  readonly moves: number;
  readonly activeMs: number;
  readonly attemptId?: string;
  readonly assisted?: boolean;
}

export interface DailyWinSettlementResult {
  readonly state: MetaSave;
  readonly firstCompletion: boolean;
  readonly completedOnTime: boolean;
  readonly officialResult: AttemptRecord | null;
  readonly personalBest: AttemptRecord;
  readonly improvedBest: boolean;
  readonly masteryAdvanced: boolean;
  readonly rankAdvancedTo: MasteryRank | null;
}

const ATTEMPT_ID = /^[a-zA-Z0-9_~\-]{1,100}$/u;

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function baseRecord(existing: DailyRecord | undefined): DailyRecord {
  return existing ?? { completed: false, completedOnTime: false, attempts: 0 };
}

export function beginDailyAttempt(
  state: MetaSave,
  dailyDateKey: string,
  options: BeginDailyAttemptOptions,
): MetaSave {
  parseDateKey(dailyDateKey);
  if (!ATTEMPT_ID.test(options.attemptId)) throw new Error('Daily attempt id is invalid.');
  const previous = baseRecord(state.daily.records[dailyDateKey]);
  const rankingAttemptId = options.rankingEligible
    && !previous.completed
    && previous.rankingAttemptId === undefined
      ? options.attemptId
      : previous.rankingAttemptId;
  return {
    ...state,
    daily: {
      ...state.daily,
      records: {
        ...state.daily.records,
        [dailyDateKey]: {
          ...previous,
          attempts: previous.attempts + 1,
          ...(rankingAttemptId === undefined ? {} : { rankingAttemptId }),
        },
      },
    },
  };
}

export function isBetterAttempt(candidate: AttemptRecord, current: AttemptRecord): boolean {
  return candidate.moves < current.moves
    || (candidate.moves === current.moves && candidate.activeMs < current.activeMs);
}

export function settleDailyWin(state: MetaSave, input: DailyWinInput): DailyWinSettlementResult {
  parseDateKey(input.dailyDateKey);
  parseDateKey(input.completionDateKey);
  nonNegativeInteger(input.moves, 'moves');
  nonNegativeInteger(input.activeMs, 'activeMs');
  if (input.attemptId !== undefined && !ATTEMPT_ID.test(input.attemptId)) throw new Error('Daily attempt id is invalid.');

  const previous = baseRecord(state.daily.records[input.dailyDateKey]);
  const firstCompletion = !previous.completed;
  const onTimeNow = input.dailyDateKey === input.completionDateKey;
  const completedOnTime = previous.completed ? previous.completedOnTime : onTimeNow;
  const candidate: AttemptRecord = { moves: input.moves, activeMs: input.activeMs };
  const improvedBest = previous.personalBest === undefined || isBetterAttempt(candidate, previous.personalBest);
  const personalBest = improvedBest ? candidate : previous.personalBest as AttemptRecord;

  const matchesCapturedRankingAttempt = previous.rankingAttemptId !== undefined
    ? previous.rankingAttemptId === input.attemptId
    : previous.attempts <= 1;
  const officialResult = previous.officialResult
    ?? (firstCompletion && onTimeNow && matchesCapturedRankingAttempt ? candidate : undefined);

  const record: DailyRecord = {
    ...previous,
    completed: true,
    completedOnTime,
    attempts: Math.max(1, previous.attempts),
    personalBest,
    ...(officialResult === undefined ? {} : { officialResult }),
    ...(input.assisted === true || previous.hintUsed === true ? { hintUsed: true } : {}),
  };

  let next: MetaSave = {
    ...state,
    daily: {
      ...state.daily,
      records: { ...state.daily.records, [input.dailyDateKey]: record },
    },
  };

  let masteryAdvanced = false;
  let rankAdvancedTo: MasteryRank | null = null;
  if (firstCompletion && onTimeNow) {
    const mastery = recordMasteryEligibleDailyWin(next, input.dailyDateKey, true);
    next = mastery.state;
    masteryAdvanced = mastery.masteryAdvanced;
    rankAdvancedTo = mastery.rankAdvancedTo;
  }

  const bestStreakFloor = deriveBestStreak(next.daily.records, next.daily.bestStreakFloor);
  if (bestStreakFloor !== next.daily.bestStreakFloor) {
    next = { ...next, daily: { ...next.daily, bestStreakFloor } };
  }

  return {
    state: next,
    firstCompletion,
    completedOnTime,
    officialResult: officialResult ?? null,
    personalBest,
    improvedBest,
    masteryAdvanced,
    rankAdvancedTo,
  };
}
