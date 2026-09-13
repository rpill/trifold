# Trifold

First playable technical core for a Shenzhen-style solitaire game for Yandex Games.

## Run locally

```bash
pnpm install
pnpm test
pnpm dev
```

Production build:

```bash
pnpm build
```

Development mode uses deterministic sequential seeds. Production mode intentionally refuses to invent random deals and requires a solver-verified catalog through `window.__TRIFOLD_VERIFIED_DEALS__`; catalog generation is a separate follow-up milestone.

## Temporary card notation

- `R1..R9` — coins
- `G1..G9` — bamboo
- `B1..B9` — characters
- `RD / GD / WD` — the three dragon families
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
