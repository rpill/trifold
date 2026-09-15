# Trifold Yandex Platform, Cloud, Leaderboards & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Yandex Games guest-first services: SDK lifecycle, cloud save and automatic merge, contextual auth, Daily/Streak/Mastery leaderboards, rewarded ads/payments adapters, gameplay pause, and Yandex Metrica analytics.

**Architecture:** Port the proven Cascade platform boundary instead of letting Phaser scenes call `YaGames` directly. `PlatformServices` exposes storage/auth/leaderboards/payments/ads/pause/gameplay/clock; browser development uses no-op fallbacks. `ProfileRepository` remains the local source of truth and gains a cloud-backed persistence adapter plus deterministic merge. Leaderboard encoding is pure and independently tested before any SDK call.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Yandex Games JS SDK, Yandex Metrica, existing profile/economy/Daily modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-trifold-meta-progression-design.md`

## Global Constraints

- Guest-first: first launch and full local gameplay must work without auth.
- Auth is requested contextually for cloud continuity, leaderboards, and payments where needed.
- Cloud merge is automatic; never show a local-vs-cloud destructive choice screen.
- Merge completed Standard seeds and owned themes by union; coins use max, never sum.
- Keep the more advanced consistent Mastery state; personal records keep the better result.
- Current unfinished game keeps the newer valid save.
- Release leaderboards: today's Daily, best Daily streak, Mastery/progress only.
- Standard cross-seed speed leaderboards are forbidden.
- Analytics must never be required for gameplay to function.
- No forced interstitials or gameplay banner are enabled.

---

### Task 1: Platform Service Boundary and Browser Fallback

**Files:**
- Create: `src/platform/services.ts`
- Test: `tests/platform-services.test.ts`

**Interfaces:**
- Produces: `PlatformServices`, `PlayerStorage`, `TrustedClock`, `PlatformPause`, `GameplayMarkup`, `PlatformAuth`, `PlatformLeaderboards`, `PlatformPayments`, `PlatformAds`, `createUnavailablePlatformServices()`.
- Consumed by: every later task in this plan.

- [ ] **Step 1: Write RED fallback tests**

```ts
test('unavailable services keep guest gameplay usable', async () => {
  const platform = createUnavailablePlatformServices(new MemoryStorage());
  assert.equal(platform.auth.isAuthorized(), false);
  assert.equal(platform.leaderboards.available, false);
  assert.equal(platform.payments.available, false);
  assert.equal(platform.ads.available, false);
  assert.equal(await platform.ads.showRewarded(), false);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/platform-services.test.ts
```

- [ ] **Step 3: Implement the boundary using Cascade-compatible shapes**

Use these core interfaces:

```ts
export interface PlayerStorage {
  scope(): Promise<string>;
  load(): Promise<unknown>;
  save(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface TrustedClock { nowMs(): number | null; }
export interface PlatformPause { isPaused(): boolean; subscribe(listener:(paused:boolean)=>void):()=>void; }
export interface GameplayMarkup { start(): void; stop(): void; }
export interface PlatformAuth { isAuthorized(): boolean; requestAuthorization(): Promise<boolean>; }
```

Leaderboards/payments/ads match the abstract gateways from the economy plan. `createUnavailablePlatformServices()` uses browser local storage and no-op network services.

- [ ] **Step 4: Run fallback test**

```bash
node --experimental-strip-types --test tests/platform-services.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/services.ts tests/platform-services.test.ts
git commit -m "feat: add Trifold platform service boundary"
```

---

### Task 2: Yandex Games SDK Adapter

**Files:**
- Create: `src/platform/yandex.ts`
- Create: `src/platform/GameplayActivity.ts`
- Test: `tests/yandex-platform-contract.test.ts`
- Test: `tests/gameplay-activity.test.ts`

**Interfaces:**
- Produces: `loadPlatformServices()`, concrete Yandex adapters for all `PlatformServices` members.
- Consumes: Task 1.

- [ ] **Step 1: Write adapter contract RED tests**

Use fake SDK objects to verify:
- authorized player storage calls `getData`/`setData`;
- auth calls `sdk.auth.openAuthDialog()` and refreshes player state;
- `serverTime()` feeds TrustedClock;
- rewarded ad resolves true only when `onRewarded` fired;
- payments normalize `productID`/`purchaseToken`;
- leaderboards normalize rank to 1-based display;
- `features.LoadingAPI.ready()` is called once;
- GameplayAPI start/stop is idempotent.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/yandex-platform-contract.test.ts tests/gameplay-activity.test.ts
```

- [ ] **Step 3: Implement SDK loader with safe fallback**

Follow the Cascade pattern:
- do not load `/sdk.js` during ordinary HTTP Vite development;
- initialize once behind a cached promise;
- if SDK initialization fails, return unavailable browser services rather than blocking the game;
- expose `environment.i18n.lang` when available.

- [ ] **Step 4: Implement pause events and GameplayAPI**

Listen for Yandex game API pause/resume events and combine them with browser visibility in `GameplayActivity`. Call gameplay `start` only while an active board is interactive and visible. Call gameplay `stop` on victory, blocking Settings/Rules/Shop overlay, document hidden, or scene shutdown; call `start` again only after all of those stop conditions are cleared. Keep this platform signaling separate from the domain active timer state machine.

- [ ] **Step 5: Run adapter tests**

```bash
node --experimental-strip-types --test tests/yandex-platform-contract.test.ts tests/gameplay-activity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/yandex.ts src/platform/GameplayActivity.ts tests/yandex-platform-contract.test.ts tests/gameplay-activity.test.ts
git commit -m "feat: integrate Yandex Games platform services"
```

---

### Task 3: Deterministic Local/Cloud Profile Merge

**Files:**
- Create: `src/meta/profile/ProfileMerge.ts`
- Create: `src/meta/profile/CloudProfileStore.ts`
- Modify: `src/meta/profile/ProfileRepository.ts`
- Modify: `src/meta/profile/ProfileTypes.ts`
- Test: `tests/profile-merge.test.ts`
- Test: `tests/cloud-profile-store.test.ts`

**Interfaces:**
- Produces: `mergeProfiles(local,cloud)`, `CloudProfileStore`, `ProfileRepository.connectCloud(platform)`.
- Consumes: platform player storage and validated profile schema.

- [ ] **Step 1: Add save freshness metadata before merge logic**

Active attempt types must include:

```ts
readonly updatedAtMs: number;
```

Update this timestamp on every settled persistence write using trusted platform clock when available, otherwise `Date.now()`. Parser requires a finite non-negative integer.

- [ ] **Step 2: Write merge RED tests**

Cover all approved rules:
- Standard completion sets union;
- owned themes union;
- coins = max(local, cloud), not sum;
- personal best uses `isBetterAttempt`;
- Daily history merges by date: cloud official result wins if both profiles already have an official result; otherwise keep whichever exists; personal best uses better result; `completedOnTime` is OR only when the matching completion was actually on-time in that source;
- higher Mastery rank wins; if ranks equal, each stage counter uses max capped at that rank's requirement;
- claimed reward keys union;
- future Prestige sets union;
- active Standard/Daily keeps the valid save with larger `updatedAtMs`;
- tutorial completion is OR;
- selected difficulty and active theme prefer the valid local choice; if local is invalid, use the valid cloud choice.

- [ ] **Step 3: Run and verify RED**

```bash
node --experimental-strip-types --test tests/profile-merge.test.ts
```

- [ ] **Step 4: Implement pure merge and re-parse output**

At the end of `mergeProfiles`, call `parsePlayerProfile(merged)` so impossible merged state cannot escape.

- [ ] **Step 5: Write CloudProfileStore RED tests**

Cloud storage writes one envelope:

```ts
interface CloudEnvelopeV1 {
  readonly trifoldProfileVersion: 1;
  readonly profile: PlayerProfileV1;
  readonly savedAtMs: number;
}
```

Invalid/missing cloud payload behaves as no cloud profile, never as destructive reset.

- [ ] **Step 6: Implement connectCloud flow**

On successful authorization:
1. load local repository state;
2. load cloud envelope;
3. merge if cloud exists;
4. save unified profile locally;
5. save unified profile to cloud with flush;
6. switch repository future writes to local+cloud fan-out.

A cloud write failure leaves the local committed profile intact and retryable.

- [ ] **Step 7: Run tests**

```bash
node --experimental-strip-types --test tests/profile-merge.test.ts tests/cloud-profile-store.test.ts tests/profile-repository.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/meta/profile tests/profile-merge.test.ts tests/cloud-profile-store.test.ts
git commit -m "feat: merge guest and Yandex cloud progress"
```

---

### Task 4: Leaderboard Score Encoding

**Files:**
- Create: `src/leaderboards/LeaderboardConfig.ts`
- Test: `tests/leaderboard-config.test.ts`

**Interfaces:**
- Produces: technical names and encode/decode functions for Daily, Streak, Mastery.
- Consumed by: LeaderboardService.

- [ ] **Step 1: Write exact Daily encoding RED tests**

Use constants:

```ts
const DAILY_DAY_SCALE = 1_000_000_000_000;
const DAILY_TIME_SCALE = 100_000_000; // 27h 46m 40s active-time bound
```

Daily schedule offset is `0..7304`. Within a date:

```ts
composite = moves * DAILY_TIME_SCALE + activeMs;
withinDay = DAILY_DAY_SCALE - 1 - composite;
score = (dailyOffset + 1) * DAILY_DAY_SCALE + withinDay;
```

Test:
- fewer moves => larger Yandex score regardless of time;
- equal moves + faster time => larger score;
- every score for offset N is greater than every valid score for N-1, so one technical leaderboard can be reused daily;
- `dailyOffset=7304`, `moves=9999`, `activeMs=99_999_999` remains `Number.isSafeInteger(score)`;
- invalid `moves <= 0`, `moves > 9999`, `activeMs <= 0`, or `activeMs >= 100_000_000` rejects.

- [ ] **Step 2: Define Streak and Mastery encoding tests**

Streak score is `bestStreak`.

Mastery score:

```ts
rankOrdinal * 1_000_000_000 + lifetimeMasteryPoints
```

where rank ordinal is Novice=1 through Grandmaster=6 and:

```ts
lifetimeMasteryPoints = uniqueMedium + 3 * uniqueHard + 5 * onTimeDaily;
```

Clamp lifetime points to `999_999_999` so rank always dominates. This naturally extends toward future Prestige while remaining v1-compatible.

- [ ] **Step 3: Run and verify RED**

```bash
node --experimental-strip-types --test tests/leaderboard-config.test.ts
```

- [ ] **Step 4: Implement config and decoders**

Technical names are constants in one file:

```ts
export const DAILY_LEADERBOARD_NAME = 'trifolddaily';
export const STREAK_LEADERBOARD_NAME = 'trifoldstreak';
export const MASTERY_LEADERBOARD_NAME = 'trifoldmastery';
```

These names must be created identically in the Yandex Games draft before production submission.

- [ ] **Step 5: Run encoding test**

```bash
node --experimental-strip-types --test tests/leaderboard-config.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/leaderboards/LeaderboardConfig.ts tests/leaderboard-config.test.ts
git commit -m "feat: encode Trifold leaderboard scores"
```

---

### Task 5: Leaderboard Service and Submission Queue

**Files:**
- Create: `src/leaderboards/LeaderboardSubmissionQueue.ts`
- Create: `src/leaderboards/LeaderboardService.ts`
- Test: `tests/leaderboard-service.test.ts`
- Test: `tests/leaderboard-submission-queue.test.ts`

**Interfaces:**
- Produces: `loadDaily(todaySelection)`, `loadStreak()`, `loadMastery()`, `syncFromProfile(profile,todayKey,catalog)`.
- Consumes: PlatformLeaderboards, PlatformAuth, LeaderboardConfig.

- [ ] **Step 1: Write queue RED test**

Two overlapping submissions to the same technical board must serialize and the later value must not race ahead of the earlier network call.

- [ ] **Step 2: Implement keyed promise queue**

Keep one promise tail per technical leaderboard name.

- [ ] **Step 3: Write LeaderboardService RED tests**

Cover:
- unauthorized users can load public top entries but get `playerEntry:null`;
- unavailable service returns typed `unavailable` state;
- today's Daily loader decodes only entries whose encoded offset matches today;
- official first-win result is submitted, never Daily personal-best replay;
- local best streak submits only if server score is lower;
- Mastery submits only if local encoded score is higher;
- network errors return `skipped/error` and never block gameplay.

- [ ] **Step 4: Implement service**

Do not request authorization automatically on Home. `requestAuthorization()` is an explicit method called by leaderboard UI or cloud-enable actions.

- [ ] **Step 5: Run tests**

```bash
node --experimental-strip-types --test tests/leaderboard-submission-queue.test.ts tests/leaderboard-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/leaderboards tests/leaderboard-submission-queue.test.ts tests/leaderboard-service.test.ts
git commit -m "feat: add Daily streak and Mastery leaderboards"
```

---

### Task 6: Leaderboard Scene and Contextual Authorization

**Files:**
- Create: `src/game/scenes/LeaderboardScene.ts`
- Modify: `src/game/scenes/HomeScene.ts`
- Modify: `src/game/scenes/DailyScene.ts`
- Modify: `src/main.ts`
- Test: `tests/leaderboard-scene-wiring.test.ts`

**Interfaces:**
- Consumes: LeaderboardService and platform auth.
- Produces: three release leaderboard views and Daily placement on win.

- [ ] **Step 1: Write scene wiring RED tests**

Assert tabs/modes exist only for Daily, Streak, Mastery. No Standard Easy/Medium/Hard leaderboard strings may appear.

- [ ] **Step 2: Implement contextual auth UX**

Public leaderboard rows load for guests when API allows. Show `Войти` action for personal position/cloud sync. Clicking it calls `requestAuthorization()`, then `ProfileRepository.connectCloud()` and reloads the board.

- [ ] **Step 3: Wire Daily win placement**

After first official Daily win and successful submission, refresh today's player entry and render rank. Replay wins never trigger replacement submission.

- [ ] **Step 4: Run tests/build**

```bash
node --experimental-strip-types --test tests/leaderboard-scene-wiring.test.ts tests/leaderboard-service.test.ts
pnpm build
```

Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/LeaderboardScene.ts src/game/scenes/HomeScene.ts src/game/scenes/DailyScene.ts src/main.ts tests/leaderboard-scene-wiring.test.ts
git commit -m "feat: add Trifold leaderboard UI"
```

---

### Task 7: Payments and Rewarded Ads via Yandex Adapter

**Files:**
- Modify: `src/platform/yandex.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/scenes/ShopScene.ts`
- Test: `tests/yandex-monetization.test.ts`
- Modify test: `tests/monetization-ui-contract.test.ts`

**Interfaces:**
- Consumes: abstract gateways from economy plan.
- Produces: actual rewarded-double and coin-pack execution in Yandex production.

- [ ] **Step 1: Write RED tests for ad callback semantics**

Rewarded result is true only if `onRewarded` fired, even if `onClose(true)` later fires. `onError`/close-without-reward returns false.

- [ ] **Step 2: Write RED purchase-reconciliation test**

On startup after auth, unconsumed `trifold_coins_1800` purchases are each passed through the idempotent local reward reducer and then consumed. Unknown product ids are left untouched rather than granting coins.

- [ ] **Step 3: Implement Yandex adapter methods and startup reconciliation**

Never call `showFullscreenAdv`; the method may exist in the adapter for parity but release UI must not invoke it.

- [ ] **Step 4: Run tests**

```bash
node --experimental-strip-types --test tests/yandex-monetization.test.ts tests/monetization-ui-contract.test.ts tests/coin-pack.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/yandex.ts src/game/scenes/GameScene.ts src/game/scenes/ShopScene.ts tests/yandex-monetization.test.ts tests/monetization-ui-contract.test.ts
git commit -m "feat: connect Trifold rewarded ads and payments"
```

---

### Task 8: Yandex Metrica Analytics

**Files:**
- Create: `src/analytics/AnalyticsService.ts`
- Create: `src/analytics/YandexMetrica.ts`
- Modify: `src/main.ts`
- Modify: relevant scenes/controllers for event calls
- Test: `tests/analytics-service.test.ts`
- Test: `tests/analytics-wiring.test.ts`

**Interfaces:**
- Produces: no-op-safe analytics service and approved event names.
- Consumes: gameplay view/session results only; analytics never owns game state.

- [ ] **Step 1: Write event-schema RED tests**

Exact release event union:

```ts
type AnalyticsEvent =
  | 'first_run' | 'standard_start' | 'standard_win' | 'standard_reset'
  | 'standard_difficulty_selected' | 'daily_open' | 'daily_start' | 'daily_win'
  | 'daily_archive_open' | 'daily_archive_win' | 'streak_changed' | 'mastery_rank_up'
  | 'hint_attempt' | 'hint_success' | 'reward_double_attempt' | 'reward_double_success'
  | 'shop_open' | 'theme_purchase' | 'theme_apply' | 'coin_pack_purchase'
  | 'leaderboard_open' | 'auth_success';
```

Test no-op when counter id/API is unavailable and payload normalization for difficulty/moves/activeMs/assisted.

- [ ] **Step 2: Implement service + Metrica adapter**

Follow Cascade's pattern: queue/no-op safely until configured, never throw into gameplay, and keep event names centralized.

- [ ] **Step 3: Wire events at domain completion points**

Emit wins after settlement commit, purchases after successful grant, auth after cloud merge, and ad success only after reward callback. Do not emit sensitive profile contents or raw cloud payloads.

- [ ] **Step 4: Run analytics tests and full build**

```bash
node --experimental-strip-types --test tests/analytics-service.test.ts tests/analytics-wiring.test.ts
pnpm test
pnpm build
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analytics src/main.ts src/game/scenes src/meta tests/analytics-service.test.ts tests/analytics-wiring.test.ts
git commit -m "feat: add Trifold Yandex analytics"
```
