import { AnalyticsService } from '../../../analytics/AnalyticsService.ts';
import { StandardAdController } from '../../../ads/StandardAdController.ts';
import { createDeck } from '../../../game/model/cards.ts';
import { createDeal } from '../../../game/model/deal.ts';
import { TrifoldGame, parseTrifoldGameSave, type TrifoldGameSaveV1 } from '../../../game/model/TrifoldGame.ts';
import { VerifiedDealCatalog } from '../../../game/model/VerifiedDealCatalog.ts';
import type { CardId, DragonFamily, FreeCellState, NumericSuit, TrifoldSnapshot } from '../../../game/model/types.ts';
import { LeaderboardService } from '../../../leaderboards/LeaderboardService.ts';
import { createDefaultMetaSave, type MetaSave, type MasteryRank } from '../../../meta/MetaSave.ts';
import { MetaJournal } from '../../../meta/MetaJournal.ts';
import { MetaSession } from '../../../meta/MetaSession.ts';
import { ActiveGameRepository, type ActiveGameStorageLike } from '../../../persistence/ActiveGameRepository.ts';
import type { TrifoldActiveGameSave } from '../../../persistence/ActiveGameSave.ts';
import type { PlatformLeaderboardEntry, PlatformServices, PlayerStorage } from '../../../platform/services.ts';
import { Preferences, PREFERENCES_KEY, type PreferenceStorage } from '../../../settings/Preferences.ts';
import type { RuntimeServices } from '../../../meta/RuntimeServices.ts';
import type { VisualQaFixture } from './types.ts';

const FIXTURE_DAY = '2026-09-27';
const FIXTURE_NOW = Date.parse(`${FIXTURE_DAY}T12:00:00Z`);

export function baseFixture(id: string, scene: string): VisualQaFixture {
  return {
    id,
    scene,
    meta: createDefaultMetaSave(),
    activeGame: null,
    preferences: { language: 'ru', soundEnabled: true, howToPlaySeen: true },
    platform: {
      nowMs: FIXTURE_NOW,
      authorized: false,
      leaderboardAvailable: true,
      leaderboardEntries: [],
      playerLeaderboardEntry: null,
    },
  };
}

function emptyHistory(): TrifoldGameSaveV1['history'] { return { version: 1, entries: [] }; }
function allCardIds(): CardId[] { return createDeck().map(({ id }) => id); }
function distribute(ids: readonly CardId[], lengths: readonly number[]): CardId[][] {
  const out: CardId[][] = [];
  let offset = 0;
  for (const length of lengths) { out.push(ids.slice(offset, offset + length)); offset += length; }
  if (offset !== ids.length || out.length !== 8) throw new Error('Visual QA tableau partition must contain all 40 cards in 8 columns.');
  return out;
}

function customSave(seed: number, snapshot: Omit<TrifoldSnapshot, 'seed'>): TrifoldGameSaveV1 {
  return parseTrifoldGameSave({ version: 1, seed, snapshot: { seed, ...snapshot }, history: emptyHistory() });
}

function neutralSnapshot(tableau: CardId[][]): Omit<TrifoldSnapshot, 'seed'> {
  return {
    tableau,
    freeCells: [{ kind: 'empty' }, { kind: 'empty' }, { kind: 'empty' }],
    foundations: { coins: [], bamboo: [], characters: [] },
    flowerFoundation: null,
  };
}

export type GamePose = 'short-columns'|'long-columns'|'free-cells-full'|'dragons-red-ready'|'dragons-green-ready'|'dragons-white-ready'|'auto-collect'|'hint'|'win';

