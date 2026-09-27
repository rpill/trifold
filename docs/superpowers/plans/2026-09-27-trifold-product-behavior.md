# Trifold Product Behavior Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Standard, Daily, Mastery, progression, ranking and Hint behavior onto the Cascade-derived product model while keeping Trifold game rules/deals intact.

**Architecture:** Pure settlement functions mutate `MetaSave`; session controllers own Trifold game/timer/active-save state and dispatch product operations at lifecycle boundaries. A small `TrifoldProductBridge` becomes the UI-facing facade so scenes do not couple directly to persistence/platform internals.

**Tech Stack:** TypeScript 5.9, Phaser 3.90.0, existing Trifold game/session code, Cascade-derived meta/platform foundation.

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

## Global Constraints

- Standard keeps Trifold verified catalog and Easy/Medium/Hard pools.
- Hint is free and may mark a run assisted, but never opens an ad gate.
- Daily uses Trifold verified date->seed schedule; product semantics follow Cascade first-result/on-time/replay/streak policy.
- Today/date selection uses `PlatformServices.trustedClock.nowMs()` when available and falls back to local wall time only when trusted time is unavailable.
- Mastery uses Cascade rank requirements and points: Easy 1, Medium 2, Hard 3, on-time Daily 2 lifetime points.
- Mastery rank progression and lifetime leaderboard points are distinct.
- Replays/duplicate settlements are idempotent.
- No product change may alter legal moves, auto-moves, undo semantics or deal proof behavior.

## Review Focus

- Assisted Standard/Daily runs must follow the approved ranking/Mastery policy without reintroducing coin rewards.
- A replayed Daily must not replace the first official ranked result incorrectly.
- Repeated settlement of the same Standard seed/date must not double-credit Mastery.
- Date rollover during an active Daily must preserve the current expiration/archive behavior.
- Standard fresh-deal ad hook must run only for genuinely fresh Standard starts, not resume/tutorial/Daily.

---

### Task 1: Port Standard settlement to MetaSave

**Files:**
- Modify: `src/meta/standard/StandardWinSettlement.ts`
- Modify: `src/meta/standard/StandardDealPicker.ts`
- Test: `tests/standard-win-settlement.test.ts`
- Test: `tests/standard-deal-picker.test.ts`
- Modify: `tests/standard-flow-contract.test.ts`

**Interfaces:**
- `settleStandardWin(state: MetaSave, input: { seed:number; partition:StandardPartition; difficulty:StandardDifficulty; moves:number; activeMs:number; assisted:boolean }): StandardWinSettlementResult`.
- Result includes next `MetaSave`, first-completion flag, personal-best/improvement data needed by UI, Mastery result and no currency fields.

- [ ] **Step 1: Rewrite settlement tests against MetaSave**

Cover first completion, repeat, assisted, personal-best, onboarding and difficulty-specific completion.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/standard-win-settlement.test.ts tests/standard-deal-picker.test.ts tests/standard-flow-contract.test.ts`

- [ ] **Step 3: Adapt settlement/deal picker using Cascade semantics**

Keep numeric Trifold seeds/catalog access.

- [ ] **Step 4: Run and verify PASS**

- [ ] **Step 5: Commit**

Commit message: `refactor: move Trifold Standard settlement to product meta`

---

### Task 2: Port Mastery rules and lifetime points

**Files:**
- Modify: `src/meta/mastery/Mastery.ts`
- Create: `src/meta/mastery/MasteryPoints.ts`
- Test: `tests/mastery.test.ts`
- Create: `tests/mastery-points.test.ts`

**Interfaces:**
- Port Cascade rank requirements exactly.
- `recordMasteryEligibleStandardWin(state,{seed,difficulty})` and `recordMasteryEligibleDailyWin(state,dateKey,onTime=true)` return `{ state, masteryAdvanced, rankAdvancedTo }`.
- `STANDARD_MASTERY_POINTS = { easy:1, medium:2, hard:3 }`, `ON_TIME_DAILY_MASTERY_POINTS = 2`.

- [ ] **Step 1: Rewrite Mastery tests with no rank coin rewards**

Include duplicate seed/date idempotency and all rank transitions.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/mastery.test.ts tests/mastery-points.test.ts`

- [ ] **Step 3: Port Cascade logic to numeric Trifold seed types**

- [ ] **Step 4: Run and verify PASS**

- [ ] **Step 5: Commit**

Commit message: `refactor: adopt Cascade Mastery rules in Trifold`

---

### Task 3: Port Daily records, first-result policy, replay and streak settlement

**Files:**
- Modify: `src/meta/daily/DailyWinSettlement.ts`
- Modify: `src/meta/daily/DailyHistory.ts`
- Modify: `src/meta/daily/DailySessionController.ts`
- Modify: `src/meta/daily/DailyCalendarViewModel.ts`
- Modify: `src/ui/daily/DailyViewModel.ts`
- Test: `tests/daily-win-settlement.test.ts`
- Test: `tests/daily-history.test.ts`
- Test: `tests/daily-session-controller.test.ts`
- Test: `tests/daily-view-model.test.ts`
- Test: `tests/daily-calendar-view-model.test.ts`

