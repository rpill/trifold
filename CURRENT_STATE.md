# Trifold — current state

## Architecture

Trifold now uses its own solitaire gameplay core together with a Cascade-derived product shell.

### Trifold-owned gameplay

- `TrifoldGame` / `TrifoldRules`
- cards, dragon families, free cells, special slot and foundations
- deal catalog / solver / hint search
- board rendering and Trifold-specific table geometry

### Product shell

- `MetaSave` + `MetaSession`
- separate `ActiveGameRepository`
- legacy-profile migration into the current meta model
- Standard and Daily session settlement
- Mastery progression
- Daily / streak / mastery leaderboards
- Yandex auth, player storage, trusted time, lifecycle and interstitial boundary
- Home / Daily / Mastery / Leaderboards / Settings product scenes
- `TrifoldProductBridge` as the UI-to-product boundary

The removed shop, soft-currency economy and cosmetic theme product do not have runtime paths. The gameplay suit named `coins` remains intentionally.

## DEV / Visual QA

`src/dev/visual-qa/` contains the declarative scenario catalog, deterministic fixtures, viewport presets and interaction registry.

`tools/visual-qa/` contains capture, gallery and dim-pass tooling. See `docs/visual-qa/SCENARIOS.md`.

The screenshot runner uses the real Vite/Phaser app and explicit DEV launch state. Browser/runtime errors are written into the capture manifest and fail the run.

## Verification performed in the migration workspace

- Native deal solver build: PASS.
- Available Node suite: 458 / 458 PASS after product migration, persistence self-review fixes and cleanup.
- Visual QA catalog / fixtures / interactions / tooling contracts: 28 / 28 PASS.
- Product-removal / legacy cleanup contract: 5 / 5 PASS.
- High-risk persistence / Daily / Mastery / leaderboard / Yandex / active-game regression slice: 61 / 61 PASS.

The migration workspace did not contain installed project dependencies (`pnpm` is not installed in this container) and its Chromium navigation was blocked by administrator policy. Therefore `pnpm build` and a real Vite/Phaser Visual QA screenshot baseline remain local-machine verification gates; no synthetic screenshots are presented as an accepted baseline.

## Required local final gate

With dependencies installed on a normal development machine:

```bash
pnpm build
pnpm test
pnpm visual-qa:capture
pnpm visual-qa:gallery -- --input <manifest>
pnpm visual-qa:dim -- --input <manifest> --factor 0.65
```

Then inspect desktop and mobile-landscape critical states listed in `docs/visual-qa/SCENARIOS.md`.
