import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { findWinningProof } from '../src/game/hints/HintSearch.ts';

function solvedFromSeed(seed: number, maxNodes = 300_000) {
  const game = new TrifoldGame(createDeal(seed));
  game.settleInitialAutoMoves();
  const snapshot = game.snapshot();
  const result = findWinningProof(snapshot, { maxNodes });
  assert.equal(result.status, 'SOLVED', `seed ${seed} should solve, got ${result.status}`);
  if (result.status !== 'SOLVED') throw new Error('unreachable');
  const replay = TrifoldGame.restore({ version: 1, seed, snapshot, history: { version: 1, entries: [] } });
  for (const command of result.proof) {
    const step = replay.perform(command);
    assert.ok(step, `seed ${seed} runtime solver emitted illegal command`);
  }
  assert.equal(result.proof.length > 0, true);
  assert.equal(replay.state.foundations.coins.length, 9);
  assert.equal(replay.state.foundations.bamboo.length, 9);
  assert.equal(replay.state.foundations.characters.length, 9);
  assert.equal(replay.state.flowerFoundation, 'flower');
  return { snapshot, result };
}

test('runtime hint search solves frozen verified seeds through production rules', () => {
  for (const seed of [1, 2, 3]) solvedFromSeed(seed);
});

test('runtime hint search solves a mid-game snapshot', () => {
  const initial = solvedFromSeed(1);
  const game = TrifoldGame.restore({ version: 1, seed: 1, snapshot: initial.snapshot, history: { version: 1, entries: [] } });
  for (const command of initial.result.proof.slice(0, 5)) {
    assert.ok(game.perform(command));
  }
  const result = findWinningProof(game.snapshot(), { maxNodes: 300_000 });
  assert.equal(result.status, 'SOLVED');
});

test('runtime hint search respects a tiny node budget', () => {
  const game = new TrifoldGame(createDeal(1));
  game.settleInitialAutoMoves();
  const result = findWinningProof(game.snapshot(), { maxNodes: 1 });
  assert.equal(result.status, 'UNDETERMINED');
  assert.equal(result.nodes, 1);
});
