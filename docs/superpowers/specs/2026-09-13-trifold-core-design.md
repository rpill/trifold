# Trifold Core Design

Date: 2026-09-13
Status: approved

## 1. Goal

Build **Trifold**, a new Yandex Games solitaire using the rules and moment-to-moment behavior of Shenzhen Solitaire while reusing only the proven interaction, animation, responsive rendering, HiDPI, and sound behavior from Cascade Solitaire.

Trifold is a new clean project, not a rules mutation of Cascade. Cascade gameplay systems such as stock/waste, four-suit foundations, its deal model, themes, shop, progression, current solver, and Cascade-specific UI are not carried over unless explicitly requested later.

The first playable milestone is intentionally asset-free. Cards and slots are schematic so that rules, controls, animations, mobile behavior, and deal infrastructure can be validated before visual production starts.

## 2. Fixed product decisions

- Name: **Trifold**.
- Platform target: Yandex Games.
- Desktop and mobile are both supported from the first playable build.
- Mobile gameplay is **landscape-only**.
- Card feel must match Cascade: drag behavior, animation timing, easing, deal cadence, snap-back, input locking, depth handling, and sound cues.
- Cascade's responsive/HiDPI solution is part of the base architecture, not a later mobile adaptation.
- Undo is present even though it is not part of the original Shenzhen I/O release.
- One Undo reverses one player transaction, including every automatic move triggered by that player action.
- Automatic behavior follows Shenzhen-style play: flower auto-clears; safe numeric cards auto-clear to their foundations; dragon removal is initiated by the player via the matching dragon control.
- Production deals come only from a solver-verified deterministic catalog. Runtime does not generate unverified random games.

## 3. Scope of the first playable milestone

The milestone contains only what is necessary to validate the game itself:

- one playable Trifold board;
- new-game action;
- undo;
- Shenzhen-compatible tableau/free-cell/foundation/flower/dragon rules;
- automatic flower and safe numeric foundation moves;
- player-triggered dragon removal;
- deterministic seeded deals;
- a temporary development deal source before the verified catalog is populated;
- schematic card rendering;
- Cascade-equivalent card interaction, animation, audio hooks, responsive layout, HiDPI rendering, and mobile landscape handling;
- rule/model tests and interaction/layout regression tests.

Not in this milestone: final art, themes, shop, monetization, daily mode, leaderboard, statistics, localization polish, onboarding, analytics product events, progression, hints, or final Yandex shell UI.

## 4. Card model and board state

### 4.1 Deck

The Trifold deck has 40 cards:

- three numeric suits, each containing ranks 1 through 9: 27 cards;
- three dragon families, four identical cards per family: 12 cards;
- one flower card: 1 card.

Every physical card receives a stable unique ID even when multiple dragon cards share the same family. Stable IDs are required for animation ownership, undo, serialization, solver proofs, and deterministic tests.

### 4.2 Board zones

The authoritative game state contains:

- `tableau[8]`: eight columns;
- `freeCells[3]`: three single-card holding cells;
- `foundations[3]`: one numeric foundation per suit;
- `flowerFoundation`: empty or completed;
- dragon-family completion state for all three dragon families;
- deal seed / deal identity;
- transaction history for Undo.

Initial deal: all 40 cards are dealt face-up into eight tableau columns of five cards each.

There is no stock, waste, hidden card, or face-down reveal mechanic.

## 5. Rules engine boundaries

The game model and rules must be independent of Phaser. Phaser code must never be the source of truth for whether a move is legal.

### 5.1 `TrifoldGame`

Owns mutable game state and applies validated operations. It exposes state snapshots / read-only views for rendering and testing.

Responsibilities:

- initialize a deterministic deal;
- apply tableau moves;
- move cards between tableau and free cells;
- apply numeric foundation moves;
- clear the flower;
- clear a dragon family;
- execute automatic-move waves;
- declare win state;
- create and restore Undo transactions.

### 5.2 `TrifoldRules`

Pure rule queries and move derivation. It must not know about Phaser objects, tweens, pixels, audio, persistence, or UI controls.

Responsibilities include:

- whether a card or sequence may be picked up;
- whether a card or sequence may be dropped on a tableau column;
- whether a card may enter a free cell;
- whether a numeric card may enter its foundation;
- whether a numeric foundation move is currently safe for automatic play;
- whether the flower is available for automatic clearing;
- whether a dragon family is currently removable;
- which legal automatic move should execute next;
- whether the board is complete.

Rules tests operate directly on this layer without launching Phaser.

## 6. Tableau movement

Numeric tableau runs are descending and alternate suit/color family according to Shenzhen rules. A valid exposed run may be moved as one unit.

Unlike FreeCell-style capacity rules, movable run length is not limited by the count of empty free cells or empty tableau columns. If the exposed cards themselves form a legal movable sequence, the full sequence can be dragged together.

Dragon cards do not form numeric sequences. The flower does not form numeric sequences.

Empty tableau behavior must match Shenzhen semantics and will be encoded explicitly in `TrifoldRules`, with tests covering numeric cards, dragons, flower, and sequences moved into empty columns where legal.

## 7. Free cells

There are exactly three free cells. A normal free cell holds at most one movable card.

A dragon-family clear consumes one free-cell position permanently for that deal, matching Shenzhen's dragon-removal mechanic. The UI should distinguish a dragon-cleared cell from a normal temporary card without relying on final artwork.

A dragon clear may only occur when its Shenzhen rule preconditions are satisfied. The player initiates the clear through the corresponding dragon-family control; it is not part of the automatic-move wave.

## 8. Foundations and automatic moves

### 8.1 Flower

When the flower becomes available under Shenzhen rules, it clears automatically to its dedicated flower slot.

### 8.2 Numeric foundations

There is one numeric foundation per suit. Numeric cards advance from rank 1 upward.

Manual foundation behavior and automatic foundation behavior use the same underlying rule validation. Automatic movement adds a separate safety predicate so that Trifold does not prematurely remove a card that is still needed to build a legal tableau sequence.

The automatic wave continues until no further flower or safe numeric move is available.

### 8.3 Animation ordering

Automatic moves are represented as model operations first, then animated in deterministic order. Rendering must not mutate the model halfway through a tween.

Input remains locked while a committed move / auto-move wave is being animated, matching Cascade's transaction feel and preventing model/view divergence.

## 9. Transactional Undo

Each user action opens one transaction:

1. capture the pre-action state needed for reversal;
2. commit the player's legal action;
3. resolve all resulting automatic flower / numeric moves until stable;
4. close the transaction;
5. animate the committed operation list.

One press of Undo restores the state before step 2, including every automatic move that occurred because of that player action.

Examples:

- moving one card that triggers two numeric auto-clears is one Undo;
- moving a sequence that exposes the flower and then several safe numeric cards is one Undo;
- pressing a dragon-family control and completing its clear is one Undo;
- an invalid drag creates no transaction.

Undo animation uses the same Cascade timing and motion semantics as a normal undo rather than instantly teleporting cards.

## 10. Cascade systems to reuse

Reuse behavior and, where sensible, directly adapt focused modules rather than copying the whole Cascade game scene.

### 10.1 Card interaction and motion

Preserve the established Cascade feel, including:

- drag-distance threshold behavior;
- pointer/touch drag handling;
- grouped dragging of a valid exposed sequence;
- drag depth ordering;
- committed-drop geometry;
- snap-back / return when the drop is invalid;
- input locking during committed animation;
- double-click/tap handling only where Trifold has a matching action;
- player move duration: 110 ms;
- Undo duration: 110 ms;
- initial-deal flight duration: 260 ms;
- initial-deal stagger: 52 ms;
- automatic-foundation flight duration: 350 ms;
- Cascade easing (`Cubic.easeOut`) and equivalent depth transitions.

The stock-specific naming in Cascade must not leak into Trifold's domain model. Initial Trifold dealing can reuse the animation cadence while originating from a neutral off-board/deck origin.

### 10.2 Sound

Reuse Cascade's SFX controller behavior and card-related cue semantics. The user will provide the existing audio files in the expected audio directory.

First milestone uses the relevant existing cues:

- `card-touch`;
- `card-place`;
- `deal`;
- `undo`;
- `button`;
- `victory`.

