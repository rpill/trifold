import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_SCENARIO } from '../src/tutorial/TutorialScenario.ts';
import { TutorialController } from '../src/tutorial/TutorialController.ts';
import { tutorialText } from '../src/tutorial/TutorialText.ts';
import type { CardOperation, TransactionResult } from '../src/game/model/types.ts';

function resultWith(...operations: CardOperation[]): TransactionResult {
  return { operations, won: false };
}

function playerMove(cardId = 'coins-9'): CardOperation {
  return {
    type: 'move-card',
    cardId,
    from: { zone: 'tableau', column: 0, index: 0 },
    to: { zone: 'tableau', column: 1, index: 0 },
    reason: 'player',
  };
}

function autoFlower(): CardOperation {
  return {
    type: 'move-card',
    cardId: 'flower',
    from: { zone: 'tableau', column: 0, index: 0 },
    to: { zone: 'flower-foundation' },
    reason: 'auto',
  };
}

function autoFoundation(): CardOperation {
  return {
    type: 'move-card',
    cardId: 'coins-1',
    from: { zone: 'tableau', column: 0, index: 0 },
    to: { zone: 'foundation', suit: 'coins', index: 0 },
    reason: 'auto',
  };
}

function dragonMove(): CardOperation {
  return {
    type: 'move-card',
    cardId: 'dragon-red-1',
    from: { zone: 'tableau', column: 0, index: 0 },
    to: { zone: 'dragon-cell', cell: 0, family: 'red' },
    reason: 'dragon',
  };
}

test('wrong command is rejected and does not advance the guided tutorial', () => {
  const controller = new TutorialController();
  const expected = TUTORIAL_SCENARIO.guidedCommands[0]!;
  const wrong = TUTORIAL_SCENARIO.guidedCommands[1]!;

  assert.equal(controller.lesson, 'sequence');
  assert.deepEqual(controller.expectedCommand, expected);
  assert.equal(controller.canPerform(wrong), false);
  assert.equal(controller.recordTransaction(wrong, resultWith(playerMove())), false);
  assert.equal(controller.lesson, 'sequence');
  assert.deepEqual(controller.expectedCommand, expected);
});

test('expected commands advance once and flower/foundation require matching auto checkpoints', () => {
  const controller = new TutorialController();

  const sequence = TUTORIAL_SCENARIO.guidedCommands[0]!;
  assert.equal(controller.canPerform(sequence), true);
  assert.equal(controller.recordTransaction(sequence, resultWith(playerMove())), true);
  assert.equal(controller.lesson, 'free-cell');
  assert.equal(controller.recordTransaction(sequence, resultWith(playerMove())), false);

  const freeCell = TUTORIAL_SCENARIO.guidedCommands[1]!;
  assert.equal(controller.recordTransaction(freeCell, resultWith(playerMove())), true);
  assert.equal(controller.lesson, 'flower-auto');

  for (let index = 2; index < TUTORIAL_SCENARIO.milestones.flowerAuto; index += 1) {
    const command = TUTORIAL_SCENARIO.guidedCommands[index]!;
    assert.equal(controller.recordTransaction(command, resultWith(playerMove())), true);
    assert.equal(controller.lesson, 'flower-auto');
  }

  const flowerCommand = TUTORIAL_SCENARIO.guidedCommands[TUTORIAL_SCENARIO.milestones.flowerAuto]!;
  assert.equal(controller.recordTransaction(flowerCommand, resultWith(playerMove())), false);
  assert.equal(controller.lesson, 'flower-auto');
  assert.deepEqual(controller.expectedCommand, flowerCommand);
  assert.equal(controller.recordTransaction(flowerCommand, resultWith(playerMove(), autoFlower())), true);
  assert.equal(controller.lesson, 'foundation-auto');

  const foundationCommand = TUTORIAL_SCENARIO.guidedCommands[TUTORIAL_SCENARIO.milestones.foundationAuto]!;
  assert.equal(controller.recordTransaction(foundationCommand, resultWith(playerMove())), false);
  assert.equal(controller.lesson, 'foundation-auto');
  assert.equal(controller.recordTransaction(foundationCommand, resultWith(playerMove(), autoFoundation())), true);
  assert.equal(controller.lesson, 'dragons');
});

