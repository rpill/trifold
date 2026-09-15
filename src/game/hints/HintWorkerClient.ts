import type { TrifoldSnapshot } from '../model/types.ts';
import type { HintSearchResult } from './HintSearch.ts';
import type { HintWorkerRequest, HintWorkerResponse } from './HintWorker.ts';

export interface WorkerLike {
  onmessage: ((event: MessageEvent<HintWorkerResponse>) => void) | null;
  onerror: ((event: Event) => void) | null;
  postMessage(message: HintWorkerRequest): void;
  terminate(): void;
}

export interface HintSolveOptions {
  readonly maxNodes?: number;
  readonly timeoutMs?: number;
}

type PendingRequest = {
  readonly resolve: (result: HintSearchResult) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
};

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL('./HintWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}

export class HintWorkerClient {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly createWorker: () => WorkerLike;

  constructor(createWorker: () => WorkerLike = defaultWorkerFactory) {
    this.createWorker = createWorker;
  }

  solve(snapshot: TrifoldSnapshot, options: HintSolveOptions = {}): Promise<HintSearchResult> {
    const id = this.nextId++;
    const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? 250_000));
    const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? 1_500));
    const worker = this.ensureWorker();

    return new Promise<HintSearchResult>((resolve) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        resolve({ status: 'UNDETERMINED', nodes: 0 });
        this.restartWorker();
      }, timeoutMs);
      this.pending.set(id, { resolve, timeout });
      worker.postMessage({ id, snapshot, maxNodes });
    });
  }

  dispose(): void {
    this.failAllPending();
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => this.handleMessage(event.data);
    worker.onerror = () => this.restartWorker();
    this.worker = worker;
    return worker;
  }

  private handleMessage(response: HintWorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    pending.resolve(response.result);
  }

  private restartWorker(): void {
    const old = this.worker;
    this.worker = null;
    old?.terminate();
    this.failAllPending();
  }

  private failAllPending(): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const entry of pending) {
      clearTimeout(entry.timeout);
      entry.resolve({ status: 'UNDETERMINED', nodes: 0 });
    }
  }
}
