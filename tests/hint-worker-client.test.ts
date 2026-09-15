import test from 'node:test';
import assert from 'node:assert/strict';
import { HintWorkerClient, type WorkerLike } from '../src/game/hints/HintWorkerClient.ts';
import type { HintWorkerResponse } from '../src/game/hints/HintWorker.ts';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<HintWorkerResponse>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly posted: unknown[] = [];
  terminated = false;
  postMessage(message: unknown): void { this.posted.push(message); }
  terminate(): void { this.terminated = true; }
  emit(response: HintWorkerResponse): void { this.onmessage?.({ data: response } as MessageEvent<HintWorkerResponse>); }
  fail(): void { this.onerror?.(new Event('error')); }
}

function snapshot(seed = 1) {
  const game = new TrifoldGame(createDeal(seed));
  game.settleInitialAutoMoves();
  return game.snapshot();
}

test('worker client correlates concurrent responses by request id', async () => {
  const worker = new FakeWorker();
  const client = new HintWorkerClient(() => worker);
  const a = client.solve(snapshot(1), { timeoutMs: 1000, maxNodes: 10 });
  const b = client.solve(snapshot(2), { timeoutMs: 1000, maxNodes: 20 });
  const reqA = worker.posted[0] as { id: number };
  const reqB = worker.posted[1] as { id: number };
  worker.emit({ id: reqB.id, result: { status: 'UNSOLVABLE', nodes: 7 } });
  worker.emit({ id: reqA.id, result: { status: 'UNDETERMINED', nodes: 10 } });
  assert.equal((await a).status, 'UNDETERMINED');
  assert.equal((await b).status, 'UNSOLVABLE');
});

test('timeout resolves undetermined and restarts a wedged worker', async () => {
  const workers: FakeWorker[] = [];
  const client = new HintWorkerClient(() => {
    const worker = new FakeWorker(); workers.push(worker); return worker;
  });
  const result = await client.solve(snapshot(), { timeoutMs: 5, maxNodes: 10 });
  assert.equal(result.status, 'UNDETERMINED');
  assert.equal(workers[0].terminated, true);
  const next = client.solve(snapshot(2), { timeoutMs: 1000, maxNodes: 10 });
  assert.equal(workers.length, 2);
  const req = workers[1].posted[0] as { id: number };
  workers[1].emit({ id: req.id, result: { status: 'UNSOLVABLE', nodes: 3 } });
  assert.equal((await next).status, 'UNSOLVABLE');
});

test('worker error resolves pending requests safely', async () => {
  const worker = new FakeWorker();
  const client = new HintWorkerClient(() => worker);
  const pending = client.solve(snapshot(), { timeoutMs: 1000, maxNodes: 10 });
  worker.fail();
  assert.equal((await pending).status, 'UNDETERMINED');
});

test('stale response after timeout is ignored', async () => {
  const workers: FakeWorker[] = [];
  const client = new HintWorkerClient(() => {
    const worker = new FakeWorker(); workers.push(worker); return worker;
  });
  const first = client.solve(snapshot(), { timeoutMs: 5, maxNodes: 10 });
  const firstReq = workers[0].posted[0] as { id: number };
  assert.equal((await first).status, 'UNDETERMINED');
  workers[0].emit({ id: firstReq.id, result: { status: 'SOLVED', nodes: 1, proof: [] } });
  const second = client.solve(snapshot(2), { timeoutMs: 1000, maxNodes: 10 });
  const secondReq = workers[1].posted[0] as { id: number };
  workers[1].emit({ id: secondReq.id, result: { status: 'UNSOLVABLE', nodes: 2 } });
  assert.equal((await second).status, 'UNSOLVABLE');
});
