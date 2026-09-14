import { RULES_VERSION, SHUFFLE_VERSION } from './deal.ts';

export type StandardTier = 'onboarding' | 'easy' | 'medium' | 'hard';
export const STANDARD_TIERS = ['onboarding', 'easy', 'medium', 'hard'] as const satisfies readonly StandardTier[];
type CatalogPartition = StandardTier | 'daily';

export interface VerifiedDealOffset {
  readonly byteOffset: number;
  readonly count: number;
}

export interface VerifiedDealManifest {
  readonly catalogVersion: 2;
  readonly rulesVersion: 1;
  readonly shuffleVersion: 1;
  readonly seedEncoding: 'uint32-le';
  readonly difficultyModelVersion: number;
  readonly dailyAlgorithmVersion: number;
  readonly standardCounts: Readonly<Record<StandardTier, number>>;
  readonly dailyScheduleStart: string;
  readonly dailyScheduleLength: number;
  readonly verifiedCount: number;
  readonly crossPoolDuplicateCount: number;
  readonly rejectedVerificationCount: number;
  readonly fastNodeBudget: number;
  readonly slowNodeBudget: number;
  readonly sourceScanRanges: readonly unknown[];
  readonly solverSourceHash: string;
  readonly gameRulesSourceHash: string;
  readonly productionAssetHash: string;
  readonly offsets: Readonly<Record<CatalogPartition, VerifiedDealOffset>>;
}

function asRecord(raw: unknown, message: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new TypeError(message);
  return raw as Record<string, unknown>;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${name} must be a non-negative integer.`);
  return value as number;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`${name} must be a positive integer.`);
  return value as number;
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string.`);
  return value;
}

function parseOffset(raw: unknown, name: CatalogPartition): VerifiedDealOffset {
  const value = asRecord(raw, `Verified deal ${name} offset must be an object.`);
  const byteOffset = nonNegativeInteger(value.byteOffset, `${name}.byteOffset`);
  const count = nonNegativeInteger(value.count, `${name}.count`);
  if (byteOffset % 4 !== 0) throw new Error(`${name} byte offset must be 4-byte aligned.`);
  return { byteOffset, count };
}

function parseManifest(raw: unknown): VerifiedDealManifest {
  const value = asRecord(raw, 'Verified deal manifest must be an object.');
  if (value.catalogVersion !== 2) throw new Error('Unsupported catalogVersion.');
  if (value.rulesVersion !== RULES_VERSION) throw new Error('Verified deal rulesVersion mismatch.');
  if (value.shuffleVersion !== SHUFFLE_VERSION) throw new Error('Verified deal shuffleVersion mismatch.');
  if (value.seedEncoding !== 'uint32-le') throw new Error('Verified deal seedEncoding must be uint32-le.');

  const standardCountsRaw = asRecord(value.standardCounts, 'Verified deal standardCounts must be an object.');
  const standardCounts = Object.fromEntries(STANDARD_TIERS.map((tier) => [
    tier,
    nonNegativeInteger(standardCountsRaw[tier], `standardCounts.${tier}`),
  ])) as Record<StandardTier, number>;

  const offsetsRaw = asRecord(value.offsets, 'Verified deal offsets must be an object.');
  const offsets = Object.fromEntries(([...STANDARD_TIERS, 'daily'] as const).map((partition) => [
    partition,
    parseOffset(offsetsRaw[partition], partition),
  ])) as Record<CatalogPartition, VerifiedDealOffset>;

  const dailyScheduleLength = nonNegativeInteger(value.dailyScheduleLength, 'dailyScheduleLength');
  const verifiedCount = nonNegativeInteger(value.verifiedCount, 'verifiedCount');
  const fastNodeBudget = positiveInteger(value.fastNodeBudget, 'fastNodeBudget');
  const slowNodeBudget = positiveInteger(value.slowNodeBudget, 'slowNodeBudget');
  if (slowNodeBudget <= fastNodeBudget) throw new Error('slowNodeBudget must be greater than fastNodeBudget.');
  if (!Array.isArray(value.sourceScanRanges)) throw new Error('sourceScanRanges must be an array.');

  for (const tier of STANDARD_TIERS) {
    if (offsets[tier].count !== standardCounts[tier]) {
      throw new Error(`${tier} offset count does not match standardCounts.`);
    }
  }
  if (offsets.daily.count !== dailyScheduleLength) throw new Error('Daily offset count does not match dailyScheduleLength.');

  let expectedByteOffset = 0;
  let expectedCount = 0;
  for (const partition of [...STANDARD_TIERS, 'daily'] as const) {
    const offset = offsets[partition];
    if (offset.byteOffset !== expectedByteOffset) throw new Error('Verified deal offsets must be contiguous and ordered.');
    expectedByteOffset += offset.count * 4;
    expectedCount += offset.count;
  }
  if (expectedCount !== verifiedCount) throw new Error('Verified deal partition counts do not match verifiedCount.');

  return Object.freeze({
    catalogVersion: 2,
    rulesVersion: RULES_VERSION,
    shuffleVersion: SHUFFLE_VERSION,
    seedEncoding: 'uint32-le',
    difficultyModelVersion: positiveInteger(value.difficultyModelVersion, 'difficultyModelVersion'),
    dailyAlgorithmVersion: positiveInteger(value.dailyAlgorithmVersion, 'dailyAlgorithmVersion'),
    standardCounts: Object.freeze({ ...standardCounts }),
    dailyScheduleStart: nonEmptyString(value.dailyScheduleStart, 'dailyScheduleStart'),
    dailyScheduleLength,
    verifiedCount,
    crossPoolDuplicateCount: nonNegativeInteger(value.crossPoolDuplicateCount, 'crossPoolDuplicateCount'),
    rejectedVerificationCount: nonNegativeInteger(value.rejectedVerificationCount, 'rejectedVerificationCount'),
    fastNodeBudget,
    slowNodeBudget,
    sourceScanRanges: Object.freeze([...value.sourceScanRanges]),
    solverSourceHash: nonEmptyString(value.solverSourceHash, 'solverSourceHash'),
    gameRulesSourceHash: nonEmptyString(value.gameRulesSourceHash, 'gameRulesSourceHash'),
    productionAssetHash: nonEmptyString(value.productionAssetHash, 'productionAssetHash'),
    offsets: Object.freeze({ ...offsets }),
  });
}

