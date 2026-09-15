# Trifold UI/UX Design Specification

**Status:** Approved in conversation on 2026-09-14.

## Purpose

Build the complete Trifold interface as a production-shaped schematic UI first, preserving real desktop and mobile-landscape proportions. Final art assets are layered on later without changing navigation, geometry, information hierarchy, or gameplay layout.

This spec supplements `2026-09-14-trifold-meta-progression-design.md`. Domain rules remain owned by the five meta implementation plans; this document defines presentation, responsive layout, navigation, and view-state contracts.

## Visual Direction

- Preserve the approved quiet East-Asian paper/ink direction: deep teal-green table/background, warm parchment panels, muted gold accents, dark ink typography, restrained landscape/temple/floral motifs.
- The UI must not look like generic casino solitaire, but identity comes from composition, typography, card art, restrained decoration, and theme surfaces—not oversized ornaments.
- Current implementation is schematic: programmatic parchment panels, borders, flat placeholders, icon glyphs, and text are acceptable.
- Final art will later replace background illustration, paper textures, icons, card faces/backs, and theme decoration through asset hooks.
- Do not alter gameplay geometry just to accommodate decoration.

## Responsive Profiles

The product has two intentional layouts, not one scaled layout:

- `desktop`: mouse/keyboard-oriented wide layout, target reference 1920×1080.
- `mobile-landscape`: touch-oriented landscape layout, target reference 1280×720 and smaller phones such as 844×390.

Responsive selection is centralized. Use viewport dimensions plus touch-primary/platform information; scenes must not each invent breakpoints.

## Canonical Home Layout

Home geometry is frozen and must not be reinvented in later concept passes.

### Desktop

- Left ~38%: TRIFOLD branding and quiet illustrative space.
- Right ~55%: dashboard stack.
- Dashboard hierarchy:
  1. one wide `Continue` or `Play` card;
  2. one row containing equal `Daily` and `Mastery` cards;
  3. one wide `Themes` card.
- Service actions `Leaderboard`, `How to Play`, `Settings` are small icon buttons at the upper-right and never become full-width menu rows.
- `Continue` shows saved Standard context; without a saved game it becomes `Play` and exposes the selected Easy/Medium/Hard context.
- Daily visually gains emphasis while today's Daily is incomplete.

### Mobile Landscape

- Left ~35%: branding/illustration.
- Right ~65%: compact dashboard.
- Same hierarchy as desktop: wide Continue/Play, Daily+Mastery pair, wide Themes.
- Do not collapse Home into a centered vertical list.
- Touch targets are larger, text is shorter, and spacing is denser than desktop.

## Standard Game Screen

- Preserve the currently approved `ViewportLayout`, card/tableau proportions, drag geometry, top slot positions, dragon controls, and mobile HiDPI strategy.
- Add meta HUD without squeezing or recentering the board unpredictably.
- HUD shows difficulty, moves, active timer, coins where appropriate, Home, Undo, New Deal, Hint, and Settings.
- `New Deal` remains directly accessible and never hides inside overflow.
- Desktop may distribute service actions around the board margins; mobile uses compact fixed action groups that do not overlap tableau cards.
- Finished/blocked states and overlays must lock input consistently.

## Win Presentation

- Win is an overlay over the same table, not a separate decorative scene.
- Standard: moves, active time, base coins, optional Mastery progress/rank-up, assisted marker, `New Deal`, `Home`, and optional `×2 coins` rewarded action.
- Daily: official first result (when applicable), personal best, streak, coins, leaderboard placement when available, `Replay`, `Home`.
- The overlay must be compact enough that the table remains recognizable behind it.

## Daily Screen

Desktop and mobile both use a two-column information layout rather than a long menu:

- summary column: current date status, streak, today's Daily CTA/result, archive explanation;
- calendar column: month grid with 90-day archive, completed-on-time distinction, archive completions, current day emphasis;
- top service area: Home/back and coin balance; leaderboard entry remains secondary.
- desktop reference split ~34/66; mobile-landscape reference split ~38/62 with smaller typography and scroll only inside the calendar/history region when necessary.

