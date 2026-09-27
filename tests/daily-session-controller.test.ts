import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import { canDropInFreeCell, canDropOnTableau, canMoveToFoundation } from '../src/game/model/TrifoldRules.ts';
import type { CardSource, PlayerCommand, ReadonlyTrifoldState, TrifoldSnapshot } from '../src/game/model/types.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';
import { MetaSession } from '../src/meta/MetaSession.ts';
import { DailySessionController } from '../src/meta/daily/DailySessionController.ts';
import { ActiveGameRepository, type ActiveGameStorageLike } from '../src/persistence/ActiveGameRepository.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

class MemoryPlayerStorage implements PlayerStorage {
  root: Record<string, unknown> = { trifoldMeta: createDefaultMetaSave() };
  async load(): Promise<unknown> { return structuredClone(this.root); }
  async save(data: Record<string, unknown>): Promise<void> { this.root = { ...this.root, ...structuredClone(data) }; }
}
class MemoryKv implements ActiveGameStorageLike, MetaJournalStorage {
  map = new Map<string,string>();
  getItem(key:string): string|null { return this.map.get(key) ?? null; }
  setItem(key:string,value:string):void { this.map.set(key,value); }
  removeItem(key:string):void { this.map.delete(key); }
}
async function productState(): Promise<{ metaSession: MetaSession; activeGames: ActiveGameRepository }> {
  const player = new MemoryPlayerStorage();
  const metaSession = new MetaSession(player, new MetaJournal('daily-test', new MemoryKv()));
  assert.equal(await metaSession.load(), true);
  return { metaSession, activeGames: new ActiveGameRepository(new MemoryKv()) };
}
function catalog(): VerifiedDealCatalog {
  const seeds = [11,21,31,41,1,2,3];
  const buffer = new ArrayBuffer(seeds.length*4); const view = new DataView(buffer);
  seeds.forEach((seed,index)=>view.setUint32(index*4,seed,true));
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion:2,rulesVersion:1,shuffleVersion:1,seedEncoding:'uint32-le',difficultyModelVersion:1,dailyAlgorithmVersion:1,
    standardCounts:{onboarding:1,easy:1,medium:1,hard:1},dailyScheduleStart:'2026-09-12',dailyScheduleLength:3,verifiedCount:7,
    crossPoolDuplicateCount:0,rejectedVerificationCount:0,fastNodeBudget:100,slowNodeBudget:1000,sourceScanRanges:[],solverSourceHash:'solver',gameRulesSourceHash:'rules',productionAssetHash:'hash',
    offsets:{onboarding:{byteOffset:0,count:1},easy:{byteOffset:4,count:1},medium:{byteOffset:8,count:1},hard:{byteOffset:12,count:1},daily:{byteOffset:16,count:3}},
  });
}
function sources(state:ReadonlyTrifoldState):CardSource[]{ const out:CardSource[]=[]; state.tableau.forEach((col,column)=>{ for(let index=0;index<col.length;index++) out.push({zone:'tableau',column,index}); }); return out; }
function firstLegalMove(state:ReadonlyTrifoldState):PlayerCommand {
  for(const source of sources(state)){
    for(let column=0;column<state.tableau.length;column++) if(canDropOnTableau(state,source,column)) return {type:'move',source,target:{zone:'tableau',column}};
    for(let cell=0;cell<state.freeCells.length;cell++) if(canDropInFreeCell(state,source,cell)) return {type:'move',source,target:{zone:'free-cell',cell}};
    for(const suit of ['coins','bamboo','characters'] as const) if(canMoveToFoundation(state,source,suit)) return {type:'move',source,target:{zone:'foundation',suit}};
  }
  throw new Error('Fixture has no legal move.');
}
function wonSnapshot(seed:number):TrifoldSnapshot { return { seed,tableau:[[],[],[],[],[],[],[],[]],freeCells:[
  {kind:'dragons',family:'red',cardIds:['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4']},
  {kind:'dragons',family:'green',cardIds:['dragon-green-1','dragon-green-2','dragon-green-3','dragon-green-4']},
  {kind:'dragons',family:'white',cardIds:['dragon-white-1','dragon-white-2','dragon-white-3','dragon-white-4']},
],foundations:{coins:Array.from({length:9},(_,i)=>`coins-${i+1}`),bamboo:Array.from({length:9},(_,i)=>`bamboo-${i+1}`),characters:Array.from({length:9},(_,i)=>`characters-${i+1}`)},flowerFoundation:'flower'}; }

