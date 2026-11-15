import { expect,test,type Page } from '@playwright/test';

const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function start(page:Page){
  await page.goto('/?test=1');await page.getByRole('button',{name:/开启山城旅程/}).click();
  await page.getByRole('button',{name:/出发，慢慢走/}).click();
  await expect(page.locator('#modal-root .dialog')).toHaveCount(0);
}
const state=(page:Page)=>page.evaluate(()=>(window as any).__journey.state());

test('homepage cards, hotspot focus and saved collection counts follow actual progress',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('shancheng-rendezvous:progress:v2',JSON.stringify({schemaVersion:2,completed:['liziba'],discoveries:['liziba-quay','liziba-building'],lastLevel:'crown-escalator',tutorialSeen:true,settings:{muted:true,music:.32,ambient:.38,effects:.55,reducedMotion:false,lowQuality:false}})));
  await page.goto('/');
  await expect(page.locator('.stage-step')).toHaveCount(4);await expect(page.locator('.stage-step:disabled')).toHaveCount(2);
  await expect(page.locator('.stage-step.is-active')).toContainText('皇冠大扶梯');
  await expect(page.locator('#station-liziba')).toContainText('2/2');await expect(page.locator('.journal-badge')).toHaveText('2/10');
  await expect(page.locator('#continue-summary')).toContainText('第 2 站');await expect(page.locator('#continue-summary')).toContainText('2/10');
  await page.locator('.cover-pin[data-landmark="crown-escalator"]').click();await expect(page.locator('#station-crown-escalator')).toBeFocused();
  await page.locator('#station-crown-escalator').click();await expect(page.getByRole('dialog')).toContainText('皇冠大扶梯');
});

test('a failed homepage illustration retains the four landmarks and start controls',async({page})=>{
  await page.route('**/cover/shancheng-cover.webp',route=>route.abort());await page.goto('/');
  await expect(page.locator('.cover-fallback')).toBeVisible();await expect(page.locator('.cover-pin')).toHaveCount(4);
  await expect(page.locator('canvas')).toHaveCount(0);await page.getByRole('button',{name:/开启山城旅程/}).click();
  await expect(page.getByRole('dialog')).toContainText('李子坝');
});

test('mouse parallax eases toward movement and stops when reduced motion is selected',async({page})=>{
  await page.goto('/');await expect(page.locator('.has-cover')).toBeVisible();
  const poster=(await page.locator('.cover-poster').boundingBox())!;
  await page.mouse.move(poster.x+poster.width-15,poster.y+20);
  await expect.poll(()=>page.locator('.cover-illustration').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeLessThan(-1);
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('减少动态效果',{exact:true}).check();await page.getByRole('button',{name:'保存并返回'}).click();
  await expect(page.locator('.home-reduced')).toBeVisible();
  await page.mouse.move(poster.x+20,poster.y+poster.height-20);
  expect(await page.locator('.cover-illustration').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBe(0);
});

test('repeated navigation is serialized and the transition always returns input and focus',async({page})=>{
  await page.goto('/?test=1');
  await page.evaluate(()=>{(document.querySelector('[data-action="start"]') as HTMLElement).click();(document.querySelector('[data-action="levels"]') as HTMLElement).click();});
  await expect(page.locator('.page-transition')).toBeVisible();await expect(page.locator('#app')).toHaveAttribute('inert','');
  await page.keyboard.press('KeyD');await expect(page.getByRole('dialog')).toContainText('李子坝');
  await expect(page.locator('.page-transition')).toBeHidden();await expect(page.locator('#app')).not.toHaveAttribute('inert','');
  await page.getByRole('button',{name:/出发，慢慢走/}).click();const before=await state(page);
  await page.getByRole('button',{name:/山城赴约\s+SHANCHENG/}).click();await expect(page.locator('.cover')).toBeVisible();await expect(page.locator('.page-transition')).toBeHidden();
  await expect(page.locator('.cover h1')).toBeFocused();expect(before.distance).toBe(0);
  await page.getByRole('button',{name:'选择目的地',exact:true}).click();await expect(page.locator('.destination-card')).toHaveCount(4);
  await expect(page.locator('.page-transition')).toBeHidden();await expect(page.locator('.level-select h1')).toBeFocused();
});

test('a failed WebGL context leaves an accessible retry page with no transition blocking it',async({page})=>{
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:any[]){if(type.startsWith('webgl'))return null;return (get as any).call(this,type,...args);} as any;});
  await page.goto('/');await page.getByRole('button',{name:/开启山城旅程/}).click();
  await expect(page.getByRole('heading',{name:'场景加载遇到问题'})).toBeVisible();await expect(page.locator('.page-transition')).toBeHidden();
  await page.getByRole('button',{name:'返回目的地',exact:true}).click();await expect(page.locator('.destination-card')).toHaveCount(4);
});

