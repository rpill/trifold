import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ThemeRuntime } from '../src/theme/ThemeRuntime.ts';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('switching theme changes only cosmetic runtime data', () => {
  const runtime = new ThemeRuntime('base');
  const base = runtime.current;
  const baseBack = runtime.cardBackStyle;
  runtime.setTheme('launch_02');
  assert.equal(runtime.current.id, 'launch_02');
  assert.notEqual(runtime.current.board.surface, base.board.surface);
  assert.notDeepEqual(runtime.cardBackStyle, baseBack);
  assert.notEqual(runtime.slotPalette.edge, base.slots.edge);
});

test('card face renderer does not depend on ThemeDefinition or ThemeRuntime', () => {
  const card = source('src/game/view/SchematicCardView.ts');
  assert.doesNotMatch(card, /ThemeDefinition/);
  assert.doesNotMatch(card, /ThemeRuntime/);
  assert.match(card, /CardBackStyle/);
});

test('theme never enters viewport geometry while board routes slots and backs through runtime', () => {
  const viewport = source('src/game/view/ViewportLayout.ts');
  const board = source('src/game/view/TrifoldBoardView.ts');
  assert.doesNotMatch(viewport, /Theme(Runtime|Definition)|activeTheme/);
  assert.match(board, /ThemeRuntime/);
  assert.match(board, /theme\.slotPalette/);
  assert.match(board, /theme\.cardBackStyle/);
});