test('trusted clock selects today and starts first ranked attempt while active game stays outside MetaSave', async () => {
  const {metaSession,activeGames}=await productState();
  const trustedMs = new Date(2026,8,14,12).getTime();
  const session=await DailySessionController.startToday({ metaSession,activeGames,catalog:catalog(),trustedClock:{nowMs:()=>trustedMs},localNowMs:()=>0,timerNow:()=>0,wallNow:()=>1 });
  assert.equal(session.viewState.dailyDateKey,'2026-09-14');
  assert.equal(session.viewState.seed,3);
  assert.equal(metaSession.state.daily.records['2026-09-14']?.attempts,1);
  assert.equal(metaSession.state.daily.records['2026-09-14']?.rankingAttemptId,'daily-2026-09-14~1');
  assert.equal(activeGames.load()?.daily?.dateKey,'2026-09-14');
  assert.equal('active' in metaSession.state.daily,false);
});

test('local wall clock is used only when trusted clock is unavailable', async () => {
  const {metaSession,activeGames}=await productState();
  const localMs = new Date(2026,8,13,12).getTime();
  const session=await DailySessionController.startToday({ metaSession,activeGames,catalog:catalog(),trustedClock:{nowMs:()=>null},localNowMs:()=>localMs,timerNow:()=>0,wallNow:()=>1 });
  assert.equal(session.viewState.dailyDateKey,'2026-09-13');
  assert.equal(session.viewState.seed,2);
});

test('successful decisions count once, undo does not decrement, and active save resumes', async () => {
  let now=0; const state=await productState();
  const session=await DailySessionController.startToday({ ...state,catalog:catalog(),todayKey:'2026-09-14',timerNow:()=>now,wallNow:()=>now,calendarDateKeyNow:()=> '2026-09-14' });
  assert.ok(session.perform(firstLegalMove(session.state)));
  assert.equal(session.viewState.moves,1); session.undo(); assert.equal(session.viewState.moves,1);
  now=500; session.setVisible(false); await session.flushPersistence();
  const resumed=DailySessionController.resume({ ...state,catalog:catalog(),todayKey:'2026-09-14',timerNow:()=>10_000,wallNow:()=>10_000,calendarDateKeyNow:()=> '2026-09-14' });
  assert.equal(resumed.viewState.moves,1); assert.equal(resumed.viewState.activeMs,500);
});

test('date rollover expires today but preserves it as archive-resumable active save', async () => {
  let dateKey='2026-09-14'; const state=await productState();
  const session=await DailySessionController.startToday({ ...state,catalog:catalog(),todayKey:dateKey,calendarDateKeyNow:()=>dateKey });
  dateKey='2026-09-15';
  assert.deepEqual(session.handleDateChange(),{status:'expired-today',dailyDateKey:'2026-09-14'});
  await session.flushPersistence();
  assert.equal(state.activeGames.load()?.daily?.dateKey,'2026-09-14');
});

test('resumeOrClearExpired rejects and clears a Daily outside the 90-day archive', async () => {
  const state=await productState(); const seed=1;
  state.activeGames.save({version:1,mode:'daily',seed,game:{version:1,seed,snapshot:wonSnapshot(seed),history:{version:1,entries:[]}},moves:1,activeMs:1,assisted:false,updatedAtMs:1,daily:{dateKey:'2026-01-01',kind:'archive'}});
  await assert.rejects(()=>DailySessionController.resumeOrClearExpired({ ...state,catalog:catalog(),todayKey:'2026-09-14',calendarDateKeyNow:()=> '2026-09-14' }),/archive/i);
  assert.equal(state.activeGames.load(),null);
});

test('won Daily settles once in MetaSave and clears only the matching active game', async () => {
  const state=await productState(); const seed=3;
  state.activeGames.save({version:1,mode:'daily',seed,game:{version:1,seed,snapshot:wonSnapshot(seed),history:{version:1,entries:[]}},moves:42,activeMs:1234,assisted:true,updatedAtMs:5000,daily:{dateKey:'2026-09-14',kind:'today'}});
  const session=DailySessionController.resume({ ...state,catalog:catalog(),todayKey:'2026-09-14',calendarDateKeyNow:()=> '2026-09-14',timerNow:()=>9999,wallNow:()=>9999 });
  assert.equal(session.viewState.won,true);
  const settlement=await session.settleWin();
  assert.equal(settlement.state.daily.records['2026-09-14']?.completed,true);
  assert.equal(settlement.state.daily.records['2026-09-14']?.hintUsed,true);
  assert.equal(state.activeGames.load(),null);
  const again=await session.settleWin(); assert.deepEqual(again,settlement);
});
