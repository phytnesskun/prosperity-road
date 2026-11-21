/** The street is painted in a 960 × 540 coordinate system. Time values are seconds. */
export interface HarborView {
  x: number;
  y: number;
  time: number;
  morning: boolean;
  boat: boolean;
  oven: boolean;
  shipArrived: boolean;
  crowd: number;
  stock: number;
  facing: number;
  moving: boolean;
  event: 'bell' | 'bread' | 'oven' | 'cash' | 'horn' | null;
  eventAge: number;
  reducedMotion: boolean;
}

type Ctx = CanvasRenderingContext2D;
const ink = '#293a3a';
const cream = '#f4daad';
const brass = '#c89154';
const wood = '#815741';
const deep = '#344949';

function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function shape(g: Ctx, color: string, ...points: number[]) {
  g.beginPath();
  g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

function line(g: Ctx, color: string, width: number, ...points: number[]) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.stroke();
}

function oval(g: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
}

function glow(g: Ctx, x: number, y: number, r: number, inner: string, outer = 'rgba(255,202,104,0)') {
  const light = g.createRadialGradient(x, y, 0, x, y, r);
  light.addColorStop(0, inner);
  light.addColorStop(1, outer);
  g.fillStyle = light;
  g.fillRect(x-r, y-r, r*2, r*2);
}

function noise(i: number) {
  const v = Math.sin(i * 127.1 + 47.7) * 43758.5453;
  return v - Math.floor(v);
}

function sky(g: Ctx, morning: boolean) {
  const wash = g.createLinearGradient(0, 0, 184, 253);
  wash.addColorStop(0, morning ? '#89c0ba' : '#476971');
  wash.addColorStop(.48, morning ? '#d4d5b3' : '#9dada0');
  wash.addColorStop(1, morning ? '#fae3b7' : '#ecc296');
  g.fillStyle = wash; g.fillRect(0, 0, 960, 250);
  const sunX = morning ? 124 : 213;
  glow(g, sunX, 86, 119, morning ? '#ffe5ab99' : '#f2c79b91');
  oval(g, sunX, 86, 29, 29, morning ? '#ffe7ae' : '#f3d2a5');
  for (let i = 0; i < 37; i++) {
    const y = 18 + noise(i + 24)*142;
    const x = noise(i)*980;
    shape(g, '#f5e1bc32', x-5, y+2, x+16,y-1, x+31,y-1, x+42,y-3,
      x+58+noise(i+2)*45,y-1, x+73,y+1, x+39,y+2);
  }
  shape(g, morning ? '#a5b9a2' : '#8fa49a', 0,165,36,149,60,148,89,130,109,129,145,105,
    154,102,170,116,195,108,231,135,277,112,305,138,337,118,375,142,454,112,
    525,134,558,111,619,142,690,129,745,143,818,123,890,145,960,134,960,210,0,210);
  shape(g, morning ? '#89a898' : '#778f88', 0,157,43,140,69,141,93,159,129,151,178,165,
    213,147,246,155,276,136,297,139,325,128,359,139,412,151,455,135,502,147,565,137,
    605,151,668,134,730,158,788,145,845,153,909,141,960,151,960,204,0,204);
  const far = morning ? '#71988e' : '#687f7b';
  for (let i=0;i<42;i++) {
    const x = i*24-5, y = 166 - noise(i+44)*14;
    rect(g,x,y,21,25,far);
    shape(g,far,x-2,y,x+9,y-7,x+23,y);
    if (i%4===1) rect(g,x+15,y-11,4,12,far);
  }
  rect(g,56,132,7,36,far);
  shape(g,far,51,134,59,122,67,134);
  line(g,far,2,59,122,59,114);
  const sea = g.createLinearGradient(0,180,0,341);
  sea.addColorStop(0,morning ? '#93b3a3' : '#8faaa0');
  sea.addColorStop(.29,morning ? '#7aa79b' : '#7c9d94');
  sea.addColorStop(1,morning ? '#557d79' : '#526f70');
  g.fillStyle=sea; g.fillRect(0,178,960,169);
  for(let i=0;i<240;i++){
    const x=noise(i+12)*962, y=180+noise(i+212)*153;
    const w = 3+noise(i+391)*(y-167)*.35;
    rect(g,x,y,w,noise(i+278)*1.6+.4,i%3===0 ? '#e5d6b35f' : '#3b68694a');
  }
  for(let i=0;i<60;i++){
    const y=179+i*1.65;
    const x=sunX+(noise(i+363)-.5)*(10+i*.95);
    rect(g,x,y,2+noise(i+469)*18,1.2,'#f6ddb37c');
  }
  // The old stone bridge loses its middle span out over the inlet.
  const masonry=morning?'#709288':'#647e79';
  for(let i=0;i<4;i++) {
    const x=226+i*39;
    g.fillStyle=masonry; g.beginPath(); g.moveTo(x,171); g.lineTo(x+39,169);
    g.lineTo(x+39,193); g.lineTo(x+34,193);
    g.bezierCurveTo(x+33,172,x+10,173,x+8,195); g.lineTo(x,196); g.closePath(); g.fill();
    line(g,'#b3b39a',2,x-1,170,x+39,168);
    rect(g,x+1,164,2,6,masonry);
  }
  // Far beacon, framing the water even before the ferry comes in.
  shape(g,'#8c8670',10,181,15,143,22,143,26,181);
  rect(g,14,139,10,5,far);
  rect(g,15,134,8,5,'#e8ca82');
  shape(g,far,12,134,19,127,26,134);
}

