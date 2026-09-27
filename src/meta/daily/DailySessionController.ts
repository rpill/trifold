import { createDeal } from '../../game/model/deal.ts';
import { TrifoldGame } from '../../game/model/TrifoldGame.ts';
import { isWon } from '../../game/model/TrifoldRules.ts';
import type { PlayerCommand, ReadonlyTrifoldState, TransactionResult, TrifoldSnapshot } from '../../game/model/types.ts';
import type { TrustedClock } from '../../platform/services.ts';
import { ActiveGameRepository } from '../../persistence/ActiveGameRepository.ts';
import type { TrifoldActiveGameSave } from '../../persistence/ActiveGameSave.ts';
import { MetaSession } from '../MetaSession.ts';
import { ActivePlayTimer, type ClockNow } from '../session/ActivePlayTimer.ts';
import { AttemptMetrics } from '../session/AttemptMetrics.ts';
import { getArchiveDateKeys, toLocalDateKey } from './DailyDate.ts';
import { getDailySelection, type DailyCatalogAccess } from './DailySchedule.ts';
import { beginDailyAttempt, settleDailyWin, type DailyWinSettlementResult } from './DailyWinSettlement.ts';

export type DailySessionKind = 'today' | 'archive';
export interface DailySessionViewState {
  readonly seed:number; readonly dailyDateKey:string; readonly kind:DailySessionKind;
  readonly moves:number; readonly activeMs:number; readonly won:boolean; readonly expired:boolean; readonly assisted:boolean;
}
interface DailySessionBaseInput {
  readonly metaSession: MetaSession;
  readonly activeGames: ActiveGameRepository;
  readonly catalog: DailyCatalogAccess;
  readonly todayKey?: string;
  readonly trustedClock?: TrustedClock;
  readonly localNowMs?: () => number;
  readonly timerNow?: ClockNow;
  readonly wallNow?: () => number;
  readonly calendarDateKeyNow?: () => string;
}
export interface StartTodayDailySessionInput extends DailySessionBaseInput {}
export interface StartArchiveDailySessionInput extends DailySessionBaseInput { readonly dailyDateKey:string }
export interface ResumeDailySessionInput extends DailySessionBaseInput {}
export type DailyDateChangeResult = {readonly status:'active'|'expired-today'|'expired-archive'; readonly dailyDateKey:string};

function wallTimestamp(now:()=>number):number { const value=now(); if(!Number.isFinite(value)||value<0) throw new Error('wallNow must return a non-negative timestamp.'); return Math.floor(value); }
function localDateKeyFromMs(ms:number):string { return toLocalDateKey(new Date(ms)); }
function resolveTodayKey(input:DailySessionBaseInput):string {
  if(input.todayKey) return input.todayKey;
  const trusted=input.trustedClock?.nowMs() ?? null;
  const ms=trusted ?? (input.localNowMs?.() ?? Date.now());
  return localDateKeyFromMs(ms);
}
function isArchiveAvailable(dateKey:string,todayKey:string):boolean { return getArchiveDateKeys(todayKey,90).includes(dateKey as never); }
function attemptId(dateKey:string, attemptNumber:number):string { return `daily-${dateKey}~${Math.max(1,attemptNumber)}`; }

export class DailySessionController {
  private readonly metaSession:MetaSession;
  private readonly activeGames:ActiveGameRepository;
  private readonly game:TrifoldGame;
  private readonly seed:number;
  private readonly dailyDateKey:string;
  private readonly kind:DailySessionKind;
  private readonly attemptId:string;
  private readonly wallNow:()=>number;
  private readonly calendarDateKeyNow:()=>string;
  private readonly timer:ActivePlayTimer;
  private readonly metrics:AttemptMetrics;
  private visible=true;
  private blockingOverlayOpen=false;
  private wonState:boolean;
  private expiredState=false;
  private settled=false;
  private settlement:DailyWinSettlementResult|null=null;
  private persistenceQueue:Promise<void>=Promise.resolve();

  private constructor(
    metaSession:MetaSession, activeGames:ActiveGameRepository, game:TrifoldGame, seed:number, dailyDateKey:string,
    kind:DailySessionKind, currentAttemptId:string, timerNow:ClockNow, wallNow:()=>number, calendarDateKeyNow:()=>string,
    initial:{readonly moves:number;readonly activeMs:number;readonly assisted:boolean},
  ) {
    this.metaSession=metaSession; this.activeGames=activeGames; this.game=game; this.seed=seed; this.dailyDateKey=dailyDateKey;
    this.kind=kind; this.attemptId=currentAttemptId; this.wallNow=wallNow; this.calendarDateKeyNow=calendarDateKeyNow;
    this.metrics=new AttemptMetrics(initial); this.timer=new ActivePlayTimer(timerNow,initial.activeMs); this.wonState=isWon(game.state);
    if(this.wonState) this.timer.finish();
  }

