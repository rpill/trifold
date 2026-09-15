import { createDeal } from '../../game/model/deal.ts';
import { TrifoldGame } from '../../game/model/TrifoldGame.ts';
import { isWon } from '../../game/model/TrifoldRules.ts';
import type {
  PlayerCommand,
  ReadonlyTrifoldState,
  TransactionResult,
  TrifoldSnapshot,
} from '../../game/model/types.ts';
import type { ProfileRepository } from '../profile/ProfileRepository.ts';
import type { SavedDailyAttempt } from '../profile/ProfileTypes.ts';
import { ActivePlayTimer, type ClockNow } from '../session/ActivePlayTimer.ts';
import { AttemptMetrics } from '../session/AttemptMetrics.ts';
import { getArchiveDateKeys } from './DailyDate.ts';
import { getDailySelection, type DailyCatalogAccess } from './DailySchedule.ts';
import { settleDailyWin, type DailyWinSettlementResult } from './DailyWinSettlement.ts';

export type DailySessionKind = 'today' | 'archive';

export interface DailySessionViewState {
  readonly seed: number;
  readonly dailyDateKey: string;
  readonly kind: DailySessionKind;
  readonly moves: number;
  readonly activeMs: number;
  readonly won: boolean;
  readonly expired: boolean;
}

interface DailySessionBaseInput {
  readonly repository: ProfileRepository;
  readonly catalog: DailyCatalogAccess;
  readonly timerNow?: ClockNow;
  readonly wallNow?: () => number;
  readonly calendarDateKeyNow?: () => string;
}

export interface StartTodayDailySessionInput extends DailySessionBaseInput {
  readonly todayKey: string;
}

export interface StartArchiveDailySessionInput extends DailySessionBaseInput {
  readonly dailyDateKey: string;
  readonly todayKey: string;
}

export interface ResumeDailySessionInput extends DailySessionBaseInput {
  readonly todayKey: string;
}

export type DailyDateChangeResult =
  | { readonly status: 'active'; readonly dailyDateKey: string }
  | { readonly status: 'expired-today'; readonly dailyDateKey: string }
  | { readonly status: 'expired-archive'; readonly dailyDateKey: string };

function wallTimestamp(now: () => number): number {
  const value = now();
  if (!Number.isFinite(value) || value < 0) throw new Error('wallNow must return a non-negative timestamp.');
  return Math.floor(value);
}