Cascade-only economy/progression cues are not required for the core milestone.

Missing audio files must not block model development or test execution; audio loading/wiring should fail gracefully during development until the files are supplied.

## 11. Responsive layout and mobile landscape

Mobile support is a first-class requirement. Trifold must not be implemented desktop-first and adapted afterward.

### 11.1 Layout profiles

The layout system has at least two logical profiles:

- standard / desktop landscape;
- compact mobile landscape.

The new Trifold layout must place, without overlap:

- eight tableau columns;
- three free cells;
- three numeric foundation targets;
- one flower target;
- three dragon-family controls / completion indicators;
- minimal gameplay controls such as New Deal and Undo.

The exact aesthetic arrangement is intentionally deferred, but geometry must be driven entirely from the layout result rather than hard-coded scene coordinates.

### 11.2 Landscape-only mobile behavior

Gameplay is designed for landscape. Portrait should not attempt to squeeze eight columns into an unusable board. A portrait-orientation guard may be added at the shell level, but the core board layout only guarantees desktop landscape and compact landscape profiles.

### 11.3 Resize correctness

Every resize recalculates logical geometry and then reapplies:

- card display sizes;
- tableau positions and vertical fan spacing;
- slot positions;
- dragon-control positions;
- hit areas / drop geometry;
- HUD/control positions;
- any off-board animation origins that depend on viewport size.

Resize must work for both gradual resizing and abrupt viewport/orientation changes.

## 12. HiDPI rendering

The proven Cascade HiDPI strategy is preserved.

### 12.1 Canvas plan

Use a logical CSS viewport plus a larger physical backing canvas:

- `renderScale = clamp(devicePixelRatio, 1, 2)`;
- backing width = logical width × renderScale;
- backing height = logical height × renderScale;
- Phaser uses `Scale.NONE`;
- Phaser scale zoom is the inverse render scale so the CSS footprint stays correct;
- game-space layout is scaled into backing-store coordinates;
- camera zoom remains 1 to avoid double scaling.

Keep Cascade render settings:

- antialias on;
- pixel-art mode off;
- roundPixels off.

### 12.2 Resize wiring

Keep both:

- `ResizeObserver` on the game host;
- `window.resize` fallback/listener.

Only update backing size / CSS zoom when the derived plan actually changes.

### 12.3 Schematic card sharpness

Temporary card faces must be generated/rendered at sufficient backing resolution for the active HiDPI scale. They must not be tiny raster textures enlarged on mobile.

The first milestone includes explicit regression coverage that the game preserves backing-store density and correct display size on DPR 1 and DPR 2, including abrupt resize scenarios.

## 13. Schematic first-pass visuals

No production assets are required.

Card faces should communicate only identity and interaction state. A practical temporary notation is:

- numeric suits: e.g. `R1..R9`, `G1..G9`, `B1..B9`;
- dragons: `RD`, `GD`, `BD` with four unique internal IDs per family;
- flower: `F`.

Cards remain visually distinct enough to inspect alternating-suit sequences at a glance. Slots and dragon controls are simple geometric placeholders.

This renderer is disposable. The game model and layout API must not depend on how the schematic cards are drawn so that final card assets can replace them later without rewriting rules or interaction logic.

## 14. Deterministic deals

### 14.1 Runtime representation

A deal is derived from a deterministic seed and a fixed shuffle algorithm. The shuffle algorithm is versioned/frozen once production catalogs are generated; changing it would reinterpret every stored seed.

Given the same deal version and seed, desktop, mobile, tests, solver tooling, and future builds must reconstruct the same ordered 40-card deck.

### 14.2 Development source

Before the verified catalog exists, developer builds may accept explicit seeds so rules and UI can be tested rapidly. These development seeds are not presented to players as production New Deal results unless verified.

### 14.3 Production source

Production New Deal selects only from `VerifiedDealCatalog` (or the Trifold-equivalent name). The browser does not run the solver and does not fall back to an arbitrary random seed when the catalog is unavailable.

Failure to load a verified catalog is treated as a data/configuration error, not permission to serve unverified games.

## 15. Offline solver and catalog pipeline

