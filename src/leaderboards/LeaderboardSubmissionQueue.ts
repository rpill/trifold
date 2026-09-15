export interface LeaderboardSubmissionQueueOptions {
  readonly minScoreIntervalMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export class LeaderboardSubmissionQueue {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly minScoreIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private scoreTail: Promise<void> = Promise.resolve();
  private nextScoreAt = 0;

  constructor(options: LeaderboardSubmissionQueueOptions = {}) {
    this.minScoreIntervalMs = Math.max(0, Math.floor(options.minScoreIntervalMs ?? 1000));
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  }

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.then(() => undefined, () => undefined);
    this.tails.set(key, tail);
    void tail.finally(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return run;
  }

  runScore<T>(task: () => Promise<T>): Promise<T> {
    const run = this.scoreTail.then(async () => {
      const waitMs = Math.max(0, this.nextScoreAt - this.now());
      if (waitMs > 0) await this.sleep(waitMs);
      try {
        return await task();
      } finally {
        this.nextScoreAt = this.now() + this.minScoreIntervalMs;
      }
    }, async () => {
      const waitMs = Math.max(0, this.nextScoreAt - this.now());
      if (waitMs > 0) await this.sleep(waitMs);
      try {
        return await task();
      } finally {
        this.nextScoreAt = this.now() + this.minScoreIntervalMs;
      }
    });
    this.scoreTail = run.then(() => undefined, () => undefined);
    return run;
  }
}
