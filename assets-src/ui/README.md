# Trifold interface art

Two authored raster masters, generated from the user-supplied concept direction on 2026-09-15:

- `jade-master.png`: dark jade silk, gilded mountains/pagoda/moon and plum blossom at the periphery. The left upper-middle is reserved for live branding; the right side is quiet.
- `paper-master.png`: ivory rice paper and a shan shui landscape around the bottom corners. No baked labels, controls or borders.

These are source artwork, not runtime screenshots. Keep them so assets can be rebuilt without more generation.

## Build

Requires Python 3 + Pillow and Node.js. From the project root:

```sh
python tools/ui/build-ui-art.py
node tools/ui/build-ui-motifs.mjs
```

Output: `public/assets/ui/art`. The five raster assets total **401,474 bytes**; the exact per-file dimensions and sizes are in `manifest.json`. SVG rank medallions and the calendar illustration are code-authored UI motifs, not new game card assets.

| Asset | Usage |
| --- | --- |
| jade-landscape.webp | Shared menu background; subdued under the game table |
| paper-landscape.webp | Illustrated panels, Home tiles and hero |
| material.webp | Neutral rounded nine-slice shared by buttons/panels |
| paper-grain.webp | Fine repeated grain; never stretched with the panel |
| table-grain.webp | Mirrored seamless neutral grain used by the fixed table appearance |
| rank-*.svg | Six distinct rank medallions and Home's actual current rank |
| daily-calendar.svg | Calendar motif with a live date drawn in code |

## Composition rules

- `SceneBackdrop` and `coverCrop` preserve illustration proportions at every aspect ratio.
- `UiSurface` stretches only the neutral material. Paper grain is tiled; full illustrations use aspect-preserving crop. Frames are drawn at destination size.
- Buttons use paper/jade/gold tints and normal/hover/pressed/disabled feedback; no generated state sheets. Selected segments also have a persistent gold underline.
- Labels and dates remain localized/live text. Paper is quieter under long text than on navigation cards.
- Home uses three equal destination tiles below the Standard module.
- Existing gameplay cards, card-building tools and saves are unchanged. Card sizes and positions are preserved; the three dragon controls now form a vertical column as requested in the original-game reference.

## Validation

`pnpm test` and `pnpm build`. Browser inspection covers 1440×900 desktop, 844×390 and 667×375 touch at DPR 2, plus saved Home and replacement confirmation. Screenshots are in `artifacts/ui`; these are development captures, not shipped assets. The local Yandex SDK route can return 404 without affecting the guest UI.
