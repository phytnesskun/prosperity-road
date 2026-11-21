const bakeryStyle = `
.harbor-bakery { position:absolute; inset:0; z-index:8; container-type:inline-size; overflow:hidden; color:#fff0ca; background:#432c26; touch-action:manipulation; }
.harbor-bakery canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.harbor-bakery .bakery-caption { position:absolute; inset:0 0 auto; padding:1.6% 2.5% 4%; background:linear-gradient(#211814db,#281c185e 64%,transparent); pointer-events:none; }
.harbor-bakery h2 { margin:0; font:700 clamp(18px,3.2cqw,34px)/1.2 var(--serif,serif); letter-spacing:.08em; color:#fff4ce; }
.harbor-bakery .bakery-help { margin:.4em 0 0; font-size:clamp(11px,1.5cqw,16px); color:#ffe7be; text-shadow:0 1px 3px #291d17; }
.harbor-bakery .bakery-loaf { position:absolute; width:17.5%; height:23%; top:55%; transform:translateX(-50%); border:0; border-radius:48%; background:transparent; cursor:crosshair; touch-action:none; color:transparent; }
.harbor-bakery .bakery-loaf:hover,.harbor-bakery .bakery-loaf:focus-visible { outline:2px dashed #fcdfad; outline-offset:1px; background:#ffe5a40a; }
.harbor-bakery .bakery-foot { position:absolute; inset:auto 0 0; display:flex; align-items:center; justify-content:space-between; gap:6px; padding:1.3% 2.3%; background:linear-gradient(transparent,#241912e8 34%); }
.harbor-bakery .bakery-status { min-width:0; font:600 clamp(11px,1.6cqw,17px)/1.3 var(--serif,serif); }
.harbor-bakery .bakery-tools { display:flex; align-items:center; gap:clamp(3px,.8cqw,10px); }
.harbor-bakery .bakery-tools button { margin:0; white-space:nowrap; line-height:1.15; font:600 clamp(11px,1.55cqw,16px) system-ui,sans-serif; border:1px solid #d1ab78; padding:clamp(5px,.8cqw,10px) clamp(6px,1.3cqw,15px); border-radius:5px; color:#ffeece; background:#3e352beb; cursor:pointer; }
.harbor-bakery .bakery-tools [data-bake-take] { background:#f0c788; border-color:#ffe1ac; color:#3b2a21; }
@container (max-width:460px) { .harbor-bakery .bakery-help { margin-top:.15em; } .harbor-bakery .bakery-foot { padding:1.6% 2%; } }
`;

const loafCenters = [288, 480, 672];

function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawOven(ctx: CanvasRenderingContext2D, morning: boolean) {
  ctx.fillStyle = morning ? '#755747' : '#5e423a';
  ctx.fillRect(0, 0, 960, 540);
  const shades = morning ? ['#aa7960','#bd8d6f','#9d705b','#b58364'] : ['#875b4c','#a16d53','#865848','#93634e'];
  for (let row = 0; row < 9; row++) {
    for (let col = -1; col < 11; col++) {
      const x = col * 103 + (row % 2) * 51;
      const y = row * 41;
      ctx.fillStyle = shades[(col + row * 3 + 9) % 4];
      ctx.fillRect(x + 2, y + 2, 99, 37);
      ctx.fillStyle = '#efbf8b30';
      ctx.fillRect(x + 5, y + 3, 92, 3);
      ctx.fillStyle = '#3f262230';
      ctx.fillRect(x + 7 + (row * 11) % 20, y + 28, 29, 2);
    }
  }
  const cx = 480, cy = 330;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(1,.79);
  const flameGlow = ctx.createRadialGradient(0,35,15,0,0,358);
  flameGlow.addColorStop(0,'#c65a28');
  flameGlow.addColorStop(.52,'#79402c');
  flameGlow.addColorStop(1,'#211e20');
  fillEllipse(ctx,0,0,357,354,flameGlow);
  ctx.save();
  ctx.beginPath(); ctx.arc(0,0,347,0,Math.PI*2); ctx.clip();
  ctx.strokeStyle='#261d1c55'; ctx.lineWidth=3;
  for(let row=0;row<6;row++) {
    const top=-285+row*47;
    ctx.beginPath();ctx.moveTo(-360,top);ctx.lineTo(360,top);ctx.stroke();
    for(let x=-346+(row%2)*48;x<350;x+=96) {
      ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x-3,top+47);ctx.stroke();
    }
  }
  ctx.restore();
  for (let i = 0; i < 17; i++) {
    const a = Math.PI + Math.PI*i/17 + .004, b = a + Math.PI/17 - .009;
    ctx.fillStyle = ['#af7559','#bc8868','#a56d55','#b97d5e'][i%4];
    ctx.beginPath();
    ctx.arc(0,0,411,a,b);
    ctx.arc(0,0,350,b,a,true);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,403,a+.006,b-.006); ctx.strokeStyle = '#e3ac7d99'; ctx.lineWidth=3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,353,a,b); ctx.strokeStyle='#4e342ea6'; ctx.lineWidth=5; ctx.stroke();
  }
  ctx.restore();
}

