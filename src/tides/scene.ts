import type { Beat, Past, Prop } from './types.ts';
import { dryGoods, riceClosing, riceLedger } from './market-board.ts';
import { returnManifest, winterManifest } from './bay.ts';

type Pen = CanvasRenderingContext2D;
type Point = readonly [number, number];
export type TidesFrame = {
  chapter: number; beat: Beat; stage: number; picks: readonly string[]; past: Past;
  ended: boolean; target: number | null; progress: number; drag?: { x: number; y: number };
};
type Light = 'morning' | 'clear' | 'rain' | 'sunset' | 'night' | 'winter';
type Cast = 'zhou' | 'chen' | 'yun' | 'cheng' | 'captain' | 'man' | 'porter';
type DeckLoad = Prop | 'cotton' | 'timber' | 'traveler';

const W = 1000, H = 420;
const tones: Record<Light, readonly [string,string,string,string,string,string]> = {
  morning: ['#adcac8','#ffe0a4','#a8b79c','#778d7f','#9cbbae','#4f817d'],
  clear: ['#92bed0','#f2e5bc','#9baea1','#708c77','#a4c4ab','#588884'],
  rain: ['#829aa4','#ceccc1','#98a9a5','#647a79','#a4b7b2','#59787c'],
  sunset: ['#a8a2ad','#ffcd8a','#ada28d','#867f76','#c1b297','#688783'],
  night: ['#263a53','#ab8a88','#64697a','#465b69','#829fa0','#385661'],
  winter: ['#a4bbc3','#e9e5db','#b5c5c1','#819799','#c5d0cb','#77969a'],
};
const lightByChapter: Light[] = ['morning','clear','rain','sunset','clear','night','morning','sunset','clear','rain','winter','sunset','morning','morning'];

