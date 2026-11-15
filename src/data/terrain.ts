import type { Level, Vec3 } from '../domain/types';

/** Shared terrain footprints for scenery and its schematic map. */
export function terrainPads(level:Level):{position:Vec3;size:Vec3}[]{
  if(level.id==='yangtze-cableway')return[
    {position:[-7,0,2],size:[16,1.6,21]},
    {position:[24,0,9],size:[24,1.6,38]},
  ];
  const minX=Math.min(...level.surfaces.map(s=>s.bounds[0]))-5,maxX=Math.max(...level.surfaces.map(s=>s.bounds[1]))+5;
  const minZ=Math.min(...level.surfaces.map(s=>s.bounds[2]))-5,maxZ=Math.max(...level.surfaces.map(s=>s.bounds[3]))+5;
  return[{position:[(minX+maxX)/2,-1.35,(minZ+maxZ)/2],size:[maxX-minX,1.8,maxZ-minZ]}];
}
