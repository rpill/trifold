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
    'dealOrigin',
    'setFaceDown',
    'relayout',
    'width: this.layout.cardWidth',
    'height: this.layout.cardHeight',
  ]) {
    assert.ok(board.includes(required), `expected board source to include ${required}`);
  }
  for (const required of ['setSize', 'setInteractive', 'Phaser.Geom.Rectangle.Contains', 'setDraggable', 'faceDown', 'renderSurface', 'patternCell']) {
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
  assert.equal(dragEnd.includes('animateOperationsConcurrently(playerOperations'), false, 'drag placement must not tween');
  assert.ok(snapBack.includes('this.syncToState()'));
  assert.equal(snapBack.includes('animateCard('), false, 'rejected drag must snap back immediately');
});


test('technical deck stays visually distinct without a DEAL text label', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  assert.ok(board.includes('updateDealStack'));
  assert.equal(board.includes("'DEAL'"), false, 'the schematic back should identify the deck without an extra DEAL label');
  assert.ok(board.includes('freeSlotAlpha'));
  assert.ok(board.includes('foundationSlotAlpha'));
});


test('initial deal uses the flower slot as its source and removes the temporary deck after dealing', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  assert.ok(board.includes('this.layout.dealOrigin.x'));
  assert.ok(board.includes('this.dealStack.clear()'));
  assert.ok(board.includes("['FREE', 'FREE', 'FREE', 'F', 'R', 'G', 'B', 'RD', 'GD', 'BD']"));
  assert.equal(board.includes("'DEAL'"), false);
});

test('initial deal stack mirrors Cascade stock depletion instead of drawing a static decorative pile', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  for (const required of [
    'DealStackVisualState', 'dealStackVisual', 'removeDealtCard()', 'updateDealStack',
    'getDealFlightOriginY', "getLayerOffsets(this.layout.profile)",
  ]) {
    assert.ok(board.includes(required), `expected deal-stack source to include ${required}`);
  }
  assert.equal(board.includes('private drawDealStack()'), false, 'static decorative stack renderer must be removed');
});


test('initial deal cards leave the deck face-up instead of flipping on landing', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  const start = board.indexOf('playInitialDeal(): void');
  const end = board.indexOf('relayout(layout: ViewportLayout)', start);
  assert.ok(start >= 0 && end > start, 'expected playInitialDeal method');
  const initialDeal = board.slice(start, end);
  assert.equal(initialDeal.includes('setFaceDown(true)'), false, 'dealt card must not fly face-down');
  assert.ok(initialDeal.includes('setFaceDown(false)'), 'dealt card should be explicitly face-up before flight');
});


test('schematic cards stay playable with compact corner rank/type and no long overlapping labels', () => {
  const card = source('../src/game/view/SchematicCardView.ts');
  for (const required of [
    'topLeftRank', 'topLeftKind', 'centerLabel', 'bottomRightRank', 'bottomRightKind',
    "return suit === 'coins' ? 'CO' : suit === 'bamboo' ? 'BA' : 'CH';",
  ]) {
    assert.ok(card.includes(required), `expected card source to include ${required}`);
  }
  for (const forbidden of ['centerSubLabel', 'debugLabel', 'COINS', 'BAMBOO', 'CHARACTERS', 'WHITE DRAGON']) {
    assert.equal(card.includes(forbidden), false, `compact card face must not include ${forbidden}`);
  }
});


test('collected dragon cells render a schematic card back and hide the FREE label', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  for (const required of ["cell?.kind === 'dragons'", 'drawSchematicCardBack', "cell?.kind === 'empty'"]) {
    assert.ok(board.includes(required), `expected collected-dragon rendering to include ${required}`);
  }
});

