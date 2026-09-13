import { createDeck, DRAGON_FAMILIES, NUMERIC_SUITS } from './cards.ts';
import type {
  AutoMove,
  CardId,
  CardSource,
  DragonCollection,
  DragonFamily,
  NumericSuit,
  ReadonlyTrifoldState,
  TrifoldCard,
} from './types.ts';

const CARD_BY_ID = new Map<CardId, TrifoldCard>(createDeck().map((card) => [card.id, card]));

export function getCard(cardId: CardId): TrifoldCard {
  const card = CARD_BY_ID.get(cardId);
  if (!card) throw new Error(`Unknown Trifold card: ${cardId}`);
  return card;
}

function validIndex(value: number, length: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < length;
}

export function cardsFromSource(state: ReadonlyTrifoldState, source: CardSource): readonly CardId[] {
  if (source.zone === 'tableau') {
    const column = state.tableau[source.column];
    if (!column || !validIndex(source.index, column.length)) return [];
    return column.slice(source.index);
  }

  const cell = state.freeCells[source.cell];
  if (!cell || cell.kind !== 'card') return [];
  return [cell.cardId];
}

function isValidNumericRun(cardIds: readonly CardId[]): boolean {
  if (cardIds.length === 0) return false;
  const cards = cardIds.map(getCard);
  if (cards.some((card) => card.kind !== 'number')) return false;
  for (let index = 0; index < cards.length - 1; index += 1) {
    const lower = cards[index];
    const upper = cards[index + 1];
    if (lower.kind !== 'number' || upper.kind !== 'number') return false;
    if (upper.rank !== lower.rank - 1 || upper.suit === lower.suit) return false;
  }
  return true;
}

export function canPickUp(state: ReadonlyTrifoldState, source: CardSource): boolean {
  const cardIds = cardsFromSource(state, source);
  if (cardIds.length === 0) return false;
  if (source.zone === 'free-cell') return cardIds.length === 1;

  const column = state.tableau[source.column];
  if (!column) return false;
  if (cardIds.length === 1) return source.index === column.length - 1;
  return isValidNumericRun(cardIds);
}

export function canDropOnTableau(
  state: ReadonlyTrifoldState,
  source: CardSource,
  targetColumn: number,
): boolean {
  if (!canPickUp(state, source)) return false;
  const moving = cardsFromSource(state, source);
  if (moving.length === 0) return false;
  const target = state.tableau[targetColumn];
  if (!target) return false;
  if (source.zone === 'tableau' && source.column === targetColumn) return false;

  if (target.length === 0) return moving.length === 1 || isValidNumericRun(moving);

  const root = getCard(moving[0]);
  const targetCard = getCard(target[target.length - 1]);
  if (root.kind !== 'number' || targetCard.kind !== 'number') return false;
  return root.rank === targetCard.rank - 1 && root.suit !== targetCard.suit;
}

export function canDropInFreeCell(
  state: ReadonlyTrifoldState,
  source: CardSource,
  targetCell: number,
): boolean {
  if (!canPickUp(state, source)) return false;
  const moving = cardsFromSource(state, source);
  const cell = state.freeCells[targetCell];
  return moving.length === 1 && cell?.kind === 'empty';
}

export function canMoveToFoundation(
  state: ReadonlyTrifoldState,
  source: CardSource,
  suit: NumericSuit,
): boolean {
  if (!canPickUp(state, source)) return false;
  const moving = cardsFromSource(state, source);
  if (moving.length !== 1) return false;
  const card = getCard(moving[0]);
  if (card.kind !== 'number' || card.suit !== suit) return false;
  return card.rank === state.foundations[suit].length + 1;
}

function findExposedSource(state: ReadonlyTrifoldState, cardId: CardId): CardSource | null {
  for (let column = 0; column < state.tableau.length; column += 1) {
    const cards = state.tableau[column];
    if (cards.length > 0 && cards[cards.length - 1] === cardId) {
      return { zone: 'tableau', column, index: cards.length - 1 };
    }
  }
  for (let cell = 0; cell < state.freeCells.length; cell += 1) {
    const entry = state.freeCells[cell];
    if (entry?.kind === 'card' && entry.cardId === cardId) return { zone: 'free-cell', cell };
  }
  return null;
}