function windowPane(g: Ctx,x:number,y:number,w:number,h:number,lit:boolean) {
  rect(g,x-3,y-3,w+6,h+7,'#524c40');
  rect(g,x,y,w,h,lit?'#edc58a':'#698984');
  shape(g,lit?'#bf9669':'#516c69',x,y,x+w,y,x+w,y+h*.3,x,y+h*.72);
  rect(g,x+w*.48,y,2,h,'#5b5749');
  rect(g,x,y+h*.52,w,2,'#625c4b');
  rect(g,x-4,y+h+2,w+8,3,'#b19778');
}

function roof(g:Ctx,x:number,y:number,w:number,h:number,slate:string,lip:string){
  shape(g,ink,x-11,y+h+4,x+9,y-3,x+w-7,y-3,x+w+11,y+h+4);
  shape(g,slate,x-9,y+h,x+10,y,x+w-8,y,x+w+9,y+h);
  for(let k=1;k<6;k++){
    const yy=y+k*h/6, start=x+10-(k*3), end=x+w-9+k*3;
    line(g,'#d0c8a329',1,start,yy,end,yy);
    for(let xx=start+8+(k%2)*9;xx<end-2;xx+=18)
      line(g,'#213a3c50',1,xx,yy+1,xx-2,yy+h/6-1);
  }
  rect(g,x-11,y+h,w+22,5,lip);
  rect(g,x-10,y+h+5,w+20,4,'#293d3d');
}

function awning(g:Ctx,x:number,y:number,w:number,red:string,pale:string){
  const count=Math.max(4,Math.round(w/12));
  for(let i=0;i<count;i++){
    const a=x+i*w/count,b=x+(i+1)*w/count;
    const c=i%2===0?red:pale;
    shape(g,c,a+5,y,b+5,y,b+2,y+14,a+1,y+14);
    shape(g,c,a+1,y+14,b+2,y+14,b+2,y+20,(a+b)/2+1,y+23,a+1,y+20);
  }
  line(g,'#382e2766',2,x+2,y+14,x+w+1,y+14);
  line(g,'#e4c295',2,x+4,y,x+w+7,y);
}

function basket(g:Ctx,x:number,y:number,s:number,filled:boolean){
  g.save(); g.translate(x,y); g.scale(s,s);
  if(filled) for(let i=0;i<4;i++) loaf(g,-8+i*5,-4-(i%2)*2,.38);
  shape(g,'#78583c',-13,-5,13,-5,10,6,-9,6);
  line(g,'#d1ab71',2,-13,-5,13,-5); line(g,'#b68c57',1,-10,0,11,0);
  g.restore();
}

function sack(g:Ctx,x:number,y:number,s:number,c:string){
  g.save(); g.translate(x,y); g.scale(s,s);
  oval(g,0,1,12,3,'#544c3f7a');
  shape(g,c,-7,-23,-2,-20,4,-20,8,-24,5,-16,11,-7,10,-2,6,1,-9,0,-12,-4,-10,-12,-5,-17);
  line(g,'#886f52',1.5,-5,-17,5,-17); line(g,'#a6936e',1,-7,-3,-8,-9,-5,-13);
  g.restore();
}

function oven(g:Ctx,x:number,y:number,s:number,lit:boolean) {
  g.save();g.translate(x,y);g.scale(s,s);
  oval(g,0,3,33,6,'#37443c55');
  rect(g,-24,-49,13,36,'#775846');rect(g,-27,-52,19,5,'#ad8464');
  g.fillStyle='#8c5e47';g.beginPath();g.arc(0,-6,30,Math.PI,0);g.lineTo(30,0);g.lineTo(-30,0);g.fill();
  for(let i=0;i<4;i++) line(g,'#c1996d',1,-18+i*11,-26, -15+i*10,-22);
  rect(g,-31,-7,62,10,'#6c5144');
  g.fillStyle=lit?'#ffd584':ink;
  g.beginPath();g.arc(0,-5,15,Math.PI,0);g.lineTo(15,0);g.lineTo(-15,0);g.fill();
  if(lit) {
    shape(g,'#eb8443',-12,-2,-8,-9,-7,-6,-3,-14,0,-8,4,-12,6,-7,10,-10,12,-2);
    glow(g,0,-7,31,'#ffb65348');
  }
  line(g,'#d8a873',4,-29,0,30,0);
  g.restore();
}

