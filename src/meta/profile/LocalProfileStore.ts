import { createDefaultProfile, parsePlayerProfile } from './ProfileSchema.ts';
import type { PlayerProfileV1 } from './ProfileTypes.ts';

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PROFILE_KEY = 'trifoldPlayerProfile';

function resolveDefaultStorage(): BrowserStorageLike | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export class LocalProfileStore {
  private memory: PlayerProfileV1 = createDefaultProfile();
  private readonly storage: BrowserStorageLike | null;

  constructor(storage: BrowserStorageLike | null = resolveDefaultStorage()) {
    this.storage = storage;
  }

  async load(): Promise<PlayerProfileV1> {
    try {
      const raw = this.storage?.getItem(PROFILE_KEY);
      if (raw !== null && raw !== undefined) {
        this.memory = parsePlayerProfile(JSON.parse(raw));
      }
    } catch {
      // Preserve the last valid in-memory state. A fresh store therefore falls
      // back to createDefaultProfile() when browser data is corrupt/unavailable.
    }
    return structuredClone(this.memory);
  }

  async save(profile: PlayerProfileV1): Promise<void> {
    this.memory = parsePlayerProfile(profile);
    try {
      this.storage?.setItem(PROFILE_KEY, JSON.stringify(this.memory));
    } catch {
      // In-memory persistence remains usable when browser storage is blocked.
    }
  }
}
