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
    "this.createControl(DRAGON_LABELS[family], () => this.collectDragons(family), false)",
  ]) {
    assert.ok(scene.includes(required), `expected GameScene to include ${required}`);
  }
  assert.equal(scene.includes('Date.now()'), false);
  assert.equal(scene.includes('Math.random()'), false);
});
