# Trifold: Cascade Product-Shell Migration + Visual QA Architecture

Date: 2026-09-27
Status: approved

## 1. Intent

Trifold should stop maintaining a second, partially divergent product/meta/platform stack. Cascade is the donor for the product shell and platform behavior; Trifold keeps the gameplay that is specific to Shenzhen-like solitaire.

The migration has two goals:

1. Remove Themes, coins, shop, payments, rewarded-double and all related profile/UI/test/assets from Trifold.
2. Replace Trifold's product shell with the current Cascade product architecture: Home/product navigation, Standard/Daily settlement, Mastery, leaderboards, persistence patterns, Yandex SDK behavior, settings, win/completion flow, responsive shell patterns, and a reusable DEV/Visual QA subsystem.

The result should be two different solitaire games with one proven product architecture, not two independently evolved implementations.

## 2. Non-goals

- Do not turn Trifold gameplay into Cascade gameplay.
- Do not replace Trifold's rules, solver, deal catalog, hint search, dragon mechanics, free cells, foundations, special slot, or card model with Cascade equivalents.
- Do not perform a visual redesign of Trifold in this migration. The Visual QA system is prepared first; a later visual redesign will use approved concepts and the Dungeon Logic workflow.
- Do not combine this migration with a Phaser 3 -> Phaser 4 engine migration. Cascade is on Phaser 4.2.1 while Trifold is on Phaser 3.90.0. Pure logic/layout/product architecture may be ported directly; Phaser-facing scene/component code must be adapted to Phaser 3 APIs for this migration. Engine migration can be a separate project later.
- Do not delete the Trifold numeric suit named `coins`. `NumericSuit = 'coins' | 'bamboo' | 'characters'` is gameplay terminology and is unrelated to the removed currency system.

## 3. Architectural boundary

### 3.1 Trifold gameplay core remains Trifold-owned

Keep and evolve in place:

- `src/game/model/TrifoldGame.ts`
- `src/game/model/TrifoldRules.ts`
- `src/game/model/cards.ts`
- `src/game/model/deal.ts`
- `src/game/model/DealSource.ts`
- `src/game/model/DealProof.ts`
- `src/game/model/VerifiedDealCatalog.ts`
- `src/game/model/GameHistory.ts`
- `src/game/hints/*`
- Trifold solver/deal tooling
- tutorial scenarios that encode Trifold-specific moves
- card face rendering
- Trifold board geometry and drag/drop behavior
- dragon auto-collection and animations

The board may adopt Cascade's responsive allocation methodology and HUD shell, but the actual Trifold slot/column geometry remains Trifold-specific.

### 3.2 Product shell follows Cascade

Cascade is the semantic donor for:

- product/profile meta state
- Standard progression/difficulty behavior
- Daily records, first-result policy, streak behavior, archive and ranking semantics
- Mastery ranks, requirements and lifetime mastery points
- leaderboard score encoding/decoding and submission queue patterns
- Home hierarchy and Leaders entry
- Settings behavior
- win/completion product flow
- Yandex SDK wrapper and failure behavior
- player storage/auth/leaderboards/trusted time/gameplay markup/ready/ads
- analytics wiring
- HiDPI/responsive shell patterns where engine-independent
- DEV fixture and screenshot QA patterns

Trifold-specific identifiers and game-state payloads remain Trifold-specific.

## 4. Product reset: remove Themes / economy completely

### 4.1 Remove runtime and product concepts

Delete or replace all active use of:

- `ThemesScene`
- `ThemeCatalog`
- `ThemeDefinition`
- `ThemeRuntime`
- `ThemeCard`, `ThemeCardPress`, `ThemesGridLayout`, `ThemesViewModel`
- `ShopService`
- `CoinRewards`
- `RewardDouble`
- `CoinPack`
- `CoinPill`
- `MonetizationGateways` payment/rewarded abstractions that exist only for the removed economy
- `PurchaseReconciliation`
- coin-pack purchase flow
- theme purchase/apply flow
- double-coin reward flow

Remove the `themes` route from `UiRoute` and `ROUTE_SCENES`.

Remove related analytics events such as `shop_open`, `theme_purchase`, `theme_apply`, `coin_pack_purchase`.

Remove all user-facing localization strings that describe coins, theme ownership, theme purchase, shop, double rewards or coin packs.

### 4.2 Profile fields to remove

