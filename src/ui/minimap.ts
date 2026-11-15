import type { Level, RunState, Surface, Vec3 } from '../domain/types';
import { heightAt } from '../movement/ground';
import { terrainPads } from '../data/terrain';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function surfaceHeight(s:Surface){const x=(s.bounds[0]+s.bounds[1])/2,z=(s.bounds[2]+s.bounds[3])/2;return heightAt(s,x,z);}
export function mapLayers(level:Level):number[]{return [...new Set(level.surfaces.filter(s=>!s.gradient.some(g=>Math.abs(g)>.001)).map(s=>Number(s.origin[1].toFixed(2))))].sort((a,b)=>a-b);}
export function layerForHeight(layers:number[],height:number){return layers.reduce((best,h)=>Math.abs(h-height)<Math.abs(best-height)?h:best,layers[0]??0);}
export function goalRelation(player:Vec3,goal:Vec3){const delta=goal[1]-player[1];return Math.abs(delta)<.7?'目标同层':delta>0?'目标在上方':'目标在下方';}

/** Static paths are created once; updates only move markers/change layer flags. */
export class MiniMap {
  readonly layers:number[];
  private pads:ReturnType<typeof terrainPads>;
  private minX:number;private minZ:number;private scale:number;
  private visibleLayer:number;
  private drawings=new WeakMap<HTMLElement,{
    layer?:number;known?:string;player?:string;relation?:string;
    roads:SVGElement[];entries:SVGElement[];services:SVGElement[];
    marker:SVGElement;label:Element;goal:Element;
  }>();
  constructor(readonly level:Level){
    this.layers=mapLayers(level);this.visibleLayer=this.layers[0];this.pads=terrainPads(level);
    this.minX=Math.min(...this.pads.map(p=>p.position[0]-p.size[0]/2));this.minZ=Math.min(...this.pads.map(p=>p.position[2]-p.size[2]/2));
    const maxX=Math.max(...this.pads.map(p=>p.position[0]+p.size[0]/2)),maxZ=Math.max(...this.pads.map(p=>p.position[2]+p.size[2]/2));this.scale=210/Math.max(maxX-this.minX,maxZ-this.minZ);
    this.minX-=(210/this.scale-(maxX-this.minX))/2;this.minZ-=(210/this.scale-(maxZ-this.minZ))/2;
  }
  private p(p:Vec3){return[15+(p[0]-this.minX)*this.scale,15+(p[2]-this.minZ)*this.scale];}
  markup(expanded=false):string{
    const paths=this.level.surfaces.map(s=>{
      const polygon=s.polygon??[[s.bounds[0],s.bounds[2]],[s.bounds[1],s.bounds[2]],[s.bounds[1],s.bounds[3]],[s.bounds[0],s.bounds[3]]];
      return '<path class="mini-road" data-map-height="'+surfaceHeight(s)+'" data-map-slope="'+s.gradient.some(g=>Math.abs(g)>.001)+'" d="'+polygon.map((p,i)=>(i?'L':'M')+this.p([p[0],0,p[1]]).join(',')).join(' ')+'Z"/>';
    }).join('');
    const land=this.pads.map(({position:p,size:s})=>{const a=this.p([p[0]-s[0]/2,0,p[2]-s[2]/2]);return '<rect class="mini-land" x="'+a[0]+'" y="'+a[1]+'" width="'+s[0]*this.scale+'" height="'+s[2]*this.scale+'" rx="2"/>';}).join('');
    const transports=this.level.transports.map(t=>'<path class="mini-transport-line" d="'+t.path.map((p,i)=>(i?'L':'M')+this.p(p).join(',')).join(' ')+'" data-service="'+t.id+'"/>'+t.stops.map((s,i)=>{const p=this.p(s.position);return '<g data-map-entry="'+t.id+':'+i+'" transform="translate('+p.join(' ')+')"><circle r="3.6"/><title>'+esc(t.name+' · '+s.name)+'</title></g>';}).join('')).join('');
    const goal=this.p(this.level.goal.position);
    return '<div class="map-drawing" data-map-instance="'+(expanded?'expanded':'mini')+'"><svg viewBox="0 0 240 240" role="img" aria-label="'+esc(this.level.name)+'游戏化地图，固定朝向"><rect width="240" height="240" rx="16" class="mini-water"/>'+land+paths+transports+'<g class="mini-goal" transform="translate('+goal.join(' ')+')"><circle r="5"/><circle r="9" class="mini-goal-halo"/></g><g class="mini-player"><path d="M0,-6 L4.5,5 L0,3 L-4.5,5 Z"/></g><text x="17" y="232" class="map-axis">固定朝向 · 游戏示意</text></svg><span class="mini-layer"></span><span class="mini-relation"></span></div>';
  }
  update(root:ParentNode,state:RunState,override?:number):void{
    const next=layerForHeight(this.layers,state.position[1]);
    // A small hysteresis prevents a ramp near the midpoint from flickering.
    if(Math.abs(next-state.position[1])+.25<Math.abs(this.visibleLayer-state.position[1]))this.visibleLayer=next;
    const selected=override??this.visibleLayer,layerIndex=this.layers.indexOf(selected),p=this.p(state.position),known=new Set(state.knownEntrances);
    const signature=state.knownEntrances.join('|'),relation=goalRelation(state.position,this.level.goal.position);
    // Game facing is atan2(dx,dz); SVG rotation is clockwise from the up arrow.
    const transform=`translate(${p.join(' ')}) rotate(${180-state.facing*180/Math.PI})`;
    root.querySelectorAll<HTMLElement>('.map-drawing').forEach(map=>{
      let drawing=this.drawings.get(map);
      if(!drawing){drawing={roads:[...map.querySelectorAll<SVGElement>('[data-map-height]')],entries:[...map.querySelectorAll<SVGElement>('[data-map-entry]')],services:[...map.querySelectorAll<SVGElement>('[data-service]')],marker:map.querySelector<SVGElement>('.mini-player')!,label:map.querySelector('.mini-layer')!,goal:map.querySelector('.mini-relation')!};this.drawings.set(map,drawing);}
      if(drawing.layer!==selected){
        map.dataset.layer=String(selected);drawing.layer=selected;
        drawing.roads.forEach(el=>el.classList.toggle('is-current-layer',layerForHeight(this.layers,Number(el.dataset.mapHeight))===selected));
        drawing.label.textContent=this.level.network?'第 '+(layerIndex+1)+' 层':(this.layers.length>1?'高程 '+selected.toFixed(1):'街巷层');
      }
      if(drawing.player!==transform){drawing.marker.setAttribute('transform',transform);drawing.player=transform;}
      if(drawing.known!==signature){
        drawing.known=signature;
        drawing.entries.forEach(el=>{el.style.display=known.has(el.dataset.mapEntry!)?'':'none';});
        drawing.services.forEach(el=>{el.style.display=[...known].some(k=>k.startsWith(el.dataset.service!+':'))?'':'none';});
      }
      if(drawing.relation!==relation){drawing.goal.textContent=relation;drawing.relation=relation;}
    });
  }
}
