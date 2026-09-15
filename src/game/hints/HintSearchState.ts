import { createDeck, DRAGON_FAMILIES, NUMERIC_SUITS } from '../model/cards.ts';
import type {
  CardId,
  DragonFamily,
  NumericSuit,
  PlayerCommand,
  TrifoldSnapshot,
} from '../model/types.ts';

const DECK = createDeck();
const CARD_INDEX = new Map<CardId, number>(DECK.map((card, index) => [card.id, index]));

const EMPTY = -1;
const DRAGON_MARKER_BASE = -2;

export interface HintCompactState {
  readonly tableau: readonly (readonly number[])[];
  readonly freeCells: readonly number[];
  readonly foundations: readonly [number, number, number];
  readonly flower: boolean;
}

export interface HintCandidate {
  readonly command: PlayerCommand;
  readonly child: HintCompactState;
  readonly score: number;
  readonly order: number;
}

function cardIndex(cardId: CardId): number {
  const index = CARD_INDEX.get(cardId);
  if (index === undefined) throw new Error(`Unknown Trifold card id: ${cardId}`);
  return index;
}

export function cardIdFromHintIndex(index: number): CardId {
  const card = DECK[index];
  if (!card) throw new Error(`Invalid hint card index: ${index}`);
  return card.id;
}

function isNumber(card: number): boolean { return card >= 0 && card < 27; }
function suitOf(card: number): number { return isNumber(card) ? Math.floor(card / 9) : -1; }
function rankOf(card: number): number { return isNumber(card) ? (card % 9) + 1 : -1; }
function isDragon(card: number): boolean { return card >= 27 && card < 39; }
function familyOf(card: number): number { return isDragon(card) ? Math.floor((card - 27) / 4) : -1; }
function isFlower(card: number): boolean { return card === 39; }
function familyMarker(family: number): number { return DRAGON_MARKER_BASE - family; }

function suitName(index: number): NumericSuit {
  const suit = NUMERIC_SUITS[index];
  if (!suit) throw new Error(`Invalid numeric suit index ${index}`);
  return suit;
}

function familyName(index: number): DragonFamily {
  const family = DRAGON_FAMILIES[index];
  if (!family) throw new Error(`Invalid dragon family index ${index}`);
  return family;
}

export function compactStateFromSnapshot(snapshot: TrifoldSnapshot): HintCompactState {
  const freeCells = snapshot.freeCells.map((cell): number => {
    if (cell.kind === 'empty') return EMPTY;
    if (cell.kind === 'card') return cardIndex(cell.cardId);
    return familyMarker(DRAGON_FAMILIES.indexOf(cell.family));
  });
  return {
    tableau: snapshot.tableau.map((column) => column.map(cardIndex)),
    freeCells,
    foundations: [
      snapshot.foundations.coins.length,
      snapshot.foundations.bamboo.length,
      snapshot.foundations.characters.length,
    ],
    flower: snapshot.flowerFoundation === 'flower',
  };
}

function cloneState(state: HintCompactState): {
  tableau: number[][];
  freeCells: number[];
  foundations: [number, number, number];
  flower: boolean;
} {
  return {
    tableau: state.tableau.map((column) => [...column]),
    freeCells: [...state.freeCells],
    foundations: [...state.foundations] as [number, number, number],
    flower: state.flower,
  };
}

function familyDone(state: HintCompactState, family: number): boolean {
  return state.freeCells.includes(familyMarker(family));
}

export function hintStateWon(state: HintCompactState): boolean {
  return state.flower
    && state.foundations.every((rank) => rank === 9)
    && [0, 1, 2].every((family) => familyDone(state, family));
}

function minimumFoundation(state: HintCompactState): number {
  return Math.min(...state.foundations);
}

function safeAutoNumber(state: HintCompactState, card: number): boolean {
  if (!isNumber(card)) return false;
  const suit = suitOf(card);
  const rank = rankOf(card);
  return rank === state.foundations[suit] + 1 && minimumFoundation(state) >= rank - 1;
}