  static async startToday(input:StartTodayDailySessionInput):Promise<DailySessionController> {
    const todayKey=resolveTodayKey(input); const selection=getDailySelection(input.catalog,todayKey);
    return this.startNew(input,selection.dateKey,selection.seed,'today',todayKey);
  }
  static async startArchive(input:StartArchiveDailySessionInput):Promise<DailySessionController> {
    const todayKey=resolveTodayKey(input);
    if(input.dailyDateKey===todayKey||!isArchiveAvailable(input.dailyDateKey,todayKey)) throw new RangeError('Daily date is outside the current archive window.');
    const selection=getDailySelection(input.catalog,input.dailyDateKey);
    return this.startNew(input,selection.dateKey,selection.seed,'archive',todayKey);
  }
  static resume(input:ResumeDailySessionInput):DailySessionController {
    const todayKey=resolveTodayKey(input); const saved=input.activeGames.load();
    if(!saved||saved.mode!=='daily'||!saved.daily) throw new Error('There is no active Daily attempt to resume.');
    if(!isArchiveAvailable(saved.daily.dateKey,todayKey)) throw new RangeError('Saved Daily attempt is outside the current archive window.');
    const selection=getDailySelection(input.catalog,saved.daily.dateKey); if(selection.seed!==saved.seed) throw new Error('Saved Daily seed does not match verified schedule.');
    const record=input.metaSession.state.daily.records[saved.daily.dateKey];
    const currentAttemptId=saved.attemptId ?? record?.rankingAttemptId ?? attemptId(saved.daily.dateKey,Math.max(1,record?.attempts ?? 1));
    const controller=new DailySessionController(
      input.metaSession,input.activeGames,TrifoldGame.restore(saved.game),saved.seed,saved.daily.dateKey,
      saved.daily.dateKey===todayKey?'today':'archive',currentAttemptId,input.timerNow??(()=>performance.now()),input.wallNow??(()=>Date.now()),
      input.calendarDateKeyNow??(()=>resolveTodayKey(input)),{moves:saved.moves,activeMs:saved.activeMs,assisted:saved.assisted},
    );
    controller.settleInitialAutoMoves(); controller.syncTimerState(); return controller;
  }
  static async resumeOrClearExpired(input:ResumeDailySessionInput):Promise<DailySessionController> {
    const todayKey=resolveTodayKey(input); const saved=input.activeGames.load();
    if(!saved||saved.mode!=='daily'||!saved.daily) throw new Error('There is no active Daily attempt to resume.');
    if(!isArchiveAvailable(saved.daily.dateKey,todayKey)){ input.activeGames.clear(); throw new RangeError('Saved Daily attempt is outside the current archive window.'); }
    return this.resume({...input,todayKey});
  }
  private static async startNew(input:DailySessionBaseInput,dailyDateKey:string,seed:number,kind:DailySessionKind,todayKey:string):Promise<DailySessionController> {
    const previous=input.metaSession.state.daily.records[dailyDateKey]; const nextAttempt=(previous?.attempts??0)+1;
    const currentAttemptId=attemptId(dailyDateKey,nextAttempt);
    const begun=beginDailyAttempt(input.metaSession.state,dailyDateKey,{attemptId:currentAttemptId,rankingEligible:kind==='today'&&previous?.completed!==true});
    await input.metaSession.replaceAndFlush(begun);
    const controller=new DailySessionController(
      input.metaSession,input.activeGames,new TrifoldGame(createDeal(seed)),seed,dailyDateKey,kind,currentAttemptId,
      input.timerNow??(()=>performance.now()),input.wallNow??(()=>Date.now()),input.calendarDateKeyNow??(()=>resolveTodayKey({...input,todayKey})),
      {moves:0,activeMs:0,assisted:false},
    );
    input.activeGames.save(controller.captureActiveAttempt()); controller.syncTimerState(); return controller;
  }

