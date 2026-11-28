import {scene,box,txt,gradient,ellipse,avatar,png,coins,noise} from './gameArt.js';
function rocket(ctx,x,y,angle){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);
 const flame=ctx.createLinearGradient(0,15,0,53);flame.addColorStop(0,'#fff2a2');flame.addColorStop(.4,'#ff9a31');flame.addColorStop(1,'#ff3a2900');
 ctx.beginPath();ctx.moveTo(-10,16);ctx.quadraticCurveTo(-13,31,0,55);ctx.quadraticCurveTo(13,31,10,16);ctx.fillStyle=flame;ctx.fill();
 ctx.beginPath();ctx.moveTo(0,-32);ctx.bezierCurveTo(20,-15,19,8,8,22);ctx.lineTo(-8,22);ctx.bezierCurveTo(-19,8,-20,-15,0,-32);ctx.fillStyle=gradient(ctx,-20,-30,40,0,[[0,'#aab3be'],[.5,'#fff'],[1,'#c6cdd5']]);ctx.fill();
 ctx.fillStyle='#cf3b35';ctx.beginPath();ctx.moveTo(-11,5);ctx.lineTo(-25,24);ctx.lineTo(-7,20);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(11,5);ctx.lineTo(25,24);ctx.lineTo(7,20);ctx.closePath();ctx.fill();ellipse(ctx,0,-8,8,8,'#273e4c','#697e8a',2);ctx.restore();
}
export async function generateCrashCard({multiplier=1,crashAt=2,status='playing',bet=0,payout=0,elapsedMs=0,name='',avatar:av=null}={}){
 const [c,ctx]=scene();ctx.fillStyle=gradient(ctx,0,0,1200,675,[[0,'#202327'],[1,'#090b0c']]);ctx.fillRect(0,0,1200,675);noise(ctx,0,0,1200,675,14,9000);
 const live=status==='playing',current=Math.max(1,Number(multiplier)||1),max=Math.max(2,Math.ceil(current*1.2)); // never use the secret crash point while live
 const accent=status==='cashed'?'#a4d6ae':status==='crashed'?'#ed665a':'#f44a42';
 txt(ctx,'Substancy',34,30,21,'#d2d5d8');txt(ctx,'CRASH',34,73,47,'#fff');
 txt(ctx,live?'EM ANDAMENTO':status==='cashed'?'ENCERRADO · SACADO':'ENCERRADO · QUEBROU',1162,42,20,accent,true,'right');
 box(ctx,33,111,1134,409,15,'#111416','#414449');
 const x0=116,y0=477,x1=1104,y1=151;ctx.lineWidth=1;ctx.strokeStyle='#ffffff16';
 for(let i=0;i<=4;i++){const y=y0-(y0-y1)*i/4;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();txt(ctx,(1+(max-1)*i/4).toFixed(2)+'x',103,y,15,'#aeb4bb',false,'right');}
 for(let i=0;i<=10;i++){const x=x0+(x1-x0)*i/10;ctx.beginPath();ctx.moveTo(x,y1);ctx.lineTo(x,y0);ctx.stroke();}
 const progress=Math.min(.94,Math.max(.03,elapsedMs/80000)),end=x0+(x1-x0)*progress,yy=v=>y0-(y0-y1)*(v-1)/(max-1);
 const points=Array.from({length:81},(_,i)=>{const t=i/80;return [x0+(end-x0)*t,yy(1+(current-1)*t**2)];});
 ctx.beginPath();ctx.moveTo(x0,y0);points.forEach(([x,y])=>ctx.lineTo(x,y));ctx.lineTo(end,y0);ctx.closePath();ctx.fillStyle=gradient(ctx,0,y1,0,y0-y1,[[0,accent+'65'],[1,accent+'08']]);ctx.fill();
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.shadowColor=accent;ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;
 const ey=yy(current);if(status==='crashed'){ellipse(ctx,end,ey,12,12,'#ed665a');txt(ctx,'×',end,ey,22,'#fff',true,'center');}else rocket(ctx,end,ey,Math.atan2(ey-points[78][1],end-points[78][0]));
 box(ctx,416,132,368,96,16,'#111416ed','#414449');txt(ctx,current.toFixed(2)+'x',600,181,68,'#fff',true,'center');
 await avatar(ctx,av,83,589,37,name,'#777e83');txt(ctx,name||'Jogador',137,576,23,'#fff',true,'left',300);txt(ctx,'Rodada individual',137,608,17,'#aeb4bb',false);
 for(const [x,label,value] of [[466,'APOSTA',coins(bet)],[807,live?'RETORNO ATUAL':'RETORNO',coins(live?Math.floor(bet*current):payout)]]){box(ctx,x,547,320,91,12,'#16191c','#414449');txt(ctx,label,x+20,573,15,'#b6bdc3',false);txt(ctx,value+' coins',x+20,609,29,'#fff');}
 return png(c);
}