## Mastery Screen

- Show current rank as the dominant identity.
- Show exact stage-local requirements, never a vague XP bar alone.
- Requirements render as literal counters such as `Hard 18 / 25`, `Daily 3 / 5`.
- Show next-rank reward and the six-rank path in a compact progression strip.
- Desktop: central parchment panel with rank identity on one side and requirements/reward on the other.
- Mobile landscape: same data in a two-column compact card, never a tall vertical rank list.

## Themes / Shop Screen

- Header: Home/back, `Themes`, coin balance, and coin-pack entry.
- Base theme plus six paid themes.
- Desktop: three theme cards per row when width permits.
- Mobile landscape: two theme cards per row.
- Each card shows preview surface/card-back placeholder, theme name, active/owned state, and exactly one primary action (`Apply` or price).
- No `Buy` text is required when the price button with coin icon is sufficient.
- Final theme art is not required for structural implementation; stable theme IDs and asset hooks are.

## Leaderboards Screen

- Three compact tabs: `Daily`, `Streak`, `Mastery`.
- Guest state remains usable and explains sign-in only where submission/cloud functionality requires it.
- Rows are compact; player row is visually highlighted.
- Do not create unrelated Standard seed leaderboards.

## Settings and How to Play

- Both are overlays over the current scene when opened from gameplay; from Home they may use the same reusable modal shell.
- Settings remains small: audio/settings available in the product, auth/cloud status when platform integration exists.
- How to Play uses short paged rules/cards and can replay the interactive tutorial.
- Neither becomes a separate oversized navigation destination on Home.

## Tutorial and Hint Presentation

- Tutorial overlays the first onboarding game and never leaves the live table.
- Tutorial callouts must not block the target card/slot.
- Hint highlights exactly one solver-selected decision and does not perform it.
- Hint and tutorial visual treatments are distinct from selected/active gameplay controls.

## UI Component Contract

Create shared components/tokens for:

- paper panel/card;
- primary action card;
- dashboard tile;
- icon button;
- coin pill;
- progress meter/counter;
- segmented difficulty control;
- modal shell;
- scroll region;
- theme preview card.

Components receive semantic state and layout rectangles; they must not read domain services directly.

## Navigation Contract

Canonical routes:

- `home`
- `standard`
- `daily`
- `mastery`
- `themes`
- `leaderboards`

Settings/How-to/Win/Tutorial/Hint are overlays, not routes.

Returning Home is one action from every major screen. Starting/continuing Standard or Daily must not require unnecessary intermediate menus.

## Asset Hooks

Schematic rendering must expose stable hooks for later replacement:

- home background/illustration;
- parchment/panel texture;
- title/logo lockup;
- service icons;
- rank badges;
- Daily calendar markers;
- theme preview art;
- theme table/background/card-back/slot art.

Replacing these assets must not alter scene layout code.

## Accessibility and Interaction

- Mobile interactive targets target at least 44 CSS px on the short axis after CSS scaling.
- Text must remain readable over decorative art; dashboard regions require quiet backing surfaces.
- Hover is enhancement only; every hover affordance has a touch-visible equivalent.
- Disabled, available, selected, completed, and rewarded states must remain distinguishable without relying only on red/green color.
- No button may overlap cards at supported desktop/mobile reference sizes.

## Implementation Order

Use vertical slices, interleaving this UI plan with the existing domain plans:

1. UI foundation + navigation shell.
2. Meta Core domain + Home + Standard HUD + Win overlay.
3. Daily domain + Daily screen.
4. Mastery presentation completion.
5. Economy/theme domain + Themes/Shop.
6. Yandex platform + Leaderboards/auth/cloud/payment UI states.
7. Hint/tutorial domain + overlays.
8. Final responsive regression pass.
9. Final assets applied later without changing approved geometry.

## Non-Goals for the Schematic Pass

- final card illustrations;
- final background paintings;
- final theme art;
- final icon set;
- animation polish beyond functional transitions;
- Prestige UI (post-launch).
