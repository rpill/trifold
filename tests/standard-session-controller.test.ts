import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import {
  canDropInFreeCell,
  canDropOnTableau,
  canMoveToFoundation,
} from '../src/game/model/TrifoldRules.ts';
import type { CardSource, PlayerCommand, ReadonlyTrifoldState, TrifoldSnapshot } from '../src/game/model/types.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { PlayerProfileV1 } from '../src/meta/profile/ProfileTypes.ts';
import { ProfileRepository, type ProfileStore } from '../src/meta/profile/ProfileRepository.ts';
import { StandardSessionController } from '../src/meta/standard/StandardSessionController.ts';

class MemoryProfileStore implements ProfileStore {
  profile: PlayerProfileV1;
  constructor(profile = createDefaultProfile()) { this.profile = structuredClone(profile); }
  async load(): Promise<PlayerProfileV1> { return structuredClone(this.profile); }
  async save(profile: PlayerProfileV1): Promise<void> { this.profile = structuredClone(profile); }
}

function catalog(): VerifiedDealCatalog {
  const seeds = [11, 21, 22, 31, 41, 51];
  const buffer = new ArrayBuffer(seeds.length * 4);
  const view = new DataView(buffer);
  seeds.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion: 2,
    rulesVersion: 1,
    shuffleVersion: 1,
    seedEncoding: 'uint32-le',
    difficultyModelVersion: 1,
    dailyAlgorithmVersion: 1,
    standardCounts: { onboarding: 1, easy: 2, medium: 1, hard: 1 },
    dailyScheduleStart: '2026-01-01',
    dailyScheduleLength: 1,
    verifiedCount: 6,
    crossPoolDuplicateCount: 0,
    rejectedVerificationCount: 0,
    fastNodeBudget: 100,
    slowNodeBudget: 1000,
    sourceScanRanges: [],
    solverSourceHash: 'solver',
    gameRulesSourceHash: 'rules',
    productionAssetHash: 'hash',
    offsets: {
      onboarding: { byteOffset: 0, count: 1 },
      easy: { byteOffset: 4, count: 2 },
      medium: { byteOffset: 12, count: 1 },
      hard: { byteOffset: 16, count: 1 },
      daily: { byteOffset: 20, count: 1 },
    },
  });
}

function sources(state: ReadonlyTrifoldState): CardSource[] {
  const result: CardSource[] = [];
  state.tableau.forEach((column, columnIndex) => {
    for (let index = 0; index < column.length; index += 1) result.push({ zone: 'tableau', column: columnIndex, index });
  });
  return result;
}