function buildings(g:Ctx,morning:boolean){
  // Behind the shopfronts: warehouse silhouettes and the tapered tile tower.
  rect(g,439,130,536,148,'#7b8370');
  for(let i=0;i<6;i++){
    const x=451+i*88, y=106+noise(i)*26;
    shape(g,'#667d71',x-10,142,x+9,y,x+60,y-2,x+89,142);
    rect(g,x+19,y-18,7,23,'#6f7b6b');
    for(let w=0;w<4;w++) rect(g,x+9+w*16,149,7,18,'#526d66');
  }
  rect(g,700,63,37,97,'#937f66');
  rect(g,696,78,44,4,'#657067');
  rect(g,706,55,25,12,'#927c63');
  shape(g,'#536a65',692,62,707,48,717,19,721,18,729,48,743,62);
  line(g,ink,1.4,719,18,719,7);
  for(let j=0;j<2;j++)windowPane(g,705+j*15,82,8,17,false);
  // Steep-roofed bakery with a lit bakehouse on the street side.
  rect(g,328,192,216,139,'#ac8463');
  shape(g,'#cfac80',328,191,444,173,464,325,328,330);
  rect(g,332,218,13,108,'#6e6755');
  for(let i=0;i<54;i++){
    const x=338+noise(i+21)*195,y=211+noise(i+131)*112;
    rect(g,x,y,4+noise(i+82)*7,1.4,'#805f4b4a');
  }
  rect(g,352,128,16,46,'#94765d'); rect(g,349,125,22,5,'#6f6555');
  roof(g,320,155,221,52,'#4f6864','#b59a73');
  windowPane(g,351,223,29,29,!morning);
  windowPane(g,397,218,27,31,!morning);
  windowPane(g,497,218,25,30,false);
  // Dormer, plank doors and an ornamental hanging wheat sign.
  shape(g,'#b69a72',389,168,413,145,434,168,434,192,389,192);
  shape(g,deep,383,169,413,139,440,169,433,169,413,149,394,170);
  windowPane(g,405,161,16,24,!morning);
  rect(g,355,268,35,61,'#4a5750');rect(g,359,275,25,45,'#59695b');
  for(let i=0;i<4;i++)rect(g,360+i*6,276,1,43,'#3f544d');
  oval(g,378,302,1.8,1.8,brass);
  rect(g,397,268,94,53,'#57483b');
  awning(g,394,253,103,'#a8664c','#dcc296');
  rect(g,394,309,103,11,'#b1855e');
  for(let k=0;k<4;k++) basket(g,407+k*23,304,.81,true);
  oven(g,491,335,.86,true);
  line(g,deep,3,352,234,329,234,329,239);line(g,deep,1,330,233,343,242);
  line(g,deep,1.4,329,236,329,244);
  oval(g,329,252,11,12,'#795b3d');oval(g,329,251,9,10,'#d1aa6d');
  line(g,'#715c38',1.4,326,257,332,244);
  for(let i=0;i<3;i++)line(g,'#715c38',1.2,327+i,254-i*3,325+i,250-i*3);
  // Flour merchant, ochre stucco and a bottle-green awning.
  rect(g,550,176,175,155,'#c2a37b');
  rect(g,683,176,44,155,'#af8d67');
  rect(g,577,103,18,41,'#a17e64');rect(g,574,101,23,5,'#796855');
  roof(g,544,127,179,50,'#7b6b5d','#ccac81');
  for(let k=0;k<3;k++) {
    const x=563+k*53;
    windowPane(g,x,196,25,34,k===0&&!morning);
    rect(g,x-8,197,5,32,'#5b786b');rect(g,x+29,197,5,32,'#668173');
  }
  rect(g,557,248,156,4,'#977d5e');
  rect(g,563,269,140,54,'#3a514b');
  rect(g,584,273,42,38,'#656c55');
  sack(g,571,319,.91,'#c3a77a');sack(g,580,322,.77,'#d2bc91');
  sack(g,678,322,1.15,'#c1ac7d');sack(g,692,327,.94,'#d9c59b');
  awning(g,556,251,148,'#476d60','#c5ba90');
  rect(g,603,310,61,10,'#856c4f');
  rect(g,607,320,5,11,wood);rect(g,654,320,5,11,wood);
  sack(g,615,307,.62,'#d5bd8d'); sack(g,643,308,.72,'#c4b084');
  // Corner market. Tall dormers and crooked green shutters define its silhouette.
  rect(g,732,161,231,172,'#bb896b');
  rect(g,881,158,84,180,'#a77960');
  rect(g,732,240,229,8,'#9d785e');
  rect(g,871,74,18,41,'#715f54');rect(g,867,72,25,6,'#ad8d6f');
  roof(g,727,113,239,54,'#4c6260','#c79c76');
  for(let i=0;i<2;i++){
    const x=755+i*114;
    shape(g,'#c89c77',x,129,x+14,115,x+29,129,x+29,144,x,144);
    shape(g,deep,x-4,130,x+14,110,x+34,130,x+30,131,x+14,117,x,132);
    windowPane(g,x+9,126,12,15,false);
  }
  for(let i=0;i<4;i++){
    const x=750+i*56;
    windowPane(g,x,187,22,32,!morning&&i%2===0);
    rect(g,x-8,188,5,31,deep); rect(g,x+26,188,5,31,deep);
    if(i%2===1){rect(g,x-2,218,28,5,'#775b43');for(let j=0;j<7;j++)oval(g,x+1+j*3.4,216+(j%2)*2,3,3,'#71836a');}
  }
  rect(g,739,267,212,60,'#455a4f');
  rect(g,849,270,23,65,'#334b46'); windowPane(g,852,275,14,22,!morning);
  awning(g,737,251,104,'#ac6050','#d6b88c');
  awning(g,880,252,70,'#a26350','#dac195');
  rect(g,741,310,96,12,'#765843');
  rect(g,747,322,5,11,wood);rect(g,825,322,5,11,wood);
  for(let j=0;j<5;j++)basket(g,750+j*18,308,.69,true);
  rect(g,890,305,56,17,'#977457');
  // Shutters, posted notices and hand-painted emblems make each stop distinct.
  for(const x of [343,531,547,724,735,949]) {
    rect(g,x,211,3,114,'#665e464c');
    rect(g,x+3,212,1,113,'#dfbe8a55');
  }
  for(const [x,y] of [[340,278],[533,264],[711,281],[873,253]]) {
    rect(g,x,y,8,12,'#c8af81');
    rect(g,x+1,y+1,5,3,'#966d50');
    line(g,'#a48c63',.7,x+2,y+6,x+6,y+6);
    line(g,'#a48c63',.7,x+2,y+8,x+5,y+8);
  }
  shape(g,'#504a3540',556,273,703,273,692,289,564,286);
  rect(g,622,234,24,14,'#987850'); rect(g,624,235,20,11,'#ae9265');
  for(let i=0;i<3;i++){
    const x=628+i*5;
    line(g,'#f0d29a',1.2,x,245,x+4,237);
    line(g,'#f0d29a',1.2,x+2,241,x,238);
  }
  rect(g,741,320,96,3,'#c49365');
  for(let i=0;i<3;i++){
    const x=743+i*31;
    rect(g,x,322,29,8,'#98734d');
    line(g,'#c69f6d',1,x+2,323,x+26,329);
  }
  shape(g,'#36463e38',733,333,841,333,851,350,751,346);
  // Paving by the shops, and an irregular edge for the quay.
  line(g,'#756f5b',5,325,332,533,333,697,334,960,338);
}

