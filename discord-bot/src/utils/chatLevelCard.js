import {createCanvas,loadImage} from '@napi-rs/canvas';
import {xpProgress} from './chatLevelMath.js';

/** Arte única por usuário: sem dados fixos nem botões desenhados. */
const W=1600,H=430;
const PINK='#ff369d';
function rounded(ctx,x,y,w,h,r){
  const k=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+k,y);ctx.arcTo(x+w,y,x+w,y+h,k);
  ctx.arcTo(x+w,y+h,x,y+h,k);ctx.arcTo(x,y+h,x,y,k);ctx.arcTo(x,y,x+w,y,k);ctx.closePath();
}
function fillRounded(ctx,x,y,w,h,r,color){ctx.fillStyle=color;rounded(ctx,x,y,w,h,r);ctx.fill();}
function clipText(text,max=22){const s=String(text??'Membro').replace(/[\r\n\t]/g,' ').trim();return s.length>max?s.slice(0,max-1)+'…':s||'Membro';}
function drawAvatarFallback(ctx){
  ctx.save();ctx.fillStyle='#ff78c5';ctx.beginPath();ctx.arc(186,198,109,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(186,171,34,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(186,249,69,45,0,Math.PI,0);ctx.fill();ctx.restore();
}
async function avatarImage(url) {
  if(!url||!/^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\//.test(url))return null;
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(4800)});
    if(!r.ok||!/image\/(?:png|jpe?g|webp)/i.test(r.headers.get('content-type')??''))return null;
    const bytes=Buffer.from(await r.arrayBuffer());
    if(bytes.length>650_000||bytes.length<100)return null;
    return await loadImage(bytes);
  }catch{return null;}
}
// Glossy neon artwork. All profile values are painted separately from the background.
function linear(ctx,x1,y1,x2,y2,stops){
  const g=ctx.createLinearGradient(x1,y1,x2,y2);
  for(const [p,c] of stops)g.addColorStop(p,c);
  return g;
}
function glowStroke(ctx,shape,color,width,blur=15){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.shadowColor='#ff249a';ctx.shadowBlur=blur;shape();ctx.stroke();
  ctx.restore();
}
function ribbon(ctx,shape,stops,x1,y1,x2,y2){
  ctx.save();shape();ctx.fillStyle=linear(ctx,x1,y1,x2,y2,stops);ctx.fill();ctx.restore();
}
function star(ctx,x,y,size){
  ctx.save();ctx.translate(x,y);
  ctx.beginPath();ctx.moveTo(0,-size);ctx.quadraticCurveTo(2,-3,size*.72,0);
  ctx.quadraticCurveTo(2,3,0,size);ctx.quadraticCurveTo(-2,3,-size*.72,0);
  ctx.quadraticCurveTo(-2,-3,0,-size);ctx.closePath();
  ctx.fillStyle='#ffa0d7';ctx.shadowColor='#ff2095';ctx.shadowBlur=18;ctx.fill();ctx.restore();
}
function fit(ctx,value,maxWidth,size,style='bold',min=18){
  const text=String(value);
  for(let s=size;s>=min;s-=1){
    ctx.font=style+' '+s+'px "DejaVu Sans", sans-serif';
    if(ctx.measureText(text).width<=maxWidth)return text;
  }
  const chars=Array.from(text);
  while(chars.length&&ctx.measureText(chars.join('')+'…').width>maxWidth)chars.pop();
  return chars.join('')+'…';
}
function ring(ctx,x,y,r,color,width,blur=0){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.shadowColor='#ff269a';ctx.shadowBlur=blur;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.restore();
}
export function drawChatLevelCard(ctx,{displayName,username,avatar,fromLevel,toLevel,totalXp,mode='levelup'}){
  const level=toLevel??1,prog=xpProgress(totalXp??0);
  ctx.clearRect(0,0,W,H);
  ctx.save();
  rounded(ctx,2,2,W-4,H-4,45);ctx.clip();
  ctx.fillStyle=linear(ctx,0,0,W,H,[[0,'#28091e'],[.28,'#130910'],[.63,'#140b12'],[1,'#210c19']]);
  ctx.fillRect(0,0,W,H);
  // Subtle corner lighting and glossy layered ribbons, matching the pink reference.
  for(const [x,y,r] of [[165,35,350],[1280,-45,340],[1480,430,400],[90,430,270]]){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(231,20,123,.23)');g.addColorStop(1,'rgba(231,20,123,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  const top=()=>{ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(540,0);ctx.bezierCurveTo(315,18,150,43,0,155);ctx.closePath();};
  ribbon(ctx,top,[[0,'#54112e'],[.45,'#310b20'],[1,'#110710']],0,0,330,135);
  glowStroke(ctx,()=>{ctx.beginPath();ctx.moveTo(0,155);ctx.bezierCurveTo(150,43,315,18,540,0);},'#c91a72',1.5,9);
  const sweep=()=>{ctx.beginPath();ctx.moveTo(800,0);ctx.lineTo(1270,0);ctx.bezierCurveTo(1110,45,1055,104,870,141);ctx.bezierCurveTo(1050,63,1025,32,800,0);ctx.closePath();};
  ribbon(ctx,sweep,[[0,'#250a1b'],[.35,'#6a0d3b'],[.74,'#f51b89'],[.91,'#ffacd8'],[1,'#fff0f9']],940,90,1215,-15);
  glowStroke(ctx,()=>{ctx.beginPath();ctx.moveTo(870,141);ctx.bezierCurveTo(1055,104,1110,45,1270,0);},'#ff5eb2',1.6,12);
  const lower=()=>{ctx.beginPath();ctx.moveTo(0,333);ctx.bezierCurveTo(106,431,290,426,470,428);ctx.lineTo(0,430);ctx.closePath();};
  ribbon(ctx,lower,[[0,'#ff449f'],[.35,'#821245'],[.75,'#3b0b28'],[1,'#20091a']],0,430,330,335);
  const bottom=()=>{ctx.beginPath();ctx.moveTo(720,H);ctx.bezierCurveTo(960,315,1065,349,1250,386);ctx.bezierCurveTo(1390,417,1510,371,1600,306);ctx.lineTo(1600,H);ctx.closePath();};
  ribbon(ctx,bottom,[[0,'#ffafd9'],[.13,'#ff309e'],[.31,'#6a103d'],[.60,'#320b24'],[.85,'#6a0c42'],[1,'#ff4ba8']],720,430,1600,350);
  const bottomLip=()=>{ctx.beginPath();ctx.moveTo(770,H);ctx.bezierCurveTo(1000,355,1110,390,1270,405);ctx.bezierCurveTo(1410,422,1510,390,1600,334);ctx.lineTo(1600,H);ctx.closePath();};
  ribbon(ctx,bottomLip,[[0,'#ad1a61'],[.45,'#350b25'],[.7,'#560e35'],[1,'#ff68ba']],720,430,1600,370);
  glowStroke(ctx,()=>{ctx.beginPath();ctx.moveTo(720,H);ctx.bezierCurveTo(960,315,1065,349,1250,386);ctx.bezierCurveTo(1390,417,1510,371,1600,306);},'#ff78c1',1.5,10);
  // Crown silhouette behind the level, kept outside the name area.
  ctx.save();ctx.strokeStyle='rgba(162,27,94,.28)';ctx.lineWidth=22;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(1178,222);ctx.lineTo(1148,91);ctx.lineTo(1248,139);
  ctx.lineTo(1342,86);ctx.lineTo(1438,139);ctx.lineTo(1534,91);ctx.lineTo(1500,222);ctx.stroke();ctx.restore();
  star(ctx,48,310,13);star(ctx,1033,172,16);star(ctx,1550,230,13);
  // Outer edge: luminous rim rather than a flat pink stroke.
  const edge=()=>rounded(ctx,3,3,W-6,H-6,45);
  glowStroke(ctx,edge,'#ff269a',12,30);
  glowStroke(ctx,edge,'#ff75be',3,10);
  ctx.strokeStyle=linear(ctx,0,0,W,H,[[0,'#ff8acb'],[.26,'#6c244a'],[.55,'#ffb7e0'],[.82,'#8b2458'],[1,'#ff91cd']]);
  ctx.lineWidth=2;edge();ctx.stroke();
  // Avatar ring: real avatar drawn on top of the reusable artwork.
  const ax=208,ay=194;
  const aura=ctx.createRadialGradient(ax,ay,100,ax,ay,153);
  aura.addColorStop(0,'rgba(255,45,150,0)');aura.addColorStop(.57,'rgba(255,45,150,.55)');aura.addColorStop(1,'rgba(255,45,150,0)');
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(ax,ay,153,0,Math.PI*2);ctx.fill();
  ring(ctx,ax,ay,137,'#7d174b',8,8);
  ring(ctx,ax,ay,132,'#ff46a7',2.6,17);
  const rim=linear(ctx,ax-90,ay-110,ax+100,ay+115,[[0,'#ffc7e7'],[.35,'#ff72bc'],[.75,'#f22591'],[1,'#ffb4db']]);
  ring(ctx,ax,ay,113,rim,12,8);
  ctx.save();ctx.beginPath();ctx.arc(ax,ay,107,0,Math.PI*2);ctx.clip();
  if(avatar){
    const w=avatar.width,h=avatar.height,side=Math.min(w,h);
    ctx.drawImage(avatar,(w-side)/2,(h-side)/2,side,side,ax-107,ay-107,214,214);
  }else{
    ctx.translate(ax-186,ay-198);drawAvatarFallback(ctx);
  }
  ctx.restore();
  ctx.save();ctx.lineCap='round';
  glowStroke(ctx,()=>{ctx.beginPath();ctx.arc(ax,ay,147,-Math.PI*.55,-Math.PI*.39);},'#ff379e',13,22);
  glowStroke(ctx,()=>{ctx.beginPath();ctx.arc(ax,ay,147,-Math.PI*.55,-Math.PI*.39);},'#ffd1e9',9,13);
  ctx.restore();
  const badge=()=>rounded(ctx,ax-70,329,140,43,23);
  ctx.save();ctx.shadowColor='#ff2198';ctx.shadowBlur=18;
  fillRounded(ctx,ax-70,329,140,43,23,linear(ctx,0,329,0,372,[[0,'#fff0fa'],[.28,'#ffb8de'],[.72,'#ff58ae'],[1,'#ffb8de']]));
  ctx.restore();glowStroke(ctx,badge,'#fff0fa',2,8);
  ctx.textAlign='center';ctx.fillStyle='#410b2c';
  const badgeText=fit(ctx,'NÍV. '+level,126,27,'italic bold');ctx.fillText(badgeText,ax,359);
  // Header and identity.
  const hx=405,hy=53,hw=558,hh=63;
  fillRounded(ctx,hx,hy,hw,hh,19,linear(ctx,hx,hy,hx+hw,hy+hh,[[0,'#3a0d28'],[1,'#210c1b']]));
  glowStroke(ctx,()=>rounded(ctx,hx,hy,hw,hh,19),'#ff449e',2.4,17);
  star(ctx,hx+34,hy+32,16);
  ctx.textAlign='left';ctx.fillStyle=linear(ctx,0,hy,0,hy+hh,[[0,'#ffb6dc'],[.65,'#ff5bad'],[1,'#e72586']]);
  ctx.font='italic bold 35px "DejaVu Sans", sans-serif';
  ctx.fillText(mode==='levelup'?'SUBIU DE NÍVEL':'SEU PROGRESSO',hx+63,hy+43);
  ctx.fillStyle='#fff8fc';
  const name=fit(ctx,clipText(displayName,80),690,60,'bold',24);ctx.fillText(name,405,197);
  ctx.fillStyle='#cbbbc8';const handle=fit(ctx,'@'+clipText(username,80),690,28,'normal',18);ctx.fillText(handle,407,237);
  // Slanted title plate and glossy dynamic level numerals.
  const plate=()=>{ctx.beginPath();ctx.moveTo(1290,53);ctx.lineTo(1482,53);ctx.lineTo(1460,101);ctx.lineTo(1266,101);ctx.closePath();};
  ctx.fillStyle=linear(ctx,1266,53,1482,101,[[0,'#350b23'],[1,'#170b14']]);plate();ctx.fill();
  glowStroke(ctx,plate,'#ff6eb7',2,13);
  ctx.textAlign='center';ctx.fillStyle='#fff0fa';ctx.font='italic bold 28px "DejaVu Sans", sans-serif';ctx.fillText('NÍVEL',1374,86);
  ctx.fillStyle=linear(ctx,0,117,0,244,[[0,'#c2b1c0'],[1,'#786b79']]);
  const previous=fit(ctx,String(mode==='levelup'?(fromLevel??level):level),120,99,'italic bold',18);ctx.fillText(previous,1235,230);
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  glowStroke(ctx,()=>{ctx.beginPath();ctx.moveTo(1322,186);ctx.lineTo(1379,186);ctx.moveTo(1358,164);ctx.lineTo(1381,186);ctx.lineTo(1358,208);},'#ff56ab',8,16);
  ctx.restore();
  ctx.save();ctx.fillStyle=linear(ctx,0,111,0,245,[[0,'#ffe3f1'],[.32,'#ff87c3'],[1,'#fb2796']]);
  ctx.shadowColor='#ff228e';ctx.shadowBlur=20;
  const current=fit(ctx,String(level),123,117,'italic bold',18);ctx.fillText(current,1470,236);ctx.restore();
  // XP track with precise dynamic fill and a polished leading highlight.
  const bx=405,by=274,bw=1117,bh=25;
  const track=()=>rounded(ctx,bx,by,bw,bh,bh/2);
  fillRounded(ctx,bx,by,bw,bh,bh/2,linear(ctx,0,by,0,by+bh,[[0,'#1d101c'],[.5,'#321c2d'],[1,'#25121f']]));
  glowStroke(ctx,track,'#bd578c',1.8,12);
  if(prog.current>0){
    const fraction=Math.max(0,Math.min(1,prog.percent)),fillWidth=bw*fraction;
    if(fillWidth>0){
      ctx.save();track();ctx.clip();ctx.shadowColor='#ff269c';ctx.shadowBlur=15;
      fillRounded(ctx,bx,by+2,fillWidth,bh-4,(bh-4)/2,linear(ctx,bx,by,bx+fillWidth,by+bh,[[0,'#ff168e'],[.60,'#ff61b4'],[1,'#ffd7eb']]));
      ctx.restore();
    }
  }
  ctx.textAlign='left';ctx.fillStyle='#fff5fb';ctx.font='bold 28px "DejaVu Sans", sans-serif';
  ctx.fillText(prog.current.toLocaleString('pt-BR')+' / '+prog.required.toLocaleString('pt-BR')+' XP',405,338);
  ctx.textAlign='right';ctx.fillStyle='#d2bdcb';ctx.font='25px "DejaVu Sans", sans-serif';
  ctx.fillText('nível '+(level+1)+' em '+prog.remaining.toLocaleString('pt-BR')+' XP',1522,338);
  ctx.textAlign='left';ctx.fillStyle='#b99bac';ctx.font='18px "DejaVu Sans", sans-serif';
  ctx.fillText('COMUNIDADE • PROGRESSÃO POR CONVERSA',405,381);
  ctx.restore();
}
export async function createChatLevelImage(values){
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
  const avatar=await avatarImage(values.avatarUrl);
  drawChatLevelCard(ctx,{...values,avatar});
  return canvas.toBuffer('image/png');
}
