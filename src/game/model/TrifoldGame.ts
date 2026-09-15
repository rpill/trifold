import { GameHistory, type GameHistorySaveV1, type HistoryEntry } from './GameHistory.ts';
import { createDeck } from './cards.ts';
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


export interface TrifoldGameSaveV1 {
  readonly version: 1;
  readonly seed: number;
  readonly snapshot: TrifoldSnapshot;
  readonly history: GameHistorySaveV1;
}

const CANONICAL_CARD_IDS = new Set(createDeck().map((card) => card.id));
const NUMERIC_SUITS: readonly NumericSuit[] = ['coins', 'bamboo', 'characters'];
const DRAGON_FAMILIES: readonly DragonFamily[] = ['red', 'green', 'white'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}.`);
  }
  return Number(value);
}

function cardId(value: unknown, label: string): CardId {
  if (typeof value !== 'string' || !CANONICAL_CARD_IDS.has(value)) {
    throw new Error(`${label} is not a canonical Trifold card id.`);
  }
  return value;
}

function cardIdArray(value: unknown, label: string): CardId[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => cardId(item, `${label}[${index}]`));
}

function parseLocation(value: unknown, label: string): CardLocation {
  if (!isRecord(value) || typeof value.zone !== 'string') throw new Error(`${label} is invalid.`);
  switch (value.zone) {
    case 'tableau':
      return { zone: 'tableau', column: integer(value.column, `${label}.column`), index: integer(value.index, `${label}.index`) };
    case 'free-cell':
      return { zone: 'free-cell', cell: integer(value.cell, `${label}.cell`) };
    case 'foundation': {
      if (!NUMERIC_SUITS.includes(value.suit as NumericSuit)) throw new Error(`${label}.suit is invalid.`);
      return { zone: 'foundation', suit: value.suit as NumericSuit, index: integer(value.index, `${label}.index`) };
    }
    case 'flower-foundation':
      return { zone: 'flower-foundation' };
    case 'dragon-cell': {
      if (!DRAGON_FAMILIES.includes(value.family as DragonFamily)) throw new Error(`${label}.family is invalid.`);
      return { zone: 'dragon-cell', cell: integer(value.cell, `${label}.cell`), family: value.family as DragonFamily };
    }
    default:
      throw new Error(`${label}.zone is invalid.`);
  }
}

function parseOperation(value: unknown, label: string): CardOperation {
  if (!isRecord(value) || value.type !== 'move-card') throw new Error(`${label} is invalid.`);
  if (value.reason !== 'player' && value.reason !== 'auto' && value.reason !== 'dragon') {
    throw new Error(`${label}.reason is invalid.`);
  }
  return {
    type: 'move-card',
    cardId: cardId(value.cardId, `${label}.cardId`),
    from: parseLocation(value.from, `${label}.from`),
    to: parseLocation(value.to, `${label}.to`),
    reason: value.reason,
  };
}

function parseSnapshot(value: unknown, expectedSeed: number, label = 'snapshot'): TrifoldSnapshot {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const seed = integer(value.seed, `${label}.seed`, 1);
  if (seed !== expectedSeed) throw new Error(`${label} seed does not match game save seed.`);

  if (!Array.isArray(value.tableau) || value.tableau.length !== 8) {
    throw new Error(`${label}.tableau must contain 8 columns.`);
  }
  const tableau = value.tableau.map((column, index) => cardIdArray(column, `${label}.tableau[${index}]`));

  if (!Array.isArray(value.freeCells) || value.freeCells.length !== 3) {
    throw new Error(`${label}.freeCells must contain 3 cells.`);
  }
  const freeCells = value.freeCells.map((cell, index): FreeCellState => {
    if (!isRecord(cell) || typeof cell.kind !== 'string') throw new Error(`${label}.freeCells[${index}] is invalid.`);
    if (cell.kind === 'empty') return { kind: 'empty' };
    if (cell.kind === 'card') return { kind: 'card', cardId: cardId(cell.cardId, `${label}.freeCells[${index}].cardId`) };
    if (cell.kind === 'dragons') {
      if (!DRAGON_FAMILIES.includes(cell.family as DragonFamily)) {
        throw new Error(`${label}.freeCells[${index}] dragon family is invalid.`);
      }
      const family = cell.family as DragonFamily;
      const cardIds = cardIdArray(cell.cardIds, `${label}.freeCells[${index}].cardIds`);
      if (cardIds.length !== 4) throw new Error(`${label}.freeCells[${index}] dragon group must contain 4 cards.`);
      for (const id of cardIds) {
        if (!id.startsWith(`dragon-${family}-`)) {
          throw new Error(`${label}.freeCells[${index}] dragon group contains the wrong family.`);
        }
      }
      return { kind: 'dragons', family, cardIds };
    }
    throw new Error(`${label}.freeCells[${index}].kind is invalid.`);
  });

  if (!isRecord(value.foundations)) throw new Error(`${label}.foundations must be an object.`);
  const foundations = {
    coins: cardIdArray(value.foundations.coins, `${label}.foundations.coins`),
    bamboo: cardIdArray(value.foundations.bamboo, `${label}.foundations.bamboo`),
    characters: cardIdArray(value.foundations.characters, `${label}.foundations.characters`),
  } satisfies Record<NumericSuit, CardId[]>;
  for (const suit of NUMERIC_SUITS) {
    foundations[suit].forEach((id, index) => {
      if (id !== `${suit}-${index + 1}`) {
        throw new Error(`${label}.foundations.${suit} must be an ordered numeric prefix.`);
      }
    });
  }

  const flowerFoundation = value.flowerFoundation === null
    ? null
    : cardId(value.flowerFoundation, `${label}.flowerFoundation`);
  if (flowerFoundation !== null && flowerFoundation !== 'flower') {
    throw new Error(`${label}.flowerFoundation may contain only flower.`);
  }

  const allIds: CardId[] = [...tableau.flat()];
  for (const cell of freeCells) {
    if (cell.kind === 'card') allIds.push(cell.cardId);
    if (cell.kind === 'dragons') allIds.push(...cell.cardIds);
  }
  for (const suit of NUMERIC_SUITS) allIds.push(...foundations[suit]);
  if (flowerFoundation) allIds.push(flowerFoundation);

  if (allIds.length !== CANONICAL_CARD_IDS.size || new Set(allIds).size !== CANONICAL_CARD_IDS.size) {
    throw new Error(`${label} must contain exactly 40 unique Trifold cards; duplicate or missing card detected.`);
  }
  for (const id of CANONICAL_CARD_IDS) {
    if (!allIds.includes(id)) throw new Error(`${label} is missing canonical card ${id}.`);
  }

  return { seed, tableau, freeCells, foundations, flowerFoundation };
}

function parseHistory(value: unknown, expectedSeed: number): GameHistorySaveV1 {
  if (!isRecord(value) || value.version !== 1) throw new Error('Unsupported game history save version.');
  if (!Array.isArray(value.entries)) throw new Error('Game history entries must be an array.');
  const entries: HistoryEntry[] = value.entries.map((entry, entryIndex) => {
    if (!isRecord(entry)) throw new Error(`history.entries[${entryIndex}] is invalid.`);
    if (!Array.isArray(entry.forwardOperations)) throw new Error(`history.entries[${entryIndex}].forwardOperations must be an array.`);
    return {
      before: parseSnapshot(entry.before, expectedSeed, `history.entries[${entryIndex}].before`),
      forwardOperations: entry.forwardOperations.map((operation, operationIndex) => parseOperation(
        operation,
        `history.entries[${entryIndex}].forwardOperations[${operationIndex}]`,
      )),
    };
  });
  return { version: 1, entries };
}

export function parseTrifoldGameSave(value: unknown): TrifoldGameSaveV1 {
  if (!isRecord(value) || value.version !== 1) throw new Error('Unsupported Trifold game save version.');
  const seed = integer(value.seed, 'game save seed', 1);
  return {
    version: 1,
    seed,
    snapshot: parseSnapshot(value.snapshot, seed),
    history: parseHistory(value.history, seed),
  };
}

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

  exportSave(): TrifoldGameSaveV1 {
    return {
      version: 1,
      seed: this.seed,
      snapshot: this.snapshot(),
      history: this.history.exportSave(),
    };
  }

  static restore(rawSave: unknown): TrifoldGame {
    const save = parseTrifoldGameSave(rawSave);
    const game = new TrifoldGame({
      seed: save.seed,
      dealFormatVersion: 1,
      shuffleVersion: 1,
      tableau: save.snapshot.tableau,
    });
    game.restoreSnapshot(save.snapshot);
    game.history.restore(save.history);
    return game;
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
    this.restoreSnapshot(entry.before);
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

  private restoreSnapshot(snapshot: TrifoldSnapshot): void {
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
