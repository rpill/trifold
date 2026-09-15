# Offline card builder

`build-cards.mjs` creates final card PNGs before the game runs. Phaser only loads the generated whole-card textures; it does not assemble frame/art/corners at runtime.

The builder is intentionally dependency-free and uses Node's built-in `zlib`, so there is nothing extra to install beyond the project's normal Node/pnpm setup.

Configuration: `card-build-config.mjs`.
PNG implementation: `png-tools.mjs`.