The replacement meta model must not contain:

- `coins`
- `claimedRewardKeys`
- `ownedThemeIds`
- `activeThemeId`

Legacy snapshots containing them are accepted by migration/normalization and the fields are intentionally dropped.

### 4.3 Fixed appearance after themes are removed

Do not leave `ThemeRuntime` as a one-theme zombie abstraction.

Introduce a fixed Trifold appearance description, analogous in purpose to Cascade's `GameAppearance`, containing only runtime appearance actually required by the board:

- board surface/background reference or color
- fixed card-back appearance
- slot recess/edge/highlight palette
- control palette if useful

Initial fixed values should preserve Trifold's current base theme unless a later visual-design project replaces them. This migration is not the moment to invent a new Trifold style.

`TrifoldBoardView` and `GameScene` depend on the fixed appearance, not profile state.

### 4.4 Safety rule for the word "coins"

Automated cleanup must distinguish economy currency from the Mahjong-style numeric suit `coins`.

The following are gameplay and must remain:

- `NumericSuit = 'coins' | 'bamboo' | 'characters'`
- `foundations.coins`
- solver references to the `coins` suit
- card IDs / rules / hints for the `coins` suit

No broad text replacement or file deletion based only on the token `coins` is allowed.

## 5. Persistence and state model

### 5.1 Product meta state

Adopt the Cascade `MetaSave` architecture as the base model, renamed/adapted for Trifold as needed.

Core state:

- version
- aggregate stats required by the product shell
- Daily records
- weekly/progression receipts if used by the Cascade mutation model
- Standard selected difficulty and completed seeds
- Standard win streak if retained by Cascade shell
- Mastery rank/stage
- future prestige / lifetime mastery inputs

The old `PlayerProfileV1` ceases to be the runtime source of truth.

### 5.2 Legacy migration

A normalizer/migration reads existing Trifold profile snapshots and maps useful progress:

- `selectedStandardDifficulty` -> standard selected difficulty
- `completedStandard` -> standard completed partitions
- `masteryCreditedStandardSeeds` -> mastery credited seeds
- `onboardingWins` -> onboarding wins
- `mastery` -> mastery rank/stage
- `futurePrestige` -> future prestige
- Daily completion/results -> new Daily records where semantics map safely
- existing best streak -> corresponding streak state if the new model keeps it
- tutorial/settings -> migrated to the new preferences/settings location where possible

Removed fields are dropped, never converted into another reward:

- coins
- claimed reward keys
- theme ownership
- active theme

If an old field cannot be mapped without changing semantics, prefer a safe reset of that field over inventing data.

### 5.3 Active game persistence

Do not force Trifold game snapshots into Cascade's Solitaire snapshot format.

Create a Trifold-specific active-save envelope using the Cascade `ActiveGameRepository` pattern. The payload contains:

- save version
- mode (`standard` / `daily` / tutorial if persistence is intentionally supported)
- Trifold seed
- `TrifoldGameSaveV1`
- moves
- active elapsed time
- assisted/hint-used state when product rules require it
- Standard partition/difficulty metadata or Daily date metadata
- UI pause state if required

Active game persistence is separated from product meta persistence. This avoids rewriting a full cloud profile on every player move and keeps gameplay snapshots out of product-meta merge logic.

### 5.4 Product mutation/session model

Port the proven Cascade mutation/session pattern where practical:

- normalized meta snapshot
- idempotent operations / receipts where applicable
- retryable flush behavior
- safe fallback when platform storage is unavailable
- deterministic settlement functions separated from UI

The exact Cascade implementation may be adapted rather than copied verbatim if Trifold's existing `ProfileRepository` tests expose behavior worth retaining, but the end-state must have one product-meta source of truth and one active-game source of truth.

## 6. Standard mode

Trifold keeps its verified deal catalog and three difficulties.

Cascade semantics become the product source of truth for:

- selected difficulty
- onboarding partition
- first completion
- completed-seed tracking
- Mastery eligibility
- win settlement
- repeat completion policy
- win streak if used in the current Cascade shell

Remove all coin reward outputs from `StandardWinSettlement` and `StandardWinViewModel`.

Trifold-specific attempt data such as moves/time/assisted may still be kept where needed for records, UI, leaderboards or QA. It is not reintroduced as currency.

Hints in Trifold are free. No rewarded-ad gate is required to request a hint.

