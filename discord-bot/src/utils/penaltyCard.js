import {scene,box,txt,gradient,ellipse,avatar,png,coins,noise} from './gameArt.js';
const goal={x:255,y:185,w:690,h:295};
const at=d=>d==='left'?goal.x+goal.w*.18:d==='right'?goal.x+goal.w*.82:600;
function stadium(ctx){
 ctx.fillStyle=gradient(ctx,0,0,0,675,[[0,'#071a27'],[.55,'#24465a'],[1,'#15291b']]);ctx.fillRect(0,0,1200,675);
 for(let i=0;i<4;i++){const y=105+i*55;ctx.fillStyle=i%2?'#1b2b36':'#263b46';ctx.fillRect(0,y,1200,44);for(let j=0;j<170;j++){const x=j*7+((i*13)%7),v=(j*17+i*11)%9;ellipse(ctx,x,y+6+v*3,2.4,3.1,['#6d8795','#e2d7bd','#647583','#152431','#b8c5d0'][v%5]);}}
 for(const x of [70,1130]){const g=ctx.createRadialGradient(x,100,1,x,100,170);g.addColorStop(0,'#ffffff70');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(x-170,0,340,260);for(let i=0;i<6;i++)box(ctx,x-38+(i%3)*24,70+Math.floor(i/3)*13,19,9,2,'#f5fcff');}
 ctx.fillStyle='#122b38';ctx.fillRect(0,331,1200,87);
 const grass=gradient(ctx,0,390,0,285,[[0,'#548142'],[1,'#244c2d']]);ctx.fillStyle=grass;ctx.fillRect(0,410,1200,265);
 for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#ffffff0d':'#00000009';ctx.fillRect(0,410+i*44,1200,44);}
 noise(ctx,0,410,1200,265,44,33000);ctx.strokeStyle='#e9f0e0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,523);ctx.lineTo(1200,523);ctx.stroke();
 ctx.fillStyle='#0a1620a8';ctx.fillRect(goal.x,goal.y,goal.w,goal.h);
 ctx.strokeStyle='#dceaf0aa';ctx.lineWidth=1.4;for(let x=goal.x;x<=goal.x+goal.w;x+=25){ctx.beginPath();ctx.moveTo(x,goal.y);ctx.lineTo(x,goal.y+goal.h);ctx.stroke();}
 for(let y=goal.y;y<=goal.y+goal.h;y+=21){ctx.beginPath();ctx.moveTo(goal.x,y);ctx.lineTo(goal.x+goal.w,y);ctx.stroke();}
 ctx.strokeStyle='#f5f7f4';ctx.lineWidth=9;ctx.lineJoin='round';ctx.strokeRect(goal.x,goal.y,goal.w,goal.h);
}
function keeper(ctx,x,y,dive=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(dive*.35);
 ellipse(ctx,0,5,64,9,'#0005');
 const limb=(ax,ay,bx,by,width,color)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();};
 limb(-13,-54,-35,-23,19,'#152633');limb(-35,-23,-47,0,13,'#13222a');limb(13,-54,35,-23,19,'#152633');limb(35,-23,47,0,13,'#13222a');
 limb(-15,-95,-42,-75,17,'#26a3b2');limb(-42,-75,-59,-55,13,'#1e8293');limb(15,-95,42,-75,17,'#26a3b2');limb(42,-75,59,-55,13,'#1e8293');ellipse(ctx,-61,-53,9,12,'#f2e7bd');ellipse(ctx,61,-53,9,12,'#f2e7bd');
 box(ctx,-27,-110,54,63,14,gradient(ctx,-26,-105,52,0,[[0,'#126578'],[.5,'#32b7c7'],[1,'#126578']]));ellipse(ctx,0,-127,15,18,'#c89b72');ellipse(ctx,0,-138,15,9,'#252524');txt(ctx,'1',0,-85,21,'#fff',true,'center');
 ellipse(ctx,-49,0,14,6,'#e5edf0');ellipse(ctx,49,0,14,6,'#e5edf0');ctx.restore();
}
function ball(ctx,x,y,r){ellipse(ctx,x,y+r*.8,r*1.2,r*.25,'#0005');const g=ctx.createRadialGradient(x-r*.3,y-r*.3,1,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(1,'#acbdc1');ellipse(ctx,x,y,r,r,g,'#ddd',1);for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ellipse(ctx,x+Math.cos(a)*r*.62,y+Math.sin(a)*r*.62,r*.16,r*.18,'#273d4a');}ellipse(ctx,x,y,r*.23,r*.23,'#273d4a');}
export async function generatePenaltyCard({round=0,goals=0,status='choosing',shot=null,keeperDirection='center',bet=0,payout=0,multiplier=1,name='',avatar:av=null}={}){
 const [c,ctx]=scene();stadium(ctx);const choosing=status==='choosing',saved=status==='saved',end=!choosing&&shot;
 const k=end?keeperDirection:'center';keeper(ctx,at(k),goal.y+goal.h-6,end?(k==='left'?-1:k==='right'?1:0):0);
 if(end){const x=at(shot),y=goal.y+goal.h*.33;ctx.save();ctx.strokeStyle=saved?'#f2a09a':'#9be1b3';ctx.lineWidth=3;ctx.setLineDash([9,9]);ctx.beginPath();ctx.moveTo(600,598);ctx.quadraticCurveTo((600+x)/2,385,x,y);ctx.stroke();ctx.restore();ball(ctx,x,y,13);}else{ellipse(ctx,600,593,41,13,'#eef1e1');ball(ctx,600,570,34);}
 box(ctx,30,25,1140,103,20,'#081b28eb','#427c90');await avatar(ctx,av,87,76,36,name,'#6ccddc');txt(ctx,name||'Jogador',139,60,25,'#fff',true,'left',330);txt(ctx,'Cobrança '+Math.min(round+(choosing?1:0),5)+'/5',139,94,17,'#b5d6df',false);
 const stats=[['GOLS',goals+'/5'],['APOSTA',coins(bet)],['MULTIPLICADOR',Number(multiplier).toFixed(2)+'x'],['RETORNO',coins(payout)]];
 stats.forEach(([label,value],i)=>{const x=465+i*173;txt(ctx,label,x,54,13,'#9ab6c4',false);txt(ctx,value,x,85,24);});
 if(!choosing){const label={goal:'GOL!',saved:'DEFESA!',cashed:'SAQUE CONFIRMADO',won:'VITÓRIA!'}[status]??'RODADA ENCERRADA';box(ctx,425,535,350,69,14,'#081b28ee',saved?'#ed8078':'#84d5ac',2);txt(ctx,label,600,570,29,saved?'#f6b5ad':'#d4f3df',true,'center');}
 return png(c);
}
