import { TrifoldGame } from '../../game/model/TrifoldGame.ts';
import type { PlayerCommand, TrifoldSnapshot } from '../../game/model/types.ts';
import type { HintSearchResult } from '../../game/hints/HintSearch.ts';

export interface HintSolverLike {
  solve(snapshot: TrifoldSnapshot, options?: { readonly maxNodes?: number; readonly timeoutMs?: number }): Promise<HintSearchResult>;
}

export interface HintSessionLike {
  snapshot(): TrifoldSnapshot;
  markAssisted(): void;
}

export type HintPrepareResult =
  | { readonly status: 'ready'; readonly command: PlayerCommand }
  | { readonly status: 'unavailable' };

interface PreparedHint {
  readonly fingerprint: string;
  readonly command: PlayerCommand;
}

function fingerprint(snapshot: TrifoldSnapshot): string {
  return JSON.stringify(snapshot);
}

function commandIsLegal(snapshot: TrifoldSnapshot, command: PlayerCommand): boolean {
  try {
    const game = TrifoldGame.restore({
      version: 1,
      seed: snapshot.seed,
      snapshot,
      history: { version: 1, entries: [] },
    });
    return game.perform(command) !== null;
  } catch {
    return false;
  }
}

export class HintCoordinator {
  private readonly session: HintSessionLike;
  private readonly solver: HintSolverLike;
  private prepared: PreparedHint | null = null;
  private unavailableFingerprint: string | null = null;

  constructor(session: HintSessionLike, solver: HintSolverLike) {
    this.session = session;
    this.solver = solver;
  }

  clear(): void {
    this.prepared = null;
    this.unavailableFingerprint = null;
  }

  isUnavailableForCurrentState(): boolean {
    return this.unavailableFingerprint !== null
      && fingerprint(this.session.snapshot()) === this.unavailableFingerprint;
  }

  async prepare(): Promise<HintPrepareResult> {
    this.prepared = null;
    const snapshot = this.session.snapshot();
    const currentFingerprint = fingerprint(snapshot);
    const result = await this.solver.solve(snapshot, { maxNodes: 250_000, timeoutMs: 1_500 });
    const stateUnchanged = fingerprint(this.session.snapshot()) === currentFingerprint;
    if (!stateUnchanged) return { status: 'unavailable' };
    if (result.status !== 'SOLVED') {
      this.unavailableFingerprint = currentFingerprint;
      return { status: 'unavailable' };
    }
    const command = result.proof[0];
    if (!command || !commandIsLegal(snapshot, command)) {
      this.unavailableFingerprint = currentFingerprint;
      return { status: 'unavailable' };
    }
    this.unavailableFingerprint = null;
    this.prepared = { fingerprint: currentFingerprint, command };
    return { status: 'ready', command };
  }

  async revealPreparedHint(): Promise<PlayerCommand | null> {
    const prepared = this.prepared;
    if (!prepared) return null;
    if (fingerprint(this.session.snapshot()) !== prepared.fingerprint) {
      this.prepared = null;
      return null;
    }
    this.session.markAssisted();
    this.prepared = null;
    return prepared.command;
  }
}
