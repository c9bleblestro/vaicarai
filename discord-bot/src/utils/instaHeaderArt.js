import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {INSTA_EMOJI_ASSETS} from './instaEmojiAssets.js';

// Animate the original white silhouette recovered from the reference screenshot.
// Keep the exact silhouette, transparent canvas, stable center and smooth loop.
export async function makeInstaHeaderGif(){
 const image=await loadImage(Buffer.from(INSTA_EMOJI_ASSETS.header,'base64'));
 const size=64,frames=32,canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
 const enc=new GifEncoder(size,size,{repeat:0,quality:8});
 try{
  for(let i=0;i<frames;i++){
   const phase=2*Math.PI*i/frames;
   ctx.clearRect(0,0,size,size);
   ctx.save();ctx.translate(size/2,size/2-1.4*Math.sin(phase));
   ctx.rotate(.14*Math.sin(phase));
   ctx.scale(1+.045*Math.sin(phase*2),1-.045*Math.sin(phase*2));
   ctx.drawImage(image,-27,-27,54,54);ctx.restore();
   const rgba=ctx.getImageData(0,0,size,size).data;
   enc.addFrame(new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),size,size,{delay:50});
  }
  const out=Buffer.from(enc.finish());
  // Restore each transparent frame before drawing the next, avoiding ghost trails.
  let p=13,first=true,count=0;
  if(out[10]&128)p+=3*(1<<((out[10]&7)+1));
  const skip=()=>{while(p<out.length){const n=out[p++];if(!n)return;p+=n;}throw Error('Truncated GIF');};
  while(p<out.length){
   const tag=out[p++];if(tag===0x3b)break;
   if(tag===0x21){const type=out[p++];if(type===0xf9){
    if(out[p]!==4||!(out[p+1]&1))throw Error('Header GIF has no transparency');
    out[p+1]=(out[p+1]&0xe3)|8;
    if(first){out[11]=out[p+4];first=false;}count++;
   }skip();}
   else if(tag===0x2c){const flags=out[p+8];p+=9;if(flags&128)p+=3*(1<<((flags&7)+1));p++;skip();}
   else throw Error('Invalid GIF block');
  }
  if(count!==frames||out.length>256*1024)throw Error('Invalid header animation');
  return out;
 }finally{enc.dispose();}
}