function firstLegalMove(state: ReadonlyTrifoldState): PlayerCommand {
  for (const source of sources(state)) {
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
  throw new Error('Fixture has no legal move.');
}

function wonSnapshot(seed: number): TrifoldSnapshot {
  return {
    seed,
    tableau: [[], [], [], [], [], [], [], []],
    freeCells: [
      { kind: 'dragons', family: 'red', cardIds: ['dragon-red-1', 'dragon-red-2', 'dragon-red-3', 'dragon-red-4'] },
      { kind: 'dragons', family: 'green', cardIds: ['dragon-green-1', 'dragon-green-2', 'dragon-green-3', 'dragon-green-4'] },
      { kind: 'dragons', family: 'white', cardIds: ['dragon-white-1', 'dragon-white-2', 'dragon-white-3', 'dragon-white-4'] },
    ],
    foundations: {
      coins: Array.from({ length: 9 }, (_, i) => `coins-${i + 1}`),
      bamboo: Array.from({ length: 9 }, (_, i) => `bamboo-${i + 1}`),
      characters: Array.from({ length: 9 }, (_, i) => `characters-${i + 1}`),
    },
    flowerFoundation: 'flower',
  };
}

test('successful command increments exactly one move, invalid and undo do not', async () => {
  let now = 1000;
  const repo = await ProfileRepository.open(new MemoryProfileStore());
  const session = await StandardSessionController.startNew({
    repository: repo,
    catalog: catalog(),
    requestedDifficulty: 'easy',
    randomIndex: () => 0,
    timerNow: () => now,
    wallNow: () => now,
  });
  const invalid = session.perform({ type: 'move', source: { zone: 'tableau', column: 0, index: 0 }, target: { zone: 'tableau', column: 0 } });
  assert.equal(invalid, null);
  assert.equal(session.viewState.moves, 0);

  const legal = firstLegalMove(session.state);
  const result = session.perform(legal);
  assert.ok(result);
  assert.equal(session.viewState.moves, 1);
  session.undo();
  assert.equal(session.viewState.moves, 1);
  await session.flushPersistence();
  assert.equal(repo.current.activeStandard?.moves, 1);
});

test('visibility and blocking overlays pause active time and resume without counting gaps', async () => {
  let now = 0;
  const repo = await ProfileRepository.open(new MemoryProfileStore());
  const session = await StandardSessionController.startNew({
    repository: repo,
    catalog: catalog(),
    requestedDifficulty: 'hard',
    randomIndex: () => 0,
    timerNow: () => now,
    wallNow: () => now,
  });
  now = 500;
  session.setVisible(false);
  now = 5_000;
  assert.equal(session.viewState.activeMs, 500);
  session.setVisible(true);
  now = 5_300;
  session.setBlockingOverlayOpen(true);
  now = 9_000;
  assert.equal(session.viewState.activeMs, 800);
  session.setBlockingOverlayOpen(false);
  now = 9_200;
  assert.equal(session.viewState.activeMs, 1_000);
});

test('resuming uses persisted active time and never counts offline wall time', async () => {
  let now = 100;
  const store = new MemoryProfileStore();
  const repo = await ProfileRepository.open(store);
  const first = await StandardSessionController.startNew({
    repository: repo,
    catalog: catalog(),
    requestedDifficulty: 'medium',
    randomIndex: () => 0,
    timerNow: () => now,
    wallNow: () => now,
  });
  now = 600;
  first.setVisible(false);
  await first.flushPersistence();
  const saved = repo.current.activeStandard;
  assert.equal(saved?.activeMs, 500);

  now = 100_000;
  const reopenedRepo = await ProfileRepository.open(store);
  const resumed = StandardSessionController.resume({
    repository: reopenedRepo,
    timerNow: () => now,
    wallNow: () => now,
  });
  assert.equal(resumed.viewState.activeMs, 500);
  now = 100_250;
  assert.equal(resumed.viewState.activeMs, 750);
});

test('won resume settles exactly once and clears active save after committed settlement', async () => {
  const base = createDefaultProfile();
  const seed = 21;
  const profile: PlayerProfileV1 = {
    ...base,
    activeStandard: {
      version: 1,
      seed,
      partition: 'easy',
      difficulty: 'easy',
      game: { version: 1, seed, snapshot: wonSnapshot(seed), history: { version: 1, entries: [] } },
      moves: 42,
      activeMs: 1234,
      assisted: false,
      updatedAtMs: 5000,
    },
  };
  const store = new MemoryProfileStore(profile);
  const repo = await ProfileRepository.open(store);
  const session = StandardSessionController.resume({ repository: repo, timerNow: () => 9999, wallNow: () => 9999 });
  assert.equal(session.viewState.won, true);
  const settlement = await session.settleWin();
  assert.equal(settlement.baseCoinsGranted, 5);
  assert.equal(repo.current.activeStandard, null);
  assert.equal(repo.current.coins, 5);
  const again = await session.settleWin();
  assert.deepEqual(again, settlement);
  assert.equal(repo.current.coins, 5);
});


test('resume settles initial automatic moves that were persisted before deal animation finished', async () => {
  const store = new MemoryProfileStore();
  const repo = await ProfileRepository.open(store);
  await StandardSessionController.startNew({
    repository: repo,
    catalog: catalog(),
    requestedDifficulty: 'easy',
    randomIndex: () => 0,
    timerNow: () => 0,
    wallNow: () => 0,
  });
  assert.equal(repo.current.activeStandard?.game.snapshot.flowerFoundation, null);

  const reopenedRepo = await ProfileRepository.open(store);
  const resumed = StandardSessionController.resume({ repository: reopenedRepo, timerNow: () => 100, wallNow: () => 100 });
  assert.equal(resumed.state.flowerFoundation, 'flower');
  assert.equal(resumed.viewState.moves, 0);
  await resumed.flushPersistence();
  assert.equal(reopenedRepo.current.activeStandard?.game.snapshot.flowerFoundation, 'flower');
});
