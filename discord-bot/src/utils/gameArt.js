import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
for(const [file,name] of [['Roboto-Regular.ttf','GameRegular'],['Roboto-Bold.ttf','GameBold']]){
 try{GlobalFonts.register(readFileSync(fileURLToPath(new URL('../../fonts/'+file,import.meta.url))),name);}catch{}
}
export const W=1200,H=675;
export const colors={white:'#f5f5f3',muted:'#aeb7bf',red:'#e8403b',gold:'#e5ba71'};
export const coins=n=>Number(n??0).toLocaleString('pt-BR');
export function scene(){const c=createCanvas(W,H);return [c,c.getContext('2d')];}
export function box(ctx,x,y,w,h,r,fill,stroke=null,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
export function gradient(ctx,x,y,w,h,stops){const g=ctx.createLinearGradient(x,y,x+w,y+h);stops.forEach(([p,c])=>g.addColorStop(p,c));return g;}
export function txt(ctx,t,x,y,size=24,color='#fff',bold=true,align='left',max=Infinity){ctx.save();ctx.font=(bold?'bold ':'')+size+'px '+(bold?'GameBold':'GameRegular');ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;let str=String(t??'');while(ctx.measureText(str).width>max&&str.length>1)str=str.slice(0,-2)+'…';ctx.fillText(str,x,y);ctx.restore();}
export function ellipse(ctx,x,y,rx,ry,fill,stroke=null,lw=1){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
export function noise(ctx,x,y,w,h,seed=17,count=16000){let n=seed;const rand=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);ctx.save();for(let i=0;i<count;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.035)':'rgba(0,0,0,.075)';ctx.fillRect(x+rand()*w,y+rand()*h,1+rand()*2,1);}ctx.restore();}
export function table(ctx,scheme='red'){
 const red=scheme==='red',edge=red?'#8b4240':'#ad8750';
 ctx.fillStyle=gradient(ctx,0,0,W,H,[[0,'#101317'],[.5,'#080b0c'],[1,'#202022']]);ctx.fillRect(0,0,W,H);
 ellipse(ctx,600,359,563,306,'#090a0b','#34373b',4);
 ellipse(ctx,600,349,546,284,'#29231d',edge,5);
 const g=ctx.createRadialGradient(600,315,40,600,340,580);g.addColorStop(0,red?'#a43235':'#17604c');g.addColorStop(1,red?'#3b1118':'#063329');
 ellipse(ctx,600,345,529,268,g,red?'#c66b65':'#d6b777',2);
 ctx.save();ctx.beginPath();ctx.ellipse(600,345,525,264,0,0,Math.PI*2);ctx.clip();noise(ctx,60,75,1080,550,21,32000);ctx.restore();
 ctx.beginPath();ctx.ellipse(600,345,463,221,0,0,Math.PI*2);ctx.strokeStyle=red?'#e5b4a83c':'#b6d5b54b';ctx.lineWidth=2;ctx.stroke();
}
const avatars=new Map();
async function imageFor(url){if(!url)return null;if(avatars.has(url))return avatars.get(url);const p=(async()=>{try{if(String(url).startsWith('data:image/'))return await loadImage(Buffer.from(String(url).split(',')[1],'base64'));const r=await fetch(url,{signal:AbortSignal.timeout(3500)});if(!r.ok)return null;return await loadImage(Buffer.from(await r.arrayBuffer()));}catch{return null;}})();avatars.set(url,p);if(avatars.size>160)avatars.delete(avatars.keys().next().value);const im=await p;if(!im)avatars.delete(url);return im;}
export async function avatar(ctx,url,x,y,r,name,accent='#e2b56a'){const im=await imageFor(url);ellipse(ctx,x,y,r+3,r+3,'#131b22',accent,2);ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();if(im){const s=Math.max(2*r/im.width,2*r/im.height);ctx.drawImage(im,x-im.width*s/2,y-im.height*s/2,im.width*s,im.height*s);}else{ellipse(ctx,x,y,r,r,'#38454d');txt(ctx,Array.from(String(name||'?'))[0],x,y,Math.max(15,r),'#fff',true,'center');}ctx.restore();}
export function cardBack(ctx,x,y,w,h,accent='#d6ac68',uno=false){ctx.save();ctx.shadowColor='#0008';ctx.shadowBlur=9;ctx.shadowOffsetY=5;box(ctx,x,y,w,h,Math.min(10,w/8),'#f7f4ed');ctx.shadowBlur=0;ctx.shadowOffsetY=0;box(ctx,x+5,y+5,w-10,h-10,7,'#151719',accent);ctx.save();ctx.beginPath();ctx.roundRect(x+7,y+7,w-14,h-14,5);ctx.clip();ctx.strokeStyle=accent+'30';for(let i=-h;i<w+h;i+=13){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i+h,y+h);ctx.stroke();}ctx.restore();if(uno){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(-.5);ellipse(ctx,0,0,w*.39,h*.19,'#bd2029');txt(ctx,'UNO',0,0,w*.26,'#fff2a8',true,'center');ctx.restore();}else{txt(ctx,'♠',x+w/2,y+h/2,w*.46,accent,true,'center');}ctx.restore();}
export function png(c){return c.toBuffer('image/png');}
