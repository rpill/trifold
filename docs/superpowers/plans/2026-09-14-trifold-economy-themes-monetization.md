# Trifold Economy, Themes & Voluntary Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 7-theme cosmetic economy, Shop, idempotent purchases, Standard post-win reward doubling, and the single 1,800-coin purchase product while keeping gameplay power unchanged.

**Architecture:** Keep economy mutations pure and profile-backed. Theme identity is stable persistence data; visual theme definitions are separate from ownership/purchase state. Monetization flows depend on abstract ad/payment gateways so the browser/dev build remains playable when Yandex services are unavailable; the concrete Yandex adapter is delivered by the platform plan.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, profile/reward modules from the meta-core plan, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-trifold-meta-progression-design.md`

## Global Constraints

- Exactly one soft currency: coins.
- Launch target: 1 free base theme + 6 paid themes, each paid theme costs 300 coins.
- One coin pack grants `6 × 300 = 1800` coins.
- Themes may alter only table/background, card back, empty slots/placeholders, and lightweight table-area decoration.
- Card faces, ranks, suits, dragons, HUD structure, buttons, navigation, and gameplay geometry remain theme-independent.
- Every paid theme remains earnable through normal play.
- Rewarded double applies only to an eligible Standard first-completion base reward.
- Daily rewards, archive rewards, Mastery rewards, payments, and other grants are never doubled.
- No forced interstitials, gameplay banner, energy, lives, paid Undo, paid easy deals, or paid Daily retries.

---

### Task 1: Stable Theme Catalog and Ownership Model

**Files:**
- Create: `src/theme/ThemeDefinition.ts`
- Create: `src/theme/ThemeCatalog.ts`
- Modify: `src/meta/profile/ProfileTypes.ts`
- Modify: `src/meta/profile/ProfileSchema.ts`
- Test: `tests/theme-catalog.test.ts`

**Interfaces:**
- Produces: `ThemeId`, `ThemeDefinition`, `THEMES`, `BASE_THEME_ID`, `getTheme()`, `getLaunchThemes()`.
- Consumed by: Shop, board rendering, profile parser.

- [ ] **Step 1: Write catalog RED tests**

```ts
test('launch catalog contains one free base and six paid 300-coin themes', () => {
  const themes = getLaunchThemes();
  assert.equal(themes.length, 7);
  assert.equal(themes.filter((t) => t.priceCoins === 0).length, 1);
  assert.equal(themes.filter((t) => t.priceCoins === 300).length, 6);
});

