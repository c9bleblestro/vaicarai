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
export const PROFILE_EFFECTS={off:'Desativada (PNG)',banner:'Somente banner GIF',sparkle:'Brilhos e ícones animados',petals:'Pétalas flutuantes',hearts:'Corações flutuantes',dream:'Sonho — brilho, estrelas e pétalas',aurora:'Aurora — luz em movimento'};
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

const L={banner:[24,24,516,150],avatar:[659,124,87],statsY:284,rowH:76,statW:368,statX:[24,408]};
function disk(ctx,x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,tau);ctx.fillStyle=fill;ctx.fill();}
function glow(ctx,x,y,r,c,alpha=.3){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,c+'00');
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function line(ctx,x1,y1,x2,y2,c,w=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();}
function botanical(ctx,x,y,scale,t,flip=1){
  ctx.save();ctx.translate(x,y);ctx.scale(scale*flip,scale);
  ctx.strokeStyle=t.accent;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,55);ctx.bezierCurveTo(12,8,57,-13,87,-46);ctx.stroke();
  for(let i=0;i<6;i++){
    const px=10+i*12,py=32-i*12;
    ctx.save();ctx.translate(px,py);ctx.rotate(i%2?.75:-.7);ctx.globalAlpha=.78;ctx.fillStyle=i%2?t.accent:t.light;
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-17,-8,-13,-29,1,-27);ctx.bezierCurveTo(12,-17,11,-7,0,0);ctx.fill();ctx.restore();
  }
  flower(ctx,21,25,18,t.accent,t.light);flower(ctx,60,-21,24,t.accent,t.light);flower(ctx,83,-40,12,t.accent,t.light);
  ctx.restore();
}
function twinkle(ctx,x,y,r,c,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=c;star(ctx,x,y,r);ctx.restore();
}
function statPos(i){return [L.statX[i%2],L.statsY+Math.floor(i/2)*L.rowH];}
export async function drawStudioProfile(p,h){
  const a=normalizeAppearance(p.appearance),t=PROFILE_THEMES[a.theme];
  const bg1=color(p.cardBg1,t.bg[0]),bg2=color(p.cardBg2,p.cardBg1?bg1:t.bg[1]),panel=color(p.cardPanelColor,t.panel);
  const dark=h.isColorDark(bg1),pdark=h.isColorDark(panel);
  const ink=dark?'#fff1f7':'#432c3b',panelInk=pdark?'#fff1f7':'#432c3b';
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
  const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,bg1);g.addColorStop(1,bg2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(!p.cardBg1&&!p.cardBg2){
    glow(ctx,695,150,230,t.accent,dark?.20:.24);glow(ctx,85,460,230,t.accent,.12);
    ctx.save();ctx.globalAlpha=.10;ctx.strokeStyle=t.accent;ctx.lineWidth=1;
    for(let y=18;y<H;y+=25)for(let x=18;x<W;x+=25){ctx.beginPath();ctx.arc(x,y,.8,0,tau);ctx.stroke();}
    ctx.restore();
  }
  const frame=(x,y,w,hh,r=20)=>{
    ctx.save();ctx.shadowColor='#140a1930';ctx.shadowBlur=10;ctx.shadowOffsetY=4;
    h.roundRect(ctx,x,y,w,hh,r);ctx.fillStyle=panel;ctx.fill();ctx.restore();
    ctx.save();h.roundRect(ctx,x,y,w,hh,r);ctx.clip();
    const shine=ctx.createLinearGradient(x,y,x,y+hh);shine.addColorStop(0,'#ffffff18');shine.addColorStop(.50,'#ffffff00');shine.addColorStop(1,'#00000010');ctx.fillStyle=shine;ctx.fillRect(x,y,w,hh);
    ctx.restore();h.roundRect(ctx,x,y,w,hh,r);ctx.strokeStyle=t.accent+'99';ctx.lineWidth=1.2;ctx.stroke();
    h.roundRect(ctx,x+3,y+3,w-6,hh-6,Math.max(4,r-3));ctx.strokeStyle=t.light+'28';ctx.lineWidth=1;ctx.stroke();
  };
  h.roundRect(ctx,7,7,786,586,26);ctx.strokeStyle=t.accent+'88';ctx.lineWidth=1.4;ctx.stroke();
  const [bx,by,bw,bh]=L.banner;
  const banner=p._bannerImage?null:p._resolvedBanner??await h.resolveBanner(p.activeBanner,p.guildId,{includeImageData:true});
  let bannerImage=p._bannerImage;
  if(!bannerImage&&banner)try{bannerImage=banner.imageBuffer?await loadImage(Buffer.from(banner.imageBuffer)):await h.loadUrl(banner.imageUrl);}catch{}
  const background=p._returnLayers?createCanvas(W,H):null;
  if(background)background.getContext('2d').drawImage(canvas,0,0);
  ctx.save();h.roundRect(ctx,bx,by,bw,bh,20);ctx.clip();
  if(bannerImage)cover(ctx,bannerImage,bx,by,bw,bh);
  else{
    const colors=banner?.gradient??[bg1,bg2],gradient=ctx.createLinearGradient(bx,by,bx+bw,by+bh);gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);ctx.fillStyle=gradient;ctx.fillRect(bx,by,bw,bh);
    glow(ctx,282,80,170,t.accent,.34);glow(ctx,480,160,140,t.light,.18);
    ctx.save();ctx.strokeStyle=t.light;ctx.globalAlpha=.22;ctx.lineWidth=1.2;
    for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(bx-30,by+24+i*14);ctx.bezierCurveTo(170,by+165-i*8,340,by-40+i*11,560,by+40+i*15);ctx.stroke();}ctx.restore();
    for(let i=0;i<25;i++){const x=40+(i*79)%485,y=36+(i*47)%125;twinkle(ctx,x,y,i%5===0?5:1.8,t.light,.35+(i%3)*.17);}
    if(a.decor==='floral'){botanical(ctx,36,141,.9,t);botanical(ctx,528,51,.9,t,-1);}
    if(a.decor==='cat'){cat(ctx,215,103,36,t.accent,t.light);cat(ctx,290,104,34,t.accent,t.light);ctx.fillStyle=t.accent;heart(ctx,252,61,10);}
    if(a.decor==='bow'){bow(ctx,100,90,31,t.accent,t.light);bow(ctx,465,90,31,t.accent,t.light);}
  }
  ctx.restore();if(background)ctx.clearRect(0,0,W,H);
  h.roundRect(ctx,bx,by,bw,bh,20);ctx.strokeStyle=t.accent;ctx.lineWidth=1.5;ctx.stroke();
  const [cx,cy,r]=L.avatar;
  glow(ctx,cx,cy,115,t.accent,.27);
  const ring=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);ring.addColorStop(0,t.light);ring.addColorStop(.48,color(p.ringBorderColor,t.accent));ring.addColorStop(1,t.light);
  disk(ctx,cx,cy,r+9,ring);disk(ctx,cx,cy,r+5,bg1);
  if(p.activeRing)await h.drawAvatarRing(ctx,cx,cy,r+3,p.activeRing);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,tau);ctx.clip();
  try{cover(ctx,await h.loadUrl(p.avatarUrl),cx-r,cy-r,2*r,2*r);}catch{ctx.fillStyle=panel;ctx.fillRect(cx-r,cy-r,2*r,2*r);ctx.fillStyle=t.accent;ctx.font='bold 60px BotFont';ctx.textAlign='center';ctx.fillText(Array.from(p.username||'?')[0],cx,cy+20);}
  ctx.restore();
  if(a.decor==='floral'){botanical(ctx,566,194,.44,t);botanical(ctx,752,62,.43,t,-1);}
  else if(a.decor==='bow')bow(ctx,660,37,19,t.accent,t.light);
  else if(a.decor==='cat')cat(ctx,749,189,23,t.accent,t.light);
  else if(a.decor==='stars'){twinkle(ctx,569,52,10,t.light);twinkle(ctx,747,198,11,t.accent);}
  if(p.activePet){const pet=await h.loadEmojiImg(p.activePet).catch(()=>null);if(pet){disk(ctx,724,189,20,panel);ctx.strokeStyle=t.accent;ctx.stroke();ctx.drawImage(pet,710,175,28,28);}}
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  fit(ctx,p.username,34,211,504,34,ink);
  frame(24,223,516,44,17);
  ctx.save();h.roundRect(ctx,31,227,502,36,13);ctx.clip();ctx.font='16px BotFont';ctx.fillStyle=panelInk;
  await h.drawBioWithEmojis(ctx,p.bio||'Personalize sua bio no bot.',34,250,496,19,16);ctx.restore();
  ctx.save();ctx.textAlign='center';fit(ctx,'PERFIL SOCIAL',659,249,220,14,ink,false);ctx.restore();
  const level=p.chatLevel?{level:p.chatLevel.level,current:p.chatLevel.current,needed:p.chatLevel.required}:h.computeLevel(p.xp);
  const stats=[['Nível',String(level.level)],['XP',level.current+'/'+level.needed],['Reputação',String(p.reps??0)],['Coins',h.fmtCompact(p.balance??0)],['Casado(a)',p.marriedToName??'Nenhum'],['Amigo(a)',p.bestFriendName??'Nenhum']];
  const sheet=await h.loadProfileStatIconSheet();
  for(let i=0;i<stats.length;i++){
    const [x,y]=statPos(i),w=L.statW;
    frame(x,y,w,66,19);
    glow(ctx,x+37,y+33,30,t.accent,.18);
    disk(ctx,x+37,y+33,29,t.accent+'35');
    ctx.strokeStyle=t.accent+'aa';ctx.lineWidth=1;ctx.stroke();
    if(!h.drawProfileStatIcon(ctx,sheet,i,x+11,y+7,52)){ctx.save();h.STAT_ICON_CONFIGS[i].fallback(ctx,x+11,y+7,52);ctx.restore();}
    fit(ctx,stats[i][0],x+78,y+23,270,14,panelInk,false);
    fit(ctx,stats[i][1],x+78,y+48,i===1?136:i>=4?215:266,24,panelInk);
    if(i===1){
      const progress=Math.min(1,Math.max(0,level.needed?level.current/level.needed:0)),bx=x+220,bw=132;
      ctx.fillStyle=pdark?'#ffffff22':'#00000015';h.roundRect(ctx,bx,y+39,bw,9,4);ctx.fill();
      if(progress>0){ctx.save();h.roundRect(ctx,bx,y+39,bw,9,4);ctx.clip();const pg=ctx.createLinearGradient(bx,y,bx+bw,y);pg.addColorStop(0,t.accent);pg.addColorStop(1,t.light);ctx.fillStyle=pg;ctx.fillRect(bx,y+39,bw*progress,9);ctx.restore();}
    }
    const days=i===4?p.marriedStreak:i===5?p.friendStreak:0;
    if(days>0){ctx.fillStyle='#f1a256';ctx.beginPath();ctx.moveTo(x+308,y+28);ctx.bezierCurveTo(x+302,y+20,x+313,y+15,x+311,y+9);ctx.bezierCurveTo(x+325,y+20,x+320,y+28,x+314,y+31);ctx.closePath();ctx.fill();fit(ctx,String(days),x+327,y+27,34,14,panelInk);}
    if(i<4)twinkle(ctx,x+w-17,y+15,3.5,t.accent,.7);
  }
  frame(24,514,448,65,19);fit(ctx,'Conquistas',42,536,155,15,panelInk,false);
  const keys=h.computeEarnedBadgeKeys(p);
  const imgs=await Promise.all(keys.map(k=>h.loadEmojiImg(p.guildBadgeEmojis[k]??h.BADGE_DEFS.find(b=>b.key===k)?.defaultEmoji).catch(()=>null)));
  if(!keys.length)fit(ctx,'Nenhuma conquista ainda',42,560,408,15,panelInk,false);
  else {const step=Math.min(37,410/Math.max(1,keys.length));for(let i=0;i<keys.length;i++){
    const x=42+i*step;disk(ctx,x+13,557,12,h.BADGE_DEFS.find(b=>b.key===keys[i])?.color??t.accent);
    if(imgs[i])ctx.drawImage(imgs[i],x+3,547,20,20);else twinkle(ctx,x+13,557,7,t.light);
  }}
  frame(484,514,292,65,19);fit(ctx,a.signature?'Assinatura':'SUBSTANCY',502,536,250,14,panelInk,false);
  fit(ctx,a.signature||'Seu perfil, seu estilo.',502,561,254,22,panelInk);
  decorations(ctx,a.decor,t);
  if(background)return {background,foreground:canvas,bannerRect:[bx,by,bw,bh,20]};
  return p._returnCanvas?canvas:canvas.toBuffer('image/png');
}
export function drawProfileEffect(ctx,appearance,phase,base){
  const a=normalizeAppearance(appearance),t=PROFILE_THEMES[a.theme];
  if(['off','banner'].includes(a.effect))return;
  const old=a.theme==='classic',cx=old?155:L.avatar[0],cy=old?163:L.avatar[1],rr=old?88:L.avatar[2]+12;
  const dream=a.effect==='dream',spark=a.effect==='sparkle'||dream,aurora=a.effect==='aurora';
  ctx.save();
  // Moving highlights hug the ring, without covering the avatar or equipped frame.
  for(let i=0;i<10;i++){
    const ang=i*tau/10+phase*tau,alpha=.27+.65*(.5+.5*Math.sin(ang*3+phase*tau));
    const x=cx+Math.cos(ang)*rr,y=cy+Math.sin(ang)*rr;
    if(spark||aurora){twinkle(ctx,x,y,2.5+2*alpha,t.light,alpha);}
  }
  if(!old){
    for(let i=0;i<6;i++){
      const [x,y]=statPos(i),icx=x+37,icy=y+33,angle=phase*tau+i*.89;
      // Repaint only the icon disk with its actual source pixels, then add a small animated highlight.
      // All text and equipped assets remain untouched.
      if(base&&(spark||dream)){
        const pulse=1+.025*Math.sin(angle),size=52*pulse;
        ctx.save();ctx.beginPath();ctx.arc(icx,icy,28,0,tau);ctx.clip();
        ctx.drawImage(base,x+11,y+7,52,52,icx-size/2,icy-size/2,size,size);ctx.restore();
      }
      const p=.5+.5*Math.sin(angle);
      if(spark||aurora||dream){
        ctx.save();ctx.globalAlpha=.18+.53*p;ctx.strokeStyle=t.light;ctx.lineWidth=1.8;ctx.lineCap='round';
        ctx.beginPath();ctx.arc(icx,icy,29,angle,angle+.85);ctx.stroke();ctx.restore();
        twinkle(ctx,icx+Math.cos(angle)*30,icy+Math.sin(angle)*30,3.3,t.light,.25+.7*p);
        // A moving border glint, not a solid overlay on statistics.
        const gx=x+75+((phase+i*.13)%1)*265;
        ctx.save();ctx.globalAlpha=.15+.35*p;line(ctx,gx,y+1,gx+13,y+1,t.light,1.7);ctx.restore();
      }
    }
  }
  if(a.effect==='petals'||a.effect==='hearts'||dream){
    for(let i=0;i<15;i++){
      const u=(i/15+phase)%1,fade=Math.sin(u*Math.PI),side=i%2;
      // Separate lanes in the margins and the open avatar/name area.
      const x=old?(side?787:13):(i%3===0?548+7*Math.sin(u*tau+i):side?787-3*Math.cos(u*tau+i):13+3*Math.cos(u*tau+i));
      const y=16+u*(i%3===0&&!old?250:568);
      ctx.save();ctx.translate(x,y);ctx.rotate(i+phase*tau);ctx.globalAlpha=fade*(.45+.35*(i%3)/2);ctx.fillStyle=i%3?t.accent:t.light;
      if(a.effect==='hearts'||(dream&&i%4===0))heart(ctx,0,0,5);
      else{ctx.beginPath();ctx.moveTo(0,-8);ctx.bezierCurveTo(8,-3,6,6,0,8);ctx.bezierCurveTo(-6,3,-5,-5,0,-8);ctx.fill();}
      ctx.restore();
    }
  }
  if(aurora||dream){
    ctx.save();ctx.strokeStyle=t.light;ctx.lineWidth=2;ctx.globalAlpha=.45;
    const ang=phase*tau;ctx.beginPath();ctx.arc(cx,cy,rr+4,ang,ang+.9);ctx.stroke();ctx.restore();
    for(let i=0;i<7;i++){const x=old?12:548+Math.sin(phase*tau+i)*5,y=25+((phase+i/7)%1)*(old?550:230);twinkle(ctx,x,y,2+(i%3),t.accent,.6);}
  }
  ctx.restore();
}