export function normalizeHintState(input: HintCompactState): HintCompactState {
  const state = cloneState(input);
  for (let step = 0; step < 40; step += 1) {
    if (!state.flower) {
      let moved = false;
      for (let column = 0; column < 8; column += 1) {
        const cards = state.tableau[column];
        const top = cards.at(-1);
        if (top !== undefined && isFlower(top)) {
          cards.pop();
          state.flower = true;
          moved = true;
          break;
        }
      }
      if (!moved) {
        for (let cell = 0; cell < 3; cell += 1) {
          if (isFlower(state.freeCells[cell])) {
            state.freeCells[cell] = EMPTY;
            state.flower = true;
            moved = true;
            break;
          }
        }
      }
      if (moved) continue;
    }

    type AutoCandidate = { card: number; fromFree: boolean; sourceIndex: number; sourceOrder: number };
    const candidates: AutoCandidate[] = [];
    for (let column = 0; column < 8; column += 1) {
      const cards = state.tableau[column];
      const top = cards.at(-1);
      if (top !== undefined && safeAutoNumber(state, top)) {
        candidates.push({ card: top, fromFree: false, sourceIndex: column, sourceOrder: column });
      }
    }
    for (let cell = 0; cell < 3; cell += 1) {
      const card = state.freeCells[cell];
      if (card >= 0 && safeAutoNumber(state, card)) {
        candidates.push({ card, fromFree: true, sourceIndex: cell, sourceOrder: 8 + cell });
      }
    }
    candidates.sort((a, b) => rankOf(a.card) - rankOf(b.card)
      || suitOf(a.card) - suitOf(b.card)
      || a.sourceOrder - b.sourceOrder);
    const best = candidates[0];
    if (!best) return state;
    if (best.fromFree) state.freeCells[best.sourceIndex] = EMPTY;
    else state.tableau[best.sourceIndex].pop();
    state.foundations[suitOf(best.card)] += 1;
  }
  throw new Error('Hint automatic normalization exceeded 40 moves.');
}

function validRunSuffix(cards: readonly number[], start: number): boolean {
  if (start < 0 || start >= cards.length) return false;
  if (start === cards.length - 1) return true;
  for (let index = start; index + 1 < cards.length; index += 1) {
    const lower = cards[index];
    const upper = cards[index + 1];
    if (!isNumber(lower) || !isNumber(upper)) return false;
    if (rankOf(upper) !== rankOf(lower) - 1 || suitOf(upper) === suitOf(lower)) return false;
  }
  return true;
}

function canStackOn(root: number, target: number): boolean {
  return isNumber(root) && isNumber(target)
    && rankOf(root) === rankOf(target) - 1
    && suitOf(root) !== suitOf(target);
}

function firstEmptyFree(state: HintCompactState): number {
  return state.freeCells.findIndex((cell) => cell === EMPTY);
}

function firstEmptyTableauExcept(state: HintCompactState, sourceColumn: number): number {
  for (let column = 0; column < 8; column += 1) {
    if (column !== sourceColumn && state.tableau[column].length === 0) return column;
  }
  return -1;
}

function dragonDestination(state: HintCompactState, family: number): number | null {
  if (familyDone(state, family)) return null;
  let count = 0;
  let matchingCell = -1;
  for (let column = 0; column < 8; column += 1) {
    const top = state.tableau[column].at(-1);
    if (top !== undefined && familyOf(top) === family) count += 1;
  }
  for (let cell = 0; cell < 3; cell += 1) {
    const card = state.freeCells[cell];
    if (card >= 0 && familyOf(card) === family) {
      count += 1;
      if (matchingCell < 0) matchingCell = cell;
    }
  }
  if (count !== 4) return null;
  if (matchingCell >= 0) return matchingCell;
  const empty = firstEmptyFree(state);
  return empty >= 0 ? empty : null;
}

