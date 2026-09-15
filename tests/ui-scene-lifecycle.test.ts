import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = readFileSync(new URL('../src/ui/scenes/BaseUiScene.ts', import.meta.url), 'utf8');
const daily = readFileSync(new URL('../src/ui/scenes/DailyScene.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('BaseUiScene refuses late relayout work after Phaser scene shutdown', () => {
  assert.ok(base.includes('requestUiLayout'));
  assert.ok(base.includes('isUiSceneActive'));
  assert.ok(base.includes('this.sys.isActive()'));
  assert.ok(base.includes('this.requestUiLayout()'));
  assert.equal(base.includes('private handleUiResize(): void {\n    this.refreshUiLayout();'), false);
});

test('DailyScene never forces a direct layout from currentUiViewport during refreshes', () => {
  assert.equal(daily.includes('this.layout(this.currentUiViewport())'), false);
  assert.ok(daily.includes('this.requestUiLayout()'));
});

test('Home async profile updates stop touching UI after shutdown', () => {
  assert.ok(home.includes('if (!this.isUiSceneActive()) return;'));
  assert.equal(home.includes('this.layout(this.currentUiViewport())'), false);
  assert.ok(home.includes('this.requestUiLayout()'));
});

test('DailyScene drops stale Phaser object references between shutdown and recreate', () => {
  const createStart = daily.indexOf('create(): void {');
  const createEnd = daily.indexOf('\n  protected layout', createStart);
  const createBody = daily.slice(createStart, createEnd);
  const resetIndex = createBody.indexOf('this.clearDailySceneReferences();');
  const gridIndex = createBody.indexOf('this.renderCalendarGrid(false);');
  assert.ok(resetIndex >= 0, 'DailyScene create must clear stale scene references first');
  assert.ok(gridIndex >= 0, 'DailyScene must render a fresh calendar generation');
  assert.ok(resetIndex < gridIndex, 'stale refs must be cleared before a fresh calendar generation is created');
  assert.ok(daily.includes('this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownDailyScene, this);'));
  assert.ok(daily.includes('this.cells.length = 0;'), 'calendar cell registry must be emptied on lifecycle reset');
  assert.ok(daily.includes('this.confirmShell = null;'), 'confirmation overlay refs must not survive shutdown');
});

test('DailyScene destroys each active calendar generation before replacing it', () => {
  assert.ok(daily.includes('private destroyCalendarCells(): void'));
  assert.ok(daily.includes('cell.zone.removeAllListeners();'));
  assert.ok(daily.includes('cell.zone.destroy();'));
  assert.ok(daily.includes('cell.label.destroy();'));
  assert.ok(daily.includes('cell.surface.destroy();'));
  assert.ok(daily.includes('this.cells.length = 0;'));
  assert.ok(daily.includes('this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownDailyScene, this);'));
});


test('GameScene invalidates asynchronous session starts across shutdown and scene reuse', () => {
  for (const required of [
    'sceneGeneration',
    'isCurrentSceneGeneration',
    'const generation = ++this.sceneGeneration',
    'this.sceneGeneration += 1',
    'if (!this.isCurrentSceneGeneration(generation)) return;',
  ]) {
    assert.ok(game.includes(required), `expected GameScene lifecycle guard to include ${required}`);
  }
});

test('GameScene generation guard allows synchronous resume during create while still rejecting stale generations', () => {
  const helperStart = game.indexOf('private isCurrentSceneGeneration(generation: number): boolean {');
  assert.ok(helperStart >= 0, 'GameScene must expose a generation guard helper');
  const helperEnd = game.indexOf('\n  }', helperStart);
  const helperBody = game.slice(helperStart, helperEnd);
  assert.ok(helperBody.includes('this.sceneGeneration === generation'));
  assert.equal(
    helperBody.includes('this.sys.isActive()'),
    false,
    'resume-standard runs synchronously inside create(), before Phaser reports the scene active',
  );
});
