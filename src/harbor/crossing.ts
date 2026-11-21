type Point = { x: number; y: number };
type Ink = CanvasRenderingContext2D;

const marks: Point[] = [{x:306,y:294}, {x:581,y:204}, {x:822,y:140}];
const wood: Point[] = [{x:231,y:366}, {x:436,y:227}, {x:484,y:281}, {x:668,y:150}, {x:754,y:225}];
const captions = ['跟随亮灯，驶过铜铃航标', '穿过第二座航标的双灯', '驶近蓝旗磨坊的栈桥', '已靠泊。把磨坊的面粉装上船。'];

function polygon(g: Ink, c: string, ...p: number[]) {
  g.fillStyle=c;g.beginPath();g.moveTo(p[0],p[1]);
  for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);
  g.closePath();g.fill();
}
function oval(g: Ink,x:number,y:number,w:number,h:number,c:string){
  g.fillStyle=c;g.beginPath();g.ellipse(x,y,w,h,0,0,Math.PI*2);g.fill();
}
function stroke(g:Ink,c:string,w:number,...p:number[]) {
  g.beginPath();g.moveTo(p[0],p[1]);
  for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);
  g.lineWidth=w;g.strokeStyle=c;g.stroke();
}
function box(g:Ink,x:number,y:number,w:number,h:number,c:string){g.fillStyle=c;g.fillRect(x,y,w,h);}
function noise(i:number){const n=Math.sin(i*419.6+24.7)*7435.98;return n-Math.floor(n);}
function tag(g:Ink,x:number,y:number,text:string){
  g.fillStyle='#e8d4a3';g.strokeStyle='#546155';g.lineWidth=1;
  g.font='bold 14px system-ui, sans-serif';const w=g.measureText(text).width+19;
  polygon(g,'#334b46',x-w/2-2,y-13,x+w/2+2,y-13,x+w/2,y+7,x-w/2,y+7);
  g.fillStyle='#f2dfb3';g.textAlign='center';g.fillText(text,x,y+2);
}
function house(g:Ink,x:number,y:number,s:number,roof:string) {
  g.save();g.translate(x,y);g.scale(s,s);
  polygon(g,'#71776275',-21,-6,19,-9,33,6,-10,10);
  box(g,-19,-22,39,24,'#bd9c77');
  polygon(g,'#9c8267',13,-22,20,-24,20,1,13,2);
  polygon(g,roof,-25,-19,-11,-37,13,-37,25,-19);
  stroke(g,'#e1ba83',1.6,-25,-19,24,-19);
  box(g,-5,-14,7,16,'#52625b');box(g,6,-12,5,6,'#e5c391');
  g.restore();
}
function tree(g:Ink,x:number,y:number,s:number){
  oval(g,x+4,y+2,8*s,3*s,'#536c5655');
  box(g,x-s,y-11*s,2*s,12*s,'#776c52');
  for(let k=0;k<4;k++){
    polygon(g,k%2===0?'#456d62':'#5b8067',x-(8-k)*s,y-(6+k*3)*s,x,y-(19+k*3)*s,x+(8-k)*s,y-(6+k*3)*s);
  }
}
function pierDeck(g:Ink,x:number,y:number,angle:number,len:number) {
  g.save();g.translate(x,y);g.rotate(angle);
  box(g,2,-8,len,27,'#2b595773');box(g,0,-11,len,22,'#977b58');
  for(let i=0;i<len;i+=6){
    box(g,i,-10,1,21,'#705f49');box(g,i+1,-10,1,21,'#b69c75');
  }
  for(const xx of [0,len*.5,len]){
    for(const yy of [-11,11]){
      oval(g,xx,yy,2.8,2.8,'#4f5d50');oval(g,xx,yy-1,2.7,1.7,'#c3ad83');
    }
  }
  g.restore();
}
function shore(g:Ink){
  const gradient=g.createLinearGradient(0,0,215,540);
  gradient.addColorStop(0,'#a5bfa6');gradient.addColorStop(.35,'#85a99a');gradient.addColorStop(1,'#3f7776');
  g.fillStyle=gradient;g.fillRect(0,0,960,540);
  for(let i=0;i<1250;i++){
    const x=noise(i)*960,y=noise(i+9201)*540,w=2+noise(i+88)*15;
    stroke(g,i%3===0?'#f2e1b735':'#335b5e21',.8,x,y,x+w,y-.4);
  }
  // The gentle shoreline leaves the whole pilot channel open.
  polygon(g,'#b1bea07a',0,97,69,90,141,70,196,67,277,39,348,46,460,27,551,0,0,0);
  polygon(g,'#a6a689',0,85,77,77,145,58,195,55,278,32,350,36,450,20,534,0,0,0);
  polygon(g,'#8e9a7e',0,71,67,61,118,49,222,43,286,21,383,25,463,0,0,0);
  for(let i=0;i<27;i++) tree(g,i*16+5,32-noise(i+65)*18,.6+noise(i+73)*.4);
  polygon(g,'#a2b496',962,73,903,96,866,106,850,118,810,113,779,93,713,76,699,50,661,35,626,-2,962,-2);
  polygon(g,'#959b77',962,65,906,89,863,98,849,106,811,101,778,83,720,68,707,45,670,29,638,-2,962,-2);
  for(let i=0;i<16;i++)tree(g,707+i*16,31+noise(i+31)*23,1+noise(i+3)*.38);
  house(g,840,61,.8,'#7e6455');house(g,879,80,.65,'#68776b');
  // Mill housings, turning wheel and blue pennants above the destination.
  house(g,793,83,1.28,'#75594b');house(g,757,64,.76,'#617967');
  oval(g,812,89,9,10,'#745b43');oval(g,812,89,5.8,7,'#b69a6e');
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;stroke(g,'#795c42',1.45,812,89,812+Math.cos(a)*9,89+Math.sin(a)*9);
  }
  pierDeck(g,835,96,1.83,52);
  stroke(g,'#5b6454',2,850,104,850,65);polygon(g,'#4d8392',850,65,870,69,853,75);
  // The player's home quay, with warehouses along its sloping edge.
  polygon(g,'#abbea083',0,306,42,324,64,354,93,364,107,398,154,428,171,460,229,479,265,517,316,540,0,540);
  polygon(g,'#bfab82',0,317,38,336,54,362,85,373,94,404,146,437,157,470,220,490,244,520,281,540,0,540);
  polygon(g,'#96997a',0,349,33,365,47,390,59,397,82,428,109,448,125,476,193,510,205,540,0,540);
  for(let i=0;i<12;i++)tree(g,11+noise(i+25)*78,424+noise(i+68)*116,.7+noise(i+16)*.5);
  house(g,16,398,.95,'#916955');house(g,58,447,1.35,'#64756a');house(g,108,492,.82,'#986e54');
  pierDeck(g,77,398,-.8,46);
  // Tiny foreground tidal island gives a fixed landmark for judging the current.
  polygon(g,'#abc0a080',661,540,693,504,747,494,799,461,836,453,871,428,926,432,963,416,963,540);
  polygon(g,'#a2a47f',678,540,701,514,755,501,804,470,839,464,876,437,930,442,963,427,963,540);
  for(let i=0;i<16;i++)tree(g,790+noise(i+17)*180,488+noise(i+85)*55,.75+noise(i+87)*.8);
  tag(g,72,473,'雾 港');tag(g,875,126,'蓝 旗 磨 坊');
}

