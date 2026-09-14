# Trifold Verified Deals and Daily Catalog Design

Date: 2026-09-13  
Project: Trifold  
Status: approved architecture; implementation may begin after plan review.

## 1. Purpose

Trifold needs a production deal pipeline equivalent in reliability to Cascade: every shipped Standard or Daily deal must be deterministic, solved offline, replay-verified through the production TypeScript rules, scored for difficulty, and stored in a compact catalog. The browser must never solve deals and must never fall back to unchecked random production seeds.

This subsystem produces two pools in one catalog:

- **Standard:** 40,000 unique verified deals partitioned into `onboarding`, `easy`, `medium`, and `hard`.
- **Daily:** 7,305 unique verified deals mapped one-to-one to UTC dates beginning `2026-01-01` (about twenty years).

Standard and Daily must be disjoint.

## 2. Existing contracts that remain authoritative

The current game already freezes these runtime contracts:

- `createDeal(seed)` uses positive uint32 seeds, `SeededRandom` xorshift32, Fisher-Yates, and an 8 × 5 face-up deal.
- `RULES_VERSION = 1`, `SHUFFLE_VERSION = 1`, and `DEAL_FORMAT_VERSION = 1` remain unchanged unless gameplay/shuffle semantics change.
- `TrifoldGame` is the authoritative mutable rules engine.
- `TrifoldRules` is the authoritative legality/auto-move query layer.
- `TrifoldGame.perform()` resolves one player decision plus every deterministic automatic flower/safe-foundation move triggered by that decision.
- `TrifoldGame.settleInitialAutoMoves()` resolves deterministic automatic moves available immediately after the deal.
- Dragon collection uses the current corrected Shenzhen rule: all four dragons of a family must be exposed; if one matching dragon is already in a normal free cell, that exact cell is the destination; otherwise an empty normal free cell is required. A completed family cannot be collected again.

The offline solver must match these contracts. The solver is never allowed to redefine the rules by convenience.

## 3. High-level architecture

The system has five layers:

```text
uint32 seed
  -> deterministic C++ deal construction
  -> budgeted C++ Shenzhen search
  -> exact high-level proof actions
  -> TypeScript proof replay through TrifoldGame
  -> verified candidate record + difficulty metrics
  -> Standard partition / Daily schedule
  -> compact production binary + manifest
```

The browser receives only the compact binary and manifest. Solver proofs, search metrics, checkpoints, and candidate JSONL stay under ignored development artifacts.

## 4. Seed spaces and release targets

### 4.1 Source ranges

Use separate deterministic scan ranges:

- Standard candidate scan begins at seed `1`.
- Daily candidate scan begins at seed `1_000_000_001`.

Both ranges are bounded to positive uint32 values. The factory must still explicitly assert that final Standard and Daily seeds are unique and disjoint.

### 4.2 Standard target

Release target: **40,000** Standard seeds.

The exact 40k partition is:

| Tier | Count |
| --- | ---: |
| `onboarding` | 500 |
| `easy` | 13,167 |
| `medium` | 15,361 |
| `hard` | 10,972 |
| **Total** | **40,000** |

For non-40k development runs, quotas may be scaled deterministically from the same proportions while keeping onboarding capped at 500 and every non-empty tier represented.

The pathological upper tail (`difficultyScore > 95`) is excluded from Standard v1 even if solvable.

### 4.3 Daily target

Daily schedule:

- start date: `2026-01-01` UTC;
- length: `7,305` days;
- one unique seed per date;
- every Daily seed is absent from Standard.

Daily is generated now even though the Daily product UI may be implemented later. This avoids changing the catalog format later.

## 5. What “verified” means

A seed is `VERIFIED` only when all stages succeed:

1. C++ constructs exactly the same initial deal as `createDeal(seed)`.
2. C++ search returns `SOLVED`, not merely `UNDETERMINED`.
3. Solver emits a complete proof of player decisions.
4. TypeScript creates the deal with production `createDeal(seed)`.
5. TypeScript calls `settleInitialAutoMoves()` before the first proof action.
6. Every proof action resolves to an exact current source card/run and is submitted through `TrifoldGame.perform()`.
7. Every submitted command is legal (`perform()` does not return `null`).
8. Automatic operations are produced only by `TrifoldGame`; the verifier does not fake or inject them.
9. Card conservation/uniqueness invariants hold after every transaction.
10. Final production state satisfies `isWon(game.state)`.

