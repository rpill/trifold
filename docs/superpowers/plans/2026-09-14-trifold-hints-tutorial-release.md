# Trifold Runtime Hints, Tutorial & Release Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish v1 with browser-safe solver hints, rewarded hint flow, a deterministic first-run interactive tutorial, How to Play replay, and final release regression checks across persistence, Daily, economy, and platform services.

**Architecture:** Do not try to execute the offline C++ `.exe` in the browser. Port the solver search state and move ordering into a pure TypeScript runtime solver, run it in a Web Worker, and verify every returned first move against the production `TrifoldGame`. Prepare a hint before showing an ad so a user is never charged an ad view for a state the runtime solver cannot solve. Tutorial uses a frozen solver-verified onboarding seed selected by a deterministic build-time selector and a scripted sequence of verified commands/checkpoints.

**Tech Stack:** TypeScript 5.9, Web Workers, Phaser 3.90, existing C++ solver as parity oracle during tests/build, Node test runner, Yandex rewarded-ad gateway.

**Spec:** `docs/superpowers/specs/2026-09-14-trifold-meta-progression-design.md`

## Global Constraints

- Hints exist only in Standard; Daily has no hint control or hint API.
- One rewarded ad reveals exactly one next decision; the game never executes that hinted move automatically.
- First revealed hint makes the whole Standard attempt `assisted`.
- Assisted Standard wins still grant eligible first-completion base coins but do not advance Mastery or official Standard personal records.
- If no solver-backed hint is ready, do not show the rewarded ad.
- First launch starts directly on a live-table interactive tutorial, not a separate campaign.
- Tutorial covers sequence building, three free cells, automatic flower, numeric foundations/safe auto moves, dragon collection consuming a free cell, Undo, then independent completion.
- Tutorial is automatically shown once and can be replayed from How to Play.
- v1 release still has no Prestige UI, achievements, forced ads, gameplay banner, battle pass, or Statistics screen.

---

### Task 1: Pure TypeScript Runtime Solver Parity

**Files:**
- Create: `src/game/hints/HintSearchState.ts`
- Create: `src/game/hints/HintSearch.ts`
- Test: `tests/hint-search.test.ts`
- Test: `tests/hint-search-parity.test.mjs`

**Interfaces:**
- Produces: `findWinningProof(snapshot,options): HintSearchResult` where result is `SOLVED | UNDETERMINED | UNSOLVABLE` and a solved result contains `readonly PlayerCommand[]`.
- Consumes: production card ids/rules semantics and frozen solver fixtures.

- [ ] **Step 1: Write parity RED tests from known solved seeds**

For seeds `1`, `2`, and `3`:
1. construct production `TrifoldGame(createDeal(seed))`;
2. settle initial autos;
3. call TypeScript search with a deterministic node budget;
4. require `SOLVED` for at least the same frozen sample used by `verified-proof-sample.test.ts`;
5. replay returned commands through production `TrifoldGame` and require win.