test('dragon collection shows the blocked back only after all four dragons finish flying', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  const collectStart = board.indexOf('collectDragons(family: DragonFamily): void');
  const pauseStart = board.indexOf('setUiPaused(paused: boolean)', collectStart);
  assert.ok(collectStart >= 0 && pauseStart > collectStart, 'expected collectDragons method');
  const collect = board.slice(collectStart, pauseStart);

  assert.ok(collect.includes('pendingDragonCollectionCell'), 'destination cell should be suppressed while dragons fly');
  assert.ok(collect.includes('finishDragonCollectionVisual(dragonOperations)'), 'blocked back should be finalized after flight');
  assert.ok(collect.includes("getCardMotionDuration('foundation')"), 'dragon collection should use a visible service-flight duration');
  assert.ok(
    collect.indexOf('finishDragonCollectionVisual(dragonOperations)') < collect.indexOf('playAutomaticStream(automaticOperations'),
    'blocked back should appear before any automatic follow-up moves',
  );

  const redrawStart = board.indexOf('private redrawSlots(): void');
  const dealStart = board.indexOf('private updateDealStack(): void', redrawStart);
  const redraw = board.slice(redrawStart, dealStart);
  assert.ok(redraw.includes('index !== this.pendingDragonCollectionCell'), 'pending destination must not draw a back early');

  const finishStart = board.indexOf('private finishDragonCollectionVisual');
  const nextMethod = board.indexOf('private ', finishStart + 10);
  const finish = board.slice(finishStart, nextMethod > finishStart ? nextMethod : undefined);
  assert.ok(finish.includes('view.setVisible(false)'), 'arrived dragon faces must disappear before the blocked back is drawn');
  assert.ok(finish.includes('this.pendingDragonCollectionCell = null'));
  assert.ok(finish.includes('this.redrawSlots()'));
});

test('automatic foundation chains use Cascade-style streamed flights instead of waiting for each landing', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  const animation = source('../src/game/view/CardAnimation.ts');
  assert.ok(animation.includes('FOUNDATION_STREAM_INTERVAL = 150'), 'Cascade stream cadence must stay 150ms');
  assert.ok(animation.includes('getFoundationStreamInterval'), 'stream interval should be exposed through CardAnimation');
  assert.ok(board.includes('playAutomaticStream'), 'automatic moves need a dedicated stream scheduler');
  assert.ok(board.includes('busyLanes'), 'stream must lock each foundation lane independently');
  assert.ok(board.includes("operation.to.zone === 'foundation' ? operation.to.suit : 'flower'"), 'foundation suits and flower need independent lanes');

  const dragStart = board.indexOf('private handleDragEnd');
  const dropResolve = board.indexOf('private resolveDropCommand', dragStart);
  const dragBlock = board.slice(dragStart, dropResolve);
  assert.ok(dragBlock.includes('playAutomaticStream(automaticOperations'), 'drag auto-chain should stream');
  assert.equal(dragBlock.includes('playOperationList(automaticOperations'), false, 'drag auto-chain must not be serial');

  const dealStart = board.indexOf('playInitialDeal(): void');
  const relayoutStart = board.indexOf('relayout(layout: ViewportLayout)', dealStart);
  const dealBlock = board.slice(dealStart, relayoutStart);
  assert.ok(dealBlock.includes('playAutomaticStream(settle.operations'), 'initial auto-finish should stream');
});

test('tableau columns render persistent slot outlines beneath cards', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  const redrawStart = board.indexOf('private redrawSlots(): void');
  const finishStart = board.indexOf('private finishDragonCollectionVisual', redrawStart);
  assert.ok(redrawStart >= 0 && finishStart > redrawStart, 'expected redrawSlots method');
  const redraw = board.slice(redrawStart, finishStart);

  assert.ok(redraw.includes('tableauSlotAlpha'), 'tableau placeholders should have their own subdued alpha');
  assert.ok(redraw.includes('for (const x of this.layout.tableauX)'), 'all eight tableau columns need a placeholder');
  assert.ok(redraw.includes('this.layout.tableauY'), 'tableau placeholders must sit at the tableau origin');
});

test('board exposes non-mutating hint highlights and clears them on interaction, undo, resize and destroy', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  for (const required of [
    'showHint(command: PlayerCommand)', 'clearHint(): void', 'hintGraphics', 'hintTween',
    'this.clearHint();', "command.type === 'collect-dragons'", 'canCollectDragons',
  ]) assert.ok(board.includes(required), `expected hint board contract to include ${required}`);
});

test('tutorial source highlight spans the full multi-card tableau run', () => {
  const board = source('../src/game/view/TrifoldBoardView.ts');
  for (const required of [
    'sourceCards[sourceCards.length - 1]',
    'lastSourcePlacement.y + this.layout.cardHeight - sourcePlacement.y',
    'outline(sourcePlacement.x, sourcePlacement.y, sourceHeight)',
  ]) assert.ok(board.includes(required), `tutorial multi-card highlight should include ${required}`);
});
