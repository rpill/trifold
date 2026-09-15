import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { findWinningProof } from '../src/game/hints/HintSearch.ts';
import { TUTORIAL_SCENARIO } from '../src/tutorial/TutorialScenario.ts';

function hasAuto(result: NonNullable<ReturnType<TrifoldGame['perform']>>, zone: 'foundation' | 'flower-foundation'): boolean {
  return result.operations.some((operation) => operation.reason === 'auto' && operation.to.zone === zone);
}

test('frozen tutorial scenario demonstrates required mechanics and remains solver-winnable', () => {
  const game = new TrifoldGame(createDeal(TUTORIAL_SCENARIO.seed));
  game.settleInitialAutoMoves();
  for (const command of TUTORIAL_SCENARIO.bootstrapCommands) assert.ok(game.perform(command));

  const m = TUTORIAL_SCENARIO.milestones;
  TUTORIAL_SCENARIO.guidedCommands.forEach((command, index) => {
    const before = game.state;
    if (index === m.sequence) {
      assert.equal(command.type, 'move');
      if (command.type === 'move' && command.source.zone === 'tableau') {
        assert.ok(command.source.index < before.tableau[command.source.column].length - 1, 'sequence lesson must move a run');
      }
    }
    if (index === m.freeCell) assert.equal(command.type === 'move' && command.target.zone === 'free-cell', true);
    const result = game.perform(command);
    assert.ok(result, `tutorial command ${index} must be legal`);
    if (!result) return;
    if (index === m.flowerAuto) assert.equal(hasAuto(result, 'flower-foundation'), true);
    if (index === m.foundationAuto) assert.equal(hasAuto(result, 'foundation'), true);
    if (index === m.dragons) assert.equal(command.type, 'collect-dragons');
  });

  const undone = game.undo();
  assert.ok(undone, 'Undo lesson must be reversible');
  const remaining = findWinningProof(game.snapshot(), { maxNodes: 250_000 });
  assert.equal(remaining.status, 'SOLVED');
});