function drawFlames(ctx: CanvasRenderingContext2D, t: number, heat: number) {
  for (let bank=0; bank<2; bank++) {
    const anchor = bank === 0 ? 207 : 643;
    for (let i=0; i<9; i++) {
      const x=anchor+i*14;
      const sway=Math.sin(t*3+i*2.8)*6;
      const h=38+20*Math.sin(i*2.6+bank)+10*Math.sin(t*2.7+i)+heat*23;
      ctx.fillStyle=['#d3652d','#e98b44','#ffb654'][i%3];
      ctx.beginPath(); ctx.moveTo(x-12,318);
      ctx.quadraticCurveTo(x-16,293,x+sway,318-h);
      ctx.quadraticCurveTo(x+9,303-h*.3,x+13,318);
      ctx.closePath(); ctx.fill();
      fillEllipse(ctx,x,315,7,5,'#ffcd72');
    }
    for(let n=0;n<7;n++){
      const lift=(t*18+n*13)%95;
      const emberX=anchor+(n*29)%110+Math.sin(lift*.04+n)*5;
      ctx.globalAlpha=(1-lift/95)*.85;
      fillEllipse(ctx,emberX,280-lift,1.5,2.5,'#ffbc65');
    }
    ctx.globalAlpha=1;
  }
}

function drawBench(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#704934'; ctx.fillRect(0,329,960,211);
  for(let row=0;row<6;row++){
    const y=332+row*40;
    ctx.fillStyle=['#9d6f48','#b17c50','#9f6b47'][row%3];
    ctx.fillRect(0,y,960,38);
    for(let i=0;i<17;i++){
      const x=(i*133+row*63)%960;
      ctx.fillStyle='#4c362839'; ctx.fillRect(x,y+5+(i*11)%29,22+(i*17)%73,2);
    }
  }
  // A peel jutting out onto the worktop holds three loaves from the batch.
  ctx.fillStyle='#563b2c'; ctx.fillRect(406,415,148,125);
  ctx.fillStyle='#b38454'; ctx.fillRect(417,415,126,125);
  fillEllipse(ctx,480,411,376,46,'#422e2566');
  ctx.fillStyle='#674633';
  ctx.beginPath(); ctx.moveTo(192,299); ctx.lineTo(768,299); ctx.lineTo(837,425); ctx.quadraticCurveTo(840,444,814,447);
  ctx.lineTo(146,447); ctx.quadraticCurveTo(120,443,125,426); ctx.closePath(); ctx.fill();
  const wood=ctx.createLinearGradient(0,290,20,438);
  wood.addColorStop(0,'#cfa36a');wood.addColorStop(1,'#b08553');
  ctx.fillStyle=wood;
  ctx.beginPath(); ctx.moveTo(192,294); ctx.lineTo(768,294); ctx.lineTo(827,423); ctx.quadraticCurveTo(833,436,810,437);
  ctx.lineTo(149,437); ctx.quadraticCurveTo(131,436,135,423); ctx.closePath(); ctx.fill();
  for(let i=0;i<70;i++){
    const x=182+(i*89)%589, y=309+(i*31)%117;
    ctx.fillStyle=i%4===0?'#fff1c799':'#b47e4f88';
    ctx.fillRect(x,y,i%4===0?3:8,2);
  }
}