Also test a mid-game snapshot produced after replaying the first 5 verified proof decisions.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/hint-search.test.ts
```

Expected: FAIL because runtime search does not exist.

- [ ] **Step 3: Port the C++ search state one-to-one**

`HintSearchState` stores compact tableau stacks, free cells, foundation ranks, flower done, and completed dragon families. Port the exact legal-decision generation and deterministic auto-move closure from `tools/trifold_solver.cpp`; do not invent a second rule interpretation.

Use an **iterative DFS stack**, not recursive JS calls, with:
- canonical state key;
- visited set/map;
- `maxNodes` default `250_000`;
- `maxDecisionDepth` `2_000`, matching the offline pathological-depth guard;
- deterministic command ordering matching the offline solver as closely as practical.

- [ ] **Step 4: Verify every solved proof through production rules**

Before returning `SOLVED`, replay the proof from the input snapshot using a production-game restore helper. If replay rejects any command or does not win, return an internal parity error in tests and `UNDETERMINED` in production.

- [ ] **Step 5: Add C++ comparison test**

`tests/hint-search-parity.test.mjs` invokes the built C++ solver on frozen seeds and compares only semantic facts:
- both solutions replay to win;
- TS first command is legal and belongs to a winning proof;
- no requirement that proofs are byte-identical.

- [ ] **Step 6: Run parity suite**

```bash
node tools/deals/build-solver.mjs
node --experimental-strip-types --test tests/hint-search.test.ts tests/hint-search-parity.test.mjs tests/verified-proof-sample.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/hints/HintSearchState.ts src/game/hints/HintSearch.ts tests/hint-search.test.ts tests/hint-search-parity.test.mjs
git commit -m "feat: add browser-safe Trifold hint solver"
```

---

### Task 2: Web Worker Hint Solver

**Files:**
- Create: `src/game/hints/HintWorker.ts`
- Create: `src/game/hints/HintWorkerClient.ts`
- Test: `tests/hint-worker-client.test.ts`

**Interfaces:**
- Produces: `HintWorkerClient.solve(snapshot,{maxNodes,timeoutMs})`.
- Consumed by: HintCoordinator.

- [ ] **Step 1: Write client RED tests with fake Worker**

Cover:
- request ids correlate concurrent responses;
- timeout resolves `UNDETERMINED` and terminates/restarts wedged worker;
- worker error resolves current requests safely;
- stale response after timeout is ignored.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/hint-worker-client.test.ts
```

- [ ] **Step 3: Implement worker protocol**

```ts
export interface HintWorkerRequest {
  readonly id: number;
  readonly snapshot: TrifoldSnapshot;
  readonly maxNodes: number;
}

export interface HintWorkerResponse {
  readonly id: number;
  readonly result: HintSearchResult;
}
```

Use `new Worker(new URL('./HintWorker.ts', import.meta.url), { type: 'module' })` in browser code. Default UI timeout is `1500ms`; worker search node cap remains `250_000` unless explicitly lower.

- [ ] **Step 4: Keep main thread rules authoritative**

The worker only proposes `PlayerCommand`; caller revalidates the first command against the current session state before display. If the board changed while the worker ran, discard the result and solve again.

- [ ] **Step 5: Run test and build**

```bash
node --experimental-strip-types --test tests/hint-worker-client.test.ts
pnpm build
```

Expected: PASS / worker chunk emitted by Vite.

- [ ] **Step 6: Commit**

```bash
git add src/game/hints/HintWorker.ts src/game/hints/HintWorkerClient.ts tests/hint-worker-client.test.ts
git commit -m "feat: run Trifold hint search off the main thread"
```

---

### Task 3: Rewarded Hint Coordinator and Board Highlight

**Files:**
- Create: `src/meta/hints/HintCoordinator.ts`
- Modify: `src/game/view/TrifoldBoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/hint-coordinator.test.ts`
- Modify test: `tests/board-interaction-contract.test.ts`
- Modify test: `tests/game-scene-wiring.test.ts`

**Interfaces:**
- Produces: `HintCoordinator.prepare()`, `revealPreparedHint()`, board `showHint(command)`/`clearHint()`.
- Consumes: HintWorkerClient, RewardedAdGateway, StandardSessionController.

- [ ] **Step 1: Write coordinator RED tests**

