# Trifold Meta Core, Standard & Mastery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the persistent player profile, resumable Standard sessions, active-time/move tracking, difficulty-aware verified deal selection, idempotent rewards, and the six-rank Mastery progression.

**Architecture:** Keep `TrifoldGame` as the authoritative rules engine and add a separate meta layer around it. Pure domain modules own profile mutations, deal selection, Mastery, rewards, and attempt metrics; Phaser scenes only render state and dispatch actions. Persist a versioned profile after every settled player action and every reward mutation so Continue is crash-safe.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, browser `localStorage`, Node test runner, existing `VerifiedDealCatalog` and `TrifoldGame`.

**Spec:** `docs/superpowers/specs/2026-09-14-trifold-meta-progression-design.md`

## Global Constraints

- Standard exposes Easy / Medium / Hard and never locks a difficulty by rank.
- First 5 normal-flow Standard wins use unseen onboarding seeds; an explicit Medium/Hard selection bypasses onboarding for that deal.
- New Standard deals prefer seeds never completed in that difficulty while unused verified seeds remain.
- Undo never decreases move count; automatic moves count 0; a moved sequence counts as 1 decision.
- Timer measures active play only and pauses on hidden/background state and blocking overlays.
- Mastery ranks are Novice, Player, Tactician, Expert, Master, Grandmaster with stage-local requirements from the approved spec.
- Assisted Standard wins receive first-completion base coins but do not advance Mastery or Standard official personal records.
- First-completion, rank-up, and other coin grants must be idempotent.
- Persistence must retain enough history for future Prestige reconstruction.
- No generic XP account level and no large Statistics screen.

---

### Task 1: Versioned Local Player Profile

**Files:**
- Create: `src/meta/profile/ProfileTypes.ts`
- Create: `src/meta/profile/ProfileSchema.ts`
- Create: `src/meta/profile/LocalProfileStore.ts`
- Test: `tests/profile-schema.test.ts`
- Test: `tests/local-profile-store.test.ts`

**Interfaces:**
- Produces: `PlayerProfileV1`, `createDefaultProfile()`, `parsePlayerProfile(raw)`, `LocalProfileStore.load()`, `LocalProfileStore.save(profile)`.
- Consumed by: every later task in this plan and all later Daily/economy/platform plans.

- [ ] **Step 1: Write failing profile schema tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';

test('default profile is guest-ready and owns only the base theme', () => {
  const profile = createDefaultProfile();
  assert.equal(profile.version, 1);
  assert.equal(profile.selectedStandardDifficulty, 'easy');
  assert.deepEqual(profile.completedStandard, { onboarding: [], easy: [], medium: [], hard: [] });
  assert.equal(profile.mastery.rank, 'novice');
  assert.equal(profile.coins, 0);
  assert.deepEqual(profile.ownedThemeIds, ['base']);
  assert.equal(profile.activeStandard, null);
});

test('parser rejects unknown profile versions instead of silently guessing', () => {
  assert.throws(() => parsePlayerProfile({ version: 99 }), /profile version/i);
});
```

- [ ] **Step 2: Run the new schema test and verify RED**

Run:

```bash
node --experimental-strip-types --test tests/profile-schema.test.ts
```

Expected: FAIL because `ProfileSchema.ts` does not exist.

- [ ] **Step 3: Implement exact v1 profile types and defaults**

Use the following domain shape as the persistence contract:

```ts
export type StandardDifficulty = 'easy' | 'medium' | 'hard';
export type StandardPartition = 'onboarding' | StandardDifficulty;
export type MasteryRank = 'novice' | 'player' | 'tactician' | 'expert' | 'master' | 'grandmaster';

export interface AttemptRecord {
  readonly moves: number;
  readonly activeMs: number;
}

export interface MasteryStageProgress {
  readonly anyWins: number;
  readonly mediumWins: number;
  readonly hardWins: number;
  readonly onTimeDailyWins: number;
}

