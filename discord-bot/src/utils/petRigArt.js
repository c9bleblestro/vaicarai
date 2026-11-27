import {createCanvas,GifEncoder,Path2D} from '@napi-rs/canvas';

// Original, deterministic 2D mascot rigs. Every frame uses the same geometry,
// colors, anchors and environment. No independent generated images or masks.
export const RIG_DURATION=5600,RIG_STEP=50;
export const RIG_ACTIONS=['idle','brincar','alimentar','acariciar','banho','dormir','aventura','coletar','away'];
const TAU=Math.PI*2,INK='#393043';
const palette={
 neon:{wall:'#473b59',upper:'#5c4b70',floor:'#8c728a',wood:'#b18e9a',trim:'#d2acc6',rug:'#b59bd3',bed:'#d9a1bf',sky:'#302d52',accent:'#f4c1db'},
 rose:{wall:'#80576d',upper:'#aa788b',floor:'#bd8d91',wood:'#d8aa9b',trim:'#f2cad0',rug:'#e3afc1',bed:'#efbfcd',sky:'#655477',accent:'#ffe1db'},
 moon:{wall:'#3e526e',upper:'#58718d',floor:'#7c8b9e',wood:'#a5b1bd',trim:'#c3cde3',rug:'#a4b5dd',bed:'#aabddc',sky:'#222d4b',accent:'#e2ebff'}
};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const wave=(t,center,width)=>Math.max(0,1-Math.abs(t-center)/width);
const easeWave=(t,c,w)=>smooth(wave(t,c,w));
function path(c,d,f,s=INK,l=2.5){const p=new Path2D(d);if(f){c.fillStyle=f;c.fill(p);}if(s){c.strokeStyle=s;c.lineWidth=l;c.lineJoin='round';c.lineCap='round';c.stroke(p);}}
function ellipse(c,x,y,rx,ry,f,s=null,l=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(f){c.fillStyle=f;c.fill();}if(s){c.strokeStyle=s;c.lineWidth=l;c.stroke();}}
function round(c,x,y,w,h,r,f,s=null,l=2){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();if(f){c.fillStyle=f;c.fill();}if(s){c.strokeStyle=s;c.lineWidth=l;c.stroke();}}
function line(c,d,s,l=2){path(c,d,null,s,l);}
function star(c,x,y,r,f){path(c,'M'+x+' '+(y-r)+' Q'+(x+2)+' '+(y-2)+' '+(x+r)+' '+y+' Q'+(x+2)+' '+(y+2)+' '+x+' '+(y+r)+' Q'+(x-2)+' '+(y+2)+' '+(x-r)+' '+y+' Q'+(x-2)+' '+(y-2)+' '+x+' '+(y-r)+' Z',f,null);}
function heart(c,x,y,r,f){c.save();c.translate(x,y);c.scale(r,r);path(c,'M0 .8 C-1.6 -.2 -.8 -1.3 0 -.5 C.8 -1.3 1.6 -.2 0 .8Z',f,null);c.restore();}
function gradient(c,x,y,x2,y2,a,b){const g=c.createLinearGradient(x,y,x2,y2);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function room(c,theme){
 const p=palette[theme]??palette.neon;
 c.fillStyle=gradient(c,0,0,480,230,p.upper,p.wall);c.fillRect(0,0,480,216);
 // Wallpaper panels with soft highlights and a fixed horizon.
 for(let x=0;x<480;x+=32){c.fillStyle=x%64===0?'#ffffff08':'#30243e0a';c.fillRect(x,0,16,211);}
 c.fillStyle=gradient(c,0,216,0,320,p.floor,p.wood);c.fillRect(0,216,480,104);
 round(c,0,207,480,10,2,p.trim,INK,1.5);
 for(let i=-2;i<11;i++)line(c,'M'+(i*52)+' 320 L'+(240+(i*52-240)*.47)+' 218','#51435944',1);
 for(const y of [242,278,319])line(c,'M0 '+y+' H480','#51435944',1);
 // Framed evening window, curtain folds, moon and city silhouettes.
 round(c,320,20,130,143,10,'#332c4355');round(c,314,14,130,142,9,p.trim,INK,2);
 round(c,321,21,116,128,5,p.sky,INK,1.5);
 ellipse(c,407,46,13,13,'#f8e3b3');ellipse(c,413,42,12,12,p.sky);
 for(const [x,y,r] of [[338,38,2],[371,56,1.5],[389,30,2],[424,78,2],[349,83,1]])star(c,x,y,r,'#f5d9c9');
 for(let i=0;i<10;i++){const h=14+(i*17)%39,x=322+i*11;c.fillStyle=i%2?'#273047':'#3b405b';c.fillRect(x,149-h,10,h);c.fillStyle='#e9be8d';c.fillRect(x+3,145-h,2,3);}
 line(c,'M379 22 V149 M322 84 H437',p.trim,5);
 path(c,'M310 16 Q332 46 320 107 L308 143 L294 143 Q312 85 293 16Z',p.bed,INK,2);
 path(c,'M448 16 Q426 46 438 107 L450 143 L465 143 Q447 85 465 16Z',p.bed,INK,2);
 line(c,'M300 101 L323 106 M435 106 L458 101',p.accent,5);
 // Shelf, books, small planter, framed star and little string of lights.
 round(c,21,62,118,8,3,p.trim,INK,1.5);
 for(let i=0;i<6;i++)round(c,26+i*13,37-(i%3)*5,10,25+(i%3)*5,2,[p.bed,'#ded1a8','#8fa6a0'][i%3],INK,1.3);
 path(c,'M115 45 H133 L130 62 H119Z','#d4b6a2',INK,1.5);
 for(const [x,y,a] of [[121,40,-.5],[129,34,.4],[117,30,-.6]]){c.save();c.translate(x,y);c.rotate(a);ellipse(c,0,0,4,12,'#a3b89b',INK,1.2);c.restore();}
 round(c,151,27,36,41,4,p.trim,INK,2);round(c,156,32,26,31,2,'#f2d9c9');star(c,169,47,9,'#b795b8');
 line(c,'M195 29 Q248 53 301 27','#d9bfd1',1.3);
 for(let i=0;i<6;i++){const x=200+i*19,y=30+Math.sin(i*Math.PI/5)*12;ellipse(c,x,y+5,3,4,i%2?'#f8d79c':'#ebc7e7');}
 // Low dresser and toy storage.
 ellipse(c,65,229,63,8,'#3f304244');round(c,13,152,108,69,8,p.wall,INK,2);
 round(c,9,146,116,12,4,p.trim,INK,2);
 for(const y of [164,191]){round(c,21,y,92,22,5,p.upper,INK,1.4);line(c,'M55 '+(y+10)+' H79',p.trim,3);}
 for(const x of [23,109])line(c,'M'+x+' 222 v7',INK,4);
 // Bed is an actual floor-level object with a pillow and stitched trim.
 ellipse(c,382,249,87,13,'#44334b35');
 round(c,320,183,131,60,19,p.bed,INK,2);
 round(c,327,176,117,42,17,p.bed,INK,2);
 round(c,335,185,50,25,10,p.accent,INK,1.5);
 round(c,322,209,128,33,13,p.accent,INK,2);
 line(c,'M338 234 Q382 240 434 234',p.bed,2);
 // Rug centered in front of the bed, with alternating hand-inked border.
 ellipse(c,242,278,158,34,'#4b394c38');ellipse(c,242,274,157,34,p.rug,INK,1.5);
 c.save();c.setLineDash([3,4]);ellipse(c,242,274,146,28,null,p.accent,1.6);c.restore();
 ellipse(c,242,274,26,9,'#fff1f327');
 // Water bowl, plant, and a tiny plush star (all stationary).
 ellipse(c,69,282,28,6,'#42334244');path(c,'M44 268 Q69 262 94 268 L89 280 Q69 288 49 280Z','#c9b7d8',INK,1.5);ellipse(c,69,269,25,6,'#68617b',INK,1.3);ellipse(c,69,269,19,3.7,'#b3d7dd');
 path(c,'M461 240 H476 L473 261 H464Z','#c5a78f',INK,1.5);for(const [x,y,rot] of [[462,233,-.45],[470,225,.15],[475,232,.55]]){c.save();c.translate(x,y);c.rotate(rot);ellipse(c,0,0,4,12,'#90ae96',INK,1);c.restore();}
 star(c,130,247,10,'#f2d4a0');
}
function bowl(c,x,y,food){c.save();c.translate(x,y);ellipse(c,0,4,24,6,'#382c4244');path(c,'M-22 -8 Q0 -14 22 -8 L18 3 Q0 12 -18 3Z','#cbb3d9',INK,1.7);ellipse(c,0,-8,22,6,'#72586d',INK,1.3);for(let i=0;i<8*food;i++)ellipse(c,-15+(i*7)%30,-10+(i*3)%6,3,2,'#dbac7d');c.restore();}
function ball(c,x,y,p){ellipse(c,x,y+9,14,4,'#49394844');ellipse(c,x,y,13,13,p.bed,INK,1.8);line(c,'M'+(x-9)+' '+(y-8)+' Q'+(x+6)+' '+(y-1)+' '+(x+8)+' '+(y+9),p.accent,3);}
function animal(c,species,pose){
 const cat=species==='luna',fur=cat?'#555064':'#777684',dark=cat?'#464153':'#555663',cream=cat?'#f8ede4':'#fff1e5',pink='#e6adbd',iris=cat?'#9a72b5':'#6e9baa';
 const {breath,tail,ear,blink,head,leg,sleep,chew,smile}=pose;
 // Tail anchor is at the hip. Tip is a separate painted section.
 c.save();c.translate(-36,-39);c.rotate(tail);
 const tailD=cat?'M0 7 C-37 16 -55 -7 -51 -32 C-49 -48 -33 -49 -29 -36 C-27 -24 -40 -15 -27 -7 C-20 -2 -9 -4 0 -10Z':'M0 7 C-28 16 -61 -1 -63 -26 C-66 -51 -42 -65 -26 -50 C-11 -36 -37 -37 -38 -23 C-39 -9 -21 -8 0 -10Z';
 path(c,tailD,fur,INK,3);
 path(c,cat?'M-51 -32 C-49 -48 -33 -49 -29 -36 C-28 -29 -31 -24 -34 -20 Q-42 -22 -51 -32Z':'M-63 -26 C-66 -51 -42 -65 -26 -50 C-14 -39 -31 -37 -37 -31 Q-48 -34 -63 -26Z',cream,INK,1.4);
 c.restore();
 c.save();c.translate(0,-sleep*8);c.scale(1+sleep*.11,1-sleep*.13+breath*.012);
 // Haunch, torso, chest and two articulated front legs.
 ellipse(c,-28,-22,29,25,fur,INK,2.8);ellipse(c,9,-36,43,43,fur,INK,2.8);
 path(c,'M9 -72 C28 -68 44 -42 36 -21 C23 -7 6 -15 -1 -32 C-10 -48 -2 -63 9 -72Z',cream,null);
 ellipse(c,-31,-5,23,9,cream,INK,2.4);
 for(const [x,offset] of [[8,-leg],[32,leg]]){c.save();c.translate(x,-30);c.rotate(offset);path(c,'M-8 -10 Q-12 5 -9 24 Q-13 31 -2 32 H10 Q20 31 15 23 L12 -10Z',fur,INK,2.4);path(c,'M-9 23 Q0 19 14 23 Q19 32 8 33 H-2 Q-13 32 -9 23Z',cream,INK,1.6);line(c,'M1 27 v4 M7 27 v4','#8a7482',.9);c.restore();}
 // Neck accessory is attached to the neck, not the image border.
 path(c,'M-9 -64 Q15 -57 38 -65 L36 -53 Q15 -47 -8 -54Z','#a887c3',INK,2);
 if(cat){path(c,'M15 -53 L18 -47 L25 -46 L20 -41 L21 -34 L15 -38 L9 -34 L10 -41 L5 -46 L12 -47Z','#f7db9e',INK,1.3);}
 else path(c,'M11 -54 L41 -51 L22 -28Z','#ac89c6',INK,1.8);
 // Head pivot: independent movement, ears and facial expression.
 c.save();c.translate(9,-82);c.rotate(head);c.translate(-9,82);
 for(const [side,rot] of [[-1,-ear],[1,ear]]){
   c.save();c.translate(10+side*31,-112);c.rotate(rot);c.scale(side,1);
   path(c,cat?'M-14 12 Q-21 -9 -13 -38 Q-10 -43 -5 -37 L22 -5Z':'M-15 11 Q-21 -15 -11 -39 Q-8 -44 -3 -40 Q12 -27 23 -4Z',dark,INK,2.8);
   path(c,'M-9 2 Q-14 -10 -9 -27 L10 -5Z',pink,null);
   c.restore();
 }
 path(c,'M-37 -101 Q-22 -127 9 -126 Q42 -127 57 -101 Q69 -79 54 -62 Q40 -49 11 -49 Q-22 -49 -38 -65 Q-53 -81 -37 -101Z',fur,INK,3);
 if(!cat){
   path(c,'M-38 -91 Q-26 -110 -9 -111 Q4 -111 10 -97 Q17 -111 34 -110 Q50 -107 58 -91 L52 -69 Q39 -51 10 -50 Q-20 -50 -35 -67Z',cream,null);
   path(c,'M-11 -121 Q10 -126 31 -120 L22 -105 L10 -94 L0 -105Z',dark,null);
 }else{
   path(c,'M-35 -78 Q-21 -90 -4 -74 Q10 -70 15 -67 Q29 -86 49 -78 Q53 -60 30 -53 Q6 -46 -19 -54 Q-36 -61 -35 -78Z',cream,null);
   line(c,'M-4 -120 L-1 -114 M9 -122 v7 M22 -120 L19 -114',dark,2.3);
 }
 const openness=Math.max(.025,1-blink);
 for(const x of [-10,32]){
   if(blink>.84){line(c,'M'+(x-8)+' -87 Q'+x+' -82 '+(x+8)+' -87',INK,2.6);}
   else{
     ellipse(c,x,-89,9,12*openness,'#fff7ed',INK,2);
     ellipse(c,x+1,-88,5.6,8.8*openness,iris);
     ellipse(c,x+1,-89,3.1,6.3*openness,INK);
     ellipse(c,x-1,-92,2,2.6*openness,'#ffffff');
   }
 }
 ellipse(c,-26,-73,6,3,pink);ellipse(c,48,-73,6,3,pink);
 path(c,'M6 -75 Q11 -78 16 -75 Q18 -72 11 -69 Q4 -72 6 -75Z',cat?'#bc879b':INK,INK,1);
 if(chew>.25||smile>.6){ellipse(c,11,-63,4+smile*2,2+chew*3,INK);ellipse(c,11,-61,3,1.5,'#e7a8b1');}
 else{line(c,'M11 -69 V-65 M3 -65 Q7 -61 11 -65 Q15 -61 19 -65',INK,1.7);}
 if(cat){line(c,'M-25 -68 l-12 -2 M-25 -64 l-11 2 M48 -68 l12 -2 M48 -64 l11 2','#96818e',1.15);}
 c.restore();c.restore();
}
export function rigPose(action,t){
 const cycle=TAU*t,act=easeWave(t,.5,.43),sleep=action==='dormir'?1:0;
 const blink=Math.max(easeWave(t,.19,.025),easeWave(t,.78,.028),sleep);
 const pose={breath:Math.sin(cycle*2),tail:.12*Math.sin(cycle*3),ear:.07*Math.sin(cycle*2),blink,head:.035*Math.sin(cycle),leg:0,sleep,chew:0,smile:0,x:0,jump:0};
 if(action==='brincar'){pose.x=act*30*Math.sin(cycle*2);pose.jump=act*13*Math.abs(Math.sin(cycle*3));pose.leg=.25*act*Math.sin(cycle*3);pose.tail=.4*Math.sin(cycle*4)*act;pose.smile=act;}
 if(action==='alimentar'){pose.head=.18*act+.055*act*Math.sin(cycle*7);pose.chew=act*(.5+.5*Math.sin(cycle*8));}
 if(action==='acariciar'){pose.blink=Math.max(blink,.94*act);pose.head=.11*Math.sin(cycle*2)*act;pose.smile=act;pose.tail=.25*Math.sin(cycle*4);}
 if(action==='banho'){pose.ear=.17*Math.sin(cycle*5)*act;pose.head=.04*Math.sin(cycle*5)*act;pose.blink=Math.max(blink,act*.7);}
 if(action==='aventura'||action==='coletar'){pose.x=act*34*Math.sin(cycle);pose.leg=.24*act*Math.sin(cycle*4);pose.jump=4*act*Math.abs(Math.sin(cycle*4));pose.smile=act;}
 if(sleep){pose.tail=.035*Math.sin(cycle*2);pose.head=.15;pose.ear=.02*Math.sin(cycle);}
 return pose;
}
export function drawRigFrame(c,species,{view='room',theme='neon',action='idle',t=0}={}){
 const portrait=view==='portrait',p=palette[theme]??palette.neon;
 c.clearRect(0,0,portrait?384:480,portrait?256:320);
 if(!portrait)room(c,theme);
 const pose=rigPose(action,t),activity=easeWave(t,.5,.43),x=(portrait?192:242)+pose.x,ground=portrait?226:270;
 // Stable feet and camera. Only the pet's independently articulated parts move.
 if(action==='alimentar')bowl(c,x+58,ground+2,1-.85*activity);
 if(action==='brincar')ball(c,x+70+18*Math.sin(t*TAU*2),ground-8-15*activity*Math.abs(Math.sin(t*TAU*3)),p);
 if(action==='dormir'&&!portrait){round(c,x-69,ground-15,138,23,11,p.bed,INK,1.5);line(c,'M'+(x-50)+' '+(ground+4)+' H'+(x+50),p.accent,1.5);}
 if(!portrait)ellipse(c,x,ground+4,57-pose.jump*.8,8,'#49344945');
 c.save();c.translate(x,ground-pose.jump);c.scale(portrait?1.28:1.19,portrait?1.28:1.19);animal(c,species,pose);c.restore();
 if(action==='banho'){
   // The front of the basin occludes the feet; bubbles rise around the pet.
   path(c,'M'+(x-68)+' '+(ground-26)+' Q'+x+' '+(ground-14)+' '+(x+68)+' '+(ground-26)+' L'+(x+57)+' '+(ground+5)+' Q'+x+' '+(ground+22)+' '+(x-57)+' '+(ground+5)+'Z','#b7c9dd',INK,2);
   for(let i=0;i<7;i++){const u=(t*2+i/7)%1,r=5+i%3*2,bx=x-64+(i*23)%128+Math.sin(u*TAU)*5,by=ground-25-u*115;c.save();c.globalAlpha=Math.sin(u*Math.PI)*.8;ellipse(c,bx,by,r,r,'#eef7ff70','#eaf3f9',1.3);ellipse(c,bx-r*.3,by-r*.3,1.5,1.5,'#fff');c.restore();}
 }
 if(action==='acariciar'||action==='coletar')for(let i=0;i<4;i++){const u=(t+i/4)%1;c.save();c.globalAlpha=Math.sin(u*Math.PI)*activity;heart(c,x-67+i*43,ground-65-u*82,6,p.accent);c.restore();}
 if(action==='dormir')for(let i=0;i<3;i++){const u=(t+i/3)%1;c.save();c.globalAlpha=Math.sin(u*Math.PI);c.fillStyle=portrait?'#a38db8':p.accent;c.font='bold '+Math.round(11+u*8)+'px sans-serif';c.fillText('z',x+47+u*20,ground-115-u*35);c.restore();}
 if(action==='coletar'){round(c,x+44,ground-31,37,29,5,'#e5b77b',INK,1.6);line(c,'M'+(x+44)+' '+(ground-18)+' h37',INK,1.5);star(c,x+63,ground-18,6,'#fff2c8');}
}

// Transparent GIFs must restore the frame area before drawing the next one.
// Otherwise moving ears/tails can leave ghost pixels on Discord's GIF decoder.
export function normalizePortraitDisposal(buffer){
  const out=Buffer.from(buffer);let offset=13,first=true,controls=0;
  if(out[10]&128)offset+=3*(1<<((out[10]&7)+1));
  const skip=()=>{while(offset<out.length){const n=out[offset++];if(!n)return;offset+=n;}throw Error('Truncated GIF block');};
  while(offset<out.length){
    const tag=out[offset++];if(tag===0x3b)break;
    if(tag===0x21){
      const kind=out[offset++];
      if(kind===0xf9){
        if(out[offset]!==4||!(out[offset+1]&1))throw Error('Portrait encoder lost transparency');
        out[offset+1]=(out[offset+1]&0xe3)|(2<<2);
        if(first){out[11]=out[offset+4];first=false;}
        controls++;
      }
      skip();
    }else if(tag===0x2c){
      const flags=out[offset+8];offset+=9;
      if(flags&128)offset+=3*(1<<((flags&7)+1));
      offset++;skip();
    }else throw Error('Invalid GIF block');
  }
  if(!controls)throw Error('Missing GIF frame controls');
  return out;
}

export function renderRigGif(species,{view='room',theme='neon',action='idle'}={}){
 if(!['luna','koda'].includes(species))throw Error('Unknown companion rig');
 view=view==='portrait'?'portrait':'room';theme=Object.hasOwn(palette,theme)?theme:'neon';
 action=RIG_ACTIONS.includes(action)?action:'idle';if(action==='away')action='idle';
 const w=view==='portrait'?384:480,h=view==='portrait'?256:320;
 const canvas=createCanvas(w,h),c=canvas.getContext('2d');
 // Stable 20fps motion, 112 actual render samples. No stretching old GIF frames.
 const count=RIG_DURATION/RIG_STEP,enc=new GifEncoder(w,h,{repeat:0,quality:8});
 try{
   for(let i=0;i<count;i++){drawRigFrame(c,species,{view,theme,action,t:i/count});const data=c.getImageData(0,0,w,h).data;
     enc.addFrame(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),w,h,{delay:RIG_STEP});}
   const raw=Buffer.from(enc.finish()),buffer=view==='portrait'?normalizePortraitDisposal(raw):raw;
   if(buffer.length>8*1024*1024)throw Error('Rig GIF exceeds upload limit');
   return {buffer,ext:'gif',sourceAnimated:true,sourceFound:true,illustrated:true,fps:20};
 }finally{enc.dispose();}
}