Required order:
1. solve current snapshot;
2. if no winning proof, return `unavailable` and **do not call ad gateway**;
3. if proof exists, expose `ready`;
4. on user confirm, call rewarded ad;
5. only after reward callback, mark session assisted and return first command;
6. if ad closes without reward, do not mark assisted and reveal nothing.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/hint-coordinator.test.ts
```

- [ ] **Step 3: Implement coordinator with state fingerprint**

Capture a canonical fingerprint before solving. Before revealing, compare with current game snapshot fingerprint. A changed board invalidates the prepared hint without showing the ad.

- [ ] **Step 4: Add board hint rendering**

For `move` command:
- pulse a source outline around the moved card/run;
- pulse a destination outline around target tableau/free cell/foundation;
- do not move any card.

For `collect-dragons`:
- pulse all currently available matching dragons;
- pulse the matching RD/GD/WD button through a scene callback.

Use a dedicated hint graphics depth and clear it after the hinted decision, New Deal, Undo, resize, or another hint request.

- [ ] **Step 5: Add Standard-only Hint control**

GameScene creates Hint only for Standard sessions. No DailyScene import/reference to HintCoordinator is permitted. Track analytics `hint_attempt` before solve/ad flow and `hint_success` only after rewarded reveal.

- [ ] **Step 6: Run tests/build**

```bash
node --experimental-strip-types --test tests/hint-coordinator.test.ts tests/board-interaction-contract.test.ts tests/game-scene-wiring.test.ts tests/daily-scene-wiring.test.ts
pnpm build
```

Expected: PASS, and Daily contract confirms no hint action.

- [ ] **Step 7: Commit**

```bash
git add src/meta/hints/HintCoordinator.ts src/game/view/TrifoldBoardView.ts src/game/scenes/GameScene.ts tests/hint-coordinator.test.ts tests/board-interaction-contract.test.ts tests/game-scene-wiring.test.ts
git commit -m "feat: add solver-backed rewarded hints"
```

---

### Task 4: Deterministically Select and Freeze a Tutorial Deal

**Files:**
- Create: `tools/tutorial/select-tutorial-deal.mjs`
- Create: `src/tutorial/TutorialScenario.ts`
- Create: `tests/tutorial-scenario.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: checked-in `TUTORIAL_SCENARIO` containing a verified onboarding seed and an ordered scripted prefix of `PlayerCommand`s/checkpoints.
- Consumes: production verified catalog, C++ solver client, production proof replay.

- [ ] **Step 1: Define machine-checkable tutorial candidate requirements**

The selector scans only the 500 onboarding seeds and accepts a candidate proof only if its first useful scripted prefix can demonstrate, in order:
1. a legal tableau-to-tableau descending alternating-suit move;
2. a legal move to a free cell;
3. an action whose resulting auto chain contains `flower`;
4. an action whose resulting auto chain contains at least one numeric foundation move;
5. a legal dragon-family collection;
6. a legal reversible player action immediately before the Undo lesson;
7. the remaining state is solver-winnable after the scripted prefix.

The selector scores candidates by shortest scripted prefix, then solver nodes, then seed and chooses the deterministic minimum.

- [ ] **Step 2: Write selector/scenario RED test**

`tests/tutorial-scenario.test.ts` imports `TUTORIAL_SCENARIO`, replays every scripted command through `TrifoldGame`, asserts each expected auto event at its checkpoint, performs the scripted Undo lesson, then confirms the remaining state has a winning proof using runtime HintSearch.

- [ ] **Step 3: Run and verify RED**

```bash
node --experimental-strip-types --test tests/tutorial-scenario.test.ts
```

Expected: FAIL because no frozen scenario exists.

- [ ] **Step 4: Implement selector and package script**

Add:

```json
"tutorial:select-deal": "node --experimental-strip-types tools/tutorial/select-tutorial-deal.mjs"
```

The script loads the production catalog assets, invokes C++ solver with the manifest slow budget, production-replays proofs, computes checkpoint predicates, and writes a deterministic TypeScript literal to `src/tutorial/TutorialScenario.ts`.

- [ ] **Step 5: Generate once and inspect the diff**

Run:

```bash
pnpm deals:build-solver
pnpm tutorial:select-deal
```

Expected: one stable `TUTORIAL_SCENARIO` seed and command/checkpoint sequence. Re-running the command without catalog changes must produce no diff.

- [ ] **Step 6: Run scenario test**

