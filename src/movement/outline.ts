import type { Level, Point, Surface, Vec3 } from '../domain/types';

export interface BoundaryEdge { a: Vec3; b: Vec3; tier: number }
const at = (s: Surface, x: number, z: number) => s.origin[1]+(x-s.origin[0])*s.gradient[0]+(z-s.origin[2])*s.gradient[1];
const polygon = (s: Surface): Point[] => s.polygon??[[s.bounds[0],s.bounds[2]],[s.bounds[1],s.bounds[2]],[s.bounds[1],s.bounds[3]],[s.bounds[0],s.bounds[3]]];
const inside = (s: Surface, x: number, z: number) => polygon(s).every((a,i,p)=>{
  const b=p[(i+1)%p.length];return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-7;
});
const cache = new WeakMap<Level,BoundaryEdge[]>();

/** Clip every polygon edge against coplanar neighbours. Internal triangle and
 * junction edges disappear; crossings on different decks remain independent. */
export function exposedEdges(level: Level): BoundaryEdge[] {
  const cached=cache.get(level);if(cached)return cached;
  const grid=new Map<string,Surface[]>();
  for(const s of level.surfaces)for(let x=Math.floor(s.bounds[0]/6);x<=Math.floor(s.bounds[1]/6);x++)for(let z=Math.floor(s.bounds[2]/6);z<=Math.floor(s.bounds[3]/6);z++){
    const key=x+':'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key)!.push(s);
  }
  const result:BoundaryEdge[]=[],seen=new Set<string>();
  for(const s of level.surfaces){
    const shape=polygon(s);
    for(let i=0;i<shape.length;i++){
      const a=shape[i],b=shape[(i+1)%shape.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<1e-6)continue;
      const candidates=new Set<Surface>();
      for(let x=Math.floor((Math.min(a[0],b[0])-.02)/6);x<=Math.floor((Math.max(a[0],b[0])+.02)/6);x++)for(let z=Math.floor((Math.min(a[1],b[1])-.02)/6);z<=Math.floor((Math.max(a[1],b[1])+.02)/6);z++)for(const n of grid.get(x+':'+z)??[])if(n!==s)candidates.add(n);
      const cuts=[0,1];
      for(const n of candidates){
        const np=polygon(n);
        for(let j=0;j<np.length;j++){
          const c=np[j],d=np[(j+1)%np.length],ex=d[0]-c[0],ez=d[1]-c[1],den=dx*ez-dz*ex;
          if(Math.abs(den)<1e-9){
            if(Math.abs((c[0]-a[0])*dz-(c[1]-a[1])*dx)<1e-6)for(const p of[c,d]){const t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(length*length);if(t>0&&t<1)cuts.push(t);}
          }else{
            const t=((c[0]-a[0])*ez-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dz-(c[1]-a[1])*dx)/den;
            if(t>0&&t<1&&u>=-1e-7&&u<=1+1e-7)cuts.push(t);
          }
        }
      }
      cuts.sort((x,y)=>x-y);
      for(let j=1;j<cuts.length;j++){
        const t0=cuts[j-1],t1=cuts[j];if((t1-t0)*length<1e-5)continue;
        const t=(t0+t1)/2,x=a[0]+dx*t,z=a[1]+dz*t;
        // CCW polygons have their exterior on the right of each directed edge.
        const ox=x+dz/length*.002,oz=z-dx/length*.002;
        if([...candidates].some(n=>inside(n,ox,oz)&&[t0,t,t1].every(f=>{
          const px=a[0]+dx*f,pz=a[1]+dz*f;return Math.abs(at(n,px,pz)-at(s,px,pz))<1e-6;
        })))continue;
        const point=(f:number):Vec3=>{const px=a[0]+dx*f,pz=a[1]+dz*f;return[px,at(s,px,pz),pz];};
        const first=point(t0),last=point(t1),key=first.concat(last).map(v=>v.toFixed(5)).join(':');
        if(!seen.has(key)){seen.add(key);result.push({a:first,b:last,tier:s.tier??1});}
      }
    }
  }
  // Very acute bevels can leave millimetre-scale slivers at triangulated
  // collars. Weld only spatially coincident ends; never bridge distinct decks.
  const vertices:Vec3[]=[],weld=(p:Vec3):Vec3=>{
    const found=vertices.find(q=>Math.hypot(...p.map((v,i)=>v-q[i]))<.035);
    if(found)return found;vertices.push(p);return p;
  };
  const unique=new Map<string,BoundaryEdge>();
  for(const e of result){e.a=weld(e.a);e.b=weld(e.b);if(e.a===e.b)continue;unique.set(e.a.concat(e.b).map(v=>v.toFixed(4)).join(':'),e);}
  const welded=[...unique.values()];cache.set(level,welded);return welded;
}

/** Shared vertices make bevels meet without the open ends of separate boxes. */
export function boundaryLoops(edges: BoundaryEdge[]): BoundaryEdge[][] {
  const key=(p:Vec3)=>p.map(v=>v.toFixed(4)).join(':'),starts=new Map<string,BoundaryEdge[]>();
  for(const e of edges){const k=key(e.a);if(!starts.has(k))starts.set(k,[]);starts.get(k)!.push(e);}
  const unused=new Set(edges),loops:BoundaryEdge[][]=[];
  for(const first of edges){
    if(!unused.has(first))continue;
    const loop:BoundaryEdge[]=[];let edge:BoundaryEdge|undefined=first;
    while(edge&&unused.has(edge)){loop.push(edge);unused.delete(edge);edge=starts.get(key(edge.b))?.find(e=>unused.has(e));}
    loops.push(loop);
  }
  return loops;
}
