import {createCanvas} from '@napi-rs/canvas';
const tau=Math.PI*2;
const clamp=(x)=>Math.max(0,Math.min(1,x));
const rgb=(c)=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
function path(ctx,points,close=true){ctx.beginPath();for(let i=0;i<points.length;i++){const [x,y]=points[i];if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}if(close)ctx.closePath();}
export function drawGraphiteIcon(ctx,index,x,y,size,c){
 ctx.save();ctx.translate(x,y);ctx.scale(size/32,size/32);ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';
 const circle=(x,y,r,fill=false)=>{ctx.beginPath();ctx.arc(x,y,r,0,tau);fill?ctx.fill():ctx.stroke()};
 const ellipse=(x,y,rx,ry)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,tau);ctx.stroke()};
 if(index===0){path(ctx,Array.from({length:10},(_,i)=>{let a=i*Math.PI/5-Math.PI/2,r=i%2?6:13;return [Math.cos(a)*r,Math.sin(a)*r]}));ctx.fill();}
 if(index===1){path(ctx,[[3,-14],[-10,3],[-1,3],[-4,14],[11,-5],[2,-5]]);ctx.fill();}
 if(index===2){circle(0,-4,9);circle(0,-4,4);path(ctx,[[-6,4],[-9,14],[-2,11],[0,14],[2,5]],false);ctx.stroke();path(ctx,[[5,4],[9,14],[3,11]],false);ctx.stroke();}
 if(index===3){for(let i=0;i<3;i++){let yy=-8+i*6;ellipse(-3,yy,10,4);if(i<2){ctx.beginPath();ctx.moveTo(-13,yy);ctx.lineTo(-13,yy+6);ctx.moveTo(7,yy);ctx.lineTo(7,yy+6);ctx.stroke();}}circle(8,8,7,true);}
 if(index===4){circle(-6,3,8);circle(6,3,8);path(ctx,[[1,-6],[6,-13],[11,-6],[6,-4]]);ctx.fill();}
 if(index===5){circle(-6,-6,5,true);circle(7,-4,4,true);ctx.beginPath();ctx.ellipse(-6,10,10,8,0,Math.PI,tau);ctx.closePath();ctx.fill();ctx.beginPath();ctx.ellipse(7,10,7,6,0,Math.PI,tau);ctx.closePath();ctx.fill();}
 if(index===6){path(ctx,[[-8,-11],[8,-11],[7,-1],[3,4],[-3,4],[-7,-1]]);ctx.fill();path(ctx,[[-8,-8],[-13,-8],[-12,-1],[-7,1]],false);ctx.stroke();path(ctx,[[8,-8],[13,-8],[12,-1],[7,1]],false);ctx.stroke();path(ctx,[[0,4],[0,11],[-6,11],[6,11]],false);ctx.stroke();}
 if(index===7){ctx.beginPath();ctx.moveTo(-11,12);ctx.bezierCurveTo(-8,-7,2,-14,13,-13);ctx.bezierCurveTo(12,1,4,8,-6,8);ctx.closePath();ctx.fill();ctx.strokeStyle='#647487';path(ctx,[[-11,12],[7,-7]],false);ctx.stroke();}
 ctx.restore();
}
const classicMaskCache=new WeakMap();
function classicMask(base){
 // Legacy text values only: exclude icons, avatar, banner and XP progress bar.
 const img=base.getContext('2d').getImageData(0,0,800,600);
 const mask=createCanvas(800,600),mc=mask.getContext('2d'),out=mc.createImageData(800,600);
 for(let i=0;i<6;i++){
   const x=280+(i%2)*255,y=274+Math.floor(i/2)*92;
   const at=(xx,yy)=>(yy*800+xx)*4,ref=at(x+90,y+12),bg=luminance(...img.data.slice(ref,ref+3));
   for(let yy=y+17;yy<y+45;yy++)for(let xx=x+85;xx<x+233;xx++){
    const j=at(xx,yy),l=luminance(...img.data.slice(j,j+3));
    const a=clamp((Math.abs(l-bg)-32)/95);
    if(a){out.data[j]=out.data[j+1]=out.data[j+2]=255;out.data[j+3]=Math.round(a*255);}
   }
 }
 mc.putImageData(out,0,0);classicMaskCache.set(base,mask);return mask;
}
function reflection(ctx,phase,base,theme,appearance){
 if(!base)return;
 const mask=base.profileTextMask??(classicMaskCache.get(base)||classicMask(base));
 const overlay=createCanvas(800,600),o=overlay.getContext('2d');
 // A narrow diagonal specular streak crosses the letter shapes, not the boxes.
 // Pause at both ends so the loop has no visible reset.
 const u=clamp((phase-.08)/.80),center=-150+u*1100;
 const [r,g,b]=rgb(theme.accent),[lr,lg,lb]=rgb(theme.light);
 const grad=o.createLinearGradient(center-100,0,center+100,0);
 grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(.25,'rgba(0,0,0,0)');
 grad.addColorStop(.40,'rgba('+r+','+g+','+b+',0.9)');
 grad.addColorStop(.48,'rgba('+lr+','+lg+','+lb+',0.98)');
 grad.addColorStop(.52,'rgba(255,255,255,1)');
 grad.addColorStop(.60,'rgba('+r+','+g+','+b+',0.85)');
 grad.addColorStop(.77,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,0)');
 o.save();o.transform(1,0,-.16,1,0,0);o.fillStyle=grad;o.fillRect(-200,0,1200,600);o.restore();
 o.globalCompositeOperation='destination-in';o.drawImage(mask,0,0);
 ctx.drawImage(overlay,0,0);
}
function butterfly(ctx,x,y,size,rotation,beat,theme,alpha){
 ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=alpha;
 const flap=.38+.62*Math.abs(Math.cos(beat));
 for(const sign of [-1,1]){
  ctx.save();ctx.scale(sign*flap,1);
  const g=ctx.createLinearGradient(0,-size,size, size);g.addColorStop(0,theme.light);g.addColorStop(.55,theme.accent);g.addColorStop(1,theme.light);
  ctx.fillStyle=g;ctx.strokeStyle=theme.light;ctx.lineWidth=.65;
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(size*.25,-size*1.4,size*1.4,-size*1.25,size*1.05,-size*.25);ctx.bezierCurveTo(size*.87,size*.06,size*.36,size*.15,0,0);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(size*.98,-size*.06,size*.95,size*.94,size*.39,size*.76);ctx.bezierCurveTo(size*.12,size*.63,0,size*.28,0,0);ctx.fill();ctx.stroke();ctx.restore();
 }
 ctx.strokeStyle=theme.light;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(0,-size*.44);ctx.lineTo(0,size*.65);ctx.moveTo(0,-size*.35);ctx.quadraticCurveTo(-size*.23,-size*.7,-size*.30,-size*.78);ctx.moveTo(0,-size*.35);ctx.quadraticCurveTo(size*.23,-size*.7,size*.30,-size*.78);ctx.stroke();ctx.restore();
}
function butterflies(ctx,appearance,phase,theme){
 const classic=false;
 const paths=classic?[[17,18,770,10],[11,580,775,584]]:[[12,17,780,17],[15,588,780,588]];
 for(let i=0;i<6;i++){
  const u=(phase+i/6)%1,fade=Math.sin(Math.PI*u),lane=paths[i%2],x=lane[0]+(lane[2]-lane[0])*(i%2?1-u:u),y=lane[1]+Math.sin(u*tau*2+i)*5;
  for(let j=1;j<=5;j++){const xx=x+(i%2?1:-1)*j*6;ctx.save();ctx.globalAlpha=fade*(6-j)*.045;ctx.fillStyle=theme.light;ctx.beginPath();ctx.arc(xx,y+Math.sin(j*.8+i)*3,1.6,0,tau);ctx.fill();ctx.restore();}
  butterfly(ctx,x,y,7+i%3*1.5,Math.sin(u*tau*2+i)*.35+(i%2?-.8:.8),phase*tau*8+i,theme,fade*.95);
 }
 const [cx,cy,rr]=classic?[155,163,96]:[659,124,103];
 for(let i=0;i<2;i++){
  const a=phase*tau+i*Math.PI;
  butterfly(ctx,cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,9,a+Math.PI/2,phase*tau*8+i,theme,.92);
 }
}
function rounded(ctx,x,y,w,h,r){
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function crystalWave(ctx,phase,theme){
 // Sweep left-to-right through each row, then the footer. Light never touches
 // the banner, avatar or biography; no pixel displacement or data changes.
 const panels=[];
 for(let i=0;i<6;i++)panels.push([i%2?408:24,284+Math.floor(i/2)*76,368,66]);
 panels.push([24,514,448,65],[484,514,292,65]);
 const rgba=(hex,a)=>'rgba('+rgb(hex).join(',')+','+a+')';
 const clock=phase*9.8-.8;
 for(let i=0;i<panels.length;i++){
  const [x,y,w,h]=panels[i],u=(clock-i+.50)/2.25;
  if(u<=0||u>=1)continue;
  const power=Math.pow(Math.sin(Math.PI*u),1.35);
  const cx=x-38+(w+76)*u,cy=y+h*(.63-.30*u);
  ctx.save();rounded(ctx,x,y,w,h,19);ctx.clip();
  // Wide, diffused light inside the capsule plus tighter specular reflection.
  const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,88);
  halo.addColorStop(0,rgba(theme.accent,.34*power));halo.addColorStop(.48,rgba(theme.accent,.13*power));halo.addColorStop(1,rgba(theme.accent,0));
  ctx.fillStyle=halo;ctx.fillRect(x,y,w,h);
  const streak=ctx.createLinearGradient(cx-74,y,cx+74,y);
  streak.addColorStop(0,rgba(theme.light,0));streak.addColorStop(.38,rgba(theme.accent,.22*power));streak.addColorStop(.5,rgba(theme.light,.94*power));streak.addColorStop(.62,rgba(theme.accent,.25*power));streak.addColorStop(1,rgba(theme.light,0));
  // Highlight follows the existing rounded frame, with a blurred bloom beneath.
  rounded(ctx,x+1.5,y+1.5,w-3,h-3,17.5);ctx.strokeStyle=streak;ctx.lineWidth=7;ctx.globalAlpha=.42;ctx.stroke();
  ctx.globalAlpha=1;rounded(ctx,x+1.5,y+1.5,w-3,h-3,17.5);ctx.lineWidth=2;ctx.stroke();
  // The travelling glow catches the original icon without replacing it.
  const iconPower=power*Math.exp(-Math.pow((cx-(x+36))/49,2));
  if(iconPower>.005&&i<6){const icon=ctx.createRadialGradient(x+36,y+33,1,x+36,y+33,36);
   icon.addColorStop(0,rgba(theme.light,.24*iconPower));icon.addColorStop(.55,rgba(theme.accent,.17*iconPower));icon.addColorStop(1,rgba(theme.light,0));ctx.fillStyle=icon;ctx.fillRect(x+1,y+1,72,h-2);
  }
  // A fine shine at the moving lower edge, rather than a full-panel flash.
  const glint=ctx.createLinearGradient(cx-30,y,cx+30,y);glint.addColorStop(0,rgba(theme.light,0));glint.addColorStop(.5,rgba(theme.light,.92*power));glint.addColorStop(1,rgba(theme.light,0));
  ctx.strokeStyle=glint;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(Math.max(x+19,cx-30),y+h-2);ctx.lineTo(Math.min(x+w-19,cx+30),y+h-2);if(cx>x+19&&cx<x+w-19)ctx.stroke();
  ctx.restore();
 }
}
export function drawNewProfileEffect(ctx,appearance,phase,base,theme){
 if(appearance.effect==='reflection')reflection(ctx,phase,base,theme,appearance);
 else if(appearance.effect==='butterflies')butterflies(ctx,appearance,phase,theme);
 else if(appearance.effect==='crystal')crystalWave(ctx,phase,theme);
}
