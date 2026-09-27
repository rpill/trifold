import test from 'node:test';
import assert from 'node:assert/strict';
import { LeaderboardSubmissionQueue } from '../src/leaderboards/LeaderboardSubmissionQueue.ts';

test('submission queue serializes writes at least 1100 ms apart', async () => {
  let now = 0;
  const calls: Array<{ name:string; score:number; at:number }> = [];
  const waits:number[]=[];
  const queue = new LeaderboardSubmissionQueue(
    async (name,score)=>{ calls.push({name,score,at:now}); },
    async (ms)=>{ waits.push(ms); now += ms; },
    ()=>now,
  );
  await Promise.all([queue.enqueue('trifolddaily', 10), queue.enqueue('trifoldmastery', 20)]);
  assert.equal(calls.length,2);
  assert.ok(calls[1]!.at-calls[0]!.at>=1100);
  assert.deepEqual(waits,[1100]);
  assert.equal(queue.pendingCount,0);
});

test('pending max writes coalesce to largest score while latest preserves downward streak', async () => {
  const calls:Array<{name:string;score:number}>=[];
  const queue = new LeaderboardSubmissionQueue(async(name,score)=>{calls.push({name,score});}, async()=>undefined, ()=>0, 0);
  await Promise.all([queue.enqueue('trifoldmastery',7),queue.enqueue('trifoldmastery',9),queue.enqueue('trifoldmastery',8)]);
  await Promise.all([queue.enqueue('trifoldstreak',900015,'latest'),queue.enqueue('trifoldstreak',15,'latest')]);
  assert.deepEqual(calls,[{name:'trifoldmastery',score:9},{name:'trifoldstreak',score:15}]);
});

test('failed coalesced board rejects waiters and later boards still drain', async () => {
  let now=0; const calls:string[]=[];
  const queue=new LeaderboardSubmissionQueue(async(name)=>{calls.push(name); if(name==='trifolddaily') throw new Error('fail');},async(ms)=>{now+=ms;},()=>now);
  const results=await Promise.allSettled([queue.enqueue('trifolddaily',7),queue.enqueue('trifolddaily',9),queue.enqueue('trifoldmastery',5)]);
  assert.deepEqual(results.map(r=>r.status),['rejected','rejected','fulfilled']);
  assert.deepEqual(calls,['trifolddaily','trifoldmastery']);
});

test('queue rejects invalid scores without scheduling submit', async()=>{
  let calls=0; const queue=new LeaderboardSubmissionQueue(async()=>{calls+=1;});
  await assert.rejects(queue.enqueue('x',Number.NaN));
  await assert.rejects(queue.enqueue('x',0));
  assert.equal(calls,0);
});
