import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeal, getInitialDealSequence } from '../src/game/model/deal.ts';

test('same uint32 seed produces the same 8x5 deal', () => {
  const a = createDeal(1);
  const b = createDeal(1);
  const c = createDeal(2);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.tableau, c.tableau);
  assert.equal(a.tableau.length, 8);
  assert.deepEqual(a.tableau.map((column) => column.length), Array(8).fill(5));
  assert.equal(new Set(a.tableau.flat()).size, 40);
});

test('initial deal sequence is row-major across eight columns', () => {
  const deal = createDeal(1);
  const sequence = getInitialDealSequence(deal);
  assert.equal(sequence.length, 40);
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      assert.equal(sequence[row * 8 + column], deal.tableau[column][row]);
    }
  }
});

test('seed 0x12345678 has frozen shuffle ordering', () => {
  const deal = createDeal(0x12345678);
  assert.deepEqual(getInitialDealSequence(deal), [
    'dragon-green-2', 'coins-4', 'dragon-white-4', 'characters-5',
    'dragon-green-3', 'bamboo-3', 'bamboo-5', 'bamboo-4',
    'bamboo-1', 'characters-8', 'bamboo-2', 'dragon-red-1',
    'dragon-red-2', 'characters-7', 'dragon-red-3', 'coins-7',
    'dragon-red-4', 'coins-1', 'characters-6', 'bamboo-7',
    'coins-2', 'characters-2', 'bamboo-9', 'characters-1',
    'coins-3', 'coins-5', 'dragon-green-1', 'dragon-white-1',
    'characters-9', 'characters-3', 'coins-9', 'dragon-green-4',
    'dragon-white-2', 'coins-6', 'coins-8', 'flower',
    'characters-4', 'bamboo-8', 'bamboo-6', 'dragon-white-3',
  ]);
});

test('invalid deal seeds are rejected', () => {
  for (const seed of [0, -1, 0x1_0000_0000, 1.5, Number.NaN]) {
    assert.throws(() => createDeal(seed), RangeError);
  }
});
