# Trifold Daily, Archive & Streak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date-bound verified Daily deals, first-win official results, 90-day archive, on-time completion semantics, streaks, Daily persistence, and Daily UI without yet depending on Yandex leaderboards.

**Architecture:** Keep date/schedule logic pure and testable. Daily attempts reuse the core game-save and attempt-metrics infrastructure from the Standard plan, while a Daily-specific settlement reducer owns official results, archive rewards, `completedOnTime`, streak state, and Mastery Daily counters. The platform leaderboard adapter is a later plan; this plan persists everything required to submit once online services are wired.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, existing `VerifiedDealCatalog`, profile/meta modules from the Standard plan, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-trifold-meta-progression-design.md`

## Global Constraints

- Daily schedule starts `2026-01-01` and contains 7,305 verified dates.
- Today's first successful completion is the immutable official Daily result.
- Replays may improve local personal best but never replace the official first-win result.
- Daily rank order is fewer moves first, active time second.
- Undo is allowed and never subtracts committed moves.
- Hints are completely disabled in Daily.
- Archive window is today plus previous 89 calendar dates.
- Today's first completion grants 15 coins; archive first completion grants 5; replays grant 0.
- `completedOnTime=true` only when completed during its own local calendar date.
- Archive completion never repairs historical streaks and never advances Mastery Daily counters.
- Current streak remains visible throughout an unplayed current day and breaks only after that day expires uncompleted.

---

### Task 1: Calendar-Date and Daily Schedule Domain

**Files:**
- Create: `src/meta/daily/DailyDate.ts`
- Create: `src/meta/daily/DailySchedule.ts`
- Test: `tests/daily-date.test.ts`
- Test: `tests/daily-runtime-schedule.test.ts`

**Interfaces:**
- Produces: `toLocalDateKey(date)`, `dateKeyToDayNumber(key)`, `daysBetween(a,b)`, `getDailySeed(catalog,dateKey)`, `getArchiveDateKeys(todayKey,90)`.
- Consumes: `VerifiedDealCatalog.getDailySeedByOffset()` and manifest schedule metadata.

- [ ] **Step 1: Write date RED tests including DST-safe arithmetic**

```ts
test('local date key uses local calendar fields rather than UTC ISO date', () => {
  const date = new Date(2026, 8, 14, 23, 30, 0);
  assert.equal(toLocalDateKey(date), '2026-09-14');
});

test('day arithmetic is based on parsed calendar days and ignores DST hour length', () => {
  assert.equal(daysBetween('2026-03-28', '2026-03-29'), 1);
  assert.equal(daysBetween('2026-10-24', '2026-10-25'), 1);
});

test('archive contains today plus exactly previous 89 dates', () => {
  const keys = getArchiveDateKeys('2026-09-14', 90);
  assert.equal(keys.length, 90);
  assert.equal(keys[0], '2026-09-14');
  assert.equal(keys.at(-1), '2026-06-17');
});
```

- [ ] **Step 2: Run date test and verify RED**

```bash
node --experimental-strip-types --test tests/daily-date.test.ts
```

- [ ] **Step 3: Implement strict date parsing**

Parse `YYYY-MM-DD` manually, validate round-trip through `Date.UTC`, and use UTC day numbers only for arithmetic after the local date key has been determined. This avoids DST errors while preserving the player's local calendar day.

- [ ] **Step 4: Write runtime schedule RED tests**

```ts
test('2026-01-01 maps to Daily offset 0', () => {
  assert.equal(getDailySelection(fixtureCatalog(), '2026-01-01'), { dateKey: '2026-01-01', offset: 0, seed: 51 });
});

