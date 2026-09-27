import { createDeal } from '../../game/model/deal.ts';
import { TrifoldGame } from '../../game/model/TrifoldGame.ts';
import { isWon } from '../../game/model/TrifoldRules.ts';
import type { VerifiedDealCatalog } from '../../game/model/VerifiedDealCatalog.ts';
import type { PlayerCommand, ReadonlyTrifoldState, TransactionResult, TrifoldSnapshot } from '../../game/model/types.ts';
import { TUTORIAL_SCENARIO } from '../../tutorial/TutorialScenario.ts';
import { ActiveGameRepository } from '../../persistence/ActiveGameRepository.ts';
import type { TrifoldActiveGameSave } from '../../persistence/ActiveGameSave.ts';
import type { StandardDifficulty, StandardPartition } from '../MetaSave.ts';
import { MetaSession } from '../MetaSession.ts';
import { ActivePlayTimer, type ClockNow } from '../session/ActivePlayTimer.ts';
import { AttemptMetrics } from '../session/AttemptMetrics.ts';
import { pickStandardSeed } from './StandardDealPicker.ts';
import { settleStandardWin, type StandardWinSettlementResult } from './StandardWinSettlement.ts';

export interface StandardSessionViewState {
  readonly seed:number; readonly partition:StandardPartition; readonly difficulty:StandardDifficulty;
  readonly moves:number; readonly activeMs:number; readonly assisted:boolean; readonly won:boolean;
}
export interface StartStandardSessionInput {
  readonly metaSession:MetaSession; readonly activeGames:ActiveGameRepository;
  readonly catalog:Pick<VerifiedDealCatalog,'getStandardSeeds'>; readonly requestedDifficulty:StandardDifficulty;
  readonly randomIndex:(size:number)=>number; readonly timerNow?:ClockNow; readonly wallNow?:()=>number;
}
export interface ResumeStandardSessionInput { readonly metaSession:MetaSession; readonly activeGames:ActiveGameRepository; readonly timerNow?:ClockNow; readonly wallNow?:()=>number }
export interface StartTutorialSessionInput extends ResumeStandardSessionInput {}

function wallTimestamp(now:()=>number):number { const value=now(); if(!Number.isFinite(value)||value<0)throw new Error('wallNow must return a non-negative timestamp.'); return Math.floor(value); }
function rememberSeed(values:readonly number[],seed:number):number[]{return [...values.filter(value=>value!==seed),seed].slice(-256);}

export class StandardSessionController {
  private readonly metaSession:MetaSession;
  private readonly activeGames:ActiveGameRepository;
  private readonly game:TrifoldGame;
  private readonly seed:number;
  private readonly partition:StandardPartition;
  private readonly difficulty:StandardDifficulty;
  private readonly wallNow:()=>number;
  private readonly timer:ActivePlayTimer;
  private readonly metrics:AttemptMetrics;
  private visible=true;
  private blockingOverlayOpen=false;
  private wonState:boolean;
  private settled=false;
  private settlement:StandardWinSettlementResult|null=null;
  private persistenceQueue:Promise<void>=Promise.resolve();
  private readonly persistActiveAttempt:boolean;
  private readonly preservedActiveGame:TrifoldActiveGameSave|null;

  private constructor(
    metaSession:MetaSession,activeGames:ActiveGameRepository,game:TrifoldGame,seed:number,partition:StandardPartition,difficulty:StandardDifficulty,
    timerNow:ClockNow,wallNow:()=>number,initial:{readonly moves:number;readonly activeMs:number;readonly assisted:boolean},
    persistActiveAttempt=true,preservedActiveGame:TrifoldActiveGameSave|null=null,
  ) {
    this.metaSession=metaSession;this.activeGames=activeGames;this.game=game;this.seed=seed;this.partition=partition;this.difficulty=difficulty;
    this.wallNow=wallNow;this.metrics=new AttemptMetrics(initial);this.persistActiveAttempt=persistActiveAttempt;this.preservedActiveGame=preservedActiveGame?structuredClone(preservedActiveGame):null;
    this.timer=new ActivePlayTimer(timerNow,initial.activeMs);this.wonState=isWon(game.state);if(this.wonState)this.timer.finish();
  }

  static async startNew(input:StartStandardSessionInput):Promise<StandardSessionController>{
    const state=input.metaSession.state;
    const selection=pickStandardSeed({catalog:input.catalog,requestedDifficulty:input.requestedDifficulty,onboardingWins:state.standard.onboardingWins,completedByPartition:state.standard.completed,randomIndex:input.randomIndex});
    const next={...state,standard:{...state.standard,selectedDifficulty:input.requestedDifficulty,recentSeeds:rememberSeed(state.standard.recentSeeds,selection.seed)}};
    await input.metaSession.replaceAndFlush(next);
    const controller=new StandardSessionController(input.metaSession,input.activeGames,new TrifoldGame(createDeal(selection.seed)),selection.seed,selection.partition,selection.difficulty,input.timerNow??(()=>performance.now()),input.wallNow??(()=>Date.now()),{moves:0,activeMs:0,assisted:false});
    input.activeGames.save(controller.captureActiveAttempt());controller.syncTimerState();return controller;
  }

