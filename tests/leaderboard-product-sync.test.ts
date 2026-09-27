import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { syncProductLeaderboards } from '../src/ui/bridge/TrifoldProductBridge.ts';

class FakeBoards {
  daily:any[]=[];streak:any[]=[];mastery:any[]=[];
  async syncDailyBest(...args:any[]){this.daily.push(args);return'submitted' as const;}
  async syncDailyStreak(...args:any[]){this.streak.push(args);return'submitted' as const;}
  async syncMasteryScore(...args:any[]){this.mastery.push(args);return'submitted' as const;}
}

test('Daily product sync submits immutable official result, derived streak and Mastery score',async()=>{
  const base=createDefaultMetaSave();
  const state={...base,daily:{...base.daily,records:{'2026-09-13':{completed:true,completedOnTime:true,attempts:1},'2026-09-14':{completed:true,completedOnTime:true,attempts:1,officialResult:{moves:42,activeMs:300000},personalBest:{moves:39,activeMs:250000}}}},futurePrestige:{...base.futurePrestige,onTimeDailyDates:['2026-09-13','2026-09-14']}};
  const boards=new FakeBoards();await syncProductLeaderboards(boards as never,state,'daily','2026-09-14','2026-09-14');
  assert.deepEqual(boards.daily,[["2026-09-14",42,300000]]);assert.deepEqual(boards.streak,[[2,2]]);assert.equal(boards.mastery.length,1);
});

test('Standard product sync updates Mastery only and never fabricates Daily submission',async()=>{
  const boards=new FakeBoards();await syncProductLeaderboards(boards as never,createDefaultMetaSave(),'standard',null,'2026-09-14');
  assert.equal(boards.daily.length,0);assert.equal(boards.streak.length,0);assert.equal(boards.mastery.length,1);
});
