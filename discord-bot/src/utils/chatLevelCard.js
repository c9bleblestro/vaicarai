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
export function drawChatLevelCard(ctx,{displayName,username,avatar,fromLevel,toLevel,totalXp,mode='levelup'}){
  const level=toLevel??1;
  const prog=xpProgress(totalXp??0);
  ctx.clearRect(0,0,W,H);
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#08040c');bg.addColorStop(.45,'#1a0a18');bg.addColorStop(1,'#280a1e');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // Recortes magenta em camadas, não referentes a futebol.
  ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#ff4cad';ctx.lineWidth=13;
  ctx.beginPath();ctx.moveTo(0,105);ctx.bezierCurveTo(250,-95,520,-15,880,80);ctx.stroke();
  ctx.beginPath();ctx.moveTo(670,H);ctx.bezierCurveTo(980,270,1310,465,1600,250);ctx.stroke();ctx.restore();
  ctx.save();ctx.shadowColor=PINK;ctx.shadowBlur=18;ctx.lineWidth=3;ctx.strokeStyle='#f94da7';rounded(ctx,3,3,W-6,H-6,45);ctx.stroke();ctx.restore();
  // Aura + avatar à esquerda.
  const grad=ctx.createRadialGradient(186,194,15,186,194,145);
  grad.addColorStop(0,'#ff79c8');grad.addColorStop(.7,'#ef2a92');grad.addColorStop(1,'#7d194d');
  ctx.fillStyle=grad;ctx.beginPath();ctx.arc(186,197,136,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(186,197,110,0,Math.PI*2);ctx.clip();
  if(avatar){const w=avatar.width,h=avatar.height;const side=Math.min(w,h);ctx.drawImage(avatar,(w-side)/2,(h-side)/2,side,side,76,87,220,220);}
  else drawAvatarFallback(ctx);
  ctx.restore();
  ctx.lineWidth=10;ctx.strokeStyle='#ff77c8';ctx.beginPath();ctx.arc(186,197,115,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#ffafd7';ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.arc(186,197,141,-Math.PI/2,-Math.PI/2+Math.PI*.22);ctx.stroke();
  fillRounded(ctx,119,323,138,42,23,'#ff80c6');
  ctx.font='bold 26px "DejaVu Sans", sans-serif';ctx.fillStyle='#160516';ctx.textAlign='center';ctx.fillText('NÍV. '+level,188,352);
  ctx.textAlign='left';
  fillRounded(ctx,447,62,575,71,28,'rgba(104,16,64,.30)');
  ctx.strokeStyle='#f448a3';ctx.lineWidth=2;rounded(ctx,447,62,575,71,28);ctx.stroke();
  ctx.fillStyle='#ff79be';ctx.font='bold 37px "DejaVu Sans", sans-serif';
  ctx.fillText(mode==='levelup'?'✦ SUBIU DE NÍVEL':'✦ SEU PROGRESSO',488,109);
  ctx.fillStyle='#fff';ctx.font='bold 59px "DejaVu Sans", sans-serif';
  ctx.fillText(clipText(displayName,22),466,213);
  ctx.fillStyle='#c4b7c6';ctx.font='28px "DejaVu Sans", sans-serif';
  ctx.fillText('@'+clipText(username,28),468,252);
  // Progressão / níveis à direita.
  ctx.fillStyle='#bcb0ba';ctx.font='bold 28px "DejaVu Sans", sans-serif';ctx.textAlign='right';ctx.fillText('NÍVEL',1523,106);
  ctx.fillStyle='#6e5b6b';ctx.font='bold 93px "DejaVu Sans", sans-serif';ctx.fillText(String(mode==='levelup'?fromLevel:level),1313,240);
  ctx.fillStyle='#ff58a8';ctx.font='bold 85px "DejaVu Sans", sans-serif';ctx.fillText('➜',1423,228);
  ctx.fillStyle='#ff5bb7';ctx.font='bold 113px "DejaVu Sans", sans-serif';ctx.fillText(String(level),1547,245);
  // Barra dinâmica.
  fillRounded(ctx,445,296,1085,19,10,'#2d2530');
  if(prog.current>0){
    const fraction=Math.max(.019,prog.percent);
    const bar=ctx.createLinearGradient(445,0,445+1085*fraction,0);bar.addColorStop(0,'#fd2697');bar.addColorStop(1,'#ffb5dc');
    fillRounded(ctx,445,296,1085*fraction,19,10,bar);
  }
  ctx.font='bold 27px "DejaVu Sans", sans-serif';ctx.fillStyle='#f7e4f1';ctx.textAlign='left';
  ctx.fillText(prog.current.toLocaleString('pt-BR')+' / '+prog.required.toLocaleString('pt-BR')+' XP',447,363);
  ctx.textAlign='right';ctx.fillStyle='#c7b4c2';ctx.font='25px "DejaVu Sans", sans-serif';
  ctx.fillText('nível '+(level+1)+' em '+prog.remaining.toLocaleString('pt-BR')+' XP',1528,363);
  ctx.textAlign='left';ctx.fillStyle='#aa7896';ctx.font='19px "DejaVu Sans", sans-serif';
  ctx.fillText('COMUNIDADE • PROGRESSÃO POR CONVERSA',447,402);
}
export async function createChatLevelImage(values){
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
  const avatar=await avatarImage(values.avatarUrl);
  drawChatLevelCard(ctx,{...values,avatar});
  return canvas.toBuffer('image/png');
}
