import { LEVELS } from '../data/map';
import type { Progress } from '../domain/types';
import { unlockedCount } from '../services/progress';
import { icon } from './icons';

export const landmarkCaptions=['轨楼共生','沿坡而上','跨江凌空','五层寻路'];
export function collection(progress:Progress,current:string[]=[]){
  const ids=new Set([...progress.discoveries,...current]);
  return {known:ids,total:LEVELS.reduce((sum,l)=>sum+l.discoveries.length,0),count:LEVELS.flatMap(l=>l.discoveries).filter(d=>ids.has(d.id)).length};
}
export function homeMarkup(progress:Progress):string{
  const {known,total,count}=collection(progress),last=LEVELS.find(l=>l.id===progress.lastLevel)??LEVELS[0],saved=progress.completed.length>0||progress.tutorialSeen;
  const pins=LEVELS.map((l,i)=>'<button class="cover-pin pin-'+i+'" data-action="pin:'+l.id+'" data-landmark="'+l.id+'"><i></i><span>0'+l.number+' '+l.name+'</span><small> · '+landmarkCaptions[i]+'</small></button>').join('');
  const cards=LEVELS.map((l,i)=>{
    const locked=i>=unlockedCount(progress),done=progress.completed.includes(l.id),active=l.id===last.id;
    return '<li><button id="station-'+l.id+'" class="stage-step '+(active?'is-active ':'')+(locked?'is-locked':'')+'" data-landmark="'+l.id+'" data-action="level:'+l.id+'" '+(locked?'disabled':'')+(active?' aria-current="step"':'')+'><span class="step-heading"><span>0'+l.number+'</span>'+icon(done?'check':locked?'lock':'arrow')+'</span><strong>'+l.name+'</strong><span>已记录 '+l.discoveries.filter(d=>known.has(d.id)).length+'/'+l.discoveries.length+' 处发现</span><small>'+(locked?'完成上一站后开启':active&&saved?'上次游玩 · '+(done?'已抵达':'可出发'):done?'已抵达':'可出发')+'</small></button></li>';
  }).join('');
  return '<main class="cover"><div class="cover-lines" aria-hidden="true"></div><div class="cover-meta"><span>CHONGQING · 29°33′N 106°33′E</span><span>山城漫游手册 / VOL. 03</span></div><section class="cover-copy"><p class="eyebrow">一座山城，四次赴约</p><h1>山城<span>赴约<i>。</i></span></h1><p class="cover-intro">路有高低，生活有温度。<br>亲自走一段山城路，找到你的抵达方式。</p><div class="cover-actions"><button class="button primary" data-action="start">开启山城旅程 '+icon('arrow')+'</button><button class="button text-button" data-action="levels"'+(saved?' aria-describedby="continue-summary"':'')+'>'+(progress.completed.length?'继续旅程':'选择目的地')+'</button></div>'+(saved?'<p id="continue-summary" class="continue-summary">上次游玩：第 '+last.number+' 站 · '+last.name+'<span>已存入行记 '+count+'/'+total+' 处发现 · 选择站点后从起点出发</span></p>':'')+'<div class="cover-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 · 手机摇杆移动</span><span>'+icon('leaf')+' 100 点体力 · 不限时</span></div></section><figure class="cover-visual"><div class="cover-poster"><div class="cover-media"><div class="cover-fallback"><span>一座山城，层层相遇</span><div>'+LEVELS.map((l,i)=>'<span>'+icon(['rail','escalator','cable','layers'][i])+'<strong>'+l.name+'</strong></span>').join('')+'</div></div><div class="cover-picture"></div><div class="cover-pins" aria-label="地标预览">'+pins+'</div></div></div><figcaption>重庆地标主题插画 · 游戏化拼景</figcaption><button class="inline-button tilt-entry" data-action="tilt">开启体感视差</button><span class="tilt-status" role="status"></span></figure><nav class="stage-stepper" aria-label="四站行程"><div class="stepper-heading"><span>四站行程</span><small>沿途发现可选，慢慢走也没关系。</small></div><ol>'+cards+'</ol></nav><footer class="cover-footer"><span>轻量城市探索 · 键盘与触摸</span><div><button data-action="about">关于作品与地标资料 '+icon('arrow')+'</button><span class="source-note">5 篇资料参考 · 重庆政府部门与华龙网</span></div><span>v0.8.0 · 立体山城探索</span></footer></main>';
}