export function gameSaveForPose(pose: GamePose, seed = 7101): TrifoldGameSaveV1 {
  if (pose === 'hint') return new TrifoldGame(createDeal(seed)).exportSave();
  const ids = allCardIds();
  if (pose === 'win') {
    const foundations = Object.fromEntries((['coins','bamboo','characters'] as const).map((suit) => [
      suit, Array.from({ length: 9 }, (_, index) => `${suit}-${index + 1}`),
    ])) as Record<NumericSuit, CardId[]>;
    const freeCells: FreeCellState[] = (['red','green','white'] as const).map((family) => ({
      kind: 'dragons', family, cardIds: Array.from({ length: 4 }, (_, index) => `dragon-${family}-${index + 1}`),
    }));
    return customSave(seed, { tableau: Array.from({ length: 8 }, () => []), freeCells, foundations, flowerFoundation: 'flower' });
  }
  if (pose === 'free-cells-full') {
    const held = ['coins-9','bamboo-9','characters-9'];
    const rest = ids.filter((id) => !held.includes(id));
    return customSave(seed, {
      ...neutralSnapshot(distribute(rest, [5,5,5,5,5,4,4,4])),
      freeCells: held.map((cardId) => ({ kind: 'card', cardId })),
    });
  }
  const family = pose.startsWith('dragons-') ? pose.split('-')[1] as DragonFamily : pose === 'auto-collect' ? 'red' : null;
  if (family) {
    const dragonIds = Array.from({ length: 4 }, (_, index) => `dragon-${family}-${index + 1}`);
    const rest = ids.filter((id) => !dragonIds.includes(id));
    const columns = distribute(rest, [5,5,5,5,4,4,4,4]);
    for (let index = 0; index < 4; index += 1) columns[index].push(dragonIds[index]);
    return customSave(seed, neutralSnapshot(columns));
  }
  const lengths = pose === 'long-columns' ? [12,8,5,4,4,3,2,2] : [2,3,4,5,6,6,7,7];
  return customSave(seed, neutralSnapshot(distribute(ids, lengths)));
}

export function activeStandardForPose(pose: GamePose, seed = 7101): TrifoldActiveGameSave {
  return {
    version: 1,
    mode: 'standard',
    seed,
    game: gameSaveForPose(pose, seed),
    moves: pose === 'win' ? 41 : 12,
    activeMs: pose === 'win' ? 93_000 : 31_000,
    assisted: pose === 'hint',
    attemptId: `visualqa_${pose.replaceAll('-', '_')}`,
    updatedAtMs: FIXTURE_NOW,
    standard: { partition: 'medium', difficulty: 'medium' },
  };
}

export function withDaily(meta: MetaSave, kind: 'solved'|'replay'|'archive'): MetaSave {
  const dateKey = kind === 'archive' ? '2026-09-20' : FIXTURE_DAY;
  const record = { completed: true, completedOnTime: true, attempts: kind === 'replay' ? 2 : 1, officialResult: { moves: 44, activeMs: 91_000 }, personalBest: { moves: 40, activeMs: 84_000 }, rankingAttemptId: `daily_${dateKey}` };
  return { ...meta, daily: { ...meta.daily, records: { ...meta.daily.records, [dateKey]: record } }, futurePrestige: { ...meta.futurePrestige, onTimeDailyDates: [dateKey] } };
}

export function withMastery(meta: MetaSave, rank: MasteryRank, factor: number): MetaSave {
  return { ...meta, mastery: { rank, stage: { anyWins: factor, mediumWins: Math.floor(factor/2), hardWins: Math.floor(factor/3), onTimeDailyWins: Math.floor(factor/4) } }, standard: { ...meta.standard, completed: { onboarding:[101], easy:[201,202], medium:[301,302], hard:factor > 10 ? [401,402] : [] } } };
}

export function leaderboardEntry(rank: number, score: number, name: string, playerId = `p${rank}`): PlatformLeaderboardEntry {
  return { rank, score, publicName: name, playerId };
}

