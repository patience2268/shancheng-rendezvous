import { describe,expect,it } from 'vitest';
import { LEVELS,getLevel } from '../../src/data/map';
import { Game } from '../../src/domain/game';
import { collection } from '../../src/ui/home';
import { goalRelation,layerForHeight,mapLayers } from '../../src/ui/minimap';
import { completeLevel,defaultProgress } from '../../src/services/progress';

describe('map knowledge belongs to the run snapshot',()=>{
  it('marks mission transport origins known, then identifies lift entrances only on the same surface',()=>{
    const level=getLevel('liziba'),g=new Game(level),lift=level.transports.find(t=>t.kind==='lift')!;
    expect(g.state.knownEntrances).toEqual(level.transports.filter(t=>t.kind!=='lift').map(t=>t.id+':0'));
    g.start();g.state.position=[...lift.stops[1].position];g.state.surfaceId='arrival';g.update([0,0],1/60);
    expect(g.state.knownEntrances).not.toContain(lift.id+':1');
    g.state.surfaceId=lift.stops[1].surface;g.update([0,0],1/60);
    expect(g.state.knownEntrances).toContain(lift.id+':1');expect(g.state.knownEntrances).not.toContain(lift.id+':0');
    for(let i=0;i<10;i++)g.update([0,0],1/60);
    expect(g.state.knownEntrances.filter(id=>id===lift.id+':1')).toHaveLength(1);
  });
  it('knows the arrival entrance after a ride and restores knowledge with checkpoints and retry',()=>{
    const level=getLevel('liziba'),g=new Game(level),rail=level.transports.find(t=>t.kind==='rail')!,lift=level.transports.find(t=>t.kind==='lift')!;
    g.start();const initial=[...g.state.knownEntrances];
    g.state.position=[...rail.stops[0].position];g.state.surfaceId=rail.stops[0].surface;g.update([0,0],1/60);
    const snapshot=[...g.state.checkpoint.snapshot.knownEntrances];
    g.interact();g.update([0,0],rail.duration);
    expect(g.state.knownEntrances).toContain(rail.id+':1');
    expect(g.state.checkpoint.snapshot.knownEntrances).toEqual(snapshot);
    g.restoreCheckpoint();expect(g.state.knownEntrances).toEqual(snapshot);
    g.state.position=[...lift.stops[0].position];g.state.surfaceId=lift.stops[0].surface;g.update([0,0],1/60);
    expect(g.state.knownEntrances).toContain(lift.id+':0');
    g.retry();expect(g.state.knownEntrances).toEqual(initial);
  });
});

describe('floor labels and collection accounting',()=>{
  it('keeps five distinct interchange layers and maps continuous heights to the nearest layer',()=>{
    const layers=mapLayers(getLevel('huangjuewan'));expect(layers).toEqual([0,5,10,15,20]);
    expect(layerForHeight(layers,9.1)).toBe(10);expect(layerForHeight(layers,16.6)).toBe(15);
    expect(goalRelation([0,6,0],[0,6.5,0])).toBe('目标同层');
    expect(goalRelation([0,6,0],[0,15,0])).toBe('目标在上方');
    expect(goalRelation([0,6,0],[0,0,0])).toBe('目标在下方');
  });
  it('unions saved and current discoveries without duplicate or unknown counts',()=>{
    const d=LEVELS[0].discoveries.map(x=>x.id),p=completeLevel(defaultProgress(),'liziba',d);
    const result=collection(p,[d[0],LEVELS[1].discoveries[0].id,'unknown']);
    expect(result.total).toBe(10);expect(result.count).toBe(3);expect(p.discoveries).toEqual(d);
    expect(collection(defaultProgress()).count).toBe(0);
  });
});
