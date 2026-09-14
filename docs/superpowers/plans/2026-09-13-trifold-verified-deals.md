# Trifold Verified Deals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete offline Trifold verified-deal factory and compact runtime catalog for 40,000 Standard deals plus 7,305 Daily deals, with C++ solving, TypeScript proof replay, difficulty scoring, resumable generation, probe/report tooling, and full-catalog verification.

**Architecture:** Keep the production TypeScript model authoritative. A standalone C++ solver duplicates only the deterministic deal/search state needed to find a solution and emits player-decision proofs; every accepted proof is replayed through `TrifoldGame`. Node tooling then scores verified candidates, partitions Standard, builds the fixed UTC Daily schedule, and writes a hashed uint32 catalog consumed by a partition-aware runtime loader.

**Tech Stack:** TypeScript 5.9+, Node ESM/built-in test runner, C++20, pnpm, SHA-256 via `node:crypto`, JSONL development artifacts, little-endian uint32 production binary.

**Spec:** `docs/superpowers/specs/2026-09-13-trifold-verified-deals-design.md`

## Global Constraints

- Standard target is exactly 40,000 deals: onboarding=500, easy=13,167, medium=15,361, hard=10,972.
- Daily target is exactly 7,305 UTC dates beginning `2026-01-01`.
- Standard candidate range begins at seed `1`; Daily candidate range begins at seed `1_000_000_001`.
- All catalog seeds are positive uint32 and Standard/Daily must be unique and disjoint.
- Production deal verification requires C++ `SOLVED` plus successful replay through current TypeScript `TrifoldGame`; `UNDETERMINED` is never accepted.
- Initial and post-decision automatic moves are recomputed by production TypeScript; proof actions contain player decisions only.
- Current corrected dragon rule is authoritative: an exposed matching dragon already in a free cell is the collection destination; otherwise an empty normal free cell is required.
- Free-cell identities remain stable; tableau search canonicalization may ignore stable tableau IDs in hashes but proof actions must emit stable production columns.
- Difficulty model version is `1`; Daily algorithm version is `1`; production catalog version becomes `2`.
- Daily bands are Mon 0..15, Tue 10..30, Wed 25..45, Thu 40..60, Fri 55..75, Sat 70..90, Sun 80..95.
- Runtime never solves deals and never falls back to an unverified production seed.
- Development proofs/checkpoints live under ignored `artifacts/deals/`; production ships only binary seeds + manifest.

---

## File Structure

```text
src/game/model/
  DealProof.ts                         # proof action types, exact replay, invariants, replay metrics
  VerifiedDealCatalog.ts               # catalogVersion 2 manifest + tier/Daily accessors
  DealSource.ts                        # Standard-only production picker

tools/
  trifold_solver.cpp                   # C++20 deal parity + search + proof emitter
  deals/
    build-solver.mjs                   # cross-platform C++ build
    solver-client.mjs                  # child-process protocol + JSON validation
    calibration.mjs                    # P90/P99 budget recommendation
    verify-proof.mjs                   # wrapper around DealProof.ts
    difficulty.mjs                     # v1 metrics -> percentiles -> Standard tiers
    daily-schedule.mjs                 # 7305-date weekday-band selector
    catalog-format.mjs                 # uint32 binary + manifest + hashes
    generate.mjs                       # resumable candidate scans + final asset generation
    probe.mjs                          # snapshot-safe readiness analysis
    report.mjs                         # production/audit summary
    verify-all.mjs                     # re-solve and replay every selected seed

tests/
  deal-proof.test.ts
  verified-deal-catalog.test.ts
  deal-source.test.ts
  solver-client.test.mjs
  solver-parity.test.mjs
  calibration.test.mjs
  deal-difficulty.test.mjs
  daily-schedule.test.mjs
  deal-catalog-format.test.mjs
  deal-generator.test.mjs
  deal-probe.test.mjs
  deal-report.test.mjs
  verified-proof-sample.test.ts

public/assets/deals/
  verified-deals.bin                   # generated production asset
  verified-deals-manifest.json         # generated production metadata

tests/fixtures/deals/
  verified-proof-sample.json           # small committed C++ proof fixture sample

artifacts/deals/                        # ignored local generation state
```

## Task 1: Add production proof replay to the TypeScript model

