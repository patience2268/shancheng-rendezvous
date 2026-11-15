/** The veil lives outside #app so replacing a page cannot remove its cover. */
export class PageTransition {
  busy=false;
  private veil=document.createElement('div');
  constructor(private root:HTMLElement){
    this.veil.className='page-transition';this.veil.hidden=true;this.veil.setAttribute('role','status');this.veil.setAttribute('aria-live','polite');document.body.append(this.veil);
  }
  async run(title:string,task:()=>void|Promise<void>,reduced:boolean,onStart:()=>void,onEnd:()=>void):Promise<void>{
    if(this.busy)return;this.busy=true;onStart();this.root.inert=true;
    this.veil.replaceChildren();const stamp=document.createElement('span'),text=document.createElement('strong'),note=document.createElement('small');
    stamp.textContent='山 / 城 / 行 / 记';text.textContent=title;note.textContent='沿着高差，走向下一段风景';this.veil.append(stamp,text,note);this.veil.hidden=false;
    try{
      await this.veil.animate([{opacity:0},{opacity:1}],{duration:reduced?0:160,easing:'ease-out',fill:'forwards'}).finished;
      await task();
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      await this.veil.animate([{opacity:1},{opacity:0}],{duration:reduced?0:180,easing:'ease-in',fill:'forwards'}).finished;
    }finally{
      this.veil.hidden=true;this.veil.getAnimations().forEach(a=>a.cancel());this.root.inert=false;this.busy=false;onEnd();
      const focus=this.root.querySelector<HTMLElement>('.dialog button,main h1');if(focus){if(focus.tagName==='H1')focus.tabIndex=-1;focus.focus({preventScroll:true});}
    }
  }
}
