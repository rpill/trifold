import {
  createUnavailablePlatformServices,
  type GameplayMarkup,
  type PlatformAds,
  type PlatformLeaderboardEntry,
  type PlatformLeaderboards,
  type PlatformPause,
  type PlatformServices,
  type PlayerStorage,
  type TrustedClock,
} from './services.ts';

interface YandexLeaderboardEntry {
  rank: number;
  score: number;
  player: {
    publicName: string;
    uniqueID: string;
    getAvatarSrc?: (size?: 'small' | 'medium' | 'large') => string;
  };
}

interface YandexAdv {
  showFullscreenAdv(options: { callbacks: {
    onOpen?: () => void;
    onClose?: (wasShown: boolean) => void;
    onError?: (error: object) => void;
  } }): void;
}

interface YandexLeaderboards {
  getEntries(name: string, options: { quantityTop: number }): Promise<{ entries: YandexLeaderboardEntry[] }>;
  getPlayerEntry(name: string): Promise<YandexLeaderboardEntry>;
  setScore(name: string, score: number): Promise<void>;
}

interface YandexPlayer {
  getUniqueID?(): string;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  isAuthorized(): boolean;
}

export interface YandexSdk {
  environment?: { i18n?: { lang?: string } };
  getPlayer(): Promise<YandexPlayer>;
  serverTime?: () => number;
  isAvailableMethod?: (method: string) => Promise<boolean>;
  auth?: { openAuthDialog(): Promise<void> };
  leaderboards?: YandexLeaderboards;
  adv?: YandexAdv;
  EVENTS?: { ACCOUNT_SELECTION_DIALOG_CLOSED?: string };
  on?: (eventName: string, listener: () => void) => void;
  off?: (eventName: string, listener: () => void) => void;
  features?: {
    LoadingAPI?: { ready(): void | Promise<void> };
    GameplayAPI?: { start(): void | Promise<void>; stop(): void | Promise<void> };
  };
}

interface YandexGamesApi { init(): Promise<YandexSdk> }

declare global {
  interface Window { YaGames?: YandexGamesApi }
}

const SDK_PATH = '/sdk.js';
const PAUSE_EVENT = 'game_api_pause';
const RESUME_EVENT = 'game_api_resume';
let loaderPromise: Promise<PlatformServices> | null = null;
let sdkScriptPromise: Promise<void> | null = null;

export function shouldAttemptYandexSdkLoad(hostname: string, yandexDevProxyEnabled: boolean): boolean {
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  return !local || yandexDevProxyEnabled;
}

function isYandexDevProxyEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: { VITE_YANDEX_DEV?: string } }).env;
  return env?.VITE_YANDEX_DEV === 'true';
}

async function ensureSdkScript(): Promise<void> {
  if (typeof window === 'undefined' || window.YaGames !== undefined) return;
  const hostname = window.location?.hostname ?? '';
  if (!shouldAttemptYandexSdkLoad(hostname, isYandexDevProxyEnabled())) return;
  if (window.location?.protocol !== 'https:' || typeof document === 'undefined') return;
  if (sdkScriptPromise === null) {
    sdkScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-trifold-yandex-sdk]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Yandex SDK failed to load.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.trifoldYandexSdk = '1';
      script.src = SDK_PATH;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Yandex SDK failed to load.'));
      document.head.appendChild(script);
    });
  }
  await sdkScriptPromise;
}

function toPlatformEntry(entry: YandexLeaderboardEntry): PlatformLeaderboardEntry {
  let avatarUrl: string | undefined;
  try {
    const candidate = entry.player.getAvatarSrc?.('small')?.trim();
    if (candidate) avatarUrl = candidate;
  } catch {
    avatarUrl = undefined;
  }
  return {
    rank: entry.rank,
    score: entry.score,
    playerId: entry.player.uniqueID,
    publicName: entry.player.publicName,
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

async function requireMethod(sdk: YandexSdk, method: string): Promise<void> {
  if (sdk.isAvailableMethod && !(await sdk.isAvailableMethod(method))) {
    throw new Error(`Yandex method is unavailable: ${method}`);
  }
}

function playerNotPresent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === 'LEADERBOARD_PLAYER_NOT_PRESENT';
}

function createLeaderboards(sdk: YandexSdk): PlatformLeaderboards {
  const api = sdk.leaderboards;
  if (!api) {
    return { available: false, getEntries: async () => [], getPlayerEntry: async () => null, setScore: async () => undefined };
  }
  return {
    available: true,
    async getEntries(name, options) {
      try {
        const response = await api.getEntries(name, { quantityTop: options.quantityTop });
        return Array.isArray(response?.entries) ? response.entries.map(toPlatformEntry) : [];
      } catch {
        return [];
      }
    },
    async getPlayerEntry(name) {
      try {
        await requireMethod(sdk, 'leaderboards.getPlayerEntry');
        return toPlatformEntry(await api.getPlayerEntry(name));
      } catch (error) {
        if (playerNotPresent(error)) return null;
        return null;
      }
    },
    async setScore(name, score) {
      if (!Number.isFinite(score) || score <= 0) return;
      try {
        await requireMethod(sdk, 'leaderboards.setScore');
        await api.setScore(name, score);
      } catch {
        // Leaderboard synchronization is best-effort.
      }
    },
  };
}

function createAds(sdk: YandexSdk): PlatformAds {
  if (!sdk.adv) return { available: false, showInterstitial: async () => false };
  return {
    available: true,
    showInterstitial: () => new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        sdk.adv!.showFullscreenAdv({ callbacks: {
          onClose: (wasShown) => finish(wasShown),
          onError: () => finish(false),
        } });
      } catch {
        finish(false);
      }
    }),
  };
}

