export interface RiceView {
  bank: 'west' | 'east';
  month: 1 | 2;
  stock: number;
  cargo: number;
  price: number;
  time: number;
  event?: 'buy' | 'sell' | 'month' | 'arrive';
  eventAge?: number;
  reducedMotion?: boolean;
  stallName?: string;
}

type Pen = CanvasRenderingContext2D;
const timber = '#644d3e';
const deep = '#364842';
const paper = '#f2e2b8';
const type = '"Songti SC", "STSong", "SimSun", Georgia, serif';

function box(g: Pen, x: number, y: number, w: number, h: number, color: string | CanvasGradient) {
  g.fillStyle = color; g.fillRect(x,y,w,h);
}
function poly(g: Pen, color: string, ...p: number[]) {
  g.beginPath(); g.moveTo(p[0],p[1]);
  for (let i=2;i<p.length;i+=2) g.lineTo(p[i],p[i+1]);
  g.closePath(); g.fillStyle=color; g.fill();
}
function line(g: Pen, color: string, width: number, ...p: number[]) {
  g.beginPath(); g.moveTo(p[0],p[1]);
  for (let i=2;i<p.length;i+=2) g.lineTo(p[i],p[i+1]);
  g.strokeStyle=color; g.lineWidth=width; g.stroke();
}
function oval(g: Pen, x: number, y: number, rx: number, ry: number, color: string, angle=0) {
  g.fillStyle=color; g.beginPath(); g.ellipse(x,y,rx,ry,angle,0,Math.PI*2); g.fill();
}
function textAt(g:Pen, s:string, x:number, y:number, px:number, ink:string, max?:number) {
  g.fillStyle=ink; g.font=`bold ${px}px ${type}`; g.textAlign='center'; g.textBaseline='middle';
  if(max) g.fillText(s,x,y,max); else g.fillText(s,x,y);
}
function random(i:number) { const v=Math.sin(i*126.4+52.3)*27777.7; return v-Math.floor(v); }
function skyAndRiver(g:Pen,east:boolean,month:number) {
  const spring=month===2;
  const sky=g.createLinearGradient(0,0,0,226);
  sky.addColorStop(0,spring?'#82adb0':east?'#99aaa5':'#839f9c'); sky.addColorStop(.7,spring?'#e4d7b8':'#edd4ab'); sky.addColorStop(1,'#f0d8ad');
  box(g,0,0,960,243,sky); const sun=east?318:146;
  const glow=g.createRadialGradient(sun,90,7,sun,90,84); glow.addColorStop(0,'#ffe6a885'); glow.addColorStop(1,'#ffe6a800'); box(g,sun-84,6,168,168,glow);
  oval(g,sun,90,21,21,'#ffe7b1');
  for(let i=0;i<35;i++){const x=random(i)*870,y=10+random(i+64)*108;poly(g,'#f4e9c744',x-9,y+7,x+5,y+5,x+18,y+4,x+30,y+2,x+52,y+6,x+74,y+7);}
  poly(g,'#a6b4a2',0,152,24,142,52,151,96,123,124,130,168,96,187,91,211,112,225,103,281,136,316,113,351,123,404,93,424,107,458,96,519,142,576,119,620,139,730,127,960,106,960,213,0,213);
  poly(g,'#8ca294',0,169,35,153,70,162,121,144,149,152,188,130,223,151,247,139,302,172,340,150,359,158,395,146,429,161,475,151,586,142,960,149,960,215,0,215);
  for(let i=0;i<28;i++){
    const x=i*19+(east?8:0),h=8+random(i+84)*13,y=186-h,w=12+random(i+25)*10;
    box(g,x,y,w,h,'#91a695'); poly(g,'#728e83',x-3,y,x+3,y-4,x+w-4,y-4,x+w+2,y);
  }
  if(east){
    box(g,71,108,15,65,'#a7af98'); poly(g,'#69847a',68,108,78,94,90,108);
    box(g,75,113,5,9,'#748e82');box(g,73,139,11,2,'#d4ccb0');
  }else{
    for(let i=0;i<5;i++){box(g,228+i*34,164,3,21,'#718b80');} line(g,'#68857a',3,216,164,378,164);
  }
  box(g,0,184,960,7,'#879c8d');
  const water=g.createLinearGradient(0,188,34,390);water.addColorStop(0,'#b4ba9f');water.addColorStop(.35,'#729c91');water.addColorStop(1,'#477c79');box(g,0,191,960,256,water);
  for(let i=0;i<170;i++) {
    const y=193+random(i+136)*219,x=random(i+39)*960;
    line(g,i%3?'#bcd1b055':'#4d827d66',1+random(i+44),x,y,x+6+(y-190)*random(i+119)*.22,y);
  }
  for(let i=0;i<24;i++){const y=194+i*4+random(i+90)*5,w=(i+8)*random(i+300);line(g,'#e7cd9759',1.3,sun+random(i+150)*40-w,y,sun+19+w,y);}
}
function warehouse(g:Pen,east:boolean) {
  const plaster=east?'#c9a780':'#dbcba5'; const roof=east?'#865646':'#536c64';
  // A raised timber store, with daylight visible through the open goods door.
  poly(g,'#83755e',416,118,494,88,494,337,416,351);
  poly(g,plaster,493,102,960,89,960,323,493,344);
  for(let i=0;i<195;i++){const x=497+random(i+800)*463,y=120+random(i+902)*196;box(g,x,y,2+random(i+540)*9,1.5,'#7b70512b');}
  for(let i=0;i<5;i++)line(g,'#8d7356',5,418+i*17,120-i*5,418+i*17,351-i*3);
  poly(g,roof,392,124,495,55,944,39,983,102,477,126);
  poly(g,east?'#a46b52':'#70877a',391,122,493,47,942,32,946,41,495,58,411,125);
  // Slate courses follow the sloped eaves rather than the screen edge.
  for(let r=0;r<6;r++){
    const y=59+r*10,x=494-r*13;
    line(g,east?'#bf8c65':'#869484',1.1,x,y,948+r*5,y-16);
    for(let c=0;c<22;c++){const xx=x+15+c*25+(r%2)*12;if(xx>943+r*5)continue;line(g,'#384a463b',1,xx,y-(xx-x)*.032,xx+2,y+7-(xx-x)*.032);}
  }
  poly(g,'#4d5146',388,123,478,120,982,98,976,111,482,137,395,134);
  box(g,541,159,224,169,'#45483c');
  const dark=g.createLinearGradient(548,160,729,313);dark.addColorStop(0,'#313d35');dark.addColorStop(1,'#70604a');box(g,549,166,209,155,dark);
  for(let i=0;i<8;i++)line(g,'#cba37029',1+i%2,551+i*27,170,551+i*27,315);
  box(g,555,193,194,5,'#85775b');box(g,555,233,194,4,'#6f674d');
  box(g,547,158,7,164,timber);box(g,749,159,9,161,timber);
  // Shutters, small brass hinges and the tiled shadow on the lintel.
  poly(g,'#a07e59',518,162,542,159,542,320,518,321);poly(g,'#997550',761,160,783,162,783,319,761,319);
  for(const x of [525,534,768,778])line(g,'#5a5142',1,x,164,x,315);
  for(const x of [526,770])for(const y of [196,281]){box(g,x-3,y,10,3,'#4a5146');box(g,x-4,y-1,2,5,'#d3a56e');}
  for(const x of [488,796,942]){box(g,x,116,9,215,'#796047');box(g,x+1,121,2,205,'#bd9571');}
  const name=east?'东岸米栈':'西岸粮行';
  g.save();g.translate(650,139);g.rotate(-.035);box(g,-89,-18,178,36,'#564638');box(g,-85,-14,170,28,'#304c43');
  line(g,'#b69e66',1,-82,-11,82,-11,82,11,-82,11,-82,-11);textAt(g,name,0,0,23,paper);g.restore();
  box(g,814,155,103,98,'#554f3f');box(g,820,161,91,86,'#81988b');
  for(let i=0;i<5;i++)line(g,'#455e52',3,823+i*20,161,823+i*20,246);
  for(let i=0;i<4;i++)line(g,'#51675a',3,820,174+i*21,910,174+i*21);
  poly(g,'#665c43',803,159,822,140,918,137,931,153,924,161);
  for(let i=0;i<8;i++)poly(g,i%2?'#cfab76':(east?'#95614b':'#517064'),804+i*15,155,819+i*15,155,815+i*15,168,805+i*15,166);
  // Port fixture silhouettes help the two landings read at a glance.
  if(east) {
    line(g,timber,6,380,325,380,121,330,151); line(g,'#9b7954',3,387,312,382,115,326,149);
    line(g,'#544f40',1.5,329,149,329,207);oval(g,329,211,4,5,'#72694c');
  }else{
    line(g,'#665e45',4,391,316,391,158);line(g,'#b69d6d',3,384,158,411,158);
    poly(g,'#934f3a',391,161,408,162,407,208,401,202,393,208);textAt(g,'米',400,177,13,'#f4dab0');
  }
}

