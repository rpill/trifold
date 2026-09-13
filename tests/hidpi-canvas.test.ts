import test from 'node:test';
import assert from 'node:assert/strict';
import { planHiDpiCanvas } from '../src/render/HiDpiCanvas.ts';

test('DPR 1 keeps a 844x390 canvas at 844x390', () => {
  assert.deepEqual(planHiDpiCanvas(844, 390, 1), {
    logicalWidth: 844,
    logicalHeight: 390,
    renderScale: 1,
    backingWidth: 844,
    backingHeight: 390,
    cssZoom: 1,
  });
});

test('DPR above 2 uses a 2x backing store without changing CSS footprint', () => {
  assert.deepEqual(planHiDpiCanvas(844, 390, 3), {
    logicalWidth: 844,
    logicalHeight: 390,
    renderScale: 2,
    backingWidth: 1688,
    backingHeight: 780,
    cssZoom: 0.5,
  });
});

test('invalid dimensions and DPR normalize to safe one-pixel backing store', () => {
  assert.deepEqual(planHiDpiCanvas(0, Number.NaN, 0), {
    logicalWidth: 1,
    logicalHeight: 1,
    renderScale: 1,
    backingWidth: 1,
    backingHeight: 1,
    cssZoom: 1,
  });
});
