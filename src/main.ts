import Phaser from 'phaser';
import './styles.css';
import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { GameScene } from './game/scenes/GameScene.ts';
import { createRuntimeServices, installRuntimeServices } from './meta/RuntimeServices.ts';
import { planHiDpiCanvas } from './render/HiDpiCanvas.ts';
import { BootScene } from './ui/scenes/BootScene.ts';
import { HomeScene } from './ui/scenes/HomeScene.ts';
import { MasteryScene } from './ui/scenes/MasteryScene.ts';
import { DailyScene } from './ui/scenes/DailyScene.ts';
import { ThemesScene } from './ui/scenes/ThemesScene.ts';
import { LeaderboardsScene } from './ui/scenes/LeaderboardsScene.ts';
import { HowToPlayScene } from './ui/scenes/HowToPlayScene.ts';
import { SettingsScene } from './ui/scenes/SettingsScene.ts';
import { loadPlatformServices } from './platform/yandex.ts';
import { reconcileCoinPackPurchases } from './platform/PurchaseReconciliation.ts';
import { AnalyticsService } from './analytics/AnalyticsService.ts';
import { createYandexMetricaSink, initializeYandexMetrica } from './analytics/YandexMetrica.ts';
import { resolveAppLanguage } from './i18n/Language.ts';
import { tr } from './i18n/Localization.ts';

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

void loadPlatformServices().then(async (platform) => {
  const counterId = metricaCounterId();
  initializeYandexMetrica(counterId);
  const analytics = new AnalyticsService(createYandexMetricaSink(counterId));
  const services = await createRuntimeServices({ platform, analytics });
  installRuntimeServices(services);
  trackFirstRun(services.analytics);
  if (platform.auth.isAuthorized()) {
    await reconcileCoinPackPurchases(services.repository, services.payments);
  }
  return startWhenHostReady(readHostSize, ({ width, height }) => {
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
      scene: [BootScene, HomeScene, GameScene, MasteryScene, DailyScene, ThemesScene, LeaderboardsScene, HowToPlayScene, SettingsScene],
    });
    void platform.signalReady();

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
      observer.disconnect();
      window.removeEventListener('resize', resize);
    });

    return game;
  });
}).catch((error) => {
  console.error('[Trifold] startup failed', error);
  host.textContent = tr(resolveAppLanguage(null, navigator.language), 'error.startup');
});
