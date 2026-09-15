import type { PlayerStorage, TrustedClock } from '../../platform/services.ts';
import { parsePlayerProfile } from './ProfileSchema.ts';
import type { PlayerProfileV1 } from './ProfileTypes.ts';

export interface CloudEnvelopeV1 {
  readonly trifoldProfileVersion: 1;
  readonly profile: PlayerProfileV1;
  readonly savedAtMs: number;
}

function timestamp(clock: TrustedClock): number {
  const trusted = clock.nowMs();
  const value = trusted ?? Date.now();
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export class CloudProfileStore {
  private readonly storage: PlayerStorage;
  private readonly clock: TrustedClock;
  constructor(storage: PlayerStorage, clock: TrustedClock) {
    this.storage = storage;
    this.clock = clock;
  }
  async load(): Promise<PlayerProfileV1 | null> {
    try {
      const raw = await this.storage.load();
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
      const source = raw as Record<string, unknown>;
      if (source.trifoldProfileVersion !== 1) return null;
      return parsePlayerProfile(source.profile);
    } catch {
      return null;
    }
  }
  async save(profile: PlayerProfileV1, flush = false): Promise<void> {
    const parsed = parsePlayerProfile(profile);
    const envelope: CloudEnvelopeV1 = {
      trifoldProfileVersion: 1,
      profile: parsed,
      savedAtMs: timestamp(this.clock),
    };
    await this.storage.save(envelope as unknown as Record<string, unknown>, flush);
  }
}
