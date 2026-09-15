import type { DailyCatalogAccess, DailySelection } from '../meta/daily/DailySchedule.ts';
import { getDailySelection } from '../meta/daily/DailySchedule.ts';
import type { PlayerProfileV1 } from '../meta/profile/ProfileTypes.ts';
import type { LeaderboardEntry, PlatformAuth, PlatformLeaderboards } from '../platform/services.ts';
import {
  DAILY_LEADERBOARD_NAME,
  MASTERY_LEADERBOARD_NAME,
  STREAK_LEADERBOARD_NAME,
  decodeDailyScore,
  encodeDailyScore,
  encodeMasteryScore,
  encodeStreakScore,
} from './LeaderboardConfig.ts';
import { LeaderboardSubmissionQueue } from './LeaderboardSubmissionQueue.ts';

export type LeaderboardLoadStatus = 'ready' | 'unavailable' | 'error';
export interface DailyLeaderboardEntry extends LeaderboardEntry {
  readonly moves: number;
  readonly activeMs: number;
  readonly dailyOffset: number;
}
export interface LeaderboardLoadResult<T extends LeaderboardEntry = LeaderboardEntry> {
  readonly status: LeaderboardLoadStatus;
  readonly entries: readonly T[];
  readonly playerEntry: T | null;
}

function dailyEntry(entry: LeaderboardEntry, offset: number): DailyLeaderboardEntry | null {
  try {
    const decoded = decodeDailyScore(entry.score);
    if (decoded.dailyOffset !== offset) return null;
    return { ...entry, ...decoded };
  } catch {
    return null;
  }
}

export class LeaderboardService {
  private readonly leaderboards: PlatformLeaderboards;
  private readonly auth: PlatformAuth;
  private readonly queue = new LeaderboardSubmissionQueue();

  constructor(leaderboards: PlatformLeaderboards, auth: PlatformAuth) {
    this.leaderboards = leaderboards;
    this.auth = auth;
  }

  get available(): boolean { return this.leaderboards.available; }
  get authorized(): boolean { return this.auth.isAuthorized(); }

  async requestAuthorization(): Promise<boolean> {
    return this.auth.requestAuthorization();
  }

  async loadDaily(selection: DailySelection): Promise<LeaderboardLoadResult<DailyLeaderboardEntry>> {
    if (!this.leaderboards.available) return { status: 'unavailable', entries: [], playerEntry: null };
    try {
      const result = await this.leaderboards.getEntries(DAILY_LEADERBOARD_NAME, { includeUser: false, quantityTop: 20 });
      const entries = result.entries.map((entry) => dailyEntry(entry, selection.offset)).filter((entry): entry is DailyLeaderboardEntry => Boolean(entry));
      let playerEntry: DailyLeaderboardEntry | null = null;
      if (this.auth.isAuthorized()) {
        const raw = await this.leaderboards.getPlayerEntry(DAILY_LEADERBOARD_NAME);
        playerEntry = raw ? dailyEntry(raw, selection.offset) : null;
      }
      return { status: 'ready', entries, playerEntry };
    } catch {
      return { status: 'error', entries: [], playerEntry: null };
    }
  }

  async loadStreak(): Promise<LeaderboardLoadResult> {
    return this.loadSimple(STREAK_LEADERBOARD_NAME);
  }

  async loadMastery(): Promise<LeaderboardLoadResult> {
    return this.loadSimple(MASTERY_LEADERBOARD_NAME);
  }

  async syncFromProfile(profile: PlayerProfileV1, todayKey: string, catalog: DailyCatalogAccess): Promise<void> {
    if (!this.leaderboards.available || !this.auth.isAuthorized()) return;
    const selection = getDailySelection(catalog, todayKey);
    const official = profile.daily.history[todayKey]?.officialResult ?? null;
    const tasks: Promise<unknown>[] = [];
    if (official) {
      const score = encodeDailyScore(selection.offset, official.moves, official.activeMs);
      tasks.push(this.submitIfHigher(DAILY_LEADERBOARD_NAME, score));
    }
    tasks.push(this.submitIfHigher(STREAK_LEADERBOARD_NAME, encodeStreakScore(profile.daily.bestStreak)));
    tasks.push(this.submitIfHigher(MASTERY_LEADERBOARD_NAME, encodeMasteryScore(profile)));
    await Promise.all(tasks.map(async (task) => { try { await task; } catch { /* gameplay never waits on leaderboard failure */ } }));
  }

  private async loadSimple(name: string): Promise<LeaderboardLoadResult> {
    if (!this.leaderboards.available) return { status: 'unavailable', entries: [], playerEntry: null };
    try {
      const result = await this.leaderboards.getEntries(name, { includeUser: false, quantityTop: 20 });
      const playerEntry = this.auth.isAuthorized() ? await this.leaderboards.getPlayerEntry(name) : null;
      return { status: 'ready', entries: result.entries, playerEntry };
    } catch {
      return { status: 'error', entries: [], playerEntry: null };
    }
  }

  private submitIfHigher(name: string, score: number): Promise<void> {
    if (score <= 0) return Promise.resolve();
    return this.queue.run(name, async () => {
      let current: LeaderboardEntry | null = null;
      try { current = await this.leaderboards.getPlayerEntry(name); } catch { current = null; }
      if (current && current.score >= score) return;
      await this.queue.runScore(() => this.leaderboards.setScore(name, score));
    });
  }
}