A proof replay failure rejects the candidate even if C++ says `SOLVED`.

`UNDETERMINED` means only “budget exhausted”. It is never treated as `UNSOLVABLE` and never enters a catalog. `UNSOLVABLE` is permitted only when the solver exhausts the reachable search graph without finding a win.

## 6. Solver state and automatic normalization

The C++ search state models:

- 8 tableau columns;
- 3 stable free-cell positions, each empty, holding one card, or permanently occupied by a collected dragon family;
- numeric foundation rank `0..9` for `coins`, `bamboo`, and `characters`;
- flower completion boolean;
- collected-dragon-family state for red, green, and white.

After the initial deal and after every player decision, C++ must run the same deterministic automatic policy as TypeScript:

1. exposed flower first;
2. then the next safe numeric foundation move according to the same ordering used by `findNextAutoMove()`;
3. repeat until no automatic move remains.

Automatic moves are solver state normalization and are **not** proof decisions. TypeScript recomputes them itself during proof replay.

## 7. Proof action format

Proofs record only player decisions. The format is intentionally close to `PlayerCommand`, but tableau sources identify the root card by stable `cardId` instead of a fragile numeric index.

```ts
export type DealProofSource =
  | { readonly zone: 'tableau'; readonly column: number; readonly cardId: CardId }
  | { readonly zone: 'free-cell'; readonly cell: number; readonly cardId: CardId };

export type DealProofAction =
  | {
      readonly kind: 'move';
      readonly source: DealProofSource;
      readonly target: CardTarget;
    }
  | {
      readonly kind: 'collect-dragons';
      readonly family: DragonFamily;
    };
```

Replay rules:

- tableau `column` is the stable production column ID `0..7`;
- verifier locates `source.cardId` in that column and uses its current index as the `CardSource.index`;
- free-cell action must find exactly `source.cardId` in the recorded cell;
- target tableau/free-cell indices are stable production indices;
- a manual numeric foundation move is represented by `target.zone === 'foundation'` and is allowed only if `TrifoldGame.perform()` accepts it;
- dragon collection is represented only by family; current model rules decide sources and destination.

A corrupt card ID, wrong stable column, wrong free-cell card, illegal target, or impossible dragon collection fails replay with seed and proof-action index.

## 8. Tableau canonicalization and stable identity

To keep search tractable, the C++ solver may canonicalize tableau columns by sorting them for transposition hashing. Each search column carries:

```text
(cards, stableColumnId)
```

Sorting moves the pair together. Proof actions emit `stableColumnId`. The state hash may ignore `stableColumnId` so mechanically symmetric tableau permutations share a transposition entry.

Free cells are **not** canonicalized in v1. Their stable indices matter for player commands and dragon destinations, and there are only three cells, so preserving their identity is simpler and safer.

## 9. Search policy and budgets

The solver is an offline budgeted search with a transposition table and deterministic move ordering. It must support:

```text
--seed <uint32>
--budget <positive integer>
--proof-json
```

Result JSON:

```json
{
  "status": "SOLVED",
  "seed": 123,
  "nodes": 45678,
  "proof": []
}
```

Statuses are `SOLVED`, `UNSOLVABLE`, or `UNDETERMINED`.

Generation uses two passes:

1. fast budget;
2. slow retry for `UNDETERMINED` only.

Unlike Cascade, Trifold budgets are **not copied blindly**. The first implementation includes a calibration probe over at least 10,000 candidate seeds. Budget recommendation is deterministic:

- recommended fast budget = solved-node `P90`, rounded up to the next 10,000 nodes;
- recommended slow budget = `2 × P99`, rounded up to the next 50,000 nodes;
- slow budget must be strictly greater than fast budget;
- generated manifest records the exact budgets actually used.

If the P90/P99 sample is too small (fewer than 1,000 solved seeds), calibration is considered insufficient and production generation must not be called release-ready.

## 10. Proof replay invariants

`DealProof.ts` owns proof replay against production rules through `verifySeedProof(seed, proof)`. After the initial auto-settle and after every action it checks:

- all 40 physical card IDs occur exactly once across tableau, normal free cells, collected-dragon bundles, numeric foundations, and flower foundation;
- every known card ID belongs to the canonical 40-card deck;
- numeric foundation cards are the exact suit sequence `1..N`;
- a collected dragon cell contains exactly four cards of its recorded family;
- no dragon family is collected in more than one cell;
- flower foundation is either empty or exactly `flower`;
- final win is reported only by production `isWon()`.

The verifier returns a compact verification summary and raw difficulty metrics for the factory.

## 11. Difficulty model v1

Human difficulty is not defined by solver nodes alone. Metrics are measured from the **TypeScript replayed solution**, with solver nodes retained as one signal.

Per verified candidate collect:

- `solverNodes`: C++ visited nodes;
- `decisionActions`: number of proof decisions;
- `rearrangementMoves`: moves whose destination is tableau or a normal free cell;
- `freeCellTouches`: moves into or out of a normal free cell;
- `earlyProgressActions`: decisions required before at least four numeric cards have reached foundations;
- `blockedDragonPressure`: for each decision boundary, count completed dragon-family cells (`0..3`); sum across the proof and divide by `max(1, decisionActions * 3)` before percentile ranking.

Convert each metric to a population percentile. `solverNodes` uses `log1p` before ranking. Initial v1 weights:

```text
30% solverNodes
20% decisionActions
20% rearrangementMoves
15% freeCellTouches
10% earlyProgressActions
 5% blockedDragonPressure
```

Composite scores are percentile-ranked again to produce final `difficultyScore` in `0..100`.

The first calibration probe must print percentile distributions for all raw metrics so these weights can be revisited before the long production scan if they behave pathologically. Changing weights after shipping requires incrementing `difficultyModelVersion` and regenerating the catalog.

### 11.1 Onboarding filter

A candidate may enter `onboarding` only if:

- `difficultyScore <= 20`;
- `freeCellTouches` percentile `<= 35`;
- `rearrangementMoves` percentile `<= 35`;
- `earlyProgressActions` percentile `<= 25`.

Within eligible onboarding candidates, choose the lowest score first, then lowest seed for deterministic ties.

## 12. Daily difficulty schedule

Daily difficulty follows the same weekday progression used by the final Cascade schedule, interpreted in UTC:

| Weekday | Difficulty band |
| --- | --- |
| Monday | `0..15` |
| Tuesday | `10..30` |
| Wednesday | `25..45` |
| Thursday | `40..60` |
| Friday | `55..75` |
| Saturday | `70..90` |
| Sunday | `80..95` |

Daily selection is deterministic. For each weekday band, eligible records are sorted by seed, shuffled with a fixed xorshift32 schedule seed, and consumed without replacement. If any weekday queue cannot cover all dates of that weekday, generation is `NOT_READY` rather than widening the band silently.

Daily candidates above score 95 are never scheduled.

## 13. Development artifacts and resumability

Ignored artifacts:

```text
artifacts/deals/standard/candidates.jsonl
artifacts/deals/standard/checkpoint.json
artifacts/deals/daily/candidates.jsonl
artifacts/deals/daily/checkpoint.json
artifacts/deals/calibration.json
```

Each candidate JSONL record contains enough audit data to reproduce acceptance/rejection:

```text
seed
status
nodes
proof (for SOLVED records)
verification
rejectionReason (when applicable)
```

Generation appends one complete JSON object plus newline atomically enough for snapshot readers. Checkpoints are written through temporary-file + rename. Resume uses the last committed seed and never rescans already-recorded seeds unless explicitly reset.

Long-run probe/report readers operate on a file-size snapshot so they can inspect a candidates file while generation continues; an unterminated trailing append is ignored until the next probe.

## 14. Production asset format

Production files:

```text
public/assets/deals/verified-deals.bin
public/assets/deals/verified-deals-manifest.json
```

Binary layout is consecutive little-endian uint32 seeds in this order:

```text
onboarding | easy | medium | hard | daily
```

Catalog format is bumped to `catalogVersion: 2` because the existing Trifold v1 flat catalog has no partitions or Daily schedule.

Manifest fields:

```text
catalogVersion = 2
rulesVersion = 1
shuffleVersion = 1
seedEncoding = "uint32-le"
difficultyModelVersion = 1
dailyAlgorithmVersion = 1
standardCounts
dailyScheduleStart = "2026-01-01"
dailyScheduleLength = 7305
fastNodeBudget
slowNodeBudget
sourceScanRanges
verifiedCount
rejectedVerificationCount
crossPoolDuplicateCount = 0
solverSourceHash
gameRulesSourceHash
productionAssetHash
offsets
```

`gameRulesSourceHash` hashes the exact source files that define cards/deal/rules/game/proof replay. `productionAssetHash` is SHA-256 of the binary and must be verified by generation/report/verify-all tooling before release. The synchronous runtime decoder still validates versions, offsets, counts, uniqueness, and Standard/Daily disjointness.

At 47,305 uint32 seeds, the binary itself is about 185 KiB before HTTP compression.

## 15. Runtime catalog API

`VerifiedDealCatalog` becomes a partition-aware read-only loader. Required API:

```ts
type StandardTier = 'onboarding' | 'easy' | 'medium' | 'hard';

catalog.metadata
catalog.getStandardSeeds(tier): readonly number[]
catalog.getDailySeedByOffset(offset): number
catalog.has(seed): boolean
```

The current production `VerifiedCatalogDealSource` must choose only Standard seeds. Daily seeds are exposed only through explicit Daily lookup and can never leak into ordinary New Deal selection.

A missing, malformed, rules-mismatched, shuffle-mismatched, duplicate, or overlapping catalog is a production configuration failure. A production binary/manifest hash mismatch is a release-tooling failure and blocks shipping. There is no unverified random fallback.

The future Daily scene may map `dailyId` to an offset, but Daily UI itself is outside this subsystem.

## 16. CLI surface

Required scripts:

```bash
pnpm deals:build-solver
pnpm deals:calibrate -- --count 10000 --jobs 4
pnpm deals:generate -- --standard-total 40000 --daily-days 7305 --jobs 4
pnpm deals:probe -- --standard-total 40000 --daily-days 7305
pnpm deals:verify-all -- --jobs 4
pnpm deals:report
```

`deals:generate` reads calibrated/default budgets, continues candidate scans until both requested pools can be selected, writes production assets only after all uniqueness/verification/schedule checks succeed, and prints an explicit readiness summary.

Expected final report shape:

```text
STANDARD
onboarding=500 easy=13167 medium=15361 hard=10972 total=40000

DAILY
length=7305 start=2026-01-01

crossPoolDuplicates=0
rejectedVerification=0
status=READY_TO_SHIP
```

`rejectedVerification` may be non-zero during exploratory development, but a release report must expose it clearly rather than hiding it. Every final selected seed must independently pass `deals:verify-all`.

## 17. Regular regression coverage

The normal `pnpm test` suite must not solve 47k deals. It covers:

- exact RNG/deal parity fixtures between TS and C++;
- proof parser and proof replay on a small committed solved-fixture sample;
- corrupt proof rejection;
- catalog encoding/offset/hash/version/disjointness contracts;
- difficulty metric/scoring determinism;
- Standard quota determinism;
- Daily weekday-band determinism and uniqueness;
- checkpoint/resume and solver-output parsing with test doubles.

Full catalog re-solving is an explicit offline command: `pnpm deals:verify-all`.

## 18. Out of scope

This subsystem does **not** implement:

- Daily calendar UI or streaks;
- Standard adaptive difficulty director/player-history logic;
- final card art or themes;
- online/cloud deal generation;
- runtime hints using the solver;
- shipping proofs to the client.

Those systems may consume this catalog later without changing the verification boundary.

## 19. Release gate

A generated Trifold deal asset is release-ready only when all are true:

- Standard has exactly the requested tier counts;
- Daily has exactly the requested date count from the requested start date;
- Standard has no duplicate seeds;
- Daily has no duplicate seeds;
- Standard and Daily are disjoint;
- every selected seed is `SOLVED` by the configured solver budget;
- every selected proof replays to a win through current TypeScript production rules;
- `rejectedVerificationCount === 0`;
- manifest hashes match current sources and binary;
- every Daily seed lies within its weekday difficulty band;
- every Standard seed has score `<= 95`;
- `pnpm test`, `pnpm build`, and `pnpm deals:verify-all` all pass.
