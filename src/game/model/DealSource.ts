import { VerifiedDealCatalog } from './VerifiedDealCatalog.ts';

const MAX_UINT32 = 0xffff_ffff;

export interface DealSource {
  nextSeed(currentSeed?: number): number;
}

function assertSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > MAX_UINT32) {
    throw new RangeError('Deal seed must be a positive uint32.');
  }
}

export class DevelopmentDealSource implements DealSource {
  private readonly initialSeed: number;

  constructor(initialSeed = 1) {
    assertSeed(initialSeed);
    this.initialSeed = initialSeed;
  }

  nextSeed(currentSeed?: number): number {
    if (currentSeed === undefined) return this.initialSeed;
    assertSeed(currentSeed);
    return (currentSeed % MAX_UINT32) + 1;
  }
}

function randomCatalogIndex(size: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % size;
}

export class VerifiedCatalogDealSource implements DealSource {
  private readonly catalog: VerifiedDealCatalog;
  private readonly randomIndex: (size: number) => number;

  constructor(catalog: VerifiedDealCatalog, randomIndex: (size: number) => number = randomCatalogIndex) {
    if (catalog.size === 0) throw new Error('Verified deal catalog is empty.');
    this.catalog = catalog;
    this.randomIndex = randomIndex;
  }

  nextSeed(_currentSeed?: number): number {
    const index = this.randomIndex(this.catalog.size);
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.catalog.size) {
      throw new RangeError('Verified deal picker returned an invalid index.');
    }
    return this.catalog.seedAt(index);
  }
}