export interface PlayerProfileV1 {
  readonly version: 1;
  readonly selectedStandardDifficulty: StandardDifficulty;
  readonly completedStandard: Readonly<Record<StandardPartition, readonly number[]>>;
  readonly masteryCreditedStandardSeeds: readonly number[];
  readonly standardPersonalBests: Readonly<Record<string, AttemptRecord>>;
  readonly activeStandard: SavedStandardAttempt | null;
  readonly onboardingWins: number;
  readonly mastery: {
    readonly rank: MasteryRank;
    readonly stage: MasteryStageProgress;
  };
  readonly futurePrestige: {
    readonly mediumSeeds: readonly number[];
    readonly hardSeeds: readonly number[];
    readonly onTimeDailyDates: readonly string[];
  };
  readonly daily: DailyProfileState;
  readonly coins: number;
  readonly claimedRewardKeys: readonly string[];
  readonly ownedThemeIds: readonly string[];
  readonly activeThemeId: string;
  readonly tutorialCompleted: boolean;
  readonly settings: { readonly sfxEnabled: boolean };
}

export interface SavedStandardAttempt {
  readonly version: 1;
  readonly seed: number;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly game: TrifoldGameSaveV1;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
  readonly updatedAtMs: number;
}
```

Define `DailyProfileState` in the same file with empty/defaulted v1 fields until the Daily plan implements behavior. `SavedStandardAttempt` uses the exact interface above so later cloud merge has a freshness timestamp from day one. Parse arrays defensively, deduplicate seed arrays, reject negative balances/counters, and never coerce an unknown `version` into v1.

- [ ] **Step 4: Add LocalProfileStore tests**

```ts
import { LocalProfileStore } from '../src/meta/profile/LocalProfileStore.ts';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

test('local store round-trips a valid profile', async () => {
  const storage = new MemoryStorage();
  const store = new LocalProfileStore(storage);
  const profile = createDefaultProfile();
  await store.save({ ...profile, coins: 123 });
  assert.equal((await store.load()).coins, 123);
});

test('corrupt browser payload falls back to a fresh profile without throwing', async () => {
  const storage = new MemoryStorage();
  storage.setItem('trifoldPlayerProfile', '{bad json');
  const store = new LocalProfileStore(storage);
  assert.deepEqual(await store.load(), createDefaultProfile());
});
```

- [ ] **Step 5: Run LocalProfileStore test and verify RED**

Run:

```bash
node --experimental-strip-types --test tests/local-profile-store.test.ts
```

Expected: FAIL because `LocalProfileStore` is not implemented.

- [ ] **Step 6: Implement LocalProfileStore with memory fallback**

```ts
export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PROFILE_KEY = 'trifoldPlayerProfile';

export class LocalProfileStore {
  private memory = createDefaultProfile();
  constructor(private readonly storage: BrowserStorageLike | null = globalThis.localStorage ?? null) {}

  async load(): Promise<PlayerProfileV1> {
    try {
      const raw = this.storage?.getItem(PROFILE_KEY);
      if (raw !== null && raw !== undefined) this.memory = parsePlayerProfile(JSON.parse(raw));
    } catch {
      // Keep the last valid in-memory profile.
    }
    return structuredClone(this.memory);
  }