function quay(g:Pen) {
  poly(g,'#4c5b4e',0,391,405,298,960,292,960,480,0,480);
  poly(g,'#b4936c',0,404,408,311,960,303,960,480,0,480);
  for(let i=0;i<20;i++){
    const yy=314+i*8,w=1+i*.18;
    line(g,'#795e454d',w,0,yy+91,422,yy,960,yy-9);
    for(let k=0;k<6;k++){ const x=422+(k*111+i*39)%537;line(g,'#ddc59b73',1,x,yy-(x-422)*.016+2,x+14+random(i*k+110)*30,yy-(x-422)*.016+2); }
  }
  for(let i=0;i<6;i++){
    const x=6+i*78,y=390-i*17;box(g,x,y-16,9,24,'#665b45');oval(g,x+4,y-16,5,2.5,'#bc9b6d');
  }
  for(let i=0;i<2;i++){
    const x=361+i*40,y=342-i*4;line(g,'#b58d58',3,x-13,y+3,x+8,y-2,x+9,y-11,x-9,y-13,x-18,y-8,x-11,y-4,x+5,y-8,x-6,y-11);
  }
  // A mooring coil and a spare hand-truck give scale to the foreground planking.
  g.save();g.translate(17,438);g.rotate(-.15);
  for(let i=0;i<4;i++){g.lineWidth=2.3;g.strokeStyle=i%2?'#a38760':'#77674f';g.beginPath();g.ellipse(0,0,30-i*4,10-i*1.3,0,0,Math.PI*2);g.stroke();}
  line(g,'#8d7454',2.2,14,7,42,18,61,12,57,7,79,4);g.restore();
  g.save();g.translate(952,386);g.rotate(-.27);
  oval(g,-14,20,21,5,'#645d4555');oval(g,-19,13,9,10,'#5c6250');oval(g,-19,13,4,5,'#ae9064');
  line(g,timber,5,-35,-45,-18,9,16,8);line(g,'#ceaa78',3,-38,-46,-22,-4,6,-4);line(g,'#856b4d',4,-12,-44,-4,-8);
  for(let i=0;i<4;i++)line(g,'#b39162',4,-30+i*3,-32+i*8,-7+i*2,-35+i*8);g.restore();
}

