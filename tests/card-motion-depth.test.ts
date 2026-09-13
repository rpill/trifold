import test from 'node:test';
import assert from 'node:assert/strict';
import { getCardDepthTransition } from '../src/game/view/CardMotionDepth.ts';

test('travelling card stays above board until it settles', () => {
  assert.deepEqual(getCardDepthTransition(3007, 205, true, true), { active: 3007, resting: 205 });
  assert.deepEqual(getCardDepthTransition(100, 205, true, true), { active: 3000, resting: 205 });
  assert.deepEqual(getCardDepthTransition(100, 205, false, true), { active: 205, resting: 205 });
});