function polygon(p:Pen, color:string, pts: readonly Point[]) {
  p.fillStyle=color; p.beginPath();
  pts.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));
  p.closePath(); p.fill();
}
function line(p:Pen, color:string, weight:number, ...pts:Point[]) {
  p.strokeStyle=color; p.lineWidth=weight; p.beginPath();
  pts.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y)); p.stroke();
}
function ellipse(p:Pen,x:number,y:number,rx:number,ry:number,color:string) {
  p.fillStyle=color;p.beginPath();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);p.fill();
}
function rect(p:Pen,x:number,y:number,w:number,h:number,color:string) {
  p.fillStyle=color;p.fillRect(x,y,w,h);
}
function band(p:Pen,top:number,bottom:number,one:string,two:string) {
  const grad=p.createLinearGradient(0,top,0,bottom);grad.addColorStop(0,one);grad.addColorStop(1,two);
  p.fillStyle=grad;p.fillRect(0,top,W,bottom-top);
}
function local(p:Pen,x:number,y:number,scale:number,draw:()=>void) {
  p.save(); p.translate(x,y); p.scale(scale,scale); draw(); p.restore();
}
function textAt(p:Pen,s:string,x:number,y:number,size:number,color:string,max?:number) {
  p.fillStyle=color;p.textAlign='center';p.textBaseline='middle';p.font='600 '+size+'px "Songti SC","STSong","SimSun",serif';
  if (max===undefined) p.fillText(s,x,y); else p.fillText(s,x,y,max);
}
function rand(i:number) {const f=Math.sin(i*54.753+24.91)*41733.532;return f-Math.floor(f);}
function bloom(p:Pen,x:number,y:number,r:number,core:string) {
  const glow=p.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,core);glow.addColorStop(1,'#fbd98400');
  p.fillStyle=glow;p.fillRect(x-r,y-r,r*2,r*2);
}
function plank(p:Pen,x:number,y:number,w:number,h:number,ink:string) {
  rect(p,x,y,w,h,ink);line(p,'#f4d39860',1,[x+2,y+1],[x+w-3,y+1]);
  line(p,'#4b392948',1,[x+4,y+h*.6],[x+w*.46,y+h*.6-1]);
  ellipse(p,x+w-4,y+h*.5,1.2,1,'#564737');
}
function sign(p:Pen,x:number,y:number,w:number,label:string,ink='#2c4a49',size=15) {
  rect(p,x-w/2-2,y-1,w+4,23,'#97774d');rect(p,x-w/2,y,w,20,ink);
  line(p,'#cfb67c',.7,[x-w/2+3,y+3],[x+w/2-3,y+3]);
  textAt(p,label,x,y+12,size,'#f8dfab',w-7);
}
function house(p:Pen,x:number,y:number,s:number,roof:string,lit=false) {
  local(p,x,y,s,()=>{
    rect(p,-26,-27,46,27,'#cbbd92');polygon(p,'#ac9c76',[[20,-28],[35,-22],[35,-1],[20,0]]);
    polygon(p,roof,[[-34,-25],[-20,-32],[-5,-47],[20,-43],[32,-26],[39,-23],[22,-23],[-27,-23]]);
    line(p,'#d9ca9a',1.4,[-32,-25],[-20,-30],[-5,-45],[19,-42]);
    rect(p,-8,-16,10,16,'#5e6253');
    for(const wx of [-21,8]){rect(p,wx,-18,8,9,lit?'#e2b96b':'#778379');line(p,'#635e4f',1,[wx+4,-18],[wx+4,-9]);}
    rect(p,-27,-2,48,3,'#95896c');
  });
}
function bird(p:Pen,x:number,y:number,k:number,color:string) {
  line(p,color,1.25*k,[x-6*k,y-3*k],[x-3*k,y-2*k],[x,y],[x+3*k,y-3*k],[x+6*k,y-4*k]);
}
function panorama(p:Pen,light:Light,marsh:boolean) {
  const [sky,haze,far,near,water,deep]=tones[light];
  band(p,0,172,sky,haze);
  const isNight=light==='night', sx=light==='sunset'?798:isNight?826:718,sy=isNight?31:49;
  if(light!=='rain'){
    bloom(p,sx,sy,78,isNight?'#ffdd8a24':'#fff3bd65');ellipse(p,sx,sy,isNight?14:19,isNight?14:19,isNight?'#f5e9c5':'#ffecb4');
  }else{
    for(let i=0;i<5;i++){
      const x=i*230-62,y=25+rand(i+101)*22;
      polygon(p,'#82949c',[[x,y+10],[x+48,y+7],[x+81,y-1],[x+115,y],[x+147,y-9],[x+178,y-6],[x+202,y-1],[x+235,y+1],[x+198,y+7],[x+145,y+8],[x+88,y+12]]);
    }
  }
  if(isNight)for(let i=0;i<37;i++) ellipse(p,rand(i+300)*W,rand(i+81)*85,.7+rand(i)*.7,.7,'#efe7c288');
  else for(let i=0;i<13;i++){
    const x=rand(i+151)*W,y=12+rand(i+263)*57;
    polygon(p,'#f8ecce4d',[[x,y],[x+10,y-2],[x+19,y-1],[x+30,y-4],[x+52,y-2],[x+74,y+1],[x+17,y+1]]);
  }
  polygon(p,far,[[0,96],[49,90],[119,65],[226,108],[313,81],[387,99],[450,71],[541,98],[633,59],[718,98],[777,84],[846,96],[927,66],[1000,81],[1000,160],[0,160]]);
  polygon(p,near,[[0,115],[82,102],[146,111],[236,88],[308,102],[378,116],[452,102],[504,92],[594,111],[687,91],[753,105],[849,93],[901,108],[1000,96],[1000,164],[0,164]]);
  band(p,146,H,water,deep);
  polygon(p,marsh?'#899775':'#9da186',[[0,133],[170,126],[382,140],[581,129],[779,140],[1000,126],[1000,153],[813,151],[520,149],[257,151],[0,149]]);
  for(let i=0;i<69;i++){
    const x=rand(i+501)*W,y=136+rand(i+29)*5,h=3+rand(i+311)*11;
    polygon(p,light==='winter'?'#93a39c':isNight?'#46585c':'#859580',[[x-3,y],[x-2,y-h*.65],[x,y-h],[x+2,y-h*.55],[x+4,y]]);
  }
  for(let i=0;i<(marsh?5:14);i++) house(p,22+i*(marsh?203:75)+rand(i)*24,145+rand(i+31)*4,.26+rand(i+47)*.15,isNight?'#535968':'#748073',isNight);
  for(let i=0;i<177;i++){
    const y=152+rand(i+57)*170,x=rand(i+233)*W,w=2+rand(i+97)*(3+(y-145)*.12);
    line(p,i%4?'#e4d8aa50':'#42686542',i%5?1:1.6,[x,y],[x+w,y-.3]);
  }
  for(let i=0;i<6;i++)bird(p,395+i*13,44+Math.sin(i)*7,.6+rand(i)*.4,'#48594e99');
}
function reeds(p:Pen,x:number,y:number,k:number,n:number) {
  local(p,x,y,k,()=>{for(let i=0;i<n;i++){
    const dx=(rand(i+57)-.5)*78,h=12+rand(i+22)*29,b=dx-7-rand(i+99)*8;
    line(p,'#747e48',1.5,[dx,0],[dx-2,-h*.5],[b,-h]);line(p,'#9b7943',3,[b,-h],[b-1,-h-6]);
    polygon(p,i%2?'#9f9d5c':'#677d52',[[dx,1],[dx+4,-h*.4],[dx+13,-h*.72],[dx+7,-h*.3]]);
  }});
}
function bridge(p:Pen,x:number,y:number,k:number,lamps:number,busy=false) {
  local(p,x,y,k,()=>{
    const stone='#9c9a7e',shadow='#626e64', total=4;
    for(const end of [0,356]){
      polygon(p,'#798a72',[[end-37,20],[end-25,15],[end-17,6],[end-9,-3],[end+7,-4],[end+21,12],[end+45,19],[end+30,21]]);
      line(p,'#b1b69b',1.4,[end-32,22],[end+29,22]);
    }
    for(let i=0;i<total;i++){
      const a=i*89;
      p.fillStyle=stone;p.beginPath();p.moveTo(a,-22);p.lineTo(a+89,-22);p.lineTo(a+89,19);
      p.lineTo(a+79,19);p.bezierCurveTo(a+74,-15,a+17,-15,a+11,19);p.lineTo(a,19);p.closePath();p.fill();
      p.strokeStyle='#cabd99';p.lineWidth=2;p.beginPath();p.moveTo(a+10,18);p.bezierCurveTo(a+15,-17,a+75,-17,a+80,18);p.stroke();
      line(p,shadow,1,[a+3,-16],[a+19,-16]);line(p,shadow,1,[a+68,-14],[a+87,-14]);
      polygon(p,'#788478',[[a+2,19],[a+10,19],[a+7,23],[a-1,23]]);
    }
    rect(p,-4,-29,364,6,'#b9a887');rect(p,-4,-24,364,3,'#756f58');
    for(let i=0;i<=12;i++) {rect(p,i*29.5,-39,3,12,'#867b61');rect(p,i*29.5-1,-40,5,2,'#c4b38d');}
    line(p,'#82785d',1.8,[-1,-35],[356,-35]);
    for(let i=0;i<lamps;i++)lantern(p,20+i*58,-42,.34,true);
    if(busy){person(p,68,-29,.34,'porter');person(p,110,-29,.32,'chen');cart(p,133,-29,.26);}
  });
}
function pier(p:Pen,x:number,y:number,w:number,k=1) {
  local(p,x,y,k,()=>{
    for(let a=17;a<w;a+=75){plank(p,a,2,7,23,'#786953');line(p,'#6d6452',3,[a+6,19],[a+33,3]);}
    polygon(p,'#bb9d73',[[0,-9],[w-14,-13],[w,0],[5,4]]);
    line(p,'#78674f',4,[4,5],[w,1]);
    for(let a=8;a<w-5;a+=14)line(p,'#8d795e',.7,[a,-8],[a+7,2]);
  });
}
function person(p:Pen,x:number,y:number,k:number,who:Cast,pose=0) {
  const clothes: Record<Cast,[string,string]>={zhou:['#934e42','#c3aa79'],chen:['#586a4e','#c0a070'],yun:['#b77942','#b1523f'],cheng:['#466d70','#bd986b'],captain:['#385663','#bd9265'],man:['#9c4137','#ab8d65'],porter:['#706d52','#c6a676']};
  const [coat,trim]=clothes[who], hat=who==='chen'||who==='porter';
  local(p,x,y,k,()=>{
    ellipse(p,0,1,10.6,2.3,'#48423532');
    polygon(p,'#484b41',[[-6,-16],[.5,-15],[-1,0],[-6,0]]);polygon(p,'#565246',[[1,-16],[6,-16],[7,0],[3,0]]);
    ellipse(p,-5,0,3.8,1.35,'#403d35');ellipse(p,6,0,3.8,1.35,'#403d35');
    polygon(p,coat,[[-6,-34],[.5,-35],[6,-32],[8,-15],[3,-13],[-8,-14]]);
    line(p,trim,1.4,[-4,-33],[1,-29],[5,-32]);line(p,'#4b423780',1.25,[-7,-18],[6,-18]);
    line(p,coat,4,[-5,-31],[-9,-22],[-7,-17]);ellipse(p,-6.4,-17,1.8,2.2,'#cda281');
    line(p,coat,4,[5,-31],[9+pose*3,-24-pose*2],[8+pose*8,-18-pose*8]);ellipse(p,8+pose*8,-17.8-pose*8,1.9,2.2,'#cfa17e');
    rect(p,-2,-37,4,4,'#b88c68');ellipse(p,0,-41,5.8,7.4,'#d2aa83');
    ellipse(p,2.3,-41.5,.7,.75,'#59483b');
    polygon(p,'#45453a',[[-6,-39],[-7,-44],[-4,-49],[1,-50],[6,-47],[6,-44],[2,-45],[-3,-43],[-3,-38]]);
    if(hat){polygon(p,'#bc9d65',[[-11,-44],[-1,-54],[11,-45],[0,-43]]);line(p,'#7d704c',1,[-11,-44],[9,-45]);}
    if(who==='captain'){polygon(p,'#304d52',[[-7,-45],[-8,-47],[-4,-51],[5,-50],[8,-47],[9,-45]]);rect(p,-5,-46,13,2,'#bcab87');}
    if(who==='zhou'||who==='yun') {ellipse(p,-5,-47,3,3,'#494838');line(p,trim,1,[-8,-47],[-2,-49]);}
    if(who==='man') {line(p,'#dc9a67',2,[-6,-45],[5,-46]);polygon(p,'#af4f40',[[-5,-45],[-12,-42],[-7,-42]]);}
  });
}
function lantern(p:Pen,x:number,y:number,k:number,on:boolean) {
  local(p,x,y,k,()=>{
    if(on) bloom(p,0,-1,31,'#ffe09078');
    line(p,'#514739',1.5,[0,-20],[0,-12]);ellipse(p,0,0,9,13,on?'#f4b65e':'#b16e4e');
    for(const i of [-1,1])line(p,on?'#b87940':'#8a5843',1,[i*3,-11],[i*5,0],[i*3,10]);
    rect(p,-6,-12,12,2,'#72533b');rect(p,-6,10,12,3,'#74513c');line(p,'#a55c44',1.5,[0,13],[0,19]);
  });
}
function cart(p:Pen,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    for(const dx of [-32,29]){ellipse(p,dx,-6,8,8,'#544c3d');ellipse(p,dx,-6,5.4,5.4,'#b29060');line(p,'#66583f',1.3,[dx-5,-6],[dx+5,-6]);line(p,'#66583f',1.3,[dx,-11],[dx,-1]);}
    line(p,'#846c46',4,[32,-14],[57,-22]);plank(p,-41,-25,83,13,'#a98454');
    line(p,'#826a48',3,[-34,-24],[-34,-49]);line(p,'#826a48',3,[32,-24],[32,-49]);
    polygon(p,'#c28c5d',[[-44,-47],[-34,-56],[28,-56],[44,-47],[40,-44],[-43,-44]]);
    for(let a=-37;a<35;a+=16)polygon(p,'#d1b68a',[[a,-47],[a+6,-55],[a+12,-55],[a+9,-47]]);
    for(let i=0;i<6;i++)ellipse(p,-28+i*11,-26,6.3,4.5,'#d9b075');
  });
}
function boat(p:Pen,x:number,y:number,k:number,sail:'red'|'linen'|'furled',cargo:DeckLoad[] = [],crew:Cast='captain') {
  local(p,x,y,k,()=>{
    ellipse(p,2,4,82,5,'#365d5942');
    line(p,'#eee1ba80',1.5,[-87,3],[-66,5],[-50,5]);line(p,'#eee1ba80',1.4,[40,7],[78,5],[88,3]);
    line(p,'#645441',3,[-10,-5],[-10,-109]);
    if(sail!=='furled') {
      const dark=sail==='red'?'#a35542':'#c1a278',bright=sail==='red'?'#c37552':'#e2d1a3';
      polygon(p,dark,[[-11,-104],[-60,-74],[-72,-37],[-53,-29],[-10,-25]]);
      polygon(p,bright,[[-8,-105],[9,-97],[36,-69],[54,-42],[36,-34],[-8,-27]]);
      for(let i=1;i<5;i++){
        const yy=-103+i*14;
        line(p,sail==='red'?'#8c513c':'#a38d66',1.3,[-10,yy],[-15-i*10,yy+7]);
        line(p,sail==='red'?'#89503c':'#9e8863',1.35,[-8,yy],[i*10+1,yy+4]);}
      line(p,'#655c49',1,[-10,-103],[73,-15]);line(p,'#77684d',1,[-10,-101],[-72,-12]);
    } else {
      line(p,'#8f7855',2,[-10,-73],[49,-63]);
      polygon(p,'#c6b590',[[-10,-73],[50,-64],[47,-57],[-9,-66]]);
      line(p,'#847256',1,[-9,-96],[70,-14]);line(p,'#847256',1,[-10,-89],[-76,-13]);
    }
    cargo.slice(0,4).forEach((kind,i)=>{
      const left=-47+i*21;
      if(kind==='traveler')person(p,left,-13,.48,i%2?'zhou':'porter');
      else if(kind==='cotton')cottonBale(p,left,-11,.64);
      else if(kind==='timber'){
        for(let j=0;j<3;j++)plank(p,left-9,-14-j*3,19,3,'#ba966c');
        rect(p,left-4,-22,2,11,'#75684b');
      }else prop(p,kind,left,-11,.46);
    });
    person(p,49,-11,.57,crew,1);
    polygon(p,'#534638',[[-90,-17],[-63,-11],[58,-12],[88,-25],[72,-5],[47,3],[-54,4],[-76,-1]]);
    polygon(p,'#a37948',[[-89,-17],[-61,-13],[59,-14],[87,-24],[77,-15],[58,-10],[-61,-9],[-82,-13]]);
    line(p,'#d1ae70',1.6,[-76,-5],[-48,1],[48,-1],[68,-6]);
    ellipse(p,71,-14,2.1,1.7,'#e7d6a2');
  });
}
function crate(p:Pen,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    polygon(p,'#d2ab74',[[-20,-23],[-6,-30],[22,-23],[9,-16]]);
    polygon(p,'#bb8b59',[[-20,-23],[9,-16],[9,1],[-20,-6]]);
    polygon(p,'#957249',[[9,-16],[22,-23],[22,-7],[9,1]]);
    line(p,'#816342',1.3,[-18,-21],[7,-14],[7,-1]);line(p,'#e0bc83',1.2,[-17,-8],[7,-13]);
    line(p,'#7a5942',2,[-8,-26],[10,-21],[10,-1]);
    rect(p,-9,-17,6,6,'#cbac77');line(p,'#985b49',1.5,[-8,-15],[-5,-14],[-7,-12]);
  });
}
function sack(p:Pen,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    polygon(p,'#b99c6b',[[-12,-25],[-8,-30],[-13,-36],[2,-33],[11,-36],[7,-29],[12,-25],[18,-10],[14,-1],[3,2],[-12,0],[-17,-6],[-16,-16]]);
    polygon(p,'#dac18b',[[-10,-24],[0,-28],[9,-24],[12,-10],[8,-2],[-7,-2],[-12,-8]]);
    line(p,'#7c7350',2,[-10,-29],[8,-28]);line(p,'#ac996c',1,[-9,-21],[-13,-11]);
    textAt(p,'米',0,-13,10,'#7c7755');
  });
}
function prop(p:Pen,kind:Prop,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    switch(kind){
      case 'rice':sack(p,0,0,1);break;
      case 'crate':crate(p,0,0,1.2);break;
      case 'cart':cart(p,0,0,.68);break;
      case 'boat':boat(p,1,0,.43,'linen');break;
      case 'egg':{
        for(const dx of [-14,14]) {
          p.strokeStyle='#80683d';p.lineWidth=2;p.beginPath();p.arc(dx,-8,10,Math.PI,Math.PI*2);p.stroke();
          ellipse(p,dx,-7,13,5,'#ac8654');
          for(let i=0;i<5;i++)ellipse(p,dx-6+(i%3)*5,-9-Math.floor(i/3)*4,3.7,4.5,'#e9dec0');
          polygon(p,'#ab8653',[[dx-13,-7],[dx+13,-7],[dx+9,2],[dx-8,2]]);
          line(p,'#d1af76',1,[dx-10,-4],[dx+11,-4]);
        }line(p,'#846744',2,[-27,-22],[0,-25],[27,-22]);break;
      }
      case 'lamp':{
        p.strokeStyle='#4b5144';p.lineWidth=2;p.beginPath();p.arc(0,-32,9,Math.PI,Math.PI*2);p.stroke();
        polygon(p,'#567062',[[-14,-29],[-9,-34],[8,-34],[14,-29],[10,-26],[-10,-26]]);
        polygon(p,'#f9ce7e',[[-10,-25],[10,-25],[11,-8],[7,-4],[-7,-4],[-11,-9]]);
        bloom(p,0,-15,25,'#ffcf7c55');
        line(p,'#947a51',2,[-10,-26],[-9,-4],[9,-4],[10,-25]);rect(p,-12,-4,24,5,'#566055');break;
      }
      case 'key':{
        p.strokeStyle='#705d3f';p.lineWidth=5;p.beginPath();p.ellipse(-11,-23,8,9,-.7,0,Math.PI*2);p.stroke();
        line(p,'#cba55d',3.5,[-7,-17],[16,0],[19,-4]);line(p,'#a78248',3,[10,-4],[14,-9]);line(p,'#dec18b',1.3,[-6,-18],[16,-2]);
        p.strokeStyle='#d4ad62';p.lineWidth=3;p.beginPath();p.ellipse(-11,-23,8,9,-.7,0,Math.PI*2);p.stroke();break;
      }
      case 'ticket': case 'paper': {
        p.save();p.rotate(-.13);
        for(let i=0;i<(kind==='ticket'?1:3);i++){
          const d=i*2;
          polygon(p,'#a88f65',[[d-22,-25+d],[19+d,-24+d],[25+d,d],[-21+d,1+d]]);
          polygon(p,i%2?'#d7c3a0':'#ead6ad',[[d-22,-26+d],[19+d,-25+d],[24+d,-2+d],[-21+d,-1+d]]);
        }
        if(kind==='ticket'){rect(p,-17,-21,29,1,'#a48a62');textAt(p,'渡   票',-1,-13,9,'#735e46');ellipse(p,13,-7,3,3,'#ac5848');}
        else{for(let i=0;i<4;i++)line(p,'#a29278',1,[-10,-16+i*4],[9-i*2,-15+i*4]);}
        p.restore();break;
      }
      case 'reed': {
        for(let i=0;i<10;i++) {const xx=-7+i*1.4, ex=-18+i*4.4, ey=-33-rand(i)*9;
          line(p,i%2?'#8e954f':'#aa975c',1.8,[xx,0],[ex,ey]);line(p,'#a1804e',3,[ex,ey],[ex-1,ey-5]);}
        line(p,'#805d3e',3,[-7,-13],[8,-14]);break;
      }
      case 'chalk':{
        for(let i=0;i<2;i++)polygon(p,i?'#dfd9b5':'#efe4bd',[[-16+i*9,-3],[-10+i*9,0],[11+i*8,-18],[6+i*8,-22]]);
        line(p,'#fff4cc',1,[-18,1],[-23,4],[-33,3]);break;
      }
      case 'oil':{
        ellipse(p,-1,-13,14,16,'#8d653e');rect(p,-14,-22,26,20,'#a47748');
        ellipse(p,-1,-23,13,4,'#c4a16a');ellipse(p,-1,-22,9,2,'#8b704c');
        rect(p,-14,-18,26,3,'#59665b');rect(p,-14,-6,26,3,'#59665b');break;
      }
      case 'bell':{
        line(p,'#816a4f',3,[-9,-29],[0,-39],[7,-31]);ellipse(p,0,-25,8,8,'#c7a462');
        polygon(p,'#bf9558',[[-7,-23],[-9,-11],[-14,-6],[-13,-2],[12,-2],[15,-6],[10,-10],[7,-23]]);
        ellipse(p,0,-4,14,3,'#8d7349');ellipse(p,0,-1,3,3,'#cda562');break;
      }
      case 'coins':{
        for(const [dx,h] of [[-12,3],[6,5],[19,2]])for(let j=0;j<h;j++){
          ellipse(p,dx,1-j*3,8.6,3.1,'#9b7641');ellipse(p,dx,-j*3,8.8,2.5,'#e2bd6c');rect(p,dx-1.5,-j*3-1,3,1.5,'#926c36');}
        break;
      }
      case 'bread':{
        for(const [dx,dy] of [[-13,-1],[10,-1],[0,-10]]){
          ellipse(p,dx,dy-7,14,8,'#b17b48');ellipse(p,dx-1,dy-9,13.5,7,'#e2ad68');
          for(let i=0;i<3;i++)line(p,'#ad7f50',1.4,[dx-6+i*4,dy-11],[dx-4+i*4,dy-8]);
        }break;
      }
      case 'rope': {
        for(let i=0;i<4;i++){p.strokeStyle=i%2?'#c5a16f':'#95794e';p.lineWidth=2.6;p.beginPath();p.ellipse(0,-4-i*2,17-i,6,-.12,0,Math.PI*2);p.stroke();}
        line(p,'#a5885c',2,[-14,-3],[-22,1],[-28,-1]);break;
      }
    }
  });
}
function marketStall(p:Pen,x:number,y:number,k:number,goods:Prop,color:string) {
  local(p,x,y,k,()=>{
    rect(p,-47,-72,4,73,'#776346');rect(p,39,-71,4,71,'#695a43');
    polygon(p,'#b68d5f',[[-47,-29],[40,-29],[50,-23],[-52,-22]]);plank(p,-49,-22,95,17,'#9c7850');
    for(let i=0;i<4;i++)prop(p,goods,-30+i*19,-26,.48);
    polygon(p,color,[[-59,-68],[-42,-84],[43,-83],[57,-66],[49,-62],[-54,-63]]);
    for(let i=-49;i<48;i+=19)polygon(p,'#e9cea264',[[i,-65],[i+9,-81],[i+15,-81],[i+8,-64]]);
    line(p,'#735940',2,[-58,-66],[-46,-63],[47,-63],[57,-65]);
  });
}
function displayBoard(p:Pen,x:number,y:number,k:number,title:string,rows:readonly string[]) {
  local(p,x,y,k,()=>{
    line(p,'#766046',5,[-32,0],[-28,-77]);line(p,'#766046',5,[31,0],[27,-76]);
    rect(p,-37,-85,74,69,'#a77d52');rect(p,-33,-81,66,61,'#344f47');
    textAt(p,title,0,-67,13,'#f2dda4',61);line(p,'#b5b089',.9,[-25,-56],[25,-56]);
    rows.forEach((row,i)=>textAt(p,row,0,-46+i*14,10,'#d6d6b0',58));
  });
}
function wheel(p:Pen,x:number,y:number,r:number) {
  p.strokeStyle='#766347';p.lineWidth=4;p.beginPath();p.arc(x,y,r,0,2*Math.PI);p.stroke();
  for(let i=0;i<8;i++){const t=i*Math.PI/4;line(p,'#897354',2,[x,y],[x+r*Math.cos(t),y+r*Math.sin(t)]);}
  ellipse(p,x,y,4,4,'#655a48');
}
function cargoRack(p:Pen,x:number,y:number,k:number,type:Prop,count:number) {
  local(p,x,y,k,()=>{
    plank(p,-40,-3,83,5,'#805f43');rect(p,-32,2,5,5,'#69533a');rect(p,29,2,5,5,'#69533a');
    for(let i=0;i<Math.min(6,count);i++) prop(p,type,-26+(i%3)*24+(i>2?4:0),-5-Math.floor(i/3)*15,.62);
  });
}
function copies<T>(value:T,count:number):T[] {
  return Array.from({length:count},()=>value);
}
function cottonBale(p:Pen,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    rect(p,-15,-23,31,23,'#d5cbb3');
    polygon(p,'#e9deca',[[-15,-23],[-10,-27],[18,-26],[16,-23]]);
    line(p,'#988c70',2,[-10,-23],[7,0]);line(p,'#a2937b',2,[10,-23],[-5,-1]);
  });
}

