# Trifold Product UI & Responsive Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebind Trifold's Home, Daily, Mastery, Leaders, Settings, Win flow and gameplay HUD/table shell to the migrated product architecture while retaining Trifold's existing visual style and Phaser 3 board mechanics.

**Architecture:** Port Cascade view-model/layout/product-shell behavior where engine-independent; keep Trifold scene/components and adapt them to `TrifoldProductBridge`. The board gets Cascade responsive allocation principles, not Cascade geometry or art.

**Tech Stack:** TypeScript 5.9, Phaser 3.90.0, existing Trifold UI components, Cascade-derived product bridge/meta/platform.

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

## Global Constraints

- This is not the future visual redesign: preserve current Trifold art/style except where obsolete Themes/coin UI was already removed.
- Mobile gameplay remains landscape-first.
- Keep left special slot, three right free slots, foundations, dragon controls, tableau geometry and drag/drop semantics Trifold-specific.
- Scene code must use Phaser 3 APIs only.
- Home has Leaders as a primary product card and no duplicate leaderboard service button.
- Win flow has no coins/double-reward.

## Review Focus

- Very long tableau columns on short mobile landscape must remain playable without cards/control overlap.
- Free/special/foundation slots must stay reachable at all supported viewports.
- RU and EN strings must not clip Home/Settings/Win controls.
- Resume/new deal/difficulty behavior must stay connected to the new product bridge, not old repository calls.
- Rank-up/Daily/streak information in WinOverlay must not cover essential board controls before input is intentionally blocked.

---

### Task 1: Rebind Home view-model and scene to TrifoldProductBridge

**Files:**
- Modify: `src/ui/home/HomeViewModel.ts`
- Modify: `src/ui/scenes/HomeScene.ts`
- Modify: `src/ui/layout/HomeLayout.ts`
- Modify: `src/ui/navigation/NavigationController.ts`
- Test: `tests/home-view-model.test.ts`
- Test: `tests/home-scene-contract.test.ts`
- Test: `tests/home-layout.test.ts`

**Interfaces:**
- Home product model follows Cascade: primary resume/play, new deal/difficulty, Daily, Mastery, Leaders, How to Play, Settings.
- Consume `TrifoldProductBridge.snapshot()` only; no direct profile repository reads.

- [ ] **Step 1: Rewrite Home tests against bridge snapshot and Leaders hierarchy**
- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/home-view-model.test.ts tests/home-scene-contract.test.ts tests/home-layout.test.ts`

- [ ] **Step 3: Adapt view model/layout/scene while preserving Trifold visuals**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `refactor: bind Trifold Home to product shell`

---

### Task 2: Rebind Daily/Mastery/Leaders/Settings scenes to the new product model

**Files:**
- Modify: `src/ui/scenes/DailyScene.ts`
- Modify: `src/ui/scenes/MasteryScene.ts`
- Modify: `src/ui/scenes/LeaderboardsScene.ts`
- Modify: `src/ui/scenes/SettingsScene.ts`
- Modify: `src/ui/mastery/MasteryViewModel.ts`
- Modify: `src/ui/leaderboards/LeaderboardRowFormat.ts`
- Modify: `src/ui/daily/DailyViewModel.ts`
- Test: `tests/daily-scene-wiring.test.ts`
- Test: `tests/mastery-scene-contract.test.ts`
- Test: `tests/leaderboard-scene-wiring.test.ts`
- Test: `tests/settings-scene.test.ts`

**Interfaces:**
- Scenes use product bridge/service APIs, not legacy repository/profile structures.
- Leaders exposes Daily/Streak/Mastery only.

- [ ] **Step 1: Update tests first for migrated sources/states**
- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/daily-scene-wiring.test.ts tests/mastery-scene-contract.test.ts tests/leaderboard-scene-wiring.test.ts tests/settings-scene.test.ts`

- [ ] **Step 3: Rebind scenes and view models**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `refactor: bind Trifold meta scenes to product shell`

---

### Task 3: Replace WinOverlay economy content with Cascade product result flow

**Files:**
- Modify: `src/ui/win/StandardWinViewModel.ts`
- Modify: `src/ui/win/WinOverlay.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/standard-win-view-model.test.ts`
- Test: `tests/win-overlay-contract.test.ts`
- Modify: `tests/game-scene-wiring.test.ts`

