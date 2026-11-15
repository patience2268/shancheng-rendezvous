import { COVER_IMAGE, HOME_LAYERS, MOBILE_COVER_IMAGE } from '../data/assets';

type PermissionConstructor = typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<string>};
const clamp=(v:number)=>Math.max(-1,Math.min(1,v));
export class HomeVisual {
  private target=[0,0];private current=[0,0];private frame=0;private last=0;
  private disposed=false;private paused=false;private tilt=false;private busy=false;
  private baseline:[number,number]|undefined;private timeout=0;
  private media=matchMedia('(prefers-reduced-motion:reduce)');
  private picture:HTMLElement;private status:HTMLElement;private button:HTMLButtonElement;
  constructor(private root:HTMLElement,private reduced:()=>boolean,private low:()=>boolean){
    this.picture=root.querySelector('.cover-picture')!;this.status=root.querySelector('.tilt-status')!;this.button=root.querySelector('.tilt-entry')!;
    root.addEventListener('pointermove',this.pointer);root.addEventListener('pointerleave',this.center);
    root.addEventListener('pointerover',this.highlight);root.addEventListener('focusin',this.highlight);root.addEventListener('pointerout',this.unhighlight);root.addEventListener('focusout',this.unhighlight);
    document.addEventListener('visibilitychange',this.visibility);window.addEventListener('orientationchange',this.recalibrate);window.addEventListener('resize',this.recalibrate);this.media.addEventListener('change',this.settingsChanged);
    void this.load();this.settingsChanged();
  }
  private async load(){
    const image=(src:string,alt='',depth=.65)=>new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();img.alt=alt;img.className='cover-illustration';img.dataset.depth=String(depth);
      img.onload=()=>resolve(img);img.onerror=reject;img.src=import.meta.env.BASE_URL+src;
    });
    if(HOME_LAYERS.length){
      try{const layers=await Promise.all(HOME_LAYERS.map((l,i)=>image(l.src,i?'':'重庆立体山城主视觉',l.depth)));if(this.disposed)return;this.picture.replaceChildren(...layers);this.root.classList.add('has-layered-cover','has-cover');return;}catch{/* Use the existing full illustration if a layer is missing. */}
    }
    if(!COVER_IMAGE)return;
    try{
      const img=await image(MOBILE_COVER_IMAGE&&matchMedia('(max-width:640px)').matches?MOBILE_COVER_IMAGE:COVER_IMAGE,'重庆立体山城主视觉');
      if(this.disposed)return;this.picture.replaceChildren(img);this.root.classList.add('has-cover');
    }catch{/* Independent typography and four icons remain visible. */}
  }
  private blocked(){return this.paused||document.hidden||this.reduced()||this.media.matches||this.low();}
  private pointer=(e:PointerEvent)=>{
    if(e.pointerType!=='mouse'||this.tilt||this.blocked())return;
    const r=this.root.querySelector('.cover-poster')!.getBoundingClientRect();
    this.target=[clamp((e.clientX-r.x-r.width/2)/(r.width*.8)),clamp((e.clientY-r.y-r.height/2)/(r.height*.8))];this.wake();
  };
  private center=()=>{if(!this.tilt){this.target=[0,0];this.wake();}};
  private highlight=(e:Event)=>{const el=(e.target as Element).closest<HTMLElement>('[data-landmark]');if(el)this.root.querySelectorAll<HTMLElement>('[data-landmark]').forEach(n=>n.classList.toggle('is-highlighted',n.dataset.landmark===el.dataset.landmark));};
  private unhighlight=()=>this.root.querySelectorAll('.is-highlighted').forEach(el=>el.classList.remove('is-highlighted'));
  private draw(){
    this.picture.querySelectorAll<HTMLElement>('[data-depth]').forEach(img=>{const depth=Number(img.dataset.depth);img.style.transform=`translate3d(${this.current[0]*-16*depth}px,${this.current[1]*-12*depth}px,0) scale(1.065)`;});
    const lines=this.root.querySelector<HTMLElement>('.cover-lines');if(lines)lines.style.translate=`${this.current[0]*-3}px ${this.current[1]*-3}px`;
    const pins=this.root.querySelector<HTMLElement>('.cover-pins');if(pins)pins.style.translate=`${this.current[0]*-5}px ${this.current[1]*-4}px`;
  }
  private tick=(now:number)=>{
    this.frame=0;if(this.disposed||this.blocked())return;
    const dt=Math.min(.05,this.last?(now-this.last)/1000:1/60),blend=1-Math.exp(-12*dt);this.last=now;
    for(let i=0;i<2;i++)this.current[i]+=(this.target[i]-this.current[i])*blend;this.draw();
    if(this.target.some((v,i)=>Math.abs(v-this.current[i])>.0005))this.frame=requestAnimationFrame(this.tick);else this.last=0;
  };
  private wake(){if(!this.frame&&!this.blocked()&&!this.disposed)this.frame=requestAnimationFrame(this.tick);}
  private orientation=(e:DeviceOrientationEvent)=>{
    if(!this.tilt||this.blocked()||e.beta===null||e.gamma===null||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
    clearTimeout(this.timeout);if(!this.baseline)this.baseline=[e.beta,e.gamma];
    const wrap=(v:number)=>Math.atan2(Math.sin(v*Math.PI/180),Math.cos(v*Math.PI/180))*180/Math.PI;
    const x=wrap(e.gamma-this.baseline[1])/14,y=wrap(e.beta-this.baseline[0])/14,angle=(screen.orientation?.angle??0)*Math.PI/180;
    this.target=[clamp(x*Math.cos(angle)+y*Math.sin(angle)),clamp(y*Math.cos(angle)-x*Math.sin(angle))];this.status.textContent='轻轻倾斜手机，感受山城层次';this.wake();
  };
  private recalibrate=()=>{this.baseline=undefined;this.target=[0,0];this.wake();};
  private visibility=()=>{this.baseline=undefined;if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}else this.recalibrate();};
  settingsChanged=()=>{
    const blocked=this.reduced()||this.media.matches||this.low();this.root.classList.toggle('home-reduced',blocked);this.button.disabled=blocked;
    if(blocked){this.disableTilt();cancelAnimationFrame(this.frame);this.frame=0;this.current=[0,0];this.target=[0,0];this.draw();this.status.textContent='已减少动态效果';}
    else if(!this.tilt)this.status.textContent='';
  };
  setPaused(value:boolean){this.paused=value;if(value){cancelAnimationFrame(this.frame);this.frame=0;this.last=0;}else this.recalibrate();}
  private disableTilt(){this.tilt=false;this.baseline=undefined;clearTimeout(this.timeout);window.removeEventListener('deviceorientation',this.orientation);this.button.textContent='开启体感视差';this.button.setAttribute('aria-pressed','false');}
  async toggleTilt(){
    if(this.busy||this.blocked())return;
    if(this.tilt){this.disableTilt();this.status.textContent='已关闭体感视差';this.target=[0,0];this.wake();return;}
    const ctor=window.DeviceOrientationEvent as PermissionConstructor|undefined;
    if(!window.isSecureContext||!ctor){this.status.textContent='当前浏览器不支持体感，仍可正常浏览和游玩。';return;}
    this.busy=true;this.button.disabled=true;
    try{
      if(ctor.requestPermission&&await ctor.requestPermission()!=='granted'){if(!this.disposed)this.status.textContent='未开启体感，仍可正常浏览和游玩。';return;}
      if(this.disposed||this.blocked())return;
      this.tilt=true;this.baseline=undefined;window.addEventListener('deviceorientation',this.orientation);this.button.textContent='关闭体感视差';this.button.setAttribute('aria-pressed','true');this.status.textContent='请轻轻倾斜手机';
      this.timeout=window.setTimeout(()=>{if(this.disposed)return;this.disableTilt();this.status.textContent='未收到设备方向数据，仍可正常浏览和游玩。';},3000);
    }catch{if(!this.disposed)this.status.textContent='体感暂不可用，仍可正常浏览和游玩。';}
    finally{this.busy=false;if(!this.disposed)this.button.disabled=this.blocked();}
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.disableTilt();this.root.removeEventListener('pointermove',this.pointer);this.root.removeEventListener('pointerleave',this.center);this.root.removeEventListener('pointerover',this.highlight);this.root.removeEventListener('focusin',this.highlight);this.root.removeEventListener('pointerout',this.unhighlight);this.root.removeEventListener('focusout',this.unhighlight);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('orientationchange',this.recalibrate);window.removeEventListener('resize',this.recalibrate);this.media.removeEventListener('change',this.settingsChanged);}
}