test('theme contract never exposes card-face or gameplay-geometry overrides', () => {
  const theme = getTheme(BASE_THEME_ID) as Record<string, unknown>;
  assert.equal('cardFaces' in theme, false);
  assert.equal('layout' in theme, false);
  assert.equal('dragons' in theme, false);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/theme-catalog.test.ts
```

- [ ] **Step 3: Implement the exact theme contract**

Use stable technical persistence ids:

```ts
export type ThemeId =
  | 'base'
  | 'launch_01'
  | 'launch_02'
  | 'launch_03'
  | 'launch_04'
  | 'launch_05'
  | 'launch_06';

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly displayName: string;
  readonly priceCoins: 0 | 300;
  readonly board: { readonly surface: string; readonly decoration?: string };
  readonly cardBack: { readonly assetKey: string; readonly url: string };
  readonly slots: { readonly recess: string; readonly edge: string; readonly highlight: string };
}
```

The six `launch_0N` ids are intentionally content-neutral persistence ids. Final art/name replacement may change `displayName` and asset URLs without profile migration. For the implementation baseline, use localized development names `Тема 1` through `Тема 6` and programmatic board/slot palettes so the whole Shop flow is testable before final art arrives.

- [ ] **Step 4: Make profile parser theme-aware**

Validate owned ids against catalog, always restore `base`, and fall back `activeThemeId` to `base` when an unknown id is loaded. Deduplicate owned ids while preserving catalog order.

- [ ] **Step 5: Run profile + catalog tests**

```bash
node --experimental-strip-types --test tests/theme-catalog.test.ts tests/profile-schema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/theme src/meta/profile/ProfileTypes.ts src/meta/profile/ProfileSchema.ts tests/theme-catalog.test.ts
git commit -m "feat: add launch theme catalog"
```

---

### Task 2: Theme Rendering Adapter Without Card-Face Drift

**Files:**
- Create: `src/theme/ThemeRuntime.ts`
- Modify: `src/game/view/SchematicCardView.ts`
- Modify: `src/game/view/TrifoldBoardView.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Test: `tests/theme-runtime.test.ts`
- Modify test: `tests/board-interaction-contract.test.ts`

**Interfaces:**
- Produces: `ThemeRuntime.current`, `ThemeRuntime.setTheme(id)`, render helpers for board surface/card back/slots.
- Consumes: Theme catalog and active profile theme id.

- [ ] **Step 1: Write RED contract tests**

Assert:
- switching theme changes board surface data, card-back data, and slot palette;
- card face renderer does not receive ThemeDefinition;
- input geometry and `ViewportLayout` remain unchanged by theme;
- blocked dragon-cell back uses the active card back.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/theme-runtime.test.ts tests/board-interaction-contract.test.ts
```

- [ ] **Step 3: Implement ThemeRuntime**

```ts
export class ThemeRuntime {
  constructor(private themeId: ThemeId = BASE_THEME_ID) {}
  get current(): ThemeDefinition { return getTheme(this.themeId); }
  setTheme(id: ThemeId): void { this.themeId = id; }
}
```

Keep it intentionally small; profile remains source of truth for ownership/selection.

- [ ] **Step 4: Route only approved visuals through theme data**

`TrifoldBoardView` receives `theme: ThemeRuntime` and uses theme slot palette and board surface. `drawSchematicCardBack()` accepts card-back styling/texture data. `SchematicCardView` face drawing remains untouched except for separating back drawing if it currently shares code.

- [ ] **Step 5: Add theme-change refresh path**

When active theme changes outside a deal, GameScene redraws board surface, slot graphics, and backs without reconstructing `TrifoldGame`. Do not move cards or recalculate drop geometry.

- [ ] **Step 6: Run view tests**

```bash
node --experimental-strip-types --test tests/theme-runtime.test.ts tests/board-interaction-contract.test.ts tests/viewport-layout.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/theme/ThemeRuntime.ts src/game/view/SchematicCardView.ts src/game/view/TrifoldBoardView.ts src/game/scenes/GameScene.ts tests/theme-runtime.test.ts tests/board-interaction-contract.test.ts
git commit -m "feat: apply cosmetic themes to Trifold table"
```

---

### Task 3: Shop Domain and Idempotent Theme Purchase

**Files:**
- Create: `src/meta/economy/ShopService.ts`
- Test: `tests/shop-service.test.ts`

**Interfaces:**
- Produces: `purchaseTheme(profile,themeId)`, `applyTheme(profile,themeId)`, `getShopCards(profile)`.
- Consumes: theme catalog and profile coin balance.

- [ ] **Step 1: Write purchase RED tests**

Cover:
- base is already owned and cannot be purchased;
- paid theme costs exactly 300;
- insufficient balance returns `status:'insufficient-coins'` without mutation;
- repeat purchase returns `status:'already-owned'` without charging;
- purchase atomically subtracts coins and adds ownership;
- applying unowned theme is rejected;
- applying owned theme changes only `activeThemeId`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/shop-service.test.ts
```

- [ ] **Step 3: Implement pure Shop functions**

Use discriminated results, for example:

```ts
export type ThemePurchaseResult =
  | { readonly status: 'purchased'; readonly profile: PlayerProfileV1; readonly price: 300 }
  | { readonly status: 'already-owned' | 'insufficient-coins' | 'free-theme'; readonly profile: PlayerProfileV1 };
```

No direct storage or SDK calls in this module.

- [ ] **Step 4: Build derived shop card data**

Each card exposes `owned`, `active`, `priceCoins`, and one allowed action: `apply`, `buy`, or `none`.

- [ ] **Step 5: Run test**

```bash
node --experimental-strip-types --test tests/shop-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/meta/economy/ShopService.ts tests/shop-service.test.ts
git commit -m "feat: add cosmetic theme purchases"
```

---

### Task 4: Shop Scene and Coin Header

**Files:**
- Create: `src/game/scenes/ShopScene.ts`
- Modify: `src/game/scenes/HomeScene.ts`
- Modify: `src/main.ts`
- Test: `tests/shop-scene-wiring.test.ts`
- Modify test: `tests/home-scene-wiring.test.ts`

**Interfaces:**
- Consumes: ProfileRepository, ShopService, ThemeRuntime.
- Produces: Home → Shop → buy/apply → Home loop.

- [ ] **Step 1: Write scene wiring RED tests**

Assert ShopScene:
- renders all 7 catalog entries;
- reads `profile.coins`;
- calls `purchaseTheme` and `applyTheme` through repository mutations;
- does not contain card-face replacement logic;
- exposes one future coin-pack button but keeps it disabled when payments gateway is unavailable.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/shop-scene-wiring.test.ts tests/home-scene-wiring.test.ts
```

- [ ] **Step 3: Implement ShopScene**

Use a scrollable 2-column card grid on mobile landscape and an adaptive grid on desktop. Each card shows preview, name, active/owned state, and either `Применить` or coin price. Keep the coin balance visible in the scene header.

- [ ] **Step 4: Wire immediate theme preview/apply**

After `applyTheme`, update ThemeRuntime and redraw Shop preview/background without reloading the page.

- [ ] **Step 5: Wire Home Shop route and shared coin display**

Home displays current coins and opens Shop. Later platform/payment plan activates the coin-pack purchase action.

- [ ] **Step 6: Run full UI contract tests and build**

```bash
pnpm test
pnpm build
```

Expected: PASS / exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/game/scenes/ShopScene.ts src/game/scenes/HomeScene.ts src/main.ts tests/shop-scene-wiring.test.ts tests/home-scene-wiring.test.ts
git commit -m "feat: add Trifold theme shop"
```

---

### Task 5: Standard Reward-Double Domain Flow

**Files:**
- Create: `src/meta/economy/RewardDouble.ts`
- Modify: `src/meta/standard/StandardWinSettlement.ts`
- Test: `tests/reward-double.test.ts`

**Interfaces:**
- Produces: `createRewardDoubleOffer(settlement)`, `claimRewardDouble(profile,offer)`.
- Consumed by: Standard win UI and platform rewarded-ad flow.

- [ ] **Step 1: Write RED eligibility tests**

```ts
test('eligible Standard first-completion offer equals only the base reward', () => {
  const offer = createRewardDoubleOffer({ seed: 42, difficulty: 'hard', baseCoinsGranted: 10, firstCompletion: true });
  assert.deepEqual(offer, { key: 'reward-double:standard:42', bonusCoins: 10 });
});

test('repeat and zero-base wins produce no offer', () => {
  assert.equal(createRewardDoubleOffer({ seed: 42, difficulty: 'hard', baseCoinsGranted: 0, firstCompletion: false }), null);
  assert.equal(createRewardDoubleOffer({ seed: 42, difficulty: 'hard', baseCoinsGranted: 0, firstCompletion: true }), null);
});
```

Also assert Daily/Mastery reward result types cannot be passed into this API.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/reward-double.test.ts
```

- [ ] **Step 3: Implement idempotent bonus claim**

`claimRewardDouble()` uses `claimCoinRewardOnce(profile, offer.key, offer.bonusCoins)`. A page reload after reward but before closing the win overlay must never pay twice.

- [ ] **Step 4: Keep the offer transient and make the claim durable**

Do not persist the offer across reloads. Reloading closes the transient win offer, but any already granted bonus remains protected by the durable `reward-double:standard:<seed>` claim key. This avoids introducing a second persisted win-overlay state machine.

- [ ] **Step 5: Run reward tests**

```bash
node --experimental-strip-types --test tests/reward-double.test.ts tests/standard-win-settlement.test.ts tests/coin-rewards.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/meta/economy/RewardDouble.ts src/meta/standard/StandardWinSettlement.ts tests/reward-double.test.ts
git commit -m "feat: add idempotent Standard reward doubling"
```

---

### Task 6: Monetization Gateways and Coin-Pack Domain Contract

**Files:**
- Create: `src/platform/MonetizationGateways.ts`
- Create: `src/meta/economy/CoinPack.ts`
- Test: `tests/monetization-gateways.test.ts`
- Test: `tests/coin-pack.test.ts`

**Interfaces:**
- Produces: `RewardedAdGateway`, `PaymentsGateway`, unavailable browser implementations, `COIN_PACK_PRODUCT_ID`, `COIN_PACK_AMOUNT=1800`, `consumeCoinPackPurchase(profile,purchaseToken)`.
- Consumed by: Yandex platform plan and win/shop scenes.

- [ ] **Step 1: Write gateway fallback RED tests**

Unavailable rewarded ads return `false`; unavailable payments expose `available=false` and purchase rejects with a typed unavailable error. Gameplay never crashes merely because services are unavailable.

- [ ] **Step 2: Implement interfaces**

```ts
export interface RewardedAdGateway {
  readonly available: boolean;
  showRewarded(): Promise<boolean>;
}

export interface PaymentsGateway {
  readonly available: boolean;
  purchase(productId: string): Promise<{ purchaseToken: string; productId: string }>;
  getUnconsumedPurchases(): Promise<readonly { purchaseToken: string; productId: string }[]>;
  consume(purchaseToken: string): Promise<void>;
}
```

- [ ] **Step 3: Write coin-pack RED tests**

Assert:
- amount is exactly 1800;
- only expected product id is accepted;
- applying the same purchase token twice cannot grant 3,600 coins;
- a successfully granted purchase token is persisted in `claimedRewardKeys` as `purchase:<token>` before/with consumption state.

- [ ] **Step 4: Implement coin-pack reducer**

Use idempotent reward key `purchase:<purchaseToken>` and add 1800 once. The platform plan later reconciles unconsumed server purchases on startup and consumes tokens after local/cloud persistence succeeds.

- [ ] **Step 5: Run tests**

```bash
node --experimental-strip-types --test tests/monetization-gateways.test.ts tests/coin-pack.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/MonetizationGateways.ts src/meta/economy/CoinPack.ts tests/monetization-gateways.test.ts tests/coin-pack.test.ts
git commit -m "feat: define voluntary monetization contracts"
```

---

### Task 7: Wire Reward Double and Coin Pack to UI Through Gateways

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/scenes/ShopScene.ts`
- Test: `tests/monetization-ui-contract.test.ts`

**Interfaces:**
- Consumes: RewardDouble, RewardedAdGateway, CoinPack, PaymentsGateway, ProfileRepository.
- Produces: functional UI when a gateway is connected, graceful hidden/disabled UI when unavailable.

- [ ] **Step 1: Write UI RED tests**

Assert:
- Standard victory overlay offers `×2 монеты` only when `createRewardDoubleOffer()` is non-null;
- Daily scene contains no rewarded action;
- rewarded bonus is claimed only after `showRewarded()` resolves true;
- Shop coin-pack button is visible only when payments are available and grants through `consumeCoinPackPurchase()`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/monetization-ui-contract.test.ts
```

- [ ] **Step 3: Implement rewarded double flow**

Order:
1. disable button;
2. pause active timer through session/platform pause integration;
3. await rewarded result;
4. if rewarded, repository-mutate `claimRewardDouble`;
5. update coins and mark button claimed;
6. resume timer only if no other pause source is active.

- [ ] **Step 4: Implement coin-pack UI flow**

Order:
1. purchase expected product id;
2. repository-mutate idempotent 1800-coin grant;
3. persist profile;
4. consume token;
5. refresh Shop balance.

If step 4 fails, startup reconciliation will see the same unconsumed token later but the reward key prevents duplicate coins.

- [ ] **Step 5: Run full verification**

```bash
pnpm test
pnpm build
```

Expected: PASS / exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/game/scenes/GameScene.ts src/game/scenes/ShopScene.ts tests/monetization-ui-contract.test.ts
git commit -m "feat: wire voluntary coin monetization"
```
