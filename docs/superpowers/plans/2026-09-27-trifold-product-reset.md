# Trifold Product Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Themes, currency coins, shop, payments and double-reward from Trifold while preserving gameplay, the numeric `coins` suit, and the current base appearance.

**Architecture:** Replace profile-driven `ThemeRuntime` with one fixed `TrifoldAppearance`; then remove all economy/theme routes, services, UI, localization, analytics and preload paths. Keep the existing profile architecture temporarily so the product remains runnable; the next plan replaces persistence with the Cascade-derived meta model.

**Tech Stack:** TypeScript 5.9, Phaser 3.90.0, Vite 7, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

## Global Constraints

- Do not remove or rename gameplay `NumericSuit = 'coins' | 'bamboo' | 'characters'`.
- Preserve Trifold rules, solver, deal catalog, hint search, dragon behavior, free cells, foundations and special slot.
- Preserve the current base-theme visual values; this is not a visual redesign.
- Remove economy/theme concepts rather than leaving disabled zombie abstractions.
- Home replaces Themes with Leaders and must not keep a duplicate leaderboard service button.
- Keep Phaser at `3.90.0`.

## Review Focus

- Search-based cleanup must not delete `foundations.coins`, number cards of suit `coins`, or solver/rules references to the suit.
- Legacy profile JSON containing `coins`, `ownedThemeIds`, `activeThemeId` and `claimedRewardKeys` must still parse after the fields are dropped.
- Base card-back/slot colors must render without `ThemeRuntime` or profile state.
- Guest startup must not touch payments/rewarded APIs.
- Home must have exactly one Leaders entry and no Themes/coin pill.

---

### Task 1: Add product-reset characterization tests

**Files:**
- Create: `tests/remove-themes-coins-contract.test.mjs`
- Modify: `tests/cards.test.ts`
- Modify: `tests/trifold-game.test.ts`

**Interfaces:**
- Consumes: current Trifold source tree.
- Produces: regression guards distinguishing economy `coins` from gameplay suit `coins`.

- [ ] **Step 1: Write failing source-contract tests**

Assert that the post-reset source tree contains no imports/reachable identifiers for `ThemesScene`, `ThemeRuntime`, `ShopService`, `CoinPill`, `CoinPack`, `RewardDouble`, `PurchaseReconciliation`, `ownedThemeIds`, `activeThemeId`, or currency `claimedRewardKeys`, while explicitly asserting that `src/game/model/types.ts` still contains `NumericSuit` with `coins` and that rules/tests still exercise `foundations.coins`.

- [ ] **Step 2: Run the new contract test and verify RED**

Run: `node --test tests/remove-themes-coins-contract.test.mjs`

Expected: FAIL because the removed product concepts still exist.

- [ ] **Step 3: Run core gameplay characterization tests before edits**

Run: `node --experimental-strip-types --test tests/cards.test.ts tests/trifold-rules.test.ts tests/trifold-game.test.ts tests/deal-proof.test.ts tests/hint-search.test.ts`

Expected: PASS; record this as the behavioral baseline.

- [ ] **Step 4: Commit checkpoint when working in git**

Commit message: `test: guard Trifold product reset boundaries`

---

### Task 2: Replace ThemeRuntime with fixed Trifold appearance

**Files:**
- Create: `src/game/appearance/GameAppearance.ts`
- Modify: `src/game/view/TrifoldBoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/ui/scenes/BootScene.ts`
- Modify: `src/meta/RuntimeServices.ts`
- Delete after consumers migrate: `src/theme/ThemeRuntime.ts`
- Delete after consumers migrate: `src/theme/ThemeCatalog.ts`
- Delete after consumers migrate: `src/theme/ThemeDefinition.ts`
- Move/keep as gameplay-owned if still needed: `src/theme/CardBackStyle.ts` -> `src/game/appearance/CardBackStyle.ts`
- Test: `tests/game-appearance.test.ts`
- Modify: `tests/ui-asset-wiring.test.ts`

**Interfaces:**
- Produces: `TrifoldAppearance`, `TRIFOLD_APPEARANCE`, `CardBackStyle`.
- `TRIFOLD_APPEARANCE` exposes `boardSurfaceColor: number`, `slotPalette: { recess:number; edge:number; highlight:number }`, and `cardBackStyle: CardBackStyle` using the old base-theme values only.
- `RuntimeServices` no longer exposes `theme`.

