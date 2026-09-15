import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPressGesture } from '../src/ui/themes/ThemeCardPress.ts';

const scrollSource = readFileSync(new URL('../src/ui/components/ScrollRegion.ts', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../src/ui/themes/ThemeCard.ts', import.meta.url), 'utf8');

test('ScrollRegion does not place an interactive overlay above child controls', () => {
  assert.equal(scrollSource.includes('inputZone'), false);
  assert.equal(scrollSource.includes('scene.add.zone'), false);
  assert.ok(scrollSource.includes("scene.input.on('pointerdown'"));
  assert.ok(scrollSource.includes("scene.input.on('pointermove'"));
  assert.ok(scrollSource.includes("scene.input.on('pointerup'"));
  assert.ok(scrollSource.includes('containsPointer'));
});

test('theme-card press gesture rejects scroll drags but accepts a normal click', () => {
  assert.equal(isPressGesture({ x: 100, y: 100 }, { x: 104, y: 105 }), true);
  assert.equal(isPressGesture({ x: 100, y: 100 }, { x: 111, y: 100 }), false);
  assert.equal(isPressGesture({ x: 100, y: 100 }, { x: 100, y: 112 }), false);
});

test('ThemeCard commits actions on pointerup after gesture validation', () => {
  assert.ok(cardSource.includes("this.zone.on('pointerdown'"));
  assert.ok(cardSource.includes("this.zone.on('pointerup'"));
  assert.ok(cardSource.includes('isPressGesture'));
});
