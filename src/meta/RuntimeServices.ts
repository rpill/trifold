import { VerifiedDealCatalog } from '../game/model/VerifiedDealCatalog.ts';
import { LocalProfileStore } from './profile/LocalProfileStore.ts';
import { ProfileRepository, type ProfileStore } from './profile/ProfileRepository.ts';
import { ThemeRuntime } from '../theme/ThemeRuntime.ts';
import type { PaymentsGateway, RewardedAdGateway } from '../platform/MonetizationGateways.ts';
import { createUnavailablePlatformServices, type PlatformServices } from '../platform/services.ts';
import { LeaderboardService } from '../leaderboards/LeaderboardService.ts';
import { AnalyticsService } from '../analytics/AnalyticsService.ts';
import { resolveAppLanguage, type AppLanguage } from '../i18n/Language.ts';

export interface RuntimeServices {
  readonly repository: ProfileRepository;
  readonly catalog: VerifiedDealCatalog;
  readonly theme: ThemeRuntime;
  readonly rewardedAds: RewardedAdGateway;
  readonly payments: PaymentsGateway;
  readonly platform: PlatformServices;
  readonly leaderboards: LeaderboardService;
  readonly analytics: AnalyticsService;
  readonly language: AppLanguage;
}

export interface RuntimeServicesOptions {
  readonly store?: ProfileStore;
  readonly catalogLoader?: () => Promise<VerifiedDealCatalog>;
  readonly rewardedAds?: RewardedAdGateway;
  readonly payments?: PaymentsGateway;
  readonly platform?: PlatformServices;
  readonly analytics?: AnalyticsService;
}

let installed: RuntimeServices | null = null;

async function loadProductionCatalog(): Promise<VerifiedDealCatalog> {
  const [manifestResponse, binaryResponse] = await Promise.all([
    fetch('/assets/deals/verified-deals-manifest.json'),
    fetch('/assets/deals/verified-deals.bin'),
  ]);
  if (!manifestResponse.ok) throw new Error(`Verified deal manifest failed to load: ${manifestResponse.status}.`);
  if (!binaryResponse.ok) throw new Error(`Verified deal binary failed to load: ${binaryResponse.status}.`);
  return VerifiedDealCatalog.decode(
    await binaryResponse.arrayBuffer(),
    await manifestResponse.json(),
  );
}

export async function createRuntimeServices(options: RuntimeServicesOptions = {}): Promise<RuntimeServices> {
  const repository = await ProfileRepository.open(options.store ?? new LocalProfileStore());
  const catalog = await (options.catalogLoader ?? loadProductionCatalog)();
  const platform = options.platform ?? createUnavailablePlatformServices();
  return {
    repository,
    catalog,
    theme: new ThemeRuntime(repository.current.activeThemeId),
    rewardedAds: options.rewardedAds ?? platform.ads,
    payments: options.payments ?? platform.payments,
    platform,
    leaderboards: new LeaderboardService(platform.leaderboards, platform.auth),
    analytics: options.analytics ?? new AnalyticsService(),
    get language(): AppLanguage {
      return resolveAppLanguage(repository.current.settings.language, platform.language);
    },
  };
}

export function installRuntimeServices(services: RuntimeServices): void {
  installed = services;
}

export function getRuntimeServices(): RuntimeServices {
  if (!installed) throw new Error('Trifold runtime services have not been initialized.');
  return installed;
}
