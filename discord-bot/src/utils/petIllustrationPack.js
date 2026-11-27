import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {parseGIF} from 'gifuct-js';

export const ILLUSTRATED_PETS=Object.freeze([
  {key:'luna',name:'Luna',emoji:'🐱',price:2500,description:'Gatinha de olhos violeta e colar de estrela. Coleção ilustrada Pet World.'},
  {key:'koda',name:'Koda',emoji:'🐶',price:3500,description:'Husky brincalhão de bandana roxa. Coleção ilustrada Pet World.'}
]);
export function illustratedPetKey(id){
  return /^pw2-(luna|koda)-[A-Za-z0-9_-]+$/.exec(String(id??''))?.[1]??null;
}
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
      result.set(key+':'+view,buffer);
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
