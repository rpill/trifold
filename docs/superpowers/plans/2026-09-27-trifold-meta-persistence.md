# Trifold Meta Persistence Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `PlayerProfileV1` runtime source of truth with a Cascade-derived Trifold meta session and a separate Trifold active-game repository, including safe one-time migration of existing progress.

**Architecture:** Introduce a Trifold-owned `MetaSave` normalized model plus Cascade-style journal/session persistence under `trifoldMeta`; read the old `trifoldPlayerProfile`/cloud envelope only as migration input. Store active Standard/Daily game snapshots separately under `trifoldActiveGame` so per-move saves never rewrite product meta.

**Tech Stack:** TypeScript 5.9, Phaser 3.90.0, browser localStorage, Yandex PlayerStorage abstraction, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

## Global Constraints

- Meta state contains no Themes/currency fields.
- Existing Standard completion, selected difficulty, Mastery, Daily results/streak inputs, tutorial/language/sound are preserved where semantics map safely.
- Unmappable legacy data resets safely; never invent progress.
- Active game payload remains `TrifoldGameSaveV1`, not Cascade Solitaire state.
- Local gameplay remains usable when cloud/platform storage fails.
- `NumericSuit 'coins'` remains untouched.

## Review Focus

- Corrupt legacy saves should fall back without blocking startup.
- Migration must not duplicate Standard/Mastery credit when legacy arrays contain duplicates.
- Active Daily and active Standard saves must not overwrite each other accidentally.
- A failed cloud flush must not lose the current local meta state or poison later writes.
- Existing saved Trifold games must restore the same seed, board state, moves, elapsed time and assisted flag.

---

### Task 1: Introduce normalized Trifold MetaSave

**Files:**
- Create: `src/meta/MetaSave.ts`
- Create: `tests/meta-save.test.ts`

**Interfaces:**
- Produces: `META_SAVE_VERSION = 1`, `StandardDifficulty`, `StandardPartition`, `MasteryRank`, `MasteryStageProgress`, `DailyRecord`, `MetaSave`, `createDefaultMetaSave()`, `normalizeMetaSave(raw)`.
- Model follows Cascade `src/meta/MetaSave.ts`, but keeps only product fields required by the approved Trifold shell.

- [ ] **Step 1: Write RED normalization/default tests**

Assert default difficulty `easy`, empty Standard completion/mastery credit arrays, empty Daily records, novice Mastery, empty futurePrestige, zero Standard streak, and no economy/theme keys.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/meta-save.test.ts`

- [ ] **Step 3: Implement normalized `MetaSave`**

Use number seeds in Trifold-facing arrays (`number[]`) to avoid gratuitous model conversion; only leaderboard/product helpers may stringify at boundaries where needed.

- [ ] **Step 4: Run test and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: add normalized Trifold meta save`

---

### Task 2: Add explicit legacy profile migration

**Files:**
- Create: `src/meta/LegacyProfileMigration.ts`
- Modify: `src/meta/profile/ProfileSchema.ts` only as a legacy reader if needed
- Test: `tests/legacy-profile-migration.test.ts`
- Fixtures: `tests/fixtures/legacy-profile-v1.ts`

**Interfaces:**
- Produces: `migrateLegacyProfile(raw: unknown): { readonly meta: MetaSave; readonly activeGame: TrifoldActiveGameSave | null; readonly preferences: LegacyPreferenceSnapshot }`.
- `LegacyPreferenceSnapshot = { language:'ru'|'en'|null; soundEnabled:boolean; tutorialCompleted:boolean }`.

- [ ] **Step 1: Write migration tests covering every approved mapping**

Cover selected difficulty, completed partitions, mastery credited seeds, onboarding wins, mastery rank/stage, futurePrestige, Daily history/results, best streak, settings/tutorial, active Standard, active Daily, and dropped economy/theme fields.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/legacy-profile-migration.test.ts`

- [ ] **Step 3: Implement migration as pure data transformation**

Prefer safe reset for any field whose semantics do not map exactly. Do not mutate input.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: migrate legacy Trifold profiles to meta state`

---

### Task 3: Create Trifold active-game save envelope and repository

**Files:**
- Create: `src/persistence/ActiveGameSave.ts`
- Create: `src/persistence/ActiveGameRepository.ts`
- Test: `tests/active-game-save.test.ts`
- Test: `tests/active-game-repository.test.ts`

**Interfaces:**
- Produces:

```ts
export const ACTIVE_GAME_SAVE_VERSION = 1 as const;
export type ActiveGameMode = 'standard' | 'daily';
export interface TrifoldActiveGameSave {
  readonly version: 1;
  readonly mode: ActiveGameMode;
  readonly seed: number;
  readonly game: TrifoldGameSaveV1;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
  readonly updatedAtMs: number;
  readonly standard?: { readonly partition: StandardPartition; readonly difficulty: StandardDifficulty };
  readonly daily?: { readonly dateKey: string; readonly kind: 'today'|'archive' };
}
export function normalizeActiveGameSave(raw: unknown): TrifoldActiveGameSave | null;
```

`ActiveGameRepository` uses key `trifoldActiveGame` and `load/save/clear` with best-effort browser storage.

- [ ] **Step 1: Write RED envelope/repository tests**

Test Standard, Daily, corrupt JSON removal, unavailable localStorage, and game seed mismatch rejection.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/active-game-save.test.ts tests/active-game-repository.test.ts`

- [ ] **Step 3: Implement normalization and repository**

Adapt Cascade repository behavior but keep Trifold payload.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: separate Trifold active-game persistence`

---

### Task 4: Port Cascade journal/operations/session under Trifold storage keys

**Files:**
- Create: `src/meta/MetaOperations.ts`
- Create: `src/meta/MetaJournal.ts`
- Create: `src/meta/MetaSession.ts`
- Test: `tests/meta-operations.test.ts`
- Test: `tests/meta-journal.test.ts`
- Test: `tests/meta-session.test.ts`

**Interfaces:**
- `MetaJournal` key prefix: `trifoldMetaJournal:`.
- `MetaSession` player-storage root key: `trifoldMeta`.
- Produces Cascade-equivalent APIs: `dispatch(operation)`, `dispatchAndFlush(operation)`, `flush()`, `replaceAndFlush(state)`, `state/status/saving/saveError/durable`.
- Operations include `set-standard-difficulty`, Standard served/failed, attempt begin/complete and Daily hint-used only if product behavior needs it; do not port Cascade modes that Trifold does not have.

- [ ] **Step 1: Port tests first from Cascade and adapt mode/seed types**

Cover pending journal replay, idempotent receipts, retry after failure, strict load retry and forced snapshot.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/meta-operations.test.ts tests/meta-journal.test.ts tests/meta-session.test.ts`

- [ ] **Step 3: Implement the pure operation reducer, durable journal and session**

Do not import Phaser or UI.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: add journaled Trifold meta session`

---

### Task 5: Bootstrap legacy migration exactly once

**Files:**
- Create: `src/meta/MetaBootstrap.ts`
- Modify: `src/meta/RuntimeServices.ts`
- Modify: `src/main.ts`
- Modify/remove after migration is complete: `src/meta/profile/ProfileRepository.ts`, `LocalProfileStore.ts`, `CloudProfileStore.ts`, `ProfileMerge.ts`, `ProfileTypes.ts`, `ProfileSchema.ts`
- Test: `tests/meta-bootstrap-migration.test.ts`
- Modify: `tests/runtime-services.test.ts`

**Interfaces:**
- Produces: `bootstrapMetaState(platformStorage, legacyLocalStorage, activeGameRepository): Promise<MetaBootstrapResult>`.
- Rule: if valid `trifoldMeta` exists, use it and do not remigrate legacy data; otherwise migrate legacy local/cloud profile once and persist normalized meta.
- Resolve `await platformStorage.scope?.()` (fallback `local`) before constructing `MetaJournal(scope)` so separate Yandex/browser identities do not share pending-operation streams.

- [ ] **Step 1: Write RED precedence/idempotency tests**

Cases: fresh install, only legacy local, only legacy cloud envelope, both legacy sources, existing new meta, corrupt legacy, retry after platform unavailable.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/meta-bootstrap-migration.test.ts tests/runtime-services.test.ts`

- [ ] **Step 3: Implement bootstrap and install `MetaSession` + `ActiveGameRepository` in RuntimeServices**

Do not delete the legacy reader until migration tests no longer need it; after wiring, old repository classes must not be runtime dependencies.

- [ ] **Step 4: Run build and persistence suite**

Run: `pnpm build`

Run: `node --experimental-strip-types --test tests/meta-save.test.ts tests/legacy-profile-migration.test.ts tests/active-game-save.test.ts tests/active-game-repository.test.ts tests/meta-operations.test.ts tests/meta-journal.test.ts tests/meta-session.test.ts tests/meta-bootstrap-migration.test.ts tests/trifold-game-save.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `refactor: migrate Trifold to separated meta and active saves`