function applyMove(
  input: HintCompactState,
  sourceKind: 'tableau' | 'free-cell',
  sourceIndex: number,
  card: number,
  targetKind: 'tableau' | 'free-cell' | 'foundation',
  targetIndex: number,
): HintCompactState {
  const state = cloneState(input);
  const moving: number[] = [];
  if (sourceKind === 'tableau') {
    const source = state.tableau[sourceIndex];
    const start = source.indexOf(card);
    if (start < 0) throw new Error('Hint source card missing.');
    moving.push(...source.splice(start));
  } else {
    if (state.freeCells[sourceIndex] !== card) throw new Error('Hint free-cell source mismatch.');
    moving.push(card);
    state.freeCells[sourceIndex] = EMPTY;
  }
  if (targetKind === 'tableau') state.tableau[targetIndex].push(...moving);
  else if (targetKind === 'free-cell') {
    if (moving.length !== 1) throw new Error('Hint free cell received a run.');
    state.freeCells[targetIndex] = moving[0];
  } else {
    if (moving.length !== 1 || !isNumber(moving[0])) throw new Error('Hint foundation received invalid card.');
    state.foundations[targetIndex] += 1;
  }
  return normalizeHintState(state);
}

function applyDragons(input: HintCompactState, family: number, destination: number): HintCompactState {
  const state = cloneState(input);
  for (let column = 0; column < 8; column += 1) {
    const top = state.tableau[column].at(-1);
    if (top !== undefined && familyOf(top) === family) state.tableau[column].pop();
  }
  for (let cell = 0; cell < 3; cell += 1) {
    const card = state.freeCells[cell];
    if (card >= 0 && familyOf(card) === family) state.freeCells[cell] = EMPTY;
  }
  state.freeCells[destination] = familyMarker(family);
  return normalizeHintState(state);
}

function stateScore(state: HintCompactState): number {
  const foundations = state.foundations.reduce((sum, rank) => sum + rank, 0);
  const dragons = [0, 1, 2].filter((family) => familyDone(state, family)).length;
  const emptyColumns = state.tableau.filter((column) => column.length === 0).length;
  const emptyFree = state.freeCells.filter((cell) => cell === EMPTY).length;
  return foundations * 10_000 + dragons * 50_000 + (state.flower ? 5_000 : 0) + emptyColumns * 200 + emptyFree * 40;
}

function addCandidate(
  out: HintCandidate[],
  command: PlayerCommand,
  child: HintCompactState,
  order: number,
): void {
  out.push({ command, child, score: stateScore(child), order });
}

