import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('GameScene converts logical viewport geometry to backing-store geometry exactly once', () => {
  for (const required of [
    'calculateViewportLayout',
    'scaleViewportLayout',
    'const cssZoom = this.scale.zoom',
    'renderScale',
    '.setZoom(1)',
    'this.input.dragDistanceThreshold = 7',
    'board.relayout',
    "this.scale.on('resize'",
  ]) {
    assert.ok(scene.includes(required), `expected GameScene to include ${required}`);
  }
});

test('GameScene wires deal source, controls, SFX preload and victory without random production fallback', () => {
  for (const required of [
    'DevelopmentDealSource', 'VerifiedCatalogDealSource', 'VerifiedDealCatalog',
    'Verified deal catalog unavailable', 'startNewDeal', 'requestUndo', 'collectDragons',
    'SfxController', 'SFX_ASSETS', 'loaderror', 'missingSfxKeys', 'const sound = this.sound', 'return sound.locked',
    "this.sfx?.play('victory')", 'isWon', 'Новая раздача', 'Отмена', 'RD', 'GD', 'WD',
    "this.createControl(DRAGON_LABELS[family]",
  ]) {
    assert.ok(scene.includes(required), `expected GameScene to include ${required}`);
  }
  assert.equal(scene.includes('Date.now()'), false);
  assert.equal(scene.includes('Math.random()'), false);
});


test('dragon buttons use a persistent dull-yellow style and brighten only when collectable', () => {
  for (const required of ['variant', "'dragon'", '0x8b7430', '0xd7b84d', 'canCollectDragons']) {
    assert.ok(scene.includes(required), `expected dragon control styling to include ${required}`);
  }
});


test('completed dragon family uses a darker third visual state', () => {
  for (const required of [
    'completed: boolean',
    "cell.kind === 'dragons' && cell.family === family",
    '0x4f4524',
    'control.completed = completed',
  ]) {
    assert.ok(scene.includes(required), `expected completed dragon styling to include ${required}`);
  }
});
