import {
  UnavailablePaymentsGateway,
  UnavailableRewardedAdGateway,
  type PaymentsGateway,
  type RewardedAdGateway,
} from './MonetizationGateways.ts';

export interface KeyValueStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlayerStorage {
  scope(): Promise<string>;
  load(): Promise<unknown>;
  save(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

export interface TrustedClock {
  nowMs(): number | null;
}

export interface PlatformPause {
  isPaused(): boolean;
  subscribe(listener: (paused: boolean) => void): () => void;
}

export interface GameplayMarkup {
  start(): void;
  stop(): void;
}

export interface PlatformAuth {
  readonly available: boolean;
  isAuthorized(): boolean;
  requestAuthorization(): Promise<boolean>;
}

export interface LeaderboardEntry {
  readonly score: number;
  readonly rank: number;
  readonly publicName: string;
  readonly uniqueId: string | null;
  readonly avatarUrl: string | null;
  readonly extraData: string;
}

export interface LeaderboardEntriesResult {
  readonly entries: readonly LeaderboardEntry[];
  readonly userRank: number | null;
}

export interface LeaderboardEntriesOptions {
  readonly includeUser?: boolean;
  readonly quantityAround?: number;
  readonly quantityTop?: number;
}

export interface PlatformLeaderboards {
  readonly available: boolean;
  getEntries(name: string, options?: LeaderboardEntriesOptions): Promise<LeaderboardEntriesResult>;
  getPlayerEntry(name: string): Promise<LeaderboardEntry | null>;
  setScore(name: string, score: number, extraData?: string): Promise<void>;
}

export type PlatformPayments = PaymentsGateway;
export type PlatformAds = RewardedAdGateway;

export interface PlatformServices {
  readonly storage: PlayerStorage;
  readonly clock: TrustedClock;
  readonly pause: PlatformPause;
  readonly gameplay: GameplayMarkup;
  readonly auth: PlatformAuth;
  readonly leaderboards: PlatformLeaderboards;
  readonly payments: PlatformPayments;
  readonly ads: PlatformAds;
  readonly language: string | null;
  readonly ready: Promise<void>;
  signalReady(): Promise<void>;
}

const FALLBACK_STORAGE_KEY = 'trifoldPlatformStorage';

class BrowserPlayerStorage implements PlayerStorage {
  private memory: Record<string, unknown> = {};
  private readonly storage: KeyValueStorageLike | null;

  constructor(storage: KeyValueStorageLike | null) {
    this.storage = storage;
  }

  async scope(): Promise<string> {
    return 'guest';
  }

  async load(): Promise<unknown> {
    try {
      const raw = this.storage?.getItem(FALLBACK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          this.memory = structuredClone(parsed as Record<string, unknown>);
        }
      }
    } catch {
      // Keep last valid in-memory payload.
    }
    return structuredClone(this.memory);
  }

  async save(data: Record<string, unknown>, _flush = false): Promise<void> {
    this.memory = structuredClone(data);
    try {
      this.storage?.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(this.memory));
    } catch {
      // Browser storage is an optional fallback only.
    }
  }
}

class UnavailableAuth implements PlatformAuth {
  readonly available = false;
  isAuthorized(): boolean { return false; }
  async requestAuthorization(): Promise<boolean> { return false; }
}

class UnavailableLeaderboards implements PlatformLeaderboards {
  readonly available = false;
  async getEntries(_name: string, _options?: LeaderboardEntriesOptions): Promise<LeaderboardEntriesResult> {
    return { entries: [], userRank: null };
  }
  async getPlayerEntry(_name: string): Promise<LeaderboardEntry | null> { return null; }
  async setScore(_name: string, _score: number, _extraData?: string): Promise<void> {}
}

class StaticClock implements TrustedClock {
  nowMs(): number | null { return null; }
}

class StaticPause implements PlatformPause {
  isPaused(): boolean { return false; }
  subscribe(_listener: (paused: boolean) => void): () => void { return () => undefined; }
}

class NoopGameplayMarkup implements GameplayMarkup {
  start(): void {}
  stop(): void {}
}

function defaultStorage(): KeyValueStorageLike | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createUnavailablePlatformServices(
  storage: KeyValueStorageLike | null = defaultStorage(),
): PlatformServices {
  return {
    storage: new BrowserPlayerStorage(storage),
    clock: new StaticClock(),
    pause: new StaticPause(),
    gameplay: new NoopGameplayMarkup(),
    auth: new UnavailableAuth(),
    leaderboards: new UnavailableLeaderboards(),
    payments: new UnavailablePaymentsGateway(),
    ads: new UnavailableRewardedAdGateway(),
    language: null,
    ready: Promise.resolve(),
    signalReady: async () => undefined,
  };
}