function paving(g:Ctx,morning:boolean){
  const road=g.createLinearGradient(0,324,35,540);
  road.addColorStop(0,morning?'#bca987':'#ab997f');
  road.addColorStop(.36,morning?'#d6bc91':'#c7ad8d');
  road.addColorStop(1,morning?'#9a9980':'#8c8b78');
  g.fillStyle=road;g.beginPath();g.moveTo(0,353);g.lineTo(249,314);
  g.lineTo(415,324);g.lineTo(960,328);g.lineTo(960,540);g.lineTo(0,540);g.fill();
  for(let i=0;i<12;i++) {
    const x=noise(i+22)*968, y=361+noise(i+87)*118, size=13+noise(i+35)*43;
    const fill=morning?'#b9c7ad41':'#a7bbb155';
    shape(g,fill,x-size,y,x-size*.43,y-2,x-size*.28,y-3.6,x+size*.45,y-3,
      x+size,y-1,x+size*.3,y,x+size*.19,y+1.3,x-size*.6,y+1.7);
    line(g,'#e7d6b360',.85,x-size*.31,y-.7,x+size*.17,y-.7);
  }
  shape(g,'#b29a7960',0,433,405,352,694,340,960,337,960,350,550,372,0,490);
  // Broken courses of cobblestone follow the perspective of the street.
  for(let row=0;row<18;row++){
    const t=row/17, y=332+t*t*210, step=11+31*t;
    for(let j=-1;j<960/step+1;j++){
      const id=(j+2)*53+row*79;
      const x=j*step+(row%2)*step*.5;
      const yy=y+Math.sin(x/280)*6-8*(x/960);
      if (yy<Math.max(333,354-x*.15)||noise(id)<.44)continue;
      const w=step*(.48+.23*noise(id+7)),h=1.2+3*t;
      shape(g,noise(id+3)>.52?'#786e5e41':'#e5d4b454',
        x,yy,x+w*.26,yy-h*.55,x+w,yy-h*.39,x+w*.85,yy+h*.38,x+w*.17,yy+h*.34);
    }
  }
  // Along the very front of the street an old iron tram rail catches the light.
  line(g,'#706d5a88',3.6,-10,516,180,494,393,485,607,485,970,497);
  line(g,'#ead0a285',1.1,-10,514,180,492,393,483,607,483,970,495);
  line(g,'#706d5a70',2.8,-10,532,180,508,393,498,607,498,970,512);
  for(let i=0;i<15;i++){
    const x=i*71-8,y=485+((x-486)/460)**2*18;
    line(g,'#686a5b6c',2,x,y+3,x+2,y+12);
  }
}

function bollard(g:Ctx,x:number,y:number,s:number){
  oval(g,x+1,y+1,7*s,2.3*s,'#444b4666');
  shape(g,'#5a6054',x-3*s,y,x-2*s,y-10*s,x-4*s,y-12*s,x+4*s,y-12*s,x+3*s,y-9*s,x+3*s,y);
  rect(g,x-4*s,y-12*s,8*s,2*s,'#bdac85');
}

