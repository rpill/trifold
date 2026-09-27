import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { applyMetaOperation, hasCompletedAttempt } from '../src/meta/MetaOperations.ts';

test('difficulty, served seed and failed attempt update only their product state', () => {
  let state = createDefaultMetaSave();
  state = applyMetaOperation(state, { kind: 'set-standard-difficulty', difficulty: 'hard' });
  assert.equal(state.standard.selectedDifficulty, 'hard');

  state = applyMetaOperation(state, { kind: 'standard-served', seed: 77, partition: 'hard', difficulty: 'hard' });
  state = applyMetaOperation(state, { kind: 'standard-served', seed: 77, partition: 'hard', difficulty: 'hard' });
  assert.deepEqual(state.standard.recentSeeds, [77]);

  state = { ...state, standardWinStreak: { current: 4, best: 6 } };
  state = applyMetaOperation(state, { kind: 'standard-failed', attemptId: 'standard~1' });
  assert.deepEqual(state.standardWinStreak, { current: 0, best: 6 });
});

test('begin and complete operations are idempotent product receipts', () => {
  let state = createDefaultMetaSave();
  const begin = { kind: 'begin', attemptId: 'standard~1', mode: 'standard' } as const;
  const complete = { kind: 'complete', attemptId: 'standard~1', mode: 'standard' } as const;

  state = applyMetaOperation(state, begin);
  state = applyMetaOperation(state, begin);
  assert.deepEqual(state.progression.startedAttempts, ['standard~1']);
  assert.equal(hasCompletedAttempt(state, 'standard~1'), false);

  state = applyMetaOperation(state, complete);
  const afterFirst = structuredClone(state);
  state = applyMetaOperation(state, complete);
  assert.deepEqual(state, afterFirst);
  assert.deepEqual(state.progression.completedAttempts, ['standard~1']);
  assert.equal(hasCompletedAttempt(state, 'standard~1'), true);
});

test('daily hint-used marker is idempotent and creates only a valid Daily record', () => {
  let state = createDefaultMetaSave();
  state = applyMetaOperation(state, { kind: 'daily-hint-used', dailyId: '2026-09-27' });
  state = applyMetaOperation(state, { kind: 'daily-hint-used', dailyId: '2026-09-27' });
  assert.deepEqual(state.daily.records['2026-09-27'], {
    completed: false,
    completedOnTime: false,
    attempts: 0,
    hintUsed: true,
  });
  const unchanged = applyMetaOperation(state, { kind: 'daily-hint-used', dailyId: 'bad' });
  assert.equal(unchanged, state);
});
