export interface AttemptMetricsSnapshot {
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

export class AttemptMetrics {
  private moveCount: number;
  private activeTimeMs: number;
  private assistedState: boolean;

  constructor(initial: AttemptMetricsSnapshot) {
    this.moveCount = nonNegativeInteger(initial.moves, 'moves');
    this.activeTimeMs = nonNegativeInteger(initial.activeMs, 'activeMs');
    this.assistedState = Boolean(initial.assisted);
  }

  get moves(): number {
    return this.moveCount;
  }

  get activeMs(): number {
    return this.activeTimeMs;
  }

  get assisted(): boolean {
    return this.assistedState;
  }

  recordSuccessfulPlayerDecision(): void {
    this.moveCount += 1;
  }

  recordUndo(): void {
    // Undo changes board state, not the historical decision count.
  }

  markAssisted(): void {
    this.assistedState = true;
  }

  setActiveMs(activeMs: number): void {
    this.activeTimeMs = nonNegativeInteger(activeMs, 'activeMs');
  }

  snapshot(): AttemptMetricsSnapshot {
    return {
      moves: this.moveCount,
      activeMs: this.activeTimeMs,
      assisted: this.assistedState,
    };
  }
}
