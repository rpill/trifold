# Trifold card sources

These are **source assets** for the offline card builder. The game does not load these files directly.

## Build cards

```bash
pnpm cards:build
```

The command runs `tools/cards/build-cards.mjs` and writes the finished game textures to:

```text
public/assets/cards/generated/
  dragon-red.png
  dragon-green.png
  dragon-blue.png
```

## Edit a dragon yourself

Replace or edit any of these files in Photoshop/Affinity/etc.:

```text
assets-src/cards/dragons/red-center.png
assets-src/cards/dragons/red-corner.png
assets-src/cards/dragons/green-center.png
assets-src/cards/dragons/green-corner.png
assets-src/cards/dragons/blue-center.png
assets-src/cards/dragons/blue-corner.png
```

Then run `pnpm cards:build` again.

The source PNGs may have any dimensions. Keep transparency around the artwork; the builder preserves aspect ratio and fits the artwork into the configured boxes.

## Move or resize artwork

Edit `tools/cards/card-build-config.mjs`.

- `center` controls the large central dragon.
- `topLeftCorner` controls the exposed corner emblem.
- `bottomRightCorner` controls the lower emblem and rotates it 180 degrees.

All values are pixels in the 868×1353 master card coordinate system.

## Card frame

`frame/face.png` is the exact approved 868×1353 card frame. The builder copies it at native size and composites the art on top; it is never stretched.
