import type { AnalyticsEvent, AnalyticsPayload, AnalyticsSink } from './AnalyticsService.ts';

type YmFunction = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
type YmResolver = () => YmFunction | undefined;

export interface MetricaEnvironment {
  getYm(): YmFunction | undefined;
  setYm(ym: YmFunction): void;
  loadScript(src: string): void;
}

interface QueuedGoal {
  readonly event: AnalyticsEvent;
  readonly payload: AnalyticsPayload;
}

const initializedCounters = new Set<number>();
const METRICA_SCRIPT = 'https://mc.yandex.ru/metrika/tag.js';

function defaultYmResolver(): YmFunction | undefined {
  const candidate = (globalThis as typeof globalThis & { ym?: YmFunction }).ym;
  return typeof candidate === 'function' ? candidate : undefined;
}

function browserEnvironment(): MetricaEnvironment {
  return {
    getYm: defaultYmResolver,
    setYm(ym): void {
      (globalThis as typeof globalThis & { ym?: YmFunction }).ym = ym;
    },
    loadScript(src): void {
      if (typeof document === 'undefined') return;
      if (document.querySelector(`script[src="${src}"]`)) return;
      const script = document.createElement('script');
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
    },
  };
}

function validCounterId(counterId: number | null | undefined): counterId is number {
  return Number.isSafeInteger(counterId) && (counterId ?? 0) > 0;
}

export function initializeYandexMetrica(
  counterId: number | null | undefined,
  environment: MetricaEnvironment = browserEnvironment(),
): boolean {
  if (!validCounterId(counterId)) return false;
  if (initializedCounters.has(counterId)) return true;

  let ym = environment.getYm();
  if (!ym) {
    const queuedYm = ((...args: unknown[]): void => {
      (queuedYm.a ??= []).push(args);
    }) as YmFunction;
    queuedYm.a = [];
    queuedYm.l = Date.now();
    environment.setYm(queuedYm);
    ym = queuedYm;
  }

  environment.loadScript(METRICA_SCRIPT);
  ym(counterId, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
  });
  initializedCounters.add(counterId);
  return true;
}

export function createYandexMetricaSink(
  counterId: number | null | undefined,
  resolveYm: YmResolver = defaultYmResolver,
): AnalyticsSink | null {
  if (!validCounterId(counterId)) return null;
  const id = counterId;
  const queue: QueuedGoal[] = [];

  const deliver = (ym: YmFunction, goal: QueuedGoal): void => {
    ym(id, 'reachGoal', goal.event, goal.payload);
  };

  return {
    send(event, payload): void {
      const ym = resolveYm();
      if (!ym) {
        if (queue.length < 50) queue.push({ event, payload });
        return;
      }
      while (queue.length > 0) {
        const pending = queue.shift();
        if (pending) deliver(ym, pending);
      }
      deliver(ym, { event, payload });
    },
  };
}
