# Trifold

First playable technical core for a Shenzhen-style solitaire game for Yandex Games.

## Run locally

Install dependencies and run the normal fast local server:

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` intentionally runs without Yandex Games SDK and uses the guest/fallback platform services.

To test against the official Yandex Games SDK dev proxy and its mocks:

```bash
pnpm dev:yandex
```

This starts Vite on `http://127.0.0.1:5173` and the Yandex proxy on `https://localhost:8080`.
Open the proxy URL, not the Vite URL. The first launch may require accepting the local HTTPS certificate warning.
The proxy package is downloaded by `pnpm dlx` on first use and then reused from pnpm's cache.

Yandex dev mode supports mock authorization, ads, localStorage-backed player data and leaderboards.
You can also pass SDK mock options in the proxy page URL, for example:

```text
https://localhost:8080/?mocks={"isAuthorized":true,"lockedOrientation":"landscape"}
```

Production build:

```bash
pnpm build
```

Development mode uses deterministic sequential seeds. Production mode intentionally refuses to invent random deals and requires a solver-verified catalog through `window.__TRIFOLD_VERIFIED_DEALS__`; catalog generation is a separate follow-up milestone.

## Rebuild card assets

Card faces are assembled **offline**, not inside Phaser. Source layers live under `assets-src/cards/`; generated whole-card PNGs live under `public/assets/cards/generated/`.

```bash
pnpm cards:build
```

To move/resize the dragon art, edit `tools/cards/card-build-config.mjs`. To change the art itself, replace the transparent PNGs in `assets-src/cards/dragons/` and run the command again.

## Temporary card notation

- `R1..R9` — coins
- `G1..G9` — bamboo
- `B1..B9` — characters
- `RD / GD / BD` — red / green / blue dragons
- `F` — flower

The visuals are intentionally schematic. Card interaction, animation cadence, responsive layout and HiDPI behavior are the parts being validated in this milestone.

## Cascade SFX drop-in

Place the supplied audio files under `public/assets/audio/sfx/` with these names:

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

Missing SFX are optional in development and do not crash the board.

## Core contracts

The approved design and implementation plan are in `docs/superpowers/`.