- [ ] **Step 1: Write RED fixed-appearance tests**

Test that `TRIFOLD_APPEARANCE` resolves the old base values (`#183f2f`, `#173a2d`, `#8aa095`, `#d7b84d`) and that its card-back palette is deterministic with no profile input.

- [ ] **Step 2: Run test and verify RED**

Run: `node --experimental-strip-types --test tests/game-appearance.test.ts`

- [ ] **Step 3: Implement `TrifoldAppearance` and migrate board/game consumers**

Use signatures:

```ts
export interface TrifoldAppearance {
  readonly boardSurfaceColor: number;
  readonly slotPalette: { readonly recess:number; readonly edge:number; readonly highlight:number };
  readonly cardBackStyle: CardBackStyle;
}
export const TRIFOLD_APPEARANCE: TrifoldAppearance;
```

No setter or theme ID exists.

- [ ] **Step 4: Remove ThemeRuntime from `RuntimeServices` and Boot preload**

`RuntimeServices` keeps repository/catalog/platform/leaderboards/analytics/language only at this stage.

- [ ] **Step 5: Run appearance, board and asset tests**

Run: `node --experimental-strip-types --test tests/game-appearance.test.ts tests/board-interaction-contract.test.ts tests/ui-asset-wiring.test.ts tests/numeric-card-offline-face.test.ts tests/dragon-card-modular-face.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `refactor: replace Trifold themes with fixed appearance`

---

### Task 3: Drop economy/theme fields from the legacy profile parser without breaking old saves

**Files:**
- Modify: `src/meta/profile/ProfileTypes.ts`
- Modify: `src/meta/profile/ProfileSchema.ts`
- Modify: `src/meta/profile/ProfileMerge.ts`
- Modify: `src/meta/profile/LocalProfileStore.ts`
- Modify: `src/meta/profile/CloudProfileStore.ts`
- Test: `tests/profile-schema.test.ts`
- Test: `tests/profile-merge.test.ts`
- Test: `tests/local-profile-store.test.ts`
- Test: `tests/cloud-profile-store.test.ts`

**Interfaces:**
- Produces: temporary non-economy `PlayerProfileV1` used only until plan 2.
- Legacy raw input may contain removed fields; parser ignores them instead of rejecting the snapshot.

- [ ] **Step 1: Change tests first**

Add a test that feeds a valid v1 profile plus `coins`, `claimedRewardKeys`, `ownedThemeIds`, and `activeThemeId`, and asserts the parsed result has none of those keys. Update defaults/merge expectations to contain no economy/theme fields.

- [ ] **Step 2: Run profile tests and verify RED**

Run: `node --experimental-strip-types --test tests/profile-schema.test.ts tests/profile-merge.test.ts tests/local-profile-store.test.ts tests/cloud-profile-store.test.ts`

- [ ] **Step 3: Remove fields/imports from types, parser/defaults and merge**

Do not add replacement rewards or compensation fields.

- [ ] **Step 4: Run profile tests and verify PASS**

Use the same command as step 2.

- [ ] **Step 5: Commit**

Commit message: `refactor: drop Trifold economy fields from profile`

---

### Task 4: Replace Themes/Coin UI with Leaders on Home

**Files:**
- Modify: `src/ui/home/HomeViewModel.ts`
- Modify: `src/ui/scenes/HomeScene.ts`
- Modify: `src/ui/layout/HomeLayout.ts`
- Modify: `src/ui/navigation/UiRoute.ts`
- Modify: `src/main.ts`
- Delete: `src/ui/scenes/ThemesScene.ts`
- Delete: `src/ui/themes/ThemeCard.ts`
- Delete: `src/ui/themes/ThemeCardPress.ts`
- Delete: `src/ui/themes/ThemesGridLayout.ts`
- Delete: `src/ui/themes/ThemesViewModel.ts`
- Delete: `src/ui/components/CoinPill.ts`
- Test: `tests/home-view-model.test.ts`
- Test: `tests/home-layout.test.ts`
- Test: `tests/home-scene-contract.test.ts`
- Test: `tests/ui-navigation.test.ts`

**Interfaces:**
- `HomeViewModel` replaces `themes` and `coins` with `leaders: { title:string; subtitle:string; enabled:boolean }`.
- `UiRoute` becomes `'home' | 'standard' | 'daily' | 'mastery' | 'leaderboards'`.

- [ ] **Step 1: Write RED Home/navigation tests**

Assert no `themes` route, no CoinPill, one Leaders action card, and no second leaderboard icon in `serviceButtons`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --experimental-strip-types --test tests/home-view-model.test.ts tests/home-layout.test.ts tests/home-scene-contract.test.ts tests/ui-navigation.test.ts`

