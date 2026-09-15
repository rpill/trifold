# Trifold UI/UX & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Trifold's approved production-shaped schematic interface for desktop and mobile landscape, integrating Home, Standard HUD, Win, Daily, Mastery, Themes, Leaderboards, Settings, How to Play, Hint, and Tutorial without waiting for final art assets.

**Architecture:** Keep domain logic in the five existing meta plans and introduce a thin presentation layer made of pure responsive layout functions, reusable Phaser UI components, scene view-model adapters, and a small navigation controller. Scenes consume immutable view models and dispatch semantic actions; final art later plugs into asset keys/tokens without changing geometry or domain services.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, existing `GameScene`/`TrifoldBoardView`/`ViewportLayout`, Node test runner, browser ResizeObserver/HiDPI infrastructure already used by Trifold.

**Spec:** `docs/superpowers/specs/2026-09-14-trifold-ui-ux-design.md`

## Global Constraints

- Home geometry is frozen: desktop left brand/art ~38%, right dashboard ~55%; mobile-landscape left ~35%, right dashboard ~65%.
- Home dashboard order is always wide Continue/Play → Daily+Mastery pair → wide Themes.
- Leaderboard / How to Play / Settings are compact service actions, never primary Home list rows.
- Standard board/card/drop geometry remains owned by the existing gameplay `ViewportLayout`; UI must fit around it rather than rescale it arbitrarily.
- Desktop and mobile-landscape are two intentional compositions, not one uniformly scaled scene.
- Current visuals are schematic but must use stable asset hooks so final backgrounds, paper textures, icons, card art, badges, and theme previews can be swapped later without layout rewrites.
- Mobile touch targets must be at least 44 CSS px on the short axis after CSS scaling.
- `New Deal` and `Home` remain directly accessible from gameplay.
- Returning Home takes one action from every major routed screen.
- Settings / How to Play / Win / Tutorial / Hint are overlays, not primary routes.
- No generic vertical menu on Home.
- No UI task may duplicate Mastery, Daily, economy, cloud, leaderboard, or hint rules already owned by the corresponding domain plans.

## Cross-Plan Execution Order

Execute this plan interleaved with the existing plans:

1. UI Tasks 1–3 (foundation/navigation/Home shell).
2. Meta Core plan Tasks 1+ through Standard/Mastery domain readiness.
3. UI Tasks 4–6 (Home data binding, Standard HUD, Standard Win/Mastery presentation).
4. Daily plan, then UI Task 7.
5. Economy/Themes plan, then UI Task 8.
6. Yandex platform plan, then UI Task 9.
7. Hints/Tutorial plan, then UI Task 10.
8. UI Tasks 11–12 responsive/release regression.

---

### Task 1: Central Responsive UI Profile and Design Tokens

**Files:**
- Create: `src/ui/layout/UiViewport.ts`
- Create: `src/ui/layout/HomeLayout.ts`
- Create: `src/ui/style/UiTokens.ts`
- Test: `tests/ui-viewport.test.ts`
- Test: `tests/home-layout.test.ts`

**Interfaces:**
- Produces: `UiViewportProfile`, `resolveUiViewport(env)`, `computeHomeLayout(viewport)`, `UI_TOKENS`.
- Consumed by: every routed scene and reusable UI component.

- [ ] **Step 1: Write failing viewport classification tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';

test('1920x1080 mouse viewport uses desktop composition', () => {
  assert.equal(resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false }).profile, 'desktop');
});

test('1280x720 touch viewport uses mobile-landscape composition', () => {
  assert.equal(resolveUiViewport({ width: 1280, height: 720, touchPrimary: true }).profile, 'mobile-landscape');
});

