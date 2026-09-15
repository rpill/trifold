export type ClockNow = () => number;

function nonNegativeMs(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number.`);
  return value;
}

export class ActivePlayTimer {
  private readonly now: ClockNow;
  private accumulatedMs: number;
  private runningSinceMs: number | null = null;
  private finishedState = false;

  constructor(now: ClockNow = () => performance.now(), initialElapsedMs = 0) {
    this.now = now;
    this.accumulatedMs = nonNegativeMs(initialElapsedMs, 'initialElapsedMs');
  }

  get elapsedMs(): number {
    if (this.runningSinceMs === null) return this.accumulatedMs;
    return this.accumulatedMs + Math.max(0, this.now() - this.runningSinceMs);
  }

  get running(): boolean {
    return this.runningSinceMs !== null;
  }

  get finished(): boolean {
    return this.finishedState;
  }

  resume(): void {
    if (this.finishedState || this.runningSinceMs !== null) return;
    this.runningSinceMs = this.now();
  }

  pause(): void {
    if (this.runningSinceMs === null) return;
    this.accumulatedMs += Math.max(0, this.now() - this.runningSinceMs);
    this.runningSinceMs = null;
  }

  finish(): void {
    if (this.finishedState) return;
    this.pause();
    this.finishedState = true;
  }

  snapshot(): { readonly activeMs: number; readonly running: boolean; readonly finished: boolean } {
    return {
      activeMs: this.elapsedMs,
      running: this.running,
      finished: this.finished,
    };
  }
}