function merchant(g:Pen,east:boolean,t:number) {
  g.save();g.translate(848,277);const bob=Math.sin(t*1.1)*.8;
  g.translate(0,bob);
  poly(g,'#4b5142',-21,29,-17,-11,15,-13,25,27,13,52,-17,52);
  poly(g,east?'#607568':'#71614e',-32,15,-28,-9,-13,-24,12,-24,29,-11,34,18,20,28,-19,29);
  poly(g,east?'#a85d48':'#586e74',-18,-20,-4,-28,10,-24,19,27,-17,28);
  line(g,'#caa573',2,-11,-22,-6,-5,5,-1,9,-19);poly(g,'#b79a72',-13,-3,10,-4,17,26,-18,26);
  poly(g,'#ce9c71',-9,-31,8,-33,8,-22,0,-17,-9,-22);
  oval(g,0,-43,16,21,'#deb389',-.08);oval(g,15,-40,4,6,'#c69268');
  poly(g,'#bf8c65',-12,-55,-6,-56,-8,-42,-13,-34,-16,-44);poly(g,'#c49166',-3,-42,-9,-35,-2,-34);
  line(g,'#654c3a',1.6,-11,-44,-5,-45);line(g,'#594937',1.6,1,-45,8,-45);
  oval(g,-8,-42,1.1,1.5,'#493e36');oval(g,4,-42,1.1,1.5,'#493e36');line(g,'#8e5947',1.3,-7,-30,-1,-29,6,-32);
  if(east){
    oval(g,15,-51,9,10,'#554b3d');poly(g,'#774f43',-18,-51,-11,-63,8,-64,16,-56,10,-48,0,-53,-12,-49);
    line(g,'#c79273',2,-15,-53,-3,-56,12,-52);poly(g,'#ae7255',11,-51,17,-53,23,-33,17,-39,16,-30);
  }else{
    poly(g,'#475b53',-20,-50,-12,-63,4,-66,15,-58,18,-51);poly(g,'#b59768',-21,-52,17,-54,19,-49,-18,-47);
    poly(g,'#685f4b',-14,-36,-10,-29,4,-27,11,-34,9,-24,0,-19,-11,-24);line(g,'#bda991',1.2,-9,-27,-4,-23,2,-24);
  }
  const tip=Math.sin(t*1.65)*2;
  line(g,east?'#738370':'#897964',10,-23,-5,-30,8,-16,14);line(g,'#d7a579',7,-16,14,-5,16+tip);
  line(g,east?'#738370':'#897964',9,23,-4,30,8,17,13);line(g,'#deb489',6,17,13,7,12-tip);g.restore();
  poly(g,'#563f31',788,296,903,292,930,301,810,308);poly(g,'#967752',810,308,930,301,928,334,809,342);line(g,'#e4bd87',2,809,306,929,300);
  for(let i=0;i<6;i++)line(g,'#795f45',1,815+i*20,309,815+i*20,338);
  poly(g,'#d8c296',843,297,868,295,878,299,851,301);line(g,'#8c7351',1,845,297,865,296);
  box(g,804,290,25,5,'#4c5041');for(let i=0;i<5;i++)oval(g,807+i*4,291,1.3,1.7,'#e4bd82');
}