  async save(profile: PlayerProfileV1): Promise<void> {
    this.memory = parsePlayerProfile(profile);
    try { this.storage?.setItem(PROFILE_KEY, JSON.stringify(this.memory)); } catch {}
  }
}
```

Resolve `localStorage` through a guarded helper rather than touching it in Node at module load time.

- [ ] **Step 7: Run both profile tests**

Run:

```bash
node --experimental-strip-types --test tests/profile-schema.test.ts tests/local-profile-store.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/meta/profile tests/profile-schema.test.ts tests/local-profile-store.test.ts
git commit -m "feat: add persistent Trifold player profile"
```

---

### Task 2: Persistable Trifold Game and Undo History

**Files:**
- Modify: `src/game/model/GameHistory.ts`
- Modify: `src/game/model/TrifoldGame.ts`
- Modify: `src/game/model/types.ts`
- Test: `tests/trifold-game-save.test.ts`

**Interfaces:**
- Produces: `TrifoldGameSaveV1`, `TrifoldGame.exportSave()`, `TrifoldGame.restore(save)`.
- Consumed by: active Standard/Daily attempt persistence.

- [ ] **Step 1: Write the failing save/restore test**

```ts
test('restored game preserves board and undo transaction history', () => {
  const game = new TrifoldGame(createDeal(1));
  const legal = findFirstLegalCommand(game.state); // local test helper enumerates commands.
  assert.ok(legal);
  assert.ok(game.perform(legal));

  const saved = game.exportSave();
  const restored = TrifoldGame.restore(saved);

  assert.deepEqual(restored.snapshot(), game.snapshot());
  assert.equal(restored.canUndo, true);
  assert.ok(restored.undo());
});
```

The test helper must enumerate actual legal commands using `TrifoldRules`; do not hard-code a command that may become invalid if deal generation changes.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/trifold-game-save.test.ts
```

Expected: FAIL because export/restore APIs are missing.

- [ ] **Step 3: Add serializable history APIs**

Add to `GameHistory`:

```ts
export interface GameHistorySaveV1 {
  readonly version: 1;
  readonly entries: readonly HistoryEntry[];
}

exportSave(): GameHistorySaveV1;
restore(save: GameHistorySaveV1): void;
```

Both methods deep-clone snapshots and operation locations. `restore()` must clear current history before loading validated entries.

- [ ] **Step 4: Add `TrifoldGameSaveV1` and restore constructor**

```ts
export interface TrifoldGameSaveV1 {
  readonly version: 1;
  readonly seed: number;
  readonly snapshot: TrifoldSnapshot;
  readonly history: GameHistorySaveV1;
}
```

`TrifoldGame.restore()` must verify that `snapshot.seed === seed`, validate exactly 40 unique card ids across all zones, then restore mutable state and history. Never regenerate from seed and replay guessed actions.

- [ ] **Step 5: Add corruption tests**

Test rejection of duplicate card ids, wrong seed, wrong save version, and malformed free-cell dragon groups.

- [ ] **Step 6: Run game tests**

```bash
node --experimental-strip-types --test tests/trifold-game.test.ts tests/trifold-game-save.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/model/GameHistory.ts src/game/model/TrifoldGame.ts src/game/model/types.ts tests/trifold-game-save.test.ts
git commit -m "feat: persist Trifold game and undo state"
```

---

### Task 3: Active-Time Timer and Attempt Metrics

**Files:**
- Create: `src/meta/session/ActivePlayTimer.ts`
- Create: `src/meta/session/AttemptMetrics.ts`
- Test: `tests/active-play-timer.test.ts`
- Test: `tests/attempt-metrics.test.ts`

**Interfaces:**
- Produces: `ActivePlayTimer`, `AttemptMetrics.recordSuccessfulPlayerDecision()`, `markAssisted()`, `snapshot()`.
- Consumed by: Standard and Daily session controllers.

- [ ] **Step 1: Write timer RED tests**

```ts
test('timer accumulates only while running', () => {
  let now = 1_000;
  const timer = new ActivePlayTimer(() => now, 250);
  timer.resume();
  now = 1_400;
  timer.pause();
  now = 9_000;
  assert.equal(timer.elapsedMs, 650);
});

test('timer snapshot resumes from persisted elapsed time without counting offline wall time', () => {
  let now = 50_000;
  const timer = new ActivePlayTimer(() => now, 3_000);
  timer.resume();
  now += 500;
  timer.pause();
  assert.equal(timer.elapsedMs, 3_500);
});
```