test('844x390 touch viewport stays mobile-landscape', () => {
  assert.equal(resolveUiViewport({ width: 844, height: 390, touchPrimary: true }).profile, 'mobile-landscape');
});
```

- [ ] **Step 2: Run viewport test and verify RED**

```bash
node --experimental-strip-types --test tests/ui-viewport.test.ts
```

Expected: FAIL because `UiViewport.ts` does not exist.

- [ ] **Step 3: Implement centralized profile selection**

```ts
export type UiViewportProfile = 'desktop' | 'mobile-landscape';

export interface UiViewportEnvironment {
  readonly width: number;
  readonly height: number;
  readonly touchPrimary: boolean;
}

export interface ResolvedUiViewport extends UiViewportEnvironment {
  readonly profile: UiViewportProfile;
  readonly safeMargin: number;
  readonly uiScale: number;
}

export function resolveUiViewport(env: UiViewportEnvironment): ResolvedUiViewport {
  const mobile = env.touchPrimary && env.height <= 820;
  return {
    ...env,
    profile: mobile ? 'mobile-landscape' : 'desktop',
    safeMargin: mobile ? Math.max(12, Math.round(env.height * 0.03)) : Math.max(24, Math.round(env.height * 0.035)),
    uiScale: mobile ? Math.min(1, env.height / 720) : Math.min(1.2, env.height / 1080),
  };
}
```

No scene may implement its own `height < ...` branch after this task.

- [ ] **Step 4: Write failing Home geometry tests**

```ts
import { computeHomeLayout } from '../src/ui/layout/HomeLayout.ts';

for (const env of [
  { width: 1920, height: 1080, touchPrimary: false },
  { width: 1280, height: 720, touchPrimary: true },
]) {
  test(`home dashboard preserves hierarchy at ${env.width}x${env.height}`, () => {
    const layout = computeHomeLayout(resolveUiViewport(env));
    assert.ok(layout.brand.width < layout.dashboard.width);
    assert.equal(layout.daily.y, layout.mastery.y);
    assert.equal(layout.daily.height, layout.mastery.height);
    assert.equal(layout.continueCard.x, layout.themes.x);
    assert.equal(layout.continueCard.width, layout.themes.width);
  });
}
```

- [ ] **Step 5: Run Home layout test and verify RED**

```bash
node --experimental-strip-types --test tests/home-layout.test.ts
```

- [ ] **Step 6: Implement canonical Home rectangles**

`computeHomeLayout()` returns rectangles for `brand`, `dashboard`, `continueCard`, `daily`, `mastery`, `themes`, `serviceActions`, and `coinPill`. Desktop uses a 38/55 reference split with remaining space as margins/gutter; mobile-landscape uses 35/65. Derive rectangles from available viewport instead of literal 1920/1280 coordinates.

- [ ] **Step 7: Add schematic UI tokens**

```ts
export const UI_TOKENS = {
  color: {
    table: 0x173b39,
    paper: 0xe2d4b5,
    paperPressed: 0xcdbc99,
    ink: 0x24302e,
    mutedInk: 0x64706a,
    gold: 0xb89a54,
    danger: 0xb86262,
    overlay: 0x0d1f1e,
  },
  radius: { card: 16, panel: 20, control: 12 },
  stroke: { thin: 1, normal: 2 },
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
} as const;
```

Colors are schematic implementation defaults, not final art direction locks.

- [ ] **Step 8: Run both tests**

```bash
node --experimental-strip-types --test tests/ui-viewport.test.ts tests/home-layout.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/layout src/ui/style tests/ui-viewport.test.ts tests/home-layout.test.ts
git commit -m "feat: add responsive Trifold UI layout foundation"
```

---

### Task 2: Reusable Schematic UI Components

**Files:**
- Create: `src/ui/components/PaperPanel.ts`
- Create: `src/ui/components/ActionCard.ts`
- Create: `src/ui/components/IconButton.ts`
- Create: `src/ui/components/CoinPill.ts`
- Create: `src/ui/components/ProgressMeter.ts`
- Create: `src/ui/components/SegmentedControl.ts`
- Create: `src/ui/components/ModalShell.ts`
- Create: `src/ui/components/ScrollRegion.ts`
- Test: `tests/ui-components-contract.test.ts`

**Interfaces:**
- Produces: focused Phaser components accepting geometry/state/callbacks only.
- Consumes: `UI_TOKENS`; no component imports profile/domain services.

- [ ] **Step 1: Write source-contract RED test**

```ts
const forbidden = [
  "meta/profile",
  "DailyService",
  "MasteryService",
  "ShopService",
  "yandex",
];