test('minimap heading, entrance knowledge and paused layer selection match the current run',async({page})=>{
  await start(page);await expect(page.locator('#goal-compass')).toHaveCount(0);
  await expect(page.locator('#minimap [data-map-entry="liziba-lift:0"]')).toBeHidden();
  await page.evaluate(()=>{const api=(window as any).__journey;api.place('quay',[-15,0,10],80);api.advance(.1);});
  await expect(page.locator('#minimap [data-map-entry="liziba-lift:0"]')).toBeVisible();
  await page.evaluate(()=>{const api=(window as any).__journey;api.place('quay',[-26,0,10],80);api.move([1,0],.3);});
  await expect(page.locator('#minimap .mini-player')).toHaveAttribute('transform',/rotate\(90\)/);
  const before=await state(page);await page.getByRole('button',{name:'展开分层地图',exact:true}).click();
  await page.getByRole('button',{name:'高程 6.0',exact:true}).click();await expect(page.locator('#modal-root .map-drawing')).toHaveAttribute('data-layer','6');
  await expect(page.getByRole('button',{name:'高程 6.0',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'跟随所在层',exact:true})).toHaveAttribute('aria-pressed','false');
  expect((await state(page)).position).toEqual(before.position);expect((await state(page)).stamina).toBe(before.stamina);
  await expect(page.locator('#minimap .map-drawing')).toHaveAttribute('data-layer','0');
  await page.getByRole('button',{name:'收起地图，继续',exact:true}).click();await expect(page.locator('#modal-root .dialog')).toHaveCount(0);
  expect((await state(page)).paused).toBe(false);
  await page.evaluate(()=>{const api=(window as any).__journey;api.unlockAll();return api.load('huangjuewan');});await page.getByRole('button',{name:/出发，慢慢走/}).click();
  await page.getByRole('button',{name:'展开分层地图',exact:true}).click();await expect(page.locator('.map-tabs [data-action^="map-layer:"]')).toHaveCount(6);
  await page.getByRole('button',{name:'第 5 层',exact:true}).click();await expect(page.locator('#modal-root .map-drawing')).toHaveAttribute('data-layer','20');
});

test.describe('optional phone orientation',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  async function mockOrientation(page:Page,result:'granted'|'denied'){
    await page.addInitScript(result=>{
      (window as any).__permissionCalls=0;
      class Orientation extends Event{beta:number;gamma:number;constructor(beta:number,gamma:number){super('deviceorientation');this.beta=beta;this.gamma=gamma;}static async requestPermission(){(window as any).__permissionCalls++;return result;}}
      Object.defineProperty(window,'DeviceOrientationEvent',{value:Orientation,configurable:true});
    },result);
  }
  test('requests permission only on tap, calibrates once and animates relative tilt',async({page})=>{
    await mockOrientation(page,'granted');await page.goto('/');await expect(page.locator('.has-cover')).toBeVisible();
    expect(await page.evaluate(()=>(window as any).__permissionCalls)).toBe(0);
    await page.getByRole('button',{name:'开启体感视差',exact:true}).click();
    await expect(page.getByRole('button',{name:'关闭体感视差',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.evaluate(()=>{const Event=(window as any).DeviceOrientationEvent;window.dispatchEvent(new Event(30,0));window.dispatchEvent(new Event(34,6));});
    await expect.poll(()=>page.locator('.cover-illustration').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeLessThan(-.5);
    expect(await page.evaluate(()=>(window as any).__permissionCalls)).toBe(1);
    await page.getByRole('button',{name:'关闭体感视差',exact:true}).click();await expect(page.locator('.tilt-status')).toContainText('已关闭');
    await page.getByRole('button',{name:/开启山城旅程/}).click();await page.getByRole('button',{name:/出发，慢慢走/}).click();await expect(page.locator('#move-stick')).toBeInViewport();
  });
  test('denied permission and missing orientation data keep the static cover and game usable',async({page})=>{
    await mockOrientation(page,'denied');await page.goto('/');await page.getByRole('button',{name:'开启体感视差',exact:true}).click();
    await expect(page.locator('.tilt-status')).toContainText('未开启体感');await expect(page.locator('.cover-pin')).toHaveCount(4);
    await page.getByRole('button',{name:/开启山城旅程/}).click();await expect(page.getByRole('dialog')).toContainText('李子坝');
    await page.getByRole('button',{name:'返回目的地',exact:true}).click();
    await page.getByRole('button',{name:'继续竖屏',exact:true}).click();await page.getByRole('button',{name:/返回封面/}).click();
    await page.evaluate(()=>Object.defineProperty(window,'DeviceOrientationEvent',{value:undefined,configurable:true}));
    await page.getByRole('button',{name:'开启体感视差',exact:true}).click();await expect(page.locator('.tilt-status')).toContainText('不支持体感');
  });
  test('granted permission with no sensor events times out to a usable static cover',async({page})=>{
    await mockOrientation(page,'granted');await page.goto('/');await page.getByRole('button',{name:'开启体感视差',exact:true}).click();
    await expect(page.locator('.tilt-status')).toContainText('未收到设备方向数据');await expect(page.getByRole('button',{name:'开启体感视差',exact:true})).toBeEnabled();
    await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'开启体感视差',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:/开启山城旅程/}).click();await expect(page.getByRole('dialog')).toContainText('李子坝');
  });
});
