import { GameHistory } from './GameHistory.ts';
import {
  canCollectDragons,
  canDropInFreeCell,
  canDropOnTableau,
  canMoveToFoundation,
  cardsFromSource,
  findNextAutoMove,
  isWon,
} from './TrifoldRules.ts';
import type {
  AutoMove,
  CardId,
  CardLocation,
  CardOperation,
  CardSource,
  CardTarget,
  DragonFamily,
  FreeCellState,
  NumericSuit,
  PlayerCommand,
  ReadonlyTrifoldState,
  TransactionResult,
  TrifoldDeal,
  TrifoldSnapshot,
} from './types.ts';

interface MutableState {
  tableau: CardId[][];
  freeCells: FreeCellState[];
  foundations: Record<NumericSuit, CardId[]>;
  flowerFoundation: CardId | null;
}

function sourceLocation(source: CardSource, offset = 0): CardLocation {
  return source.zone === 'tableau'
    ? { zone: 'tableau', column: source.column, index: source.index + offset }
    : { zone: 'free-cell', cell: source.cell };
}

export class TrifoldGame {
  private readonly seed: number;
  private readonly history = new GameHistory();
  private stateData: MutableState;

  constructor(deal: TrifoldDeal) {
    this.seed = deal.seed;
    this.stateData = {
      tableau: deal.tableau.map((column) => [...column]),
      freeCells: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }],
      foundations: { coins: [], bamboo: [], characters: [] },
      flowerFoundation: null,
    };
  }

  get state(): ReadonlyTrifoldState {
    const snapshot = this.snapshot();
    return {
      tableau: snapshot.tableau,
      freeCells: snapshot.freeCells,
      foundations: snapshot.foundations,
      flowerFoundation: snapshot.flowerFoundation,
    };
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  snapshot(): TrifoldSnapshot {
    return {
      seed: this.seed,
      tableau: this.stateData.tableau.map((column) => [...column]),
      freeCells: this.stateData.freeCells.map((cell) => cell.kind === 'dragons'
        ? { ...cell, cardIds: [...cell.cardIds] }
        : { ...cell }),
      foundations: {
        coins: [...this.stateData.foundations.coins],
        bamboo: [...this.stateData.foundations.bamboo],
        characters: [...this.stateData.foundations.characters],
      },
      flowerFoundation: this.stateData.flowerFoundation,
    };
  }

  perform(command: PlayerCommand): TransactionResult | null {
    const before = this.snapshot();
    let operations: CardOperation[] | null;

    if (command.type === 'move') {
      operations = this.applyPlayerMove(command.source, command.target);
    } else {
      operations = this.applyDragonCollection(command.family);
    }
    if (operations === null) return null;

    operations.push(...this.resolveAutomaticMoves());
    this.history.push({ before, forwardOperations: operations });
    return { operations, won: isWon(this.state) };
  }

  settleInitialAutoMoves(): TransactionResult {
    const operations = this.resolveAutomaticMoves();
    return { operations, won: isWon(this.state) };
  }

  undo(): TransactionResult | null {
    const entry = this.history.pop();
    if (!entry) return null;
    this.restore(entry.before);
    const operations = [...entry.forwardOperations].reverse().map((operation): CardOperation => ({
      ...operation,
      from: { ...operation.to },
      to: { ...operation.from },
    }));
    return { operations, won: isWon(this.state) };
  }

  private applyPlayerMove(source: CardSource, target: CardTarget): CardOperation[] | null {
    const state = this.state;
    const legal = target.zone === 'tableau'
      ? canDropOnTableau(state, source, target.column)
      : target.zone === 'free-cell'
        ? canDropInFreeCell(state, source, target.cell)
        : canMoveToFoundation(state, source, target.suit);
    if (!legal) return null;

    const cardIds = [...cardsFromSource(state, source)];
    const fromLocations = cardIds.map((_, index) => sourceLocation(source, index));
    this.removeUnit(source);
    const toLocations = this.appendUnit(target, cardIds);
    return cardIds.map((cardId, index) => ({
      type: 'move-card',
      cardId,
      from: fromLocations[index],
      to: toLocations[index],
      reason: 'player',
    }));
  }

  private removeUnit(source: CardSource): CardId[] {
    if (source.zone === 'tableau') {
      const column = this.stateData.tableau[source.column];
      if (!column) throw new Error('Invalid tableau source.');
      return column.splice(source.index);
    }
    const cell = this.stateData.freeCells[source.cell];
    if (!cell || cell.kind !== 'card') throw new Error('Invalid free-cell source.');
    this.stateData.freeCells[source.cell] = { kind: 'empty' };
    return [cell.cardId];
  }

  private appendUnit(target: CardTarget, cardIds: readonly CardId[]): CardLocation[] {
    if (target.zone === 'tableau') {
      const column = this.stateData.tableau[target.column];
      if (!column) throw new Error('Invalid tableau target.');
      const start = column.length;
      column.push(...cardIds);
      return cardIds.map((_, index) => ({ zone: 'tableau', column: target.column, index: start + index }));
    }
    if (target.zone === 'free-cell') {
      if (cardIds.length !== 1) throw new Error('Free cells accept one card.');
      this.stateData.freeCells[target.cell] = { kind: 'card', cardId: cardIds[0] };
      return [{ zone: 'free-cell', cell: target.cell }];
    }
    if (cardIds.length !== 1) throw new Error('Foundation accepts one card.');
    const foundation = this.stateData.foundations[target.suit];
    const index = foundation.length;
    foundation.push(cardIds[0]);
    return [{ zone: 'foundation', suit: target.suit, index }];
  }

  private resolveAutomaticMoves(): CardOperation[] {
    const operations: CardOperation[] = [];
    for (let step = 0; step < 40; step += 1) {
      const move = findNextAutoMove(this.state);
      if (move === null) return operations;
      operations.push(this.applyAutoMove(move));
    }
    throw new Error('Automatic move wave exceeded 40 operations.');
  }

  private applyAutoMove(move: AutoMove): CardOperation {
    const cardIds = this.removeUnit(move.source);
    if (cardIds.length !== 1) throw new Error('Automatic moves must contain one card.');
    const cardId = cardIds[0];
    const from = sourceLocation(move.source);
    let to: CardLocation;
    if (move.target.zone === 'flower-foundation') {
      if (cardId !== 'flower') throw new Error('Only flower can enter flower foundation.');
      this.stateData.flowerFoundation = cardId;
      to = { zone: 'flower-foundation' };
    } else {
      const foundation = this.stateData.foundations[move.target.suit];
      const index = foundation.length;
      foundation.push(cardId);
      to = { zone: 'foundation', suit: move.target.suit, index };
    }
    return { type: 'move-card', cardId, from, to, reason: 'auto' };
  }

  private applyDragonCollection(family: DragonFamily): CardOperation[] | null {
    const collection = canCollectDragons(this.state, family);
    if (!collection) return null;

    const captured = collection.sources.map((source) => {
      const ids = cardsFromSource(this.state, source);
      if (ids.length !== 1) throw new Error('Dragon source must expose one card.');
      return { source, cardId: ids[0], from: sourceLocation(source) };
    });

    const tableauSources = collection.sources
      .filter((source): source is Extract<CardSource, { zone: 'tableau' }> => source.zone === 'tableau')
      .sort((a, b) => b.column - a.column || b.index - a.index);
    for (const source of tableauSources) this.removeUnit(source);
    for (const source of collection.sources) {
      if (source.zone === 'free-cell') this.removeUnit(source);
    }

    const cardIds = captured.map(({ cardId }) => cardId);
    this.stateData.freeCells[collection.destinationCell] = { kind: 'dragons', family, cardIds };
    const to: CardLocation = { zone: 'dragon-cell', cell: collection.destinationCell, family };
    return captured.map(({ cardId, from }) => ({ type: 'move-card', cardId, from, to, reason: 'dragon' }));
  }

  private restore(snapshot: TrifoldSnapshot): void {
    this.stateData = {
      tableau: snapshot.tableau.map((column) => [...column]),
      freeCells: snapshot.freeCells.map((cell) => cell.kind === 'dragons'
        ? { ...cell, cardIds: [...cell.cardIds] }
        : { ...cell }),
      foundations: {
        coins: [...snapshot.foundations.coins],
        bamboo: [...snapshot.foundations.bamboo],
        characters: [...snapshot.foundations.characters],
      },
      flowerFoundation: snapshot.flowerFoundation,
    };
  }
}
