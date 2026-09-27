import { recordMasteryEligibleStandardWin } from '../mastery/Mastery.ts';
import type { AttemptRecord, MasteryRank, MasteryStageProgress, MetaSave, StandardDifficulty, StandardPartition } from '../MetaSave.ts';

export interface StandardWinResultInput {
  readonly seed: number;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
}
export interface StandardWinMasterySnapshot { readonly rank: MasteryRank; readonly stage: MasteryStageProgress }
export interface StandardWinSettlementResult {
  readonly state: MetaSave;
  readonly rankAdvancedTo: MasteryRank | null;
  readonly masteryAdvanced: boolean;
  readonly recordAccepted: boolean;
  readonly firstCompletion: boolean;
  readonly masteryBefore: StandardWinMasterySnapshot;
  readonly masteryAfter: StandardWinMasterySnapshot;
  readonly masteryWasAlreadyCredited: boolean;
}

function nonNegativeInteger(value:number,label:string):number {
  if(!Number.isSafeInteger(value)||value<0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}
function better(candidate:AttemptRecord,current:AttemptRecord|undefined):boolean {
  return !current || candidate.moves<current.moves || (candidate.moves===current.moves&&candidate.activeMs<current.activeMs);
}

export function settleStandardWin(state:MetaSave,input:StandardWinResultInput):StandardWinSettlementResult {
  if(!Number.isSafeInteger(input.seed)||input.seed<1) throw new Error('Standard seed must be a positive integer.');
  nonNegativeInteger(input.moves,'moves'); nonNegativeInteger(input.activeMs,'activeMs');
  if(input.partition==='onboarding'&&input.difficulty!=='easy') throw new Error('Onboarding wins must use easy gameplay difficulty.');
  if(input.partition!=='onboarding'&&input.partition!==input.difficulty) throw new Error('Standard partition and gameplay difficulty must match.');

  const completed=state.standard.completed[input.partition];
  const firstCompletion=!completed.includes(input.seed);
  const masteryBefore=state.mastery;
  const masteryWasAlreadyCredited=state.standard.masteryCreditedSeeds.includes(input.seed);
  let next=state;
  if(firstCompletion){
    next={
      ...next,
      standard:{
        ...next.standard,
        completed:{...next.standard.completed,[input.partition]:[...completed,input.seed]},
        onboardingWins:Math.min(5,next.standard.onboardingWins+1),
      },
    };
  }

  let recordAccepted=false;
  if(!input.assisted){
    const key=`${input.partition}:${input.seed}`;
    const candidate:AttemptRecord={moves:input.moves,activeMs:input.activeMs};
    if(better(candidate,next.standard.personalBests[key])){
      next={...next,standard:{...next.standard,personalBests:{...next.standard.personalBests,[key]:candidate}}};
      recordAccepted=true;
    }
  }

  let masteryAdvanced=false; let rankAdvancedTo:MasteryRank|null=null;
  if(!input.assisted&&!next.standard.masteryCreditedSeeds.includes(input.seed)){
    const result=recordMasteryEligibleStandardWin(next,{seed:input.seed,difficulty:input.difficulty});
    next=result.state; masteryAdvanced=result.masteryAdvanced; rankAdvancedTo=result.rankAdvancedTo;
  }

  return {state:next,rankAdvancedTo,masteryAdvanced,recordAccepted,firstCompletion,masteryBefore,masteryAfter:next.mastery,masteryWasAlreadyCredited};
}