- [ ] **Step 3: Implement Leaders card and route cleanup**

Keep How to Play and Settings as service actions. Remove ThemesScene from Phaser scene registration.

- [ ] **Step 4: Run tests and verify PASS**

Use the command from step 2.

- [ ] **Step 5: Commit**

Commit message: `feat: replace Themes with Leaders on Trifold Home`

---

### Task 5: Remove economy runtime, monetization platform paths, copy and analytics

**Files:**
- Delete: `src/meta/economy/CoinPack.ts`
- Delete: `src/meta/economy/CoinRewards.ts`
- Delete: `src/meta/economy/RewardDouble.ts`
- Delete: `src/meta/economy/ShopService.ts`
- Delete: `src/platform/MonetizationGateways.ts`
- Delete: `src/platform/PurchaseReconciliation.ts`
- Modify: `src/platform/services.ts`
- Modify: `src/platform/yandex.ts`
- Modify: `src/meta/RuntimeServices.ts`
- Modify: `src/main.ts`
- Modify: `src/analytics/AnalyticsService.ts`
- Modify: `src/i18n/Localization.ts`
- Modify: `src/ui/win/StandardWinViewModel.ts`
- Modify: `src/ui/win/WinOverlay.ts`
- Delete obsolete tests: `tests/coin-pack.test.ts`, `tests/coin-rewards.test.ts`, `tests/reward-double.test.ts`, `tests/shop-service.test.ts`, `tests/shop-scroll-input.test.ts`, `tests/theme-catalog.test.ts`, `tests/theme-runtime.test.ts`, `tests/themes-grid-layout.test.ts`, `tests/themes-scene-wiring.test.ts`, `tests/themes-view-model.test.ts`, `tests/monetization-gateways.test.ts`, `tests/monetization-ui-contract.test.ts`, `tests/yandex-monetization.test.ts`
- Modify: `tests/standard-win-view-model.test.ts`
- Modify: `tests/win-overlay-contract.test.ts`
- Modify: `tests/localization-ui-contract.test.ts`
- Modify: `tests/analytics-service.test.ts`

**Interfaces:**
- `PlatformServices` contains no `payments` and no rewarded-ad API after this task; plan 3 later replaces it with Cascade-style interstitial `PlatformAds`.
- Win content has no coin reward line, rank coin reward, or double-coins action.

- [ ] **Step 1: Update tests to the no-economy product contract**

Assert WinOverlay has only product result/mastery/action content; localization has no Themes/shop/currency copy; analytics event type excludes shop/theme/coin purchase events.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --experimental-strip-types --test tests/standard-win-view-model.test.ts tests/win-overlay-contract.test.ts tests/localization-ui-contract.test.ts tests/analytics-service.test.ts tests/platform-services.test.ts`

- [ ] **Step 3: Remove economy code paths and simplify platform/runtime startup**

Delete purchase reconciliation from `main.ts`; remove payments/rewarded service creation from Yandex services; remove win reward UI.

- [ ] **Step 4: Run source-contract test**

Run: `node --test tests/remove-themes-coins-contract.test.mjs`

Expected: PASS while gameplay `coins` suit assertions remain green.

- [ ] **Step 5: Run full build + gameplay regression subset**

Run: `pnpm build`

Run: `node --experimental-strip-types --test tests/trifold-rules.test.ts tests/trifold-game.test.ts tests/cards.test.ts tests/verified-deal-catalog.test.ts tests/hint-search.test.ts tests/standard-flow-contract.test.ts tests/daily-session-controller.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `refactor: remove Trifold themes shop and coin economy`