  get state():ReadonlyTrifoldState { return this.game.state; }
  snapshot():TrifoldSnapshot { return this.game.snapshot(); }
  get canUndo():boolean { return !this.settled&&!this.wonState&&!this.expiredState&&this.game.canUndo; }
  get viewState():DailySessionViewState { return {seed:this.seed,dailyDateKey:this.dailyDateKey,kind:this.kind,moves:this.metrics.moves,activeMs:Math.floor(this.timer.elapsedMs),won:this.wonState,expired:this.expiredState,assisted:this.metrics.assisted}; }
  markAssisted():void { if(this.metrics.assisted) return; this.metrics.markAssisted(); this.queuePersist(); }
  perform(command:PlayerCommand):TransactionResult|null {
    if(this.settled||this.wonState||this.expiredState) return null; const result=this.game.perform(command); if(!result) return null;
    this.metrics.recordSuccessfulPlayerDecision(); this.wonState=result.won; if(this.wonState) this.timer.finish(); this.queuePersist(); return result;
  }
  settleInitialAutoMoves():TransactionResult {
    if(this.settled||this.expiredState) return {operations:[],won:this.wonState}; const result=this.game.settleInitialAutoMoves();
    this.wonState=result.won; if(this.wonState) this.timer.finish(); this.queuePersist(); return result;
  }
  undo():TransactionResult|null { if(!this.canUndo) return null; const result=this.game.undo(); if(!result)return null; this.metrics.recordUndo(); this.wonState=result.won; this.queuePersist(); return result; }
  setVisible(visible:boolean):void { if(this.visible===visible)return; if(!visible){this.timer.pause();this.visible=false;this.queuePersist();return;} this.visible=true;this.syncTimerState(); }
  setBlockingOverlayOpen(open:boolean):void { if(this.blockingOverlayOpen===open)return; if(open){this.timer.pause();this.blockingOverlayOpen=true;this.queuePersist();return;} this.blockingOverlayOpen=false;this.syncTimerState(); }
  handleDateChange():DailyDateChangeResult {
    const todayKey=this.calendarDateKeyNow(); if(todayKey===this.dailyDateKey)return {status:'active',dailyDateKey:this.dailyDateKey}; this.timer.pause();
    if(this.kind==='today'){this.expiredState=true;this.queuePersist();return {status:'expired-today',dailyDateKey:this.dailyDateKey};}
    if(!isArchiveAvailable(this.dailyDateKey,todayKey)){this.expiredState=true;this.persistenceQueue=this.persistenceQueue.then(()=>{const saved=this.activeGames.load();if(saved?.mode==='daily'&&saved.daily?.dateKey===this.dailyDateKey)this.activeGames.clear();});return {status:'expired-archive',dailyDateKey:this.dailyDateKey};}
    return {status:'active',dailyDateKey:this.dailyDateKey};
  }
  async flushPersistence():Promise<void>{await this.persistenceQueue;}
  async settleWin():Promise<DailyWinSettlementResult>{
    if(this.settlement)return this.settlement; if(!this.wonState)throw new Error('Cannot settle Daily attempt before it is won.');
    this.timer.finish();this.syncMetricsTime();await this.flushPersistence();
    const result=settleDailyWin(this.metaSession.state,{dailyDateKey:this.dailyDateKey,completionDateKey:this.calendarDateKeyNow(),attemptId:this.attemptId,moves:this.metrics.moves,activeMs:this.metrics.activeMs,assisted:this.metrics.assisted});
    const committed=await this.metaSession.replaceAndFlush(result.state); if(!committed)throw new Error('Daily settlement did not commit.');
    const saved=this.activeGames.load(); if(saved?.mode==='daily'&&saved.seed===this.seed&&saved.daily?.dateKey===this.dailyDateKey)this.activeGames.clear();
    this.settled=true;this.settlement={...result,state:this.metaSession.state};return this.settlement;
  }
  private syncTimerState():void { if(this.settled||this.wonState||this.expiredState||!this.visible||this.blockingOverlayOpen)this.timer.pause();else this.timer.resume(); }
  private syncMetricsTime():void { this.metrics.setActiveMs(Math.floor(this.timer.elapsedMs)); }
  private captureActiveAttempt():TrifoldActiveGameSave {
    this.syncMetricsTime(); return {version:1,mode:'daily',seed:this.seed,attemptId:this.attemptId,game:this.game.exportSave(),moves:this.metrics.moves,activeMs:this.metrics.activeMs,assisted:this.metrics.assisted,updatedAtMs:wallTimestamp(this.wallNow),daily:{dateKey:this.dailyDateKey,kind:this.kind}};
  }
  private queuePersist():void { if(this.settled)return;const snapshot=this.captureActiveAttempt();this.persistenceQueue=this.persistenceQueue.then(()=>{this.activeGames.save(snapshot);}); }
}
