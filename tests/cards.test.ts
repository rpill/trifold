import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, DRAGON_FAMILIES, NUMERIC_SUITS } from '../src/game/model/cards.ts';

test('canonical deck has 40 unique physical cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 40);
  assert.equal(new Set(deck.map((card) => card.id)).size, 40);
  assert.equal(deck.filter((card) => card.kind === 'number').length, 27);
  assert.equal(deck.filter((card) => card.kind === 'dragon').length, 12);
  assert.equal(deck.filter((card) => card.kind === 'flower').length, 1);
});

test('each numeric suit has ranks 1 through 9 exactly once', () => {
  const deck = createDeck();
  for (const suit of NUMERIC_SUITS) {
    const ranks = deck
      .flatMap((card) => card.kind === 'number' && card.suit === suit ? [card.rank] : [])
      .sort((a, b) => a - b);
    assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
});

test('each dragon family has four stable copies', () => {
  const deck = createDeck();
  for (const family of DRAGON_FAMILIES) {
    const copies = deck
      .flatMap((card) => card.kind === 'dragon' && card.family === family ? [card.copy] : [])
      .sort((a, b) => a - b);
    assert.deepEqual(copies, [1, 2, 3, 4]);
  }
});
