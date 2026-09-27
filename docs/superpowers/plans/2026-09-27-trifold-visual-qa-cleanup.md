# Trifold Visual QA & Final Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable declarative DEV/Visual QA harness for Trifold, capture a stable migrated-product baseline, then remove all truly dead economy/theme/legacy code and assets.

**Architecture:** Fixtures inject production data/services into real scenes; a declarative scenario catalog selects state + viewport + optional interaction; browser tooling captures screenshots, manifests, errors, galleries and optional dim simulations. No QA-only clone layouts are allowed.

**Tech Stack:** TypeScript 5.9, Phaser 3.90.0, Vite, Node tools, browser automation already available/selected by the project when implementation begins.

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

## Global Constraints

- Build QA only after the migrated product shell is stable.
- Fixtures must execute production scenes/components with injected state/services.
- Cover desktop and mobile landscape, including at least one short-height stress viewport.
- Future visual style is not part of this plan.
- Final cleanup may delete only files with no runtime/tool/test/package references.

## Review Focus

- A fixture must not accidentally persist into the player's normal local/cloud profile.
- Interaction scenarios must wait for a stable scene before capture rather than relying on arbitrary sleeps alone.
- Browser/page errors must fail the capture run and appear in the manifest.
- Mobile landscape captures must use touch-primary behavior where the runtime branches on input mode.
- Cleanup searches must preserve the legitimate gameplay token `coins` and approved docs/specs.

---

### Task 1: Add Visual QA scenario types and viewport presets

**Files:**
- Create: `src/dev/visual-qa/VisualQaCatalog.ts`
- Create: `src/dev/visual-qa/VisualQaMode.ts`
- Create: `src/dev/visual-qa/viewportPresets.ts`
- Test: `tests/visual-qa-catalog.test.ts`
- Test: `tests/visual-qa-mode.test.ts`

**Interfaces:**

```ts
export interface VisualQaScenario {
  readonly id: string;
  readonly scene: string;
  readonly fixture: string;
  readonly viewports: readonly string[] | 'all';
  readonly interactions?: readonly VisualQaInteraction[];
  readonly ready?: string;
}
```

Viewport presets include `1920x1080`, `1366x768`, `1280x640`, `844x390-touch`, `915x412-touch`.

- [ ] **Step 1: Write RED catalog validation tests**

Reject duplicate IDs, unknown fixture/viewport references and malformed interactions.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/visual-qa-catalog.test.ts tests/visual-qa-mode.test.ts`

- [ ] **Step 3: Implement scenario/preset registry and QA mode query parsing**

QA mode must be impossible to enable accidentally in production without the explicit dev/query gate chosen by implementation.

- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `feat: add declarative Trifold visual QA catalog`

---

### Task 2: Add production-scene fixtures

**Files:**
- Create: `src/dev/visual-qa/fixtures/home.ts`
- Create: `src/dev/visual-qa/fixtures/game.ts`
- Create: `src/dev/visual-qa/fixtures/daily.ts`
- Create: `src/dev/visual-qa/fixtures/mastery.ts`
- Create: `src/dev/visual-qa/fixtures/leaderboard.ts`
- Create: `src/dev/visual-qa/fixtures/settings.ts`
- Create: `src/dev/visual-qa/fixtures/index.ts`
- Test: `tests/visual-qa-fixtures.test.ts`

**Interfaces:**
- Each fixture returns injected `RuntimeServices`/MetaSave/active-save/catalog/platform state without altering real storage.
- Required scenarios include Home fresh/progress, game short/long columns, free cells full, each dragon family ready, auto-collect available, hint, win, Daily unsolved/solved/replay/archive, Mastery novice/mid/master/rank-up, leaderboard loading/own/empty/unavailable, Settings RU/EN.

- [ ] **Step 1: Write fixture determinism/isolation tests**
- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/visual-qa-fixtures.test.ts`

- [ ] **Step 3: Implement fixtures using production constructors/services**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `feat: add deterministic Trifold visual QA fixtures`

---

### Task 3: Add declarative interaction registry

**Files:**
- Create: `src/dev/visual-qa/interactions/index.ts`
- Modify: `src/dev/visual-qa/VisualQaCatalog.ts`
- Test: `tests/visual-qa-interactions.test.ts`

**Interfaces:**
- Supported interactions at minimum: click named target, pointer drag between named targets, touch swipe, wait-for-ready marker.
- Scene/UI code exposes QA target IDs only through a dev-safe registry, not duplicated QA layouts.

