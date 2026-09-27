import { normalizeMetaSave, type AttemptRecord, type DailyRecord, type MasteryRank, type MetaSave } from './MetaSave.ts';

const RANK_ORDER: readonly MasteryRank[] = ['novice','player','tactician','expert','master','grandmaster'];
const MERGE_RECEIPT_PREFIX = 'profilemerge_';

function safeAdd(a:number,b:number):number{return Math.min(Number.MAX_SAFE_INTEGER,a+b);}
function uniqueTail<T>(values:readonly T[],limit:number):T[]{return [...new Set(values)].slice(-limit);}
function betterAttempt(a:AttemptRecord|undefined,b:AttemptRecord|undefined):AttemptRecord|undefined{
  if(!a)return b?{...b}:undefined;
  if(!b)return{...a};
  return b.moves<a.moves||(b.moves===a.moves&&b.activeMs<a.activeMs)?{...b}:{...a};
}
function mergePersonalBests(a:MetaSave['standard']['personalBests'],b:MetaSave['standard']['personalBests']):MetaSave['standard']['personalBests']{
  const result:Record<string,AttemptRecord>={};
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    const best=betterAttempt(a[key],b[key]);
    if(best)result[key]=best;
  }
  return result;
}
function hasRankingEvidence(record:DailyRecord):boolean{return record.rankingAttemptId!==undefined||record.officialResult!==undefined;}
function mergeDailyRecord(target:DailyRecord|undefined,source:DailyRecord|undefined):DailyRecord|undefined{
  if(!target)return source?{...source}:undefined;
  if(!source)return{...target};
  const ranking=hasRankingEvidence(target)?target:hasRankingEvidence(source)?source:undefined;
  const officialResult=ranking?.officialResult;
  const rankingAttemptId=ranking?.rankingAttemptId;
  const personalBest=betterAttempt(target.personalBest,source.personalBest);
  return{
    completed:target.completed||source.completed,
    completedOnTime:target.completedOnTime||source.completedOnTime,
    attempts:safeAdd(target.attempts,source.attempts),
    ...(officialResult?{officialResult:{...officialResult}}:{}),
    ...(personalBest?{personalBest}:{}),
    ...(rankingAttemptId?{rankingAttemptId}:{}),
    ...(target.hintUsed===true||source.hintUsed===true?{hintUsed:true}:{}),
  };
}
function mergeMastery(target:MetaSave['mastery'],source:MetaSave['mastery']):MetaSave['mastery']{
  const targetIndex=RANK_ORDER.indexOf(target.rank),sourceIndex=RANK_ORDER.indexOf(source.rank);
  if(targetIndex!==sourceIndex)return structuredClone(targetIndex>sourceIndex?target:source);
  return{rank:target.rank,stage:{
    anyWins:Math.max(target.stage.anyWins,source.stage.anyWins),
    mediumWins:Math.max(target.stage.mediumWins,source.stage.mediumWins),
    hardWins:Math.max(target.stage.hardWins,source.stage.hardWins),
    onTimeDailyWins:Math.max(target.stage.onTimeDailyWins,source.stage.onTimeDailyWins),
  }};
}
function mergeReceipts(target:Readonly<Record<string,number>>,source:Readonly<Record<string,number>>):Record<string,number>{
  const merged:Record<string,number>={...target};
  for(const[key,value]of Object.entries(source))merged[key]=Math.max(merged[key]??0,value);
  return merged;
}

export function profileMergeReceiptKey(scope:string):string{
  let hash=0xcbf29ce484222325n;const prime=0x100000001b3n,mask=0xffffffffffffffffn;
  for(let index=0;index<scope.length;index+=1){hash^=BigInt(scope.charCodeAt(index));hash=(hash*prime)&mask;}
  return `${MERGE_RECEIPT_PREFIX}${hash.toString(36)}`;
}
export function hasMergedMetaScope(state:MetaSave,scope:string):boolean{return(state.progression.receipts[profileMergeReceiptKey(scope)]??0)>=1;}

export function mergeMetaProfiles(targetRaw:MetaSave,sourceRaw:MetaSave,sourceScope:string):MetaSave{
  const target=normalizeMetaSave(targetRaw),source=normalizeMetaSave(sourceRaw);
  const receiptKey=profileMergeReceiptKey(sourceScope);
  if((target.progression.receipts[receiptKey]??0)>=1)return target;

  const records:Record<string,DailyRecord>={};
  for(const dailyId of new Set([...Object.keys(target.daily.records),...Object.keys(source.daily.records)])){
    const record=mergeDailyRecord(target.daily.records[dailyId],source.daily.records[dailyId]);
    if(record)records[dailyId]=record;
  }
  const receipts=mergeReceipts(target.progression.receipts,source.progression.receipts);receipts[receiptKey]=1;
  return normalizeMetaSave({
    ...target,
    daily:{algorithmVersion:target.daily.algorithmVersion,records,bestStreakFloor:Math.max(target.daily.bestStreakFloor,source.daily.bestStreakFloor)},
    standard:{
      selectedDifficulty:source.standard.selectedDifficulty,
      recentSeeds:uniqueTail([...target.standard.recentSeeds,...source.standard.recentSeeds],256),
      completed:{
        onboarding:[...new Set([...target.standard.completed.onboarding,...source.standard.completed.onboarding])],
        easy:[...new Set([...target.standard.completed.easy,...source.standard.completed.easy])],
        medium:[...new Set([...target.standard.completed.medium,...source.standard.completed.medium])],
        hard:[...new Set([...target.standard.completed.hard,...source.standard.completed.hard])],
      },
      masteryCreditedSeeds:[...new Set([...target.standard.masteryCreditedSeeds,...source.standard.masteryCreditedSeeds])],
      onboardingWins:Math.max(target.standard.onboardingWins,source.standard.onboardingWins),
      personalBests:mergePersonalBests(target.standard.personalBests,source.standard.personalBests),
    },
    standardWinStreak:{current:Math.max(target.standardWinStreak.current,source.standardWinStreak.current),best:Math.max(target.standardWinStreak.best,source.standardWinStreak.best)},
    progression:{
      startedAttempts:uniqueTail([...target.progression.startedAttempts,...source.progression.startedAttempts],128),
      completedAttempts:uniqueTail([...target.progression.completedAttempts,...source.progression.completedAttempts],128),
      receipts,
    },
    mastery:mergeMastery(target.mastery,source.mastery),
    futurePrestige:{
      mediumSeeds:[...new Set([...target.futurePrestige.mediumSeeds,...source.futurePrestige.mediumSeeds])],
      hardSeeds:[...new Set([...target.futurePrestige.hardSeeds,...source.futurePrestige.hardSeeds])],
      onTimeDailyDates:[...new Set([...target.futurePrestige.onTimeDailyDates,...source.futurePrestige.onTimeDailyDates])],
    },
  });
}
