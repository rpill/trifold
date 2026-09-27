import { encodeMasteryScore } from '../../../leaderboards/LeaderboardConfig.ts'; import { createDefaultMetaSave } from '../../../meta/MetaSave.ts'; import type { VisualQaFixtureFactory } from './types.ts'; import { baseFixture, leaderboardEntry, withMastery } from './helpers.ts';
const score=encodeMasteryScore(withMastery(createDefaultMetaSave(),'expert',30));
export const leaderboardFixtures:Readonly<Record<string,VisualQaFixtureFactory>>={
  'leaderboard-loading':()=>({...baseFixture('leaderboard-loading','LeaderboardsScene'),sceneData:{mode:'mastery',visualQaStatus:'loading'}}),
  'leaderboard-own':()=>{const f=baseFixture('leaderboard-own','LeaderboardsScene');return{...f,platform:{...f.platform,authorized:true,leaderboardEntries:[leaderboardEntry(1,score+2,'Rin'),leaderboardEntry(2,score+1,'Mika'),leaderboardEntry(3,score,'You','self')],playerLeaderboardEntry:leaderboardEntry(3,score,'You','self')},sceneData:{mode:'mastery'}};},
  'leaderboard-empty':()=>({...baseFixture('leaderboard-empty','LeaderboardsScene'),sceneData:{mode:'mastery'}}),
  'leaderboard-unavailable':()=>{const f=baseFixture('leaderboard-unavailable','LeaderboardsScene');return{...f,platform:{...f.platform,leaderboardAvailable:false},sceneData:{mode:'mastery'}};},
};
