import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const board = readFileSync(new URL('../src/game/view/TrifoldBoardView.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('GameScene routes Standard actions through StandardSessionController', () => {
  for (const required of [
    'StandardSessionController', "mode === 'resume-standard'", 'session.perform',
    'session.settleInitialAutoMoves', 'session.undo', 'session.settleWin',
    'session.setVisible', 'visibilitychange', 'flushPersistence()',
  ]) assert.ok(scene.includes(required), `expected GameScene to include ${required}`);
  assert.equal(scene.includes('dealSource.nextSeed'), false);
});

test('board consumes a read-only board state source so the session stays the meta authority', () => {
  assert.ok(board.includes('BoardStateSource'));
  assert.ok(board.includes('readonly state: ReadonlyTrifoldState'));
  assert.ok(board.includes('snapshot(): TrifoldSnapshot'));
});

test('startup initializes shared services and boots through BootScene before Home/Game routes', () => {
  assert.ok(main.includes('createRuntimeServices'));
  assert.ok(main.includes('installRuntimeServices'));
  assert.ok(main.includes('BootScene'));
  assert.ok(main.includes('HomeScene'));
  assert.ok(main.includes('scene: [BootScene, HomeScene, GameScene'), 'BootScene must remain first so first-run tutorial routing happens before Home/Game routes');
});
