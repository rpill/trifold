import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCollectDragons,
  canDropInFreeCell,
  canDropOnTableau,
  canMoveToFoundation,
  canPickUp,
  cardsFromSource,
  findNextAutoMove,
  isSafeAutoFoundation,
  isWon,
} from '../src/game/model/TrifoldRules.ts';
import type { FreeCellState, ReadonlyTrifoldState } from '../src/game/model/types.ts';

function emptyCells(): FreeCellState[] {
  return [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }];
}

function state(overrides: Partial<ReadonlyTrifoldState> = {}): ReadonlyTrifoldState {
  return {
    tableau: Array.from({ length: 8 }, () => []),
    freeCells: emptyCells(),
    foundations: { coins: [], bamboo: [], characters: [] },
    flowerFoundation: null,
    ...overrides,
  };
}

test('tableau accepts descending different-suit numeric cards only', () => {
  const base = state({ tableau: [['bamboo-6'], ['coins-5'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(base, { zone: 'tableau', column: 1, index: 0 }, 0), true);

  const onCharacters = state({ tableau: [['characters-6'], ['coins-5'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(onCharacters, { zone: 'tableau', column: 1, index: 0 }, 0), true);

  const sameSuit = state({ tableau: [['coins-6'], ['coins-5'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(sameSuit, { zone: 'tableau', column: 1, index: 0 }, 0), false);

  const wrongRank = state({ tableau: [['bamboo-7'], ['coins-5'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(wrongRank, { zone: 'tableau', column: 1, index: 0 }, 0), false);
});

test('valid exposed numeric suffix moves as an unlimited run', () => {
  const tableau = [
    ['coins-9'],
    ['characters-8', 'coins-5', 'bamboo-4', 'characters-3'],
    [], [], [], [], [], [],
  ];
  const s = state({ tableau });
  const source = { zone: 'tableau', column: 1, index: 1 } as const;
  assert.deepEqual(cardsFromSource(s, source), ['coins-5', 'bamboo-4', 'characters-3']);
  assert.equal(canPickUp(s, source), true);
  assert.equal(canDropOnTableau(s, source, 2), true);

  const withNoEmptyFreeCells = state({
    tableau,
    freeCells: [
      { kind: 'card', cardId: 'dragon-red-1' },
      { kind: 'card', cardId: 'dragon-green-1' },
      { kind: 'card', cardId: 'dragon-white-1' },
    ],
  });
  assert.equal(canPickUp(withNoEmptyFreeCells, source), true);
});

test('broken runs and multi-card dragon or flower suffixes cannot be picked up', () => {
  const broken = state({ tableau: [['coins-5', 'coins-4'], [], [], [], [], [], [], []] });
  assert.equal(canPickUp(broken, { zone: 'tableau', column: 0, index: 0 }), false);

  const dragonSuffix = state({ tableau: [['dragon-red-1', 'coins-3'], [], [], [], [], [], [], []] });
  assert.equal(canPickUp(dragonSuffix, { zone: 'tableau', column: 0, index: 0 }), false);

  const flowerSuffix = state({ tableau: [['flower', 'coins-3'], [], [], [], [], [], [], []] });
  assert.equal(canPickUp(flowerSuffix, { zone: 'tableau', column: 0, index: 0 }), false);
});

test('single exposed dragon or flower can move to empty tableau or free cell', () => {
  for (const cardId of ['dragon-red-1', 'flower']) {
    const s = state({ tableau: [[cardId], [], [], [], [], [], [], []] });
    const source = { zone: 'tableau', column: 0, index: 0 } as const;
    assert.equal(canPickUp(s, source), true);
    assert.equal(canDropOnTableau(s, source, 1), true);
    assert.equal(canDropInFreeCell(s, source, 0), true);
  }
});

test('dragons and flower cannot be placed on cards and cannot receive cards', () => {
  const movingDragon = state({ tableau: [['coins-6'], ['dragon-red-1'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(movingDragon, { zone: 'tableau', column: 1, index: 0 }, 0), false);

  const targetDragon = state({ tableau: [['dragon-red-1'], ['coins-5'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(targetDragon, { zone: 'tableau', column: 1, index: 0 }, 0), false);

  const targetFlower = state({ tableau: [['flower'], ['coins-5'], [], [], [], [], [], []] });
  assert.equal(canDropOnTableau(targetFlower, { zone: 'tableau', column: 1, index: 0 }, 0), false);
});

test('free cells accept exactly one exposed card only when empty', () => {
  const s = state({ tableau: [['coins-5', 'bamboo-4'], [], [], [], [], [], [], []] });
  assert.equal(canDropInFreeCell(s, { zone: 'tableau', column: 0, index: 1 }, 0), true);
  assert.equal(canDropInFreeCell(s, { zone: 'tableau', column: 0, index: 0 }, 0), false);

  const occupied = state({
    tableau: [['coins-5'], [], [], [], [], [], [], []],
    freeCells: [{ kind: 'card', cardId: 'dragon-red-1' }, { kind: 'empty' }, { kind: 'empty' }],
  });
  assert.equal(canDropInFreeCell(occupied, { zone: 'tableau', column: 0, index: 0 }, 0), false);

  const dragons = state({
    tableau: [['coins-5'], [], [], [], [], [], [], []],
    freeCells: [{ kind: 'dragons', family: 'red', cardIds: ['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4'] }, { kind: 'empty' }, { kind: 'empty' }],
  });
  assert.equal(canDropInFreeCell(dragons, { zone: 'tableau', column: 0, index: 0 }, 0), false);
});

test('numeric foundations start at one and advance same suit by one', () => {
  const one = state({ tableau: [['coins-1'], [], [], [], [], [], [], []] });
  assert.equal(canMoveToFoundation(one, { zone: 'tableau', column: 0, index: 0 }, 'coins'), true);
  assert.equal(canMoveToFoundation(one, { zone: 'tableau', column: 0, index: 0 }, 'bamboo'), false);

  const two = state({
    tableau: [['coins-2'], [], [], [], [], [], [], []],
    foundations: { coins: ['coins-1'], bamboo: [], characters: [] },
  });
  assert.equal(canMoveToFoundation(two, { zone: 'tableau', column: 0, index: 0 }, 'coins'), true);

  const skipped = state({ tableau: [['coins-3'], [], [], [], [], [], [], []] });
  assert.equal(canMoveToFoundation(skipped, { zone: 'tableau', column: 0, index: 0 }, 'coins'), false);
});

test('foundation rejects dragons and flower', () => {
  for (const cardId of ['dragon-red-1', 'flower']) {
    const s = state({ tableau: [[cardId], [], [], [], [], [], [], []] });
    assert.equal(canMoveToFoundation(s, { zone: 'tableau', column: 0, index: 0 }, 'coins'), false);
  }
});

test('dragon collection follows Shenzhen destination rules for exposed matching dragons', () => {
  const legal = state({
    tableau: [['dragon-red-1'], ['dragon-red-2'], ['dragon-red-3'], [], [], [], [], []],
    freeCells: [{ kind: 'card', cardId: 'dragon-red-4' }, { kind: 'empty' }, { kind: 'card', cardId: 'coins-1' }],
  });
  assert.deepEqual(canCollectDragons(legal, 'red'), {
    family: 'red',
    sources: [
      { zone: 'tableau', column: 0, index: 0 },
      { zone: 'tableau', column: 1, index: 0 },
      { zone: 'tableau', column: 2, index: 0 },
      { zone: 'free-cell', cell: 0 },
    ],
    destinationCell: 0,
  });

  const buried = state({
    tableau: [['dragon-red-1', 'coins-2'], ['dragon-red-2'], ['dragon-red-3'], ['dragon-red-4'], [], [], [], []],
  });
  assert.equal(canCollectDragons(buried, 'red'), null);

  const noEmpty = state({
    tableau: [['dragon-red-1'], ['dragon-red-2'], ['dragon-red-3'], [], [], [], [], []],
    freeCells: [
      { kind: 'card', cardId: 'dragon-red-4' },
      { kind: 'card', cardId: 'coins-1' },
      { kind: 'card', cardId: 'bamboo-1' },
    ],
  });
  assert.deepEqual(canCollectDragons(noEmpty, 'red'), {
    family: 'red',
    sources: [
      { zone: 'tableau', column: 0, index: 0 },
      { zone: 'tableau', column: 1, index: 0 },
      { zone: 'tableau', column: 2, index: 0 },
      { zone: 'free-cell', cell: 0 },
    ],
    destinationCell: 0,
  });

  const noDestination = state({
    tableau: [['dragon-red-1'], ['dragon-red-2'], ['dragon-red-3'], ['dragon-red-4'], [], [], [], []],
    freeCells: [
      { kind: 'card', cardId: 'coins-1' },
      { kind: 'card', cardId: 'bamboo-1' },
      { kind: 'card', cardId: 'characters-1' },
    ],
  });
  assert.equal(canCollectDragons(noDestination, 'red'), null);

  const completed = state({
    freeCells: [
      { kind: 'dragons', family: 'red', cardIds: ['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4'] },
      { kind: 'empty' }, { kind: 'empty' },
    ],
  });
  assert.equal(canCollectDragons(completed, 'red'), null);
});

test('flower auto move wins deterministic priority when exposed', () => {
  const s = state({
    tableau: [['coins-1'], ['flower'], [], [], [], [], [], []],
  });
  assert.deepEqual(findNextAutoMove(s), {
    source: { zone: 'tableau', column: 1, index: 0 },
    target: { zone: 'flower-foundation' },
  });
});

test('flower in free cell auto-clears but buried flower does not', () => {
  const free = state({ freeCells: [{ kind: 'card', cardId: 'flower' }, { kind: 'empty' }, { kind: 'empty' }] });
  assert.deepEqual(findNextAutoMove(free), {
    source: { zone: 'free-cell', cell: 0 },
    target: { zone: 'flower-foundation' },
  });

  const buried = state({ tableau: [['flower', 'coins-5'], [], [], [], [], [], [], []] });
  assert.equal(findNextAutoMove(buried), null);
});

test('safe numeric auto moves require every foundation to reach rank minus one', () => {
  const rank1 = state({ tableau: [['coins-1'], [], [], [], [], [], [], []] });
  assert.equal(isSafeAutoFoundation('coins-1', rank1), true);

  const rank2Unsafe = state({
    tableau: [['coins-2'], [], [], [], [], [], [], []],
    foundations: { coins: ['coins-1'], bamboo: [], characters: [] },
  });
  assert.equal(isSafeAutoFoundation('coins-2', rank2Unsafe), false);

  const rank2Safe = state({
    tableau: [['coins-2'], [], [], [], [], [], [], []],
    foundations: { coins: ['coins-1'], bamboo: ['bamboo-1'], characters: ['characters-1'] },
  });
  assert.equal(isSafeAutoFoundation('coins-2', rank2Safe), true);

  const rank5Safe = state({
    tableau: [['coins-5'], [], [], [], [], [], [], []],
    foundations: {
      coins: ['coins-1', 'coins-2', 'coins-3', 'coins-4'],
      bamboo: ['bamboo-1', 'bamboo-2', 'bamboo-3', 'bamboo-4'],
      characters: ['characters-1', 'characters-2', 'characters-3', 'characters-4'],
    },
  });
  assert.equal(isSafeAutoFoundation('coins-5', rank5Safe), true);

  const rank5Unsafe = state({
    tableau: [['coins-5'], [], [], [], [], [], [], []],
    foundations: {
      coins: ['coins-1','coins-2','coins-3','coins-4'],
      bamboo: ['bamboo-1','bamboo-2','bamboo-3'],
      characters: ['characters-1','characters-2','characters-3','characters-4'],
    },
  });
  assert.equal(isSafeAutoFoundation('coins-5', rank5Unsafe), false);
});

test('numeric auto priority is lowest rank, then suit order, then source scan order', () => {
  const s = state({
    tableau: [['characters-1'], ['bamboo-1'], ['coins-1'], [], [], [], [], []],
  });
  assert.deepEqual(findNextAutoMove(s), {
    source: { zone: 'tableau', column: 2, index: 0 },
    target: { zone: 'foundation', suit: 'coins' },
  });
});

test('won requires flower, three rank-nine foundations, and all dragon families completed', () => {
  const won = state({
    foundations: {
      coins: Array.from({ length: 9 }, (_, i) => `coins-${i + 1}`),
      bamboo: Array.from({ length: 9 }, (_, i) => `bamboo-${i + 1}`),
      characters: Array.from({ length: 9 }, (_, i) => `characters-${i + 1}`),
    },
    flowerFoundation: 'flower',
    freeCells: [
      { kind: 'dragons', family: 'red', cardIds: ['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4'] },
      { kind: 'dragons', family: 'green', cardIds: ['dragon-green-1','dragon-green-2','dragon-green-3','dragon-green-4'] },
      { kind: 'dragons', family: 'white', cardIds: ['dragon-white-1','dragon-white-2','dragon-white-3','dragon-white-4'] },
    ],
  });
  assert.equal(isWon(won), true);
  assert.equal(isWon({ ...won, flowerFoundation: null }), false);
});
