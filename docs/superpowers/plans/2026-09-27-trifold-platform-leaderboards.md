# Trifold Platform, Preferences & Leaderboards Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Trifold's platform boundary with the current Cascade Yandex service model, port preferences and robust leaderboard submission/load behavior, and keep all SDK failures non-fatal.

**Architecture:** Adopt Cascade's `PlatformServices` contracts (`playerStorage`, `trustedClock`, auth, leaderboards, interstitial ads, pause, gameplay, ready), adapt Yandex SDK implementation to Trifold, then use a Trifold-specific leaderboard config with Cascade's service/queue semantics.

**Tech Stack:** TypeScript 5.9, Phaser 3.90.0, Yandex Games SDK, browser localStorage, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

## Global Constraints

- No payments, purchases, rewarded-video economy or rewarded Hint.
- Optional SDK methods fail soft; local gameplay continues.
- Technical leaderboard names are `trifolddaily`, `trifoldstreak`, `trifoldmastery` unless deployment configuration explicitly changes them.
- No Standard leaderboard is introduced silently.
- Preferences preserve explicit RU/EN and sound choices from migrated legacy data.
- Interstitial behavior, if enabled, is a separate Standard product policy copied from Cascade rather than reusing the removed rewarded-ad interface.

## Review Focus

- `LEADERBOARD_PLAYER_NOT_PRESENT` must return `null`, not fail the scene.
- Duplicate/rapid leaderboard writes must be coalesced and rate-limited.
- Daily score encoding must preserve Trifold ordering: moves first, elapsed time second, date isolation.
- Auth cancellation/unavailable methods must not break Home or gameplay.
- Platform pause/gameplay markup/LoadingAPI calls must tolerate missing SDK methods.

---

### Task 1: Replace PlatformServices with Cascade-style contracts

**Files:**
- Modify: `src/platform/services.ts`
- Test: `tests/platform-services.test.ts`

**Interfaces:**
- Produces: `PlayerStorage`, `TrustedClock`, `PlatformPause`, `GameplayMarkup`, `PlatformAuth`, `PlatformLeaderboardEntry`, `PlatformLeaderboards`, `PlatformAds`, `PlatformServices`, `createBrowserPlayerStorage()`, `createUnavailablePlatformServices()`.
- `PlatformServices` field names follow Cascade: `playerStorage`, `trustedClock`, `auth`, `leaderboards`, `ads`, `platformPause`, `gameplay`, `ready()`.

- [ ] **Step 1: Port/adapt Cascade fallback tests and verify RED**

Run: `node --experimental-strip-types --test tests/platform-services.test.ts`

- [ ] **Step 2: Implement the new contracts and browser fallback**

Use local fallback root key `trifoldPlayerData`.

- [ ] **Step 3: Run test and verify PASS**

Use step 1 command.

- [ ] **Step 4: Commit**

Commit message: `refactor: adopt Cascade platform service boundary`

---

### Task 2: Port Yandex implementation without monetization economy

**Files:**
- Modify: `src/platform/yandex.ts`
- Modify: `src/main.ts`
- Test: `tests/yandex-platform-contract.test.ts`
- Modify: `tests/gameplay-platform-wiring.test.ts`
- Modify: `tests/gameplay-activity.test.ts`

**Interfaces:**
- Produces: `loadPlatformServices(): Promise<PlatformServices>` using Cascade behavior for SDK loading, player storage, trusted clock, account-selection notification, leaderboards, fullscreen interstitial, pause/resume, GameplayAPI and LoadingAPI.

- [ ] **Step 1: Update Yandex contract tests first**

Cover HTTPS SDK loading, unavailable local dev, player-not-present leaderboard, missing ad API, pause/resume and one-shot `ready()`.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/yandex-platform-contract.test.ts tests/gameplay-platform-wiring.test.ts tests/gameplay-activity.test.ts`

- [ ] **Step 3: Adapt Cascade `platform/yandex.ts` to Phaser-agnostic Trifold startup**

No direct scene imports. No payment/rewarded code.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: port Cascade Yandex platform behavior to Trifold`

---

### Task 3: Port Preferences and migrate legacy settings

**Files:**
- Create: `src/settings/Preferences.ts`
- Modify: `src/settings/SfxController.ts`
- Modify: `src/meta/MetaBootstrap.ts`
- Test: `tests/preferences.test.ts`
- Modify: `tests/settings-scene.test.ts`

**Interfaces:**
- `Language = 'ru'|'en'`.
- Storage key: `trifoldPreferences`.
- `Preferences` API follows Cascade: getters for language/sound/how-to-play seen, `setLanguage()`, `setSoundEnabled()`, `markHowToPlaySeen()`, `subscribe()`.

- [ ] **Step 1: Port/adapt Cascade preference tests**

Cover platform-language default, explicit persisted language, sound toggle, corrupt storage, and migration from legacy Trifold settings/tutorialCompleted.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/preferences.test.ts tests/settings-scene.test.ts`

- [ ] **Step 3: Implement Preferences and bootstrap import of legacy choices**

Legacy import occurs only when no explicit `trifoldPreferences` value exists.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: add Cascade-style Trifold preferences`