function pier(g:Ctx){
  shape(g,'#626757',0,332,212,304,307,317,0,356);
  shape(g,'#98896f',0,324,205,299,311,312,0,350);
  for(let i=0;i<20;i++){
    const x=i*15-4,y=324-x*.12;
    line(g,'#5d625344',1,x,y,x+25,y+15);
  }
  line(g,'#d1bc92',2,0,350,310,313);
  for(let i=0;i<6;i++)bollard(g,9+i*48,331-i*5.8,.9);
  for(const x of [24,168,262]){
    const y=332-x*.12;
    rect(g,x-4,y-17,7,20,'#665d48');oval(g,x-.5,y-17,4,1.8,'#c1ac81');
    line(g,'#baaa81',1.5,x-5,y-10,x+4,y-10);
  }
}

function loaf(g:Ctx,x:number,y:number,s:number){
  g.save();g.translate(x,y);g.rotate(-.22);g.scale(s,s);
  oval(g,0,1,10,5,'#98643f');oval(g,0,-1,10,4.8,'#e1aa61');
  line(g,'#f6ce87',1.7,-5,-3,-3,0);line(g,'#f6ce87',1.7,0,-4,2,-1);line(g,'#f6ce87',1.5,5,-3,6,-1);
  g.restore();
}

function wheel(g:Ctx,x:number,y:number,r:number,spin:number){
  oval(g,x,y,r+1,r+1,ink);oval(g,x,y,r-1.2,r-1.2,'#b3976b');oval(g,x,y,r-3,r-3,'#53605a');
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+spin;
    line(g,'#c4a475',1.3,x,y,x+Math.cos(a)*(r-2),y+Math.sin(a)*(r-2));
  }
  oval(g,x,y,2.5,2.5,'#d5b47f');
}

function lamp(g:Ctx,x:number,y:number,s:number,lit:boolean){
  g.save();g.translate(x,y);g.scale(s,s);
  oval(g,1,1,8,3,'#41483e50');
  rect(g,-5,-4,10,4,ink);rect(g,-3.2,-15,6.4,12,'#495547');
  rect(g,-1.7,-86,3.4,73,'#4c594c');
  line(g,ink,2,-6,-83,6,-83);
  shape(g,ink,-7,-98,7,-98,5,-84,-5,-84);
  shape(g,lit?'#ffdb8d':'#c4c9a6',-5,-96,5,-96,3,-86,-3,-86);
  rect(g,-.8,-97,1.6,12,'#897c57');
  shape(g,ink,-9,-98,-4,-101,0,-106,4,-101,9,-98);
  if(lit)glow(g,0,-91,29,'#f9c97555');
  g.restore();
}

function ferry(g:Ctx,t:number,welcomed:boolean){
  const bob=Math.sin(t*.86)*1.1;
  g.save();g.translate(0,bob);
  oval(g,128,294,102,6,'#2f575950');
  line(g,'#ded2ad6b',2,16,300,57,298,93,301,156,298,204,298);
  line(g,'#ded2ad55',1,29,304,75,304,105,302);
  // A two-deck river steamer, iron hull picked out with a warm boot stripe.
  shape(g,'#354b49',18,269,41,277,184,277,234,257,224,276,201,290,177,294,70,294,43,287);
  shape(g,'#9b5e49',48,283,91,287,177,287,218,275,202,288,176,294,71,294);
  line(g,'#e4bd82',2,19,269,43,276,183,276,234,257);
  line(g,'#7e8c79',2,50,280,151,281,181,280);
  for(let i=0;i<7;i++)oval(g,76+i*17,283,2,2,'#c8aa70');
  rect(g,65,247,105,26,'#d3bd91'); rect(g,72,226,70,21,'#c9b38c');
  for(let i=0;i<6;i++)windowPane(g,70+i*16,252,8,9,true);
  for(let i=0;i<4;i++)rect(g,77+i*15,230,9,11,'#4c6861');
  oval(g,156,261,4.5,4.5,'#ae6550');oval(g,156,261,2.3,2.3,'#d1b88b');
  line(g,cream,1.5,153,258,154,259);line(g,cream,1.5,158,263,159,264);
  for(let i=0;i<10;i++)line(g,'#79694f',.9,50+i*8,272,50+i*8,267);
  line(g,'#d6bf92',1.5,48,266,129,266);
  rect(g,61,244,114,4,'#53685c');rect(g,68,222,79,4,'#69776a');
  shape(g,'#916b54',102,220,100,188,114,188,116,220);
  rect(g,100,186,15,6,ink);rect(g,102,196,12,6,'#c2a372');
  line(g,ink,2,170,253,170,159);line(g,'#9e8d71',1.1,170,165,221,263);
  line(g,'#806f56',1.1,170,175,139,246);
  shape(g,welcomed?'#dcaa61':'#a8644d',171,160,192,162+Math.sin(t)*2,184,167,171,165);
  for(let i=0;i<4;i++)line(g,ink,1.3,185+i*10,270-i*3,185+i*10,263-i*3);
  line(g,ink,1.3,184,263,219,253);
  g.restore();
}

