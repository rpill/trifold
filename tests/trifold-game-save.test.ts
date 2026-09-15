import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import {
  canCollectDragons,
  canDropInFreeCell,
  canDropOnTableau,
  canMoveToFoundation,
} from '../src/game/model/TrifoldRules.ts';
import type { CardSource, PlayerCommand, ReadonlyTrifoldState } from '../src/game/model/types.ts';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';

function candidateSources(state: ReadonlyTrifoldState): CardSource[] {
  const result: CardSource[] = [];
  state.tableau.forEach((column, columnIndex) => {
    for (let index = 0; index < column.length; index += 1) {
      result.push({ zone: 'tableau', column: columnIndex, index });
    }
  });
  state.freeCells.forEach((cell, cellIndex) => {
    if (cell.kind === 'card') result.push({ zone: 'free-cell', cell: cellIndex });
  });
  return result;
}

function findFirstLegalCommand(state: ReadonlyTrifoldState): PlayerCommand | null {
  for (const family of ['red', 'green', 'white'] as const) {
    if (canCollectDragons(state, family)) return { type: 'collect-dragons', family };
  }
  for (const source of candidateSources(state)) {
    for (let column = 0; column < state.tableau.length; column += 1) {
      if (canDropOnTableau(state, source, column)) return { type: 'move', source, target: { zone: 'tableau', column } };
    }
    for (let cell = 0; cell < state.freeCells.length; cell += 1) {
      if (canDropInFreeCell(state, source, cell)) return { type: 'move', source, target: { zone: 'free-cell', cell } };
    }
    for (const suit of ['coins', 'bamboo', 'characters'] as const) {
      if (canMoveToFoundation(state, source, suit)) return { type: 'move', source, target: { zone: 'foundation', suit } };
    }
  }
  return null;
}

test('restored game preserves board and undo transaction history', () => {
  const game = new TrifoldGame(createDeal(1));
  const legal = findFirstLegalCommand(game.state);
  assert.ok(legal);
  assert.ok(game.perform(legal));

  const saved = game.exportSave();
  const restored = TrifoldGame.restore(saved);

  assert.deepEqual(restored.snapshot(), game.snapshot());
  assert.equal(restored.canUndo, true);
  assert.ok(restored.undo());
});

test('game save is detached from later mutations', () => {
  const game = new TrifoldGame(createDeal(2));
  const saved = game.exportSave();
  const before = structuredClone(saved);
  const legal = findFirstLegalCommand(game.state);
  assert.ok(legal);
  game.perform(legal);
  assert.deepEqual(saved, before);
});

test('restore rejects wrong version, seed mismatch and duplicate cards', () => {
  const saved = new TrifoldGame(createDeal(3)).exportSave();
  assert.throws(() => TrifoldGame.restore({ ...saved, version: 2 }), /save version/i);
  assert.throws(() => TrifoldGame.restore({ ...saved, seed: saved.seed + 1 }), /seed/i);

  const tableau = saved.snapshot.tableau.map((column) => [...column]);
  tableau[0]![0] = tableau[1]![0]!;
  assert.throws(() => TrifoldGame.restore({
    ...saved,
    snapshot: { ...saved.snapshot, tableau },
  }), /duplicate|40 unique/i);
});

test('restore rejects malformed completed dragon free-cell groups', () => {
  const saved = new TrifoldGame(createDeal(4)).exportSave();
  const snapshot = {
    ...saved.snapshot,
    tableau: saved.snapshot.tableau.map((column) => [...column]),
    freeCells: saved.snapshot.freeCells.map((cell) =>
      cell.kind === 'dragons' ? { ...cell, cardIds: [...cell.cardIds] } : { ...cell },
    ),
  };
  const moved = snapshot.tableau[0]!.splice(-1, 1)[0]!;
  snapshot.freeCells[0] = { kind: 'dragons', family: 'red', cardIds: [moved] };
  assert.throws(() => TrifoldGame.restore({ ...saved, snapshot }), /dragon/i);
});

test('profile parser round-trips an active Standard game save', () => {
  const profile = createDefaultProfile();
  const game = new TrifoldGame(createDeal(5));
  const parsed = parsePlayerProfile({
    ...profile,
    activeStandard: {
      version: 1,
      seed: 5,
      partition: 'easy',
      difficulty: 'easy',
      game: game.exportSave(),
      moves: 3,
      activeMs: 1200,
      assisted: false,
      updatedAtMs: 999,
    },
  });
  assert.equal(parsed.activeStandard?.seed, 5);
  assert.deepEqual(parsed.activeStandard?.game, game.exportSave());
});
