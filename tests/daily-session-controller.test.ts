import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import { canDropInFreeCell, canDropOnTableau, canMoveToFoundation } from '../src/game/model/TrifoldRules.ts';
import type { CardSource, PlayerCommand, ReadonlyTrifoldState, TrifoldSnapshot } from '../src/game/model/types.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { PlayerProfileV1 } from '../src/meta/profile/ProfileTypes.ts';
import { ProfileRepository, type ProfileStore } from '../src/meta/profile/ProfileRepository.ts';
import { DailySessionController } from '../src/meta/daily/DailySessionController.ts';

class MemoryProfileStore implements ProfileStore {
  profile: PlayerProfileV1;
  constructor(profile = createDefaultProfile()) { this.profile = structuredClone(profile); }
  async load(): Promise<PlayerProfileV1> { return structuredClone(this.profile); }
  async save(profile: PlayerProfileV1): Promise<void> { this.profile = structuredClone(profile); }
}

function catalog(): VerifiedDealCatalog {
  const seeds = [11, 21, 31, 41, 1, 2, 3];
  const buffer = new ArrayBuffer(seeds.length * 4);
  const view = new DataView(buffer);
  seeds.forEach((seed, index) => view.setUint32(index * 4, seed, true));
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion: 2, rulesVersion: 1, shuffleVersion: 1, seedEncoding: 'uint32-le',
    difficultyModelVersion: 1, dailyAlgorithmVersion: 1,
    standardCounts: { onboarding: 1, easy: 1, medium: 1, hard: 1 },
    dailyScheduleStart: '2026-09-12', dailyScheduleLength: 3, verifiedCount: 7,
    crossPoolDuplicateCount: 0, rejectedVerificationCount: 0,
    fastNodeBudget: 100, slowNodeBudget: 1000, sourceScanRanges: [],
    solverSourceHash: 'solver', gameRulesSourceHash: 'rules', productionAssetHash: 'hash',
    offsets: {
      onboarding: { byteOffset: 0, count: 1 }, easy: { byteOffset: 4, count: 1 },
      medium: { byteOffset: 8, count: 1 }, hard: { byteOffset: 12, count: 1 },
      daily: { byteOffset: 16, count: 3 },
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
    seed, tableau: [[], [], [], [], [], [], [], []],
    freeCells: [
      { kind: 'dragons', family: 'red', cardIds: ['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4'] },
      { kind: 'dragons', family: 'green', cardIds: ['dragon-green-1','dragon-green-2','dragon-green-3','dragon-green-4'] },
      { kind: 'dragons', family: 'white', cardIds: ['dragon-white-1','dragon-white-2','dragon-white-3','dragon-white-4'] },
    ],
    foundations: {
      coins: Array.from({ length: 9 }, (_, i) => `coins-${i + 1}`),
      bamboo: Array.from({ length: 9 }, (_, i) => `bamboo-${i + 1}`),
      characters: Array.from({ length: 9 }, (_, i) => `characters-${i + 1}`),
    }, flowerFoundation: 'flower',
  };
}

test('today uses exact schedule seed and successful decisions count once', async () => {
  let now = 0;
  const repo = await ProfileRepository.open(new MemoryProfileStore());
  const session = await DailySessionController.startToday({
    repository: repo, catalog: catalog(), todayKey: '2026-09-14',
    timerNow: () => now, wallNow: () => now, calendarDateKeyNow: () => '2026-09-14',
  });
  assert.equal(session.viewState.seed, 3);
  assert.equal(session.viewState.dailyDateKey, '2026-09-14');
  assert.equal(session.viewState.kind, 'today');
  const result = session.perform(firstLegalMove(session.state));
  assert.ok(result);
  assert.equal(session.viewState.moves, 1);
  session.undo();
  assert.equal(session.viewState.moves, 1);
  await session.flushPersistence();
  assert.equal(repo.current.daily.active?.moves, 1);
});

test('saved Daily resumes today and archive attempts resume while still in 90-day window', async () => {
  let now = 100;
  const store = new MemoryProfileStore();
  const repo = await ProfileRepository.open(store);
  const first = await DailySessionController.startArchive({
    repository: repo, catalog: catalog(), dailyDateKey: '2026-09-13', todayKey: '2026-09-14',
    timerNow: () => now, wallNow: () => now, calendarDateKeyNow: () => '2026-09-14',
  });
  now = 600;
  first.setVisible(false);
  await first.flushPersistence();
  const reopened = await ProfileRepository.open(store);
  const resumed = DailySessionController.resume({
    repository: reopened, catalog: catalog(), todayKey: '2026-09-14',
    timerNow: () => 10_000, wallNow: () => 10_000, calendarDateKeyNow: () => '2026-09-14',
  });
  assert.equal(resumed.viewState.kind, 'archive');
  assert.equal(resumed.viewState.activeMs, 500);
});

