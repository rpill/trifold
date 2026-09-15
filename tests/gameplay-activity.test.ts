import test from 'node:test';
import assert from 'node:assert/strict';
import { GameplayActivity } from '../src/platform/GameplayActivity.ts';

test('gameplay activity starts only when board is active visible and unblocked', () => {
  const calls: string[] = [];
  const activity = new GameplayActivity({
    start: () => calls.push('start'),
    stop: () => calls.push('stop'),
  });
  activity.setBoardActive(true);
  assert.deepEqual(calls, ['start']);
  activity.setBoardActive(true);
  assert.deepEqual(calls, ['start']);
  activity.setDocumentVisible(false);
  activity.setDocumentVisible(false);
  assert.deepEqual(calls, ['start', 'stop']);
  activity.setDocumentVisible(true);
  assert.deepEqual(calls, ['start', 'stop', 'start']);
  activity.setBlockingOverlayOpen(true);
  assert.deepEqual(calls, ['start', 'stop', 'start', 'stop']);
  activity.setBlockingOverlayOpen(false);
  assert.deepEqual(calls, ['start', 'stop', 'start', 'stop', 'start']);
  activity.setPlatformPaused(true);
  assert.deepEqual(calls.at(-1), 'stop');
  activity.setPlatformPaused(false);
  assert.deepEqual(calls.at(-1), 'start');
  activity.setBoardActive(false);
  assert.deepEqual(calls.at(-1), 'stop');
});