function pennants(p:Pen,x:number,y:number,length:number,lamps=false) {
  const sag=length*.073;
  p.beginPath();p.moveTo(x,y);p.quadraticCurveTo(x+length*.5,y+sag*2,x+length,y+2);
  p.strokeStyle='#715e44';p.lineWidth=1.8;p.stroke();
  for(let i=1;i<=9;i++){
    const t=i/10, px=x+t*length,py=y+4*sag*t*(1-t)+2*t;
    if(lamps&&i%2===1)lantern(p,px,py+10,.65,true);
    else polygon(p,['#be7856','#d5aa62','#648879'][i%3],[[px-5,py],[px+5,py+1],[px-1,py+13]]);
  }
}
function rain(p:Pen) {
  for(let i=0;i<68;i++){
    const x=rand(i+8)*W,y=rand(i+31)*212;
    line(p,'#d9e7df75',.8,[x,y],[x-2,y+5]);
  }
}
function snow(p:Pen) {
  for(let i=0;i<58;i++)ellipse(p,rand(i+11)*W,rand(i+117)*254,1+rand(i)*.8,1,'#f5f1dfc0');
}
function storeFront(p:Pen,x:number,y:number,k:number,label:string,thatch=false) {
  local(p,x,y,k,()=>{
    polygon(p,thatch?'#8e996d':'#8a9176',[[-136,8],[-113,2],[-97,-6],[-76,-8],[69,-8],[105,2],[138,7],[85,12],[-31,12]]);
    polygon(p,'#8d8068',[[-83,-4],[77,-4],[90,0],[81,4],[-80,5],[-89,2]]);
    line(p,'#c5ba94',1.7,[-92,1],[-83,-3],[76,-4],[88,-1]);
    line(p,'#d3c9a15c',1.6,[-111,13],[-66,14],[38,13],[104,11]);
    for(let i=0;i<9;i++){
      const dx=(i%2?1:-1)*(80+rand(i+420)*28);
      polygon(p,thatch?'#879258':'#7d8a66',[[dx+5,2],[dx-2,-8],[dx,-1],[dx-7,-6],[dx-5,2]]);
    }
    rect(p,-79,-71,153,72,thatch?'#a99367':'#a78964');
    rect(p,-65,-57,54,57,'#4e5347');rect(p,-58,-51,40,51,'#656152');
    for(let i=0;i<5;i++)line(p,'#827457',1.3,[-57+i*10,-48],[-57+i*10,-2]);
    rect(p,10,-52,48,31,'#686952');
    for(let i=1;i<5;i++)rect(p,10+i*8,-51,2,30,'#b69c75');
    for(const dx of [-76,-5,69])plank(p,dx,-71,5,73,'#826849');
    polygon(p,thatch?'#af945e':'#5a6b60',[[-94,-69],[-75,-80],[-55,-99],[55,-101],[83,-77],[93,-70],[81,-67],[-84,-66]]);
    for(let i=0;i<20;i++){
      const dx=-75+i*8;
      line(p,thatch?'#d0b573':'#809080',1.2,[dx,-70],[Math.min(56,Math.max(-54,dx*.8)),-94]);
    }
    line(p,thatch?'#d6bd82':'#8b9784',2,[-93,-70],[-74,-78],[-54,-98],[55,-100],[82,-77],[94,-70]);
    sign(p,0,-74,62,label,'#465b4d',12);
    if(thatch)reeds(p,89,-1,.65,12);
  });
}
function warehouseFrame(p:Pen) {
  for(const xx of [0,258,706,984]) {
    plank(p,xx,0,17,221,'#715b48');line(p,'#977452',4,[xx+10,67],[xx+54,10]);
    line(p,'#574d40',2,[xx+2,0],[xx+3,214]);
  }
  polygon(p,'#5f5243',[[0,0],[1000,0],[1000,22],[600,17],[217,24],[0,20]]);
  rect(p,0,21,1000,5,'#a2815b');
  lantern(p,244,48,.9,true);lantern(p,724,47,.9,true);
}
function paperWindow(p:Pen,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    rect(p,-72,-106,144,103,'#8d7957');rect(p,-67,-100,134,94,'#ddc395');
    for(let i=0;i<7;i++)rect(p,-63+i*20,-99,3,91,'#987c55');
    for(let i=0;i<5;i++)rect(p,-65,-95+i*19,131,2,'#a28c66');
  });
}
function rackBay(p:Pen,x:number,y:number,k:number,item:Prop|undefined,id:string) {
  local(p,x,y,k,()=>{
    rect(p,-44,-71,89,68,'#776f58');rect(p,-40,-68,80,64,'#a18d6e');
    for(let i=0;i<6;i++)line(p,'#8b795d',1,[-38,-61+i*10],[38,-61+i*10]);
    line(p,'#e1d8af',1.6,[-37,-52],[37,-52],[36,-5],[-37,-5],[-37,-52]);
    textAt(p,id,0,-59,10,'#f2e3c1');
    if(item)prop(p,item,0,-9,.97);
    plank(p,-50,-5,101,8,'#876b4e');rect(p,-39,3,6,8,'#725e47');rect(p,36,3,6,8,'#725e47');
  });
}
function displayScale(p:Pen,x:number,y:number,k:number) {
  local(p,x,y,k,()=>{
    rect(p,-3,-48,6,47,'#887249');plank(p,-18,-1,37,5,'#93794d');
    line(p,'#b29358',3,[-26,-42],[0,-46],[25,-49]);ellipse(p,0,-46,3,3,'#cfb978');
    for(const dx of [-23,22]){
      const h=dx<0?-41:-47;line(p,'#70674f',1,[dx,h],[dx-9,h+21]);line(p,'#70674f',1,[dx,h],[dx+9,h+21]);
      polygon(p,'#b59e6b',[[dx-10,h+20],[dx+10,h+20],[dx+6,h+24],[dx-6,h+24]]);
    }
  });
}
function dockScene(p:Pen,f:TidesFrame) {
  const {chapter,picks,past,stage,ended}=f;
  const redAtDock=stage>0?596:687;
  const fairGoods:Prop=past.fair==='bread'?'bread':past.fair==='night'?'lamp':'rice';
  const keeper:Cast=past.homeKeeper==='ayun'?'yun':past.homeKeeper==='xiaoman'?'man':'captain';
  const usualFriend:Cast=past.partner==='ayun'?'yun':past.partner==='xiaoman'?'man':'zhou';
  switch(chapter){
    case 7:{
      bridge(p,190,164,1.06,0,true);pennants(p,226,77,278);
      storeFront(p,92,177,.77,'橋頭');boat(p,670,207,.72,'linen',['crate']);
      pier(p,0,236,472);pier(p,765,220,235);
      cart(p,picks[0]==='dock'?830:264,224,1.22);person(p,192,226,.98,'zhou',1);
      for(let i=0;i<(picks[0]==='bridge'?5:2);i++)person(p,315+i*21,217+(i%2)*5,.65,i%2?'porter':'yun');
      if(past.morning==='early-eggs')prop(p,'egg',229,219,.61);
      cargoRack(p,867,213,.95,'crate',picks[0]==='dock'?4:2);break;
    }
    case 8:{
      bridge(p,205,153,.68,0);storeFront(p,91,169,.81,'西米倉');
      const ledger=riceLedger(picks), player=riceClosing(past,picks);
      boat(p,redAtDock,215,1.18,'red',copies('rice',picks[1]?0:2),'man');
      boat(p,800,176,.63,'linen',copies('rice',player.stock));
      pier(p,0,236,454);pier(p,740,230,260);
      let warehouse=1+ledger.first+(picks[1]?(ledger.shared?1:2):0);
      if(picks[2]==='east'||(picks[2]==='order'&&past.order==='grain'&&!ledger.left))warehouse--;
      if(picks[2]==='west')warehouse+=ledger.left;
      cargoRack(p,241,220,1.14,'rice',warehouse);
      displayScale(p,347,221,1.05);person(p,395,224,.99,'chen',1);
      displayBoard(p,111,220,1.02,'西 岸',['米  一袋',ledger.west+' 枚']);
      displayBoard(p,899,219,.9,'東 岸',['米  一袋',ledger.east+' 枚']);
      break;
    }
    case 9:{
      rain(p);warehouseFrame(p);pier(p,8,231,986);
      rackBay(p,133,210,1.29,picks[0]==='grain'?'rice':picks[0]==='paper'?'paper':undefined,'甲架');
      rackBay(p,316,210,1.29,picks[1]==='grain'?'rice':picks[1]==='paper'?'paper':undefined,'乙架');
      person(p,441,222,1.22,past.sail==='partner'?'man':'yun',1);person(p,559,218,.98,'cheng');
      const saved=dryGoods(picks);
      cart(p,835,221,1.14);
      cargoRack(p,634,221,.86,'rice',ended?0:2-saved.grain);
      cargoRack(p,714,221,.86,'paper',ended?0:2-saved.paper);
      for(let i=0;i<4;i++)ellipse(p,99+i*211,237,20+i*3,2,'#c4d5cd70');
      break;
    }
    case 10:{
      storeFront(p,107,180,.91,'燈 紙');boat(p,757,208,.94,'furled');
      pier(p,0,236,566);pier(p,837,224,163);
      paperWindow(p,114,205,.73);plank(p,193,194,168,12,'#937149');
      for(const dx of [204,342])plank(p,dx,205,7,22,'#795f44');
      for(let i=0;i<3;i++)lantern(p,224+i*45,173,.65,stage>1&&i<2);
      person(p,403,223,1.17,'cheng',1);prop(p,'paper',328,193,.66);
      line(p,'#66563f',4,[526,224],[526,126],[565,126]);
      lantern(p,559,149,1.12,stage>1&&!ended);
      if(ended)lantern(p,picks[2]==='boat'?806:118,picks[2]==='boat'?181:136,.87,true);
      else person(p,900,216,.92,'captain',1);break;
    }
    case 11:{
      storeFront(p,82,163,.72,'橋頭');bridge(p,170,150,.71,0,true);
      boat(p,635,213,1.13,'red',picks[1]==='bulk'?['crate','crate','crate']:['ticket'],'man');
      boat(p,854,185,.56,'linen');pier(p,0,235,466);
      marketStall(p,191,220,.99,'bread','#788c73');person(p,261,222,.99,picks[0]==='ayun'?'yun':'zhou',1);
      wheel(p,429,197,17);person(p,393,224,1.12,'captain',1);
      if(past.lamp==='boat')lantern(p,715,184,.48,true);
      if(picks[1]==='people')prop(p,'ticket',358,218,.7);break;
    }
    case 12:{
      bridge(p,397,159,.89,5,true);pennants(p,-10,29,515,true);pennants(p,504,29,510,true);
      boat(p,646,200,.75,'red',['crate'],'man');boat(p,824,198,.62,'furled');
      pier(p,0,240,1000);marketStall(p,124,217,1,'bread','#b96848');
      marketStall(p,374,216,.96,'crate','#658477');cart(p,237,226,.6);
      line(p,'#756443',4,[886,223],[886,120],[917,119]);lantern(p,913,140,.75,true);
      const destination=picks[0]==='night'?863:picks[0]==='freight'?381:139;
      for(let i=0;i<9;i++)person(p,stage?destination-92+i*22:250+i*55,229+(i%3)*3,.56+i%2*.07,(i%2?'zhou':'porter'),i%2);
      person(p,550,227,.96,usualFriend,1);break;
    }
    case 13:{
      storeFront(p,169,184,1.01,'蘆 棚',true);reeds(p,71,184,1.32,36);reeds(p,305,167,.84,23);
      pier(p,0,233,491);boat(p,664,219,1.07,'linen',picks[1]==='store'?[]:stage?[fairGoods,fairGoods]:[fairGoods,fairGoods,fairGoods,fairGoods]);
      cargoRack(p,356,219,1.1,picks[1]==='store'?'crate':fairGoods,picks[1]==='store'?2:stage?2:0);
      displayScale(p,133,221,1.1);person(p,239,220,1.14,'chen',1);
      reeds(p,913,212,1.38,36);reeds(p,975,224,1.63,25);break;
    }
    case 14:{
      reeds(p,72,178,1.25,35);storeFront(p,219,164,.66,'芦 料',true);
      pier(p,0,232,417);pier(p,775,232,225);storeFront(p,900,180,.78,'燈 鋪');
      const manifest=returnManifest({past,picks});
      const cargo:Prop[]=copies(fairGoods,manifest.oldCargo);
      if(!manifest.landed)cargo.push(...copies<Prop>('reed',manifest.reeds),...copies<Prop>('crate',manifest.parcels));
      boat(p,ended?697:stage===2?618:508,216,1.2,'linen',cargo);
      cargoRack(p,217,219,1.17,'reed',stage?2:5);person(p,285,217,1.02,'chen');
      person(p,853,218,.93,'cheng',1);lantern(p,923,179,.72,picks[2]==='wick');break;
    }
    case 15:{
      warehouseFrame(p);pier(p,10,232,980);
      const privateCells=picks[0]==='wide'?3:2, stored=picks[1]==='rice'?'rice':'reed';
      for(let i=0;i<4;i++)rackBay(p,130+i*145,211,1.05,picks[0]&&i<privateCells?'crate':picks[1]&&i>=privateCells&&(stored!=='rice'||i===privateCells)?stored:undefined,'壹貳參肆'[i]);
      person(p,688,221,1.07,'chen',1);person(p,824,221,1.05,'yun',1);
      if(stage===2||ended)prop(p,'key',ended&&picks[2]==='fog'?815:680,198,.52);
      break;
    }
    case 16:{
      rain(p);storeFront(p,102,178,.82,'芦湾');
      boat(p,647,199,.93,'linen',copies('rice',picks[1]?0:picks[0]&&picks[0]!=='check'?1:2));
      pier(p,0,234,467);pier(p,764,223,236);
      const fresh=stage>=2||picks[0]==='check';
      const actual=past.bayTenant==='rice'?4:7;
      displayBoard(p,178,219,1.2,'米 行',[fresh?'本 班':'上 班',(fresh?actual:8)+' 枚']);
      person(p,289,221,1.02,'yun',1);cargoRack(p,382,218,.94,'rice',actual===4?4:0);
      displayBoard(p,859,213,.97,'渡 口',[ended&&picks[2]==='public'?'本 班':'上 班',(ended&&picks[2]==='public'?actual:8)+' 枚']);break;
    }
    case 17:{
      const load=winterManifest(picks);
      const freight:DeckLoad[]=[...copies<DeckLoad>('cotton',load.cotton),...copies<DeckLoad>('timber',load.timber),...copies<DeckLoad>('traveler',load.people)];
      bridge(p,116,155,.88,0);boat(p,651,212,1.02,'furled',freight);
      if(load.transferred)boat(p,845,182,.68,'red',copies('traveler',load.transferred),'man');
      pier(p,0,235,529);pier(p,844,230,156);
      for(let i=0;i<6;i++) {
        const xx=67+i*56;polygon(p,'#f0ecdc',[[xx,223],[xx+28,221],[xx+48,224],[xx+14,226]]);
      }
      for(let i=0;i<4-load.cotton;i++)cottonBale(p,182+i*39,216,1);
      displayBoard(p,84,218,.98,'冬 班',[picks[0]==='full'?'整 船':picks[0]==='split'?'半 船':picks[0]==='open'?'散 班':'待掛牌']);
      person(p,400,224,1.1,'yun',1);
      if(!picks[1]||load.waiting){person(p,455,226,.88,'zhou');person(p,485,223,.9,'porter');}
      snow(p);break;
    }
    case 18:{
      paperWindow(p,86,206,1.29);pier(p,0,235,558);bridge(p,544,153,.72,0);boat(p,728,196,.57,'furled');
      plank(p,177,194,186,13,'#986f4d');for(const x of [185,344])rect(p,x,207,7,22,'#785f44');
      for(let i=0;i<2+stage;i++)prop(p,i%2?'paper':'ticket',211+i*31,193,.66);
      person(p,403,221,1.17,'zhou',1);person(p,477,221,1,'captain');
      pier(p,818,228,182);plank(p,868,115,11,103,'#897657');
      for(let i=0;i<9;i++)line(p,'#e0d2a1',1.3,[870,203-i*9],[i%2?876:880,203-i*9]);
      if(ended)displayBoard(p,924,215,.72,'冬 班',[picks[2]==='reserve'?'留 座':picks[2]==='transfer'?'轉 船':'靠 岸']);
      break;
    }
    case 19:{
      storeFront(p,102,177,.84,'霧 港');storeFront(p,890,174,.74,'蘆 灣',true);
      pier(p,0,228,275);pier(p,706,229,294);
      boat(p,400,207,.83,'red',['crate'],'man');boat(p,607,195,.62,'linen',['reed']);
      displayBoard(p,157,215,.77,'班 次',[stage?'頭 班':'待掛牌']);
      person(p,221,221,.97,picks[0]==='ayun'?'yun':'man',1);person(p,798,223,1,'chen',1);
      cargoRack(p,893,219,.94,picks[1]==='dry'?'reed':'crate',stage===2?3:2);break;
    }
    case 20:{
      bridge(p,152,154,1.04,0,true);storeFront(p,77,174,.83,'橋 頭');pennants(p,186,77,302);
      const shipX=ended?668:632;
      const helmsman=ended&&picks[2]==='sail'?'cheng':keeper==='captain'?'porter':'captain';
      boat(p,shipX,215,1.05,ended&&picks[2]==='sail'?'linen':'furled',[],helmsman);
      if(picks[1]==='child'||(ended&&picks[2]==='ride'))person(p,shipX-24,201,.47,'zhou');
      if(ended&&picks[2]==='ride')person(p,shipX+4,201,.62,'cheng');
      pier(p,0,237,498);pier(p,788,227,212);
      cart(p,picks[0]==='street'?229:355,225,1.14);person(p,156,224,1.04,'zhou',1);
      displayBoard(p,881,215,1.0,'霧 港',[stage>=2?'頭 班':'待掛牌']);
      person(p,815,218,1.07,keeper,1);if(past.lamp==='boat'||past.bayReturn==='wick')lantern(p,shipX+69,188,.48,ended);
      break;
    }
  }
}

