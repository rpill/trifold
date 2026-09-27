import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { ACTIVE_GAME_SAVE_VERSION, normalizeActiveGameSave } from '../src/persistence/ActiveGameSave.ts';

function gameSave(seed: number) {
  return new TrifoldGame(createDeal(seed)).exportSave();
}

test('normalizes a Standard active save with Trifold game payload', () => {
  const save = normalizeActiveGameSave({
    version: ACTIVE_GAME_SAVE_VERSION,
    mode: 'standard',
    seed: 11,
    game: gameSave(11),
    moves: 7,
    activeMs: 3456,
    assisted: true,
    updatedAtMs: 999,
    standard: { partition: 'hard', difficulty: 'hard' },
  });
  assert.ok(save);
  assert.equal(save.mode, 'standard');
  assert.deepEqual(save.standard, { partition: 'hard', difficulty: 'hard' });
  assert.equal(save.daily, undefined);
  assert.equal(save.game.seed, 11);
});

test('normalizes a Daily active save and rejects mismatched mode metadata', () => {
  const save = normalizeActiveGameSave({
    version: 1,
    mode: 'daily',
    seed: 12,
    game: gameSave(12),
    moves: 1,
    activeMs: 42,
    assisted: false,
    updatedAtMs: 1000,
    daily: { dateKey: '2026-09-27', kind: 'archive' },
  });
  assert.ok(save);
  assert.deepEqual(save.daily, { dateKey: '2026-09-27', kind: 'archive' });
  assert.equal(save.standard, undefined);

  assert.equal(normalizeActiveGameSave({ ...save, standard: { partition: 'easy', difficulty: 'easy' } }), null);
});

test('rejects a game payload whose seed does not match the active envelope', () => {
  assert.equal(normalizeActiveGameSave({
    version: 1,
    mode: 'standard',
    seed: 99,
    game: gameSave(98),
    moves: 0,
    activeMs: 0,
    assisted: false,
    updatedAtMs: 0,
    standard: { partition: 'easy', difficulty: 'easy' },
  }), null);
});

test('rejects invalid Standard partition/difficulty and malformed Daily dates', () => {
  const base = {
    version: 1,
    mode: 'standard',
    seed: 13,
    game: gameSave(13),
    moves: 0,
    activeMs: 0,
    assisted: false,
    updatedAtMs: 0,
  } as const;
  assert.equal(normalizeActiveGameSave({ ...base, standard: { partition: 'onboarding', difficulty: 'hard' } }), null);
  assert.equal(normalizeActiveGameSave({ ...base, standard: { partition: 'easy', difficulty: 'hard' } }), null);
  assert.equal(normalizeActiveGameSave({ ...base, mode: 'daily', standard: undefined, daily: { dateKey: 'bad', kind: 'today' } }), null);
});
