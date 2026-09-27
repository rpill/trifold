import type { MetaSave, StandardDifficulty } from '../../meta/MetaSave.ts';
import type { TrifoldActiveGameSave } from '../../persistence/ActiveGameSave.ts';
import type { Language } from '../../settings/Preferences.ts';
import type { GlobalLeaderboardMode } from '../../leaderboards/LeaderboardConfig.ts';
import { encodeMasteryScore } from '../../leaderboards/LeaderboardConfig.ts';
import type { LeaderboardLoadResult, LeaderboardService } from '../../leaderboards/LeaderboardService.ts';
import { deriveBestStreak, deriveCurrentStreak } from '../../meta/daily/DailyHistory.ts';

export interface TrifoldProductSnapshot {
  readonly state: MetaSave;
  readonly activeMode: 'standard' | 'daily' | null;
  readonly activeDifficulty: StandardDifficulty | null;
  readonly currentDailyId: string | null;
  readonly activeDailyId: string | null;
  readonly leaderboardsEnabled: boolean;
}
export interface TrifoldLeaderboardSnapshot { readonly available:boolean; readonly authorized:boolean; readonly authorizationAllowed:boolean; readonly authPending:boolean }
export interface TrifoldSettingsSnapshot { readonly soundEnabled:boolean; readonly language:Language }

export interface TrifoldProductHandlers {
  readonly snapshot:()=>TrifoldProductSnapshot;
  readonly resumeGame:()=>void;
  readonly startStandard:(difficulty:StandardDifficulty)=>Promise<void>;
  readonly setStandardDifficulty:(difficulty:StandardDifficulty)=>Promise<void>;
  readonly startDaily:(dailyId?:string)=>void;
  readonly leaderboardSnapshot:()=>TrifoldLeaderboardSnapshot;
  readonly loadLeaderboard:(mode:GlobalLeaderboardMode,dailyId?:string)=>Promise<LeaderboardLoadResult>;
  readonly authorizeLeaderboard:()=>Promise<boolean>;
  readonly settingsSnapshot:()=>TrifoldSettingsSnapshot;
  readonly setSoundEnabled:(enabled:boolean)=>void;
  readonly setLanguage:(language:Language)=>void;
  readonly closeHowToPlay:(onboarding:boolean)=>void;
}

type Subscriber=()=>void;
let handlers:TrifoldProductHandlers|null=null;
const subscribers=new Set<Subscriber>();
function requireHandlers():TrifoldProductHandlers{if(!handlers)throw new Error('Trifold product bridge is not installed.');return handlers;}

export const productBridge={
  install(next:TrifoldProductHandlers):void{handlers=next;this.notify();},
  uninstall(next?:TrifoldProductHandlers):void{if(!next||handlers===next)handlers=null;},
  snapshot():TrifoldProductSnapshot{return requireHandlers().snapshot();},
  resumeGame():void{requireHandlers().resumeGame();},
  startStandard(difficulty:StandardDifficulty):Promise<void>{return requireHandlers().startStandard(difficulty);},
  setStandardDifficulty(difficulty:StandardDifficulty):Promise<void>{return requireHandlers().setStandardDifficulty(difficulty);},
  startDaily(dailyId?:string):void{requireHandlers().startDaily(dailyId);},
  leaderboardSnapshot():TrifoldLeaderboardSnapshot{return requireHandlers().leaderboardSnapshot();},
  loadLeaderboard(mode:GlobalLeaderboardMode,dailyId?:string):Promise<LeaderboardLoadResult>{return requireHandlers().loadLeaderboard(mode,dailyId);},
  authorizeLeaderboard():Promise<boolean>{return requireHandlers().authorizeLeaderboard();},
  settingsSnapshot():TrifoldSettingsSnapshot{return requireHandlers().settingsSnapshot();},
  setSoundEnabled(enabled:boolean):void{requireHandlers().setSoundEnabled(enabled);this.notify();},
  setLanguage(language:Language):void{requireHandlers().setLanguage(language);this.notify();},
  closeHowToPlay(onboarding:boolean):void{requireHandlers().closeHowToPlay(onboarding);},
  subscribe(listener:Subscriber):()=>void{subscribers.add(listener);return()=>subscribers.delete(listener);},
  notify():void{for(const listener of [...subscribers])listener();},
};

