import type { VisualQaFixtureFactory } from './types.ts'; import { baseFixture, withDaily } from './helpers.ts';
export const dailyFixtures:Readonly<Record<string,VisualQaFixtureFactory>>={
  'daily-unsolved':()=>baseFixture('daily-unsolved','DailyScene'),
  'daily-solved':()=>{const f=baseFixture('daily-solved','DailyScene');return{...f,meta:withDaily(f.meta,'solved')};},
  'daily-replay':()=>{const f=baseFixture('daily-replay','DailyScene');return{...f,meta:withDaily(f.meta,'replay')};},
  'daily-archive':()=>{const f=baseFixture('daily-archive','DailyScene');return{...f,meta:withDaily(f.meta,'archive'),sceneData:{month:'2026-09'}};},
};