  static startTutorial(input:StartTutorialSessionInput):StandardSessionController{
    const prepared=new TrifoldGame(createDeal(TUTORIAL_SCENARIO.seed));prepared.settleInitialAutoMoves();
    for(const command of TUTORIAL_SCENARIO.bootstrapCommands){const result=prepared.perform(command);if(!result)throw new Error('Frozen tutorial bootstrap command is no longer legal.');}
    const game=TrifoldGame.restore({version:1,seed:TUTORIAL_SCENARIO.seed,snapshot:prepared.snapshot(),history:{version:1,entries:[]}});
    const controller=new StandardSessionController(input.metaSession,input.activeGames,game,TUTORIAL_SCENARIO.seed,'onboarding','easy',input.timerNow??(()=>performance.now()),input.wallNow??(()=>Date.now()),{moves:0,activeMs:0,assisted:false},false,input.activeGames.load());
    controller.syncTimerState();return controller;
  }

  static resume(input:ResumeStandardSessionInput):StandardSessionController{
    const saved=input.activeGames.load();if(!saved||saved.mode!=='standard'||!saved.standard)throw new Error('There is no active Standard attempt to resume.');
    const controller=new StandardSessionController(input.metaSession,input.activeGames,TrifoldGame.restore(saved.game),saved.seed,saved.standard.partition,saved.standard.difficulty,input.timerNow??(()=>performance.now()),input.wallNow??(()=>Date.now()),{moves:saved.moves,activeMs:saved.activeMs,assisted:saved.assisted});
    controller.settleInitialAutoMoves();controller.syncTimerState();return controller;
  }

  get state():ReadonlyTrifoldState{return this.game.state;}
  snapshot():TrifoldSnapshot{return this.game.snapshot();}
  get canUndo():boolean{return !this.settled&&!this.wonState&&this.game.canUndo;}
  get viewState():StandardSessionViewState{return{seed:this.seed,partition:this.partition,difficulty:this.difficulty,moves:this.metrics.moves,activeMs:Math.floor(this.timer.elapsedMs),assisted:this.metrics.assisted,won:this.wonState};}
  perform(command:PlayerCommand):TransactionResult|null{if(this.settled||this.wonState)return null;const result=this.game.perform(command);if(!result)return null;this.metrics.recordSuccessfulPlayerDecision();this.wonState=result.won;if(this.wonState)this.timer.finish();this.queuePersist();return result;}
  settleInitialAutoMoves():TransactionResult{if(this.settled)return{operations:[],won:this.wonState};const result=this.game.settleInitialAutoMoves();this.wonState=result.won;if(this.wonState)this.timer.finish();this.queuePersist();return result;}
  undo():TransactionResult|null{if(!this.canUndo)return null;const result=this.game.undo();if(!result)return null;this.metrics.recordUndo();this.wonState=result.won;this.queuePersist();return result;}
  setVisible(visible:boolean):void{if(this.visible===visible)return;if(!visible){this.timer.pause();this.visible=false;this.queuePersist();return;}this.visible=true;this.syncTimerState();}
  setBlockingOverlayOpen(open:boolean):void{if(this.blockingOverlayOpen===open)return;if(open){this.timer.pause();this.blockingOverlayOpen=true;this.queuePersist();return;}this.blockingOverlayOpen=false;this.syncTimerState();}
  markAssisted():void{if(this.metrics.assisted)return;this.metrics.markAssisted();this.queuePersist();}
  async flushPersistence():Promise<void>{await this.persistenceQueue;}
  async settleWin():Promise<StandardWinSettlementResult>{
    if(this.settlement)return this.settlement;if(!this.wonState)throw new Error('Cannot settle Standard attempt before it is won.');this.timer.finish();this.syncMetricsTime();await this.flushPersistence();
    const result=settleStandardWin(this.metaSession.state,{seed:this.seed,partition:this.partition,difficulty:this.difficulty,moves:this.metrics.moves,activeMs:this.metrics.activeMs,assisted:this.metrics.assisted});
    const committed=await this.metaSession.replaceAndFlush(result.state);if(!committed)throw new Error('Standard settlement did not commit.');
    if(this.persistActiveAttempt){const saved=this.activeGames.load();if(saved?.mode==='standard'&&saved.seed===this.seed)this.activeGames.clear();}
    else if(this.preservedActiveGame){this.activeGames.save(this.preservedActiveGame);}
    this.settled=true;this.settlement={...result,state:this.metaSession.state};return this.settlement;
  }
  private syncTimerState():void{if(this.settled||this.wonState||!this.visible||this.blockingOverlayOpen)this.timer.pause();else this.timer.resume();}
  private syncMetricsTime():void{this.metrics.setActiveMs(Math.floor(this.timer.elapsedMs));}
  private captureActiveAttempt():TrifoldActiveGameSave{this.syncMetricsTime();return{version:1,mode:'standard',seed:this.seed,game:this.game.exportSave(),moves:this.metrics.moves,activeMs:this.metrics.activeMs,assisted:this.metrics.assisted,updatedAtMs:wallTimestamp(this.wallNow),standard:{partition:this.partition,difficulty:this.difficulty}};}
  private queuePersist():void{if(this.settled||!this.persistActiveAttempt)return;const snapshot=this.captureActiveAttempt();this.persistenceQueue=this.persistenceQueue.then(()=>{this.activeGames.save(snapshot);});}
}