- [ ] **Step 1: Write RED interaction validation tests**
- [ ] **Step 2: Run and verify RED**
- [ ] **Step 3: Implement minimal interaction registry required by current scenarios**
- [ ] **Step 4: Run and verify PASS**
- [ ] **Step 5: Commit** — `feat: add Trifold visual QA interactions`

---

### Task 4: Add screenshot capture, manifest and gallery tooling

**Files:**
- Create: `tools/visual-qa/capture.mjs`
- Create: `tools/visual-qa/gallery.mjs`
- Create: `tools/visual-qa/dim-pass.mjs`
- Modify: `package.json`
- Test: `tests/visual-qa-tooling.test.mjs`

**Interfaces:**
- Package scripts: `visual-qa:capture`, `visual-qa:gallery`, `visual-qa:dim`.
- Capture output contains screenshots plus machine-readable `manifest.json` with scenario, viewport, page errors/runtime errors and capture status.
- Gallery consumes manifest; dim-pass creates derived images and never overwrites originals.

- [ ] **Step 1: Write RED tooling contract tests**

Assert package scripts exist, manifest schema is stable, capture exits non-zero on page/runtime errors, and gallery handles partial failed runs visibly.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/visual-qa-tooling.test.mjs`

- [ ] **Step 3: Implement tooling using the project's available browser automation**

Do not add a heavyweight dependency if existing project/runtime tooling can perform capture; if a new dev dependency is unavoidable, document it in this task before install.

- [ ] **Step 4: Run tests and a small smoke capture**

Run: `pnpm visual-qa:capture -- --scenario home-fresh --viewport 844x390-touch`

Expected: one successful screenshot, zero page/runtime errors in manifest.

- [ ] **Step 5: Commit** — `feat: add Trifold visual QA screenshot tooling`

---

### Task 5: Capture migrated-product baseline and validate matrix

**Files:**
- Generate: `visual-qa/baseline/<run-id>/...`
- Create/update: `docs/visual-qa/SCENARIOS.md`
- Test: runtime capture itself

**Interfaces:**
- Baseline covers all catalog scenarios × all assigned viewports.

- [ ] **Step 1: Run full capture**

Run: `pnpm visual-qa:capture`

Expected: all catalog entries load with no page/runtime errors.

- [ ] **Step 2: Generate gallery**

Run: `pnpm visual-qa:gallery -- --input <baseline-manifest>`

- [ ] **Step 3: Run dim pass**

Run: `pnpm visual-qa:dim -- --input <baseline-manifest> --factor 0.65`

- [ ] **Step 4: Inspect critical states**

Explicitly check mobile long columns, dragons-ready controls, Daily archive/replay, Mastery rank-up, leaderboard unavailable, WinOverlay and Settings EN.

- [ ] **Step 5: Commit only source/docs, not bulky generated capture output unless repository policy explicitly wants it**

Commit message: `docs: document Trifold visual QA baseline`

---

### Task 6: Final dead-code/assets cleanup and full regression

**Files:**
- Delete only after reference search: obsolete `src/theme/*`, old economy/theme UI assets, obsolete preload entries, legacy profile runtime classes no longer used, removed monetization tests/tooling.
- Modify: `README.md`, `CURRENT_STATE.md`/project docs if present.
- Create/update: `tests/remove-themes-coins-contract.test.mjs`

**Interfaces:**
- No reachable runtime/tooling references to removed economy/theme concepts.
- Legitimate gameplay `coins` suit remains.

- [ ] **Step 1: Search references before deleting**

Search `src`, `tests`, `tools`, preload/asset manifests and package scripts for each candidate file/symbol. Exclude docs that intentionally describe the migration history.

- [ ] **Step 2: Delete only zero-reference runtime assets/files and update preload**
- [ ] **Step 3: Run source-contract cleanup test**

Run: `node --test tests/remove-themes-coins-contract.test.mjs`

- [ ] **Step 4: Run full project suite**

Run: `pnpm build`

Run: `pnpm test`

Expected: PASS with no intentionally ignored failures.

- [ ] **Step 5: Run final full Visual QA capture**

Run: `pnpm visual-qa:capture`

Expected: all scenarios captured, zero page/runtime errors.

- [ ] **Step 6: Commit**

Commit message: `chore: finish Trifold product-shell migration cleanup`
