import {loadImage} from '@napi-rs/canvas';
import {readFile} from 'node:fs/promises';

// Recortes das artes aprovadas no chat, não redesenhos vetoriais.
// Atlas RGBA: 7 colunas de 144 px. Moldura 144x144 e mascote 72x68.
// O centro de cada moldura é transparente para o avatar real.
const SOURCE=new URL('../assets/foguinho-original-art.webp',import.meta.url);
const TIERS=[0,3,7,14,30,60,100];
const COLORS=[
  ['#ff689c','#ffb592'],
  ['#ff913e','#ffba65'],
  ['#ffca38','#ffe67e'],
  ['#f565af','#ffacd6'],
  ['#36aaf4','#78e4ef'],
  ['#b652ee','#eaa5ff'],
  ['#42e8f1','#b7a1ff','#f8a8ed','#a8eeef','#dcb3fa'],
];
export const FRAME_SIZE=136;
export const AVATAR_RADIUS=42.7;
export const FLAME_WIDTH=72;
export const FLAME_HEIGHT=68;
export function evolutionIndex(days){return Math.max(0,TIERS.lastIndexOf(days));}
let atlasPromise;
export function loadEvolutionArt(){
  if(!atlasPromise){
    atlasPromise=readFile(SOURCE).then(data=>loadImage(data)).then(img=>{
      if(img.width!==1008||img.height!==212)throw new Error('Atlas de foguinho inválido');
      return img;
    }).catch(error=>{atlasPromise=null;throw error;});
  }
  return atlasPromise;
}
export function drawEvolutionFrame(ctx,atlas,x,y,tier){
  const i=evolutionIndex(tier);
  ctx.drawImage(atlas,i*144,0,144,144,x-FRAME_SIZE/2,y-FRAME_SIZE/2,FRAME_SIZE,FRAME_SIZE);
}
export function drawEvolutionFlame(ctx,atlas,x,y,tier){
  const i=evolutionIndex(tier);
  ctx.drawImage(atlas,i*144+36,144,72,68,x-FLAME_WIDTH/2,y-FLAME_HEIGHT/2,FLAME_WIDTH,FLAME_HEIGHT);
}
export function evolutionProgressFill(ctx,x,y,w,tier){
  const colors=COLORS[evolutionIndex(tier)];
  const g=ctx.createLinearGradient(x,y,x+Math.max(1,w),y);
  colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));
  return g;
}