for (const file of componentFiles) {
  const source = readFileSync(file, 'utf8');
  for (const needle of forbidden) assert.equal(source.includes(needle), false, `${file} imports domain ${needle}`);
}
```

Also assert every interactive component has an explicit `enabled` state and minimum-touch-size normalization hook.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/ui-components-contract.test.ts
```

- [ ] **Step 3: Implement PaperPanel and ActionCard**

`PaperPanel` draws/fills a passed rectangle and optional asset-backed texture key. `ActionCard` accepts:

```ts
interface ActionCardState {
  readonly title: string;
  readonly subtitle?: string;
  readonly emphasis?: 'normal' | 'highlight';
  readonly enabled: boolean;
  readonly progress?: { readonly current: number; readonly total: number };
}
```

Do not embed Home-specific logic.

- [ ] **Step 4: Implement IconButton, CoinPill, ProgressMeter and SegmentedControl**

`IconButton` normalizes touch targets to at least 44 CSS px via the resolved viewport scale while allowing the visible glyph to remain smaller. `SegmentedControl<T>` emits exactly one semantic value and never mutates profile state directly.

- [ ] **Step 5: Implement ModalShell and ScrollRegion**

`ModalShell` owns dimmer, panel, title, close button, and input capture. `ScrollRegion` owns mask + pointer/wheel/touch scrolling; it never captures pointer events outside its rectangle.

- [ ] **Step 6: Run component contract test**

```bash
node --experimental-strip-types --test tests/ui-components-contract.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components tests/ui-components-contract.test.ts
git commit -m "feat: add schematic Trifold UI components"
```

---

### Task 3: Navigation Controller and Scene Shell

**Files:**
- Create: `src/ui/navigation/UiRoute.ts`
- Create: `src/ui/navigation/NavigationController.ts`
- Create: `src/ui/scenes/BaseUiScene.ts`
- Modify: `src/main.ts`
- Test: `tests/ui-navigation.test.ts`

**Interfaces:**
- Produces: `UiRoute = 'home'|'standard'|'daily'|'mastery'|'themes'|'leaderboards'`, `NavigationController.go(route,payload?)`, `NavigationController.home()`.
- Consumed by: all major scenes.

- [ ] **Step 1: Write RED navigation tests**

