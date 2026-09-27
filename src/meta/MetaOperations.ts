import type { MetaSave, StandardDifficulty, StandardPartition } from './MetaSave.ts';

export type MetaOperation =
  | { readonly kind: 'set-standard-difficulty'; readonly difficulty: StandardDifficulty }
  | { readonly kind: 'standard-served'; readonly seed: number; readonly partition: StandardPartition; readonly difficulty: StandardDifficulty }
  | { readonly kind: 'standard-failed'; readonly attemptId: string }
  | { readonly kind: 'daily-hint-used'; readonly dailyId: string }
  | { readonly kind: 'begin'; readonly attemptId: string; readonly mode: 'standard' | 'daily'; readonly dailyId?: string; readonly dailyRankingEligible?: boolean }
  | { readonly kind: 'complete'; readonly attemptId: string; readonly mode: 'standard' | 'daily'; readonly dailyId?: string };

function remember(ids: readonly string[], id: string): string[] {
  return [...ids.filter((existing) => existing !== id), id].slice(-128);
}

function attemptCursor(id: string): { key: string; sequence: number } | null {
  const match = /^([a-zA-Z0-9_-]{1,80})~([1-9]\d*)$/u.exec(id);
  if (!match) return null;
  const sequence = Number(match[2]);
  if (!Number.isSafeInteger(sequence)) return null;
  return { key: `attempt-${match[1]}`, sequence };
}

function validAttemptId(value: string): boolean {
  return /^[a-zA-Z0-9_~\-]{1,100}$/u.test(value);
}

function validDailyId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function validStandardMetadata(partition: StandardPartition, difficulty: StandardDifficulty): boolean {
  return partition === 'onboarding' ? difficulty === 'easy' : partition === difficulty;
}

export function hasCompletedAttempt(state: MetaSave, id: string): boolean {
  if (state.progression.completedAttempts.includes(id)) return true;
  const cursor = attemptCursor(id);
  return cursor !== null && (state.progression.receipts[cursor.key] ?? 0) >= cursor.sequence;
}

export function applyMetaOperation(state: MetaSave, operation: MetaOperation): MetaSave {
  switch (operation.kind) {
    case 'set-standard-difficulty':
      return state.standard.selectedDifficulty === operation.difficulty
        ? state
        : { ...state, standard: { ...state.standard, selectedDifficulty: operation.difficulty } };

    case 'standard-served': {
      if (!Number.isSafeInteger(operation.seed) || operation.seed < 1 || !validStandardMetadata(operation.partition, operation.difficulty)) return state;
      const recentSeeds = [...state.standard.recentSeeds.filter((seed) => seed !== operation.seed), operation.seed].slice(-256);
      return { ...state, standard: { ...state.standard, recentSeeds } };
    }

    case 'standard-failed':
      return validAttemptId(operation.attemptId)
        ? { ...state, standardWinStreak: { ...state.standardWinStreak, current: 0 } }
        : state;

    case 'daily-hint-used': {
      if (!validDailyId(operation.dailyId)) return state;
      const previous = state.daily.records[operation.dailyId] ?? { completed: false, completedOnTime: false, attempts: 0 };
      if (previous.hintUsed === true) return state;
      return {
        ...state,
        daily: {
          ...state.daily,
          records: { ...state.daily.records, [operation.dailyId]: { ...previous, hintUsed: true } },
        },
      };
    }

    case 'begin': {
      if (!validAttemptId(operation.attemptId) || hasCompletedAttempt(state, operation.attemptId) || state.progression.startedAttempts.includes(operation.attemptId)) return state;
      if (operation.mode === 'daily' && !validDailyId(operation.dailyId)) return state;
      return {
        ...state,
        progression: {
          ...state.progression,
          startedAttempts: remember(state.progression.startedAttempts, operation.attemptId),
        },
      };
    }

    case 'complete': {
      if (!validAttemptId(operation.attemptId) || hasCompletedAttempt(state, operation.attemptId)) return state;
      if (operation.mode === 'daily' && operation.dailyId !== undefined && !validDailyId(operation.dailyId)) return state;
      const cursor = attemptCursor(operation.attemptId);
      return {
        ...state,
        progression: {
          ...state.progression,
          completedAttempts: remember(state.progression.completedAttempts, operation.attemptId),
          receipts: cursor
            ? { ...state.progression.receipts, [cursor.key]: Math.max(state.progression.receipts[cursor.key] ?? 0, cursor.sequence) }
            : state.progression.receipts,
        },
      };
    }
  }
}