- [ ] **Step 2: Run timer test and verify RED**

```bash
node --experimental-strip-types --test tests/active-play-timer.test.ts
```

- [ ] **Step 3: Implement timer with idempotent pause/resume**

`pause()` when already paused and `resume()` when already running must be no-ops. `finish()` permanently freezes elapsed time for the attempt.

- [ ] **Step 4: Write attempt metric RED tests**

```ts
test('successful sequence move is one decision and undo never decrements moves', () => {
  const metrics = new AttemptMetrics({ moves: 0, activeMs: 0, assisted: false });
  metrics.recordSuccessfulPlayerDecision();
  metrics.recordUndo();
  assert.equal(metrics.moves, 1);
});

test('markAssisted is sticky for the whole attempt', () => {
  const metrics = new AttemptMetrics({ moves: 0, activeMs: 0, assisted: false });
  metrics.markAssisted();
  assert.equal(metrics.assisted, true);
});
```

- [ ] **Step 5: Implement AttemptMetrics**

The controller, not individual `CardOperation`s, increments the counter once per successful `PlayerCommand`. Auto operations are therefore naturally 0 moves, and a four-card dragon collection remains exactly 1 move.

- [ ] **Step 6: Run both tests**

```bash
node --experimental-strip-types --test tests/active-play-timer.test.ts tests/attempt-metrics.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/meta/session tests/active-play-timer.test.ts tests/attempt-metrics.test.ts
git commit -m "feat: track active time and player decisions"
```

---

### Task 4: Difficulty-Aware Standard Deal Selection

**Files:**
- Create: `src/meta/standard/StandardDealPicker.ts`
- Modify: `src/game/model/DealSource.ts`
- Test: `tests/standard-deal-picker.test.ts`
- Modify test: `tests/deal-source.test.ts`

**Interfaces:**
- Produces: `pickStandardSeed(input): StandardDealSelection`.
- Consumes: `VerifiedDealCatalog.getStandardSeeds()` and profile completion/onboarding state.

- [ ] **Step 1: Write RED tests for onboarding and unseen preference**

```ts
test('normal Play uses onboarding until five Standard wins', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'easy',
    onboardingWins: 2,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    randomIndex: () => 0,
  });
  assert.equal(result.partition, 'onboarding');
});

test('explicit Hard selection bypasses onboarding immediately', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'hard',
    onboardingWins: 0,
    completedByPartition: { onboarding: [], easy: [], medium: [], hard: [] },
    randomIndex: () => 0,
  });
  assert.equal(result.partition, 'hard');
});

test('picker excludes completed seeds while unfinished seeds remain', () => {
  const result = pickStandardSeed({
    catalog: fixtureCatalog(),
    requestedDifficulty: 'easy',
    onboardingWins: 5,
    completedByPartition: { onboarding: [], easy: [21], medium: [], hard: [] },
    randomIndex: () => 0,
  });
  assert.equal(result.partition, 'easy');
  assert.equal(result.seed, 22);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/standard-deal-picker.test.ts
```

- [ ] **Step 3: Implement the pure picker**

Return:

```ts
export interface StandardDealSelection {
  readonly seed: number;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly isReplayPoolFallback: boolean;
}
```

Selection algorithm:
1. choose onboarding partition only when `onboardingWins < 5` and `requestedDifficulty === 'easy'`; Medium/Hard always bypass onboarding and remain the remembered difficulty;
2. filter out completed seeds in the selected partition;
3. onboarding selections report gameplay difficulty `easy` for rewards/Mastery while leaving the profile's remembered selected difficulty unchanged; otherwise gameplay difficulty equals the selected partition;
4. randomly choose from remaining seeds;
5. if the partition is exhausted, choose from the full partition and set `isReplayPoolFallback=true`;
6. never sample Daily.

- [ ] **Step 4: Replace random-all-standard production source behavior**