const coats=['#a56450','#56756b','#9c7954','#677c83','#b0925c','#8c6456'];
const scarves=['#d5b676','#d6af8e','#a76049','#d6b076','#79615b','#b6be9d'];
const skins=['#d6a87e','#bd896a','#e0b38b','#b88966','#cc9774','#e3b58c'];

function person(g:Ctx,x:number,y:number,who:number,s:number,walk:number,dir:number,worker=false){
  g.save();g.translate(x,y);g.scale(s*(dir<0?-1:1),s);
  oval(g,0,1,7.7,2.2,'#384a4447');
  const step=Math.sin(walk)*2.5;
  line(g,ink,3.6,-2,-9,-2-step,0);line(g,'#46534d',3.5,2,-9,2+step,-.2);
  line(g,'#483e35',2,-2-step,.2,.3-step,.2);line(g,'#483e35',2,2+step,0,5+step,0);
  const v=who%6;
  shape(g,coats[v],-3,-25,3,-25,5,-22,6,-9,1,-8,-5,-9,-5,-20);
  if(worker)shape(g,'#c6b491',-2,-24,1,-23,3,-12,-4,-12,-3,-20);
  rect(g,-2,-27,4,4,skins[v]);
  shape(g,scarves[v],-3,-25,3,-25,4,-23,1,-23,-1,-18,-3,-19,-1,-23);
  line(g,coats[v],3.4,2,-21,3.5+step*.45,-14,4+step,-13);
  oval(g,4+step,-13,1.6,1.7,skins[v]);
  shape(g,skins[v],-4,-33,2,-35,4,-33,4,-30,5.4,-29,4,-28,3,-25,-1,-25,-3,-27);
  shape(g,'#675449',-4,-33,1,-35,3,-34,1,-31,-1,-32,-2,-28,-4,-29);
  if(v===0||v===4){
    shape(g,scarves[v],-6,-34,-3,-38,2,-37,4,-34,1,-33,-4,-32,-5,-28,-7,-29);
  }else{
    shape(g,who%2===0?deep:'#756554',-6,-33,-4,-36,1,-37,4,-35,4,-34,7,-33,6,-32,-5,-32);
  }
  g.restore();
}

function cart(g:Ctx,v:HarborView,t:number){
  const spin=v.moving?t*6:0;
  const bounce=v.moving?Math.sin(t*11)*.6:0;
  const dir=v.facing<0?-1:1;
  person(g,v.x-34*dir,v.y-1,0,1.18,v.moving?t*9:0,dir);
  g.save();g.translate(v.x,v.y+bounce);g.scale(dir,1);
  oval(g,1,1,35,6,'#3f483e62');
  line(g,'#7b573d',3,-41,-18,-22,-17);
  line(g,'#d7b77e',4,-37,-19,-22,-18);
  wheel(g,-12,-4,10,spin);wheel(g,18,-5,9,spin);
  shape(g,'#435e52',-25,-28,28,-28,26,-9,-21,-8);
  rect(g,-24,-24,50,3,'#92916c');
  rect(g,-19,-19,39,7,'#bc915e');
  shape(g,'#ede1ab',-4,-16,0,-18,4,-17,5,-15,2,-14,-4,-14);
  rect(g,-28,-30,60,4,'#674c37');rect(g,-28,-31,60,2,'#e3bf80');
  rect(g,-22,-53,2.8,22,'#84623f');rect(g,23,-53,2.8,22,'#84623f');
  const loaves=Math.min(9,Math.max(0,v.stock));
  for(let i=0;i<loaves;i++)loaf(g,-14+(i%5)*7.3,-32-Math.floor(i/5)*4,.54);
  shape(g,'#9c5642',-31,-49,-21,-59,20,-59,32,-50,30,-47,-30,-46);
  for(let i=0;i<5;i++){
    const a=-21+i*8.2,b=-31+i*12.4;
    shape(g,i%2===0?'#e7c390':'#b36b52',a,-59,a+8.3,-59,b+12.4,-50,b,-50);
    shape(g,i%2===0?'#f5d39f':'#bd7358',b,-50,b+12.4,-50,b+12.4,-47,b+6,-44,b,-47);
  }
  line(g,'#78573f',2,-23,-59,22,-59);
  line(g,brass,1.3,29,-47,29,-41);
  shape(g,'#efc171',25,-38,26,-40,27,-43,30,-43,31,-40,33,-38);
  oval(g,29,-37.5,1.1,1,'#dcaa5c');
  g.restore();
}

function barrel(g:Ctx,x:number,y:number,s:number){
  g.save();g.translate(x,y);g.scale(s,s);
  oval(g,0,0,12,3,'#43504451');
  shape(g,'#8c694b',-9,-20,-10,-5,-8,0,8,0,10,-4,9,-21);
  oval(g,0,-21,9.3,2.5,'#b6976e');
  for(const yy of [-16,-5])line(g,'#596257',2,-9,yy,0,yy+1,9,yy);
  line(g,'#bf9870',1,-4,-18,-5,-7);
  g.restore();
}