function buoy(g:Ink,x:number,y:number,active:boolean,passed:boolean,t:number) {
  const hue=passed?'#729b85':active?'#eab55e':'#b5a984';
  oval(g,x+2,y+2,8,3,'#4567635c');
  polygon(g,'#47635b',x-5,y,x-3.5,y-6,x+3.5,y-6,x+5,y);
  box(g,x-1.4,y-13,2.8,8,hue);
  if(active)oval(g,x,y-15,7+Math.sin(t*2)*1.4,7+Math.sin(t*2)*1.4,'#f5d68c42');
  oval(g,x,y-15,2.8,3,active?'#fff1b1':hue);
}

function boatArt(g:Ink,x:number,y:number,dir:number,speed:number,t:number) {
  g.save();g.translate(x,y);g.rotate(dir);
  if(speed>3){
    const stretch=Math.min(28,speed*.35);
    for(let i=0;i<3;i++){
      const r=(t*.85+i/3)%1;
      stroke(g,'#dfdfbc8a',1.35,-14-r*stretch,-3-7*r,-18-r*stretch,-4-8*r);
      stroke(g,'#dfdfbc8a',1.35,-14-r*stretch,3+7*r,-18-r*stretch,4+8*r);
    }
  }
  oval(g,1,3,19,9,'#2d545455');
  polygon(g,'#324f4d',-19,-6,-12,-9,8,-8,20,-2,22,0,9,8,-12,9,-19,6);
  polygon(g,'#d0ac76',-16,-5,-9,-7,8,-6,18,0,8,6,-10,7,-16,5);
  box(g,-13,-5,15,10,'#765940');box(g,-11,-4,10,8,'#e5c99a');
  box(g,-3,-5,5,10,'#536c62');box(g,-2,-3,3,6,'#ad7350');
  stroke(g,'#6f725d',1,9,-3,9,3);stroke(g,'#e9c991',1.2,12,-3,12,3);
  g.restore();
}

