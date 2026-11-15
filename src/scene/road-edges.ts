import * as THREE from 'three';
import type { Level, Vec3 } from '../domain/types';
import { boundaryLoops, exposedEdges } from '../movement/outline';
import { DECK_THICKNESS } from '../movement/roads';

export function roadEdges(level: Level): THREE.Mesh[] {
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],sides:number[]=[],sideIndices:number[]=[];
  const palette=['#c4a35b','#65a58d','#8aa5c2','#b5a0be','#e0b573'].map(c=>new THREE.Color(c));
  const side=(a:Vec3,b:Vec3)=>{
    const base=sides.length/3;sides.push(...a,...b,a[0],a[1]-DECK_THICKNESS,a[2],b[0],b[1]-DECK_THICKNESS,b[2]);
    sideIndices.push(base,base+2,base+1,base+1,base+2,base+3);
  };
  for(const loop of boundaryLoops(exposedEdges(level))){
    const closed=loop[0].a.every((v,i)=>Math.abs(v-loop.at(-1)!.b[i])<1e-4);
    const points=loop.map(e=>e.a);if(!closed)points.push(loop.at(-1)!.b);
    const base=positions.length/3;
    points.forEach((p,i)=>{
      const before=points[i?i-1:closed?points.length-1:0],after=points[i===points.length-1?closed?0:i:i+1];
      const normal=(a:Vec3,b:Vec3)=>{const d=Math.hypot(b[0]-a[0],b[2]-a[2])||1;return[-(b[2]-a[2])/d,(b[0]-a[0])/d];};
      const n1=normal(before,p),n2=normal(p,after);
      let nx=n1[0]+n2[0],nz=n1[1]+n2[1],length=Math.hypot(nx,nz);
      if(length<1e-5){nx=n2[0]||n1[0];nz=n2[1]||n1[1];length=Math.hypot(nx,nz)||1;}
      nx/=length;nz/=length;const scale=.095/Math.max(.28,Math.abs(nx*(n2[0]||n1[0])+nz*(n2[1]||n1[1])));
      const tier=Math.max(0,Math.min(4,p[1]/5)),low=Math.floor(tier),stripe=palette[low].clone().lerp(palette[Math.min(4,low+1)],tier-low),body=new THREE.Color('#d4cbb7');
      // Three heights create a cream kerb with a thin coloured top. Every
      // cross-section is shared by both adjacent spans, including turns.
      for(const [height,color] of [[.008,body],[.28,body],[.305,stripe]] as const)for(const sign of[-1,1]){
        positions.push(p[0]+nx*scale*sign,p[1]+height,p[2]+nz*scale*sign);colors.push(color.r,color.g,color.b);
      }
    });
    for(let i=0;i<(closed?points.length:points.length-1);i++){
      const a=base+i*6,b=base+((i+1)%points.length)*6;
      for(const[u,v]of[[0,2],[1,3],[2,4],[3,5],[4,5]])indices.push(a+u,b+u,a+v,a+v,b+u,b+v);
      side(loop[i].a,loop[i].b);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const deck=new THREE.BufferGeometry();deck.setAttribute('position',new THREE.Float32BufferAttribute(sides,3));deck.setIndex(sideIndices);deck.computeVertexNormals();
  return [new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true,side:THREE.DoubleSide})),new THREE.Mesh(deck,new THREE.MeshStandardMaterial({color:'#c3baa3',roughness:1,flatShading:true,side:THREE.DoubleSide}))];
}