Keep `DevelopmentDealSource` for DEV, but make `VerifiedCatalogDealSource` expose partition reads rather than choosing across all Standard tiers. The meta layer becomes the only owner of difficulty selection.

- [ ] **Step 5: Run picker and existing deal source tests**

```bash
node --experimental-strip-types --test tests/standard-deal-picker.test.ts tests/deal-source.test.ts tests/verified-deal-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/meta/standard/StandardDealPicker.ts src/game/model/DealSource.ts tests/standard-deal-picker.test.ts tests/deal-source.test.ts
git commit -m "feat: select verified Standard deals by difficulty"
```

---

### Task 5: Mastery Progression and Idempotent Standard Rewards

**Files:**
- Create: `src/meta/mastery/Mastery.ts`
- Create: `src/meta/economy/CoinRewards.ts`
- Create: `src/meta/standard/StandardWinSettlement.ts`
- Test: `tests/mastery.test.ts`
- Test: `tests/coin-rewards.test.ts`
- Test: `tests/standard-win-settlement.test.ts`

**Interfaces:**
- Produces: `getMasteryRequirements(rank)`, `recordMasteryEligibleStandardWin(profile, input)`, `settleStandardWin(profile, result)`.
- Consumes: profile types and attempt result.

- [ ] **Step 1: Write exact Mastery requirement tests**

```ts
assert.deepEqual(getMasteryRequirements('novice'), { anyWins: 10, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0, rewardCoins: 100 });
assert.deepEqual(getMasteryRequirements('player'), { anyWins: 0, mediumWins: 15, hardWins: 3, onTimeDailyWins: 0, rewardCoins: 150 });
assert.deepEqual(getMasteryRequirements('tactician'), { anyWins: 0, mediumWins: 25, hardWins: 10, onTimeDailyWins: 0, rewardCoins: 200 });
assert.deepEqual(getMasteryRequirements('expert'), { anyWins: 0, mediumWins: 0, hardWins: 25, onTimeDailyWins: 5, rewardCoins: 300 });
assert.deepEqual(getMasteryRequirements('master'), { anyWins: 0, mediumWins: 0, hardWins: 60, onTimeDailyWins: 15, rewardCoins: 500 });
```

Also test Grandmaster has no promotion requirement.

- [ ] **Step 2: Run Mastery test and verify RED**

```bash
node --experimental-strip-types --test tests/mastery.test.ts
```

- [ ] **Step 3: Implement Mastery with stage reset on promotion**

A promotion must:
- advance exactly one rank;
- grant its rank reward through an idempotent reward key `mastery-rank:<newRank>`;
- reset `mastery.stage` to zeros;
- never remove lifetime future-Prestige history.

- [ ] **Step 4: Write coin reward idempotency tests**

```ts
test('claimCoinRewardOnce cannot duplicate a retry', () => {
  const p1 = claimCoinRewardOnce(createDefaultProfile(), 'standard:first:easy:42', 5);
  const p2 = claimCoinRewardOnce(p1, 'standard:first:easy:42', 5);
  assert.equal(p2.coins, 5);
  assert.equal(p2.claimedRewardKeys.length, 1);
});
```

- [ ] **Step 5: Implement `claimCoinRewardOnce`**

Reject negative/non-integer amounts. If key is already present, return the profile unchanged.

- [ ] **Step 6: Write Standard settlement RED tests**

Cover all approved rules:
- Easy/Medium/Hard first completion grants 5/7/10 coins;
- repeat grants 0;
- assisted first completion still grants base coins;
- assisted does not change Mastery and does not set an official personal best;
- any unassisted completion may create/improve the seed's personal best;
- the first unassisted completion of a seed credits Mastery once even when an earlier assisted completion already claimed the base coins;
- once `masteryCreditedStandardSeeds` contains the seed, later replays cannot credit a later Mastery stage;
- `onboardingWins` increments on each first Standard seed completion, regardless of partition, capped at 5 for onboarding selection purposes;
- Medium and Hard unique wins append to `futurePrestige` lifetime lists.