**Files:**
- Create: `src/game/model/DealProof.ts`
- Create: `tests/deal-proof.test.ts`

**Interfaces:**
- Consumes: `createDeal(seed)`, `TrifoldGame`, `isWon`, canonical card IDs, `CardTarget`, `DragonFamily`.
- Produces: `DealProofAction`, `verifySeedProof(seed, proof)`, `ProofVerification`, and `ProofMetrics` for all later tooling.

- [ ] **Step 1: Define proof and verification types in a failing test**

```ts
import { verifySeedProof, type DealProofAction } from '../src/game/model/DealProof.ts';

const proof: DealProofAction[] = [
  {
    kind: 'move',
    source: { zone: 'tableau', column: 0, cardId: 'coins-9' },
    target: { zone: 'tableau', column: 1 },
  },
];

assert.throws(() => verifySeedProof(1, proof), /seed=1.*action=0/i);
```

Also add invariant-focused tests that feed a known tiny test-state seam or deliberately corrupt `cardId`, column, and free-cell source and assert a failure includes seed/action index.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/deal-proof.test.ts`  
Expected: FAIL because `DealProof.ts` does not exist.

- [ ] **Step 3: Implement proof resolution and replay**

Use this public shape:

```ts
export type DealProofSource =
  | { readonly zone: 'tableau'; readonly column: number; readonly cardId: CardId }
  | { readonly zone: 'free-cell'; readonly cell: number; readonly cardId: CardId };

export type DealProofAction =
  | { readonly kind: 'move'; readonly source: DealProofSource; readonly target: CardTarget }
  | { readonly kind: 'collect-dragons'; readonly family: DragonFamily };

export interface ProofMetrics {
  readonly decisionActions: number;
  readonly rearrangementMoves: number;
  readonly freeCellTouches: number;
  readonly earlyProgressActions: number;
  readonly blockedDragonPressure: number;
}

export interface ProofVerification {
  readonly seed: number;
  readonly actionCount: number;
  readonly metrics: ProofMetrics;
}

export function verifySeedProof(seed: number, proof: readonly DealProofAction[]): ProofVerification;
```

Implementation requirements:

```ts
const game = new TrifoldGame(createDeal(seed));
game.settleInitialAutoMoves();
assertStateIntegrity(game.state, seed, -1);

for (let actionIndex = 0; actionIndex < proof.length; actionIndex += 1) {
  const action = proof[actionIndex];
  const command = resolveProofAction(game.state, action, seed, actionIndex);
  const result = game.perform(command);
  if (result === null) fail(seed, actionIndex, 'production rules rejected proof action');
  assertStateIntegrity(game.state, seed, actionIndex);
  // update metrics from the player action + resulting production state
}
if (!isWon(game.state)) fail(seed, proof.length, 'proof ended without a win');
```

For tableau sources, locate `cardId` inside the stable column and use that exact current index. For free-cell sources, require `kind === 'card'` and exact card ID. `assertStateIntegrity` must count all 40 card IDs exactly once and validate foundation/dragon/flower semantics from the spec.

- [ ] **Step 4: Run proof tests and full model tests**

Run:

```bash
node --experimental-strip-types --test tests/deal-proof.test.ts tests/trifold-game.test.ts tests/trifold-rules.test.ts tests/deal.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/model/DealProof.ts tests/deal-proof.test.ts
git commit -m "feat: add Trifold deal proof replay"
```

## Task 2: Upgrade the runtime catalog to partitioned Standard + Daily format

**Files:**
- Modify: `src/game/model/VerifiedDealCatalog.ts`
- Modify: `src/game/model/DealSource.ts`
- Modify: `tests/verified-deal-catalog.test.ts`
- Modify: `tests/deal-source.test.ts`

**Interfaces:**
- Consumes: `RULES_VERSION`, `SHUFFLE_VERSION`.
- Produces: `StandardTier`, `VerifiedDealManifest`, `catalog.metadata`, `getStandardSeeds(tier)`, `getDailySeedByOffset(offset)`, and Standard-only `VerifiedCatalogDealSource`.

- [ ] **Step 1: Replace flat-catalog tests with v2 partition tests**

Use a fixture manifest with offsets:

```ts
const manifest = {
  catalogVersion: 2,
  rulesVersion: 1,
  shuffleVersion: 1,
  seedEncoding: 'uint32-le',
  difficultyModelVersion: 1,
  dailyAlgorithmVersion: 1,
  standardCounts: { onboarding: 1, easy: 2, medium: 1, hard: 1 },
  dailyScheduleStart: '2026-01-01',
  dailyScheduleLength: 2,
  verifiedCount: 7,
  crossPoolDuplicateCount: 0,
  rejectedVerificationCount: 0,
  fastNodeBudget: 10000,
  slowNodeBudget: 50000,
  sourceScanRanges: [],
  solverSourceHash: 'solver',
  gameRulesSourceHash: 'rules',
  productionAssetHash: 'test-hash',
  offsets: {
    onboarding: { byteOffset: 0, count: 1 },
    easy: { byteOffset: 4, count: 2 },
    medium: { byteOffset: 12, count: 1 },
    hard: { byteOffset: 16, count: 1 },
    daily: { byteOffset: 20, count: 2 },
  },
};
```

Assert exact tier slices, Daily offsets, duplicate rejection, overlap rejection, bad offsets, bad versions, and that ordinary Standard selection never returns a Daily seed.

- [ ] **Step 2: Run focused catalog/source tests and verify RED**

Run: `node --experimental-strip-types --test tests/verified-deal-catalog.test.ts tests/deal-source.test.ts`  
Expected: FAIL because current loader supports only flat v1 catalogs.

- [ ] **Step 3: Implement v2 loader**

Public API:

```ts
export type StandardTier = 'onboarding' | 'easy' | 'medium' | 'hard';

