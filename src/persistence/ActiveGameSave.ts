import { parseTrifoldGameSave, type TrifoldGameSaveV1 } from '../game/model/TrifoldGame.ts';
import type { StandardDifficulty, StandardPartition } from '../meta/MetaSave.ts';

export const ACTIVE_GAME_SAVE_VERSION = 1 as const;
export type ActiveGameMode = 'standard' | 'daily';

export interface TrifoldActiveGameSave {
  readonly version: typeof ACTIVE_GAME_SAVE_VERSION;
  readonly mode: ActiveGameMode;
  readonly seed: number;
  readonly game: TrifoldGameSaveV1;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
  readonly attemptId?: string;
  readonly updatedAtMs: number;
  readonly standard?: {
    readonly partition: StandardPartition;
    readonly difficulty: StandardDifficulty;
  };
  readonly daily?: {
    readonly dateKey: string;
    readonly kind: 'today' | 'archive';
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function positiveSeed(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function normalizeStandardMetadata(value: unknown): TrifoldActiveGameSave['standard'] | null {
  if (!isObject(value)) return null;
  const partition = value.partition;
  const difficulty = value.difficulty;
  if (partition !== 'onboarding' && partition !== 'easy' && partition !== 'medium' && partition !== 'hard') return null;
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') return null;
  if (partition === 'onboarding' ? difficulty !== 'easy' : partition !== difficulty) return null;
  return { partition, difficulty };
}

function normalizeDailyMetadata(value: unknown): TrifoldActiveGameSave['daily'] | null {
  if (!isObject(value)) return null;
  if (typeof value.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value.dateKey)) return null;
  if (value.kind !== 'today' && value.kind !== 'archive') return null;
  return { dateKey: value.dateKey, kind: value.kind };
}

export function normalizeActiveGameSave(raw: unknown): TrifoldActiveGameSave | null {
  if (!isObject(raw) || raw.version !== ACTIVE_GAME_SAVE_VERSION) return null;
  if (raw.mode !== 'standard' && raw.mode !== 'daily') return null;
  const seed = positiveSeed(raw.seed);
  const moves = nonNegativeInteger(raw.moves);
  const updatedAtMs = nonNegativeInteger(raw.updatedAtMs);
  if (seed === null || moves === null || updatedAtMs === null) return null;
  if (typeof raw.activeMs !== 'number' || !Number.isFinite(raw.activeMs) || raw.activeMs < 0) return null;
  if (typeof raw.assisted !== 'boolean') return null;
  const attemptId = typeof raw.attemptId === 'string' && /^[a-zA-Z0-9_~\-]{1,100}$/u.test(raw.attemptId) ? raw.attemptId : undefined;
  if (raw.attemptId !== undefined && attemptId === undefined) return null;

  let game: TrifoldGameSaveV1;
  try {
    game = parseTrifoldGameSave(raw.game);
  } catch {
    return null;
  }
  if (game.seed !== seed) return null;

  if (raw.mode === 'standard') {
    if (raw.daily !== undefined) return null;
    const standard = normalizeStandardMetadata(raw.standard);
    if (!standard) return null;
    return {
      version: ACTIVE_GAME_SAVE_VERSION,
      mode: 'standard',
      seed,
      game,
      moves,
      activeMs: raw.activeMs,
      assisted: raw.assisted,
      ...(attemptId === undefined ? {} : { attemptId }),
      updatedAtMs,
      standard,
    };
  }

  if (raw.standard !== undefined) return null;
  const daily = normalizeDailyMetadata(raw.daily);
  if (!daily) return null;
  return {
    version: ACTIVE_GAME_SAVE_VERSION,
    mode: 'daily',
    seed,
    game,
    moves,
    activeMs: raw.activeMs,
    assisted: raw.assisted,
    updatedAtMs,
    daily,
  };
}
