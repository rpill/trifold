import type { VisualQaFixtureFactory } from './types.ts'; import { baseFixture, withMastery } from './helpers.ts';
export const masteryFixtures:Readonly<Record<string,VisualQaFixtureFactory>>={
  'mastery-novice':()=>baseFixture('mastery-novice','MasteryScene'),
  'mastery-mid':()=>{const f=baseFixture('mastery-mid','MasteryScene');return{...f,meta:withMastery(f.meta,'tactician',18)};},
  'mastery-master':()=>{const f=baseFixture('mastery-master','MasteryScene');return{...f,meta:withMastery(f.meta,'grandmaster',80)};},
  'mastery-rank-up':()=>{const f=baseFixture('mastery-rank-up','MasteryScene');return{...f,meta:withMastery(f.meta,'expert',30),sceneData:{visualQaRankUp:'master'}};},
};
