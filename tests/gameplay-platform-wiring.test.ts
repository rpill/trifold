import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('GameScene wires platform pause and GameplayActivity around active board lifecycle', () => {
  assert.match(game, /GameplayActivity/);
  assert.match(game, /platform\.platformPause\.subscribe/);
  assert.match(game, /setPlatformPaused/);
  assert.match(game, /setBoardActive/);
  assert.match(game, /setDocumentVisible/);
});

test('startup signals LoadingAPI ready after Phaser game construction without purchase reconciliation', () => {
  const gamePos = main.indexOf('new Phaser.Game');
  const readyPos = main.indexOf('platform.ready()');
  assert.ok(gamePos >= 0 && readyPos > gamePos);
  assert.doesNotMatch(main, /reconcileCoinPackPurchases|PurchaseReconciliation/);
});
