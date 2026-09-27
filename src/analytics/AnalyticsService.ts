export const ANALYTICS_EVENTS = [
  'first_run', 'standard_start', 'standard_win', 'standard_reset',
  'standard_difficulty_selected', 'daily_open', 'daily_start', 'daily_win',
  'daily_archive_open', 'daily_archive_win', 'streak_changed', 'mastery_rank_up',
  'hint_attempt', 'hint_success',
  'leaderboard_open', 'auth_success', 'tutorial_start', 'tutorial_complete',
  'fullscreen_requested', 'fullscreen_shown', 'fullscreen_not_shown',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsPayload = Readonly<Record<string, AnalyticsValue>>;

export interface AnalyticsSink {
  send(event: AnalyticsEvent, payload: AnalyticsPayload): void;
}

export function normalizeAnalyticsPayload(
  raw: Readonly<Record<string, unknown>>,
): AnalyticsPayload {
  const normalized: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      normalized[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) normalized[key] = value;
  }
  return normalized;
}

export class AnalyticsService {
  readonly configured: boolean;
  private readonly sink: AnalyticsSink | null;

  constructor(sink?: AnalyticsSink | null) {
    this.sink = sink ?? null;
    this.configured = this.sink !== null;
  }

  track(event: AnalyticsEvent, payload: Readonly<Record<string, unknown>> = {}): void {
    if (!this.sink) return;
    try {
      this.sink.send(event, normalizeAnalyticsPayload(payload));
    } catch {
      // Analytics must never affect gameplay.
    }
  }
}