test('date outside manifest schedule is rejected', () => {
  assert.throws(() => getDailySelection(fixtureCatalog(), '2046-01-01'), /schedule/i);
});
```

- [ ] **Step 5: Implement DailySchedule using manifest metadata**

Do not hard-code the binary's first seed. Calculate offset from `catalog.metadata.dailyScheduleStart`, bounds-check against `dailyScheduleLength`, and fetch through `getDailySeedByOffset(offset)`.

- [ ] **Step 6: Run date and schedule tests**

```bash
node --experimental-strip-types --test tests/daily-date.test.ts tests/daily-runtime-schedule.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/meta/daily/DailyDate.ts src/meta/daily/DailySchedule.ts tests/daily-date.test.ts tests/daily-runtime-schedule.test.ts
git commit -m "feat: add runtime Daily schedule"
```

---

### Task 2: Daily History and Streak Semantics

**Files:**
- Create: `src/meta/daily/DailyHistory.ts`
- Modify: `src/meta/profile/ProfileTypes.ts`
- Modify: `src/meta/profile/ProfileSchema.ts`
- Test: `tests/daily-history.test.ts`

**Interfaces:**
- Produces: `DailyHistoryEntry`, `deriveCurrentStreak(history,todayKey)`, `deriveBestStreak(history)`, `mergeDailyHistoryEntry()`.
- Consumed by: Daily settlement and Home/Daily view models.

- [ ] **Step 1: Define concrete Daily history shape**

Update profile type to store:

```ts
export interface DailyHistoryEntry {
  readonly dateKey: string;
  readonly completed: boolean;
  readonly completedOnTime: boolean;
  readonly officialResult: AttemptRecord | null;
  readonly personalBest: AttemptRecord | null;
  readonly firstCompletionRewardClaimed: boolean;
}

export interface DailyProfileState {
  readonly history: Readonly<Record<string, DailyHistoryEntry>>;
  readonly active: SavedDailyAttempt | null;
  readonly bestStreak: number;
}
```

Do not persist a fragile `currentStreak` cache; derive current streak from history + today's date so midnight rollover cannot leave stale data.

- [ ] **Step 2: Write streak RED tests**

```ts
test('unplayed today preserves yesterday ending streak during the current day', () => {
  const history = entries(['2026-09-11','2026-09-12','2026-09-13']);
  assert.equal(deriveCurrentStreak(history, '2026-09-14'), 3);
});

test('missing yesterday means streak is already broken today', () => {
  const history = entries(['2026-09-11','2026-09-12']);
  assert.equal(deriveCurrentStreak(history, '2026-09-14'), 0);
});