function assertUnique(seeds: readonly number[], label: string): void {
  const seen = new Set<number>();
  for (const seed of seeds) {
    if (seed < 1) throw new Error('Verified deal seed must be a positive uint32.');
    if (seen.has(seed)) throw new Error(`Duplicate verified deal seed in ${label}: ${seed}.`);
    seen.add(seed);
  }
}

export class VerifiedDealCatalog {
  readonly metadata: VerifiedDealManifest;
  private readonly seeds: readonly number[];
  private readonly members: ReadonlySet<number>;
  private readonly partitions: Readonly<Record<CatalogPartition, readonly number[]>>;

  private constructor(
    seeds: readonly number[],
    manifest: VerifiedDealManifest,
    partitions: Readonly<Record<CatalogPartition, readonly number[]>>,
  ) {
    this.seeds = Object.freeze([...seeds]);
    this.members = new Set(this.seeds);
    this.metadata = manifest;
    this.partitions = partitions;
  }

  static decode(buffer: ArrayBuffer, rawManifest: unknown): VerifiedDealCatalog {
    const manifest = parseManifest(rawManifest);
    if (buffer.byteLength % 4 !== 0) throw new Error('Verified deal binary must be 4-byte aligned.');
    const count = buffer.byteLength / 4;
    if (count !== manifest.verifiedCount) throw new Error('Verified deal count does not match manifest verifiedCount.');

    const expectedBytes = ([...STANDARD_TIERS, 'daily'] as const).reduce(
      (sum, partition) => sum + manifest.offsets[partition].count * 4,
      0,
    );
    if (expectedBytes !== buffer.byteLength) throw new Error('Verified deal offsets do not match binary byte length.');

    const view = new DataView(buffer);
    const seeds: number[] = [];
    for (let index = 0; index < count; index += 1) seeds.push(view.getUint32(index * 4, true));

    const partitions = {} as Record<CatalogPartition, readonly number[]>;
    for (const partition of [...STANDARD_TIERS, 'daily'] as const) {
      const { byteOffset, count: partitionCount } = manifest.offsets[partition];
      const start = byteOffset / 4;
      partitions[partition] = Object.freeze(seeds.slice(start, start + partitionCount));
      assertUnique(partitions[partition], partition);
    }

    const standardSeeds = STANDARD_TIERS.flatMap((tier) => [...partitions[tier]]);
    assertUnique(standardSeeds, 'Standard');
    const dailySeeds = partitions.daily;
    const standardSet = new Set(standardSeeds);
    for (const seed of dailySeeds) {
      if (standardSet.has(seed)) throw new Error(`Standard/Daily verified deal overlap: ${seed}.`);
    }
    assertUnique(seeds, 'catalog');

    return new VerifiedDealCatalog(seeds, manifest, Object.freeze({ ...partitions }));
  }

  get size(): number {
    return this.seeds.length;
  }

  get standardSize(): number {
    return STANDARD_TIERS.reduce((sum, tier) => sum + this.partitions[tier].length, 0);
  }

  getStandardSeeds(tier: StandardTier): readonly number[] {
    const seeds = this.partitions[tier];
    if (!seeds) throw new RangeError(`Unknown Standard tier: ${String(tier)}.`);
    return seeds;
  }

  getDailySeedByOffset(offset: number): number {
    const daily = this.partitions.daily;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= daily.length) {
      throw new RangeError('Daily deal offset is out of range.');
    }
    return daily[offset];
  }

  has(seed: number): boolean {
    return this.members.has(seed);
  }
}
