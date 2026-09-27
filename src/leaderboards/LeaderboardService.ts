import type { PlatformLeaderboardEntry, PlatformServices } from '../platform/services.ts';
import {
  decodeDailyLeaderboardScore,
  decodeMasteryScore,
  decodeStreakScore,
  encodeDailyLeaderboardScore,
  encodeStreakScore,
  getLeaderboardName,
  type GlobalLeaderboardMode,
} from './LeaderboardConfig.ts';
import { LeaderboardSubmissionQueue } from './LeaderboardSubmissionQueue.ts';

export type LeaderboardMetric =
  | { readonly kind: 'daily'; readonly moves: number; readonly elapsedMs: number }
  | { readonly kind: 'streak'; readonly current: number; readonly best: number }
  | { readonly kind: 'mastery'; readonly rank: NonNullable<ReturnType<typeof decodeMasteryScore>>['rank']; readonly points: number };

export interface LeaderboardRow {
  readonly rank: number;
  readonly publicName: string;
  readonly avatarUrl?: string;
  readonly value: number;
  readonly metric: LeaderboardMetric;
}

export type LeaderboardLoadResult =
  | { readonly status: 'ready'; readonly entries: readonly LeaderboardRow[]; readonly playerEntry: LeaderboardRow | null; readonly authorized: boolean }
  | { readonly status: 'unavailable'|'error'; readonly entries: readonly []; readonly playerEntry: null; readonly authorized: boolean };
export type LeaderboardSyncResult = 'submitted'|'unchanged'|'skipped';

function validRank(entry: PlatformLeaderboardEntry): boolean { return Number.isInteger(entry.rank) && entry.rank >= 1; }
function name(entry: PlatformLeaderboardEntry): string { return entry.publicName.trim(); }
function dailyRow(entry: PlatformLeaderboardEntry, dailyId: string): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  const decoded = decodeDailyLeaderboardScore(entry.score);
  if (!decoded || decoded.dailyId !== dailyId) return null;
  return { rank: entry.rank, publicName: name(entry), ...(entry.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}), value: decoded.elapsedMs, metric: { kind:'daily', moves:decoded.moves, elapsedMs:decoded.elapsedMs } };
}
function streakRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  try {
    const decoded=decodeStreakScore(entry.score);
    return { rank:entry.rank, publicName:name(entry), ...(entry.avatarUrl?{avatarUrl:entry.avatarUrl}:{}), value:decoded.current, metric:{kind:'streak',...decoded} };
  } catch { return null; }
}
function masteryRow(entry: PlatformLeaderboardEntry): LeaderboardRow | null {
  if (!validRank(entry)) return null;
  try {
    const decoded=decodeMasteryScore(entry.score);
    return { rank:entry.rank, publicName:name(entry), ...(entry.avatarUrl?{avatarUrl:entry.avatarUrl}:{}), value:entry.score, metric:{kind:'mastery',...decoded} };
  } catch { return null; }
}

export class LeaderboardService {
  private readonly platform: PlatformServices;
  private readonly submissions: LeaderboardSubmissionQueue;
  constructor(platform: PlatformServices) {
    this.platform = platform;
    this.submissions = new LeaderboardSubmissionQueue((technicalName,score)=>platform.leaderboards.setScore(technicalName,score));
  }
  get available(): boolean { return this.platform.leaderboards.available; }
  get authorized(): boolean { return this.platform.auth.isAuthorized(); }
  requestAuthorization(): Promise<boolean> { return this.platform.auth.requestAuthorization(); }

  async load(mode: GlobalLeaderboardMode, dailyId?: string): Promise<LeaderboardLoadResult> {
    const authorized=this.authorized;
    if (!this.available) return {status:'unavailable',authorized,entries:[],playerEntry:null};
    if (mode==='daily' && dailyId===undefined) return {status:'error',authorized,entries:[],playerEntry:null};
    const technicalName=getLeaderboardName(mode);
    const normalize = mode==='daily' ? (entry:PlatformLeaderboardEntry)=>dailyRow(entry,dailyId!) : mode==='streak' ? streakRow : masteryRow;
    let entries:LeaderboardRow[];
    try { entries=(await this.platform.leaderboards.getEntries(technicalName,{quantityTop:20})).map(normalize).filter((row):row is LeaderboardRow=>row!==null); }
    catch { return {status:'error',authorized,entries:[],playerEntry:null}; }
    if (!authorized) return {status:'ready',authorized:false,entries,playerEntry:null};
    let playerEntry:LeaderboardRow|null=null;
    try { const raw=await this.platform.leaderboards.getPlayerEntry(technicalName); playerEntry=raw?normalize(raw):null; } catch { playerEntry=null; }
    return {status:'ready',authorized:true,entries,playerEntry};
  }

  async syncDailyBest(dailyId:string,bestMoves:number|undefined,bestTimeMs:number|undefined):Promise<LeaderboardSyncResult>{
    if(!this.available||!this.authorized||bestMoves===undefined||bestTimeMs===undefined)return'skipped';
    let score:number; try{score=encodeDailyLeaderboardScore(dailyId,bestMoves,bestTimeMs);}catch{return'skipped';}
    const board=getLeaderboardName('daily');
    try{
      const server=await this.platform.leaderboards.getPlayerEntry(board);
      if(server){const decoded=decodeDailyLeaderboardScore(server.score);if(decoded?.dailyId===dailyId&&decoded.moves===Math.round(bestMoves)&&decoded.elapsedMs===Math.round(bestTimeMs))return'unchanged';if(decoded&&decoded.dailyId>dailyId)return'skipped';}
      await this.submissions.enqueue(board,score,'latest');return'submitted';
    }catch{return'skipped';}
  }
  async syncDailyStreak(current:number,best:number):Promise<LeaderboardSyncResult>{
    if(!this.available||!this.authorized)return'skipped';let score:number;try{score=encodeStreakScore(current,best);}catch{return'skipped';}
    const board=getLeaderboardName('streak');try{const server=await this.platform.leaderboards.getPlayerEntry(board);if(server?.score===score)return'unchanged';await this.submissions.enqueue(board,score,'latest');return'submitted';}catch{return'skipped';}
  }
  async syncMasteryScore(score:number):Promise<LeaderboardSyncResult>{
    if(!this.available||!this.authorized||!Number.isSafeInteger(score)||score<=0)return'skipped';const board=getLeaderboardName('mastery');
    try{const server=await this.platform.leaderboards.getPlayerEntry(board);if(server&&Number.isSafeInteger(server.score)&&server.score>=score)return'unchanged';await this.submissions.enqueue(board,score);return'submitted';}catch{return'skipped';}
  }
}
