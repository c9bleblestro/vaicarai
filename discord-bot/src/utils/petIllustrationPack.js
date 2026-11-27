import {renderRigGif} from './petRigArt.js';

export const ILLUSTRATED_PETS=Object.freeze([
  {key:'luna',name:'Luna',emoji:'🐱',price:2500,description:'Gatinha de olhos violeta e colar de estrela. Coleção ilustrada Pet World.'},
  {key:'koda',name:'Koda',emoji:'🐶',price:3500,description:'Husky brincalhão de bandana roxa. Coleção ilustrada Pet World.'}
]);
export function illustratedPetKey(id){
  return /^pw2-(luna|koda)-[A-Za-z0-9_-]+$/.exec(String(id??''))?.[1]??null;
}


const idleCache=new Map();
export function getPetIllustration(id,view='room'){
  const key=illustratedPetKey(id);if(!key)return null;
  view=view==='portrait'?'portrait':'room';const cacheKey=key+':'+view;
  if(!idleCache.has(cacheKey))idleCache.set(cacheKey,renderRigGif(key,{view,action:'idle'}).buffer);
  return idleCache.get(cacheKey);
}
export function validatePetIllustrations(){
  return ILLUSTRATED_PETS.every(({key})=>['portrait','room'].every(view=>{
    const buffer=getPetIllustration('pw2-'+key+'-validation',view);
    return buffer?.subarray(0,3).toString()==='GIF'&&buffer.length<=8*1024*1024;
  }));
}
