# Numeric card source modules

The numeric cards are assembled offline by `pnpm cards:build`.

- `ranks/1.png` ... `ranks/9.png`: reusable monochrome rank masks.
- `suits/coins.png`, `suits/bamboo.png`, `suits/characters.png`: reusable monochrome suit masks.
- Colors, placement and sizing live in `tools/cards/card-build-config.mjs`.

You can replace any source PNG and rerun `pnpm cards:build` to regenerate all affected cards.