function sack(g:Pen,x:number,y:number,s:number,blue:boolean,id:number) {
  g.save();g.translate(x,y);g.scale(s,s);g.rotate((id%3-1)*.06);
  oval(g,0,2,23,4.2,'#403d3260');
  g.beginPath();g.moveTo(-9,-39);g.quadraticCurveTo(-15,-33,-21,-18);g.quadraticCurveTo(-28,0,-14,1);g.quadraticCurveTo(1,6,18,0);g.quadraticCurveTo(29,-4,20,-22);g.quadraticCurveTo(16,-31,8,-39);g.closePath();
  const fabric=g.createLinearGradient(-22,-13,23,-4);fabric.addColorStop(0,'#a8865e');fabric.addColorStop(.35,'#ddc095');fabric.addColorStop(.67,'#e5caa1');fabric.addColorStop(1,'#a78a63');g.fillStyle=fabric;g.fill();
  poly(g,'#b69c71',-8,-38,-12,-47,-3,-44,3,-49,8,-44,12,-45,7,-37);
  line(g,blue?'#47696a':'#95603e',2.6,-9,-38,7,-37,13,-33);line(g,'#f1dab1',1,-8,-39,8,-38);
  line(g,'#a58a65',1,-11,-31,-15,-22,-16,-13);line(g,'#aa8f67',1,10,-30,15,-19);line(g,'#d5bd92',1,-11,0,0,-2,13,-1);
  g.save();g.translate(1,-15);g.rotate(-.09);g.strokeStyle=blue?'#61786b':'#a47751';g.strokeRect(-4,-5,8,8);g.restore();g.restore();
}
function priceBoard(g:Pen,v:RiceView,t:number) {
  line(g,timber,5,472,316,481,231,488,324);line(g,'#937855',3,530,318,522,234,514,324);
  const p=v.event==='month'&&!v.reducedMotion?Math.min(1,(v.eventAge??3)/.55):1;
  g.save();g.translate(501,269);g.rotate(-.03+Math.sin(t*1.2)*.005);g.scale(1,Math.max(.11,p));
  box(g,-42,-46,84,91,'#6b5439');box(g,-38,-42,76,82,'#d1b383');box(g,-34,-38,68,75,'#384d42');
  textAt(g,'今 日 牌 价',0,-24,12,'#ead9b1');textAt(g,String(v.price),0,1,34,'#ffdfa0');textAt(g,'铜币／袋',0,25,11,'#e6d8b4');g.restore();
}
function boat(g:Pen,v:RiceView,t:number) {
  const east=v.bank==='east';const bob=Math.sin(t*1.35)*1.35;
  const sail=east?'#9c6651':'#b3a278';g.save();g.translate(197,341+bob);
  // Ripples under the laden boat.
  oval(g,-1,10,112,8,'#2f625c65');line(g,'#b2cbbb',1.6,-121,11,-92,13,-56,13);
  line(g,'#9e825f',4,-47,-109,-47,-8);line(g,'#e0bd87',1.5,-46,-107,-46,-10);
  line(g,'#626b57',1,-48,-105,-101,-8);line(g,'#626b57',1,-47,-104,49,-4);
  poly(g,sail,-46,-98,-12,-63,1,-27,-44,-30);poly(g,'#e4cf9d',-43,-96,-32,-82,-14,-47,-7,-29,-16,-29);
  for(let i=0;i<4;i++){const y=-84+i*14;line(g,'#88775b',1.4,-44,y,-32+i*8,y+3);}
  poly(g,east?'#ce8e58':'#577e71',-47,-110,-14,-109,-25,-104,-47,-105);
  poly(g,'#b99970',-127,-22,-84,-13,55,-14,112,-28,96,-10,66,4,-76,4,-105,-5);
  const qty=Math.max(0,Math.min(4,Math.floor(v.cargo)));
  for(let i=0;i<qty;i++)sack(g,-8+i*22,-12,.61,east,i);
  poly(g,'#584b3c',-129,-23,-82,-11,61,-12,113,-30,100,-7,77,9,-82,13,-110,2);
  poly(g,'#9f7853',-124,-20,-82,-8,65,-10,106,-24,99,-12,73,1,-81,7,-105,-2);
  line(g,'#e7c28a',3,-128,-23,-81,-11,60,-12,113,-29);line(g,'#607566',4,-107,0,-82,9,76,5,93,-5);
  for(let i=0;i<13;i++)box(g,-87+i*13,-4,2,2,'#d9ba86');
  line(g,'#786a50',2,104,-21,122,-11,157,-21);g.restore();
}
function supplierBoat(g:Pen,t:number) {
  const x=214+Math.sin(t*.08)*19,y=207+Math.sin(t)*.7;
  g.save();g.translate(x,y);poly(g,'#5e6657',-23,-4,16,-4,24,-8,15,2,-14,3);
  line(g,'#6e6c58',1.5,0,-31,0,-4);poly(g,'#e5d2a5',-2,-30,-16,-9,-2,-9);poly(g,'#ae9371',2,-25,15,-8,2,-8);g.restore();
}