export function canCollectDragons(
  state: ReadonlyTrifoldState,
  family: DragonFamily,
): DragonCollection | null {
  if (state.freeCells.some((cell) => cell.kind === 'dragons' && cell.family === family)) return null;

  const sources: CardSource[] = [];
  for (let column = 0; column < state.tableau.length; column += 1) {
    const cards = state.tableau[column];
    if (cards.length === 0) continue;
    const card = getCard(cards[cards.length - 1]);
    if (card.kind === 'dragon' && card.family === family) {
      sources.push({ zone: 'tableau', column, index: cards.length - 1 });
    }
  }

  let matchingDragonCell = -1;
  for (let cell = 0; cell < state.freeCells.length; cell += 1) {
    const entry = state.freeCells[cell];
    if (entry?.kind !== 'card') continue;
    const card = getCard(entry.cardId);
    if (card.kind !== 'dragon' || card.family !== family) continue;
    sources.push({ zone: 'free-cell', cell });
    if (matchingDragonCell < 0) matchingDragonCell = cell;
  }

  if (sources.length !== 4) return null;
  const destinationCell = matchingDragonCell >= 0
    ? matchingDragonCell
    : state.freeCells.findIndex((cell) => cell.kind === 'empty');
  if (destinationCell < 0) return null;
  return { family, sources, destinationCell };
}

export function isSafeAutoFoundation(cardId: CardId, state: ReadonlyTrifoldState): boolean {
  const card = getCard(cardId);
  if (card.kind !== 'number') return false;
  if (card.rank !== state.foundations[card.suit].length + 1) return false;
  const minimumFoundation = Math.min(...NUMERIC_SUITS.map((suit) => state.foundations[suit].length));
  return minimumFoundation >= card.rank - 1;
}

export function findNextAutoMove(state: ReadonlyTrifoldState): AutoMove | null {
  if (state.flowerFoundation === null) {
    const flowerSource = findExposedSource(state, 'flower');
    if (flowerSource) return { source: flowerSource, target: { zone: 'flower-foundation' } };
  }

  type Candidate = { card: Extract<TrifoldCard, { kind: 'number' }>; source: CardSource; sourceOrder: number };
  const candidates: Candidate[] = [];
  let sourceOrder = 0;
  for (let column = 0; column < state.tableau.length; column += 1) {
    const cards = state.tableau[column];
    if (cards.length > 0) {
      const card = getCard(cards[cards.length - 1]);
      if (card.kind === 'number' && isSafeAutoFoundation(card.id, state)) {
        candidates.push({ card, source: { zone: 'tableau', column, index: cards.length - 1 }, sourceOrder });
      }
    }
    sourceOrder += 1;
  }
  for (let cell = 0; cell < state.freeCells.length; cell += 1) {
    const entry = state.freeCells[cell];
    if (entry?.kind === 'card') {
      const card = getCard(entry.cardId);
      if (card.kind === 'number' && isSafeAutoFoundation(card.id, state)) {
        candidates.push({ card, source: { zone: 'free-cell', cell }, sourceOrder });
      }
    }
    sourceOrder += 1;
  }

  candidates.sort((a, b) => a.card.rank - b.card.rank
    || NUMERIC_SUITS.indexOf(a.card.suit) - NUMERIC_SUITS.indexOf(b.card.suit)
    || a.sourceOrder - b.sourceOrder);
  const next = candidates[0];
  return next ? { source: next.source, target: { zone: 'foundation', suit: next.card.suit } } : null;
}

export function isWon(state: ReadonlyTrifoldState): boolean {
  if (state.flowerFoundation !== 'flower') return false;
  if (!NUMERIC_SUITS.every((suit) => state.foundations[suit].length === 9)) return false;
  return DRAGON_FAMILIES.every((family) => state.freeCells.some(
    (cell) => cell.kind === 'dragons' && cell.family === family && cell.cardIds.length === 4,
  ));
}