---

### Task 4: Adapt Trifold leaderboard config to Cascade product model

**Files:**
- Modify: `src/leaderboards/LeaderboardConfig.ts`
- Test: `tests/leaderboard-config.test.ts`

**Interfaces:**
- Produces `GlobalLeaderboardMode = 'daily'|'streak'|'mastery'`.
- Produces `getLeaderboardName(mode)`, Daily encode/decode, streak encode/decode, Mastery encode/decode, `lifetimeMasteryPoints(meta)`.
- Keep technical names `trifolddaily`, `trifoldstreak`, `trifoldmastery`.
- Lifetime points: Easy 1, Medium 2, Hard 3, on-time Daily 2, based on unique credited inputs.

- [ ] **Step 1: Rewrite tests around MetaSave rather than PlayerProfileV1**

Test score monotonicity, round-trip, bounds and uniqueness.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/leaderboard-config.test.ts`

- [ ] **Step 3: Implement config/encoding against `MetaSave`**

Preserve Trifold Daily moves-then-time ordering.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `refactor: align Trifold leaderboard scoring with product meta`

---

### Task 5: Port Cascade LeaderboardService and submission queue semantics

**Files:**
- Modify: `src/leaderboards/LeaderboardSubmissionQueue.ts`
- Modify: `src/leaderboards/LeaderboardService.ts`
- Test: `tests/leaderboard-submission-queue.test.ts`
- Test: `tests/leaderboard-service.test.ts`

**Interfaces:**
- `LeaderboardSubmissionQueue.enqueue(technicalName, score, policy?: 'max'|'latest'): Promise<void>` with default 1100 ms interval.
- `LeaderboardService` exposes `available`, `authorized`, `requestAuthorization()`, `load(mode,dailyId?)`, `syncDailyBest()`, `syncDailyStreak()`, `syncMasteryScore()`.
- No Standard sync method unless a later product decision adds a Standard leaderboard.

- [ ] **Step 1: Port queue/service tests before implementation**

Cover coalescing, rate limiting, no-own-entry, unavailable/auth states, malformed rows and soft-failure sync.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/leaderboard-submission-queue.test.ts tests/leaderboard-service.test.ts`

- [ ] **Step 3: Implement adapted service/queue**

Do not let SDK errors throw through product UI load paths.

- [ ] **Step 4: Run and verify PASS**

Use step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat: port Cascade leaderboard service to Trifold`

---

### Task 6: Port Standard interstitial controller as an isolated policy

**Files:**
- Create: `src/ads/StandardAdController.ts`
- Test: `tests/standard-ad-controller.test.ts`
- Modify later consumer only when product behavior plan wires fresh Standard deal boundaries.

**Interfaces:**
- `beforeFreshStandardDeal(): Promise<void>`.
- Policy copied from Cascade: every 3rd fresh Standard deal, 2-minute cooldown, only if interstitial API is available; errors are swallowed and analytics records outcome.

- [ ] **Step 1: Write RED policy tests**

Cover counts 1/2/3, cooldown, unavailable ads and exception.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/standard-ad-controller.test.ts`

- [ ] **Step 3: Implement controller without scene dependencies**

- [ ] **Step 4: Run and verify PASS**

- [ ] **Step 5: Run build + platform/leaderboard suite**

Run: `pnpm build`

Run: `node --experimental-strip-types --test tests/platform-services.test.ts tests/yandex-platform-contract.test.ts tests/preferences.test.ts tests/leaderboard-config.test.ts tests/leaderboard-submission-queue.test.ts tests/leaderboard-service.test.ts tests/standard-ad-controller.test.ts`

- [ ] **Step 6: Commit**

Commit message: `feat: complete Trifold platform and leaderboard foundation`
---

### Task 7: Align analytics service and product wiring with Cascade

**Files:**
- Modify: `src/analytics/AnalyticsService.ts`
- Modify: `src/analytics/YandexMetrica.ts`
- Modify: `src/main.ts`
- Modify: product-event call sites introduced by plans 3-5 as needed
- Test: `tests/analytics-service.test.ts`
- Test: `tests/analytics-wiring.test.ts`

**Interfaces:**
- Analytics remains fail-soft and rendering-agnostic.
- Remove shop/theme/coin-purchase/double-reward events.
- Keep stable product/game events only: first run, Standard start/win, Daily start/win, rank-up, leaderboard/auth/ad outcomes where already supported by the Cascade donor.

- [ ] **Step 1: Rewrite event-contract tests before implementation**

Assert removed economy events are absent and sink exceptions never escape into gameplay.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/analytics-service.test.ts tests/analytics-wiring.test.ts`

- [ ] **Step 3: Port/adapt Cascade analytics wiring without UI/render imports**

- [ ] **Step 4: Run analytics tests and final platform build**

Run: `node --experimental-strip-types --test tests/analytics-service.test.ts tests/analytics-wiring.test.ts`

Run: `pnpm build`

- [ ] **Step 5: Commit**

Commit message: `refactor: align Trifold analytics with product shell`