/** Mounts a self-contained morning trip; cargo is awarded only by the caller's finished action. */
export function startCrossing(host:HTMLElement, finished:()=>void, cancelled:()=>void):()=>void {
  const panel=document.createElement('section');
  panel.className='harbor-crossing';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','掌舵去对岸磨坊');
  panel.innerHTML=`
    <style>
      .harbor-crossing{position:absolute;inset:0;z-index:12;isolation:isolate;overflow:hidden;background:#507e76;color:#f5e9c9;container-type:inline-size;font:13px/1.35 system-ui,sans-serif}
      .harbor-crossing .cross-map{width:100%;height:100%;display:block;cursor:crosshair;touch-action:none;outline-offset:-3px}
      .cross-head,.cross-foot{position:absolute;left:10px;right:10px;display:flex;align-items:center;gap:7px;pointer-events:none}
      .cross-head{top:8px;justify-content:space-between}.cross-foot{bottom:8px;justify-content:space-between}
      .cross-log,.cross-help,.cross-head button,.cross-foot button{background:#253d35ed;border:1px solid #a6a68b;border-radius:5px;color:#f5e6bf;padding:6px 10px;box-shadow:0 2px 4px #334c4440}
      .cross-log{display:flex;gap:7px;align-items:center}.cross-log b{color:#ffda8c;white-space:nowrap;}
      .cross-help{font-size:12px;max-width:70%}.cross-compact{display:none}
      .cross-head button,.cross-foot button{pointer-events:auto;cursor:pointer;white-space:nowrap;font:inherit}
      .cross-foot [data-cross-load]{background:#e0bc7b;color:#253c33;font-weight:bold}
      @container(max-width:620px){.cross-head,.cross-foot{left:4px;right:4px;gap:3px}.cross-head{top:4px}.cross-foot{bottom:4px}.cross-log,.cross-help,.cross-head button,.cross-foot button{font-size:11px;padding:4px 6px}.cross-log{gap:3px}.cross-wide{display:none}.cross-compact{display:inline}}
    </style>
    <canvas class="cross-map" width="960" height="540" tabindex="0" aria-label="渡船航道。方向上加速、左右掌舵、向下减速，也可点击水面行船。"></canvas>
    <div class="cross-head"><div class="cross-log"><b data-cross-step>起航</b><span data-cross-status aria-live="polite"></span></div><button type="button" data-cross-cancel>返回港街</button></div>
    <div class="cross-foot"><span class="cross-help"><span class="cross-wide">↑ 加速 · ← → 掌舵 · ↓ 减速，也可点击水面航行</span><span class="cross-compact">点水面掌舵 · 穿过双灯</span></span><button type="button" data-cross-assist>请船长领航</button><button type="button" data-cross-load hidden>装上蓝线面粉</button></div>`;
  host.append(panel);
  const canvas=panel.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx=canvas.getContext('2d')!;
  const plate=document.createElement('canvas');plate.width=960;plate.height=540;
  const base=plate.getContext('2d')!;shore(base);
  const status=panel.querySelector<HTMLElement>('[data-cross-status]')!;
  const counter=panel.querySelector<HTMLElement>('[data-cross-step]')!;
  const assist=panel.querySelector<HTMLButtonElement>('[data-cross-assist]')!;
  const load=panel.querySelector<HTMLButtonElement>('[data-cross-load]')!;
  const cancel=panel.querySelector<HTMLButtonElement>('[data-cross-cancel]')!;
  const keys=new Set<string>();
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const aborter=new AbortController();const opts={signal:aborter.signal};
  const vessel={x:120,y:363,dir:-.42,speed:0};
  let leg=0,frame=0,assisted=false,closed=false,last=0,elapsed=0,lastBump=-8;
  let aim:Point|null=null;
  status.textContent=captions[0];
  canvas.focus({preventScroll:true});

  function clear(){
    if(closed)return;
    closed=true;cancelAnimationFrame(frame);aborter.abort();panel.remove();
  }
  function leave(){if(!closed){clear();cancelled();}}
  function boarded(){if(!closed&&leg===3){clear();finished();}}
  cancel.addEventListener('click',leave,opts);
  load.addEventListener('click',boarded,opts);
  assist.addEventListener('click',()=>{
    assisted=!assisted;aim=null;keys.clear();
    assist.textContent=assisted?'亲自掌舵':'请船长领航';
    status.textContent=assisted?'船长接过舵，顺水穿过航标。':captions[leg];
    canvas.focus({preventScroll:true});
  },opts);
  canvas.addEventListener('pointerdown',(ev)=>{
    if(assisted||leg===3)return;
    const r=canvas.getBoundingClientRect();
    aim={x:Math.min(923,Math.max(44,(ev.clientX-r.left)/r.width*960)),
      y:Math.min(488,Math.max(80,(ev.clientY-r.top)/r.height*540))};
    canvas.focus({preventScroll:true});
  },opts);
  const helmKeys=['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'];
  window.addEventListener('keydown',(ev)=>{
    if(ev.altKey||ev.metaKey||ev.ctrlKey||ev.isComposing)return;
    const k=ev.key.toLowerCase();
    if(k==='escape'){ev.preventDefault();ev.stopImmediatePropagation();leave();return;}
    if(!helmKeys.includes(k))return;
    ev.preventDefault();ev.stopImmediatePropagation();
    if(leg<3&&!assisted){keys.add(k);aim=null;}
  },{capture:true,signal:aborter.signal});
  window.addEventListener('keyup',(ev)=>{
    const k=ev.key.toLowerCase();
    if(!helmKeys.includes(k))return;
    keys.delete(k);ev.stopImmediatePropagation();
  },{capture:true,signal:aborter.signal});
  window.addEventListener('blur',()=>keys.clear(),opts);

  function advance(){
    leg++;status.textContent=captions[leg];counter.textContent=['起航','一号灯','二号灯','靠泊'][leg];
    if(leg===3){
      vessel.x=marks[2].x;vessel.y=marks[2].y;vessel.dir=-1.2;vessel.speed=0;
      assisted=false;aim=null;keys.clear();assist.hidden=true;load.hidden=false;load.focus({preventScroll:true});
    }
  }
  function move(dt:number){
    if(leg===3)return;
    const target=assisted?marks[leg]:aim;
    if(target){
      const dx=target.x-vessel.x,dy=target.y-vessel.y,distance=Math.hypot(dx,dy);
      const desired=Math.atan2(dy,dx);
      const delta=Math.atan2(Math.sin(desired-vessel.dir),Math.cos(desired-vessel.dir));
      const rudder=dt*(assisted?6.5:2.65);
      vessel.dir+=Math.max(-rudder,Math.min(rudder,delta));
      const cruise=assisted?162:35;
      vessel.speed=Math.min(cruise,vessel.speed+dt*(assisted?210:27));
      if(!assisted){vessel.speed=Math.min(vessel.speed,distance*1.4);if(distance<4){aim=null;vessel.speed=0;}}
    }else{
      const left=keys.has('arrowleft')||keys.has('a'),right=keys.has('arrowright')||keys.has('d');
      const throttle=keys.has('arrowup')||keys.has('w'),brake=keys.has('arrowdown')||keys.has('s');
      vessel.dir+=(Number(right)-Number(left))*2.1*dt;
      vessel.speed=Math.min(36,Math.max(0,vessel.speed+dt*(brake?-59:throttle?24:-7)));
    }
    vessel.x+=Math.cos(vessel.dir)*vessel.speed*dt;
    vessel.y+=Math.sin(vessel.dir)*vessel.speed*dt;
    if(!assisted)for(const log of wood){
      const dx=vessel.x-log.x,dy=vessel.y-log.y;
      const d=Math.hypot(dx,dy);
      if(d<19&&elapsed-lastBump>.9){
        const push=Math.max(5,21-d);
        vessel.x+=d>.1?dx/d*push:0;vessel.y+=d>.1?dy/d*push:push;
        vessel.speed*=.56;lastBump=elapsed;status.textContent='碰到浮木了，转舵就能继续。';
      }
    }
    vessel.x=Math.max(45,Math.min(926,vessel.x));
    // Keep a continuous navigable channel between the two soft banks.
    const top=81+Math.max(0,vessel.x-687)*.2;
    const lower=Math.min(497,299+vessel.x*.77)-Math.max(0,vessel.x-713)*.34;
    vessel.y=Math.max(top,Math.min(lower,vessel.y));
    const next=marks[leg];
    if(Math.hypot(vessel.x-next.x,vessel.y-next.y)<(leg===2?25:31)) advance();
    else if(elapsed-lastBump>2.6&&status.textContent?.startsWith('碰到'))status.textContent=captions[leg];
  }
  function paint(){
    const g=ctx,t=media.matches?0:elapsed;
    g.drawImage(plate,0,0);
    // A magazine-print navigation chart. Only the next pair of lamps flashes.
    for(let i=0;i<wood.length;i++){
      const p=wood[i];g.save();g.translate(p.x,p.y+Math.sin(t*.9+i)*1.25);g.rotate(-.2+i*.22);
      oval(g,1,3,16,4,'#476c6188');polygon(g,'#806844',-15,-3,13,-4,17,0,12,3,-16,2);
      stroke(g,'#c4a274',1.5,-13,-1,10,-2);stroke(g,'#8b7750',2,-2,0,3,-7,7,-9);g.restore();
    }
    for(let i=0;i<2;i++){
      const p=marks[i];
      g.save();g.setLineDash([4,4]);
      stroke(g,i===leg?'#ffdf91ab':'#d1d3ac70',1.5,p.x-9,p.y-30,p.x+9,p.y+30);g.restore();
      buoy(g,p.x-9,p.y-30,i===leg,i<leg,t);buoy(g,p.x+9,p.y+30,i===leg,i<leg,t+.4);
    }
    if(leg<3){
      const m=marks[leg];
      g.save();g.strokeStyle='#f6d588';g.lineWidth=2;g.setLineDash([3,5]);
      g.beginPath();g.ellipse(m.x,m.y,22+Math.sin(t)*1.6,12,0,0,Math.PI*2);g.stroke();g.restore();
    }
    if(aim&&!assisted&&leg<3){
      g.strokeStyle='#f5e7ba';g.lineWidth=1.4;g.beginPath();g.ellipse(aim.x,aim.y,6,3.5,0,0,Math.PI*2);g.stroke();
    }
    boatArt(g,vessel.x,vessel.y,vessel.dir,vessel.speed,t);
    if(leg===3){
      for(let i=0;i<3;i++){
        const x=844+i*7,y=137-(i%2)*5;
        oval(g,x,y,5,6,'#dfcda2');stroke(g,'#51869b',1.7,x-3,y,x+3,y-2);
      }
    }
  }
  function tick(now:number){
    if(closed)return;
    const dt=last?Math.min(.08,Math.max(0,(now-last)/1000)):0;
    last=now;elapsed+=dt;move(dt);paint();
    if(leg!==3)frame=requestAnimationFrame(tick);
  }
  paint();frame=requestAnimationFrame(tick);
  return clear;
}