export interface TrifoldProductHandlerDependencies {
  readonly getState:()=>MetaSave;
  readonly replaceState:(state:MetaSave)=>Promise<boolean>;
  readonly getActiveGame:()=>TrifoldActiveGameSave|null;
  readonly getCurrentDailyId?:()=>string|null;
  readonly leaderboards:Pick<LeaderboardService,'available'|'authorized'|'load'>;
  readonly authorizeProductAccount:()=>Promise<boolean>;
  readonly syncLeaderboardsAfterAuthorization?:()=>Promise<void>;
  readonly settings:{ readonly snapshot:()=>TrifoldSettingsSnapshot; readonly setSoundEnabled:(enabled:boolean)=>void; readonly setLanguage:(language:Language)=>void };
  readonly resumeGame:()=>void;
  readonly launchStandard:(difficulty:StandardDifficulty)=>void;
  readonly launchDaily:(dailyId?:string)=>void;
  readonly closeHowToPlay:(onboarding:boolean)=>void;
}

export function createTrifoldProductHandlers(deps:TrifoldProductHandlerDependencies):TrifoldProductHandlers {
  return {
    snapshot:()=>{
      const active=deps.getActiveGame();
      return {
        state:deps.getState(),
        activeMode:active?.mode??null,
        activeDifficulty:active?.mode==='standard'?active.standard?.difficulty??null:null,
        currentDailyId:deps.getCurrentDailyId?.()??null,
        activeDailyId:active?.mode==='daily'?active.daily?.dateKey??null:null,
        leaderboardsEnabled:deps.leaderboards.available,
      };
    },
    resumeGame:deps.resumeGame,
    startStandard:async(difficulty)=>{deps.launchStandard(difficulty);},
    setStandardDifficulty:async(difficulty)=>{
      const state=deps.getState();
      if(state.standard.selectedDifficulty===difficulty)return;
      await deps.replaceState({...state,standard:{...state.standard,selectedDifficulty:difficulty}});
      productBridge.notify();
    },
    startDaily:deps.launchDaily,
    leaderboardSnapshot:()=>({available:deps.leaderboards.available,authorized:deps.leaderboards.authorized,authorizationAllowed:deps.leaderboards.available&&!deps.leaderboards.authorized,authPending:false}),
    loadLeaderboard:(mode,dailyId)=>deps.leaderboards.load(mode,dailyId),
    authorizeLeaderboard:async()=>{
      const authorized=await deps.authorizeProductAccount();
      if(!authorized)return false;
      await deps.syncLeaderboardsAfterAuthorization?.();
      return true;
    },
    settingsSnapshot:deps.settings.snapshot,
    setSoundEnabled:deps.settings.setSoundEnabled,
    setLanguage:deps.settings.setLanguage,
    closeHowToPlay:deps.closeHowToPlay,
  };
}

type ProductLeaderboardSync = Pick<LeaderboardService,'syncDailyBest'|'syncDailyStreak'|'syncMasteryScore'>;
export async function syncProductLeaderboards(
  leaderboards:ProductLeaderboardSync,
  state:MetaSave,
  mode:'standard'|'daily',
  dailyId:string|null,
  todayKey:string,
):Promise<void>{
  const tasks:Promise<unknown>[]=[];
  if(mode==='daily'&&dailyId){
    const record=state.daily.records[dailyId];
    if(record?.officialResult)tasks.push(leaderboards.syncDailyBest(dailyId,record.officialResult.moves,record.officialResult.activeMs));
    tasks.push(leaderboards.syncDailyStreak(deriveCurrentStreak(state.daily.records,todayKey),deriveBestStreak(state.daily.records,state.daily.bestStreakFloor)));
  }
  tasks.push(leaderboards.syncMasteryScore(encodeMasteryScore(state)));
  await Promise.all(tasks);
}
