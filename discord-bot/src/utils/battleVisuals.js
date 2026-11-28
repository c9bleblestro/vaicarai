import {loadImage} from '@napi-rs/canvas';
import {scene,box,txt,gradient,ellipse,png,noise} from './gameArt.js';
import {generateCardSheet} from './cardVisuals.js';
import {getCard} from './cardData.js';
const species={'Mega Charizard X':10034,'Mega Charizard Y':10035,'Mega Charizard':10034,'Mega Gengar':10038,'Mega Ampharos':10045,'Mega Blaziken':10050,'Mega Gardevoir':10051,'Mega Lucario':10059,'Mega Greninja':658,'Mega Darkrai':491,'Mega Dragonite':149,'Mega Froslass':478,'Mega Zygarde':718,'Tapu Koko':785,'Cauda Brado':987,'Ho-Oh':250,Mewtwo:150,Mew:151,Pikachu:25,Eevee:133,Lunala:792,Gyarados:130,Arceus:493,Ivysaur:2,Charmander:4,Gengar:94,Jigglypuff:39,Squirtle:7,Haunter:93,Charmeleon:5,Meowth:52,Flareon:136,Cinccino:573,Raboot:814,Azumarill:184,Rowlet:722,Machop:66,Wartortle:8,Turtwig:387,Diglett:50,Torracat:726,Dratini:147,Feraligatr:160,Piplup:393,Reuniclus:579,Vaporeon:134,Venusaur:3,Pichu:172,Alakazam:65,Carvanha:318,Scizor:212,Greninja:658,Ekans:23,Shellder:90,Sceptile:254,Latias:380,Deoxys:386,Zekrom:644,Mimikyu:778,Gardevoir:282,Salamence:373};
export const spriteId=name=>species[Object.keys(species).sort((a,b)=>b.length-a.length).find(k=>String(name).startsWith(k))]??null;
const cache=new Map();
async function art(p){
 const id=spriteId(p.card.name);
 if(id){if(!cache.has(id)){cache.set(id,(async()=>{try{return await loadImage(new URL('../assets/battle-sprites/'+id+'.png',import.meta.url).pathname);}catch{} for(const url of ['https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/'+id+'.png','https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+id+'.png']){try{const r=await fetch(url,{signal:AbortSignal.timeout(2500)});if(r.ok)return await loadImage(Buffer.from(await r.arrayBuffer()));}catch{}}return null;})());}const im=await cache.get(id);if(im)return {im,sprite:true};cache.delete(id);}
 const canonical=getCard(p.card.key)??p.card;
 try{return {im:await loadImage(await generateCardSheet([canonical])),sprite:false};}catch{return {im:null,sprite:false};}
}
let arenaBackgroundPromise;
async function drawArenaBackground(ctx){
 if(!arenaBackgroundPromise)arenaBackgroundPromise=loadImage(new URL('../assets/cards/battle-arena-stadium.jpg',import.meta.url).pathname).catch(()=>null);
 const background=await arenaBackgroundPromise;
 if(!background){landscape(ctx);return;}
 ctx.drawImage(background,0,0,1200,675);
}
function landscape(ctx){
 ctx.fillStyle=gradient(ctx,0,0,0,675,[[0,'#64b3e0'],[.48,'#d4edf1'],[.49,'#a7cf76'],[1,'#568c48']]);ctx.fillRect(0,0,1200,675);
 for(let i=0;i<6;i++){let x=i*250-40,y=80+(i%2)*54;for(let j=0;j<4;j++)ellipse(ctx,x+j*43,y+(j%2)*12,55,20,'#ffffffbb');}
 for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(0,350);for(let j=0;j<13;j++)ctx.lineTo(j*100,180+i*65+((j*73+i*17)%110));ctx.lineTo(1200,390);ctx.closePath();ctx.fillStyle=i?'#73ac88':'#689db0';ctx.fill();}
 ctx.fillStyle='#c0d5c1';ctx.fillRect(0,310,1200,77);for(let i=0;i<12;i++){box(ctx,i*110+12,320,88,62,32,'#6b9c83');box(ctx,i*110+3,300,13,89,3,'#e2e8d4');}
 const grass=gradient(ctx,0,390,0,285,[[0,'#b2d77f'],[1,'#659b45']]);ctx.fillStyle=grass;ctx.fillRect(0,390,1200,285);noise(ctx,0,390,1200,285,79,22000);
 for(let i=0;i<100;i++){let x=(i*131)%1200,y=390+(i*73)%285;ctx.strokeStyle='#457b3f55';ctx.beginPath();ctx.moveTo(x,y+8);ctx.lineTo(x-3,y);ctx.moveTo(x,y+8);ctx.lineTo(x+5,y-3);ctx.stroke();}
 ellipse(ctx,805,430,260,57,'#acd19a','#ebefc4',4);ellipse(ctx,310,560,265,65,'#9dc888','#ebefc4',4);
}
function creature(ctx,p,a,x,y,w,h,flip){const {im,sprite}=a;if(!im){ellipse(ctx,x,y-55,55,55,'#d8eacb','#507b54',2);txt(ctx,p.card.name,x,y-55,14,'#31563b',true,'center',104);return;}ctx.save();if(sprite){const k=Math.min(w/im.width,h/im.height),iw=im.width*k,ih=im.height*k;ellipse(ctx,x,y+3,iw*.36,18,'#335d3055');ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.drawImage(im,-iw/2,-ih,iw,ih);}else{const k=Math.min(w/im.width,h/im.height);ctx.drawImage(im,x-im.width*k/2,y-im.height*k,im.width*k,im.height*k);}ctx.restore();}
function hud(ctx,p,x,y){
 box(ctx,x,y,470,114,14,'#f4f4e8','#568b83',3);txt(ctx,p.card.name,x+18,y+24,22,'#19363b',true,'left',340);txt(ctx,'CP '+p.cp,x+453,y+24,16,'#28535a',true,'right',100);
 for(const [i,label,value,max,cl] of [[0,'HP',Math.max(0,p.hp),p.maxHp,p.hp/p.maxHp>.5?'#76b94c':p.hp/p.maxHp>.2?'#e2b841':'#d96355'],[1,'EN',p.energy,100,'#39a9d3']]){let yy=y+57+i*31;txt(ctx,label,x+18,yy,17,'#29454a');box(ctx,x+64,yy-8,255,16,8,'#cfdbd3');const r=Math.max(0,Math.min(1,value/Math.max(1,max)));if(r>0)box(ctx,x+64,yy-8,255*r,16,Math.min(8,255*r/2),cl);txt(ctx,value+'/'+max,x+450,yy,17,'#29454a',true,'right');}
}
export async function generateBattleBoard(first,second,turnName=''){
 const [c,ctx]=scene();await drawArenaBackground(ctx);const [a,b]=await Promise.all([art(first),art(second)]);creature(ctx,second,b,815,432,330,300,false);creature(ctx,first,a,315,563,420,370,true);hud(ctx,second,705,22);hud(ctx,first,705,535);box(ctx,24,23,390,44,14,'#e9f2e6ed','#568b83');txt(ctx,'Vez de '+turnName,42,45,21,'#234b50',true,'left',353);return png(c);
}