## 7. Mastery

Port Cascade Mastery as the source of truth:

- same rank sequence
- same rank requirements
- same promotion behavior
- same lifetime mastery-point calculation strategy
- same Mastery leaderboard encoding strategy, with Trifold technical leaderboard name

Trifold's Easy/Medium/Hard win events feed the same product rules. Trifold Daily on-time completions feed Daily mastery credit.

Use Cascade's point weights unless a later product decision explicitly changes them:

- Easy: 1
- Medium: 2
- Hard: 3
- on-time Daily: 2 lifetime mastery points

Rank progression and lifetime leaderboard points are separate concepts, matching Cascade.

No coin/rank-reward currency remains in Rank Up or Win Overlay.

## 8. Daily

The verified Trifold Daily deal schedule remains Trifold-owned; product behavior follows Cascade.

Port/adapt:

- trusted-clock date selection
- first-result/ranking policy
- on-time completion semantics
- replay behavior
- streak behavior
- archive navigation/policy
- Daily settlement
- persistence boundaries
- Daily leaderboard submission rules
- loading/unavailable/auth states

Keep Trifold's seed type and verified catalog access. Convert at the product boundary only if a Cascade helper expects string seeds; do not change the game model merely to match donor types.

Daily scoring continues to use Trifold-relevant result values (moves, then elapsed time where applicable), while encoding and first-attempt policy should follow the current Cascade leaderboard architecture.

## 9. Leaderboards

Use Cascade's service/submission architecture and state handling.

Trifold technical leaderboard names remain Trifold-specific. Existing names may be retained unless deployment configuration requires new ones:

- `trifolddaily`
- `trifoldstreak`
- `trifoldmastery`

If a Standard leaderboard is introduced because the Cascade shell requires one, it must be an explicit Trifold product decision and use a Trifold-specific technical name; do not silently submit to a Cascade name.

Required behavior:

- auth handling
- loading / populated / own / no-own / empty / unavailable states
- queued/retryable submissions
- score validation
- player-entry absence handled as a normal state
- no SDK error may break local gameplay

## 10. Yandex SDK and platform services

Cascade's current platform layer is the donor.

Port/adapt these contracts:

- player storage
- trusted clock
- auth
- leaderboard API
- platform pause/resume
- GameplayAPI start/stop
- LoadingAPI ready
- platform language
- ad API used by the chosen product policy

Remove:

- payments
- coin packs
- purchase reconciliation
- theme purchases
- reward-double rewarded ads

Hint is free, so no rewarded hint gateway is needed.

If Cascade currently uses interstitial ads through `StandardAdController`, port its lifecycle/policy as a separate product-shell concern, not by reusing the removed Trifold rewarded-ad interface.

All optional SDK calls must fail soft: local gameplay remains usable when a platform method is unavailable.

## 11. Settings and localization

Adopt the simpler Cascade preference model where appropriate:

- language RU/EN
- sound/SFX enabled state
- onboarding/how-to-play seen state if needed

Do not keep theme or economy settings.

Migration should preserve an existing explicit language choice and sound preference where it can be read safely from the legacy Trifold profile.

Localization files are cleaned of shop/theme/coin-copy and updated for the Cascade-derived Home/Mastery/Daily/leaderboard shell.

## 12. Home and product navigation

Replace the Themes entry with Leaders, matching the Cascade product decision.

Target Home product hierarchy:

- resume/start Standard
- difficulty selection
- Daily
- Mastery
- Leaders
- How to Play / Settings service actions

Exact Trifold naming/brand art remains Trifold-specific.

Do not keep two leaderboard entry points if one primary Leaders card exists; redundant service-action entry should be removed.

The layout math and responsive priorities may be ported from Cascade, but scene code must remain compatible with Phaser 3 during this migration.

## 13. Game HUD and table layout

### 13.1 What transfers from Cascade

Reuse/adapt:

- viewport allocation strategy
- responsive breakpoint principles
- minimum touch target policy
- HiDPI handling
- HUD priority
- separation between game area and controls
- mobile-landscape safe margins
- button grouping principles
- win overlay positioning principles

### 13.2 What remains Trifold-specific

- left special slot
- three right free slots
- foundation positions
- tableau columns
- dragon collection behavior
- card overlap/density
- drag/drop targets
- auto-collect animation ordering

