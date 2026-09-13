import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import type { CardId, CardOperation, TrifoldDeal, TrifoldSnapshot } from '../src/game/model/types.ts';

function fixture(tableau: CardId[][]): TrifoldDeal {
  return { seed: 1, dealFormatVersion: 1, shuffleVersion: 1, tableau };
}

function allIds(snapshot: TrifoldSnapshot): CardId[] {
  return [
    ...snapshot.tableau.flat(),
    ...snapshot.freeCells.flatMap((cell) => cell.kind === 'card' ? [cell.cardId] : cell.kind === 'dragons' ? [...cell.cardIds] : []),
    ...snapshot.foundations.coins,
    ...snapshot.foundations.bamboo,
    ...snapshot.foundations.characters,
    ...(snapshot.flowerFoundation ? [snapshot.flowerFoundation] : []),
  ];
}

test('new game starts from the exact 8x5 deal with empty completion zones', () => {
  const game = new TrifoldGame(createDeal(1));
  const snapshot = game.snapshot();
  assert.equal(snapshot.tableau.length, 8);
  assert.deepEqual(snapshot.tableau.map((column) => column.length), Array(8).fill(5));
  assert.deepEqual(snapshot.freeCells, [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }]);
  assert.deepEqual(snapshot.foundations, { coins: [], bamboo: [], characters: [] });
  assert.equal(snapshot.flowerFoundation, null);
  assert.equal(game.canUndo, false);
  const ids = allIds(snapshot);
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
});

test('legal player run move mutates state and records ordered card operations', () => {
  const game = new TrifoldGame(fixture([
    ['coins-5', 'bamboo-4', 'characters-3'], ['bamboo-6'], [], [], [], [], [], [],
  ]));
  const result = game.perform({
    type: 'move',
    source: { zone: 'tableau', column: 0, index: 0 },
    target: { zone: 'tableau', column: 1 },
  });
  assert.ok(result);
  assert.deepEqual(game.snapshot().tableau[0], []);
  assert.deepEqual(game.snapshot().tableau[1], ['bamboo-6', 'coins-5', 'bamboo-4', 'characters-3']);
  assert.deepEqual(result.operations.slice(0, 3), [
    { type: 'move-card', cardId: 'coins-5', from: { zone: 'tableau', column: 0, index: 0 }, to: { zone: 'tableau', column: 1, index: 1 }, reason: 'player' },
    { type: 'move-card', cardId: 'bamboo-4', from: { zone: 'tableau', column: 0, index: 1 }, to: { zone: 'tableau', column: 1, index: 2 }, reason: 'player' },
    { type: 'move-card', cardId: 'characters-3', from: { zone: 'tableau', column: 0, index: 2 }, to: { zone: 'tableau', column: 1, index: 3 }, reason: 'player' },
  ]);
  assert.equal(game.canUndo, true);
});

test('invalid move leaves snapshot and undo history untouched', () => {
  const game = new TrifoldGame(fixture([['coins-5'], ['coins-6'], [], [], [], [], [], []]));
  const before = game.snapshot();
  const result = game.perform({
    type: 'move',
    source: { zone: 'tableau', column: 0, index: 0 },
    target: { zone: 'tableau', column: 1 },
  });
  assert.equal(result, null);
  assert.deepEqual(game.snapshot(), before);
  assert.equal(game.canUndo, false);
});

test('player move resolves flower and safe numeric auto wave in deterministic order', () => {
  const game = new TrifoldGame(fixture([
    ['coins-5'], ['bamboo-6'], ['flower'], ['coins-1'], ['bamboo-1'], ['characters-1'], ['coins-2'], [],
  ]));
  const result = game.perform({
    type: 'move',
    source: { zone: 'tableau', column: 0, index: 0 },
    target: { zone: 'tableau', column: 1 },
  });
  assert.ok(result);
  assert.equal(result.operations[0]?.reason, 'player');
  assert.equal(result.operations[1]?.cardId, 'flower');
  assert.deepEqual(result.operations.slice(2).map((operation) => operation.cardId), [
    'coins-1', 'bamboo-1', 'characters-1', 'coins-2',
  ]);
  assert.equal(game.snapshot().flowerFoundation, 'flower');
  assert.deepEqual(game.snapshot().foundations.coins, ['coins-1', 'coins-2']);
});

test('initial auto settle clears obvious cards without opening undo history', () => {
  const game = new TrifoldGame(fixture([
    ['flower'], ['coins-1'], ['bamboo-1'], ['characters-1'], [], [], [], [],
  ]));
  const result = game.settleInitialAutoMoves();
  assert.deepEqual(result.operations.map((operation) => operation.cardId), [
    'flower', 'coins-1', 'bamboo-1', 'characters-1',
  ]);
  assert.equal(game.canUndo, false);
});

test('dragon collection is one transaction with four deterministic operations', () => {
  const game = new TrifoldGame(fixture([
    ['dragon-red-1'], ['dragon-red-2'], ['dragon-red-3'], ['dragon-red-4'], [], [], [], [],
  ]));
  const result = game.perform({ type: 'collect-dragons', family: 'red' });
  assert.ok(result);
  assert.deepEqual(result.operations.map((operation) => [operation.cardId, operation.reason]), [
    ['dragon-red-1', 'dragon'], ['dragon-red-2', 'dragon'], ['dragon-red-3', 'dragon'], ['dragon-red-4', 'dragon'],
  ]);
  assert.deepEqual(game.snapshot().freeCells[0], {
    kind: 'dragons', family: 'red', cardIds: ['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4'],
  });
  assert.equal(game.canUndo, true);
});

test('one undo restores a player move plus its complete auto chain', () => {
  const game = new TrifoldGame(fixture([
    ['coins-5'], ['bamboo-6'], ['flower'], ['coins-1'], ['bamboo-1'], ['characters-1'], [], [],
  ]));
  const before = game.snapshot();
  const forward = game.perform({
    type: 'move',
    source: { zone: 'tableau', column: 0, index: 0 },
    target: { zone: 'tableau', column: 1 },
  });
  assert.ok(forward);
  const undo = game.undo();
  assert.ok(undo);
  assert.deepEqual(game.snapshot(), before);
  assert.deepEqual(undo.operations.map((operation) => operation.cardId), [...forward.operations].reverse().map((operation) => operation.cardId));
  for (let index = 0; index < undo.operations.length; index += 1) {
    const reversed: CardOperation = undo.operations[index];
    const original: CardOperation = forward.operations[forward.operations.length - 1 - index];
    assert.deepEqual(reversed.from, original.to);
    assert.deepEqual(reversed.to, original.from);
  }
  assert.equal(game.canUndo, false);
});

test('one undo restores a collected dragon family', () => {
  const game = new TrifoldGame(fixture([
    ['dragon-red-1'], ['dragon-red-2'], ['dragon-red-3'], ['dragon-red-4'], [], [], [], [],
  ]));
  const before = game.snapshot();
  assert.ok(game.perform({ type: 'collect-dragons', family: 'red' }));
  assert.ok(game.undo());
  assert.deepEqual(game.snapshot(), before);
});