export class VerifiedDealCatalog {
  readonly metadata: VerifiedDealManifest;
  static decode(buffer: ArrayBuffer, rawManifest: unknown): VerifiedDealCatalog;
  getStandardSeeds(tier: StandardTier): readonly number[];
  getDailySeedByOffset(offset: number): number;
  has(seed: number): boolean;
}
```

Validate contiguous, 4-byte-aligned offsets and exact total byte length. Reject zero/duplicate seeds and any Standard/Daily overlap regardless of manifest audit counters.

Change `VerifiedCatalogDealSource` so its selectable seed set is only `onboarding/easy/medium/hard`; it must never sample `daily`.

- [ ] **Step 4: Run focused tests**

Run: `node --experimental-strip-types --test tests/verified-deal-catalog.test.ts tests/deal-source.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/model/VerifiedDealCatalog.ts src/game/model/DealSource.ts tests/verified-deal-catalog.test.ts tests/deal-source.test.ts
git commit -m "feat: add partitioned verified deal catalog"
```

## Task 3: Implement exact C++ deal parity and solver protocol

**Files:**
- Create: `tools/trifold_solver.cpp`
- Create: `tools/deals/build-solver.mjs`
- Create: `tools/deals/solver-client.mjs`
- Create: `tests/solver-client.test.mjs`
- Create: `tests/solver-parity.test.mjs`

**Interfaces:**
- Consumes: frozen TS xorshift/Fisher-Yates/card ordering contract.
- Produces: executable supporting `--seed`, `--budget`, `--proof-json`, plus a parity/debug mode that prints the initial eight columns.

- [ ] **Step 1: Write solver-client parser tests**

```js
assert.deepEqual(parseSolverOutput('{"status":"UNDETERMINED","seed":7,"nodes":100}', 7), {
  status: 'UNDETERMINED', seed: 7, nodes: 100, proof: undefined,
});
assert.throws(() => parseSolverOutput('{"status":"SOLVED","seed":7,"nodes":1,"proof":[]}', 7), /non-empty proof/i);
assert.throws(() => parseSolverOutput('{"status":"SOLVED","seed":8,"nodes":1,"proof":[{}]}', 7), /seed mismatch/i);
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `node --test tests/solver-client.test.mjs`  
Expected: FAIL because tooling is absent.

- [ ] **Step 3: Implement build and client wrappers**

`build-solver.mjs` follows Cascade's compiler resolution: explicit `CXX`, Windows MSYS2 g++, then `g++`, then `clang++`. Build with `-std=c++20 -O3 -pthread`.

`solver-client.mjs` validates positive uint32 seed, positive budget, JSON status, node count, non-empty proof for `SOLVED`, and exit codes:

