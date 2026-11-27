import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {parseGIF,decompressFrames} from 'gifuct-js';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {petThumbnailUrl} from './petComponents.js';
import {Worker} from 'node:worker_threads';
import {getPetIllustration,getPetMotionSource,illustratedPetKey,getPimentinhaClip} from './petIllustrationPack.js';
const W=600,H=400,TAU=2*Math.PI;
const THEMES={
  neon:{wall:'#241938',wall2:'#472655',floor:'#39273e',floor2:'#7d466d',neon:'#ff90dc',light:'#b6a1ff',sofa:'#be5893',trim:'#885cb0',sky:'#171e4a',rug:'#db93c0'},
  rose:{wall:'#6d3a53',wall2:'#c887a7',floor:'#724b60',floor2:'#d59bad',neon:'#ffbcdd',light:'#ffe4ed',sofa:'#ee9fbb',trim:'#c57399',sky:'#7666aa',rug:'#f0b7d2'},
  moon:{wall:'#17243c',wall2:'#344e73',floor:'#26394f',floor2:'#547596',neon:'#93d8ff',light:'#bfc5ff',sofa:'#6889c9',trim:'#6488b5',sky:'#102649',rug:'#a4b9e2'}
};
const safeTheme=t=>THEMES[t]??THEMES.neon;
const imageCache=new Map(),gifCache=new Map(),inflight=new Map();
const round=(ctx,x,y,w,h,r)=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();};
const ellipse=(ctx,x,y,rx,ry,fill)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();};
function rect(ctx,x,y,w,h,r,fill){round(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function glow(ctx,x,y,r,c,a=1){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,c+'00');
  ctx.save();ctx.globalAlpha=a;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function heart(ctx,x,y,r,c){
  ctx.beginPath();ctx.moveTo(x,y+r);ctx.bezierCurveTo(x-r*2,y-r*.3,x-r*.7,y-r*1.5,x,y-r*.4);ctx.bezierCurveTo(x+r*.7,y-r*1.5,x+r*2,y-r*.3,x,y+r);ctx.fillStyle=c;ctx.fill();
}
function sparkle(ctx,x,y,r,c){
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+2,y-2,x+r*.7,y);ctx.quadraticCurveTo(x+2,y+2,x,y+r);ctx.quadraticCurveTo(x-2,y+2,x-r*.7,y);ctx.quadraticCurveTo(x-2,y-2,x,y-r);ctx.fillStyle=c;ctx.fill();
}
function roomSvg(theme){
  const p=safeTheme(theme);
  const planks=Array.from({length:13},(_,i)=>'<path d="M'+(i*64-90)+' 400 L'+(300+(i*64-390)*.20)+' 253" stroke="#170e2c" stroke-opacity=".24" stroke-width="1.1"/>').join('');
  const city=Array.from({length:18},(_,i)=>{const h=12+(i*29)%71,x=412+i*8;return '<rect x="'+x+'" y="'+(177-h)+'" width="7" height="'+h+'" fill="#11172f"/><rect x="'+(x+2)+'" y="'+(181-h)+'" width="2" height="3" fill="#e4aeeb" opacity=".7"/>';}).join('');
  const books=Array.from({length:9},(_,i)=>'<rect x="'+(30+i*10)+'" y="'+(100-i%3*4)+'" width="8" height="'+(27+i%3*4)+'" rx="1" fill="'+[p.trim,p.sofa,'#d9b4d3','#69578a'][i%4]+'" stroke="#38223e" stroke-width=".7"/>').join('');
  const vines=Array.from({length:14},(_,i)=>{let x=163+Math.sin(i*.55)*16,y=34+i*10;return '<ellipse cx="'+(x+(i%2?6:-6))+'" cy="'+y+'" rx="5" ry="10" fill="'+['#597d65','#84a06c','#a5b77d'][i%3]+'" transform="rotate('+(i%2?42:-42)+' '+x+' '+y+')"/>';}).join('');
  const stars=Array.from({length:9},(_,i)=>'<circle cx="'+(428+i*17%140)+'" cy="'+(34+i*23%73)+'" r="'+(i%3?1:1.8)+'" fill="#fff1e5" opacity=".8"/>').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs>'+
  '<linearGradient id="wall" x2=".9" y2="1"><stop stop-color="'+p.wall+'"/><stop offset="1" stop-color="'+p.wall2+'"/></linearGradient>'+
  '<linearGradient id="floor" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="'+p.floor+'"/><stop offset="1" stop-color="'+p.floor2+'"/></linearGradient>'+
  '<linearGradient id="cush" x2=".35" y2="1"><stop stop-color="'+p.sofa+'"/><stop offset=".65" stop-color="'+p.trim+'"/><stop offset="1" stop-color="'+p.wall+'"/></linearGradient>'+
  '<linearGradient id="pill" x2=".4" y2="1"><stop stop-color="'+p.neon+'"/><stop offset="1" stop-color="'+p.sofa+'"/></linearGradient>'+
  '<linearGradient id="sky" x2="0" y2="1"><stop stop-color="'+p.sky+'"/><stop offset="1" stop-color="'+p.trim+'"/></linearGradient>'+
  '<linearGradient id="metal" x2="0" y2="1"><stop stop-color="#ffe9fb"/><stop offset=".38" stop-color="#958ba9"/><stop offset=".6" stop-color="#e6cde8"/><stop offset="1" stop-color="#4f4364"/></linearGradient>'+
  '<radialGradient id="halo"><stop stop-color="'+p.neon+'" stop-opacity=".26"/><stop offset="1" stop-color="'+p.neon+'" stop-opacity="0"/></radialGradient>'+
  '<radialGradient id="rug"><stop stop-color="'+p.rug+'"/><stop offset="1" stop-color="'+p.trim+'"/></radialGradient>'+
  '<pattern id="wallline" width="31" height="20" patternUnits="userSpaceOnUse"><path d="M0 0 V20" stroke="#fff" stroke-opacity=".035"/></pattern>'+
  '<filter id="soft"><feGaussianBlur stdDeviation="5"/></filter></defs>'+
  '<path fill="url(#wall)" d="M0 0H600V257H0Z"/><path fill="url(#wallline)" d="M0 0H600V257H0Z"/>'+
  '<path d="M0 0H77L104 255H0Z" fill="#100c20" opacity=".23"/><path d="M0 250H600V400H0Z" fill="url(#floor)"/>'+
  '<path d="M0 249H600V257H0Z" fill="'+p.trim+'"/><path d="M0 259H600" stroke="#150f23" stroke-width="4" opacity=".6"/>'+planks+
  '<path d="M0 298H600M0 354H600" stroke="#26182d" stroke-opacity=".24" stroke-width="1.4"/>'+
  '<ellipse cx="300" cy="298" rx="294" ry="112" fill="url(#halo)"/>'+
  // Recessed window, skyline and rain-lit trim.
  '<rect x="402" y="18" width="180" height="176" rx="10" fill="#130e25" opacity=".65"/>'+
  '<rect x="409" y="23" width="165" height="165" rx="4" fill="'+p.trim+'"/><rect x="415" y="29" width="153" height="153" rx="3" fill="url(#sky)"/>'+stars+city+
  '<path d="M492 29V182M415 107H568" stroke="'+p.trim+'" stroke-width="5"/><path d="M494 29V182M415 109H568" stroke="'+p.light+'" stroke-opacity=".65" stroke-width="1.5"/>'+
  '<path d="M405 190H578L585 197H400Z" fill="'+p.trim+'" stroke="#34233e"/>'+
  '<path d="M410 26Q431 90 414 166L397 182Q409 104 391 31Z" fill="'+p.wall2+'" stroke="'+p.trim+'" stroke-width="2"/>'+
  '<path d="M570 26Q549 90 566 166L585 182Q574 104 593 31Z" fill="'+p.wall2+'" stroke="'+p.trim+'" stroke-width="2"/>'+
  '<path d="M398 117L419 122M560 122L582 117" stroke="'+p.neon+'" stroke-width="4" stroke-linecap="round"/>'+
  // Wall shelves, plush and trailing leaves.
  '<rect x="13" y="128" width="145" height="8" rx="3" fill="'+p.trim+'" stroke="#28192d"/>'+books+
  '<path d="M22 136V150L36 136M143 136V150L130 136" stroke="'+p.trim+'" stroke-width="4" fill="none"/>'+
  '<rect x="132" y="14" width="42" height="12" rx="3" fill="'+p.trim+'"/><path d="M140 26L145 46H166L171 26Z" fill="#bb839e" stroke="#523a59"/>'+
  '<path d="M153 39Q190 80 155 170" fill="none" stroke="#52745d" stroke-width="2"/>'+vines+
  '<rect x="17" y="55" width="42" height="37" rx="4" fill="#241a36" stroke="'+p.trim+'" stroke-width="3"/>'+
  '<path d="M31 75Q25 64 35 65Q44 59 46 70Q51 77 40 83Z" fill="'+p.neon+'" opacity=".8"/>'+
  // Low cabinet, metal handles, trophies and decorative star lamp.
  '<ellipse cx="81" cy="270" rx="94" ry="12" fill="#140c20" opacity=".4"/>'+
  '<rect x="7" y="185" width="149" height="77" rx="8" fill="'+p.wall+'" stroke="#20162e" stroke-width="2"/>'+
  '<path d="M7 185L19 177H162L156 190H7Z" fill="'+p.trim+'"/>'+
  '<rect x="17" y="199" width="128" height="24" rx="4" fill="'+p.wall2+'" stroke="'+p.trim+'"/>'+
  '<rect x="17" y="227" width="128" height="26" rx="4" fill="'+p.wall2+'" stroke="'+p.trim+'"/>'+
  '<path d="M65 211H97M65 239H97" stroke="'+p.light+'" stroke-width="3" stroke-linecap="round"/>'+
  '<path d="M28 181V174H44V181M36 174V161M26 147H46Q46 163 36 163Q26 163 26 147Z" fill="#d8aa62" stroke="#8b5c4d" stroke-width="1.2"/>'+
  '<path d="M26 149H21Q20 158 30 158M46 149H51Q52 158 42 158" fill="none" stroke="#edc583" stroke-width="2"/>'+
  '<path d="M111 145L116 156L128 157L119 165L122 177L111 171L100 177L103 165L94 157L106 156Z" fill="'+p.light+'" stroke="'+p.neon+'"/>'+
  // Sofa / bed with pillowed back, stitched seams, throw and paw cushion.
  '<ellipse cx="497" cy="292" rx="101" ry="16" fill="#160e24" opacity=".4"/>'+
  '<rect x="421" y="224" width="166" height="65" rx="22" fill="url(#cush)" stroke="#2f1e36" stroke-width="2"/>'+
  '<path d="M431 239Q420 194 455 194H551Q581 195 573 242Z" fill="url(#cush)" stroke="#35213f" stroke-width="2"/>'+
  '<path d="M433 244Q441 233 468 236L554 236Q568 237 575 249L574 264H433Z" fill="'+p.sofa+'" stroke="'+p.trim+'" stroke-width="2"/>'+
  '<rect x="415" y="228" width="27" height="48" rx="12" fill="url(#cush)" stroke="#382540" stroke-width="1.5"/>'+
  '<rect x="565" y="228" width="27" height="48" rx="12" fill="url(#cush)" stroke="#382540" stroke-width="1.5"/>'+
  '<path d="M446 206Q465 194 487 207L487 234Q464 239 445 230Z" fill="'+p.wall2+'" stroke="'+p.trim+'" stroke-width="1.4"/>'+
  '<path d="M506 208Q526 195 545 210L545 234Q525 239 506 229Z" fill="url(#pill)" stroke="'+p.trim+'" stroke-width="1.4"/>'+
  '<path d="M550 242L566 243L558 279L536 279Z" fill="'+p.light+'" opacity=".68"/>'+
  '<path d="M540 250L561 251M538 259L559 260M536 268L557 269" stroke="'+p.sofa+'" stroke-width="2"/>'+
  '<path d="M431 286V292M573 286V292" stroke="#1d132a" stroke-width="6" stroke-linecap="round"/>'+
  // Rug and woven ring, with a paw motif under the companion.
  '<ellipse cx="300" cy="340" rx="203" ry="50" fill="#1a1025" opacity=".42"/>'+
  '<ellipse cx="300" cy="334" rx="204" ry="49" fill="url(#rug)" stroke="'+p.neon+'" stroke-opacity=".6" stroke-width="2"/>'+
  '<ellipse cx="300" cy="334" rx="190" ry="41" fill="none" stroke="'+p.light+'" stroke-opacity=".5" stroke-width="1.4" stroke-dasharray="2 3"/>'+
  '<g fill="'+p.wall2+'" opacity=".5"><ellipse cx="300" cy="345" rx="30" ry="15"/><ellipse cx="271" cy="325" rx="11" ry="8" transform="rotate(-20 271 325)"/><ellipse cx="291" cy="317" rx="10" ry="8"/><ellipse cx="311" cy="317" rx="10" ry="8"/><ellipse cx="330" cy="326" rx="10" ry="8" transform="rotate(20 330 326)"/></g>'+
  // Food bowl.
  '<ellipse cx="85" cy="354" rx="50" ry="13" fill="#140b20" opacity=".45"/>'+
  '<path d="M42 336Q85 323 128 336L118 356Q86 369 51 356Z" fill="url(#metal)" stroke="#55435d" stroke-width="1.5"/>'+
  '<ellipse cx="85" cy="335" rx="43" ry="11" fill="#4b2e44" stroke="#e2c2da" stroke-width="2"/>'+
  Array.from({length:16},(_,i)=>'<ellipse cx="'+(53+i*13%64)+'" cy="'+(330+(i*7)%9)+'" rx="4" ry="3" fill="'+['#b27d43','#e0a55e','#785133'][i%3]+'"/>').join('')+
  // Backlit logo, with chrome-like glow and star decoration.
  '<ellipse cx="275" cy="89" rx="128" ry="75" fill="url(#halo)"/>'+
  '<path d="M242 56L247 42L258 51L268 34L280 51L294 43L295 58Z" fill="none" stroke="'+p.neon+'" stroke-width="3" stroke-linejoin="round"/>'+
  '<text x="270" y="99" font-family="serif" font-style="italic" font-weight="bold" font-size="35" fill="'+p.neon+'" text-anchor="middle" opacity=".46" filter="url(#soft)">Substancy</text>'+
  '<text x="270" y="99" font-family="serif" font-style="italic" font-weight="bold" font-size="35" fill="#fff3ff" stroke="'+p.neon+'" stroke-width=".6" text-anchor="middle">Substancy</text>'+
  '<path d="M211 110Q270 123 332 108" fill="none" stroke="'+p.neon+'" stroke-width="2.5" stroke-linecap="round"/>'+
  '<path d="M346 135C337 122 349 116 356 125L378 125C388 116 398 124 390 134C398 142 389 150 379 143H357C348 150 338 143 346 135Z" fill="none" stroke="'+p.neon+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+
  '<circle cx="184" cy="63" r="2" fill="'+p.light+'"/><circle cx="357" cy="72" r="2.6" fill="'+p.neon+'"/>'+
  '</svg>';
}
async function scene(theme,view){
  const key=theme+':'+view;if(imageCache.has(key))return imageCache.get(key);
  let img;
  if(view==='room')img=await loadImage(Buffer.from(roomSvg(theme)));
  else{
    const p=safeTheme(theme),c=createCanvas(W,H),ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,p.wall);g.addColorStop(.55,p.wall2);g.addColorStop(1,p.wall);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);glow(ctx,300,220,230,p.neon,.20);
    ellipse(ctx,300,339,168,24,'#140e2635');
    ctx.strokeStyle=p.trim;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(300,339,169,24,0,0,TAU);ctx.stroke();
    for(const [x,y,r] of [[143,124,9],[447,110,14],[121,275,6],[474,272,8],[376,58,5]])sparkle(ctx,x,y,r,p.light);
    img=c;
  }
  imageCache.set(key,img);return img;
}
function safeImage(url){try{const u=new URL(url);return u.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
async function fetchSprite(url){
  const u=safeImage(url);if(!u)return null;
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);
  try{
    const r=await fetch(u,{signal:ctrl.signal,redirect:'error'});
    if(!r.ok||Number(r.headers.get('content-length')||0)>5*1024*1024)return null;
    const chunks=[];let n=0;for await(const chunk of r.body){n+=chunk.length;if(n>5*1024*1024){ctrl.abort();return null;}chunks.push(Buffer.from(chunk));}
    return Buffer.concat(chunks);
  }catch{return null;}finally{clearTimeout(timer);}
}
export async function decodePetSprite(bytes){
  if(!bytes?.length)return [];
  try{
    if(bytes.subarray(0,3).toString()!=='GIF'){
      const image=await loadImage(bytes);if(!image.width||!image.height||image.width*image.height>4e6)return [];
      return [{image,delay:1000}];
    }
    const parsed=parseGIF(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const {width:w,height:h}=parsed.lsd,source=parsed.frames.filter(f=>f.image);
    if(!w||!h||w*h>1e6||source.length>120||source.length*w*h>25e6)return [];
    const frames=decompressFrames(parsed,true),canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),out=[];
    for(const frame of frames){
      const d=frame.dims,previous=frame.disposalType===3?ctx.getImageData(0,0,w,h):null,patch=createCanvas(d.width,d.height),pc=patch.getContext('2d'),id=pc.createImageData(d.width,d.height);id.data.set(frame.patch);pc.putImageData(id,0,0);
      ctx.drawImage(patch,d.left,d.top);const image=createCanvas(w,h);image.getContext('2d').drawImage(canvas,0,0);out.push({image,delay:Math.max(20,frame.delay||100)});
      if(previous)ctx.putImageData(previous,0,0);else if(frame.disposalType===2)ctx.clearRect(d.left,d.top,d.width,d.height);
    }
    return out;
  }catch{return [];}
}
function spriteAt(frames,ms){
  if(!frames.length)return null;
  const total=frames.reduce((s,f)=>s+f.delay,0);let t=ms%total;
  for(const f of frames){if(t<f.delay)return f.image;t-=f.delay;}return frames.at(-1).image;
}
function ball(ctx,x,y,p){
  ellipse(ctx,x,y+8,18,5,'#100b1f55');
  const g=ctx.createRadialGradient(x-5,y-7,1,x,y,16);g.addColorStop(0,p.light);g.addColorStop(.45,p.neon);g.addColorStop(1,p.sofa);
  ellipse(ctx,x,y,15,15,g);ctx.strokeStyle='#ffffff8c';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,7,14,.4,0,TAU);ctx.stroke();
}
function drawSprite(ctx,frames,pet,ms,x,ground,size,sx,sy,angle){
  const im=spriteAt(frames,ms);
  ctx.save();ctx.translate(x,ground);ctx.rotate(angle);ctx.scale(sx,sy);
  if(im){const scale=Math.min(size/im.width,size/im.height),w=im.width*scale,h=im.height*scale;ctx.drawImage(im,-w/2,-h,w,h);}
  else{
    // Preserve the configured Unicode emoji; do not invent another breed.
    const emoji=String(pet.emoji??'').trim();
    const symbol=/\p{Extended_Pictographic}/u.test(emoji)&&!emoji.startsWith('<')?emoji:'🐾';
    ctx.font=Math.round(size*.72)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(symbol,0,-5);
  }
  ctx.restore();
}
function drawMotion(ctx,background,frames,pet,theme,view,action,t,ms){
  const p=safeTheme(theme),room=view==='room',phase=t*TAU;
  ctx.drawImage(background,0,0,W,H);
  let x=300,ground=room?343:341,size=room?220:300,sx=1+.012*Math.sin(phase*2),sy=1+.018*Math.sin(phase*2),angle=.009*Math.sin(phase);
  if(room){
    // Stable room artwork plus individually animated weather and light.
    ctx.save();rect(ctx,415,29,153,153,3,'#00000000');ctx.clip();ctx.strokeStyle='#c6d4ff50';ctx.lineWidth=.8;
    for(let i=0;i<26;i++){const rx=420+(i*31)%145,ry=29+(i*17+t*153)%153;ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-3,ry+10);ctx.stroke();}ctx.restore();
    glow(ctx,270,88,115,p.neon,.09+.03*Math.sin(phase));
  }
  const walking=action==='aventura'||action==='coletar';
  if(action==='brincar'){
    x=300+72*Math.sin(phase);ground-=Math.abs(Math.sin(phase*2))*18;angle=.045*Math.cos(phase);sx=1+.035*Math.sin(phase*2);sy=1-.035*Math.sin(phase*2);
  }else if(action==='alimentar'){
    if(room)x=153+13*Math.sin(phase);angle=.08+.035*Math.sin(phase*3);sy=1-.06*(.5+.5*Math.sin(phase*3));
  }else if(action==='acariciar'){
    angle=.04*Math.sin(phase);sx=1+.024*Math.sin(phase*2);sy=1+.025*Math.sin(phase*2);
  }else if(action==='dormir'){
    if(room){x=501;ground=254;size=140;}angle=-.05;sy=.82+.018*Math.sin(phase*2);sx=1.08;
  }else if(action==='banho'){ground-=Math.abs(Math.sin(phase*2))*4;}
  else if(walking){x=300+120*Math.sin(phase);ground-=7*Math.abs(Math.sin(phase*4));angle=.035*Math.cos(phase*2);}
  else if(action==='away'){x=300;size=0;}
  else if(room){x+=9*Math.sin(phase);ground-=Math.max(0,Math.sin(phase*2))*2;}
  if(room){
    const bx=action==='brincar'?x+57*Math.cos(phase):400,by=action==='brincar'?341-19*Math.abs(Math.sin(phase*2)):348;
    ball(ctx,bx,by,p);
  }
  if(size){
    ellipse(ctx,x,ground+2,Math.min(76,size*.32),10,'#12091f50');
    drawSprite(ctx,frames,pet,ms,x,ground,size,sx,sy,angle);
  }
  if(action==='acariciar'||action==='coletar'){
    for(let i=0;i<5;i++){let v=(t+i/5)%1;ctx.save();ctx.globalAlpha=Math.sin(Math.PI*v)*.85;heart(ctx,x-60+i*27+5*Math.sin(v*TAU),ground-size*.64-v*65,7+i%2*3,p.neon);ctx.restore();}
  }
  if(action==='dormir'){
    for(let i=0;i<3;i++){let v=(t+i/3)%1;ctx.save();ctx.globalAlpha=Math.sin(v*Math.PI);ctx.font='italic bold '+(15+v*10)+'px serif';ctx.fillStyle=p.light;ctx.fillText('z',x+23+v*27,ground-size*.55-v*44);ctx.restore();}
  }
  if(action==='banho'){
    for(let i=0;i<8;i++){let v=(t+i/8)%1;const bx=x-80+(i*27)%160,by=ground-v*160;ellipse(ctx,bx,by,6+i%3*3,'#d8edff25');ctx.strokeStyle='#f2deffb0';ctx.lineWidth=1;ctx.beginPath();ctx.arc(bx,by,6+i%3*3,0,TAU);ctx.stroke();}
  }
  if(action==='alimentar'){
    for(let i=0;i<4;i++){let v=(t+i/4)%1;ellipse(ctx,x-34+i*8,ground-17-v*18,2.4,2.4,'#e5b377');}
  }
  if(action==='coletar'||action==='brincar'){
    for(let i=0;i<3;i++){let v=(t+i/3)%1;ctx.save();ctx.globalAlpha=.65*Math.sin(v*Math.PI);sparkle(ctx,x-80+i*72,ground-size*.62-v*15,7,p.light);ctx.restore();}
  }
}
function cachePut(key,result){
  gifCache.set(key,{result,expires:Date.now()+300000});
  let bytes=[...gifCache.values()].reduce((s,v)=>s+v.result.buffer.length,0);
  while(gifCache.size>40||bytes>56*1024*1024){const k=gifCache.keys().next().value;bytes-=gifCache.get(k).result.buffer.length;gifCache.delete(k);}
}
async function render(pet,{theme='neon',view='room',action='idle',spriteBuffer=null}={}){
  theme=Object.hasOwn(THEMES,theme)?theme:'neon';view=view==='portrait'?'portrait':'room';
  const bg=await scene(theme,view),url=petThumbnailUrl(pet),frames=await decodePetSprite(spriteBuffer??await fetchSprite(url));
  const c=createCanvas(W,H),ctx=c.getContext('2d');
  // 25fps for standard scene. Maintain original source GIF cadence through ms.
  const total=frames.reduce((s,f)=>s+f.delay,0);
  const duration=frames.length>1?Math.min(4800,total*Math.max(1,Math.ceil(2400/total))):2400;
  for(const [width,height,delay] of [[600,400,40],[480,320,50],[400,267,60]]){
    const n=Math.max(2,Math.round(duration/delay)),output=createCanvas(width,height),oc=output.getContext('2d');
    let enc;
    try{
      enc=new GifEncoder(width,height,{repeat:0,quality:8});
      for(let i=0;i<n;i++){
        drawMotion(ctx,bg,frames,pet,theme,view,action,i/n,i*delay);
        oc.drawImage(c,0,0,width,height);const rgba=oc.getImageData(0,0,width,height).data;
        enc.addFrame(new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),width,height,{delay});
      }
      const buffer=Buffer.from(enc.finish());
      if(buffer.length<=8*1024*1024)return {buffer,ext:'gif',sourceAnimated:frames.length>1,sourceFound:frames.length>0,fps:1000/delay};
    }catch(error){console.warn('[pet-art]',error?.message??error);}finally{enc?.dispose();}
  }
  drawMotion(ctx,bg,frames,pet,theme,view,action,.5,1200);
  return {buffer:c.toBuffer('image/png'),ext:'png',sourceAnimated:frames.length>1,sourceFound:frames.length>0,fps:0};
}
// Art packs are keyed by the real catalog id, never by a guessed species or name.
const artRoot=fileURLToPath(new URL('../assets/pet-world/',import.meta.url));
async function localClip(pet,opts){
  const id=String(pet.id??''),view=opts.view==='portrait'?'portrait':'room';
  const theme=Object.hasOwn(THEMES,opts.theme)?opts.theme:'neon';
  const action=String(opts.action??'idle');
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||!['idle','brincar','alimentar','acariciar','banho','dormir','aventura','coletar','away'].includes(action))return null;
  // Each optional clip is a finished, pre-rendered scene for this exact action.
  // Never show an idle illustration in place of an interaction or another pet.
  const name=view==='portrait'?'portrait-'+action+'.gif':'room-'+theme+'-'+action+'.gif';
  try{
    const buffer=await readFile(join(artRoot,id,name));
    if(buffer.length<20||buffer.length>8*1024*1024||buffer.subarray(0,3).toString()!=='GIF')return null;
    const parsed=parseGIF(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
    if(parsed.frames.filter(f=>f.image).length<2||parsed.lsd.width*parsed.lsd.height>2e6)return null;
    return {buffer,ext:'gif',sourceAnimated:true,sourceFound:true,fps:null};
  }catch{return null;}
}
// A pose timeline defines one complete action. Never modulo-wrap a partial
// sequence or jump from a sleeping pose to a play pose during a reaction.
const POSES={
  'luna:room':{
    idle:[0,1,0,2,0,1,0],brincar:[0,3,4,5,6,7,6,8,9,0],
    alimentar:[0,3,0,1,2,0],acariciar:[0,1,8,9,8,2,0],
    banho:[0,1,2,1,0],dormir:[11,12,13,14,15,14,13,12,11],
    aventura:[0,3,0,2,0],coletar:[0,8,9,10,8,0],away:[0,1,0,2,0]
  },
  'koda:room':{
    idle:[0,1,0,2,0,1,0],brincar:[0,2,3,4,5,6,7,6,3,0],
    alimentar:[0,2,0,1,3,0],acariciar:[0,1,3,1,0],
    banho:[0,1,2,1,0],dormir:[8],aventura:[0,2,3,2,0],
    coletar:[0,1,3,1,0],away:[0,1,0,2,0]
  },
  'luna:portrait':{
    idle:[0,1,2,4,5,14,15,0],brincar:[0,3,4,5,6,7,8,9,10,14,0],
    alimentar:[0,1,5,6,9,10,14,0],acariciar:[0,4,5,6,9,10,11,14,0],
    banho:[0,2,4,5,4,14,0],dormir:[5,10,11,10,5],
    aventura:[0,2,3,4,14,0],coletar:[0,5,6,7,8,9,10,14,0],away:[0,1,0]
  },
  'koda:portrait':{
    idle:[0,1,2,3,2,1,0],brincar:[0,3,4,5,6,7,0],
    alimentar:[0,3,4,5,0],acariciar:[0,1,4,5,1,0],
    banho:[0,3,1,2,0],dormir:[1,7,1],aventura:[0,3,2,0],
    coletar:[0,3,4,5,0],away:[0,1,0]
  }
};
export const ILLUSTRATED_ACTIONS=['idle','brincar','alimentar','acariciar','banho','dormir','aventura','coletar','away'];
export const ACTION_DURATION=5600;
export function petMotionPlan(species,view,action,step=80){
  const chosen=POSES[species+':'+view]?.[action];
  if(!chosen)throw Error('Invalid illustrated motion');
  // Natural resting holds; animation plays once inside each loop.
  const weights=chosen.map((_,i)=>i===0||i===chosen.length-1?2.5:1);
  const sum=weights.reduce((a,b)=>a+b,0);
  const edges=[];let time=0;
  for(const weight of weights){time+=weight/sum*ACTION_DURATION;edges.push(time);}
  const out=[];let at=0;
  for(let t=0;t<ACTION_DURATION;t+=step){
    while(at<edges.length-1&&t>=edges[at])at++;
    out.push({index:chosen[at],time:t,delay:Math.min(step,ACTION_DURATION-t),phase:t/ACTION_DURATION});
  }
  return out;
}
const illustratedFrames=new Map();
export async function renderIllustrated(pet,{theme='neon',view='room',action='idle'}={}){
  const species=illustratedPetKey(pet.id);
  view=view==='portrait'?'portrait':'room';
  theme=Object.hasOwn(THEMES,theme)?theme:'neon';
  if(!ILLUSTRATED_ACTIONS.includes(action))action='idle';
  const idle=getPetIllustration(pet.id,view);
  if(!idle)throw Error('Missing illustrated companion art');
  if((action==='idle'||action==='away')&&(theme==='neon'||view==='portrait')){
    return {buffer:idle,ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fps:null};
  }
  const exclusive=species==='pimentinha'&&view==='room'&&['brincar','acariciar','dormir'].includes(action);
  if(exclusive&&theme==='neon')return {buffer:getPimentinhaClip(view,action),ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fps:null};
  const frameKey=species+':'+view+(exclusive?':'+action:'');
  let frames=illustratedFrames.get(frameKey);
  if(!frames){frames=await decodePetSprite(species==='pimentinha'?getPimentinhaClip(view,exclusive?action:'idle'):getPetMotionSource(pet.id,view));if(!frames.length)throw Error('Invalid illustrated frames');illustratedFrames.set(frameKey,frames);}
  const portrait=view==='portrait',w=frames[0].image.width,h=frames[0].image.height;
  const canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),p=safeTheme(theme);
  // Use a complete action at a constant effect cadence, with smaller dimensions
  // as the size fallback instead of chopping off the animation or deleting the gallery.
  for(const [scale,step] of [[1,80],[.80,100],[.65,100]]){
    const ow=Math.round(w*scale),oh=Math.round(h*scale),out=createCanvas(ow,oh),oc=out.getContext('2d');
    const timeline=species==='pimentinha'?Array.from({length:Math.ceil(ACTION_DURATION/step)},(_,i)=>{
      const time=i*step,phase=time/ACTION_DURATION;
      // Use the original pose order and original relative delays, never random poses.
      const total=frames.reduce((sum,f)=>sum+f.delay,0);let at=phase*total,index=0;
      while(index<frames.length-1&&at>=frames[index].delay){at-=frames[index].delay;index++;}
      return {index,time,phase,delay:Math.min(step,ACTION_DURATION-time)};
    }):petMotionPlan(species,view,action,step);
    const enc=new GifEncoder(ow,oh,{repeat:0,quality:8});
    try{
      for(const item of timeline){
        const {phase,time,index,delay}=item,src=frames[index]?.image;
        if(!src)throw Error('Pose missing for '+species+':'+view+':'+index);
        ctx.clearRect(0,0,w,h);ctx.drawImage(src,0,0,w,h);
        if(!portrait&&theme!=='neon'){
          const lighting=ctx.createLinearGradient(0,0,w,0);
          lighting.addColorStop(0,theme==='rose'?'#e45b9c42':'#476df052');
          lighting.addColorStop(.32,'#ffffff00');lighting.addColorStop(.68,'#ffffff00');
          lighting.addColorStop(1,theme==='rose'?'#ee94bf52':'#629eff58');
          ctx.fillStyle=lighting;ctx.fillRect(0,0,w,h);
        }
        const envelope=Math.sin(Math.PI*phase)**2;
        if((action==='acariciar'||action==='coletar')&&!exclusive){
          for(let j=0;j<3;j++){const v=(phase*1.6+j/3)%1;ctx.save();ctx.globalAlpha=.78*envelope*Math.sin(Math.PI*v);heart(ctx,w*(.23+j*.25)+w*.018*Math.sin(v*TAU),h*(.62-v*.35),w*.018,p.neon);ctx.restore();}
        }
        if(action==='alimentar'){
          // Small food particles, not a false affection animation.
          for(let j=0;j<5;j++){const v=(time/760+j/5)%1;ctx.save();ctx.globalAlpha=envelope*Math.sin(v*Math.PI);ellipse(ctx,w*(.43+j*.018+v*.04),h*(.66+v*.055),w*.006,w*.004,'#eab773');ctx.restore();}
        }
        if(action==='banho'){
          for(let j=0;j<7;j++){const v=(phase*1.4+j/7)%1,bx=w*(.20+(j%5)*.15)+Math.sin(v*TAU+j)*w*.014,by=h*(.86-v*.66),r=w*(.011+j%3*.004);ctx.save();ctx.globalAlpha=.8*envelope*Math.sin(Math.PI*v);ellipse(ctx,bx,by,r,r,'#d4e9ff26');ctx.strokeStyle='#e6d6ffcc';ctx.lineWidth=1;ctx.beginPath();ctx.arc(bx,by,r,0,TAU);ctx.stroke();ellipse(ctx,bx-r*.35,by-r*.40,r*.20,r*.14,'#ffffffbe');ctx.restore();}
        }
        if(action==='dormir'&&portrait){
          for(let j=0;j<3;j++){const v=(phase+j/3)%1;ctx.save();ctx.globalAlpha=.75*Math.sin(Math.PI*v);ctx.font='bold '+Math.round(w*.035+v*w*.02)+'px sans-serif';ctx.fillStyle='#ded3ff';ctx.fillText('z',w*(.64+v*.12),h*(.46-v*.27));ctx.restore();}
        }
        if((action==='coletar'||action==='brincar')&&!exclusive){
          for(let j=0;j<3;j++){const v=(phase+j/3)%1;ctx.save();ctx.globalAlpha=.6*envelope*Math.sin(Math.PI*v);sparkle(ctx,w*(.22+j*.29),h*(.64-v*.35),w*.014,p.light);ctx.restore();}
        }
        oc.clearRect(0,0,ow,oh);oc.drawImage(canvas,0,0,ow,oh);
        const rgba=oc.getImageData(0,0,ow,oh).data;
        enc.addFrame(new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),ow,oh,{delay});
      }
      const buffer=Buffer.from(enc.finish());
      if(buffer.length<=8*1024*1024)return {buffer,ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fps:1000/step};
    }finally{enc.dispose();}
  }
  throw Error('Illustrated GIF exceeds upload limit');
}
// CPU-bound GIF encoding is isolated from Discord's heartbeat and interaction
// event loop. One concurrent worker; bounded queue; shared species-level cache.
let workerTail=Promise.resolve(),queued=0;
function renderInWorker(pet,opts){
  if(queued>=8)return Promise.reject(Error('Pet animation queue full'));
  queued++;
  const deadline=Date.now()+20000;
  const job=workerTail.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
    const budget=deadline-Date.now();if(budget<3000){reject(Error('Pet animation queue deadline exceeded'));return;}
    const worker=new Worker(new URL('./petMediaWorker.js',import.meta.url),{workerData:{pet,opts}});
    let settled=false;
    const finish=(error,result)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      worker.terminate().catch(()=>{});
      if(error)reject(error);else resolve({...result,buffer:Buffer.from(result.buffer)});
    };
    const timer=setTimeout(()=>finish(Error('Pet animation timed out')),budget);
    worker.once('message',msg=>msg.error?finish(Error(msg.error)):finish(null,msg.result));
    worker.once('error',error=>finish(error));
    worker.once('exit',code=>finish(Error('Pet animation worker exited: '+code)));
  }));
  workerTail=job.finally(()=>{queued--;});workerTail.catch(()=>{});
  let timer;
  return Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Pet animation wait expired')),20000);})]).finally(()=>clearTimeout(timer));
}
export async function renderPetWorld(pet,opts={}){
  if(opts.spriteBuffer)return render(pet,opts);
  const species=illustratedPetKey(pet.id);
  const normalized={theme:Object.hasOwn(THEMES,opts.theme)?opts.theme:'neon',view:opts.view==='portrait'?'portrait':'room',action:ILLUSTRATED_ACTIONS.includes(opts.action)?opts.action:'idle'};
  if(normalized.view==='portrait')normalized.theme='neon';
  if(species&&(normalized.action==='idle'||normalized.action==='away')&&(normalized.theme==='neon'||normalized.view==='portrait')){
    const buffer=getPetIllustration(pet.id,normalized.view);
    return {buffer,ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fps:null};
  }
  if(species==='pimentinha'&&normalized.view==='room'&&normalized.theme==='neon'&&['brincar','acariciar','dormir'].includes(normalized.action)){
    return {buffer:getPimentinhaClip('room',normalized.action),ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fps:null};
  }
  const key=JSON.stringify(species?[species,normalized.theme,normalized.view,normalized.action]:[pet.id,pet.imageUrl,pet.emoji,normalized.theme,normalized.view,normalized.action]);
  const found=gifCache.get(key);if(found&&found.expires>Date.now())return found.result;
  if(found)gifCache.delete(key);
  if(inflight.has(key))return inflight.get(key);
  const pending=(species?renderInWorker({id:pet.id},normalized).catch(error=>{
    console.warn('[pet-art] reaction failed, retaining illustrated view:',error?.message??error);
    const buffer=getPetIllustration(pet.id,opts.view==='portrait'?'portrait':'room');
    if(!buffer)throw error;
    return {buffer,ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fallback:true,fps:null};
  }):localClip(pet,opts).then(clip=>clip??render(pet,opts))).then(result=>{if(!result.fallback&&(result.sourceFound||!petThumbnailUrl(pet)))cachePut(key,result);return result;}).finally(()=>inflight.delete(key));
  inflight.set(key,pending);return pending;
}
