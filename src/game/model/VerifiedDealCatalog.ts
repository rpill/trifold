import { RULES_VERSION, SHUFFLE_VERSION } from './deal.ts';

export interface VerifiedDealManifest {
  readonly catalogVersion: 1;
  readonly rulesVersion: 1;
  readonly shuffleVersion: 1;
  readonly seedEncoding: 'uint32-le';
  readonly verifiedCount: number;
}

function parseManifest(raw: unknown): VerifiedDealManifest {
  if (typeof raw !== 'object' || raw === null) throw new TypeError('Verified deal manifest must be an object.');
  const value = raw as Record<string, unknown>;
  if (value.catalogVersion !== 1) throw new Error('Unsupported catalogVersion.');
  if (value.rulesVersion !== RULES_VERSION) throw new Error('Verified deal rulesVersion mismatch.');
  if (value.shuffleVersion !== SHUFFLE_VERSION) throw new Error('Verified deal shuffleVersion mismatch.');
  if (value.seedEncoding !== 'uint32-le') throw new Error('Verified deal seedEncoding must be uint32-le.');
  if (!Number.isSafeInteger(value.verifiedCount) || (value.verifiedCount as number) < 0) {
    throw new Error('Verified deal verifiedCount must be a non-negative integer.');
  }
  return {
    catalogVersion: 1,
    rulesVersion: RULES_VERSION,
    shuffleVersion: SHUFFLE_VERSION,
    seedEncoding: 'uint32-le',
    verifiedCount: value.verifiedCount as number,
  };
}

export class VerifiedDealCatalog {
  private readonly seeds: readonly number[];
  private readonly members: ReadonlySet<number>;

  private constructor(seeds: readonly number[]) {
    this.seeds = Object.freeze([...seeds]);
    this.members = new Set(this.seeds);
  }

  static decode(buffer: ArrayBuffer, rawManifest: unknown): VerifiedDealCatalog {
    const manifest = parseManifest(rawManifest);
    if (buffer.byteLength % 4 !== 0) throw new Error('Verified deal binary must be 4-byte aligned.');
    const count = buffer.byteLength / 4;
    if (count !== manifest.verifiedCount) throw new Error('Verified deal count does not match manifest verifiedCount.');

    const view = new DataView(buffer);
    const seeds: number[] = [];
    const seen = new Set<number>();
    for (let index = 0; index < count; index += 1) {
      const seed = view.getUint32(index * 4, true);
      if (seed < 1) throw new Error('Verified deal seed must be a positive uint32.');
      if (seen.has(seed)) throw new Error(`Duplicate verified deal seed: ${seed}.`);
      seen.add(seed);
      seeds.push(seed);
    }
    return new VerifiedDealCatalog(seeds);
  }

  get size(): number {
    return this.seeds.length;
  }

  seedAt(index: number): number {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.seeds.length) {
      throw new RangeError('Verified deal index is out of range.');
    }
    return this.seeds[index];
  }

  has(seed: number): boolean {
    return this.members.has(seed);
  }
}