function drawLoaf(ctx: CanvasRenderingContext2D, x:number, cuts:number, heat:number, i:number) {
  ctx.save();
  ctx.translate(x,362);
  ctx.rotate((i-1)*.11-.09);
  const puff=1+.09*heat;
  ctx.scale(puff,puff);
  fillEllipse(ctx,2,11,85,36,'#815a3a88');
  const crust = ctx.createLinearGradient(0,-54,19,39);
  crust.addColorStop(0,`hsl(${43-8*heat} 84% ${87-19*heat}%)`);
  crust.addColorStop(.52,`hsl(${36-6*heat} 67% ${72-21*heat}%)`);
  crust.addColorStop(1,`hsl(${29-7*heat} 52% ${48-14*heat}%)`);
  ctx.fillStyle=crust;
  ctx.beginPath(); ctx.moveTo(-83,3); ctx.bezierCurveTo(-87,-30,-58,-53,-11,-55);
  ctx.bezierCurveTo(47,-63,84,-34,84,0); ctx.bezierCurveTo(82,26,57,38,7,39);
  ctx.bezierCurveTo(-49,41,-80,30,-83,3); ctx.fill();
  for(let n=0;n<31;n++){
    const angle=n*2.4+i, radius=Math.sqrt((n+.5)/31);
    const px=Math.cos(angle)*radius*69, py=Math.sin(angle)*radius*36-8;
    fillEllipse(ctx,px,py,1+(n%3),.8,'#fff1c36e');
  }
  for(let n=0;n<cuts;n++) {
    const sx=(n-1)*32;
    ctx.fillStyle='#835835'; ctx.beginPath(); ctx.moveTo(sx+7,-42);
    ctx.quadraticCurveTo(sx-28,-8,sx-5,12); ctx.quadraticCurveTo(sx-10,-13,sx+7,-42); ctx.fill();
    ctx.strokeStyle='#ffe4a2'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(sx+8,-41); ctx.quadraticCurveTo(sx-8,-12,sx-4,8); ctx.stroke();
  }
  ctx.restore();
}

