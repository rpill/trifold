# Trifold Visual QA scenarios

The Visual QA harness runs **real production scenes** against deterministic in-memory fixtures. It is available only in Vite DEV builds with an explicit `?visualQa=<scenario>` query. Fixtures never write to the normal browser/cloud profile.

## Viewports

| ID | Size | Input |
| --- | ---: | --- |
| `1920x1080` | 1920×1080 | mouse |
| `1366x768` | 1366×768 | mouse |
| `1280x640` | 1280×640 | mouse / short-height stress |
| `844x390-touch` | 844×390 | touch-primary mobile landscape |
| `915x412-touch` | 915×412 | touch-primary mobile landscape |

## Scenarios

### Home
- `home-fresh` — new profile.
- `home-progress` — progressed mastery/standard profile.

### Game
- `game-short-columns` — compact tableau.
- `game-long-columns` — long-column stress layout.
- `game-free-cells-full` — all free cells occupied.
- `game-dragons-red-ready` / `game-dragons-green-ready` / `game-dragons-white-ready` — four visible dragons of one family.
- `game-auto-collect` — dragon collection available.
- `game-hint` — standard session marked assisted and suitable for hint UI.
- `game-win` — completed board / WinOverlay state source.

### Daily
- `daily-unsolved` — current Daily before completion.
- `daily-solved` — official result exists.
- `daily-replay` — repeated Daily attempt state.
- `daily-archive` — archive month fixture.

### Mastery
- `mastery-novice`, `mastery-mid`, `mastery-master` — progression stages.
- `mastery-rank-up` — rank-up fixture source.

### Leaderboards
- `leaderboard-loading`, `leaderboard-own`, `leaderboard-empty`, `leaderboard-unavailable`.

### Settings
- `settings-ru`, `settings-en`.

All scenarios currently target `all` viewport presets. Scenario-specific interactions can be added declaratively through `VisualQaInteraction`; UI targets must be registered through the dev-safe target registry rather than by creating QA-only layouts.

## Commands

```bash
pnpm visual-qa:capture
pnpm visual-qa:capture -- --scenario home-fresh --viewport 844x390-touch
pnpm visual-qa:gallery -- --input visual-qa/current/<run-id>/manifest.json
pnpm visual-qa:dim -- --input visual-qa/current/<run-id>/manifest.json --factor 0.65
```

Capture fails non-zero when page/runtime errors occur and records them in the versioned manifest. The runner waits for the DEV ready marker and then for a visually stable frame before writing the PNG.

## Baseline policy

A migrated-product baseline is accepted only from a real Vite/Phaser run. Synthetic pages are never substituted for application screenshots. Generated screenshot directories are normally kept outside source control; source/docs and the scenario catalog are the durable baseline definition.

## Manual visual review checklist

Review at minimum:
- long mobile columns and all free-cell / dragon states;
- Daily solved/replay/archive;
- Mastery rank-up and MASTER-equivalent progression state;
- leaderboard unavailable / own-result states;
- WinOverlay;
- Settings EN;
- text clipping and touch target size at 844×390;
- dimmed screenshots for controls that differ mainly by lightness.
