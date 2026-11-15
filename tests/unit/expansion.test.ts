import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/data/map';
import { Game } from '../../src/domain/game';
import type { Point } from '../../src/domain/types';
import { compileRoads } from '../../src/movement/roads';
import { boundaryLoops, exposedEdges } from '../../src/movement/outline';
import { facadeLayout } from '../../src/scene/buildings';

function walk(g:Game,points:Point[]) {
  for(const target of points)for(let i=0;i<6000;i++){
    if(g.state.phase==='success')return;
    const dx=target[0]-g.state.position[0],dz=target[1]-g.state.position[2],d=Math.hypot(dx,dz);if(d<.025)break;
    const before=[...g.state.position];g.update([dx/d,dz/d],Math.min(1/60,d/3));
    if(before.every((v,j)=>Math.abs(v-g.state.position[j])<1e-8))throw new Error(g.level.id+' blocked '+g.state.surfaceId+' '+before+' toward '+target+' '+g.state.phase);
  }
}
function ride(g:Game){expect(g.interaction()).toBeDefined();g.interact();for(let i=0;i<720;i++)g.update([0,0],1/60);}
describe('expanded branches',()=>{
  it('completes Liziba with the east exit and a return along the riverwalk',()=>{
    const g=new Game(LEVELS[0]);g.start();walk(g,[[-27,7],[-27,-5],[-24,-5]]);ride(g);
    walk(g,[[23,-1.5],[27,-1.5],[27,20],[23,20],[12,20],[12,14]]);expect(g.state.phase).toBe('success');expect(g.state.stamina).toBeGreaterThan(0);
  });
  it('completes Crown through the new west loop with no coefficient reduction',()=>{
    const g=new Game(LEVELS[1]);g.start();walk(g,[[-14,7],[-14,-1],[-17,-1],[-35,-1],[-36,0],[-36,9],[-31,8],[-26,7],[-27,7],[-27,-10],[8,-12],[8,-10]]);
    expect(g.state.phase).toBe('success');expect(g.state.stamina).toBeGreaterThan(0);expect(g.state.consumedRests).toContain('crown-turn-rest');
  });
  it('completes the cableway using the south ramp and riverside return',()=>{
    const g=new Game(LEVELS[2]);g.start();walk(g,[[-8,5],[1,5],[1,7]]);ride(g);
    walk(g,[[17,7.5],[16,12],[16,23],[30,23],[30,4],[25,4],[25,-1]]);expect(g.state.phase).toBe('success');expect(g.state.stamina).toBeGreaterThan(0);
  });
  it('takes the new Huangjuewan connections to the fifth level continuously',()=>{
    const g=new Game(LEVELS[3]);g.start();
    for(const id of ['one-west','one-east','outer-12','two-south','two-north','outer-23','east-three-link','east-34','north-four-east','north-45','north-five-link']){
      const road=compileRoads(g.level.network!).roads.find(r=>r.road.id===id)!;
      walk(g,road.points.map(p=>[p[0],p[2]]));const p=g.level.network!.nodes.find(n=>n.id===road.road.to)!.position;walk(g,[[p[0],p[2]]]);
    }
    expect(g.state.phase).toBe('success');expect(g.state.stamina).toBeGreaterThan(0);
  });
});
describe('model continuity and scale',()=>{
  it('joins every ramp cross-section at the exact junction height, without transverse kerbs',()=>{
    const level=LEVELS[3],edges=exposedEdges(level);
    for(const {road,points,left,right} of compileRoads(level.network!).roads){
      const from=level.network!.nodes.find(n=>n.id===road.from)!,to=level.network!.nodes.find(n=>n.id===road.to)!;
      expect(points[0][1]).toBe(from.position[1]);expect(points.at(-1)![1]).toBe(to.position[1]);
      for(const i of[0,points.length-1]){
        const a=left[i],b=right[i],middle=a.map((v,j)=>(v+b[j])/2);
        const across=edges.filter(e=>{const p=e.a.map((v,j)=>(v+e.b[j])/2);return Math.hypot(...p.map((v,j)=>v-middle[j]))<.01&&Math.hypot(e.a[0]-e.b[0],e.a[2]-e.b[2])>road.width*.8;});
        expect(across,road.id+' has a kerb across its junction').toEqual([]);
      }
    }
  });
  it('all exposed road edges form closed rings, including junctions and deck crossings',()=>{
    const edges=exposedEdges(LEVELS[3]),loops=boundaryLoops(edges);expect(edges.length).toBeGreaterThan(50);
    for(const loop of loops)expect(Math.hypot(...loop[0].a.map((v,i)=>v-loop.at(-1)!.b[i])),JSON.stringify(loop[0])).toBeLessThan(.001);
  });
  it('a floor and doorway are taller than the traveller across all building sizes',()=>{
    for(const height of[5,7,8,10,11.2,13,16,21]){
      const p=facadeLayout(height,4,4);expect(p.storey/1.5).toBeGreaterThanOrEqual(1.7);expect(p.doorHeight).toBeGreaterThan(1.5);expect(p.floors*p.storey).toBeCloseTo(height);expect(p.windowHeight).toBeLessThan(p.storey);
    }
  });
});
