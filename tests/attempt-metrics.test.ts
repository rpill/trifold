import test from 'node:test';
import assert from 'node:assert/strict';
import { AttemptMetrics } from '../src/meta/session/AttemptMetrics.ts';

test('successful sequence move is one decision and undo never decrements moves', () => {
  const metrics = new AttemptMetrics({ moves: 0, activeMs: 0, assisted: false });
  metrics.recordSuccessfulPlayerDecision();
  metrics.recordUndo();
  assert.equal(metrics.moves, 1);
});

test('markAssisted is sticky for the whole attempt', () => {
  const metrics = new AttemptMetrics({ moves: 0, activeMs: 0, assisted: false });
  metrics.markAssisted();
  metrics.markAssisted();
  assert.equal(metrics.assisted, true);
});

test('snapshot carries validated active time for persistence', () => {
  const metrics = new AttemptMetrics({ moves: 2, activeMs: 500, assisted: false });
  metrics.setActiveMs(900);
  assert.deepEqual(metrics.snapshot(), { moves: 2, activeMs: 900, assisted: false });
  assert.throws(() => metrics.setActiveMs(-1), /activeMs/i);
});
