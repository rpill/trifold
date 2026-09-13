export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffff_ffff) {
      throw new RangeError('Deal seed must be a positive uint32.');
    }
    this.state = seed >>> 0;
  }

  nextUint32(): number {
    let x = this.state >>> 0;
    x ^= (x << 13) >>> 0;
    x ^= x >>> 17;
    x ^= (x << 5) >>> 0;
    this.state = x >>> 0;
    return this.state;
  }

  nextInt(exclusiveMaximum: number): number {
    if (!Number.isSafeInteger(exclusiveMaximum) || exclusiveMaximum <= 0) {
      throw new RangeError('Random upper bound must be a positive safe integer.');
    }
    return this.nextUint32() % exclusiveMaximum;
  }
}
