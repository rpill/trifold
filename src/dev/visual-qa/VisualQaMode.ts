import { VisualQaTargetRegistry } from './interactions/index.ts';

export interface VisualQaRequest {
  readonly scenarioId: string;
  readonly viewportId: string | null;
}

export interface VisualQaLaunch {
  readonly scenarioId:string;
  readonly scene:string;
  readonly sceneData:Readonly<Record<string,unknown>>;
  readonly viewportId:string|null;
}

export interface VisualQaBrowserState {
  readonly scenarioId:string;
  readonly scene:string;
  ready:boolean;
  marker:string|null;
  readonly markers:Record<string,boolean>;
  readonly resolveTarget:(id:string)=>{x:number;y:number}|null;
}

declare global {
  // DEV-only diagnostic surface consumed by the headless screenshot runner.
  // eslint-disable-next-line no-var
  var __TRIFOLD_VISUAL_QA__: VisualQaBrowserState | undefined;
}

let launch:VisualQaLaunch|null=null;
let targetRegistry = new VisualQaTargetRegistry(false);

export function parseVisualQaRequest(search: string, devEnabled: boolean): VisualQaRequest | null {
  if (!devEnabled) return null;
  const params = new URLSearchParams(search);
  const scenarioId = params.get('visualQa')?.trim();
  if (!scenarioId) return null;
  const viewportId = params.get('viewport')?.trim() || null;
  return { scenarioId, viewportId };
}

export function installVisualQaLaunch(next:VisualQaLaunch):void {
  launch={...next,sceneData:{...next.sceneData}};
  targetRegistry = new VisualQaTargetRegistry(true);
  globalThis.__TRIFOLD_VISUAL_QA__={
    scenarioId:next.scenarioId,
    scene:next.scene,
    ready:false,
    marker:null,
    markers:{},
    resolveTarget:(id)=>targetRegistry.resolve(id),
  };
}

export function clearVisualQaLaunch():void {
  launch=null;
  targetRegistry.clear();
  targetRegistry=new VisualQaTargetRegistry(false);
  delete globalThis.__TRIFOLD_VISUAL_QA__;
}

export function getVisualQaLaunch():VisualQaLaunch|null {
  return launch ? {...launch,sceneData:{...launch.sceneData}} : null;
}

export function getVisualQaTargetRegistry():VisualQaTargetRegistry { return targetRegistry; }

export function markVisualQaReady(marker='scene-created'):void {
  const state=globalThis.__TRIFOLD_VISUAL_QA__;
  if(!state)return;
  state.ready=true;
  state.marker=marker;
  state.markers[marker]=true;
}

export function markVisualQaMarker(marker:string):void {
  const state=globalThis.__TRIFOLD_VISUAL_QA__;
  if(!state)return;
  state.markers[marker]=true;
}