function defaultCalendarDateKey(): string {
  const now = new Date();
  return `${now.getFullYear().toString().padStart(4, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

function isArchiveAvailable(dateKey: string, todayKey: string): boolean {
  return getArchiveDateKeys(todayKey, 90).includes(dateKey as never);
}

export class DailySessionController {
  private readonly repository: ProfileRepository;
  private readonly game: TrifoldGame;
  private readonly seed: number;
  private readonly dailyDateKey: string;
  private readonly kind: DailySessionKind;
  private readonly wallNow: () => number;
  private readonly calendarDateKeyNow: () => string;
  private readonly timer: ActivePlayTimer;
  private readonly metrics: AttemptMetrics;
  private visible = true;
  private blockingOverlayOpen = false;
  private wonState: boolean;
  private expiredState = false;
  private settled = false;
  private settlement: DailyWinSettlementResult | null = null;
  private persistenceQueue: Promise<void> = Promise.resolve();

  private constructor(
    repository: ProfileRepository,
    game: TrifoldGame,
    seed: number,
    dailyDateKey: string,
    kind: DailySessionKind,
    timerNow: ClockNow,
    wallNow: () => number,
    calendarDateKeyNow: () => string,
    initial: { readonly moves: number; readonly activeMs: number },
  ) {
    this.repository = repository;
    this.game = game;
    this.seed = seed;
    this.dailyDateKey = dailyDateKey;
    this.kind = kind;
    this.wallNow = wallNow;
    this.calendarDateKeyNow = calendarDateKeyNow;
    this.metrics = new AttemptMetrics({ moves: initial.moves, activeMs: initial.activeMs, assisted: false });
    this.timer = new ActivePlayTimer(timerNow, initial.activeMs);
    this.wonState = isWon(game.state);
    if (this.wonState) this.timer.finish();
  }

  static async startToday(input: StartTodayDailySessionInput): Promise<DailySessionController> {
    const selection = getDailySelection(input.catalog, input.todayKey);
    return this.startNew(input, selection.dateKey, selection.seed, 'today');
  }

  static async startArchive(input: StartArchiveDailySessionInput): Promise<DailySessionController> {
    if (input.dailyDateKey === input.todayKey || !isArchiveAvailable(input.dailyDateKey, input.todayKey)) {
      throw new RangeError('Daily date is outside the current archive window.');
    }
    const selection = getDailySelection(input.catalog, input.dailyDateKey);
    return this.startNew(input, selection.dateKey, selection.seed, 'archive');
  }

  static resume(input: ResumeDailySessionInput): DailySessionController {
    const saved = input.repository.current.daily.active;
    if (!saved) throw new Error('There is no active Daily attempt to resume.');
    if (!isArchiveAvailable(saved.dailyDateKey, input.todayKey)) {
      throw new RangeError('Saved Daily attempt is outside the current archive window.');
    }
    const selection = getDailySelection(input.catalog, saved.dailyDateKey);
    if (selection.seed !== saved.seed) throw new Error('Saved Daily seed does not match verified schedule.');
    const controller = new DailySessionController(
      input.repository,
      TrifoldGame.restore(saved.game),
      saved.seed,
      saved.dailyDateKey,
      saved.dailyDateKey === input.todayKey ? 'today' : 'archive',
      input.timerNow ?? (() => performance.now()),
      input.wallNow ?? (() => Date.now()),
      input.calendarDateKeyNow ?? defaultCalendarDateKey,
      { moves: saved.moves, activeMs: saved.activeMs },
    );
    controller.settleInitialAutoMoves();
    controller.syncTimerState();
    return controller;
  }

  static async resumeOrClearExpired(input: ResumeDailySessionInput): Promise<DailySessionController> {
    const saved = input.repository.current.daily.active;
    if (!saved) throw new Error('There is no active Daily attempt to resume.');
    if (!isArchiveAvailable(saved.dailyDateKey, input.todayKey)) {
      await input.repository.mutate((profile) => ({
        ...profile,
        daily: { ...profile.daily, active: null },
      }));
      throw new RangeError('Saved Daily attempt is outside the current archive window.');
    }
    return this.resume(input);
  }

  private static async startNew(
    input: DailySessionBaseInput,
    dailyDateKey: string,
    seed: number,
    kind: DailySessionKind,
  ): Promise<DailySessionController> {
    const controller = new DailySessionController(
      input.repository,
      new TrifoldGame(createDeal(seed)),
      seed,
      dailyDateKey,
      kind,
      input.timerNow ?? (() => performance.now()),
      input.wallNow ?? (() => Date.now()),
      input.calendarDateKeyNow ?? defaultCalendarDateKey,
      { moves: 0, activeMs: 0 },
    );
    const active = controller.captureActiveAttempt();
    await input.repository.mutate((profile) => ({
      ...profile,
      daily: { ...profile.daily, active },
    }));
    controller.syncTimerState();
    return controller;
  }

  get state(): ReadonlyTrifoldState {
    return this.game.state;
  }

  snapshot(): TrifoldSnapshot {
    return this.game.snapshot();
  }

  get canUndo(): boolean {
    return !this.settled && !this.wonState && !this.expiredState && this.game.canUndo;
  }

  get viewState(): DailySessionViewState {
    return {
      seed: this.seed,
      dailyDateKey: this.dailyDateKey,
      kind: this.kind,
      moves: this.metrics.moves,
      activeMs: Math.floor(this.timer.elapsedMs),
      won: this.wonState,
      expired: this.expiredState,
    };
  }

  perform(command: PlayerCommand): TransactionResult | null {
    if (this.settled || this.wonState || this.expiredState) return null;
    const result = this.game.perform(command);
    if (!result) return null;
    this.metrics.recordSuccessfulPlayerDecision();
    this.wonState = result.won;
    if (this.wonState) this.timer.finish();
    this.queuePersist();
    return result;
  }

  settleInitialAutoMoves(): TransactionResult {
    if (this.settled || this.expiredState) return { operations: [], won: this.wonState };
    const result = this.game.settleInitialAutoMoves();
    this.wonState = result.won;
    if (this.wonState) this.timer.finish();
    this.queuePersist();
    return result;
  }

  undo(): TransactionResult | null {
    if (!this.canUndo) return null;
    const result = this.game.undo();
    if (!result) return null;
    this.metrics.recordUndo();
    this.wonState = result.won;
    this.queuePersist();
    return result;
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    if (!visible) {
      this.timer.pause();
      this.visible = false;
      this.queuePersist();
      return;
    }
    this.visible = true;
    this.syncTimerState();
  }

  setBlockingOverlayOpen(open: boolean): void {
    if (this.blockingOverlayOpen === open) return;
    if (open) {
      this.timer.pause();
      this.blockingOverlayOpen = true;
      this.queuePersist();
      return;
    }
    this.blockingOverlayOpen = false;
    this.syncTimerState();
  }

  handleDateChange(): DailyDateChangeResult {
    const todayKey = this.calendarDateKeyNow();
    if (todayKey === this.dailyDateKey) return { status: 'active', dailyDateKey: this.dailyDateKey };
    this.timer.pause();
    if (this.kind === 'today') {
      this.expiredState = true;
      this.queuePersist();
      return { status: 'expired-today', dailyDateKey: this.dailyDateKey };
    }
    if (!isArchiveAvailable(this.dailyDateKey, todayKey)) {
      this.expiredState = true;
      this.persistenceQueue = this.persistenceQueue.then(async () => {
        await this.repository.mutate((profile) => ({
          ...profile,
          daily: {
            ...profile.daily,
            active: profile.daily.active?.dailyDateKey === this.dailyDateKey ? null : profile.daily.active,
          },
        }));
      });
      return { status: 'expired-archive', dailyDateKey: this.dailyDateKey };
    }
    return { status: 'active', dailyDateKey: this.dailyDateKey };
  }

  async flushPersistence(): Promise<void> {
    await this.persistenceQueue;
  }

  async settleWin(): Promise<DailyWinSettlementResult> {
    if (this.settlement) return this.settlement;
    if (!this.wonState) throw new Error('Cannot settle Daily attempt before it is won.');
    this.timer.finish();
    this.syncMetricsTime();
    await this.flushPersistence();

    let committed: DailyWinSettlementResult | null = null;
    await this.repository.mutate((profile) => {
      const result = settleDailyWin(profile, {
        dailyDateKey: this.dailyDateKey,
        completionDateKey: this.calendarDateKeyNow(),
        moves: this.metrics.moves,
        activeMs: this.metrics.activeMs,
      });
      const active = result.profile.daily.active;
      const shouldClear = active?.dailyDateKey === this.dailyDateKey && active.seed === this.seed;
      const nextProfile = {
        ...result.profile,
        daily: { ...result.profile.daily, active: shouldClear ? null : active },
      };
      committed = { ...result, profile: nextProfile };
      return nextProfile;
    });
    if (!committed) throw new Error('Daily settlement did not commit.');
    this.settled = true;
    this.settlement = committed;
    return committed;
  }

  private syncTimerState(): void {
    if (this.settled || this.wonState || this.expiredState || !this.visible || this.blockingOverlayOpen) {
      this.timer.pause();
    } else {
      this.timer.resume();
    }
  }

  private syncMetricsTime(): void {
    this.metrics.setActiveMs(Math.floor(this.timer.elapsedMs));
  }

  private captureActiveAttempt(): SavedDailyAttempt {
    this.syncMetricsTime();
    return {
      version: 1,
      dailyDateKey: this.dailyDateKey,
      seed: this.seed,
      game: this.game.exportSave(),
      moves: this.metrics.moves,
      activeMs: this.metrics.activeMs,
      updatedAtMs: wallTimestamp(this.wallNow),
    };
  }

  private queuePersist(): void {
    if (this.settled) return;
    const snapshot = this.captureActiveAttempt();
    this.persistenceQueue = this.persistenceQueue.then(async () => {
      await this.repository.mutate((profile) => ({
        ...profile,
        daily: { ...profile.daily, active: snapshot },
      }));
    });
  }
}