test('dragon lesson accepts only the expected family transaction and Undo waits for actual undo', () => {
  const controller = new TutorialController();

  // Advance through foundation checkpoint.
  for (let index = 0; index <= TUTORIAL_SCENARIO.milestones.foundationAuto; index += 1) {
    const command = TUTORIAL_SCENARIO.guidedCommands[index]!;
    const operations = [playerMove()];
    if (index === TUTORIAL_SCENARIO.milestones.flowerAuto) operations.push(autoFlower());
    if (index === TUTORIAL_SCENARIO.milestones.foundationAuto) operations.push(autoFoundation());
    assert.equal(controller.recordTransaction(command, resultWith(...operations)), true);
  }

  assert.equal(controller.lesson, 'dragons');
  const dragonCommand = TUTORIAL_SCENARIO.guidedCommands[TUTORIAL_SCENARIO.milestones.dragons]!;
  assert.equal(controller.recordTransaction(dragonCommand, resultWith(playerMove())), false);
  assert.equal(controller.recordTransaction(dragonCommand, resultWith(dragonMove())), true);
  assert.equal(controller.lesson, 'undo');

  const undoMove = TUTORIAL_SCENARIO.guidedCommands[TUTORIAL_SCENARIO.milestones.undoMove]!;
  assert.equal(controller.recordTransaction(undoMove, resultWith(playerMove())), true);
  assert.equal(controller.lesson, 'undo');
  assert.equal(controller.waitingForUndo, true);
  assert.equal(controller.expectedCommand, null);

  assert.equal(controller.recordUndo(), true);
  assert.equal(controller.lesson, 'free-play');
  assert.equal(controller.recordUndo(), false);
});

test('tutorial completion callback runs exactly once after free play win', () => {
  let completions = 0;
  const controller = new TutorialController({ onComplete: () => { completions += 1; } });

  for (let index = 0; index < TUTORIAL_SCENARIO.guidedCommands.length; index += 1) {
    const command = TUTORIAL_SCENARIO.guidedCommands[index]!;
    const operations = [playerMove()];
    if (index === TUTORIAL_SCENARIO.milestones.flowerAuto) operations.push(autoFlower());
    if (index === TUTORIAL_SCENARIO.milestones.foundationAuto) operations.push(autoFoundation());
    if (index === TUTORIAL_SCENARIO.milestones.dragons) operations.splice(0, operations.length, dragonMove());
    assert.equal(controller.recordTransaction(command, resultWith(...operations)), true);
  }
  assert.equal(controller.recordUndo(), true);
  assert.equal(controller.lesson, 'free-play');

  assert.equal(controller.recordWin(), true);
  assert.equal(controller.lesson, 'complete');
  assert.equal(completions, 1);
  assert.equal(controller.recordWin(), false);
  assert.equal(completions, 1);
});

test('tutorial overlay copy is concise and distinguishes the Undo press from the setup move', () => {
  assert.match(tutorialText('sequence'), /черед/i);
  assert.match(tutorialText('free-cell'), /ячейк/i);
  assert.match(tutorialText('flower-auto'), /цвет/i);
  assert.match(tutorialText('foundation-auto'), /основан/i);
  assert.match(tutorialText('dragons'), /дракон/i);
  assert.match(tutorialText('undo', false), /ход/i);
  assert.match(tutorialText('undo', true), /отмен/i);
  assert.match(tutorialText('free-play'), /самостоятель/i);
});


test('tutorial copy supports English', () => {
  assert.match(tutorialText('sequence', false, 'en'), /descending sequence/i);
  assert.match(tutorialText('undo', true, 'en'), /Undo/i);
  assert.match(tutorialText('complete', false, 'en'), /complete/i);
});