**Interfaces:**
- Win content may show result, moves/time, Mastery/rank-up, Daily/streak and primary/secondary navigation actions.
- No reward currency/double action.

- [ ] **Step 1: Write RED content/state tests for Standard and Daily wins**
- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/standard-win-view-model.test.ts tests/win-overlay-contract.test.ts tests/game-scene-wiring.test.ts`

- [ ] **Step 3: Implement runtime-only result composition**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `refactor: align Trifold win flow with Cascade shell`

---

### Task 4: Port Cascade responsive allocation principles to Trifold ViewportLayout

**Files:**
- Modify: `src/game/view/ViewportLayout.ts`
- Modify: `src/game/view/layout.ts`
- Modify: `src/ui/game/GameHudLayout.ts`
- Modify: `src/ui/layout/UiViewport.ts`
- Modify: `src/render/HiDpiCanvas.ts` only if comparison with Cascade reveals a behavior gap
- Test: `tests/viewport-layout.test.ts`
- Test: `tests/ui-viewport.test.ts`
- Test: `tests/ui-hidpi-layout.test.ts`
- Test: `tests/hidpi-canvas.test.ts`
- Test: `tests/hidpi-layout-scale.test.ts`
- Test: `tests/hidpi-wiring.test.ts`
- Test: `tests/card-density-variants.test.ts`

**Interfaces:**
- Maintain current `ViewportLayout` Trifold slot/tableau fields, but calculate them from explicit gameplay area/control rail/safe margins like Cascade.
- Required stress presets: desktop 1920×1080, 1366×768, short desktop ~1280×640, mobile landscape 844×390 and 915×412.

- [ ] **Step 1: Add RED stress-layout tests**

Assert all slots/control bounds stay inside viewport and tableau/card overlap remains above the minimum readable threshold for short/long column fixtures.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/viewport-layout.test.ts tests/ui-viewport.test.ts tests/ui-hidpi-layout.test.ts tests/hidpi-canvas.test.ts tests/hidpi-layout-scale.test.ts tests/hidpi-wiring.test.ts tests/card-density-variants.test.ts`

- [ ] **Step 3: Adapt layout math only; do not alter game geometry semantics**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `refactor: adopt responsive product shell layout in Trifold`

---

### Task 5: Refit Game HUD controls around Trifold-specific board geometry

**Files:**
- Modify: `src/ui/game/GameHud.ts`
- Modify: `src/ui/game/GameHudViewModel.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/view/TrifoldBoardView.ts` only for allocation inputs, not rules/interactions
- Test: `tests/game-hud.test.ts`
- Test: `tests/board-interaction-contract.test.ts`
- Test: `tests/card-density-variants.test.ts`
- Test: `tests/drop-geometry.test.ts`

**Interfaces:**
- HUD contains mode/status, timer/moves, Undo, Hint, New Deal/Home as existing product requires, plus Trifold dragon controls.
- Dragon availability derives only from Trifold rules; responsive layout must not change command semantics.

- [ ] **Step 1: Add RED HUD/board coexistence tests on all viewport presets**
- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/game-hud.test.ts tests/board-interaction-contract.test.ts tests/card-density-variants.test.ts tests/drop-geometry.test.ts`

- [ ] **Step 3: Implement control allocation and scene wiring**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `refactor: integrate Trifold board with responsive product HUD`

---

### Task 6: Enforce Phaser 3-only scene compatibility and run UI/product regression

**Files:**
- Create: `tests/phaser3-product-shell-contract.test.mjs`
- Modify: `tests/package-scripts.test.mjs` if needed

**Interfaces:**
- Source contract rejects Cascade Phaser 4-only signatures/APIs identified during ports.

- [ ] **Step 1: Add source-contract checks before final UI pass**
- [ ] **Step 2: Run full UI/layout/build suite**

Run: `pnpm build`

Run: `node --experimental-strip-types --test tests/home-layout.test.ts tests/home-scene-contract.test.ts tests/daily-scene-wiring.test.ts tests/mastery-scene-contract.test.ts tests/leaderboard-scene-wiring.test.ts tests/settings-scene.test.ts tests/win-overlay-contract.test.ts tests/game-hud.test.ts tests/viewport-layout.test.ts tests/ui-hidpi-layout.test.ts tests/board-interaction-contract.test.ts`

Run: `node --test tests/phaser3-product-shell-contract.test.mjs`

Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `feat: complete Trifold product UI and responsive shell migration`
