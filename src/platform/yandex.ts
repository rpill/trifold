import {
  createUnavailablePlatformServices,
  type GameplayMarkup,
  type LeaderboardEntriesOptions,
  type LeaderboardEntriesResult,
  type LeaderboardEntry,
  type PlatformAuth,
  type PlatformLeaderboards,
  type PlatformPause,
  type PlatformServices,
  type PlayerStorage,
  type TrustedClock,
} from './services.ts';
import {
  MonetizationUnavailableError,
  UnavailablePaymentsGateway,
  UnavailableRewardedAdGateway,
  type PaymentsGateway,
  type PurchaseReceipt,
  type RewardedAdGateway,
} from './MonetizationGateways.ts';

interface YandexPlayerLike {
  isAuthorized(): boolean;
  getUniqueID?(): string;
  getData(keys?: readonly string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

interface YandexSdkLike {
  getPlayer(): Promise<YandexPlayerLike>;
  auth?: { openAuthDialog(): Promise<void> };
  serverTime?: () => number;
  environment?: { i18n?: { lang?: string } };
  adv?: { showRewardedVideo(input: { callbacks: Record<string, (...args: any[]) => void> }): void };
  payments?: {
    purchase(input: { id: string }): Promise<any>;
    getPurchases(): Promise<any[]>;
    consumePurchase(token: string): Promise<void>;
  };
  getPayments?: () => Promise<YandexSdkLike['payments']>;
  leaderboards?: {
    getEntries(name: string, options?: Record<string, unknown>): Promise<any>;
    getPlayerEntry(name: string): Promise<any>;
    setScore(name: string, score: number, extraData?: string): Promise<void>;
  };
  features?: {
    LoadingAPI?: { ready(): void | Promise<void> };
    GameplayAPI?: { start(): void | Promise<void>; stop(): void | Promise<void> };
  };
  on?: (name: string, listener: () => void) => void;
  off?: (name: string, listener?: () => void) => void;
}

class YandexPlayerState {
  player: YandexPlayerLike;
  private readonly sdk: YandexSdkLike;

  constructor(sdk: YandexSdkLike, player: YandexPlayerLike) {
    this.sdk = sdk;
    this.player = player;
  }

  async refresh(): Promise<void> {
    this.player = await this.sdk.getPlayer();
  }
}

class YandexPlayerStorage implements PlayerStorage {
  private readonly state: YandexPlayerState;

  constructor(state: YandexPlayerState) {
    this.state = state;
  }

  async scope(): Promise<string> {
    const id = this.state.player.getUniqueID?.() ?? 'unknown';
    return `yandex:${id}`;
  }

  async load(): Promise<unknown> {
    return this.state.player.getData();
  }

  async save(data: Record<string, unknown>, flush = false): Promise<void> {
    await this.state.player.setData(data, flush);
  }
}

class YandexAuth implements PlatformAuth {
  readonly available: boolean;
  private readonly sdk: YandexSdkLike;
  private readonly state: YandexPlayerState;

  constructor(sdk: YandexSdkLike, state: YandexPlayerState) {
    this.sdk = sdk;
    this.state = state;
    this.available = typeof sdk.auth?.openAuthDialog === 'function';
  }

  isAuthorized(): boolean {
    return this.state.player.isAuthorized();
  }

  async requestAuthorization(): Promise<boolean> {
    if (this.isAuthorized()) return true;
    if (!this.sdk.auth?.openAuthDialog) return false;
    try {
      await this.sdk.auth.openAuthDialog();
      await this.state.refresh();
      return this.isAuthorized();
    } catch (error) {
      console.warn('[Trifold] Yandex authorization failed.', error);
      return false;
    }
  }
}

class YandexClock implements TrustedClock {
  private readonly sdk: YandexSdkLike;
  constructor(sdk: YandexSdkLike) { this.sdk = sdk; }
  nowMs(): number | null {
    try {
      const value = this.sdk.serverTime?.();
      return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : null;
    } catch {
      return null;
    }
  }
}

class YandexPause implements PlatformPause {
  private readonly listeners = new Set<(paused: boolean) => void>();
  private paused = false;
  private readonly onPause = (): void => this.update(true);
  private readonly onResume = (): void => this.update(false);

  constructor(sdk: YandexSdkLike) {
    sdk.on?.('game_api_pause', this.onPause);
    sdk.on?.('game_api_resume', this.onResume);
  }

  isPaused(): boolean { return this.paused; }

  subscribe(listener: (paused: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const listener of this.listeners) listener(paused);
  }
}

class YandexGameplayMarkup implements GameplayMarkup {
  private readonly sdk: YandexSdkLike;
  private running = false;
  constructor(sdk: YandexSdkLike) { this.sdk = sdk; }
  start(): void {
    if (this.running) return;
    this.running = true;
    void this.sdk.features?.GameplayAPI?.start();
  }
  stop(): void {
    if (!this.running) return;
    this.running = false;
    void this.sdk.features?.GameplayAPI?.stop();
  }
}

function normalizeEntry(raw: any): LeaderboardEntry {
  const player = raw?.player ?? {};
  const rank = Number(raw?.rank);
  const publicName = String(player.publicName ?? raw?.publicName ?? '');
  const uniqueId = player.uniqueID ?? player.uniqueId ?? raw?.uniqueID ?? raw?.uniqueId ?? null;
  let avatarUrl: string | null = null;
  try {
    avatarUrl = typeof player.getAvatarSrc === 'function'
      ? String(player.getAvatarSrc('small'))
      : (player.avatarSrc?.small ?? raw?.avatarSrc?.small ?? null);
  } catch {
    avatarUrl = null;
  }
  return {
    score: Number(raw?.score) || 0,
    rank: Number.isFinite(rank) && rank >= 1 ? rank : 0,
    publicName,
    uniqueId: uniqueId == null ? null : String(uniqueId),
    avatarUrl: avatarUrl == null ? null : String(avatarUrl),
    extraData: typeof raw?.extraData === 'string' ? raw.extraData : '',
  };
}

class YandexLeaderboards implements PlatformLeaderboards {
  readonly available: boolean;
  private readonly sdk: YandexSdkLike;
  constructor(sdk: YandexSdkLike) {
    this.sdk = sdk;
    this.available = Boolean(sdk.leaderboards);
  }
  async getEntries(name: string, options: LeaderboardEntriesOptions = {}): Promise<LeaderboardEntriesResult> {
    if (!this.sdk.leaderboards) return { entries: [], userRank: null };
    const result = await this.sdk.leaderboards.getEntries(name, options as Record<string, unknown>);
    const sdkUserRank = Number(result?.userRank);
    return {
      entries: Array.isArray(result?.entries) ? result.entries.map(normalizeEntry) : [],
      userRank: Number.isFinite(sdkUserRank) && sdkUserRank >= 1 ? sdkUserRank : null,
    };
  }
  async getPlayerEntry(name: string): Promise<LeaderboardEntry | null> {
    if (!this.sdk.leaderboards) return null;
    try {
      return normalizeEntry(await this.sdk.leaderboards.getPlayerEntry(name));
    } catch {
      return null;
    }
  }
  async setScore(name: string, score: number, extraData?: string): Promise<void> {
    if (!this.sdk.leaderboards) return;
    await this.sdk.leaderboards.setScore(name, score, extraData);
  }
}

class YandexRewardedAds implements RewardedAdGateway {
  readonly available: boolean;
  private readonly sdk: YandexSdkLike;
  constructor(sdk: YandexSdkLike) {
    this.sdk = sdk;
    this.available = Boolean(sdk.adv?.showRewardedVideo);
  }
  showRewarded(): Promise<boolean> {
    if (!this.sdk.adv?.showRewardedVideo) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let rewarded = false;
      let settled = false;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        this.sdk.adv?.showRewardedVideo({ callbacks: {
          onRewarded: () => { rewarded = true; },
          onClose: () => finish(rewarded),
          onError: () => finish(false),
        } });
      } catch {
        finish(false);
      }
    });
  }
}