Test that:
- every declared route maps to one Phaser scene key;
- `home()` always maps to Home;
- overlays are absent from `UiRoute`;
- going to Standard may carry `continue` or `new-deal` payload without creating an intermediate menu route.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/ui-navigation.test.ts
```

- [ ] **Step 3: Implement route map and controller**

```ts
export const ROUTE_SCENES: Readonly<Record<UiRoute, string>> = {
  home: 'HomeScene',
  standard: 'GameScene',
  daily: 'DailyScene',
  mastery: 'MasteryScene',
  themes: 'ThemesScene',
  leaderboards: 'LeaderboardsScene',
};
```

Controller wraps `scene.start()` and is injected into scenes; no scene hard-codes another scene key.

- [ ] **Step 4: Implement BaseUiScene resize lifecycle**

Provide one `ResolvedUiViewport`, re-resolve on resize, and call abstract `layout(viewport)`. Reuse the project's existing HiDPI/ResizeObserver infrastructure instead of creating a second canvas scaling system.

- [ ] **Step 5: Register future routed scenes in bootstrap**

Register scene classes without changing startup to a not-yet-implemented route. Home becomes startup only in Task 4 when it exists.

- [ ] **Step 6: Run navigation tests**

```bash
node --experimental-strip-types --test tests/ui-navigation.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/navigation src/ui/scenes/BaseUiScene.ts src/main.ts tests/ui-navigation.test.ts
git commit -m "feat: add Trifold UI navigation shell"
```

---

### Task 4: Canonical Home Dashboard

**Files:**
- Create: `src/ui/home/HomeViewModel.ts`
- Create: `src/ui/scenes/HomeScene.ts`
- Modify: `src/main.ts`
- Test: `tests/home-view-model.test.ts`
- Test: `tests/home-scene-contract.test.ts`

**Interfaces:**
- Consumes: `PlayerProfileV1`, Daily selectors, Mastery selectors, theme/economy profile data from the domain plans.
- Produces: `buildHomeViewModel(profile,today)`, canonical Home interactions.

- [ ] **Step 1: Write RED view-model tests**

Cover exact states:
- active Standard → primary title `Continue` plus saved difficulty;
- no active Standard → primary title `Play` plus selected difficulty;
- incomplete current Daily → Daily tile `highlight`;
- completed current Daily → Daily tile shows result/streak without highlight;
- Mastery tile shows current rank plus literal next requirement summary;
- Themes tile shows coin balance and owned count `N / 7`.

- [ ] **Step 2: Run view-model test and verify RED**

```bash
node --experimental-strip-types --test tests/home-view-model.test.ts
```

- [ ] **Step 3: Implement pure HomeViewModel**

No Phaser imports. Return only strings, semantic states, counts, and difficulty value.

- [ ] **Step 4: Write Home scene source-contract RED test**

Assert source contains exactly one `ActionCard` for primary, two sibling dashboard tiles for Daily/Mastery, one Themes card, and service icon actions for leaderboards/how-to/settings. Assert no large `How to Play` or `Settings` ActionCard exists.

- [ ] **Step 5: Implement HomeScene using `computeHomeLayout()`**

Use the frozen geometry. Add schematic left art region as a quiet programmatic placeholder plus stable asset hook `ui.home.background`. The dashboard must remain on the approved right side in both profiles.

- [ ] **Step 6: Wire Home actions**

- primary → continue saved Standard or start next Standard at selected difficulty;
- Daily → `daily`;
- Mastery → `mastery`;
- Themes → `themes`;
- leaderboard icon → `leaderboards`;
- how-to/settings → overlays.

No action navigates through an intermediate menu.

- [ ] **Step 7: Make Home startup scene**

Change bootstrap from direct GameScene startup to HomeScene only after the Home test is green.

- [ ] **Step 8: Run Home tests**

```bash
node --experimental-strip-types --test tests/home-view-model.test.ts tests/home-scene-contract.test.ts tests/home-layout.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/ui/home src/ui/scenes/HomeScene.ts src/main.ts tests/home-view-model.test.ts tests/home-scene-contract.test.ts
git commit -m "feat: add canonical Trifold home dashboard"
```

---

### Task 5: Standard HUD Without Gameplay Geometry Regression

**Files:**
- Create: `src/ui/game/GameHudViewModel.ts`
- Create: `src/ui/game/GameHud.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/view/ViewportLayout.ts`
- Test: `tests/game-hud.test.ts`
- Modify test: `tests/viewport-layout.test.ts`
- Modify test: `tests/board-interaction-contract.test.ts`

**Interfaces:**
- Consumes: Standard attempt metrics, selected difficulty, coins, hint eligibility, undo state.
- Produces: desktop/mobile HUD rectangles and semantic actions; does not own board rules.

- [ ] **Step 1: Write RED HUD view-model tests**

Assert formatting for difficulty, moves, active timer, assisted state, undo availability, and Hint state.

- [ ] **Step 2: Write RED geometry regression tests**

For 1920×1080, 1280×720 touch, and 844×390 touch:
- board rectangle/card size remains equal to the pre-HUD gameplay calculation or changes only through an explicit reserved-safe-area parameter;
- HUD controls do not intersect tableau/top-slot bounds;
- Home and New Deal are directly visible;
- touch targets meet 44 CSS px.

- [ ] **Step 3: Run and verify RED**

```bash
node --experimental-strip-types --test tests/game-hud.test.ts tests/viewport-layout.test.ts tests/board-interaction-contract.test.ts
```

- [ ] **Step 4: Implement `GameHud` around existing board**

Desktop places metrics in quiet margins and service actions at the upper/right edge. Mobile uses compact fixed groups outside the tableau rectangle. Do not scale cards merely to make decorative HUD elements larger.

- [ ] **Step 5: Wire semantic actions into GameScene**

Home, New Deal, Undo, Hint, Settings. Preserve the existing direct drag/drop, auto-stream, dragon button, and HiDPI behavior.

- [ ] **Step 6: Run focused gameplay/UI tests**

```bash
node --experimental-strip-types --test tests/game-hud.test.ts tests/viewport-layout.test.ts tests/board-interaction-contract.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/game src/game/scenes/GameScene.ts src/game/view/ViewportLayout.ts tests/game-hud.test.ts tests/viewport-layout.test.ts tests/board-interaction-contract.test.ts
git commit -m "feat: integrate responsive Standard HUD"
```

---

### Task 6: Standard Win Overlay and Mastery Presentation

**Files:**
- Create: `src/ui/win/StandardWinViewModel.ts`
- Create: `src/ui/win/WinOverlay.ts`
- Create: `src/ui/scenes/MasteryScene.ts`
- Create: `src/ui/mastery/MasteryViewModel.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/standard-win-view-model.test.ts`
- Test: `tests/mastery-view-model.test.ts`

**Interfaces:**
- Consumes: Standard settlement result and Mastery selectors from meta-core plan.
- Produces: compact win overlay and routed Mastery screen.

- [ ] **Step 1: Write RED Standard win tests**

Cover:
- normal first completion shows base coins and personal result;
- assisted completion shows assisted marker and no Mastery progress claim;
- rank-up shows new rank plus one-time reward;
- repeat completion shows no first-completion reward;
- eligible Standard first completion exposes `doubleRewardAvailable=true` without itself calling ad SDK.

- [ ] **Step 2: Write RED Mastery view-model tests**

Assert exact literal counters for every rank stage and six-rank progression ordering. Never expose generic XP percent as the sole progress representation.

- [ ] **Step 3: Implement StandardWinViewModel and WinOverlay**

Overlay actions: `New Deal`, `Home`, optional semantic `Double Coins`. WinOverlay is reusable by Daily with a different view model in Task 7.

- [ ] **Step 4: Implement MasteryScene**

Desktop: central/two-column parchment composition. Mobile: two-column compact composition. Show rank badge hook `ui.rank.<rank>`, current requirements, next reward, six-rank strip.

- [ ] **Step 5: Run tests**

```bash
node --experimental-strip-types --test tests/standard-win-view-model.test.ts tests/mastery-view-model.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/win src/ui/mastery src/ui/scenes/MasteryScene.ts src/game/scenes/GameScene.ts tests/standard-win-view-model.test.ts tests/mastery-view-model.test.ts
git commit -m "feat: add Trifold win and Mastery UI"
```

---

### Task 7: Daily Dashboard, Archive Calendar, and Daily Win UI

**Files:**
- Create: `src/ui/daily/DailyViewModel.ts`
- Create: `src/ui/daily/DailyCalendarLayout.ts`
- Create: `src/ui/scenes/DailyScene.ts`
- Modify: `src/ui/win/WinOverlay.ts`
- Test: `tests/daily-view-model.test.ts`
- Test: `tests/daily-calendar-layout.test.ts`

**Interfaces:**
- Consumes: Daily selectors/settlement/streak/archive state from Daily plan.
- Produces: two-column Daily screen and Daily win overlay configuration.

- [ ] **Step 1: Write RED Daily view-model tests**

Cover current incomplete, completed-on-time, archive-completed, missed, current streak before day's deadline, and immutable official first result.

- [ ] **Step 2: Write RED calendar layout tests**

For desktop and mobile-landscape, assert summary and calendar columns do not overlap, calendar keeps seven columns, current day is addressable, and archive scrolling is bounded to its region.

- [ ] **Step 3: Implement DailyViewModel**

Expose semantic calendar cell states: `today`, `completed-on-time`, `completed-archive`, `missed`, `future`, `outside-archive`.

- [ ] **Step 4: Implement DailyScene**

Desktop split ~34/66; mobile split ~38/62. Summary shows streak and current Daily CTA/result. Calendar month controls remain inside the calendar region. Home is one action.

- [ ] **Step 5: Reuse WinOverlay for Daily**

Show official result, personal best, streak, coins, leaderboard placement when available, Replay and Home. Do not expose ×2 reward in Daily.

- [ ] **Step 6: Run tests**

```bash
node --experimental-strip-types --test tests/daily-view-model.test.ts tests/daily-calendar-layout.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/daily src/ui/scenes/DailyScene.ts src/ui/win/WinOverlay.ts tests/daily-view-model.test.ts tests/daily-calendar-layout.test.ts
git commit -m "feat: add Daily and archive UI"
```

---

### Task 8: Themes / Shop Responsive Grid

**Files:**
- Create: `src/ui/themes/ThemesViewModel.ts`
- Create: `src/ui/themes/ThemeCard.ts`
- Create: `src/ui/themes/ThemesGridLayout.ts`
- Create: `src/ui/scenes/ThemesScene.ts`
- Test: `tests/themes-view-model.test.ts`
- Test: `tests/themes-grid-layout.test.ts`

**Interfaces:**
- Consumes: `ThemeCatalog`, `ShopService`, profile coins/ownership from Economy plan.
- Produces: three-column desktop / two-column mobile theme grid.

- [ ] **Step 1: Write RED view-model tests**

Assert exactly seven launch cards, one free base, six price-300 themes, active/owned state, and exactly one card action (`apply`, `buy`, `none`).

- [ ] **Step 2: Write RED grid tests**

Desktop at 1920×1080 returns 3 columns. Mobile-landscape at 1280×720 and 844×390 returns 2 columns with scrollable rows. Cards stay inside safe bounds.

- [ ] **Step 3: Implement ThemeCard schematic preview**

Preview contains board surface rectangle, card-back hook, and slot palette hook. Do not fake final theme artwork in code.

- [ ] **Step 4: Implement ThemesScene**

Header: Home, title, CoinPill, coin-pack entry. Grid scrolls within content region. Buy/apply updates card state without reloading scene.

- [ ] **Step 5: Run tests**

```bash
node --experimental-strip-types --test tests/themes-view-model.test.ts tests/themes-grid-layout.test.ts tests/theme-catalog.test.ts tests/shop-service.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/themes src/ui/scenes/ThemesScene.ts tests/themes-view-model.test.ts tests/themes-grid-layout.test.ts
git commit -m "feat: add responsive Themes shop UI"
```

---

### Task 9: Leaderboards and Guest/Auth Presentation

**Files:**
- Create: `src/ui/leaderboards/LeaderboardsViewModel.ts`
- Create: `src/ui/scenes/LeaderboardsScene.ts`
- Create: `src/ui/components/LeaderboardRow.ts`
- Test: `tests/leaderboards-view-model.test.ts`

**Interfaces:**
- Consumes: leaderboard gateway/auth state from Yandex platform plan.
- Produces: `Daily | Streak | Mastery` tab UI and guest/auth states.

- [ ] **Step 1: Write RED tests**

Assert exactly three tabs, Daily rows format moves first/time second, player row highlighting, guest state does not block viewing locally available content, and sign-in CTA appears only when cloud/submission requires it.

- [ ] **Step 2: Implement view model and scene**

Compact parchment panel, tab control, scroll region, player highlight. Keep network loading/error states inside the content panel rather than replacing navigation.

- [ ] **Step 3: Run test**

```bash
node --experimental-strip-types --test tests/leaderboards-view-model.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/leaderboards src/ui/scenes/LeaderboardsScene.ts src/ui/components/LeaderboardRow.ts tests/leaderboards-view-model.test.ts
git commit -m "feat: add Trifold leaderboard UI"
```

---

### Task 10: Settings, How to Play, Hint, and Tutorial Overlays

**Files:**
- Create: `src/ui/overlays/SettingsOverlay.ts`
- Create: `src/ui/overlays/HowToPlayOverlay.ts`
- Create: `src/ui/overlays/HintOverlay.ts`
- Create: `src/ui/overlays/TutorialOverlay.ts`
- Create: `src/ui/overlays/OverlayController.ts`
- Modify: `src/ui/scenes/HomeScene.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/overlay-controller.test.ts`
- Test: `tests/tutorial-overlay-contract.test.ts`

**Interfaces:**
- Consumes: settings/profile services, hint worker result, tutorial state from Hints/Tutorial plan.
- Produces: one-overlay-at-a-time controller and non-blocking tutorial/hint visuals.

- [ ] **Step 1: Write RED OverlayController tests**

Assert opening one blocking overlay closes/replaces the previous one, active-play timer pause state follows blocking overlays, close restores previous scene input, and win overlay has precedence over Settings.

- [ ] **Step 2: Write RED tutorial/hint contract tests**

Assert:
- tutorial callout rectangle never covers its target rectangle;
- Hint highlight style token differs from selection/active-control style token;
- Hint action highlights source and destination but never calls `TrifoldGame.perform()` itself;
- Settings and How to Play use ModalShell rather than routed scenes.

- [ ] **Step 3: Implement OverlayController**

```ts
export type OverlayKind = 'settings' | 'how-to' | 'hint' | 'tutorial' | 'win';
```

Controller exposes `open(kind,payload)`, `close(kind)`, `isBlocking`, and change subscription for the active-time controller.

- [ ] **Step 4: Implement schematic overlays**

How to Play is paged and exposes `Replay Tutorial`. Tutorial uses top/bottom callout placement chosen from target geometry. Hint visually highlights only the returned solver move. Settings remains compact.

- [ ] **Step 5: Run tests**

```bash
node --experimental-strip-types --test tests/overlay-controller.test.ts tests/tutorial-overlay-contract.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/overlays src/ui/scenes/HomeScene.ts src/game/scenes/GameScene.ts tests/overlay-controller.test.ts tests/tutorial-overlay-contract.test.ts
git commit -m "feat: add Trifold modal and tutorial UI"
```

---

### Task 11: Final Asset Hook Registry

**Files:**
- Create: `src/ui/assets/UiAssetKeys.ts`
- Create: `src/ui/assets/UiAssetResolver.ts`
- Modify: `src/ui/scenes/HomeScene.ts`
- Modify: `src/ui/scenes/MasteryScene.ts`
- Modify: `src/ui/scenes/DailyScene.ts`
- Modify: `src/ui/themes/ThemeCard.ts`
- Test: `tests/ui-asset-hooks.test.ts`

**Interfaces:**
- Produces: stable semantic asset keys and fallback schematic rendering decisions.
- Consumed by: UI scenes/components; final art pass later changes manifests/assets, not layout.

- [ ] **Step 1: Write RED asset-hook tests**

Require stable keys for:

```ts
'ui.home.background'
'ui.home.logo'
'ui.paper.panel'
'ui.icon.leaderboard'
'ui.icon.help'
'ui.icon.settings'
'ui.rank.novice'
'ui.rank.player'
'ui.rank.tactician'
'ui.rank.expert'
'ui.rank.master'
'ui.rank.grandmaster'
'ui.daily.today'
'ui.daily.completedOnTime'
'ui.daily.completedArchive'
```

Resolver must return `null`/fallback cleanly when an asset is not yet installed.

- [ ] **Step 2: Implement registry/resolver**

No scene checks raw URL strings. Scenes ask resolver for semantic keys and keep programmatic fallback when absent.

- [ ] **Step 3: Route current schematic visuals through resolver**

Do not change rectangles/spacing while doing this task.

- [ ] **Step 4: Run test**

```bash
node --experimental-strip-types --test tests/ui-asset-hooks.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/assets src/ui/scenes/HomeScene.ts src/ui/scenes/MasteryScene.ts src/ui/scenes/DailyScene.ts src/ui/themes/ThemeCard.ts tests/ui-asset-hooks.test.ts
git commit -m "feat: add stable UI asset hooks"
```

---

### Task 12: Responsive Release Regression Matrix

**Files:**
- Create: `tests/ui-responsive-regression.test.ts`
- Create: `tests/ui-route-regression.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: all UI/domain routes implemented above.
- Produces: release gate preventing geometry/nav regressions while final assets are added later.

