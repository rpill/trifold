import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const boards = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');

test('GameScene wires platform pause and GameplayActivity around active board lifecycle', () => {
  assert.match(game, /GameplayActivity/);
  assert.match(game, /platform\.pause\.subscribe/);
  assert.match(game, /setPlatformPaused/);
  assert.match(game, /setBoardActive/);
  assert.match(game, /setDocumentVisible/);
});

test('startup signals LoadingAPI ready after Phaser game construction and reconciles purchases', () => {
  const gamePos = main.indexOf('new Phaser.Game');
  const readyPos = main.indexOf('platform.signalReady');
  assert.ok(gamePos >= 0 && readyPos > gamePos);
  assert.match(main, /reconcileCoinPackPurchases/);
});

test('auth flow reconciles cloud and outstanding coin purchases', () => {
  assert.match(boards, /connectCloud/);
  assert.match(boards, /reconcileCoinPackPurchases/);
});