class YandexPayments implements PaymentsGateway {
  readonly available: boolean;
  private payments: YandexSdkLike['payments'];
  constructor(payments: YandexSdkLike['payments']) {
    this.payments = payments;
    this.available = payments !== undefined;
  }
  async purchase(productId: string): Promise<PurchaseReceipt> {
    if (!this.payments) throw new MonetizationUnavailableError('Payments are unavailable.');
    const purchase = await this.payments.purchase({ id: productId });
    return normalizePurchase(purchase);
  }
  async getUnconsumedPurchases(): Promise<readonly PurchaseReceipt[]> {
    if (!this.payments) return [];
    const purchases = await this.payments.getPurchases();
    return Array.isArray(purchases) ? purchases.map(normalizePurchase) : [];
  }
  async consume(purchaseToken: string): Promise<void> {
    if (!this.payments) throw new MonetizationUnavailableError('Payments are unavailable.');
    await this.payments.consumePurchase(purchaseToken);
  }
}

function normalizePurchase(raw: any): PurchaseReceipt {
  const productId = raw?.productID ?? raw?.productId;
  const purchaseToken = raw?.purchaseToken;
  if (typeof productId !== 'string' || typeof purchaseToken !== 'string') {
    throw new Error('Yandex purchase payload is invalid.');
  }
  return { productId, purchaseToken };
}

