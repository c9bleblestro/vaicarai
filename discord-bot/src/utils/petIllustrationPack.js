import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {parseGIF,decompressFrames} from 'gifuct-js';
import {createCanvas,GifEncoder} from '@napi-rs/canvas';

export const ILLUSTRATED_PETS=Object.freeze([
  {key:'luna',name:'Luna',emoji:'🐱',price:2500,description:'Gatinha de olhos violeta e colar de estrela. Coleção ilustrada Pet World.'},
  {key:'koda',name:'Koda',emoji:'🐶',price:3500,description:'Husky brincalhão de bandana roxa. Coleção ilustrada Pet World.'}
]);
export function illustratedPetKey(id){
  return /^pw2-(luna|koda)-[A-Za-z0-9_-]+$/.exec(String(id??''))?.[1]??null;
}

// Keep source illustration pixels and compression. Rewrite only the Graphic
// Control Extension delays, walking GIF blocks rather than matching random bytes.
export function retimeIllustration(source,delays){
  const out=Buffer.from(source);let p=13,frame=0;
  if(out[10]&128)p+=3*(1<<((out[10]&7)+1));
  const skipBlocks=()=>{while(p<out.length){const n=out[p++];if(!n)return;p+=n;}throw Error('Truncated GIF');};
  while(p<out.length){
    const tag=out[p++];
    if(tag===0x3b)break;
    if(tag===0x21){
      const type=out[p++];
      if(type===0xf9){
        if(out[p]!==4||p+5>=out.length)throw Error('Invalid GIF control block');
        out.writeUInt16LE(Math.round((delays[frame]??160)/10),p+2);frame++;
      }
      skipBlocks();
    }else if(tag===0x2c){
      const flags=out[p+8];p+=9;
      if(flags&128)p+=3*(1<<((flags&7)+1));
      p++;skipBlocks();
    }else throw Error('Unexpected GIF block '+tag);
  }
  if(frame!==delays.length)throw Error('Unexpected GIF frame count: '+frame);
  return out;
}
// The old Koda "portrait" was a rectangular crop of its room. Isolate the
// original illustrated silhouette in the four seated poses with hand-traced
// masks, leaving the room, floor, lettering and ball out of the shop preview.
const DOG_MASKS=[
 [34,203,34,183,43,166,55,156,78,145,83,151,77,166,66,175,58,193,62,211,73,222,80,211,87,194,99,178,105,159,96,148,91,134,95,116,101,100,96,86,94,64,100,38,111,24,124,30,136,48,140,63,157,57,177,60,189,65,198,43,207,28,214,25,219,36,223,58,223,81,217,91,220,103,223,117,225,132,218,143,204,153,199,172,198,194,196,217,193,231,197,243,197,250,188,262,176,264,165,259,153,266,132,265,119,260,105,263,88,260,76,251,70,235,55,228,43,221],
 [34,203,34,183,43,166,55,156,78,145,83,151,77,166,66,175,58,193,62,211,73,222,80,211,87,194,99,178,105,159,96,148,91,134,95,116,101,100,96,86,95,64,100,39,111,27,124,32,136,49,140,64,157,59,177,61,190,66,200,45,207,30,214,28,219,40,223,60,223,83,217,94,221,105,224,119,225,134,216,145,204,153,199,172,198,194,196,217,193,231,197,243,197,250,188,262,176,264,165,259,153,266,132,265,119,260,105,263,88,260,76,251,70,235,55,228,43,221],
 [36,211,34,190,42,174,57,163,72,157,89,160,104,170,100,178,86,179,69,185,60,197,64,215,78,226,85,205,97,191,111,177,118,155,109,145,102,131,99,119,87,113,77,98,71,84,69,70,77,65,92,68,107,74,120,83,131,79,144,63,151,54,147,39,141,24,147,24,164,34,181,52,190,66,192,78,199,90,208,102,215,111,217,124,211,136,198,147,199,170,202,185,198,211,193,229,197,247,197,255,188,263,172,263,163,259,153,266,135,265,118,260,103,263,87,260,74,250,70,234,54,228,43,220],
 [35,205,33,187,40,170,52,155,70,149,86,148,100,156,105,168,92,175,78,172,65,178,57,191,64,210,76,224,82,207,93,189,106,177,118,151,108,138,102,124,107,111,112,98,105,81,104,58,109,40,119,29,131,34,144,48,150,63,166,57,180,59,190,64,185,48,176,32,174,18,185,23,202,39,214,56,218,78,223,91,232,102,239,117,237,132,230,143,212,153,206,172,200,193,198,215,194,231,199,243,197,255,188,263,173,264,162,259,154,266,134,265,120,261,104,263,88,261,75,250,69,233,53,226,42,219]
];
function isolateKoda(source){
  const parsed=parseGIF(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength)),decoded=decompressFrames(parsed,true);
  const {width,height}=parsed.lsd;
  if(decoded.length<4||width!==321||height!==302)throw Error('Unexpected Koda source dimensions');
  const c=createCanvas(width,height),ctx=c.getContext('2d'),poses=[];
  for(let i=0;i<4;i++){
    const frame=decoded[i],d=frame.dims,previous=frame.disposalType===3?ctx.getImageData(0,0,width,height):null;
    const patch=createCanvas(d.width,d.height),pc=patch.getContext('2d'),im=pc.createImageData(d.width,d.height);im.data.set(frame.patch);pc.putImageData(im,0,0);ctx.drawImage(patch,d.left,d.top);
    const sprite=createCanvas(384,256),sc=sprite.getContext('2d');
    sc.save();sc.translate(192-136*.94,247-266*.94);sc.scale(.94,.94);
    const poly=DOG_MASKS[i];sc.beginPath();sc.moveTo(poly[0],poly[1]);for(let j=2;j<poly.length;j+=2)sc.lineTo(poly[j],poly[j+1]);sc.closePath();sc.clip();sc.drawImage(c,0,0);sc.restore();
    poses.push(sprite);
    if(previous)ctx.putImageData(previous,0,0);else if(frame.disposalType===2)ctx.clearRect(d.left,d.top,d.width,d.height);
  }
  const enc=new GifEncoder(384,256,{repeat:0,quality:8});
  try{
    for(const [i,delay] of [[0,850],[1,100],[0,650],[2,450],[3,850],[2,180],[0,850],[1,120],[0,750]]){
      const rgba=poses[i].getContext('2d').getImageData(0,0,384,256).data;
      enc.addFrame(new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),384,256,{delay});
    }
    return Buffer.from(enc.finish());
  }finally{enc.dispose();}
}
const LONG_DELAYS={
 'luna:portrait':[700,100,120,160,100,100,420,320,400,200,130,130,160,150,180,1400],
 'luna:room':[650,220,120,180,160,140,150,180,320,300,400,450,280,170,150,1100],
 'koda:room':[800,130,380,550,240,260,520,720,1400]
};

