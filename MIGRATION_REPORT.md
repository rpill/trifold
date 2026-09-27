# Trifold Cascade Product-Shell Migration Report

## Result

Trifold keeps its own solitaire gameplay core and now uses the Cascade-derived product shell for meta progression, persistence, Daily, Mastery, leaderboards, Yandex integration, product navigation, settings and DEV/Visual QA.

### Removed product systems

- cosmetic Themes runtime/UI
- shop and purchases
- soft-currency balance/rewards
- reward doubling
- payments/reconciliation paths
- legacy runtime ProfileRepository / LocalProfileStore / CloudProfileStore

The gameplay numeric suit named `coins` is intentionally preserved.

### Added / migrated product architecture

- `MetaSave`, `MetaSession`, `MetaJournal`, idempotent meta operations
- one-time legacy-profile migration
- separate `ActiveGameRepository`
- guest → authorized Yandex profile rebind with merge
- Standard and Daily session controllers + settlements
- Daily trusted-date schedule, first official result, replay/archive, streak
- Mastery progression and rank model
- Daily / streak / mastery leaderboard services + coalescing submission queue
- free solver-backed Hint
- Standard interstitial policy at the fresh-deal boundary
- analytics without economy/theme events
- `TrifoldProductBridge` as UI/product boundary
- Home / Daily / Mastery / Leaderboard / Settings product-shell cutover
- responsive desktop + mobile-landscape layout updates

### DEV / Visual QA

Added a DEV-only declarative Visual QA subsystem:

- scenario catalog
- deterministic isolated fixtures
- viewport presets
- dev-safe interaction/target registry
- capture manifest contract
- gallery generator
- dim-pass generator
- documented scenario matrix

See `docs/visual-qa/SCENARIOS.md`.

## Verification in this workspace

Fresh final verification after self-review fixes:

- native solver build: PASS
- complete available Node suite: **458 / 458 PASS**
- Visual QA contracts: **28 / 28 PASS**
- product-removal / legacy cleanup contract: **5 / 5 PASS**
- high-risk persistence/product slice: **61 / 61 PASS**

The final self-review found one Important persistence edge: migrated legacy progress could have been lost for the current session when initial platform persistence failed. It was fixed RED→GREEN; migrated local state now remains the live `MetaSession` with `status=ready` and `saveError=true` during platform storage outage.

## External verification gates

This container did not have project `node_modules`/`pnpm`, and package registry access was unavailable. System Chromium navigation was also blocked by administrator policy. Therefore these checks were **not** claimed here:

```bash
pnpm build
pnpm visual-qa:capture
pnpm visual-qa:gallery -- --input <manifest>
pnpm visual-qa:dim -- --input <manifest> --factor 0.65
```

Run on the normal development machine:

```bash
pnpm install
pnpm build
pnpm test
pnpm visual-qa:capture
pnpm visual-qa:gallery -- --input <manifest>
pnpm visual-qa:dim -- --input <manifest> --factor 0.65
```

Then inspect the critical desktop/mobile-landscape states listed in `docs/visual-qa/SCENARIOS.md`.

## Notes

- Phaser remains **3.90**; no Phaser 4 migration was mixed into this product migration.
- Visual styling has not been redesigned yet. The new Visual QA harness is intended to support the next concept → approved reference → implementation milestone workflow.
- Legacy schema/migration code remains only where required to safely import old saves.