The goal is not a Cascade-looking board. It is a Trifold board using a proven responsive shell.

## 14. Win/completion flow

Port Cascade's product-level Win Overlay structure and state flow, adapting content to Trifold.

Remove from Trifold Win Overlay:

- coin rewards
- double-coins action
- theme/economy references

Keep/show as appropriate:

- result
- moves/time
- mastery progress / rank-up event
- Daily/streak information
- next/replay/home actions

Runtime data remains runtime; do not bake result content into art.

## 15. Analytics

Use Cascade's current analytics service/wiring as the donor and remove economy-specific event names.

Retain/add Trifold gameplay events only when they are useful and stable. The analytics layer must not import game rendering or UI implementation details.

## 16. Phaser version strategy

Cascade is Phaser 4.2.1; Trifold is Phaser 3.90.0.

For this migration:

- keep Trifold on Phaser 3.90.0
- port pure TS logic directly where compatible
- port layout/view-model code directly where it has no Phaser dependency
- adapt scene/component rendering calls to Phaser 3
- add tests that prevent accidental Phaser 4-only API use

After product migration is stable, a separate Phaser 4 migration may be evaluated. Combining both migrations would make regressions difficult to attribute and is therefore explicitly out of scope.

## 17. Visual QA subsystem

After the product shell is stable, add a reusable DEV Visual QA harness inspired by Dungeon Logic but made more declarative.

Suggested structure:

```text
src/dev/visual-qa/
  VisualQaCatalog.ts
  VisualQaMode.ts
  viewportPresets.ts
  fixtures/
    home.ts
    game.ts
    daily.ts
    mastery.ts
    leaderboard.ts
    settings.ts
  interactions/
    index.ts

tools/visual-qa/
  capture.mjs
  gallery.mjs
  dim-pass.mjs
```

A scenario describes:

- stable ID
- scene/state
- fixture
- viewports
- optional interactions
- stable-ready condition

Examples:

- `home-fresh`
- `home-progress`
- `game-short-columns`
- `game-long-columns`
- `game-freecells-full`
- `game-dragons-ready-red`
- `game-dragons-ready-green`
- `game-dragons-ready-blue`
- `game-auto-collect-available`
- `game-hint`
- `game-win`
- `daily-unsolved`
- `daily-solved`
- `daily-replay`
- `daily-archive`
- `mastery-novice`
- `mastery-mid`
- `mastery-master`
- `rank-up`
- `leaderboard-loading`
- `leaderboard-own`
- `leaderboard-empty`
- `leaderboard-unavailable`
- `settings-ru`
- `settings-en`

Viewport presets must include desktop and mobile landscape, with at least one short-height desktop/mobile stress case.

The runner produces:

- screenshot matrix
- machine-readable manifest
- gallery/overview
- page/runtime error report
- optional dim simulation

Fixtures must use production scene code with injected state/services; they must not fork production layouts into QA-only clones.

## 18. Future visual-redesign workflow

Once Visual QA exists, Trifold visual work follows the proven Dungeon Logic process:

1. baseline screenshots
2. whole-screen concepts
3. `VISUAL_SYSTEM.md`
4. exact approved references
5. component breakdown
6. global KEEP / RESTYLE / RELAYOUT / REMOVE audit
7. implementation milestones
8. screenshot matrix after every milestone
9. final runtime pass and legacy-asset cleanup

The Visual QA system is architecture; the future visual style is game-specific and must not be copied from Dungeon Logic or Cascade.

## 19. Migration phases

### Phase A — economy/theme removal

- add characterization tests around current non-economy behavior
- introduce fixed Trifold appearance
- remove theme/shop/coin/payment/reward-double runtime paths
- remove theme/coin profile fields and migration-safe parser support
- remove Themes route/scene/UI/assets/tests
- remove economy analytics/localization
- keep numeric `coins` suit intact
- build/test green

### Phase B — Cascade meta/platform foundation

- introduce Cascade-derived meta save/session/repository architecture
- add legacy Trifold profile migration
- separate active-game persistence
- port Yandex services and preferences
- port leaderboard service/submission queue
- keep current gameplay reachable throughout
- build/test green

### Phase C — product behavior migration

- Standard settlement/progression
- Daily settlement/archive/streak/ranking
- Mastery and mastery leaderboard
- Home/Leaders/Settings shell
- completion flow
- analytics/product bridge
- free Hint behavior
- build/test green after each family