let pack;
function loadPack(){
  if(pack)return pack;
  const data=JSON.parse(gunzipSync(readFileSync(new URL('../assets/pet-world/v2/pack.json.gz',import.meta.url))).toString('utf8'));
  const result=new Map();
  for(const {key} of ILLUSTRATED_PETS){
    for(const view of ['portrait','room']){
      const name=key+'-'+view+'.gif',value=data[name];
      if(typeof value!=='string')throw new Error('Missing illustrated asset: '+name);
      const buffer=Buffer.from(value,'base64');
      if(buffer.length>8*1024*1024||buffer.subarray(0,3).toString()!=='GIF')throw new Error('Invalid illustrated asset: '+name);
      const parsed=parseGIF(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
      if(parsed.frames.filter(f=>f.image).length<4||parsed.lsd.width*parsed.lsd.height>2e6)throw new Error('Invalid illustrated frame count: '+name);
      const nameKey=key+':'+view;
      const clip=nameKey==='koda:portrait'?isolateKoda(buffer):retimeIllustration(buffer,LONG_DELAYS[nameKey]);
      result.set(nameKey,clip);
    }
  }
  pack=result;return pack;
}
export function validatePetIllustrations(){return loadPack().size===4;}
export function getPetIllustration(id,view='room'){
  const key=illustratedPetKey(id);
  if(!key)return null;
  return loadPack().get(key+':'+(view==='portrait'?'portrait':'room'))??null;
}