/** Mount the oven over a positioned street scene. Disposal only dismantles the view. */
export function startBakery(host: HTMLElement, morning: boolean, finished:(crisp:boolean)=>void, cancelled:()=>void):()=>void {
  const previous=document.activeElement instanceof HTMLElement ? document.activeElement:null;
  const stage=document.createElement('section');
  stage.className='harbor-bakery';
  stage.setAttribute('aria-label', '工坊烤炉');
  stage.innerHTML=`<style>${bakeryStyle}</style><canvas width="960" height="540" aria-hidden="true"></canvas>
  <header class="bakery-caption"><h2>${morning?'新炉的第一盘':'阿诚的砖炉'}</h2><p class="bakery-help">在面团上点划留纹；看着炉色，随时接盘。</p></header>
  ${loafCenters.map((x,i)=>`<button type="button" class="bakery-loaf" data-loaf="${i}" style="left:${x/9.6}%" aria-label="给第${i+1}只面团划纹"></button>`).join('')}
  <div class="bakery-foot"><span class="bakery-status" aria-live="polite"></span><div class="bakery-tools"><button type="button" data-bake-heat>添柴</button><button type="button" data-bake-take>接盘出炉</button><button type="button" data-bake-cancel>离炉</button></div></div>`;
  host.append(stage);
  const canvas=stage.querySelector('canvas')!;
  const ctx=canvas.getContext('2d')!;
  const status=stage.querySelector<HTMLElement>('.bakery-status')!;
  const loaves=Array.from(stage.querySelectorAll<HTMLButtonElement>('[data-loaf]'));
  const cuts=[0,0,0];
  let live=true, frame=0, heat=.08, clock=0, last=performance.now(), lastPaint=-1;
  let drag:number|null=null;
  const marked=new Set<number>();
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;

  const repaint=()=>{
    drawOven(ctx,morning); drawFlames(ctx,still?0:clock,heat); drawBench(ctx);
    loafCenters.forEach((x,i)=>drawLoaf(ctx,x,cuts[i],heat,i));
    const label=heat>=.7?'麦香浓 · 金脆':heat>=.38?'表皮开始上色':'热气初升 · 松软';
    if(status.textContent!==label) status.textContent=label;
  };
  const tick=(now:number)=>{
    const dt=document.hidden?0:Math.max(0,Math.min((now-last)/1000,.15));
    last=now; clock+=dt;
    heat=Math.min(1,heat+dt*.072);
    if(clock-lastPaint>=(still?.22:.065)){ repaint(); lastPaint=clock; }
    if(live) frame=requestAnimationFrame(tick);
  };
  const cut=(i:number)=>{
    if(cuts[i]>=3) return;
    cuts[i]++;
    loaves[i].setAttribute('aria-label',`第${i+1}只面团已划${cuts[i]}道纹`);
    repaint();
  };
  const cleanup=()=>{
    if(!live) return;
    live=false; cancelAnimationFrame(frame);
    const restore=stage.contains(document.activeElement);
    stage.remove();
    if(restore && previous?.isConnected) previous.focus({preventScroll:true});
  };
  const finish=()=>{ if(live){cleanup(); finished(heat>=.7);} };
  const cancel=()=>{ if(live){cleanup(); cancelled();} };
  // Touch and mouse strokes can score several rolls in a single sweep.
  const markAt=(x:number,y:number)=>{
    const roll=document.elementFromPoint(x,y)?.closest<HTMLButtonElement>('[data-loaf]');
    if(!roll || !stage.contains(roll)) return;
    const i=Number(roll.dataset.loaf);
    if(!marked.has(i)){ marked.add(i); cut(i); }
  };
  loaves.forEach((roll,i)=>{
    roll.onpointerdown=e=>{
      if(e.button!==0 || drag!==null) return;
      drag=e.pointerId; marked.clear(); roll.setPointerCapture(e.pointerId);
      marked.add(i); cut(i);
    };
    roll.onpointermove=e=>{ if(e.pointerId===drag) markAt(e.clientX,e.clientY); };
    roll.onlostpointercapture=()=>{drag=null;};
    roll.onclick=e=>{ if(e.detail===0) cut(i); };
  });
  stage.querySelector<HTMLButtonElement>('[data-bake-heat]')!.onclick=()=>{heat=Math.min(1,heat+.23);repaint();};
  stage.querySelector<HTMLButtonElement>('[data-bake-take]')!.onclick=finish;
  stage.querySelector<HTMLButtonElement>('[data-bake-cancel]')!.onclick=cancel;
  stage.onkeydown=e=>{
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();
    const i=loaves.indexOf(document.activeElement as HTMLButtonElement);
    if(e.key==='Escape'){e.preventDefault();cancel();}
    else if(e.key.toLowerCase()==='e'){e.preventDefault();if(!e.repeat) finish();}
    else if(i>=0 && (e.key==='ArrowLeft'||e.key==='ArrowRight')){
      e.preventDefault(); loaves[(i+(e.key==='ArrowRight'?1:2))%3].focus();
    }
  };
  stage.addEventListener('keyup', e=>e.stopPropagation());
  repaint(); frame=requestAnimationFrame(tick);
  loaves[0].focus({preventScroll:true});
  return cleanup;
}