**Interfaces:**
- `MetaSave.daily.records[dateKey]` is the product source of truth.
- Settlement records attempts, completion, completedOnTime, first ranking attempt/result, best moves/time and optional hint-used marker according to Cascade policy.
- Daily seed resolution remains `DailySchedule`/Trifold catalog-owned.

- [ ] **Step 1: Rewrite RED tests around first-result semantics**

Cases: first on-time win, late/archive win, replay, improved personal result, hint/assisted, trusted-clock today selection, trusted-clock unavailable fallback, date rollover, streak derivation.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/daily-win-settlement.test.ts tests/daily-history.test.ts tests/daily-session-controller.test.ts tests/daily-view-model.test.ts tests/daily-calendar-view-model.test.ts`

- [ ] **Step 3: Implement Daily settlement and session integration against MetaSession/ActiveGameRepository**

Daily active state leaves MetaSave and lives only in the active-game repository.

- [ ] **Step 4: Run and verify PASS**

- [ ] **Step 5: Commit**

Commit message: `refactor: adopt Cascade Daily product policy in Trifold`

---

### Task 4: Refactor StandardSessionController onto MetaSession + ActiveGameRepository

**Files:**
- Modify: `src/meta/standard/StandardSessionController.ts`
- Modify: `src/meta/session/ActivePlayTimer.ts`
- Modify: `src/meta/session/AttemptMetrics.ts`
- Test: `tests/standard-session-controller.test.ts`
- Test: `tests/active-play-timer.test.ts`
- Test: `tests/attempt-metrics.test.ts`
- Modify: `tests/trifold-game-save.test.ts`

**Interfaces:**
- Controller accepts `MetaSession`, `ActiveGameRepository`, catalog/deal source and clocks.
- `captureActiveAttempt()` writes `TrifoldActiveGameSave`; product MetaSave is written only at product events/settlement.
- `markAssisted()` remains available for Hint coordinator.

- [ ] **Step 1: Rewrite controller tests to assert separated persistence**

A move changes active save but not product meta; settle win clears matching active save and mutates meta once.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/standard-session-controller.test.ts tests/active-play-timer.test.ts tests/attempt-metrics.test.ts tests/trifold-game-save.test.ts`

- [ ] **Step 3: Implement controller migration**

Preserve undo/moves/timer behavior exactly.

- [ ] **Step 4: Run and verify PASS**

- [ ] **Step 5: Commit**

Commit message: `refactor: separate Standard session save from product meta`

---

### Task 5: Make Hint permanently free and product-policy aware

**Files:**
- Modify: `src/meta/hints/HintCoordinator.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/ui/game/GameHudViewModel.ts`
- Test: `tests/hint-coordinator.test.ts`
- Modify: `tests/game-scene-wiring.test.ts`
- Modify: `tests/game-hud.test.ts`

**Interfaces:**
- `prepare()` / `revealPreparedHint()` remain solver-backed.
- No ad/payment service dependency exists.
- Revealing a valid hint marks the active session assisted exactly once.

- [ ] **Step 1: Add RED free-hint wiring tests**

Assert no ad gateway is consulted and assisted status updates only when a prepared hint is revealed.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/hint-coordinator.test.ts tests/game-scene-wiring.test.ts tests/game-hud.test.ts`

- [ ] **Step 3: Remove remaining monetization-era hint branches**

- [ ] **Step 4: Run and verify PASS**

- [ ] **Step 5: Commit**

Commit message: `refactor: make Trifold hints permanently free`

---

### Task 6: Add TrifoldProductBridge and wire leaderboard/ad settlement side effects

**Files:**
- Create: `src/ui/bridge/TrifoldProductBridge.ts`
- Modify: `src/meta/RuntimeServices.ts`
- Modify: `src/main.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/product-bridge.test.ts`
- Test: `tests/product-game-start-resume-regression.test.ts`
- Test: `tests/leaderboard-product-sync.test.ts`

**Interfaces:**
- Adapt Cascade bridge naming to Trifold:
  - `snapshot()` returns MetaSave + active mode/difficulty/current Daily + leaderboard availability.
  - `resumeGame()`, `startStandard(difficulty)`, `setStandardDifficulty(difficulty)`, `startDaily(dateKey?)`.
  - leaderboard snapshot/load/authorize.
  - settings snapshot/setters.
- Fresh Standard starts call `StandardAdController.beforeFreshStandardDeal()`; resume/tutorial/Daily do not.
- Successful settlement asynchronously syncs relevant Daily/Streak/Mastery leaderboards without blocking local win flow.

- [ ] **Step 1: Write RED product-bridge and sync tests**

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/product-bridge.test.ts tests/product-game-start-resume-regression.test.ts tests/leaderboard-product-sync.test.ts`

- [ ] **Step 3: Implement bridge/runtime wiring**

No Phaser types in bridge interfaces.

- [ ] **Step 4: Run build + whole product behavior suite**

Run: `pnpm build`

Run: `node --experimental-strip-types --test tests/standard-win-settlement.test.ts tests/standard-session-controller.test.ts tests/daily-win-settlement.test.ts tests/daily-session-controller.test.ts tests/mastery.test.ts tests/mastery-points.test.ts tests/hint-coordinator.test.ts tests/product-bridge.test.ts tests/leaderboard-product-sync.test.ts tests/trifold-rules.test.ts tests/trifold-game.test.ts tests/deal-proof.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: complete Cascade-derived Trifold product behavior`