The solver is a new Trifold/Shenzhen solver; Cascade's Sawayama rules engine is not reused. The surrounding release pipeline should reuse the successful Cascade pattern where practical.

Target flow:

`seed candidate -> deterministic deal -> solver -> proof -> proof replay verifier -> difficulty metrics -> verified binary catalog + manifest`

Requirements:

- massively batchable/offline;
- parallel jobs;
- resumable generation/checkpointing for long scans;
- deterministic proof format;
- independent proof replay in TypeScript or another non-solver path;
- rejection of every candidate whose proof fails replay;
- compact seed storage in the browser build;
- manifest/version checks so a catalog cannot silently mismatch the shuffle/rules version.

The first playable milestone does not require a final large catalog, but it must establish the seed/shuffle contract so solver work can begin without later invalidating deals.

## 16. Difficulty data

Do not invent player-facing difficulty modes in the first milestone. However, the solver/catalog format should retain enough metrics to score deals later, such as solution length, branching/search effort, forced-move ratio, or other solver-derived measures that prove useful.

This keeps future Daily / progression / onboarding selection possible without forcing those product systems into the core implementation now.

## 17. Scene/view architecture

Recommended high-level split:

- `src/game/model/TrifoldGame.ts` — authoritative state and operations;
- `src/game/model/TrifoldRules.ts` — pure rules and move derivation;
- `src/game/model/cards.ts` — 40-card construction and stable IDs;
- `src/game/model/deal.ts` — versioned deterministic shuffle and 8x5 deal;
- `src/game/model/GameHistory.ts` or Trifold-specific equivalent — transaction history;
- `src/game/model/VerifiedDealCatalog.ts` — verified runtime seeds later;
- `src/game/view/TrifoldBoardView.ts` — Phaser card objects and animation playback;
- `src/game/view/CardAnimation.ts` — preserve/adapt Cascade timing constants;
- `src/game/view/CardFlight.ts`, `CardMotionDepth.ts`, `DropGeometry.ts` — reuse/adapt proven interaction helpers;
- `src/game/view/ViewportLayout.ts` — replace Cascade-specific geometry with Trifold geometry while preserving scaled-layout concept;
- `src/render/HiDpiCanvas.ts` — carry over essentially unchanged;
- `src/settings/SfxController.ts` — carry over relevant controller/cues;
- `src/game/scenes/GameScene.ts` — thin coordinator between model, board view, UI controls, persistence hooks later.

Names may change slightly during implementation if the clean project scaffold suggests a simpler structure, but the boundaries must remain: rules/model independent from Phaser, rendering independent from solver tooling, and layout independent from production art.

## 18. State and animation data flow

For a drag action:

1. Board view asks the model/rules which exposed cards belong to the draggable unit.
2. View follows the pointer using Cascade-style drag offsets/depth.
3. On release, view derives a logical target from drop geometry.
4. Model validates and commits the move as a transaction.
5. Model resolves automatic moves to a stable state and returns the ordered operation list.
6. View locks gameplay input and animates that operation list using Cascade timings.
7. View syncs to authoritative state after animation.
8. Input unlocks.

For invalid release:

1. no model mutation occurs;
2. dragged visuals return to their authoritative positions;
3. no Undo entry is created.

This operation-list approach prevents Phaser tween timing from becoming game logic and makes solver-proof playback/test fixtures easier later.

## 19. Persistence boundary

Core model types should be serializable from the beginning, but persistent sessions are not required before the first playable rules milestone.

When persistence is added, save logical state/deal identity/history data, never Phaser object coordinates or tween state. On restore, the board view reconstructs itself from authoritative logical state at the current viewport size.

## 20. Testing strategy

Implementation follows test-driven development.

### 20.1 Pure model tests

Cover at minimum:

- exact 40-card deck composition and unique physical IDs;
- deterministic shuffle stability;
- 8 columns × 5 cards initial deal;
- legal/illegal numeric tableau placement;
- legal movable sequence recognition;
- sequence moves independent of empty-cell count;
- free-cell limits;
- all dragon-clear preconditions and resulting occupied cell state;
- flower automatic clearing;
- numeric foundation progression;
- safe-auto-foundation predicate edge cases;
- automatic-wave termination;
- win detection;
- transaction Undo restoring exact prior logical state.

