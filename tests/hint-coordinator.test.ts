import test from 'node:test';
import assert from 'node:assert/strict';
import { HintCoordinator } from '../src/meta/hints/HintCoordinator.ts';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import type { HintSearchResult } from '../src/game/hints/HintSearch.ts';

function makeSession(seed = 1) {
  const game = new TrifoldGame(createDeal(seed));
  game.settleInitialAutoMoves();
  let assisted = false;
  return {
    game,
    session: {
      snapshot: () => game.snapshot(),
      markAssisted: () => { assisted = true; },
    },
    assisted: () => assisted,
  };
}

function fakeSolver(result: HintSearchResult) {
  let calls = 0;
  return {
    solve: async () => { calls += 1; return result; },
    calls: () => calls,
  };
}

function legalMove(current: ReturnType<typeof makeSession>) {
  const state = current.game.state;
  const column = state.tableau.findIndex((cards) => cards.length > 0);
  return {
    type: 'move',
    source: { zone: 'tableau', column, index: state.tableau[column].length - 1 },
    target: { zone: 'free-cell', cell: 0 },
  } as const;
}

test('unavailable proof disables hints for the unchanged board state', async () => {
  const current = makeSession();
  const coordinator = new HintCoordinator(current.session, fakeSolver({ status: 'UNDETERMINED', nodes: 10 }));

  assert.equal(coordinator.isUnavailableForCurrentState(), false);
  assert.deepEqual(await coordinator.prepare(), { status: 'unavailable' });
  assert.equal(coordinator.isUnavailableForCurrentState(), true);
  assert.equal(current.assisted(), false);
});

test('changing the board re-enables hint requests after an unavailable result', async () => {
  const current = makeSession();
  const command = legalMove(current);
  const coordinator = new HintCoordinator(current.session, fakeSolver({ status: 'UNDETERMINED', nodes: 10 }));

  assert.deepEqual(await coordinator.prepare(), { status: 'unavailable' });
  assert.equal(coordinator.isUnavailableForCurrentState(), true);
  assert.ok(current.game.perform(command));
  assert.equal(coordinator.isUnavailableForCurrentState(), false);
});

test('free reveal marks Standard attempt assisted and returns first winning command without ads', async () => {
  const current = makeSession();
  const command = legalMove(current);
  const coordinator = new HintCoordinator(current.session, fakeSolver({ status: 'SOLVED', nodes: 1, proof: [command] }));

  assert.equal((await coordinator.prepare()).status, 'ready');
  assert.deepEqual(await coordinator.revealPreparedHint(), command);
  assert.equal(current.assisted(), true);
  assert.equal(coordinator.isUnavailableForCurrentState(), false);
});

test('prepared hint is invalidated if board changes before free reveal', async () => {
  const current = makeSession();
  const command = legalMove(current);
  const coordinator = new HintCoordinator(current.session, fakeSolver({ status: 'SOLVED', nodes: 1, proof: [command] }));

  assert.equal((await coordinator.prepare()).status, 'ready');
  assert.ok(current.game.perform(command));
  assert.equal(await coordinator.revealPreparedHint(), null);
  assert.equal(current.assisted(), false);
});