function ignoreSdkCall(call: () => void | Promise<void>): void {
  try { void Promise.resolve(call()).catch(() => undefined); } catch { /* optional SDK telemetry */ }
}

function createGameplay(sdk: YandexSdk): GameplayMarkup {
  return {
    start: () => {
      const start = sdk.features?.GameplayAPI?.start;
      if (start) ignoreSdkCall(() => start.call(sdk.features!.GameplayAPI));
    },
    stop: () => {
      const stop = sdk.features?.GameplayAPI?.stop;
      if (stop) ignoreSdkCall(() => stop.call(sdk.features!.GameplayAPI));
    },
  };
}

function createPause(sdk: YandexSdk): PlatformPause {
  if (!sdk.on || !sdk.off) return { isPaused: () => false, subscribe: () => () => undefined };
  let paused = false;
  const listeners = new Set<(paused: boolean) => void>();
  const onPause = () => {
    if (paused) return;
    paused = true;
    for (const listener of listeners) listener(true);
  };
  const onResume = () => {
    if (!paused) return;
    paused = false;
    for (const listener of listeners) listener(false);
  };
  sdk.on(PAUSE_EVENT, onPause);
  sdk.on(RESUME_EVENT, onResume);
  return {
    isPaused: () => paused,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function createPlayerStorage(getPlayer: () => Promise<YandexPlayer>): PlayerStorage {
  return {
    scope: async () => `yandex-${(await getPlayer()).getUniqueID?.() ?? 'player'}`,
    loadStrict: async () => (await getPlayer()).getData(),
    saveStrict: async (data, flush = false) => (await getPlayer()).setData(data, flush),
    load: async () => {
      try { return await (await getPlayer()).getData(); } catch { return {}; }
    },
    save: async (data, flush = false) => {
      try { await (await getPlayer()).setData(data, flush); } catch { /* local product flow continues */ }
    },
  };
}

function createTrustedClock(sdk: YandexSdk): TrustedClock {
  return {
    nowMs: () => {
      try {
        const value = sdk.serverTime?.();
        return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : null;
      } catch {
        return null;
      }
    },
  };
}

export async function createYandexPlatformServices(sdk: YandexSdk): Promise<PlatformServices> {
  let playerPromise = sdk.getPlayer();
  let player: YandexPlayer | null = null;
  const getPlayer = async () => {
    if (player) return player;
    try { player = await playerPromise; }
    catch { playerPromise = sdk.getPlayer(); player = await playerPromise; }
    return player;
  };
  const reacquirePlayer = async () => {
    playerPromise = sdk.getPlayer();
    player = await playerPromise;
    return player;
  };

  let readyCalled = false;
  return {
    language: sdk.environment?.i18n?.lang,
    playerStorage: createPlayerStorage(getPlayer),
    trustedClock: createTrustedClock(sdk),
    auth: {
      isAuthorized: () => player?.isAuthorized() ?? false,
      requestAuthorization: async () => {
        const current = await getPlayer();
        if (current.isAuthorized()) return true;
        if (!sdk.auth?.openAuthDialog) return false;
        try {
          await sdk.auth.openAuthDialog();
          return (await reacquirePlayer()).isAuthorized();
        } catch {
          return false;
        }
      },
      onAccountSelectionClosed(listener) {
        const event = sdk.EVENTS?.ACCOUNT_SELECTION_DIALOG_CLOSED;
        if (!event || !sdk.on || !sdk.off) return () => undefined;
        sdk.on(event, listener);
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          sdk.off!(event, listener);
        };
      },
    },
    leaderboards: createLeaderboards(sdk),
    ads: createAds(sdk),
    platformPause: createPause(sdk),
    gameplay: createGameplay(sdk),
    ready: () => {
      if (readyCalled) return;
      readyCalled = true;
      ignoreSdkCall(() => sdk.features?.LoadingAPI?.ready());
    },
  };
}

export function loadPlatformServices(): Promise<PlatformServices> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = (async () => {
    try {
      await ensureSdkScript();
      if (typeof window === 'undefined' || !window.YaGames?.init) return createUnavailablePlatformServices();
      let sdk: YandexSdk;
      try { sdk = await window.YaGames.init(); }
      catch { sdk = await window.YaGames.init(); }
      return createYandexPlatformServices(sdk);
    } catch {
      return createUnavailablePlatformServices();
    }
  })();
  return loaderPromise;
}