function counter(p:Pen,chapter:number) {
  const store=chapter===9||chapter===15||chapter===18;
  const fair=chapter===12;
  const dock=fair?'#6c5b4a':store?'#907451':'#96815c';
  polygon(p,'#605847',[[0,248],[314,253],[714,247],[1000,241],[1000,420],[0,420]]);
  polygon(p,dock,[[0,253],[316,258],[711,253],[1000,247],[1000,H],[0,H]]);
  for(let i=0;i<6;i++){
    const yy=254+i*32;
    line(p,'#443c2f60',1.7,[0,yy],[330,yy+5],[711,yy-.7],[1000,yy-6]);
    line(p,'#dac39865',1,[0,yy+2],[330,yy+7],[710,yy+1],[1000,yy-4]);
    const join=(i*157+96)%985;
    line(p,'#55493682',1,[join,yy+2],[join-4,yy+32]);
  }
  for(let i=0;i<58;i++){
    const x=rand(i+378)*W,y=259+rand(i+341)*151,w=9+rand(i+469)*64;
    line(p,i%2?'#553f2c35':'#d8bf8b40',.8,[x,y],[x+w*.4,y-1],[x+w,y+.2]);
  }
  if(fair){bloom(p,209,268,109,'#ffd6783d');bloom(p,807,269,96,'#ffd58c4d');}
}
function mat(p:Pen,x:number,y:number,source:boolean,active:boolean) {
  const base=source?'#91774e':'#47675e', trim=source?'#e5c788':'#cbb785';
  ellipse(p,x+1,y+3,50,11,'#3a342d43');
  polygon(p,base,[[x-56,y-14],[x-43,y-21],[x+42,y-21],[x+55,y-13],[x+49,y+5],[x-47,y+5]]);
  line(p,trim,1.6,[x-52,y-12],[x-42,y-17],[x+41,y-17],[x+51,y-12]);
  line(p,trim,1,[x-43,y+1],[x+43,y+1]);
  if(active){
    bloom(p,x,y-12,54,'#ffe49d83');
    p.strokeStyle='#f9dd91';p.lineWidth=2.8;p.beginPath();p.ellipse(x,y-7,56,17,0,0,Math.PI*2);p.stroke();
  }
}
function caption(p:Pen,x:number,label:string,source:boolean) {
  const w=Math.min(182,Math.max(87,Array.from(label).length*15+22));
  const y=356;
  polygon(p,'#423b2d45',[[x-w/2-2,y+3],[x+w/2+1,y+3],[x+w/2,y+29],[x-w/2,y+30]]);
  polygon(p,source?'#f3dfad':'#e6d8ad',[[x-w/2,y],[x+w/2,y+1],[x+w/2-2,y+26],[x-w/2+1,y+25]]);
  rect(p,x-w/2+4,y+5,2,16,source?'#ad8154':'#859478');
  textAt(p,label,x+2,y+13,15,source?'#634932':'#304d41',w-12);
}
function actionSurface(p:Pen,f:TidesFrame) {
  const x0=130,y0=336;
  if(f.ended){
    // Three objects left on the counter recall this chapter's actual decisions.
    const items:Prop[] = endingObjects(f);
    local(p,500,328,1,()=>{
      polygon(p,'#698274',[[-200,-39],[193,-42],[204,13],[-193,18]]);
      line(p,'#d3bd87',1.2,[-195,-36],[189,-39],[199,10],[-191,14],[-195,-36]);
      items.forEach((kind,i)=>{ellipse(p,(i-1)*110,0,34,5,'#38453b43');prop(p,kind,(i-1)*110,-3,1.03);});
    });
    return;
  }
  const t=f.target!==null?Math.max(0,Math.min(1,f.progress)):0;
  const eased=t*t*(3-2*t);
  mat(p,x0,y0,true,false);caption(p,x0,f.beat.itemLabel,true);
  // A short brass inlay leads from the object to the landing places.
  for(const x of [252,270,288])line(p,'#ead09a87',1.7,[x-3,317],[x+2,320],[x-3,323]);
  f.beat.choices.forEach((choice,i)=>{
    const x=480+i*200,selected=f.target===i;
    mat(p,x,y0,false,selected);prop(p,choice.prop,x,y0-6,1.02-(selected?.17*eased:0));
    caption(p,x,choice.label,false);
  });
  const goal=f.target===null?x0:480+200*f.target;
  const xx=f.drag?f.drag.x:x0+(goal-x0)*eased;
  const yy=f.drag?f.drag.y+13:y0-5-54*4*t*(1-t)-7*eased;
  ellipse(p,xx,f.drag?yy+9:y0-2,23-5*Math.sin(Math.PI*t),3.7,'#493a2e5f');
  prop(p,f.beat.item,xx,yy,1.22);
}
function endingObjects(f:TidesFrame):Prop[] {
  const [a,b,c]=f.picks;
  switch(f.chapter){
    case 7:return ['cart',a==='bridge'?'bell':'boat',c==='grain'?'rice':c==='freight'?'crate':'paper'];
    case 8:return ['rice',b==='share'?'rope':'boat',c==='order'?'paper':'coins'];
    case 9:return [a==='grain'?'rice':'paper',b==='grain'?'rice':'paper',c==='return'?'ticket':'coins'];
    case 10:return ['paper','oil',c==='boat'?'boat':'lamp'];
    case 11:return [a==='xiaoman'?'boat':'cart',b==='people'?'ticket':'crate',c==='pledge'?'paper':'rope'];
    case 12:return [a==='bread'?'bread':a==='night'?'lamp':'crate',b==='bulk'?'coins':'ticket',c==='tomorrow'?'paper':'coins'];
    case 13:return [a==='sample'?'reed':'coins',b==='store'?'key':'boat',c==='reeds'?'reed':'crate'];
    case 14:return [a==='parcel'?'crate':'reed',b==='swap'||b==='post'?'crate':'boat',c==='wick'?'lamp':'coins'];
    case 15:return ['chalk',b==='rice'?'rice':'reed','key'];
    case 16:return [a==='check'?'key':'paper',b==='bakery'?'bread':'rice',c==='public'?'bell':'chalk'];
    case 17:return ['boat',b==='timber'?'crate':b==='shuttle'?'boat':'ticket',c==='crew'?'rope':'paper'];
    case 18:return ['ticket','paper',c==='reserve'?'ticket':c==='transfer'?'boat':'bell'];
    case 19:return [a==='ayun'?'cart':'boat',b==='dry'?'reed':'crate','bell'];
    default:return ['cart','ticket',c==='ride'?'ticket':'boat'];
  }
}
export function drawTides(canvas:HTMLCanvasElement,f:TidesFrame):void {
  const p=canvas.getContext('2d');
  if(!p)return;
  const scale=typeof window!=='undefined'&&window.devicePixelRatio>1?2:1;
  if(canvas.width!==W*scale||canvas.height!==H*scale){canvas.width=W*scale;canvas.height=H*scale;}
  p.save();p.setTransform(scale,0,0,scale,0,0);p.lineJoin='round';p.lineCap='round';
  panorama(p,lightByChapter[f.chapter-7]??'morning',f.chapter>=13&&f.chapter<=16);
  dockScene(p,f);counter(p,f.chapter);actionSurface(p,f);
  p.restore();
}