test('archive completion does not count because completedOnTime is false', () => {
  const history = {
    '2026-09-13': completedEntry('2026-09-13', false),
    '2026-09-14': completedEntry('2026-09-14', true),
  };
  assert.equal(deriveCurrentStreak(history, '2026-09-14'), 1);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
node --experimental-strip-types --test tests/daily-history.test.ts
```

- [ ] **Step 4: Implement streak derivation**

For current streak:
1. if today is completed on time, count backward from today;
2. otherwise count backward from yesterday;
3. stop at first missing or `completedOnTime=false` date.

For best streak, scan sorted on-time completion dates and find longest consecutive day-number run.

- [ ] **Step 5: Update parser and migration defaults**

`parsePlayerProfile` validates date keys and AttemptRecord non-negative integers, discards Daily entries older/newer only when malformed—not merely because they are outside the visible 90-day window. Long-term history is required for future Prestige and best-streak reconstruction.

- [ ] **Step 6: Run profile + Daily history tests**

```bash
node --experimental-strip-types --test tests/profile-schema.test.ts tests/daily-history.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/meta/daily/DailyHistory.ts src/meta/profile/ProfileTypes.ts src/meta/profile/ProfileSchema.ts tests/daily-history.test.ts
git commit -m "feat: add Daily history and streak rules"
```

---

### Task 3: Daily Win Settlement, Rewards, and Mastery Credit

**Files:**
- Create: `src/meta/daily/DailyWinSettlement.ts`
- Modify: `src/meta/mastery/Mastery.ts`
- Test: `tests/daily-win-settlement.test.ts`
- Modify test: `tests/mastery.test.ts`

**Interfaces:**
- Produces: `settleDailyWin(profile,input): DailyWinSettlementResult`.
- Consumes: coin reward helper, streak derivation, Mastery stage reducer.

- [ ] **Step 1: Write settlement RED tests**

Cover exact behavior:

```ts
test('first on-time Daily stores immutable official result and grants 15 coins', () => {
  const result = settleDailyWin(createDefaultProfile(), {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 42,
    activeMs: 378_400,
  });
  const entry = result.profile.daily.history['2026-09-14'];
  assert.deepEqual(entry.officialResult, { moves: 42, activeMs: 378_400 });
  assert.equal(entry.completedOnTime, true);
  assert.equal(result.coinsGranted, 15);
});

test('replay can improve personal best but cannot replace official first win', () => {
  const first = settleDailyWin(createDefaultProfile(), {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 42, activeMs: 378_400,
  });
  const replay = settleDailyWin(first.profile, {
    dailyDateKey: '2026-09-14', completionDateKey: '2026-09-14', moves: 39, activeMs: 300_000,
  });
  assert.deepEqual(replay.profile.daily.history['2026-09-14'].officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(replay.profile.daily.history['2026-09-14'].personalBest, { moves: 39, activeMs: 300_000 });
  assert.equal(replay.coinsGranted, 0);
});

test('archive first completion grants 5 coins and never creates an official result or on-time Mastery credit', () => {
  const result = settleDailyWin(createDefaultProfile(), {
    dailyDateKey: '2026-09-13', completionDateKey: '2026-09-14', moves: 55, activeMs: 480_000,
  });
  const entry = result.profile.daily.history['2026-09-13'];
  assert.equal(entry.completedOnTime, false);
  assert.equal(entry.officialResult, null);
  assert.deepEqual(entry.personalBest, { moves: 55, activeMs: 480_000 });
  assert.equal(result.coinsGranted, 5);
  assert.equal(result.profile.mastery.stage.onTimeDailyWins, 0);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/daily-win-settlement.test.ts
```

- [ ] **Step 3: Implement lexicographic result comparison**

```ts
export function isBetterAttempt(a: AttemptRecord, b: AttemptRecord): boolean {
  return a.moves < b.moves || (a.moves === b.moves && a.activeMs < b.activeMs);
}
```

Use it for personal best only. Official result is write-once.

- [ ] **Step 4: Implement idempotent Daily rewards**

Reward keys:
- on-time first completion: `daily:first:<dateKey>` amount 15;
- archive first completion: same key amount 5 based on the first completion context.

Once claimed, the key can never pay a second time even if storage/cloud retries settlement.

- [ ] **Step 5: Credit Mastery only for first on-time completion**

If current rank requires Daily wins, increment `onTimeDailyWins` at most once for that date. Append date to `futurePrestige.onTimeDailyDates` uniquely regardless of current rank. Archive completion never appends to on-time history.

- [ ] **Step 6: Recompute and persist best streak after each on-time win**

Set `daily.bestStreak = max(previousBest, deriveBestStreak(history))`.

- [ ] **Step 7: Run settlement and Mastery tests**

```bash
node --experimental-strip-types --test tests/daily-win-settlement.test.ts tests/mastery.test.ts tests/coin-rewards.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/meta/daily/DailyWinSettlement.ts src/meta/mastery/Mastery.ts tests/daily-win-settlement.test.ts tests/mastery.test.ts
git commit -m "feat: settle Daily rewards and Mastery"
```

---

### Task 4: Resumable Daily Session Controller and Midnight Rollover

**Files:**
- Create: `src/meta/daily/DailySessionController.ts`
- Test: `tests/daily-session-controller.test.ts`

**Interfaces:**
- Produces: `DailySessionController.startToday()`, `startArchive(dateKey)`, `resume()`, `perform()`, `undo()`, `handleDateChange(now)`, `settleWin()`.
- Consumes: core game-save, timer/metrics, profile repository, DailySchedule, Daily settlement.

- [ ] **Step 1: Write controller RED tests**

Cover:
- today uses exact schedule seed;
- Daily moves increment exactly once per successful player command;
- undo does not decrement;
- saved active Daily restores while local date key matches;
- active today's save becomes non-resumable-today after date changes;
- archive attempts may resume only if date remains inside current 90-day archive window;
- hints are not part of the controller API;
- on win it clears active save only after profile settlement succeeds.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/daily-session-controller.test.ts
```

- [ ] **Step 3: Implement explicit mode in saved Daily attempt**

```ts
export interface SavedDailyAttempt {
  readonly version: 1;
  readonly dailyDateKey: string;
  readonly seed: number;
  readonly game: TrifoldGameSaveV1;
  readonly moves: number;
  readonly activeMs: number;
  readonly updatedAtMs: number;
}
```

No `assisted` field is necessary for Daily because hints are unavailable; parser must reject unexpected mode mismatches rather than silently treating a Standard attempt as Daily.

- [ ] **Step 4: Implement rollover behavior**

`handleDateChange(now)` compares `toLocalDateKey(now)` with active Daily date. If different, pause and persist, then report `status:'expired-today'`. The old attempt remains available through archive only if within 90 dates; otherwise it is cleared from `daily.active` without deleting history.

- [ ] **Step 5: Run controller tests**

```bash
node --experimental-strip-types --test tests/daily-session-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/meta/daily/DailySessionController.ts tests/daily-session-controller.test.ts
git commit -m "feat: add resumable Daily sessions"
```

---

### Task 5: Daily Archive View Model

**Files:**
- Create: `src/meta/daily/DailyCalendarViewModel.ts`
- Test: `tests/daily-calendar-view-model.test.ts`

**Interfaces:**
- Produces: `buildDailyCalendar(profile,todayKey,catalog): readonly DailyCalendarDay[]`.
- Consumed by: Daily scene.

- [ ] **Step 1: Write RED tests for 90-day states**

```ts
export type DailyCalendarStatus = 'today-open' | 'today-complete' | 'archive-open' | 'archive-complete-on-time' | 'archive-complete-late';
```

Test:
- exactly 90 rows;
- today first;
- on-time and late completion are distinct;
- dates before catalog start are not emitted;
- official result/personal best are surfaced as display data, not recomputed by scene.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/daily-calendar-view-model.test.ts
```

- [ ] **Step 3: Implement pure view-model builder**

Each row includes:

```ts
export interface DailyCalendarDay {
  readonly dateKey: string;
  readonly status: DailyCalendarStatus;
  readonly completedOnTime: boolean;
  readonly officialResult: AttemptRecord | null;
  readonly personalBest: AttemptRecord | null;
  readonly rewardCoinsIfFirstWin: 15 | 5 | 0;
}
```

- [ ] **Step 4: Run test**

```bash
node --experimental-strip-types --test tests/daily-calendar-view-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/meta/daily/DailyCalendarViewModel.ts tests/daily-calendar-view-model.test.ts
git commit -m "feat: model 90-day Daily archive"
```

---

### Task 6: Daily Scene, Calendar, Win Flow, and Home Status

**Files:**
- Create: `src/game/scenes/DailyScene.ts`
- Modify: `src/game/scenes/HomeScene.ts`
- Modify: `src/main.ts`
- Test: `tests/daily-scene-wiring.test.ts`
- Modify test: `tests/home-scene-wiring.test.ts`

**Interfaces:**
- Consumes: Daily session controller, calendar view model, profile repository.
- Produces: playable today's Daily + archive replay flow.

- [ ] **Step 1: Write scene wiring RED tests**

Assert that DailyScene references:
- `DailySessionController`;
- `buildDailyCalendar`;
- no hint/rewarded-hint action;
- official result and personal best separately;
- Replay after completion.

HomeScene must reference `deriveCurrentStreak` and today's completion status.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/daily-scene-wiring.test.ts tests/home-scene-wiring.test.ts
```

- [ ] **Step 3: Implement Daily entry screen**

At minimum render:
- Today's date and status;
- current streak;
- Play/Continue today;
- a scrollable/paged 90-day archive list;
- on-time vs late completion distinction;
- moves/time for completed dates.

Keep calendar rendering inside DailyScene for v1; do not create a separate campaign/Levels architecture.

- [ ] **Step 4: Reuse TrifoldBoardView for active Daily play**

Instantiate it with Daily controller callbacks. Pause timer for blocking overlays and document background exactly as Standard does. The board itself remains mode-agnostic.

- [ ] **Step 5: Implement Daily win overlay**

Show:
- official first-win moves/time;
- personal best when replay differs;
- current streak;
- 15 or 5 coin grant for first completion, otherwise 0;
- Replay;
- Home;
- a text slot for leaderboard placement that remains hidden until the platform leaderboard plan wires actual data.

Do not show rewarded ads anywhere in Daily.

- [ ] **Step 6: Wire Home Daily card**

Show current streak throughout an unplayed day, today's completion status, and Continue when today's active save exists.

- [ ] **Step 7: Register scene and run full verification**

```bash
pnpm test
pnpm build
```

Expected: PASS / exit 0.

- [ ] **Step 8: Manual date-boundary verification**

Using an injected clock in development:
1. finish yesterday on time;
2. advance to today without playing and confirm streak remains;
3. advance one more day without completion and confirm streak becomes 0;
4. finish an archived date and confirm 5 coins and `completedOnTime=false`;
5. replay today's completed Daily with a better result and confirm official result stays unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/game/scenes/DailyScene.ts src/game/scenes/HomeScene.ts src/main.ts tests/daily-scene-wiring.test.ts tests/home-scene-wiring.test.ts
git commit -m "feat: ship Daily archive and streak flow"
```