export async function createYandexPlatformServices(sdk: YandexSdkLike): Promise<PlatformServices> {
  const player = await sdk.getPlayer();
  const state = new YandexPlayerState(sdk, player);
  let payments = sdk.payments;
  if (!payments && sdk.getPayments) {
    try { payments = await sdk.getPayments(); } catch { payments = undefined; }
  }
  const ready = Promise.resolve();
  let readySignaled: Promise<void> | null = null;
  return {
    storage: new YandexPlayerStorage(state),
    clock: new YandexClock(sdk),
    pause: new YandexPause(sdk),
    gameplay: new YandexGameplayMarkup(sdk),
    auth: new YandexAuth(sdk, state),
    leaderboards: new YandexLeaderboards(sdk),
    payments: payments ? new YandexPayments(payments) : new UnavailablePaymentsGateway(),
    ads: sdk.adv?.showRewardedVideo ? new YandexRewardedAds(sdk) : new UnavailableRewardedAdGateway(),
    language: sdk.environment?.i18n?.lang ?? null,
    ready,
    signalReady: () => {
      if (!readySignaled) readySignaled = Promise.resolve(sdk.features?.LoadingAPI?.ready()).then(() => undefined);
      return readySignaled;
    },
  };
}

let loaderPromise: Promise<PlatformServices> | null = null;

function isLocalDev(): boolean {
  if (typeof location === 'undefined') return true;
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function isYandexDevProxyEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: { VITE_YANDEX_DEV?: string } }).env;
  return env?.VITE_YANDEX_DEV === 'true';
}

export function shouldAttemptYandexSdkLoad(hostname: string, yandexDevProxyEnabled: boolean): boolean {
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  return !local || yandexDevProxyEnabled;
}

async function ensureSdkScript(): Promise<void> {
  if ((globalThis as any).YaGames?.init) return;
  if (typeof document === 'undefined') throw new Error('Yandex SDK cannot load without a document.');
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-trifold-yandex-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Yandex SDK failed to load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.dataset.trifoldYandexSdk = '1';
    script.src = '/sdk.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Yandex SDK failed to load.'));
    document.head.append(script);
  });
}

export function loadPlatformServices(): Promise<PlatformServices> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = (async () => {
    try {
      if (isLocalDev() && !(globalThis as any).YaGames?.init) {
        const hostname = typeof location === 'undefined' ? 'localhost' : location.hostname;
        if (!shouldAttemptYandexSdkLoad(hostname, isYandexDevProxyEnabled())) {
          return createUnavailablePlatformServices();
        }
      }
      await ensureSdkScript();
      const yaGames = (globalThis as any).YaGames;
      if (!yaGames?.init) return createUnavailablePlatformServices();
      const sdk = await yaGames.init();
      return createYandexPlatformServices(sdk as YandexSdkLike);
    } catch (error) {
      console.warn('[Trifold] Yandex SDK unavailable; continuing in guest mode.', error);
      return createUnavailablePlatformServices();
    }
  })();
  return loaderPromise;
}