function bunting(g:Ctx,x:number,y:number,endX:number,endY:number,sag:number){
  g.beginPath();g.moveTo(x,y);g.quadraticCurveTo((x+endX)/2,(y+endY)/2+sag*2,endX,endY);
  g.strokeStyle='#756e58';g.lineWidth=1.3;g.stroke();
  const colors=['#bd7b5c','#dbc08c','#678b7f','#c79866'];
  for(let i=1;i<12;i++){
    const u=i/12, px=x+(endX-x)*u, py=y+(endY-y)*u+4*sag*u*(1-u);
    shape(g,colors[i%4],px-4,py,px+4,py+.8,px+.6,py+7+(i%3));
  }
}

function foreground(g:Ctx,morning:boolean){
  // Only the margins overlap the walkable area.
  barrel(g,22,449,1.18);barrel(g,37,443,.87); basket(g,9,453,1.04,false);
  lamp(g,57,431,1.12,!morning);
  barrel(g,938,451,1.14);barrel(g,953,444,1.02);
  const leaves=morning?['#516f59','#637c60','#849474']:['#425e54','#566e59','#788168'];
  for(const [x,y] of [[3,474],[944,486],[969,470],[-12,464]]){
    shape(g,'#8c654e',x-11,y-15,x+11,y-15,x+8,y,x-7,y);
    rect(g,x-12,y-16,25,4,'#ac8466');
    for(let i=0;i<15;i++){
      const yy=y-18-noise(i+17)*29,xx=x+(noise(i+2)-.5)*45;
      line(g,leaves[0],1.4,x,y-16,xx,yy);oval(g,xx,yy,3.3,2.5,leaves[i%3]);
    }
  }
}

function painterlyStreet(g:Ctx,morning:boolean) {
  sky(g,morning);
  // A moored fishing skiff and its drying nets, behind the passenger berth.
  shape(g,'#667b72',5,235,37,237,54,232,47,239,19,241);
  line(g,'#747c68',1.5,34,235,34,181);
  shape(g,'#c2b698',32,185,32,227,14,227);
  // Dock crane: cable and bracing are separate so the harbour reads at thumbnail size.
  line(g,'#51685e',3,268,306,268,204,225,177);
  line(g,'#6c7c69',4,279,306,273,199,225,177);
  line(g,'#78836e',2,224,177,267,183,273,200);
  line(g,'#4b6057',1,226,178,226,224);
  line(g,'#4c6158',2,226,223,226,228,222,230,219,227);
  for(let y=219;y<297;y+=15)line(g,'#6c7662',1.4,268,y,275,y+13);
  rect(g,258,298,31,7,'#6a6c58');
  paving(g,morning);pier(g);buildings(g,morning);
  barrel(g,285,330,.9);barrel(g,302,327,.74);
  sack(g,317,331,.7,'#beaa87');
  for(let i=0;i<3;i++){
    g.strokeStyle=i===1?'#c0a175':'#7d7056';g.lineWidth=1.3;g.beginPath();
    g.ellipse(82,322,9-i*2,2.8-i*.55,-.1,0,Math.PI*2);g.stroke();
  }
  line(g,'#a38d67',1.3,82,321,93,320,98,314);
  lamp(g,301,337,.78,!morning);lamp(g,712,342,.82,!morning);
  bunting(g,284,195,411,210,13);
  bunting(g,520,216,719,192,20);
  bunting(g,716,192,959,204,22);
  // A light grain breaks up the broad washes. This whole plate is cached.
  for(let i=0;i<6100;i++) {
    const x=noise(i+620)*960,y=noise(i+7822)*540;
    rect(g,x,y,noise(i+7380)*1.9+.45,.85,i%3===0?'#fff3cd14':'#28332d0e');
  }
}

function gull(g:Ctx,x:number,y:number,s:number,t:number) {
  const beat=Math.sin(t*2)*1.6;
  line(g,'#556d68',1.1*s,x-6*s,y-2*s+beat*s,x-3*s,y-1*s,x,y+1*s,
    x+3*s,y-1.7*s,x+7*s,y-2*s+beat*s);
}

function smoke(g:Ctx,x:number,y:number,t:number,scale:number){
  for(let i=0;i<5;i++){
    const phase=(t*.17+i*.21)%1;
    const xx=x+(phase*19+Math.sin(phase*5)*4)*scale, yy=y-phase*37*scale;
    g.globalAlpha=(1-phase)*.22;
    oval(g,xx,yy,(2.2+phase*7)*scale,(1.6+phase*3.4)*scale,'#f4e2c5');
  }
  g.globalAlpha=1;
}

