import { createDeck, DRAGON_FAMILIES, NUMERIC_SUITS } from './cards.ts';
import { createDeal } from './deal.ts';
import { TrifoldGame } from './TrifoldGame.ts';
import { isWon } from './TrifoldRules.ts';
import type {
  CardId,
  CardSource,
  CardTarget,
  DragonFamily,
  PlayerCommand,
  ReadonlyTrifoldState,
} from './types.ts';

export type DealProofSource =
  | { readonly zone: 'tableau'; readonly column: number; readonly cardId: CardId }
  | { readonly zone: 'free-cell'; readonly cell: number; readonly cardId: CardId };

export type DealProofAction =
  | { readonly kind: 'move'; readonly source: DealProofSource; readonly target: CardTarget }
  | { readonly kind: 'collect-dragons'; readonly family: DragonFamily };

export interface ProofMetrics {
  readonly decisionActions: number;
  readonly rearrangementMoves: number;
  readonly freeCellTouches: number;
  readonly earlyProgressActions: number;
  readonly blockedDragonPressure: number;
}

export interface ProofVerification {
  readonly seed: number;
  readonly actionCount: number;
  readonly metrics: ProofMetrics;
}

const DECK = createDeck();
const KNOWN_IDS = new Set<CardId>(DECK.map((card) => card.id));
const DRAGON_IDS_BY_FAMILY = new Map<DragonFamily, Set<CardId>>(
  DRAGON_FAMILIES.map((family) => [
    family,
    new Set(DECK.filter((card) => card.kind === 'dragon' && card.family === family).map((card) => card.id)),
  ]),
);

function fail(seed: number, actionIndex: number, message: string): never {
  throw new Error(`Deal proof verification failed seed=${seed} action=${actionIndex}: ${message}`);
}

function isIntegerInRange(value: number, min: number, maxExclusive: number): boolean {
  return Number.isInteger(value) && value >= min && value < maxExclusive;
}

function assertKnownCardId(cardId: CardId, seed: number, actionIndex: number): void {
  if (!KNOWN_IDS.has(cardId)) fail(seed, actionIndex, `unknown card id ${String(cardId)}`);
}

function assertTarget(target: CardTarget, seed: number, actionIndex: number): void {
  if (!target || typeof target !== 'object') fail(seed, actionIndex, 'invalid target');
  if (target.zone === 'tableau') {
    if (!isIntegerInRange(target.column, 0, 8)) fail(seed, actionIndex, 'invalid tableau target column');
    return;
  }
  if (target.zone === 'free-cell') {
    if (!isIntegerInRange(target.cell, 0, 3)) fail(seed, actionIndex, 'invalid free-cell target');
    return;
  }
  if (target.zone === 'foundation') {
    if (!NUMERIC_SUITS.includes(target.suit)) fail(seed, actionIndex, 'invalid foundation target suit');
    return;
  }
  fail(seed, actionIndex, 'invalid target zone');
}

function resolveProofAction(
  state: ReadonlyTrifoldState,
  action: DealProofAction,
  seed: number,
  actionIndex: number,
): PlayerCommand {
  if (!action || typeof action !== 'object') fail(seed, actionIndex, 'invalid proof action');
  if (action.kind === 'collect-dragons') {
    if (!DRAGON_FAMILIES.includes(action.family)) fail(seed, actionIndex, 'invalid dragon family');
    return { type: 'collect-dragons', family: action.family };
  }
  if (action.kind !== 'move') fail(seed, actionIndex, 'unknown proof action kind');

  const source = action.source;
  if (!source || typeof source !== 'object') fail(seed, actionIndex, 'invalid proof source');
  assertKnownCardId(source.cardId, seed, actionIndex);
  let resolved: CardSource;
  if (source.zone === 'tableau') {
    if (!isIntegerInRange(source.column, 0, state.tableau.length)) {
      fail(seed, actionIndex, 'invalid stable tableau column');
    }
    const column = state.tableau[source.column];
    const index = column.indexOf(source.cardId);
    if (index < 0) fail(seed, actionIndex, `card is not in recorded tableau column ${source.column}`);
    resolved = { zone: 'tableau', column: source.column, index };
  } else if (source.zone === 'free-cell') {
    if (!isIntegerInRange(source.cell, 0, state.freeCells.length)) fail(seed, actionIndex, 'invalid free-cell source');
    const cell = state.freeCells[source.cell];
    if (cell?.kind !== 'card' || cell.cardId !== source.cardId) {
      fail(seed, actionIndex, `free-cell ${source.cell} does not contain recorded card`);
    }
    resolved = { zone: 'free-cell', cell: source.cell };
  } else {
    fail(seed, actionIndex, 'invalid proof source zone');
  }

  assertTarget(action.target, seed, actionIndex);
  return { type: 'move', source: resolved, target: action.target };
}

