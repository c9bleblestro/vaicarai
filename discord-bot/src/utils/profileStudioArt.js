import {createCanvas,loadImage} from '@napi-rs/canvas';

export const PROFILE_THEMES={
  rose:{name:'Rosa noturno',bg:['#211520','#382233'],panel:'#382733',accent:'#f3a0c5',light:'#ffe0ed'},
  blush:{name:'Rosa pastel',bg:['#fff3f5','#f4dce6'],panel:'#fff5f8',accent:'#bb527b',light:'#fff9fb'},
  lilac:{name:'Lilás lunar',bg:['#201a33','#3f315b'],panel:'#362c4a',accent:'#c5b1ff',light:'#f0eaff'},
  blue:{name:'Azul celestial',bg:['#162535','#293e55'],panel:'#293d50',accent:'#9dcdee',light:'#e2f4ff'},
  noir:{name:'Preto elegante',bg:['#141417','#29292e'],panel:'#25252b',accent:'#d0c3ca',light:'#f6eff4'},
  cream:{name:'Baunilha',bg:['#fff6e6','#f2e0ca'],panel:'#fff8ec',accent:'#a96a62',light:'#fff9f2'},
  classic:{name:'Clássico',bg:['#202124','#2b2d30'],panel:'#1c1e21',accent:'#bd42ef',light:'#ffffff'}
};
export const PROFILE_EFFECTS={off:'Desativada (PNG)',banner:'Somente banner GIF',sparkle:'Brilhos suaves',petals:'Pétalas flutuantes',hearts:'Corações flutuantes'};
export const PROFILE_DECORS={floral:'Flores delicadas',cat:'Gatinho',stars:'Estrelas',bow:'Laços',none:'Minimalista'};
export function normalizeAppearance(value={}){
  value=value??{};
  const pick=(key,options,fallback)=>typeof key==='string'&&Object.hasOwn(options,key)?key:fallback;
  return {theme:pick(value.theme,PROFILE_THEMES,'rose'),effect:pick(value.effect,PROFILE_EFFECTS,'off'),decor:pick(value.decor,PROFILE_DECORS,'floral'),signature:String(value.signature??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,42)};
}
const W=800,H=600;
const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
const tau=Math.PI*2;
function star(ctx,x,y,r){
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+r*.16,y-r*.16,x+r,y);ctx.quadraticCurveTo(x+r*.16,y+r*.16,x,y+r);ctx.quadraticCurveTo(x-r*.16,y+r*.16,x-r,y);ctx.quadraticCurveTo(x-r*.16,y-r*.16,x,y-r);ctx.fill();
}
function heart(ctx,x,y,s){
  ctx.beginPath();ctx.moveTo(x,y+s*.65);ctx.bezierCurveTo(x-s*1.3,y-s*.25,x-s*.65,y-s,x,y-s*.3);ctx.bezierCurveTo(x+s*.65,y-s,x+s*1.3,y-s*.25,x,y+s*.65);ctx.fill();
}
function flower(ctx,x,y,r,accent,light){
  ctx.save();ctx.translate(x,y);
  for(let i=0;i<5;i++){
    ctx.save();ctx.rotate(i*tau/5);const g=ctx.createLinearGradient(0,-r,0,0);g.addColorStop(0,light);g.addColorStop(1,accent);ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-r*.66,-r*.4,-r*.57,-r*1.05,-r*.12,-r*.95);ctx.bezierCurveTo(r*.38,-r*1.12,r*.75,-r*.45,0,0);ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=.7;ctx.stroke();ctx.restore();
  }
  ctx.fillStyle='#f8d3a0';ctx.beginPath();ctx.arc(0,0,r*.18,0,tau);ctx.fill();ctx.restore();
}
function bow(ctx,x,y,r,accent,light){
  ctx.save();ctx.translate(x,y);ctx.fillStyle=accent;ctx.strokeStyle=light;ctx.lineWidth=1.4;
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*r*.75,-r*.9,side*r*1.35,-r*.75,side*r*1.1,0);ctx.bezierCurveTo(side*r*1.3,r*.65,side*r*.45,r*.4,0,0);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(side*r*.8,r*1.1);ctx.lineTo(side*r*.4,r*.92);ctx.lineTo(side*r*.18,r*1.2);ctx.closePath();ctx.fill();
  }ctx.fillStyle=light;ctx.beginPath();ctx.ellipse(0,0,r*.24,r*.28,0,0,tau);ctx.fill();ctx.restore();
}
function cat(ctx,x,y,r,accent,light){
  ctx.save();ctx.translate(x,y);ctx.scale(r/30,r/30);ctx.fillStyle=light;ctx.strokeStyle=accent;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-26,5);ctx.quadraticCurveTo(-32,-7,-24,-26);ctx.lineTo(-9,-17);ctx.quadraticCurveTo(0,-21,10,-17);ctx.lineTo(25,-26);ctx.quadraticCurveTo(32,-10,26,6);ctx.quadraticCurveTo(27,20,0,20);ctx.quadraticCurveTo(-28,20,-26,5);ctx.fill();ctx.stroke();
  ctx.fillStyle='#765064';ctx.beginPath();ctx.arc(-11,0,1.8,0,tau);ctx.arc(11,0,1.8,0,tau);ctx.fill();
  ctx.strokeStyle='#765064';ctx.beginPath();ctx.moveTo(-5,5);ctx.quadraticCurveTo(-2,10,0,5);ctx.quadraticCurveTo(3,10,6,5);ctx.stroke();ctx.fillStyle=accent;ctx.globalAlpha=.55;ctx.beginPath();ctx.ellipse(-17,7,4,2,0,0,tau);ctx.ellipse(17,7,4,2,0,0,tau);ctx.fill();ctx.restore();
}
function decorations(ctx,decor,t){
  if(decor==='none')return;
  ctx.save();
  if(decor==='floral'){
    ctx.strokeStyle=t.accent;ctx.globalAlpha=.6;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(3,3);ctx.quadraticCurveTo(40,30,72,7);ctx.moveTo(797,597);ctx.quadraticCurveTo(756,552,713,594);ctx.stroke();
    ctx.globalAlpha=1;flower(ctx,24,21,20,t.accent,t.light);flower(ctx,58,10,11,t.accent,t.light);flower(ctx,777,577,21,t.accent,t.light);flower(ctx,738,591,12,t.accent,t.light);
  }else if(decor==='cat'){cat(ctx,724,181,25,t.accent,t.light);}
  else if(decor==='bow'){bow(ctx,48,94,15,t.accent,t.light);bow(ctx,745,578,13,t.accent,t.light);}
  else if(decor==='stars'){ctx.fillStyle=t.accent;for(const [x,y,r] of [[24,23,10],[773,24,9],[774,576,12],[25,575,8]])star(ctx,x,y,r);}
  ctx.restore();
}
function fit(ctx,text,x,y,w,size,fill,bold=true){
  let s=String(text??'');let n=size;ctx.fillStyle=fill;ctx.font=(bold?'bold ':'')+n+'px BotFont';
  while(n>13&&ctx.measureText(s).width>w){n--;ctx.font=(bold?'bold ':'')+n+'px BotFont';}
  if(ctx.measureText(s).width>w){const chars=Array.from(s);while(chars.length&&ctx.measureText(chars.join('')+'…').width>w)chars.pop();s=chars.join('')+'…';}
  ctx.fillText(s,x,y);
}
function cover(ctx,img,x,y,w,h){
  const scale=Math.max(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);
}
export async function drawStudioProfile(p,h){
  const a=normalizeAppearance(p.appearance),t=PROFILE_THEMES[a.theme];
  const bg1=color(p.cardBg1,t.bg[0]),bg2=color(p.cardBg2,p.cardBg1?bg1:t.bg[1]),panel=color(p.cardPanelColor,t.panel);
  const ink=h.isColorDark(bg1)?'#fff1f7':'#432c3b',panelInk=h.isColorDark(panel)?'#fff1f7':'#432c3b';
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,bg1);gradient.addColorStop(1,bg2);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
  const pill=(x,y,w,hh,r=19)=>{h.roundRect(ctx,x,y,w,hh,r);ctx.fillStyle=panel;ctx.fill();ctx.strokeStyle=t.accent;ctx.globalAlpha=.53;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;};
  h.roundRect(ctx,7,7,786,586,26);ctx.strokeStyle=t.accent;ctx.globalAlpha=.55;ctx.lineWidth=1.3;ctx.stroke();ctx.globalAlpha=1;
  // A área do banner é exclusiva do item equipado, sem sobreposição de desenhos.
  const banner=p._bannerImage?null:p._resolvedBanner??await h.resolveBanner(p.activeBanner,p.guildId,{includeImageData:true});
  let bannerImage=p._bannerImage;
  if(!bannerImage&&banner)try{bannerImage=banner.imageBuffer?await loadImage(Buffer.from(banner.imageBuffer)):await h.loadUrl(banner.imageUrl);}catch{}
  ctx.save();h.roundRect(ctx,24,24,752,140,22);ctx.clip();
  if(bannerImage)cover(ctx,bannerImage,24,24,752,140);
  else{
    const g=ctx.createLinearGradient(24,24,776,164),colors=banner?.gradient??t.bg;g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);ctx.fillStyle=g;ctx.fillRect(24,24,752,140);
    ctx.strokeStyle=t.accent;ctx.globalAlpha=.22;ctx.lineWidth=1.7;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(20,50+i*23);ctx.bezierCurveTo(220,155-i*20,560,-25+i*20,790,70+i*18);ctx.stroke();}
    ctx.globalAlpha=.65;ctx.fillStyle=t.accent;for(const [x,y,r] of [[325,56,7],[455,104,10],[618,48,6],[708,123,8]])star(ctx,x,y,r);
    ctx.globalAlpha=1;
    if(a.decor==='cat'){cat(ctx,465,88,35,t.accent,t.light);cat(ctx,531,88,31,t.accent,t.light);ctx.fillStyle=t.accent;heart(ctx,499,48,10);}
    else if(a.decor==='floral'){flower(ctx,702,77,32,t.accent,t.light);flower(ctx,655,116,18,t.accent,t.light);}
    else if(a.decor==='bow')bow(ctx,690,82,32,t.accent,t.light);
  }
  ctx.restore();h.roundRect(ctx,24,24,752,140,22);ctx.strokeStyle=t.accent;ctx.lineWidth=1.2;ctx.stroke();
  const cx=120,cy=159,r=70;
  ctx.save();ctx.shadowColor=t.accent;ctx.shadowBlur=10;ctx.fillStyle=color(p.ringBorderColor,t.accent);ctx.beginPath();ctx.arc(cx,cy,r+6,0,tau);ctx.fill();ctx.restore();
  if(p.activeRing)await h.drawAvatarRing(ctx,cx,cy,r+3,p.activeRing);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,tau);ctx.clip();
  try{cover(ctx,await h.loadUrl(p.avatarUrl),cx-r,cy-r,2*r,2*r);}catch{ctx.fillStyle=panel;ctx.fillRect(cx-r,cy-r,2*r,2*r);ctx.fillStyle=t.accent;ctx.font='bold 48px BotFont';ctx.textAlign='center';ctx.fillText(Array.from(p.username||'?')[0],cx,cy+17);}
  ctx.restore();
  if(p.activePet){const pet=await h.loadEmojiImg(p.activePet).catch(()=>null);if(pet){ctx.fillStyle=panel;ctx.beginPath();ctx.arc(177,211,19,0,tau);ctx.fill();ctx.strokeStyle=t.accent;ctx.stroke();ctx.drawImage(pet,163,197,28,28);}}
  ctx.textAlign='left';
  fit(ctx,p.username,225,196,a.decor==='cat'?450:530,34,ink);
  pill(220,207,556,45,20);
  ctx.save();h.roundRect(ctx,228,211,540,37,15);ctx.clip();ctx.font='16px BotFont';ctx.fillStyle=panelInk;
  await h.drawBioWithEmojis(ctx,p.bio||'Personalize sua bio no bot.',233,234,530,19,16);ctx.restore();
  const level=p.chatLevel?{level:p.chatLevel.level,current:p.chatLevel.current,needed:p.chatLevel.required}:h.computeLevel(p.xp);
  const stats=[
    ['Nível',String(level.level)],['XP',level.current+'/'+level.needed],['Reputação',String(p.reps??0)],['Coins',h.fmtCompact(p.balance??0)],['Casado(a)',p.marriedToName??'Nenhum'],['Amigo(a)',p.bestFriendName??'Nenhum']
  ];
  const sheet=await h.loadProfileStatIconSheet();
  for(let i=0;i<stats.length;i++){
    const x=24+(i%2)*382,y=270+Math.floor(i/2)*75,w=370;
    pill(x,y,w,66);
    if(!h.drawProfileStatIcon(ctx,sheet,i,x+11,y+8,50)){ctx.save();h.STAT_ICON_CONFIGS[i].fallback(ctx,x+11,y+8,50);ctx.restore();}
    fit(ctx,stats[i][0],x+74,y+22,270,15,panelInk,false);
    fit(ctx,stats[i][1],x+74,y+47,i>=4?222:280,23,panelInk);
    if(i===1){
      const progress=Math.min(1,Math.max(0,level.needed?level.current/level.needed:0)),bw=132,bx=x+220;
      ctx.fillStyle=h.isColorDark(panel)?'#ffffff22':'#00000015';h.roundRect(ctx,bx,y+40,bw,8,4);ctx.fill();
      if(progress>0){ctx.save();h.roundRect(ctx,bx,y+40,bw,8,4);ctx.clip();ctx.fillStyle=t.accent;ctx.fillRect(bx,y+40,bw*progress,8);ctx.restore();}
    }
    const days=i===4?p.marriedStreak:i===5?p.friendStreak:0;
    if(days>0){ctx.fillStyle='#f1a256';ctx.beginPath();ctx.moveTo(x+312,y+28);ctx.bezierCurveTo(x+306,y+20,x+317,y+15,x+315,y+9);ctx.bezierCurveTo(x+329,y+20,x+324,y+28,x+318,y+31);ctx.closePath();ctx.fill();fit(ctx,String(days),x+331,y+27,33,14,panelInk);}
  }
  pill(24,503,448,69,20);fit(ctx,'Badges',42,528,120,18,panelInk);
  const keys=h.computeEarnedBadgeKeys(p);
  const imgs=await Promise.all(keys.map(k=>h.loadEmojiImg(p.guildBadgeEmojis[k]??h.BADGE_DEFS.find(b=>b.key===k)?.defaultEmoji).catch(()=>null)));
  if(!keys.length)fit(ctx,'Nenhuma conquista ainda',42,551,408,15,panelInk,false);
  else for(let i=0;i<keys.length;i++){
    const x=43+i*37;ctx.fillStyle=h.BADGE_DEFS.find(b=>b.key===keys[i])?.color??t.accent;ctx.beginPath();ctx.arc(x+14,550,13,0,tau);ctx.fill();
    if(imgs[i])ctx.drawImage(imgs[i],x+3,539,22,22);
    else{ctx.fillStyle=t.light;star(ctx,x+14,550,7);}
  }
  pill(484,503,292,69,20);fit(ctx,a.signature?'Assinatura':'SUBSTANCY',502,526,250,14,panelInk,false);
  fit(ctx,a.signature||'Seu perfil, seu estilo.',502,551,254,23,panelInk);
  decorations(ctx,a.decor,t);
  return p._returnCanvas?canvas:canvas.toBuffer('image/png');
}
export function drawProfileEffect(ctx,appearance,phase){
  const a=normalizeAppearance(appearance),t=PROFILE_THEMES[a.theme];
  if(['off','banner'].includes(a.effect))return;
  // Efeitos ficam na margem ou no entorno da foto, nunca sobre os dados.
  ctx.save();ctx.fillStyle=t.accent;
  if(a.effect==='sparkle'){
    for(let i=0;i<12;i++){const ang=i*tau/12+phase*tau;const x=120+Math.cos(ang)*84,y=159+Math.sin(ang)*84;ctx.globalAlpha=.25+.65*(.5+.5*Math.sin(ang*2));star(ctx,x,y,3+2*(.5+.5*Math.cos(ang)));}
  }else for(let i=0;i<9;i++){
    const x=i%2?786-(i%3)*3:12+(i%3)*3;
    const y=20+((i/9+phase)%1)*560;
    ctx.globalAlpha=.48+.35*Math.sin((i/9+phase)*tau)**2;
    if(a.effect==='hearts')heart(ctx,x,y,5);
    else{ctx.save();ctx.translate(x,y);ctx.rotate(phase*tau+i);ctx.beginPath();ctx.ellipse(0,0,3,8,0,0,tau);ctx.fill();ctx.restore();}
  }
  ctx.restore();
}
