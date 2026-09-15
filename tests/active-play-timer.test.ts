import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivePlayTimer } from '../src/meta/session/ActivePlayTimer.ts';

test('timer accumulates only while running', () => {
  let now = 1_000;
  const timer = new ActivePlayTimer(() => now, 250);
  timer.resume();
  now = 1_400;
  timer.pause();
  now = 9_000;
  assert.equal(timer.elapsedMs, 650);
});

test('timer snapshot resumes from persisted elapsed time without counting offline wall time', () => {
  let now = 50_000;
  const timer = new ActivePlayTimer(() => now, 3_000);
  timer.resume();
  now += 500;
  timer.pause();
  assert.equal(timer.elapsedMs, 3_500);
});

test('pause/resume are idempotent and finish freezes forever', () => {
  let now = 0;
  const timer = new ActivePlayTimer(() => now);
  timer.resume();
  timer.resume();
  now = 100;
  timer.pause();
  timer.pause();
  timer.resume();
  now = 180;
  timer.finish();
  now = 10_000;
  timer.resume();
  assert.equal(timer.elapsedMs, 180);
  assert.equal(timer.finished, true);
});
