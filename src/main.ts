import Phaser from 'phaser';
import './styles.css';
import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { GameScene } from './game/scenes/GameScene.ts';
import { createRuntimeServices, installRuntimeServices, type RuntimeServices } from './meta/RuntimeServices.ts';
import { planHiDpiCanvas } from './render/HiDpiCanvas.ts';
import { BootScene } from './ui/scenes/BootScene.ts';
import { HomeScene } from './ui/scenes/HomeScene.ts';
import { MasteryScene } from './ui/scenes/MasteryScene.ts';
import { DailyScene } from './ui/scenes/DailyScene.ts';
import { LeaderboardsScene } from './ui/scenes/LeaderboardsScene.ts';
import { HowToPlayScene } from './ui/scenes/HowToPlayScene.ts';
import { SettingsScene } from './ui/scenes/SettingsScene.ts';
import { loadPlatformServices } from './platform/yandex.ts';
import { AnalyticsService } from './analytics/AnalyticsService.ts';
import { createYandexMetricaSink, initializeYandexMetrica } from './analytics/YandexMetrica.ts';
import { resolveAppLanguage } from './i18n/Language.ts';
import { tr } from './i18n/Localization.ts';
import { createTrifoldProductHandlers, productBridge, syncProductLeaderboards } from './ui/bridge/TrifoldProductBridge.ts';
import { toLocalDateKey } from './meta/daily/DailyDate.ts';
import { parseVisualQaRequest } from './dev/visual-qa/VisualQaMode.ts';

const hostElement = document.querySelector<HTMLElement>('#game');
if (!hostElement) throw new Error('Missing #game host.');
const host: HTMLElement = hostElement;

const FIRST_RUN_ANALYTICS_KEY = 'trifold:analytics:first-run:v1';

function metricaCounterId(): number | null {
  const meta = import.meta as ImportMeta & { env?: Readonly<Record<string, string | undefined>> };
  const raw = meta.env?.VITE_YANDEX_METRICA_ID;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function trackFirstRun(analytics: AnalyticsService): void {
  if (!analytics.configured) return;
  try {
    if (localStorage.getItem(FIRST_RUN_ANALYTICS_KEY) === '1') return;
    analytics.track('first_run');
    localStorage.setItem(FIRST_RUN_ANALYTICS_KEY, '1');
  } catch {
    analytics.track('first_run');
  }
}

function readHostSize(): { width: number; height: number } {
  const rect = host.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

async function startRuntime(services: RuntimeServices, options: { readonly visualQa: boolean }): Promise<Phaser.Game> {
  installRuntimeServices(services);
  if (!options.visualQa) trackFirstRun(services.analytics);
  const platform = services.platform;
  return await startWhenHostReady(readHostSize, ({ width, height }) => {
    let current = planHiDpiCanvas(width, height, window.devicePixelRatio);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: current.backingWidth,
      height: current.backingHeight,
      input: { activePointers: 3 },
      scale: {
        mode: Phaser.Scale.NONE,
        zoom: current.cssZoom,
        autoRound: true,
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      scene: [BootScene, HomeScene, GameScene, MasteryScene, DailyScene, LeaderboardsScene, HowToPlayScene, SettingsScene],
    });
    const currentDailyId = (): string => toLocalDateKey(new Date(platform.trustedClock.nowMs() ?? Date.now()));
    const productHandlers = createTrifoldProductHandlers({
      getState: () => services.metaSession.state,
      replaceState: (state) => services.metaSession.replaceAndFlush(state),
      getActiveGame: () => services.activeGames.load(),
      getCurrentDailyId: currentDailyId,
      leaderboards: services.leaderboards,
      authorizeProductAccount: services.authorizeProductAccount,
      syncLeaderboardsAfterAuthorization: async () => {
        const todayKey = currentDailyId();
        await syncProductLeaderboards(services.leaderboards, services.metaSession.state, 'daily', todayKey, todayKey);
      },
      settings: {
        snapshot: () => ({ soundEnabled: services.preferences.soundEnabled, language: services.preferences.language }),
        setSoundEnabled: (enabled) => services.preferences.setSoundEnabled(enabled),
        setLanguage: (language) => services.preferences.setLanguage(language),
      },
      resumeGame: () => {
        const active = services.activeGames.load();
        if (active?.mode === 'daily') game.scene.start('GameScene', { mode: 'resume-daily' });
        else if (active?.mode === 'standard') game.scene.start('GameScene', { mode: 'resume-standard' });
      },
      launchStandard: (difficulty) => game.scene.start('GameScene', { mode: 'new-standard', difficulty }),
      launchDaily: (dailyId) => game.scene.start('GameScene', { mode: 'new-daily', dailyDateKey: dailyId ?? currentDailyId() }),
      closeHowToPlay: (onboarding) => {
        if (onboarding) services.preferences.markHowToPlaySeen();
        game.scene.start('HomeScene');
      },
    });
    productBridge.install(productHandlers);
    platform.ready();

    const resize = (): void => {
      const size = readHostSize();
      const next = planHiDpiCanvas(size.width, size.height, window.devicePixelRatio);
      const zoomChanged = next.cssZoom !== current.cssZoom;
      const sizeChanged = next.backingWidth !== current.backingWidth
        || next.backingHeight !== current.backingHeight;
      if (zoomChanged) game.scale.setZoom(next.cssZoom);
      if (sizeChanged) game.scale.resize(next.backingWidth, next.backingHeight);
      current = next;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener('resize', resize);
    game.events.once(Phaser.Core.Events.DESTROY, () => {
      productBridge.uninstall(productHandlers);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    });

    return game;
  });
}

async function startProductionRuntime(): Promise<Phaser.Game> {
  const platform = await loadPlatformServices();
  const counterId = metricaCounterId();
  initializeYandexMetrica(counterId);
  const analytics = new AnalyticsService(createYandexMetricaSink(counterId));
  const services = await createRuntimeServices({ platform, analytics });
  return await startRuntime(services, { visualQa: false });
}

async function startVisualQaRuntime(request: NonNullable<ReturnType<typeof parseVisualQaRequest>>): Promise<Phaser.Game> {
  const [{ getVisualQaScenario }, fixtures, mode] = await Promise.all([
    import('./dev/visual-qa/VisualQaCatalog.ts'),
    import('./dev/visual-qa/fixtures/index.ts'),
    import('./dev/visual-qa/VisualQaMode.ts'),
  ]);
  const scenario = getVisualQaScenario(request.scenarioId);
  if (!scenario) throw new RangeError(`Unknown Visual QA scenario: ${request.scenarioId}`);
  const fixture = fixtures.createVisualQaFixture(scenario.fixture);
  const runtime = await fixtures.createVisualQaRuntime(fixture);
  mode.installVisualQaLaunch({
    scenarioId: scenario.id,
    scene: runtime.scene,
    sceneData: runtime.sceneData,
    viewportId: request.viewportId,
  });
  return await startRuntime(runtime.services, { visualQa: true });
}

const visualQaRequest = parseVisualQaRequest(window.location.search, import.meta.env.DEV);
void (visualQaRequest ? startVisualQaRuntime(visualQaRequest) : startProductionRuntime()).catch((error) => {
  console.error('[Trifold] startup failed', error);
  host.textContent = tr(resolveAppLanguage(null, navigator.language), 'error.startup');
});
