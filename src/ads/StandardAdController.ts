import type { PlatformServices } from '../platform/services.ts';

const STANDARD_INTERSTITIAL_EVERY = 3;
const STANDARD_INTERSTITIAL_COOLDOWN_MS = 2 * 60 * 1000;

export interface StandardAdAnalytics {
  track(event: 'fullscreen_requested' | 'fullscreen_shown' | 'fullscreen_not_shown', payload?: Readonly<Record<string, unknown>>): void;
}

const NOOP_ANALYTICS: StandardAdAnalytics = { track: () => undefined };

export class StandardAdController {
  private readonly platform: PlatformServices;
  private readonly analytics: StandardAdAnalytics;
  private freshStandardDealCount = 0;
  private lastInterstitialRequestAt: number | null = null;

  constructor(platform: PlatformServices, analytics: StandardAdAnalytics = NOOP_ANALYTICS) {
    this.platform = platform;
    this.analytics = analytics;
  }

  async beforeFreshStandardDeal(): Promise<void> {
    this.freshStandardDealCount += 1;
    if (this.freshStandardDealCount % STANDARD_INTERSTITIAL_EVERY !== 0) return;
    if (!this.platform.ads.available) return;
    const now = this.platform.trustedClock.nowMs() ?? Date.now();
    if (this.lastInterstitialRequestAt !== null && now - this.lastInterstitialRequestAt < STANDARD_INTERSTITIAL_COOLDOWN_MS) return;
    this.lastInterstitialRequestAt = now;
    this.analytics.track('fullscreen_requested');
    try {
      const shown = await this.platform.ads.showInterstitial();
      this.analytics.track(shown ? 'fullscreen_shown' : 'fullscreen_not_shown');
    } catch {
      this.analytics.track('fullscreen_not_shown', { reason: 'exception' });
    }
  }
}