- [ ] **Step 7: Implement `settleStandardWin` as a pure profile reducer**

Use a result object:

```ts
export interface StandardWinSettlementResult {
  readonly profile: PlayerProfileV1;
  readonly baseCoinsGranted: number;
  readonly rankAdvancedTo: MasteryRank | null;
  readonly masteryAdvanced: boolean;
  readonly recordAccepted: boolean;
  readonly firstCompletion: boolean;
}
```

Do not write storage inside this pure function.

- [ ] **Step 8: Run all progression tests**

```bash
node --experimental-strip-types --test tests/mastery.test.ts tests/coin-rewards.test.ts tests/standard-win-settlement.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/meta/mastery src/meta/economy src/meta/standard/StandardWinSettlement.ts tests/mastery.test.ts tests/coin-rewards.test.ts tests/standard-win-settlement.test.ts
git commit -m "feat: add Mastery and Standard rewards"
```

---

### Task 6: Standard Session Controller and Crash-Safe Continue

**Files:**
- Create: `src/meta/standard/StandardSessionController.ts`
- Create: `src/meta/profile/ProfileRepository.ts`
- Test: `tests/standard-session-controller.test.ts`
- Test: `tests/profile-repository.test.ts`

**Interfaces:**
- Produces: `ProfileRepository`, `StandardSessionController.startNew()`, `resume()`, `perform()`, `undo()`, `setVisible()`, `setBlockingOverlayOpen()`, `settleWin()`.
- Consumes: Tasks 1-5.

- [ ] **Step 1: Write ProfileRepository transaction RED test**

```ts
test('mutate serializes profile writes and returns the committed profile', async () => {
  const store = new MemoryProfileStore(createDefaultProfile());
  const repo = await ProfileRepository.open(store);
  await Promise.all([
    repo.mutate((p) => ({ ...p, coins: p.coins + 1 })),
    repo.mutate((p) => ({ ...p, coins: p.coins + 1 })),
  ]);
  assert.equal(repo.current.coins, 2);
});
```

- [ ] **Step 2: Implement ProfileRepository with an internal promise queue**

All mutations must parse/validate before save. This is the single process-local write path used by scenes and later cloud sync.

- [ ] **Step 3: Write StandardSessionController RED tests**

Cover:
- a successful `perform(command)` increments moves once even if operations include auto moves;
- invalid command increments 0;
- `undo()` leaves moves unchanged;
- every settled action saves `activeStandard` with game save + metrics;
- visibility false pauses timer;
- blocking overlay pauses timer;
- win freezes timer, applies settlement once, and clears `activeStandard` only after settlement is committed;
- resuming does not count time spent with the application closed.

- [ ] **Step 4: Implement controller**

Use this public result shape for scene rendering:

```ts
export interface StandardSessionViewState {
  readonly seed: number;
  readonly difficulty: StandardDifficulty;
  readonly partition: 'onboarding' | StandardDifficulty;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
  readonly won: boolean;
}
```

The controller owns `TrifoldGame`, `AttemptMetrics`, and `ActivePlayTimer`. It must expose the underlying game state read-only for `TrifoldBoardView`, but Phaser must not mutate profile fields directly.

- [ ] **Step 5: Run controller/repository tests**

```bash
node --experimental-strip-types --test tests/profile-repository.test.ts tests/standard-session-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/meta/profile/ProfileRepository.ts src/meta/standard/StandardSessionController.ts tests/profile-repository.test.ts tests/standard-session-controller.test.ts
git commit -m "feat: add resumable Standard sessions"
```

---

### Task 7: Home Flow and GameScene Integration

**Files:**
- Create: `src/game/scenes/HomeScene.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/main.ts`
- Modify: `src/game/view/TrifoldBoardView.ts`
- Test: `tests/home-scene-wiring.test.ts`
- Modify test: `tests/game-scene-wiring.test.ts`
- Create: `tests/standard-flow-contract.test.ts`

