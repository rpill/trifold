import type { VisualQaInteraction } from '../VisualQaCatalog.ts';

export interface VisualQaBounds { readonly x:number; readonly y:number; readonly width:number; readonly height:number }
export interface VisualQaPoint { readonly x:number; readonly y:number }
export type VisualQaResolvedInteraction =
  | { readonly type:'click'; readonly at:VisualQaPoint }
  | { readonly type:'drag'; readonly from:VisualQaPoint; readonly to:VisualQaPoint }
  | { readonly type:'swipe'; readonly direction:'left'|'right'|'up'|'down' }
  | { readonly type:'wait-ready'; readonly marker:string };

type Provider = () => VisualQaBounds | null;

export class VisualQaTargetRegistry {
  private readonly enabled:boolean;
  private readonly providers = new Map<string,Provider>();
  constructor(enabled:boolean){this.enabled=enabled;}
  register(id:string, provider:Provider):()=>void{
    if(!this.enabled) return ()=>undefined;
    if(this.providers.has(id)) throw new Error(`Duplicate Visual QA target: ${id}`);
    this.providers.set(id,provider);
    return ()=>{ if(this.providers.get(id)===provider) this.providers.delete(id); };
  }
  resolve(id:string):VisualQaPoint|null{
    if(!this.enabled) return null;
    const bounds=this.providers.get(id)?.();
    if(!bounds) return null;
    return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
  }
  clear():void{this.providers.clear();}
}

export function resolveVisualQaInteraction(interaction:VisualQaInteraction, registry:VisualQaTargetRegistry):VisualQaResolvedInteraction{
  if(interaction.type==='click'){
    const at=registry.resolve(interaction.target); if(!at) throw new Error(`Missing Visual QA target: ${interaction.target}`);
    return {type:'click',at};
  }
  if(interaction.type==='drag'){
    const from=registry.resolve(interaction.from); const to=registry.resolve(interaction.to);
    if(!from) throw new Error(`Missing Visual QA target: ${interaction.from}`);
    if(!to) throw new Error(`Missing Visual QA target: ${interaction.to}`);
    return {type:'drag',from,to};
  }
  if(interaction.type==='swipe') return interaction;
  return interaction;
}