export function generateHintCandidates(state: HintCompactState): readonly HintCandidate[] {
  const candidates: HintCandidate[] = [];
  let order = 0;

  for (let column = 0; column < 8; column += 1) {
    const cards = state.tableau[column];
    const card = cards.at(-1);
    if (card === undefined || !isNumber(card)) continue;
    const suit = suitOf(card);
    if (rankOf(card) === state.foundations[suit] + 1) {
      const command: PlayerCommand = {
        type: 'move', source: { zone: 'tableau', column, index: cards.length - 1 }, target: { zone: 'foundation', suit: suitName(suit) },
      };
      addCandidate(candidates, command, applyMove(state, 'tableau', column, card, 'foundation', suit), order++);
    }
  }
  for (let cell = 0; cell < 3; cell += 1) {
    const card = state.freeCells[cell];
    if (card < 0 || !isNumber(card)) continue;
    const suit = suitOf(card);
    if (rankOf(card) === state.foundations[suit] + 1) {
      const command: PlayerCommand = {
        type: 'move', source: { zone: 'free-cell', cell }, target: { zone: 'foundation', suit: suitName(suit) },
      };
      addCandidate(candidates, command, applyMove(state, 'free-cell', cell, card, 'foundation', suit), order++);
    }
  }

  for (let family = 0; family < 3; family += 1) {
    const destination = dragonDestination(state, family);
    if (destination === null) continue;
    const command: PlayerCommand = { type: 'collect-dragons', family: familyName(family) };
    addCandidate(candidates, command, applyDragons(state, family, destination), order++);
  }

  for (let sourceColumn = 0; sourceColumn < 8; sourceColumn += 1) {
    const source = state.tableau[sourceColumn];
    if (source.length === 0) continue;
    for (let start = source.length - 1; start >= 0; start -= 1) {
      if (!validRunSuffix(source, start)) break;
      const root = source[start];
      if (!isNumber(root) && start !== source.length - 1) continue;
      for (let targetColumn = 0; targetColumn < 8; targetColumn += 1) {
        if (targetColumn === sourceColumn) continue;
        const target = state.tableau[targetColumn];
        const targetTop = target.at(-1);
        if (targetTop === undefined || !canStackOn(root, targetTop)) continue;
        const command: PlayerCommand = {
          type: 'move', source: { zone: 'tableau', column: sourceColumn, index: start }, target: { zone: 'tableau', column: targetColumn },
        };
        addCandidate(candidates, command, applyMove(state, 'tableau', sourceColumn, root, 'tableau', targetColumn), order++);
      }
    }
  }

  for (let cell = 0; cell < 3; cell += 1) {
    const card = state.freeCells[cell];
    if (card < 0) continue;
    for (let targetColumn = 0; targetColumn < 8; targetColumn += 1) {
      const targetTop = state.tableau[targetColumn].at(-1);
      if (targetTop !== undefined && canStackOn(card, targetTop)) {
        const command: PlayerCommand = {
          type: 'move', source: { zone: 'free-cell', cell }, target: { zone: 'tableau', column: targetColumn },
        };
        addCandidate(candidates, command, applyMove(state, 'free-cell', cell, card, 'tableau', targetColumn), order++);
      }
    }
  }

  for (let sourceColumn = 0; sourceColumn < 8; sourceColumn += 1) {
    const source = state.tableau[sourceColumn];
    if (source.length === 0) continue;
    const emptyTarget = firstEmptyTableauExcept(state, sourceColumn);
    if (emptyTarget < 0) break;
    for (let start = source.length - 1; start >= 0; start -= 1) {
      if (!validRunSuffix(source, start)) break;
      if (start === 0) continue;
      const root = source[start];
      const command: PlayerCommand = {
        type: 'move', source: { zone: 'tableau', column: sourceColumn, index: start }, target: { zone: 'tableau', column: emptyTarget },
      };
      addCandidate(candidates, command, applyMove(state, 'tableau', sourceColumn, root, 'tableau', emptyTarget), order++);
    }
  }
  const anyEmptyTableau = firstEmptyTableauExcept(state, -1);
  if (anyEmptyTableau >= 0) {
    for (let cell = 0; cell < 3; cell += 1) {
      const card = state.freeCells[cell];
      if (card < 0) continue;
      const command: PlayerCommand = {
        type: 'move', source: { zone: 'free-cell', cell }, target: { zone: 'tableau', column: anyEmptyTableau },
      };
      addCandidate(candidates, command, applyMove(state, 'free-cell', cell, card, 'tableau', anyEmptyTableau), order++);
    }
  }

  const emptyFree = firstEmptyFree(state);
  if (emptyFree >= 0) {
    for (let sourceColumn = 0; sourceColumn < 8; sourceColumn += 1) {
      const source = state.tableau[sourceColumn];
      const card = source.at(-1);
      if (card === undefined) continue;
      const command: PlayerCommand = {
        type: 'move', source: { zone: 'tableau', column: sourceColumn, index: source.length - 1 }, target: { zone: 'free-cell', cell: emptyFree },
      };
      addCandidate(candidates, command, applyMove(state, 'tableau', sourceColumn, card, 'free-cell', emptyFree), order++);
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  return candidates;
}

function encodeColumn(column: readonly number[]): string {
  return String.fromCharCode(column.length, ...column.map((card) => card + 1));
}

export function hintStateKey(state: HintCompactState): string {
  const columns = state.tableau.map(encodeColumn).sort();
  return `${columns.join('')}\u007f${String.fromCharCode(...state.freeCells.map((cell) => cell + 6))}${String.fromCharCode(...state.foundations)}${state.flower ? '\u0001' : '\u0000'}`;
}