function assertStateIntegrity(state: ReadonlyTrifoldState, seed: number, actionIndex: number): void {
  if (state.tableau.length !== 8) fail(seed, actionIndex, `expected 8 tableau columns, got ${state.tableau.length}`);
  if (state.freeCells.length !== 3) fail(seed, actionIndex, `expected 3 free cells, got ${state.freeCells.length}`);

  const allIds: CardId[] = [];
  for (const column of state.tableau) allIds.push(...column);
  for (const cell of state.freeCells) {
    if (cell.kind === 'card') {
      allIds.push(cell.cardId);
      continue;
    }
    if (cell.kind === 'dragons') {
      const expected = DRAGON_IDS_BY_FAMILY.get(cell.family);
      if (!expected) fail(seed, actionIndex, `unknown collected dragon family ${String(cell.family)}`);
      if (cell.cardIds.length !== 4) fail(seed, actionIndex, `collected ${cell.family} dragons must contain exactly four cards`);
      if (new Set(cell.cardIds).size !== 4 || cell.cardIds.some((cardId) => !expected.has(cardId))) {
        fail(seed, actionIndex, `collected ${cell.family} dragon bundle is invalid`);
      }
      allIds.push(...cell.cardIds);
    }
  }

  for (const suit of NUMERIC_SUITS) {
    const foundation = state.foundations[suit];
    if (foundation.length > 9) fail(seed, actionIndex, `${suit} foundation exceeds rank nine`);
    for (let index = 0; index < foundation.length; index += 1) {
      const expected = `${suit}-${index + 1}`;
      if (foundation[index] !== expected) {
        fail(seed, actionIndex, `${suit} foundation expected ${expected} at index ${index}`);
      }
    }
    allIds.push(...foundation);
  }

  if (state.flowerFoundation !== null) {
    if (state.flowerFoundation !== 'flower') fail(seed, actionIndex, 'flower foundation contains a non-flower card');
    allIds.push(state.flowerFoundation);
  }

  const completedFamilies = state.freeCells
    .filter((cell): cell is Extract<(typeof state.freeCells)[number], { kind: 'dragons' }> => cell.kind === 'dragons')
    .map((cell) => cell.family);
  if (new Set(completedFamilies).size !== completedFamilies.length) {
    fail(seed, actionIndex, 'dragon family is collected in more than one cell');
  }

  if (allIds.length !== 40) fail(seed, actionIndex, `card conservation failed: found ${allIds.length} cards`);
  const seen = new Set<CardId>();
  for (const cardId of allIds) {
    assertKnownCardId(cardId, seed, actionIndex);
    if (seen.has(cardId)) fail(seed, actionIndex, `duplicate physical card ${cardId}`);
    seen.add(cardId);
  }
  for (const cardId of KNOWN_IDS) {
    if (!seen.has(cardId)) fail(seed, actionIndex, `missing physical card ${cardId}`);
  }
}

function numericFoundationCount(state: ReadonlyTrifoldState): number {
  return NUMERIC_SUITS.reduce((sum, suit) => sum + state.foundations[suit].length, 0);
}

function completedDragonCount(state: ReadonlyTrifoldState): number {
  return state.freeCells.reduce((sum, cell) => sum + (cell.kind === 'dragons' ? 1 : 0), 0);
}

export function verifySeedProof(seed: number, proof: readonly DealProofAction[]): ProofVerification {
  if (!Array.isArray(proof)) fail(seed, -1, 'proof must be an array');
  const game = new TrifoldGame(createDeal(seed));
  game.settleInitialAutoMoves();
  assertStateIntegrity(game.state, seed, -1);

  let rearrangementMoves = 0;
  let freeCellTouches = 0;
  let earlyProgressActions = 0;
  let blockedDragonPressureTotal = 0;
  let reachedFourNumeric = numericFoundationCount(game.state) >= 4;

  for (let actionIndex = 0; actionIndex < proof.length; actionIndex += 1) {
    const action = proof[actionIndex];
    const command = resolveProofAction(game.state, action, seed, actionIndex);

    if (action.kind === 'move') {
      if (action.target.zone === 'tableau' || action.target.zone === 'free-cell') rearrangementMoves += 1;
      if (action.source.zone === 'free-cell' || action.target.zone === 'free-cell') freeCellTouches += 1;
    }

    const result = game.perform(command);
    if (result === null) fail(seed, actionIndex, 'production rules rejected proof action');
    assertStateIntegrity(game.state, seed, actionIndex);

    if (!reachedFourNumeric) {
      earlyProgressActions += 1;
      reachedFourNumeric = numericFoundationCount(game.state) >= 4;
    }
    blockedDragonPressureTotal += completedDragonCount(game.state);
  }

  if (!isWon(game.state)) fail(seed, proof.length, 'proof ended without a win');

  const decisionActions = proof.length;
  return {
    seed: seed >>> 0,
    actionCount: decisionActions,
    metrics: {
      decisionActions,
      rearrangementMoves,
      freeCellTouches,
      earlyProgressActions,
      blockedDragonPressure: blockedDragonPressureTotal / Math.max(1, decisionActions * 3),
    },
  };
}