function reactions(g:Ctx,v:HarborView){
  if(!v.event||v.eventAge<0||v.eventAge>1.35)return;
  const p=v.reducedMotion?.38:Math.min(1,v.eventAge/1.35);
  g.save();g.globalAlpha=1-p;
  if(v.event==='bell'||v.event==='horn'){
    const x=v.event==='horn'?107:v.x+(v.facing<0?-30:30);
    const y=v.event==='horn'?180:v.y-43;
    for(let i=0;i<2;i++){
      const rad=5+i*5+p*17;
      g.beginPath();g.arc(x,y,rad,-1.2,-.28);
      g.strokeStyle='#fff1b0';g.lineWidth=2;g.stroke();
      g.beginPath();g.arc(x,y,rad,Math.PI+.28,Math.PI+1.2);g.stroke();
    }
  }else if(v.event==='bread'){
    loaf(g,v.x+18*p,v.y-54-p*29,.83);
  }else if(v.event==='cash'){
    for(let i=0;i<3;i++){
      const x=v.x+8+i*7+p*(i-1)*15,y=v.y-44-Math.sin(p*Math.PI)*23-i*4;
      oval(g,x,y,3.8,4.7,'#a5733f');oval(g,x-.3,y-.5,2.8,3.4,'#ecc376');
    }
  }else{
    for(let i=0;i<6;i++)oval(g,v.x+(i-2)*4+p*(i-2)*5,v.y-43-p*(22+i*2),1.8,1.8,'#ffe39b');
  }
  g.restore();
}

let eveningPlate:HTMLCanvasElement|undefined;
let morningPlate:HTMLCanvasElement|undefined;

function paintedPlate(g:Ctx,morning:boolean){
  const cached=morning?morningPlate:eveningPlate;
  if(cached){g.drawImage(cached,0,0,960,540);return;}
  const plate=document.createElement('canvas');
  // Supersample the still illustration once, including its fine brickwork.
  plate.width=1440;plate.height=810;
  const layer=plate.getContext('2d');
  if(!layer){painterlyStreet(g,morning);return;}
  layer.scale(1.5,1.5);painterlyStreet(layer,morning);
  if(morning)morningPlate=plate;else eveningPlate=plate;
  g.drawImage(plate,0,0,960,540);
}

/** Uses the caller's coordinate transform, preserving it for labels and input. */
export function drawHarbor(g:Ctx,view:HarborView):void {
  g.save();
  g.lineCap='round';g.lineJoin='round';
  const t=view.reducedMotion?0:Math.max(0,view.time);
  paintedPlate(g,view.morning);
  if(view.shipArrived||view.boat){
    const shift=view.event==='horn'&&!view.reducedMotion?Math.max(0,1-view.eventAge/2.4)**2*145:0;
    g.save();g.translate(-shift,0);ferry(g,t,view.boat);
    smoke(g,107,184,t,1.08);
    if(view.boat){
      shape(g,'#b59a72',206,284,211,286,184,315,178,314);
      line(g,'#8e7154',1.7,212,282,181,312);
    }
    g.restore();
  }
  for(let i=0;i<3;i++){
    const xx=155+i*21+Math.sin(t*.1+i)*11;
    gull(g,xx,91+i%2*9+Math.sin(t*.4+i)*1.4,.83-i*.08,t*.9+i);
  }
  smoke(g,360,126,t*.74,.85);
  if(!view.morning) {
    for(let i=0;i<26;i++){
      const xx=(noise(i+418)*1032-t*(25+(i%3)*3))%1032;
      const yy=(noise(i+80)*600+t*(62+i%4*3))%600-25;
      line(g,'#e6e8dc39',.8,xx<0?xx+1032:xx,yy,(xx<0?xx+1032:xx)-1.8,yy+4.1);
    }
  }
  if(view.oven) {
    wheel(g,444,350,5,0);wheel(g,470,350,5,0);
    oven(g,457,346,.76,true);smoke(g,442,305,t,.65);
  }
  person(g,441,347,2,1,0,1,true);
  person(g,630,345,4,.97,0,-1);
  person(g,814,363,1,1.05,0,-1);
  if(view.shipArrived||view.boat)person(g,157,323,3,.9,0,1);
  // More people join the queue after the bell. Their walk cycles ease into place.
  const n=Math.max(0,Math.min(7,Math.round(view.crowd)));
  const join=view.event==='bell'&&!view.reducedMotion?Math.max(0,1-view.eventAge/1.7):0;
  const sprites:{y:number;paint:()=>void}[]=[];
  for(let i=0;i<n;i++){
    const y=369+i*6+(i%2)*1.8;
    const x=788+Math.sin(i*1.9)*12-i*4+join*(29+i*4);
    sprites.push({y,paint:()=>person(g,x,y,i+2,1.01+i*.012,join>0?t*9:0,-1)});
  }
  if(view.morning&&view.boat) {
    sprites.push({y:352,paint:()=>person(g,128,352,1,1,0,1,true)});
    barrel(g,174,342,.8);sack(g,188,343,.84,'#d5bd90');
  }
  if(view.morning&&view.oven) {
    sprites.push({y:359,paint:()=>person(g,473,359,5,1,0,-1,true)});
    basket(g,488,354,.8,true);
  }
  sprites.push({y:view.y,paint:()=>cart(g,view,t)});
  for(const sprite of sprites.sort((a,b)=>a.y-b.y))sprite.paint();
  foreground(g,view.morning);
  reactions(g,view);
  g.restore();
}
