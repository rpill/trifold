import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardSubmissionQueue } from '../src/leaderboards/LeaderboardSubmissionQueue.ts';

test('same-board submissions serialize while different boards can proceed independently', async () => {
  const queue = new LeaderboardSubmissionQueue();
  const log: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = queue.run('daily', async () => { log.push('first-start'); await gate; log.push('first-end'); });
  const second = queue.run('daily', async () => { log.push('second'); });
  const other = queue.run('streak', async () => { log.push('other'); });
  await other;
  assert.deepEqual(log, ['first-start', 'other']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(log, ['first-start', 'other', 'first-end', 'second']);
});

test('score submissions share a global one-second rate limiter across boards', async () => {
  let now = 0;
  const waits: number[] = [];
  const queue = new LeaderboardSubmissionQueue({
    minScoreIntervalMs: 1000,
    now: () => now,
    sleep: async (ms) => { waits.push(ms); now += ms; },
  });
  const calls: number[] = [];
  await queue.runScore(async () => { calls.push(now); });
  await queue.runScore(async () => { calls.push(now); });
  await queue.runScore(async () => { calls.push(now); });
  assert.deepEqual(calls, [0, 1000, 2000]);
  assert.deepEqual(waits, [1000, 1000]);
});