export function fixtureCatalog(): VerifiedDealCatalog {
  const partitions = { onboarding:[101,102], easy:[201,202], medium:[301,302], hard:[401,402], daily:[501,502,503,504,505,506,507,508,509,510] } as const;
  const ordered = [...partitions.onboarding,...partitions.easy,...partitions.medium,...partitions.hard,...partitions.daily];
  const buffer = new ArrayBuffer(ordered.length * 4); const view = new DataView(buffer); ordered.forEach((seed,index)=>view.setUint32(index*4,seed,true));
  let byteOffset = 0; const offsets: Record<string,{byteOffset:number;count:number}> = {};
  for (const key of ['onboarding','easy','medium','hard','daily'] as const) { offsets[key]={byteOffset,count:partitions[key].length}; byteOffset += partitions[key].length*4; }
  return VerifiedDealCatalog.decode(buffer, {
    catalogVersion:2,rulesVersion:1,shuffleVersion:1,seedEncoding:'uint32-le',difficultyModelVersion:1,dailyAlgorithmVersion:1,
    standardCounts:{onboarding:2,easy:2,medium:2,hard:2},dailyScheduleStart:'2026-09-20',dailyScheduleLength:10,verifiedCount:ordered.length,
    crossPoolDuplicateCount:0,rejectedVerificationCount:0,fastNodeBudget:1,slowNodeBudget:2,sourceScanRanges:[],solverSourceHash:'visualqa',gameRulesSourceHash:'visualqa',productionAssetHash:'visualqa',offsets,
  });
}

class MemoryKeyValue implements ActiveGameStorageLike, PreferenceStorage {
  readonly data = new Map<string,string>();
  getItem(key:string):string|null{return this.data.get(key)??null;}
  setItem(key:string,value:string):void{this.data.set(key,value);}
  removeItem(key:string):void{this.data.delete(key);}
}
class MemoryPlayerStorage implements PlayerStorage {
  root: Record<string,unknown>;
  constructor(meta:MetaSave){this.root={trifoldMeta:structuredClone(meta)};}
  async scope(){return 'visual-qa';}
  async load(){return structuredClone(this.root);}
  async loadStrict(){return this.load();}
  async save(data:Record<string,unknown>){this.root=structuredClone(data);}
  async saveStrict(data:Record<string,unknown>){this.root=structuredClone(data);}
}

export interface VisualQaRuntime {
  readonly services: RuntimeServices;
  readonly scene: string;
  readonly sceneData: Readonly<Record<string,unknown>>;
  readonly storageWrites: { readonly realBrowser: 0 };
}

export async function buildRuntime(fixture: VisualQaFixture): Promise<VisualQaRuntime> {
  const playerStorage = new MemoryPlayerStorage(fixture.meta);
  let authorized = fixture.platform.authorized;
  const platform: PlatformServices = {
    language: fixture.preferences.language,
    playerStorage,
    trustedClock:{nowMs:()=>fixture.platform.nowMs},
    auth:{isAuthorized:()=>authorized,requestAuthorization:async()=>{authorized=true;return true;},onAccountSelectionClosed:()=>()=>undefined},
    leaderboards:{available:fixture.platform.leaderboardAvailable,getEntries:async()=>fixture.platform.leaderboardEntries.map((entry)=>structuredClone(entry)),getPlayerEntry:async()=>structuredClone(fixture.platform.playerLeaderboardEntry),setScore:async()=>undefined},
    ads:{available:false,showInterstitial:async()=>false},platformPause:{isPaused:()=>false,subscribe:()=>()=>undefined},gameplay:{start:()=>undefined,stop:()=>undefined},ready:()=>undefined,
  };
  const metaSession = new MetaSession(playerStorage, new MetaJournal('visual-qa', null));
  await metaSession.load();
  const activeStorage = new MemoryKeyValue(); const activeGames = new ActiveGameRepository(activeStorage); if(fixture.activeGame) activeGames.save(fixture.activeGame);
  const preferenceStorage = new MemoryKeyValue(); preferenceStorage.setItem(PREFERENCES_KEY, JSON.stringify(fixture.preferences));
  const preferences = new Preferences(preferenceStorage); preferences.initializeLanguage(platform.language);
  const analytics = new AnalyticsService();
  const services: RuntimeServices = {
    metaSession, authorizeProductAccount:async()=>{authorized=true;return true;}, activeGames, catalog:fixtureCatalog(), platform,
    leaderboards:new LeaderboardService(platform), analytics, standardAds:new StandardAdController(platform,analytics), preferences,
    get language(){return preferences.language;},
  };
  return { services, scene:fixture.scene, sceneData:fixture.sceneData??{}, storageWrites:{realBrowser:0} };
}