### Phase D — responsive shell / board integration

- port/adapt Cascade viewport/HUD principles
- preserve Trifold board-specific geometry
- verify desktop and mobile landscape
- long/short columns and all special slots

### Phase E — Visual QA

- scenario catalog
- fixtures
- interaction runner
- screenshot matrix
- gallery + dim pass
- baseline capture

### Phase F — cleanup

- search all `src`, tests, tools, preload and assets for removed economy/theme references
- delete truly dead files/assets
- update docs
- full product/game regression suite

## 20. Testing strategy

This migration is large enough that characterization and TDD are mandatory.

At each phase:

- TypeScript/build
- existing gameplay/rules/solver/deal tests
- persistence migration tests
- product settlement tests
- Yandex contract tests
- leaderboards tests
- navigation/UI contract tests
- HiDPI/layout tests

Critical regressions to protect:

- Trifold rules and legal moves unchanged
- dragon auto-collect unchanged
- undo behavior unchanged
- deal proof/catalog unchanged
- save/resume unchanged or intentionally migrated with compatibility test
- Daily seed for a date unchanged
- first ranked Daily result policy correct
- Mastery credit idempotent
- no duplicate leaderboard submission
- no economy/theme runtime references
- numeric `coins` suit preserved
- local play still works with unavailable Yandex SDK

## 21. File-level donor map

### Port/adapt heavily from Cascade

- `src/meta/MetaSave.ts`
- `src/meta/MetaSession.ts`
- `src/meta/MetaOperations.ts`
- `src/meta/MetaJournal.ts`
- `src/meta/MetaMutationQueue.ts` as needed by the chosen session design
- `src/meta/daily/DailyWinSettlement.ts`
- `src/meta/mastery/Mastery.ts`
- `src/meta/mastery/MasteryPoints.ts`
- `src/meta/standard/StandardWinSettlement.ts`
- `src/leaderboards/LeaderboardConfig.ts`
- `src/leaderboards/LeaderboardService.ts`
- `src/leaderboards/LeaderboardSubmissionQueue.ts`
- `src/platform/services.ts`
- `src/platform/yandex.ts`
- `src/platform/GameplayActivity.ts`
- `src/settings/Preferences.ts`
- product-facing Home/Daily/Mastery/Leaderboards/Settings view models and layout logic
- product bridge pattern

### Adapt, do not copy blindly

- Phaser scene classes/components
- Home/scene shell rendering
- HUD controls
- WinOverlay
- ActiveGameSave/Repository payload
- Daily seed/catalog adapters
- leaderboard encoding values that depend on Trifold result semantics

### Keep Trifold-owned

- game rules/model
- board renderer and card interactions
- solver/hints core
- deal catalog/proof/generation
- tutorial move scenarios
- card assets/faces

### Remove from Trifold

- `src/theme/*`
- `src/meta/economy/*`
- `src/ui/themes/*`
- `src/ui/scenes/ThemesScene.ts`
- `src/ui/components/CoinPill.ts`
- payment/purchase/reward-double-only code
- corresponding tests/assets/localization

## 22. Acceptance criteria

The migration is complete when all of the following are true:

1. There is no reachable Themes/shop/coin-currency UI or code path.
2. Product/profile schemas contain no currency/theme ownership fields.
3. Search confirms no dead payment/theme/economy imports remain, excluding the legitimate numeric `coins` suit.
4. Trifold rules, solver, deal catalog and gameplay behavior pass unchanged tests.
5. Standard/Daily/Mastery/leaderboards follow the Cascade-derived product model.
6. Yandex platform behavior uses the Cascade-derived wrapper and fails soft when unavailable.
7. Hint is free and not ad-gated.
8. Home has Leaders instead of Themes.
9. Active game save/resume works after persistence migration.
10. Desktop and mobile-landscape layouts remain playable.
11. Visual QA can reproduce the agreed screen/state catalog and capture screenshot matrices automatically.
12. Full TypeScript/build/test suite passes with no intentionally ignored failures.

## 23. Deliberate sequencing decision

Do not build the Visual QA catalog around the current Themes/coin product model. First remove obsolete product concepts and migrate the shell; then create fixtures for the product that will actually ship.

Likewise, do not start the future Trifold visual redesign until the QA harness can capture a stable baseline of the migrated product.