```bash
node --experimental-strip-types --test tests/tutorial-scenario.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit generated scenario and selector together**

```bash
git add tools/tutorial/select-tutorial-deal.mjs src/tutorial/TutorialScenario.ts tests/tutorial-scenario.test.ts package.json
git commit -m "feat: freeze verified Trifold tutorial deal"
```

---

### Task 5: Interactive Tutorial Controller

**Files:**
- Create: `src/tutorial/TutorialController.ts`
- Create: `src/tutorial/TutorialText.ts`
- Test: `tests/tutorial-controller.test.ts`

**Interfaces:**
- Produces: tutorial state machine, expected interaction predicates, overlay copy, completion callback.
- Consumes: `TUTORIAL_SCENARIO` and board/session events.

- [ ] **Step 1: Write state-machine RED tests**

Exact lesson ids:

```ts
type TutorialLesson =
  | 'sequence'
  | 'free-cell'
  | 'flower-auto'
  | 'foundation-auto'
  | 'dragons'
  | 'undo'
  | 'free-play'
  | 'complete';
```

Tests must prove:
- wrong player command does not advance a guided lesson;
- expected command advances exactly once;
- auto-operation checkpoint advances flower/foundation lessons only after the expected transaction settles;
- dragon lesson waits for the expected family collection;
- Undo lesson waits for actual Undo completion;
- completion sets `tutorialCompleted=true` exactly once.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/tutorial-controller.test.ts
```

- [ ] **Step 3: Implement non-blocking overlay copy**

Keep messages concise and at the top edge of the board. During guided lessons, highlight the expected source/target/control using the same pulse primitives as hints but a distinct tutorial style. Permit board input, but only the expected command advances; invalid/wrong valid moves are immediately undone/rejected by tutorial orchestration so the frozen script cannot drift.

- [ ] **Step 4: Transition to free play**

After Undo lesson, remove command restrictions and let the player finish the same live deal. Tutorial guidance is not the paid Hint feature and does not mark the attempt assisted. On the actual win, settle the frozen onboarding seed through the normal Standard settlement path as `partition='onboarding'`, `difficulty='easy'`, then set `tutorialCompleted=true`; this therefore becomes Standard onboarding win #1 with the normal one-time reward/Mastery semantics.

- [ ] **Step 5: Run controller test**

```bash
node --experimental-strip-types --test tests/tutorial-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tutorial/TutorialController.ts src/tutorial/TutorialText.ts tests/tutorial-controller.test.ts
git commit -m "feat: add interactive Trifold tutorial state machine"
```

---

### Task 6: First-Run Tutorial, How to Play, and Settings

**Files:**
- Create: `src/game/scenes/HowToPlayScene.ts`
- Create: `src/game/scenes/SettingsScene.ts`
- Modify: `src/settings/SfxController.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/scenes/HomeScene.ts`
- Modify: `src/main.ts`
- Test: `tests/tutorial-scene-wiring.test.ts`
- Test: `tests/how-to-play-scene.test.ts`
- Test: `tests/settings-scene.test.ts`

**Interfaces:**
- Consumes: TutorialController, ProfileRepository, tutorial scenario.
- Produces: first-launch direct tutorial, manual tutorial replay, static rules, and persisted SFX setting.

- [ ] **Step 1: Write first-run routing RED test**

On boot after profile load:
- `tutorialCompleted=false` -> start GameScene in `tutorial` mode directly;
- `tutorialCompleted=true` -> HomeScene;
- manual How to Play -> offers rule pages plus `Пройти обучение ещё раз` without clearing progress;
- Settings -> exposes the persisted SFX enabled toggle and close action.

- [ ] **Step 2: Implement tutorial GameScene mode**

Tutorial mode:
- uses the frozen verified onboarding seed selected in Task 4 instead of asking StandardDealPicker for a random seed;
- runs through StandardSessionController with `partition='onboarding'` and `difficulty='easy'`;
- tutorial guidance does not set `assisted`;
- on first win, normal Standard settlement records the seed, grants the eligible 5 base coins, credits the eligible Novice Mastery win, increments onboarding progress, and then persists `tutorialCompleted=true`;
- manual tutorial replay later is idempotent because that onboarding seed is already completed/credited;
- uses the normal board interactions/animations/HiDPI layout.

- [ ] **Step 3: Implement How to Play content**

Pages must cover the same six concepts in static form: alternating descending sequences, free cells, flower, numeric foundations/auto moves, dragon collection/blocking slot, Undo. Include no unsupported feature claims.

