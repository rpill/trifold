import type { PlayerCommand, TransactionResult } from '../game/model/types.ts';
import { TUTORIAL_SCENARIO } from './TutorialScenario.ts';
import type { TutorialLesson } from './TutorialText.ts';

export interface TutorialControllerOptions {
  readonly onComplete?: () => void;
}

function commandEquals(left: PlayerCommand, right: PlayerCommand): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'collect-dragons' && right.type === 'collect-dragons') {
    return left.family === right.family;
  }
  if (left.type !== 'move' || right.type !== 'move') return false;
  const sourceEqual = left.source.zone === right.source.zone
    && (left.source.zone === 'tableau'
      ? right.source.zone === 'tableau'
        && left.source.column === right.source.column
        && left.source.index === right.source.index
      : right.source.zone === 'free-cell' && left.source.cell === right.source.cell);
  if (!sourceEqual) return false;
  if (left.target.zone !== right.target.zone) return false;
  switch (left.target.zone) {
    case 'tableau':
      return right.target.zone === 'tableau' && left.target.column === right.target.column;
    case 'free-cell':
      return right.target.zone === 'free-cell' && left.target.cell === right.target.cell;
    case 'foundation':
      return right.target.zone === 'foundation' && left.target.suit === right.target.suit;
  }
}

function hasFlowerAuto(result: TransactionResult): boolean {
  return result.operations.some((operation) => operation.reason === 'auto' && operation.to.zone === 'flower-foundation');
}

function hasFoundationAuto(result: TransactionResult): boolean {
  return result.operations.some((operation) => operation.reason === 'auto' && operation.to.zone === 'foundation');
}

function hasDragonCollection(result: TransactionResult, family: 'red' | 'green' | 'white'): boolean {
  return result.operations.some((operation) => operation.reason === 'dragon'
    && operation.to.zone === 'dragon-cell'
    && operation.to.family === family);
}

export class TutorialController {
  private guidedIndex = 0;
  private lessonState: TutorialLesson = 'sequence';
  private waitingUndoState = false;
  private completedCallbackSent = false;
  private readonly onComplete: () => void;

  constructor(options: TutorialControllerOptions = {}) {
    this.onComplete = options.onComplete ?? (() => undefined);
  }

  get lesson(): TutorialLesson {
    return this.lessonState;
  }

  get waitingForUndo(): boolean {
    return this.waitingUndoState;
  }

  get expectedCommand(): PlayerCommand | null {
    if (this.waitingUndoState || this.lessonState === 'free-play' || this.lessonState === 'complete') return null;
    return TUTORIAL_SCENARIO.guidedCommands[this.guidedIndex] ?? null;
  }

  canPerform(command: PlayerCommand): boolean {
    const expected = this.expectedCommand;
    if (!expected) return this.lessonState === 'free-play';
    return commandEquals(command, expected);
  }

  recordTransaction(command: PlayerCommand, result: TransactionResult): boolean {
    const expected = this.expectedCommand;
    if (!expected || !commandEquals(command, expected)) return false;

    const index = this.guidedIndex;
    if (index === TUTORIAL_SCENARIO.milestones.flowerAuto && !hasFlowerAuto(result)) return false;
    if (index === TUTORIAL_SCENARIO.milestones.foundationAuto && !hasFoundationAuto(result)) return false;
    if (index === TUTORIAL_SCENARIO.milestones.dragons) {
      if (command.type !== 'collect-dragons' || !hasDragonCollection(result, command.family)) return false;
    }

    this.guidedIndex += 1;
    if (index === TUTORIAL_SCENARIO.milestones.sequence) {
      this.lessonState = 'free-cell';
    } else if (index === TUTORIAL_SCENARIO.milestones.freeCell) {
      this.lessonState = 'flower-auto';
    } else if (index === TUTORIAL_SCENARIO.milestones.flowerAuto) {
      this.lessonState = 'foundation-auto';
    } else if (index === TUTORIAL_SCENARIO.milestones.foundationAuto) {
      this.lessonState = 'dragons';
    } else if (index === TUTORIAL_SCENARIO.milestones.dragons) {
      this.lessonState = 'undo';
    } else if (index === TUTORIAL_SCENARIO.milestones.undoMove) {
      this.lessonState = 'undo';
      this.waitingUndoState = true;
    }
    return true;
  }

  recordUndo(): boolean {
    if (!this.waitingUndoState || this.lessonState !== 'undo') return false;
    this.waitingUndoState = false;
    this.lessonState = 'free-play';
    return true;
  }

  recordWin(): boolean {
    if (this.lessonState !== 'free-play' || this.completedCallbackSent) return false;
    this.lessonState = 'complete';
    this.completedCallbackSent = true;
    this.onComplete();
    return true;
  }
}
