import test from 'node:test';
import assert from 'node:assert/strict';
import { DEAL_STAGGER_MS, getCardMotionDuration } from '../src/game/view/CardAnimation.ts';

test('Trifold preserves Cascade card motion timings', () => {
  assert.equal(getCardMotionDuration('player'), 110);
  assert.equal(getCardMotionDuration('undo'), 110);
  assert.equal(getCardMotionDuration('deal'), 260);
  assert.equal(getCardMotionDuration('foundation'), 350);
  assert.equal(DEAL_STAGGER_MS, 52);
});
