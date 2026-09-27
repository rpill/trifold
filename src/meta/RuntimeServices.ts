import { VerifiedDealCatalog } from '../game/model/VerifiedDealCatalog.ts';
import { createUnavailablePlatformServices, type PlatformServices } from '../platform/services.ts';
import { LeaderboardService } from '../leaderboards/LeaderboardService.ts';
import { AnalyticsService } from '../analytics/AnalyticsService.ts';
import type { AppLanguage } from '../i18n/Language.ts';
import { ActiveGameRepository } from '../persistence/ActiveGameRepository.ts';
import { bootstrapMetaState, type LegacyBrowserStorage } from './MetaBootstrap.ts';
import { MetaJournal } from './MetaJournal.ts';
import { MetaSession } from './MetaSession.ts';
import { Preferences, type PreferenceStorage } from '../settings/Preferences.ts';
import { StandardAdController } from '../ads/StandardAdController.ts';
import { mergeMetaProfiles } from './ProfileMerge.ts';

export interface RuntimeServices {
  readonly metaSession: MetaSession;
  readonly authorizeProductAccount: () => Promise<boolean>;
  readonly activeGames: ActiveGameRepository;
  readonly catalog: VerifiedDealCatalog;
  readonly platform: PlatformServices;
  readonly leaderboards: LeaderboardService;
  readonly analytics: AnalyticsService;
  readonly standardAds: StandardAdController;
  readonly preferences: Preferences;
  readonly language: AppLanguage;
}

export interface RuntimeServicesOptions {
  readonly catalogLoader?: () => Promise<VerifiedDealCatalog>;
  readonly platform?: PlatformServices;
  readonly analytics?: AnalyticsService;
  readonly legacyLocalStorage?: LegacyBrowserStorage | null;
  readonly preferenceStorage?: PreferenceStorage | null;
}

let installed: RuntimeServices | null = null;

async function loadProductionCatalog(): Promise<VerifiedDealCatalog> {
  const [manifestResponse, binaryResponse] = await Promise.all([
    fetch('/assets/deals/verified-deals-manifest.json'),
    fetch('/assets/deals/verified-deals.bin'),
  ]);
  if (!manifestResponse.ok) throw new Error(`Verified deal manifest failed to load: ${manifestResponse.status}.`);
  if (!binaryResponse.ok) throw new Error(`Verified deal binary failed to load: ${binaryResponse.status}.`);
  return VerifiedDealCatalog.decode(await binaryResponse.arrayBuffer(), await manifestResponse.json());
}

function defaultLegacyStorage(): LegacyBrowserStorage | null {
  try {
    return (globalThis as typeof globalThis & { localStorage?: LegacyBrowserStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export async function createRuntimeServices(options: RuntimeServicesOptions = {}): Promise<RuntimeServices> {
  const platform = options.platform ?? createUnavailablePlatformServices();
  const activeGames = new ActiveGameRepository();
  const bootstrap = await bootstrapMetaState(
    platform.playerStorage,
    options.legacyLocalStorage === undefined ? defaultLegacyStorage() : options.legacyLocalStorage,
    activeGames,
  );
  let scope = 'local';
  const resolveScope = platform.playerStorage.scope;
  if (resolveScope) {
    try { scope = await resolveScope.call(platform.playerStorage); } catch { /* local journal remains isolated */ }
  }
  let metaSession = new MetaSession(platform.playerStorage, new MetaJournal(scope));
  const metaLoaded = await metaSession.load();
  if (!metaLoaded) {
    // A strict platform read can fail while legacy/local bootstrap data is still
    // usable. Keep the product session alive on that recovered state and retry
    // persistence through the normal MetaSession flush path.
    metaSession.adoptBootstrapState(bootstrap.meta);
    await metaSession.flush();
  } else if (!bootstrap.persisted) {
    // Bootstrap can successfully recover/migrate a profile even when the first
    // persistence write is unavailable. Keep that recovered state for the
    // current session instead of falling back to an empty normalized load.
    await metaSession.replaceAndFlush(bootstrap.meta);
  }
  let metaScope = scope;
  let authorizationInFlight: Promise<boolean> | null = null;

  const authorizeProductAccount = (): Promise<boolean> => {
    if (platform.auth.isAuthorized()) return Promise.resolve(true);
    if (authorizationInFlight) return authorizationInFlight;
    const sourceState = structuredClone(metaSession.state);
    const sourceScope = metaScope;
    authorizationInFlight = (async () => {
      const authorized = await platform.auth.requestAuthorization();
      if (!authorized) return false;
      let nextScope = sourceScope;
      try { nextScope = await platform.playerStorage.scope?.() ?? sourceScope; } catch { /* keep source scope */ }
      if (nextScope === sourceScope) return true;
      const nextSession = new MetaSession(platform.playerStorage, new MetaJournal(nextScope));
      if (!await nextSession.load()) return false;
      const merged = mergeMetaProfiles(nextSession.state, sourceState, sourceScope);
      if (!await nextSession.replaceAndFlush(merged)) return false;
      metaSession = nextSession;
      metaScope = nextScope;
      return true;
    })().finally(() => { authorizationInFlight = null; });
    return authorizationInFlight;
  };
  const preferences = new Preferences(options.preferenceStorage);
  preferences.importLegacy(bootstrap.preferences);
  preferences.initializeLanguage(platform.language);

  const catalog = await (options.catalogLoader ?? loadProductionCatalog)();
  const analytics = options.analytics ?? new AnalyticsService();
  return {
    get metaSession(): MetaSession { return metaSession; },
    authorizeProductAccount,
    activeGames,
    catalog,
    platform,
    leaderboards: new LeaderboardService(platform),
    analytics,
    standardAds: new StandardAdController(platform, analytics),
    preferences,
    get language(): AppLanguage { return preferences.language; },
  };
}

export function installRuntimeServices(services: RuntimeServices): void { installed = services; }
export function getRuntimeServices(): RuntimeServices {
  if (!installed) throw new Error('Trifold runtime services have not been initialized.');
  return installed;
}
