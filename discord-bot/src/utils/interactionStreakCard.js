import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {fileURLToPath} from 'node:url';
import {AttachmentBuilder,MediaGalleryBuilder,MediaGalleryItemBuilder,SeparatorBuilder,TextDisplayBuilder} from 'discord.js';
import {streakMilestone} from './interactionStreak.js';
import {drawEvolutionFlame,drawEvolutionFrame} from './interactionStreakArt.js';

try{GlobalFonts.registerFromPath(fileURLToPath(new URL('../../fonts/Roboto-Regular.ttf',import.meta.url)),'StreakRoboto');
GlobalFonts.registerFromPath(fileURLToPath(new URL('../../fonts/Roboto-Bold.ttf',import.meta.url)),'StreakRoboto');}catch{}
const font='StreakRoboto, sans-serif';
const nameOf=u=>String(u?.displayName??u?.globalName??u?.username??u?.user?.username??'Membro');
function round(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function label(ctx,text,x,y,size,color='#f5f0ed',bold=false,max=Infinity){
  ctx.font=(bold?'bold ':'')+size+'px '+font;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
  let value=String(text);while(value.length>1&&ctx.measureText(value).width>max)value=value.slice(0,-1);
  if(value!==String(text))value=value.slice(0,-1)+'…';
  ctx.fillText(value,x,y);
}
const avatarCache=new Map();
async function avatar(user){
  try{const url=user?.displayAvatarURL?.({extension:'png',size:128,forceStatic:true})??user?.user?.displayAvatarURL?.({extension:'png',size:128,forceStatic:true});
    if(!url)return null;
    const now=Date.now(),cached=avatarCache.get(url);if(cached&&cached.until>now)return await cached.image;
    if(avatarCache.size>=256)avatarCache.delete(avatarCache.keys().next().value);
    const image=(async()=>{try{const res=await fetch(url,{signal:AbortSignal.timeout(2500)});if(!res.ok)return null;return await loadImage(Buffer.from(await res.arrayBuffer()));}catch{return null;}})();
    avatarCache.set(url,{until:now+60_000,image});return await image;}catch{return null;}
}
function portrait(ctx,img,name,x,y,tier,active){
  const color=active?tier.color:'#88818b';
  ctx.save();ctx.beginPath();ctx.arc(x,y,49,0,Math.PI*2);ctx.fillStyle='#363138';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,44,0,Math.PI*2);ctx.clip();
  if(img){const size=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,x-44,y-44,88,88);}
  else label(ctx,name.slice(0,1).toUpperCase(),x,y,36,'#f6ede7',true);
  ctx.restore();
  if(active)drawEvolutionFrame(ctx,x,y,tier.days);
  label(ctx,name,x,y+66,17,'#ede6e3',true,180);
}
function flame(ctx,x,y,color){
  ctx.save();ctx.translate(x,y);ctx.scale(.72,.72);
  ctx.beginPath();ctx.moveTo(1,-42);ctx.bezierCurveTo(11,-20,28,-13,28,7);ctx.bezierCurveTo(28,26,15,37,0,37);ctx.bezierCurveTo(-22,37,-34,20,-29,3);ctx.bezierCurveTo(-26,-9,-17,-18,-14,-31);ctx.bezierCurveTo(-7,-24,-4,-14,-3,-8);ctx.bezierCurveTo(5,-19,6,-30,1,-42);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  ctx.beginPath();ctx.moveTo(0,-5);ctx.bezierCurveTo(5,9,14,11,13,21);ctx.bezierCurveTo(12,31,-5,34,-11,22);ctx.bezierCurveTo(-15,13,-5,5,0,-5);ctx.fillStyle='#fff1bf';ctx.fill();ctx.restore();
}
export function streakStatus(s){
  return s.complete?'Foguinho mantido hoje!':s.mask?'Falta a outra pessoa interagir hoje.':'Interajam entre si para acender o foguinho de hoje.';
}
export async function renderStreakCard(s,a,b){
  const [avA,avB]=await Promise.all([avatar(a),avatar(b)]);
  const {tier,next}=streakMilestone(s.days);
  const c=createCanvas(760,264),ctx=c.getContext('2d');
  round(ctx,0,0,760,264,24);ctx.fillStyle='#242329';ctx.fill();
  round(ctx,1,1,758,262,24);ctx.strokeStyle='#454049';ctx.lineWidth=2;ctx.stroke();
  label(ctx,'FOGUINHO  •  '+tier.name.toUpperCase(),380,23,15,'#bdb1b4',true);
  portrait(ctx,avA,nameOf(a),120,91,tier,s.days>0);portrait(ctx,avB,nameOf(b),640,91,tier,s.days>0);
  if(s.days>0)drawEvolutionFlame(ctx,337,70,tier.days);else flame(ctx,337,70,'#88818b');
  label(ctx,String(s.days),397,70,48,'#fff4ec',true,140);
  label(ctx,s.days===1?'dia consecutivo':'dias consecutivos',380,113,17,'#c6bcc0');
  label(ctx,s.days?'Uma amizade em chamas!':'Uma amizade começa aqui!',380,146,20,'#f4ece7',true);
  label(ctx,streakStatus(s),380,181,16,s.complete?'#a7d9a9':'#d6c1b1',false,700);
  const x=34,y=209,w=692;
  round(ctx,x,y,w,9,4.5);ctx.fillStyle='#454149';ctx.fill();
  const progress=next?Math.min(1,s.days/next.days):1;
  if(progress>0){round(ctx,x,y,Math.max(2,w*progress),9,4.5);ctx.fillStyle=tier.color;ctx.fill();}
  label(ctx,next?'Próxima chama: '+next.name+' • '+s.days+'/'+next.days+' dias':'Todas as chamas desbloqueadas',380,239,15,'#d4c8ca',false,700);
  return c.toBuffer('image/png');
}
export async function appendStreakCard(payload,s,a,b,filename='foguinho.png'){
  const container=payload.components[0];
  try{
    const png=await renderStreakCard(s,a,b);
    const file=new AttachmentBuilder(png,{name:filename});
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://'+filename).setDescription('Foguinho: '+s.days+' dias consecutivos. '+streakStatus(s))));
    return {...payload,files:[...(payload.files??[]),file]};
  }catch(error){
    console.warn('[FOGUINHO CARD]',error?.message??error);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('🔥 **'+s.days+' dias consecutivos** · '+streakStatus(s)));
    return payload;
  }
}
