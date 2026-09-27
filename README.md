# Trifold

Trifold is a Shenzhen-style solitaire for Yandex Games. The project keeps its own gameplay engine (tableau, free cells, special slot, three dragon families, foundations, verified deals and solver/hints) and uses the Cascade-derived product shell for persistence, Daily, Mastery, leaderboards, settings, Yandex integration and product navigation.

There is no shop, soft-currency economy or cosmetic theme system. The word `coins` still appears in gameplay code because it is the name of one numeric card suit, not a product currency.

## Product surface

- Standard game with Easy / Medium / Hard product difficulty.
- Daily with trusted-date scheduling, official first-result semantics, replay and archive history.
- Mastery progression and Mastery leaderboard.
- Daily result / streak leaderboards.
- Guest-to-authorized profile rebind and Yandex player storage.
- Free solver-backed Hint, Undo, restart/new-deal flow and WinOverlay.
- RU / EN settings and onboarding/how-to-play flow.
- Desktop and mobile-landscape responsive layouts with HiDPI rendering.

## Run locally

Install dependencies and run the normal local server:

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` intentionally runs without the Yandex Games SDK and uses guest/fallback platform services.

To test the Yandex Games SDK development proxy and mocks:

```bash
pnpm dev:yandex
```

This starts Vite on `http://127.0.0.1:5173` and the Yandex proxy on `https://localhost:8080`. Open the proxy URL. The first launch can require accepting the local HTTPS certificate warning.

Production build:

```bash
pnpm build
```

## Tests

The project test command rebuilds the native deal solver and then runs the Node test suite:

```bash
pnpm test
```

Verified-deal tooling is available through the `deals:*` package scripts.

## Visual QA

Trifold includes a declarative DEV-only Visual QA harness. It launches the real production scenes against isolated deterministic in-memory fixtures; fixtures do not write to normal local/cloud profile storage.

Main commands:

```bash
pnpm visual-qa:capture
pnpm visual-qa:capture -- --scenario home-fresh --viewport 844x390-touch
pnpm visual-qa:gallery -- --input visual-qa/current/<run-id>/manifest.json
pnpm visual-qa:dim -- --input visual-qa/current/<run-id>/manifest.json --factor 0.65
```

The standard viewport matrix is:

- `1920x1080`
- `1366x768`
- `1280x640` (short-height desktop stress)
- `844x390-touch`
- `915x412-touch`

Scenario coverage and review policy are documented in [`docs/visual-qa/SCENARIOS.md`](docs/visual-qa/SCENARIOS.md).

## Rebuild card assets

Card faces are assembled offline. Source layers live under `assets-src/cards/`; generated whole-card PNGs live under `public/assets/cards/generated/` when those source assets are present.

```bash
pnpm cards:build
```

To move or resize dragon art, edit `tools/cards/card-build-config.mjs`. To change the art itself, replace the transparent dragon source layers and rebuild.

## Card notation

- `R1..R9` — coins
- `G1..G9` — bamboo
- `B1..B9` — characters
- `RD / GD / BD` — red / green / blue dragons
- `F` — flower

Here `coins` is strictly the gameplay suit name.

## UI art

UI art source builders live under `assets-src/ui/` and `tools/ui/`. Runtime UI assets are under `public/assets/ui/`.

## Audio

Optional SFX use these paths under `public/assets/audio/sfx/`:

```text
card-touch-1.ogg
card-place-1.ogg
card-place-2.ogg
card-place-3.ogg
card-place-4.ogg
deal-1.ogg
deal-2.ogg
deal-3.ogg
deal-4.ogg
undo-1.ogg
undo-2.ogg
button.ogg
victory.ogg
```

Missing optional SFX do not crash development gameplay.

## Architecture and migration docs

The current Cascade product-shell migration specification and implementation plans are under `docs/superpowers/`. Earlier product documents that prescribed the removed economy/theme system were deleted so they cannot be mistaken for current requirements.