### 20.2 View/interaction tests

Adapt Cascade regression tests for:

- card motion durations;
- deal stagger;
- drag depth and snap-back;
- committed drop geometry;
- input locking during flights;
- undo animation ordering;
- audio cue wiring.

### 20.3 Responsive/HiDPI tests

Carry over and adapt the existing Cascade tests around:

- `planHiDpiCanvas`;
- DPR clamp to 2;
- `Scale.NONE` / inverse CSS zoom wiring;
- no camera double-scaling;
- scaled viewport geometry;
- `ResizeObserver` wiring;
- mobile compact-landscape geometry;
- eight tableau columns fitting without overlap;
- abrupt resize/orientation-change relayout;
- hit/drop geometry matching the newly scaled card display size.

### 20.4 Solver pipeline tests

When solver work begins:

- solver proof can be replayed independently;
- invalid/tampered proofs are rejected;
- same seed reconstructs identical deal in tool and browser code;
- verified catalog manifest matches rule/shuffle versions;
- production selection cannot yield an unverified seed.

## 21. Error handling and invariants

Core code should fail loudly in development on impossible state rather than silently repairing it.

Important invariants:

- exactly 40 physical cards exist across all zones/completed sets;
- no physical card ID appears twice;
- each free cell contains zero or one normal card, or a completed dragon marker/set state as defined by the model;
- foundation ranks only move upward legally;
- flower completes at most once;
- a dragon family completes at most once;
- Undo restores a valid state satisfying the same invariants;
- production deal IDs resolve only through a matching verified catalog version.

User-facing runtime errors should avoid crashing the whole page where recovery is reasonable, but integrity errors in deal/model data must not be hidden by generating a random fallback game.

## 22. Migration approach from Cascade

Start a new Trifold project directory/repository from a minimal Vite + Phaser + TypeScript scaffold, then port only the approved technical modules and tests.

Do not begin by deleting features from a full Cascade fork. That path risks preserving hidden assumptions such as 52-card counts, stock/waste state, four foundations, theme contracts, economy hooks, and Cascade persistence structures.

Port order:

1. clean app/bootstrap + HiDPI canvas shell;
2. Trifold pure card/deal/rules model;
3. schematic card renderer and Trifold viewport layout;
4. Cascade card interaction/motion helpers adapted to Trifold logical sources/targets;
5. initial deal animation and SFX wiring;
6. automatic move wave + transactional Undo;
7. mobile landscape regression pass;
8. deterministic seed tooling contract;
9. offline solver/proof/catalog pipeline.

## 23. Acceptance criteria for the core milestone

The milestone is accepted when all of the following are true:

- a fresh seeded game deals exactly 40 schematic cards as 8×5;
- all player-visible move rules match Shenzhen behavior selected for Trifold;
- flower and safe numeric auto-moves behave like Shenzhen;
- dragon-family clearing is player-triggered and obeys the rules;
- one Undo reverses a player action plus its entire automatic chain;
- dragging/dealing/undo/card placement feel materially identical in timing to Cascade;
- the supplied Cascade card SFX play through the carried-over controller once files are present;
- desktop resize works without geometry drift;
- compact mobile landscape works without overlapping the eight tableau columns or controls;
- DPR 2 mobile rendering stays sharp and does not reintroduce the previous card-pixelation problem;
- abrupt resize/orientation changes relayout correctly;
- deterministic seeds reproduce identical deals;
- production deal-selection architecture has no unverified-random fallback;
- `npm/pnpm test` and TypeScript build pass for the new project.

## 24. Deferred decisions

The following are intentionally deferred until the core game is proven and are not blockers for implementation:

- final visual theme and card art;
- exact branding/logo treatment;
- menu/home visual design;
- monetization;
- daily mode and deal scheduling;
- leaderboards;
- hints;
- progression/economy;
- final difficulty bands;
- final size of the verified deal catalog;
- final Yandex analytics event set.

These systems must build on the clean Trifold core rather than influencing the first implementation of Shenzhen rules and card interaction.
