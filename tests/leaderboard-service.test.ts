import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardService } from '../src/leaderboards/LeaderboardService.ts';
import { encodeDailyLeaderboardScore, encodeMasteryScore, encodeStreakScore } from '../src/leaderboards/LeaderboardConfig.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import type { PlatformServices } from '../src/platform/services.ts';

function platform(options:{available?:boolean;authorized?:boolean;entries?:PlatformServices['leaderboards']['getEntries'];player?:PlatformServices['leaderboards']['getPlayerEntry'];write?:PlatformServices['leaderboards']['setScore']}={}):PlatformServices{
 return {playerStorage:{load:async()=>({}),save:async()=>undefined},trustedClock:{nowMs:()=>null},auth:{isAuthorized:()=>options.authorized??true,requestAuthorization:async()=>options.authorized??true,onAccountSelectionClosed:()=>()=>undefined},leaderboards:{available:options.available??true,getEntries:options.entries??(async()=>[]),getPlayerEntry:options.player??(async()=>null),setScore:options.write??(async()=>undefined)},ads:{available:false,showInterstitial:async()=>false},platformPause:{isPaused:()=>false,subscribe:()=>()=>undefined},gameplay:{start:()=>undefined,stop:()=>undefined},ready:()=>undefined};
}

test('unavailable and unauthorised load paths are non-fatal', async()=>{
 assert.deepEqual(await new LeaderboardService(platform({available:false})).load('streak'),{status:'unavailable',authorized:true,entries:[],playerEntry:null});
 const service=new LeaderboardService(platform({authorized:false,entries:async()=>[{rank:1,score:encodeStreakScore(8,12),playerId:'a',publicName:'Ada'}]}));
 const result=await service.load('streak'); assert.equal(result.status,'ready'); if(result.status!=='ready')return;
 assert.equal(result.authorized,false); assert.equal(result.playerEntry,null); assert.deepEqual(result.entries[0]?.metric,{kind:'streak',current:8,best:12});
});

test('Daily load requires day and filters encoded rows for other dates', async()=>{
 const today='2026-09-16';
 const service=new LeaderboardService(platform({entries:async()=>[
  {rank:1,score:encodeDailyLeaderboardScore(today,40,80000),playerId:'a',publicName:'Ada'},
  {rank:2,score:encodeDailyLeaderboardScore('2026-09-15',20,60000),playerId:'b',publicName:'Old'},
 ]}));
 assert.equal((await service.load('daily')).status,'error');
 const result=await service.load('daily',today); assert.equal(result.status,'ready'); if(result.status!=='ready')return;
 assert.equal(result.entries.length,1); assert.deepEqual(result.entries[0]?.metric,{kind:'daily',moves:40,elapsedMs:80000});
});

test('authorized Mastery row normalizes and malformed rows are ignored', async()=>{
 const base=createDefaultMetaSave(); const meta={...base,mastery:{rank:'expert' as const,stage:base.mastery.stage}}; const score=encodeMasteryScore(meta);
 const service=new LeaderboardService(platform({entries:async()=>[{rank:0,score,playerId:'bad',publicName:'Bad'},{rank:1,score,playerId:'a',publicName:'Ada'}],player:async()=>({rank:7,score,playerId:'me',publicName:'Me'})}));
 const result=await service.load('mastery'); assert.equal(result.status,'ready'); if(result.status!=='ready')return;
 assert.equal(result.entries.length,1); assert.equal(result.playerEntry?.rank,7);
});

test('sync methods coalesce policy and fail soft', async()=>{
 const writes:Array<[string,number]>=[]; let server:null|{rank:number;score:number;playerId:string;publicName:string}=null;
 const service=new LeaderboardService(platform({player:async()=>server,write:async(name,score)=>{writes.push([name,score]); server={rank:1,score,playerId:'me',publicName:'Me'};}}));
 assert.equal(await service.syncDailyBest('2026-09-16',40,80000),'submitted');
 assert.equal(await service.syncDailyBest('2026-09-16',40,80000),'unchanged');
 assert.equal(await service.syncDailyStreak(0,15),'submitted');
 assert.equal(await service.syncMasteryScore(2_000_000_005),'submitted');
 assert.equal(writes.length,3);
 const failing=new LeaderboardService(platform({write:async()=>{throw new Error('offline')}}));
 assert.equal(await failing.syncMasteryScore(3),'skipped');
});