```text
SOLVED       -> 0
UNSOLVABLE   -> 3
UNDETERMINED -> 4
```

Use `TRIFOLD_SOLVER` as the executable override environment variable.

- [ ] **Step 4: Implement C++ card/deal parity before search**

The C++ deck order must mirror `createDeck()` exactly, and RNG must mirror:

```cpp
uint32_t next_u32(uint32_t& state) {
  uint32_t x = state;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  state = x;
  return state;
}
```

Fisher-Yates uses `next_u32(state) % (index + 1)`, then deals row-major into 8 columns × 5 rows exactly like TypeScript.

Add a `--deal-json` mode solely for parity tests.

- [ ] **Step 5: Write and run parity tests for fixed seeds**

`tests/solver-parity.test.mjs` invokes `createDeal(seed)` through a small Node helper/import and compares all 40 card IDs against `trifold_solver --seed <seed> --deal-json` for at least seeds `1`, `2`, `7`, `123456789`, and `4294967295`.

Run:

```bash
node tools/deals/build-solver.mjs
node --test tests/solver-client.test.mjs tests/solver-parity.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/trifold_solver.cpp tools/deals/build-solver.mjs tools/deals/solver-client.mjs tests/solver-client.test.mjs tests/solver-parity.test.mjs
git commit -m "feat: add Trifold solver protocol and deal parity"
```

## Task 4: Implement Shenzhen search, auto-normalization, and stable proof emission

**Files:**
- Modify: `tools/trifold_solver.cpp`
- Create: `tools/deals/verify-proof.mjs`
- Create: `tests/verified-proof-sample.test.ts`
- Create: `tests/fixtures/deals/verified-proof-sample.json`

**Interfaces:**
- Consumes: Task 1 proof schema and Task 3 deterministic deal model.
- Produces: `SOLVED` proof arrays replayable by `verifySeedProof`; deterministic `UNDETERMINED` at node budget exhaustion.

- [ ] **Step 1: Add a failing solver-to-proof regression**

Write `tests/verified-proof-sample.test.ts` so it asks the solver for the first solved seed from the deterministic candidate list `1..32`, then immediately replays that returned proof through `verifySeedProof`. Before Task 4 search exists, every candidate must return `UNDETERMINED`/non-solved and the test fails with `no solved fixture seed found in 1..32`.

```ts
async function firstSolvedSeed(seeds: readonly number[]) {
  for (const seed of seeds) {
    const result = await solveSeed({ seed, budget: 5_000_000 });
    if (result.status === 'SOLVED') return result;
  }
  return null;
}

const solved = await firstSolvedSeed(Array.from({ length: 32 }, (_, index) => index + 1));
assert.ok(solved, 'no solved fixture seed found in 1..32');
assert.doesNotThrow(() => verifySeedProof(solved.seed, solved.proof));
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/verified-proof-sample.test.ts`  
Expected: FAIL because the C++ solver does not yet find/emit a complete solution proof.

- [ ] **Step 3: Implement C++ search state and rules**

Represent each tableau column as `{ cards, stableColumnId }`; keep three free cells stable. Normalize auto moves after initial deal and every generated player decision with the exact order flower-first then TypeScript-equivalent safe numeric candidate order.

Generate only legal player decisions:

```text
exposed single/run -> tableau
exposed single -> empty free cell
exposed numeric -> next matching foundation
collect exposed dragon family under corrected destination rule
```

A tableau run is valid iff every card is numeric, ranks descend by exactly one, and adjacent suits differ. Empty tableau accepts any exposed single or valid numeric run without FreeCell capacity limits.

Use deterministic move ordering, a transposition table, and tableau canonicalization that sorts `(cards, stableColumnId)` pairs while hashes ignore `stableColumnId`.

- [ ] **Step 4: Emit stable proof actions and commit real solved fixture records**

For tableau source actions emit the stable column and root card ID:

```json
{
  "kind": "move",
  "source": { "zone": "tableau", "column": 3, "cardId": "coins-7" },
  "target": { "zone": "tableau", "column": 5 }
}
```

For free cells emit stable cell + card ID; for dragon decisions emit `{ "kind":"collect-dragons", "family":"white" }`.

