import { expect,test } from '@playwright/test';

test('expanded branches complete with real scene obstacles and the original stamina rules',async({page})=>{
  test.setTimeout(90_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?test=1');await expect(page.locator('.cover')).toBeVisible();await page.evaluate(()=>(window as any).__journey.unlockAll());
  const routes=[
    {id:'liziba',before:[[-27,0,7],[-27,6,-5],[-24,6,-5]],after:[[23,6,-1.5],[27,6,-1.5],[27,0,20],[23,0,20],[12,0,20],[12,0,14]]},
    {id:'crown-escalator',before:[[-14,0,7],[-14,3,-1],[-17,3,-1],[-35,3,-1],[-36,3,0],[-36,5.5,9],[-31,5.5,8],[-26,5.5,7],[-27,5.5,7],[-27,8,-10],[8,8,-12],[8,8,-10]],after:[]},
    {id:'yangtze-cableway',before:[[-8,2,5],[1,6,5],[1,6,7]],after:[[17,6,7.5],[17,5,12],[16,2,23],[30,2,23],[30,2,4],[25,2,4],[25,2,-1]]},
  ];
  for(const route of routes){
    await page.evaluate(id=>(window as any).__journey.load(id),route.id);await page.getByRole('button',{name:/出发，慢慢走/}).click();
    await page.evaluate(({before,after})=>{const api=(window as any).__journey;for(const p of before)api.walkTo(p);if(after.length){api.interact();api.advance(12);for(const p of after)api.walkTo(p);}},route);
    await expect(page.getByRole('dialog')).toContainText('赴约成功');expect((await page.evaluate(()=>(window as any).__journey.state())).stamina).toBeGreaterThan(0);
  }
  await page.evaluate(()=>(window as any).__journey.load('huangjuewan'));await page.getByRole('button',{name:/出发，慢慢走/}).click();
  await page.evaluate(()=>{const api=(window as any).__journey,network=api.network();for(const id of['one-west','one-east','outer-12','two-south','two-north','outer-23','east-three-link','east-34','north-four-east','north-45','north-five-link']){for(const p of api.road(id))api.walkTo(p);api.walkTo(network.nodes.find((n:any)=>n.id===network.roads.find((r:any)=>r.id===id).to).position);}});
  await expect(page.getByRole('dialog')).toContainText('赴约成功');expect((await page.evaluate(()=>(window as any).__journey.state())).stamina).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
