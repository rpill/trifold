import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('board carries Cascade motion primitives and resize-safe interaction geometry', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  const card = source('../src/game/view/SchematicCardView.ts');
  for (const required of [
    'dragDistanceThreshold',
    'isCommittedCardDrop',
    'getCardFlightPoint',
    'getCardDepthTransition',
    'getCardMotionDuration',
    'DEAL_STAGGER_MS',
    'Phaser.Math.Easing.Cubic.Out',
    'inputLocked',
    'settleInitialAutoMoves',
    'relayout',
    'width: this.layout.cardWidth',
    'height: this.layout.cardHeight',
  ]) {
    assert.ok(board.includes(required), `expected board source to include ${required}`);
  }
  for (const required of ['setSize', 'setInteractive', 'Phaser.Geom.Rectangle.Contains', 'setDraggable']) {
    assert.ok(card.includes(required), `expected schematic card source to include ${required}`);
  }
  for (const forbidden of ['StockVisualState', 'ThemeCatalog', 'Economy', 'coin-reward']) {
    assert.equal(board.includes(forbidden), false, `board must not depend on ${forbidden}`);
  }
});


test('board implements grouped drag/drop, snap-back, transaction playback, dragons and undo', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  for (const required of [
    "'pointerdown'", "'dragstart'", "'drag'", "'dragend'",
    "'card-touch'", "'card-place'", 'dragState', 'cardsFromSource', 'canPickUp',
    'isCommittedCardDrop', "reason === 'auto'", "reason === 'dragon'",
    'snapBack', 'actions.perform', 'actions.undo', "getCardMotionDuration('undo')",
    'if (this.dragState) return',
    'lastTap', 'isDoubleTap', 'now - this.lastTap.time < 300',
  ]) {
    assert.ok(board.includes(required), `expected interaction source to include ${required}`);
  }
});


test('schematic card input covers the full top-left-aligned card without a Container hitbox', () => {
  const card = source('../src/game/view/SchematicCardView.ts');
  const board = source('../src/game/view/TrifoldBoardView.ts');
  assert.ok(card.includes('scene.add.zone'), 'card should use a dedicated input Zone');
  assert.ok(card.includes('.setOrigin(0)'), 'input Zone must use top-left origin like Cascade cards');
  assert.equal(card.includes('scene.add.container'), false, 'Container input caused the visual/hitbox offset');
  assert.ok(board.includes("view.input.on('pointerdown'"));
  assert.ok(board.includes("view.input.on('dragstart'"));
});

test('direct drag drops and rejected drops settle immediately without player tweens', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  const dragEndStart = board.indexOf('private handleDragEnd');
  const resolveStart = board.indexOf('private resolveDropCommand', dragEndStart);
  const dragEnd = board.slice(dragEndStart, resolveStart);
  const snapStart = board.indexOf('private snapBack');
  const concurrentStart = board.indexOf('private animateOperationsConcurrently', snapStart);
  const snapBack = board.slice(snapStart, concurrentStart);

  assert.ok(dragEnd.includes('applyOperationsImmediately(playerOperations)'));
  assert.equal(dragEnd.includes("getCardMotionDuration('player')"), false, 'drag placement must not tween');
  assert.equal(dragEnd.includes('animateOperationsConcurrently(playerOperations'), false, 'drag placement must not tween');
  assert.ok(snapBack.includes('this.syncToState()'));
  assert.equal(snapBack.includes('animateCard('), false, 'rejected drag must snap back immediately');
});