Run the solver over ascending positive seeds until at least 3 solved records are found, save those exact solver records under `tests/fixtures/deals/verified-proof-sample.json`, and update the regression test to replay the committed records without invoking the solver. Ensure every committed proof is non-empty and was produced by the current solver protocol.

- [ ] **Step 5: Verify C++ proofs through production TS**

Run:

```bash
node --experimental-strip-types --test tests/verified-proof-sample.test.ts tests/deal-proof.test.ts
```

Expected: PASS for all committed sample proofs.

- [ ] **Step 6: Add wrapper verification**

`tools/deals/verify-proof.mjs` exports:

```js
export async function verifyProofRecord(record) {
  if (record?.status !== 'SOLVED') return { ok: false, reason: '...' };
  try {
    const verification = verifySeedProof(record.seed, record.proof);
    return { ok: true, verification };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add tools/trifold_solver.cpp tools/deals/verify-proof.mjs tests/verified-proof-sample.test.ts tests/fixtures/deals/verified-proof-sample.json
git commit -m "feat: solve and verify Trifold deals"
```

## Task 5: Add deterministic difficulty scoring and Standard partitioning

**Files:**
- Create: `tools/deals/difficulty.mjs`
- Create: `tests/deal-difficulty.test.mjs`

**Interfaces:**
- Consumes: candidate `nodes` plus `verification.metrics` from Task 1.
- Produces: `scorePopulation(records)`, `standardQuotasForTotal(total)`, `partitionStandard(records, quotas)`, `DIFFICULTY_MODEL_VERSION = 1`.

- [ ] **Step 1: Write percentile/weight/quota tests**

Cover tied percentiles, `log1p(nodes)`, exact 40k quota output, onboarding filter, exclusion of score >95, and deterministic seed tie-breaking.

```js
assert.deepEqual(standardQuotasForTotal(40000), {
  onboarding: 500,
  easy: 13167,
  medium: 15361,
  hard: 10972,
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deal-difficulty.test.mjs`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement v1 scoring**

Use weights exactly:

```js
export const DIFFICULTY_WEIGHTS = Object.freeze({
  solverNodes: 0.30,
  decisionActions: 0.20,
  rearrangementMoves: 0.20,
  freeCellTouches: 0.15,
  earlyProgressActions: 0.10,
  blockedDragonPressure: 0.05,
});
```

Read replay metrics from `record.verification.metrics`. Convert all metric columns to average-rank percentiles; use `Math.log1p(nodes)` for solver nodes; percentile-rank the weighted composite again for `difficultyScore`.

Onboarding filter:

```js
score <= 20
freeCellTouches percentile <= 35
rearrangementMoves percentile <= 35
earlyProgressActions percentile <= 25
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/deal-difficulty.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/difficulty.mjs tests/deal-difficulty.test.mjs
git commit -m "feat: score Trifold deal difficulty"
```

## Task 6: Add deterministic Daily schedule generation

**Files:**
- Create: `tools/deals/daily-schedule.mjs`
- Create: `tests/daily-schedule.test.mjs`

**Interfaces:**
- Consumes: verified scored Daily candidates.
- Produces: `DAILY_BANDS`, `generateDailySchedule(records, options)`.

- [ ] **Step 1: Write weekday-band and uniqueness tests**

Assert these exact bands:

```js
assert.deepEqual(DAILY_BANDS, {
  1: [0, 15],
  2: [10, 30],
  3: [25, 45],
  4: [40, 60],
  5: [55, 75],
  6: [70, 90],
  0: [80, 95],
});
```

Test UTC date progression across month/year boundaries, deterministic repeatability, no duplicate seeds, score<=95, and hard failure when a weekday queue lacks candidates.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/daily-schedule.test.mjs`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement schedule queues**

For each weekday, filter by inclusive band, sort by seed, shuffle deterministically with xorshift32 using a fixed base seed XOR a weekday constant, and consume without replacement. Default options:

```js
startDailyId = '2026-01-01'
length = 7305
shuffleSeed = 0x54524644 // "TRFD"
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/daily-schedule.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/daily-schedule.mjs tests/daily-schedule.test.mjs
git commit -m "feat: generate Trifold daily schedule"
```

## Task 7: Add calibration and choose solver budgets from measured nodes

**Files:**
- Create: `tools/deals/calibration.mjs`
- Create: `tests/calibration.test.mjs`

**Interfaces:**
- Consumes: `solveSeed()` and a deterministic candidate range.
- Produces: `recommendBudgets(records)` and CLI artifact `artifacts/deals/calibration.json`.

- [ ] **Step 1: Write recommendation tests**

Given solved node counts, assert:

```js
fast = ceil(P90 / 10_000) * 10_000
slow = ceil((2 * P99) / 50_000) * 50_000
slow > fast
```

Also assert fewer than 1,000 solved records produces `sufficient: false`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/calibration.test.mjs`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement calibration runner**