- [ ] **Step 4: Wire replay tutorial**

Manual tutorial replay starts tutorial mode but does not flip `tutorialCompleted` false; aborting replay returns Home without damaging profile.

- [ ] **Step 5: Implement Settings and SFX persistence**

`SettingsScene` reads/writes `profile.settings.sfxEnabled`. Add `SfxController.setEnabled(enabled)` and make `play()` return immediately when disabled. Opening Settings or How to Play from an active game calls `session.setBlockingOverlayOpen(true)` before launching the modal scene and restores `false` only when the modal closes; Home-opened service scenes do not create a gameplay timer.

- [ ] **Step 6: Run tests/build**

```bash
node --experimental-strip-types --test tests/tutorial-scene-wiring.test.ts tests/how-to-play-scene.test.ts tests/settings-scene.test.ts tests/tutorial-controller.test.ts tests/sfx-controller.test.ts
pnpm build
```

Expected: PASS / exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/game/scenes/HowToPlayScene.ts src/game/scenes/SettingsScene.ts src/settings/SfxController.ts src/game/scenes/GameScene.ts src/game/scenes/HomeScene.ts src/main.ts tests/tutorial-scene-wiring.test.ts tests/how-to-play-scene.test.ts tests/settings-scene.test.ts
git commit -m "feat: ship Trifold tutorial and service overlays"
```

---

### Task 7: Release Persistence Migration and Cross-System Regression

**Files:**
- Create: `tests/meta-release-regression.test.ts`
- Create: `tests/profile-idempotency-regression.test.ts`
- Modify: `src/meta/profile/ProfileSchema.ts` only if regression exposes a schema gap

**Interfaces:**
- Produces: release-level regression coverage across all approved v1 systems.
- Consumes: all previous plans.

- [ ] **Step 1: Write end-to-end domain regression test**

Without Phaser/WebGL, simulate:
1. fresh guest profile;
2. tutorial completion as onboarding Standard win #1;
3. 9 additional unique unassisted Standard wins to reach Player and receive rank reward once;
4. reload profile after every third mutation;
5. Daily on-time win and replay with better personal best while official result remains first;
6. archive win pays 5 and cannot repair streak;
7. buy/apply one theme;
8. merge with a cloud profile and confirm coins use max, sets union;
9. re-run all settlement functions and confirm no duplicate coin grants.

- [ ] **Step 2: Write retry/crash idempotency test**

For each reward class—Standard first win, Daily first win, Mastery rank, reward double, theme purchase, coin pack—apply the same logical event twice after serialize/parse round-trip and assert balance/ownership change only once.

- [ ] **Step 3: Run domain regression**

```bash
node --experimental-strip-types --test tests/meta-release-regression.test.ts tests/profile-idempotency-regression.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the full automated release gate**

```bash
pnpm test
pnpm build
pnpm deals:report
```

Expected:
- all tests pass;
- Vite build exits 0;
- deal report still says `verifiedCount=47305` and `status=READY_TO_SHIP`.

Do not regenerate deal catalog as part of ordinary meta release verification.

- [ ] **Step 5: Manual release matrix**

Verify both desktop and mobile landscape:
- first-run tutorial and replay tutorial;
- Standard Easy/Medium/Hard + Continue after reload;
- timer pauses on background, settings/rules/shop, rewarded ad;
- move count remains monotonic through Undo;
- Hint never appears in Daily;
- Daily first result, replay, archive, streak rollover;
- Shop buy/apply and theme contract (faces/geometry unchanged);
- rewarded Standard hint and reward double;
- guest play without SDK;
- contextual auth, cloud merge, three leaderboards;
- 1,800-coin purchase and purchase retry recovery;
- analytics failures do not break gameplay.

- [ ] **Step 6: Commit final regression gate**

```bash
git add tests/meta-release-regression.test.ts tests/profile-idempotency-regression.test.ts src/meta/profile/ProfileSchema.ts
git commit -m "test: lock Trifold v1 meta release behavior"
```