**Interfaces:**
- Consumes: `ProfileRepository`, `StandardSessionController`, `VerifiedDealCatalog`.
- Produces: playable Home → Continue/Play → Standard → Win → New Deal/Home loop.

- [ ] **Step 1: Write wiring RED tests**

Assert source contracts rather than trying to boot WebGL in Node:

```ts
test('Home exposes Continue only when active Standard exists and remembers selected difficulty', async () => {
  const source = await readFile('src/game/scenes/HomeScene.ts', 'utf8');
  assert.match(source, /activeStandard/);
  assert.match(source, /selectedStandardDifficulty/);
  assert.match(source, /easy/);
  assert.match(source, /medium/);
  assert.match(source, /hard/);
});

test('GameScene no longer chooses random seeds directly', async () => {
  const source = await readFile('src/game/scenes/GameScene.ts', 'utf8');
  assert.doesNotMatch(source, /dealSource\.nextSeed/);
  assert.match(source, /StandardSessionController/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/home-scene-wiring.test.ts tests/game-scene-wiring.test.ts tests/standard-flow-contract.test.ts
```

- [ ] **Step 3: Refactor `GameScene` to accept session data**

Scene init data must distinguish `new-standard` and `resume-standard`. Construct/restore the session before creating `TrifoldBoardView`. `perform`, `collect-dragons`, and `undo` callbacks route through the controller, not directly through `TrifoldGame`.

- [ ] **Step 4: Wire active timer pause sources**

In `GameScene`:
- `document.visibilitychange` -> `session.setVisible(document.visibilityState === 'visible')`;
- blocking victory/settings/rules overlays -> `setBlockingOverlayOpen(true/false)`;
- scene shutdown -> pause before final save.

Do not pause for automatic card animations.

- [ ] **Step 5: Build Home UI with current approved v1 information**

Home must show:
- large Play button using the selected difficulty;
- difficulty selector Easy/Medium/Hard;
- Continue when `activeStandard !== null`;
- compact Mastery requirement text from `getMasteryRequirements()` and current stage counters;
- current coin balance;
- secondary placeholders only for routes delivered by later plans (`Daily`, `Shop`, `Leaderboards`, `How to Play`) and keep them disabled until their scenes exist.

The disabled later-route controls are intentional staged delivery, not hidden dead navigation.

- [ ] **Step 6: Expand Standard win overlay**

Render:
- difficulty;
- moves;
- formatted active time;
- base coins granted;
- current Mastery counters or rank-up message;
- assisted warning when applicable;
- New Deal using the same selected difficulty;
- Home.

Do not add rewarded double yet; that belongs to the economy/monetization plan.

- [ ] **Step 7: Register HomeScene before GameScene and boot to Home**

```ts
scene: [HomeScene, GameScene]
```

The tutorial plan later changes first-run routing to start directly in the tutorial onboarding deal.

- [ ] **Step 8: Run full core suite**

```bash
pnpm test
pnpm build
```

Expected: all tests PASS and Vite build exits 0.

- [ ] **Step 9: Manual verification**

Verify in desktop and mobile landscape:
1. choose each difficulty and start a deal;
2. make a move, reload, Continue, and Undo;
3. background the tab for 10 seconds and confirm active time does not increase by 10 seconds;
4. finish a first seed and confirm coins/Mastery;
5. replay the same seed through a test fixture and confirm no duplicate reward;
6. New Deal stays on the same difficulty.

- [ ] **Step 10: Commit**

```bash
git add src/game/scenes src/game/view/TrifoldBoardView.ts src/main.ts tests/home-scene-wiring.test.ts tests/game-scene-wiring.test.ts tests/standard-flow-contract.test.ts
git commit -m "feat: ship persistent Standard and Mastery flow"
```