CLI:

```bash
node tools/deals/calibration.mjs --count 10000 --jobs 4 --start 1 --ceiling-budget 5000000
```

Solve candidates with the ceiling budget, collect status/nodes, compute P90/P99 among `SOLVED`, write an atomic JSON report containing sample size, status counts, percentiles, recommended fast/slow budgets, and `sufficient`.

Do not label production generation ready if `sufficient === false`.

- [ ] **Step 4: Run deterministic unit tests**

Run: `node --test tests/calibration.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/deals/calibration.mjs tests/calibration.test.mjs
git commit -m "feat: calibrate Trifold solver budgets"
```

## Task 8: Build the compact production catalog and manifest

**Files:**
- Create: `tools/deals/catalog-format.mjs`
- Create: `tests/deal-catalog-format.test.mjs`

**Interfaces:**
- Consumes: partitioned Standard arrays, ordered Daily schedule seeds, audit hashes/budgets.
- Produces: `{ binary, manifest }`, `writeVerifiedDealAssets()`, `verifyProductionAssetHash()` compatible with Task 2 loader.

- [ ] **Step 1: Write binary/manifest contract tests**

Assert exact uint32 LE order:

```text
onboarding -> easy -> medium -> hard -> daily
```

Assert offsets are contiguous, `verifiedCount` matches bytes/4, SHA-256 changes when one byte changes, duplicate Standard seeds fail, duplicate Daily seeds fail, and cross-pool overlap fails.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deal-catalog-format.test.mjs`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement catalog builder**

Manifest must include all spec fields and set:

```js
catalogVersion: 2,
rulesVersion: 1,
shuffleVersion: 1,
seedEncoding: 'uint32-le',
difficultyModelVersion: 1,
dailyAlgorithmVersion: 1,
crossPoolDuplicateCount: 0,
```

Compute `productionAssetHash = sha256(binary)` internally; do not accept it from callers.

- [ ] **Step 4: Round-trip through production loader**

Extend the test to feed `binary.buffer` and manifest into `VerifiedDealCatalog.decode()` and compare all tier/Daily values.

- [ ] **Step 5: Run tests**

Run:

```bash
node --test tests/deal-catalog-format.test.mjs
node --experimental-strip-types --test tests/verified-deal-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/deals/catalog-format.mjs tests/deal-catalog-format.test.mjs src/game/model/VerifiedDealCatalog.ts tests/verified-deal-catalog.test.ts
git commit -m "feat: encode verified Trifold deal assets"
```

## Task 9: Implement resumable Standard and Daily candidate generation

**Files:**
- Create: `tools/deals/generate.mjs`
- Create: `tests/deal-generator.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: solver client, proof verifier, scoring, Standard partition, Daily scheduler, catalog builder, calibration artifact.
- Produces: append-only candidate JSONL, checkpoints, and final production assets.

- [ ] **Step 1: Add artifact ignores and generation tests**

Append:

```gitignore
artifacts/deals/
tools/trifold_solver
tools/trifold_solver.exe
```

Test with injected fake `solveSeed`/`verifyProofRecord` functions so unit tests do not invoke C++.

Cover:

- `SOLVED + replay ok` appended as accepted candidate;
- `SOLVED + replay fail` records rejection and is never selectable;
- `UNDETERMINED` receives slow retry;
- `UNSOLVABLE` is recorded and skipped;
- checkpoint resume starts at next unscanned seed;
- Standard and Daily use separate source starts;
- final build refuses overlapping pools or insufficient Daily weekday bands.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deal-generator.test.mjs`  
Expected: FAIL because generator is absent.

- [ ] **Step 3: Implement append/checkpoint primitives**

Use one JSON object + newline per append. Atomic checkpoint write:

```js
writeFileSync(`${checkpointPath}.tmp`, JSON.stringify(checkpoint) + '\n');
renameSync(`${checkpointPath}.tmp`, checkpointPath);
```

Checkpoint version `1` records source name, next seed, scanned count, fast/slow budgets, and source start.

- [ ] **Step 4: Implement concurrent two-pass scanning**

Default constants:

```js
STANDARD_SOURCE_START = 1
DAILY_SOURCE_START = 1_000_000_001
DAILY_SCHEDULE_START = '2026-01-01'
RELEASE_DAILY_DAYS = 7_305
```

Load `artifacts/deals/calibration.json` and require `sufficient === true` for release-sized generation. Allow explicit CLI `--fast-budget` / `--slow-budget` for development tests, but record exact values in checkpoints and manifest.

For each seed: solve fast; if `UNDETERMINED`, solve slow; if `SOLVED`, replay proof; append result; advance checkpoint. Run up to `--jobs` independent workers while preserving unique seed assignment.

- [ ] **Step 5: Implement readiness-driven final selection**

After scanning snapshots, score verified Standard and Daily candidates separately. Standard must fill requested quotas. Daily must generate all requested date rows. Continue scanning until both are ready or uint32 source space is exhausted.

Then build production assets only after:

```text
standard duplicates = 0
daily duplicates = 0
cross pool duplicates = 0
all Standard score <= 95
all Daily weekday scores in band
rejected verification count = 0
```

- [ ] **Step 6: Run generator tests**

Run: `node --test tests/deal-generator.test.mjs`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .gitignore tools/deals/generate.mjs tests/deal-generator.test.mjs
git commit -m "feat: generate verified Trifold deal pools"
```

## Task 10: Add snapshot-safe probe and production report

**Files:**
- Create: `tools/deals/probe.mjs`
- Create: `tools/deals/report.mjs`
- Create: `tests/deal-probe.test.mjs`
- Create: `tests/deal-report.test.mjs`

**Interfaces:**
- Consumes: candidate JSONL, difficulty/scoring, Daily bands, production catalog.
- Produces: readiness diagnostics while generation is running and final audit report.

- [ ] **Step 1: Write snapshot/probe tests**

Create a temporary JSONL with valid complete lines plus an unterminated trailing fragment. Assert probe reads only bytes present at snapshot-open time, ignores trailing partial bytes, reports scanned/verified counts, Standard quota shortages, and Daily candidates required per weekday.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deal-probe.test.mjs tests/deal-report.test.mjs`  
Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement `probe.mjs`**

CLI defaults:

```text
--standard-total 40000
--daily-days 7305
--daily-start 2026-01-01
```

Report sections must include:

```text
STANDARD
snapshot scanned=... verified=... size=... trailingIgnored=...
target=40000 onboarding=500 easy=13167 medium=15361 hard=10972
status=READY|NOT_READY