test('midnight expires a today session without deleting archive-resumable save', async () => {
  let dateKey = '2026-09-14';
  const repo = await ProfileRepository.open(new MemoryProfileStore());
  const session = await DailySessionController.startToday({
    repository: repo, catalog: catalog(), todayKey: dateKey,
    calendarDateKeyNow: () => dateKey,
  });
  dateKey = '2026-09-15';
  assert.deepEqual(session.handleDateChange(), { status: 'expired-today', dailyDateKey: '2026-09-14' });
  await session.flushPersistence();
  assert.equal(repo.current.daily.active?.dailyDateKey, '2026-09-14');
});

test('resume rejects and clears an active Daily outside current 90-day archive', async () => {
  const base = createDefaultProfile();
  const seed = 1;
  const profile: PlayerProfileV1 = {
    ...base,
    daily: {
      ...base.daily,
      active: {
        version: 1, dailyDateKey: '2026-01-01', seed,
        game: { version: 1, seed, snapshot: wonSnapshot(seed), history: { version: 1, entries: [] } },
        moves: 1, activeMs: 1, updatedAtMs: 1,
      },
    },
  };
  const repo = await ProfileRepository.open(new MemoryProfileStore(profile));
  await assert.rejects(() => DailySessionController.resumeOrClearExpired({
    repository: repo, catalog: catalog(), todayKey: '2026-09-14', calendarDateKeyNow: () => '2026-09-14',
  }), /archive/i);
  assert.equal(repo.current.daily.active, null);
});

test('won Daily settles once and clears active only after settlement commit', async () => {
  const base = createDefaultProfile();
  const seed = 3;
  const profile: PlayerProfileV1 = {
    ...base,
    daily: {
      ...base.daily,
      active: {
        version: 1, dailyDateKey: '2026-09-14', seed,
        game: { version: 1, seed, snapshot: wonSnapshot(seed), history: { version: 1, entries: [] } },
        moves: 42, activeMs: 1234, updatedAtMs: 5000,
      },
    },
  };
  const repo = await ProfileRepository.open(new MemoryProfileStore(profile));
  const session = DailySessionController.resume({
    repository: repo, catalog: catalog(), todayKey: '2026-09-14',
    calendarDateKeyNow: () => '2026-09-14', timerNow: () => 9999, wallNow: () => 9999,
  });
  assert.equal(session.viewState.won, true);
  const settlement = await session.settleWin();
  assert.equal(settlement.coinsGranted, 15);
  assert.equal(repo.current.daily.active, null);
  const again = await session.settleWin();
  assert.deepEqual(again, settlement);
  assert.equal(repo.current.coins, settlement.profile.coins);
});


test('Daily resume settles initial automatic moves that were saved before deal animation finished', async () => {
  const store = new MemoryProfileStore();
  const repo = await ProfileRepository.open(store);
  await DailySessionController.startToday({
    repository: repo,
    catalog: catalog(),
    todayKey: '2026-09-12',
    calendarDateKeyNow: () => '2026-09-12',
    timerNow: () => 0,
    wallNow: () => 0,
  });
  assert.equal(repo.current.daily.active?.game.snapshot.flowerFoundation, null);
  assert.deepEqual(repo.current.daily.active?.game.snapshot.foundations.bamboo, []);

  const reopenedRepo = await ProfileRepository.open(store);
  const resumed = DailySessionController.resume({
    repository: reopenedRepo,
    catalog: catalog(),
    todayKey: '2026-09-12',
    calendarDateKeyNow: () => '2026-09-12',
    timerNow: () => 100,
    wallNow: () => 100,
  });
  assert.equal(resumed.state.flowerFoundation, 'flower');
  assert.deepEqual(resumed.state.foundations.bamboo, ['bamboo-1']);
  assert.equal(resumed.viewState.moves, 0);
  await resumed.flushPersistence();
  assert.equal(reopenedRepo.current.daily.active?.game.snapshot.flowerFoundation, 'flower');
  assert.deepEqual(reopenedRepo.current.daily.active?.game.snapshot.foundations.bamboo, ['bamboo-1']);
});