// The skies and buildings are static. Keeping four print plates avoids repainting the stonework every frame.
const plates = new Map<string, HTMLCanvasElement>();
function plate(east:boolean,month:number) {
  const key=`${east}-${month}`;
  let canvas=plates.get(key);if(canvas)return canvas;
  canvas=document.createElement('canvas');canvas.width=960;canvas.height=480;
  const g=canvas.getContext('2d')!;skyAndRiver(g,east,month);quay(g);warehouse(g,east);
  for(let i=0;i<1150;i++)box(g,random(i+300)*960,random(i+2217)*480,1.4,1,'#344a3920');
  plates.set(key,canvas);return canvas;
}

export function drawRiceMarket(g:Pen,v:RiceView) {
  const t=v.reducedMotion?0:v.time,east=v.bank==='east';g.save();g.drawImage(plate(east,v.month),0,0);
  supplierBoat(g,t);
  for(let i=0;i<4;i++){const gx=102+i*51+(t*3*(i+1))%100,gy=88+Math.sin(t*.55+i)*3+i*4;line(g,'#6c7969',1.4,gx-4,gy-1,gx,gy+1,gx+4,gy-1);}
  const floor=[[573,313],[620,311],[667,310],[714,310],[594,283],[641,282],[688,282],[644,253]];
  const total=Math.max(0,Math.min(8,Math.floor(v.stock)));
  for(let row=0;row<3;row++){
    const first=[7,4,0][row],end=[8,7,4][row];
    for(let i=first;i<Math.min(total,end);i++)sack(g,floor[i][0],floor[i][1],.92,east,i);
  }
  if(total===0){line(g,'#d1b68588',2,565,305,659,303,717,303);for(let i=0;i<15;i++)oval(g,571+random(i+9)*145,309+random(i+3)*6,1.5,.6,'#eadbb1');}
  priceBoard(g,v,t);merchant(g,east,t);boat(g,v,t);
  // Small handling marks express the most recent trade between the hold and the goods door.
  const age=v.eventAge??5;
  if(!v.reducedMotion && age>=0 && age<.85 && (v.event==='sell'||v.event==='buy')){
    const p=v.event==='sell'?age/.85:1-age/.85;const x=230+p*414,y=323-54*Math.sin(Math.PI*p)-p*17;
    g.save();g.globalAlpha=.5*Math.sin(age/.85*Math.PI);sack(g,x,y,.57,east,1);g.restore();
  }
  // The fitted shop sign occupies its own post in the foreground only after the player opens a stall.
  if(v.stallName){
    g.save();g.translate(367,382);oval(g,0,47,83,8,'#625c414d');
    for(const x of [-66,66]){box(g,x,-54,4,102,timber);box(g,x+1,-52,1,97,'#ceaf7c');}
    poly(g,'#bf9b68',-83,-51,-59,-69,61,-69,83,-52,79,-43,-77,-43);
    for(let i=0;i<7;i++)poly(g,i%2?'#55796a':'#d8bc87',-59+i*17,-69,-42+i*17,-69,-60+i*23,-51,-83+i*23,-51);
    box(g,-76,4,152,5,'#bd9765');poly(g,'#795e42',-71,9,73,9,70,38,-69,38);
    box(g,-65,12,132,22,'#35594a');textAt(g,v.stallName,0,23,17,paper,123);
    oval(g,-35,0,23,5,'#735c40');oval(g,-35,-1,20,3,'#ddc799');box(g,27,-5,18,10,'#936a46');g.restore();
  }
  g.restore();
}