- [ ] **Step 1: Write responsive matrix RED test**

Evaluate these reference viewports:

```ts
const CASES = [
  { width: 1920, height: 1080, touchPrimary: false },
  { width: 1440, height: 900, touchPrimary: false },
  { width: 1280, height: 720, touchPrimary: true },
  { width: 932, height: 430, touchPrimary: true },
  { width: 844, height: 390, touchPrimary: true },
];
```

For each applicable screen assert rectangles stay inside viewport, primary controls do not overlap, touch controls meet minimum size, Home preserves dashboard ordering, Shop keeps 3/2 columns, Daily keeps summary/calendar separation, and Standard HUD does not intersect the board.

- [ ] **Step 2: Write route-flow RED test**

Verify:
- Home → Standard → Home is one action back;
- Home → Daily → Home;
- Home → Mastery → Home;
- Home → Themes → Home;
- Home → Leaderboards → Home;
- Settings/How-to never replace current route;
- Standard New Deal never routes through Home;
- Daily Replay never overwrites official result through UI dispatch.

- [ ] **Step 3: Run and fix only genuine layout/navigation regressions**

```bash
node --experimental-strip-types --test tests/ui-responsive-regression.test.ts tests/ui-route-regression.test.ts
```

- [ ] **Step 4: Add `test:ui` package script**

```json
{
  "scripts": {
    "test:ui": "node --experimental-strip-types --test tests/ui-*.test.ts tests/home-*.test.ts tests/*view-model.test.ts"
  }
}
```

Preserve the existing solver-building behavior of the main `test` script; do not regress the Windows solver test fix.

- [ ] **Step 5: Run full project release verification**

```bash
pnpm test
pnpm build
```

Expected: both exit 0.

- [ ] **Step 6: Manual reference-size smoke**

At 1920×1080 and one real mobile-landscape device/emulation, verify the accepted Home composition, board readability, one-click Home return, scrolling in Daily/Themes only where intended, and no card/control overlap. This manual smoke validates visual composition that unit geometry cannot prove.

- [ ] **Step 7: Commit**

```bash
git add tests/ui-responsive-regression.test.ts tests/ui-route-regression.test.ts package.json
git commit -m "test: lock Trifold responsive UI flows"
```

---

## Completion Gate

Before calling the schematic UI complete:

```bash
pnpm test
pnpm build
```

Then verify manually at the five regression viewport sizes. Final art replacement is a separate later pass and may change textures, icons, illustration, and typography assets, but must not change the geometry/navigation contracts established here without a new approved design change.