DAILY
snapshot scanned=... verified=...
target=7305 start=2026-01-01
Mon band=0..15 required=... candidates=...
...
status=READY|NOT_READY
```

Probe is diagnostic and returns exit code 0 even when pools are not ready.

- [ ] **Step 4: Implement `report.mjs`**

Decode production assets through `VerifiedDealCatalog`, verify binary SHA-256, count cross-pool duplicates, optionally join candidate score/status details, and print exact final summary including `rejectedVerification` and `status=READY_TO_SHIP` only when release gates pass.

- [ ] **Step 5: Run tests**

Run: `node --test tests/deal-probe.test.mjs tests/deal-report.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/deals/probe.mjs tools/deals/report.mjs tests/deal-probe.test.mjs tests/deal-report.test.mjs
git commit -m "feat: inspect Trifold deal generation readiness"
```

## Task 11: Add full-catalog re-verification and package scripts

**Files:**
- Create: `tools/deals/verify-all.mjs`
- Modify: `package.json`
- Modify: `tests/game-scene-wiring.test.ts` if its catalog assumptions require v2 updates.

**Interfaces:**
- Consumes: production catalog, solver client, proof verifier.
- Produces: release command that re-solves/replays every selected seed.

- [ ] **Step 1: Add package-script expectations to existing wiring tests or a package JSON test seam**

Required scripts (and expand the normal test glob so the new `.mjs` unit tests run under `pnpm test`):

```json
{
  "test": "node --experimental-strip-types --test tests/*.test.ts tests/*.test.mjs",
  "deals:build-solver": "node tools/deals/build-solver.mjs",
  "deals:calibrate": "node tools/deals/calibration.mjs",
  "deals:generate": "node tools/deals/generate.mjs",
  "deals:probe": "node tools/deals/probe.mjs",
  "deals:verify-all": "node tools/deals/verify-all.mjs",
  "deals:report": "node tools/deals/report.mjs"
}
```

- [ ] **Step 2: Implement `verify-all.mjs`**

Read all Standard tier seeds plus all Daily offsets. For each seed, solve with the manifest's recorded `slowNodeBudget`, require `SOLVED`, replay the new proof with `verifyProofRecord`, and fail fast on the first error with seed context. Support `--jobs >= 1`.

Successful final line:

```text
status=VERIFIED 47305/47305
```

for the release-sized catalog.

- [ ] **Step 3: Run normal tests**

Run: `pnpm test`  
Expected: all tests pass without requiring a 47k catalog or invoking full solver verification.

- [ ] **Step 4: Run TypeScript/build verification**

Run: `pnpm build`  
Expected: `tsc && vite build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json tools/deals/verify-all.mjs tests/game-scene-wiring.test.ts
git commit -m "feat: add Trifold deal factory commands"
```

## Task 12: Run calibration, smoke generation, and release-size generation workflow

**Files:**
- Generated/ignored: `artifacts/deals/calibration.json`
- Generated/ignored: `artifacts/deals/standard/candidates.jsonl`
- Generated/ignored: `artifacts/deals/daily/candidates.jsonl`
- Generated: `public/assets/deals/verified-deals.bin`
- Generated: `public/assets/deals/verified-deals-manifest.json`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: measured budgets, verified production asset, and final release audit.

- [ ] **Step 1: Build solver**

Run: `pnpm deals:build-solver`  
Expected: native `tools/trifold_solver(.exe)` created successfully.

- [ ] **Step 2: Run the required 10k calibration sample**

Run:

```bash
pnpm deals:calibrate -- --count 10000 --jobs 4
```

Expected: report contains `solved >= 1000`, `sufficient=true`, and concrete `recommendedFastBudget` / `recommendedSlowBudget` with slow > fast.

- [ ] **Step 3: Run a small end-to-end smoke generation first**

Run:

```bash
pnpm deals:generate -- --standard-total 400 --daily-days 70 --jobs 4
pnpm deals:probe -- --standard-total 400 --daily-days 70
pnpm deals:report
```

Expected: both small pools become READY, zero duplicates/overlap, and production asset round-trips through runtime loader.

- [ ] **Step 4: Reset only smoke production artifacts before the real run**

Keep candidate JSONL/checkpoints because they are reusable verified work. Remove only the small generated `public/assets/deals/verified-deals.bin` and manifest so the release run cannot be mistaken for the smoke asset.

- [ ] **Step 5: Generate release targets**

Run:

```bash
pnpm deals:generate -- --standard-total 40000 --daily-days 7305 --jobs 4
```

Expected eventual summary:

```text
standard onboarding=500 easy=13167 medium=15361 hard=10972 total=40000
daily length=7305 start=2026-01-01
crossPoolDuplicates=0
status=READY_TO_SHIP
```

- [ ] **Step 6: Probe and report the completed pools**

Run:

```bash
pnpm deals:probe -- --standard-total 40000 --daily-days 7305
pnpm deals:report
```

Expected: Standard READY, Daily READY, every weekday has enough in-band candidates, cross-pool duplicates 0.

- [ ] **Step 7: Re-solve every selected production seed**

Run:

```bash
pnpm deals:verify-all -- --jobs 4
```

Expected: `status=VERIFIED 47305/47305`.

- [ ] **Step 8: Final project verification**

Run:

```bash
pnpm test
pnpm build
```

Expected: both succeed.

- [ ] **Step 9: Commit production assets and source changes, not local artifacts/solver binary**

```bash
git add public/assets/deals/verified-deals.bin public/assets/deals/verified-deals-manifest.json
git commit -m "data: ship verified Trifold deal catalog"
```
