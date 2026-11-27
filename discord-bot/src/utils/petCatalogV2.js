import prisma from '../database/client.js';
import {ILLUSTRATED_PETS,illustratedPetKey,validatePetIllustrations} from './petIllustrationPack.js';

export async function migratePetCatalogForGuild(guildId,db=prisma){
  if(!guildId||!validatePetIllustrations())return {retired:0,owners:0};
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${guildId} || ':petworld-v2'))::text`;
    const existing=await tx.pet.findMany({where:{guildId}});
    if(ILLUSTRATED_PETS.every(def=>existing.some(p=>p.id==='pw2-'+def.key+'-'+guildId)))return {retired:0,owners:0};
    const legacy=existing.filter(p=>!illustratedPetKey(p.id));
    const oldIds=legacy.map(p=>p.id);
    const catalog=[];
    for(const def of ILLUSTRATED_PETS){
      const id='pw2-'+def.key+'-'+guildId;
      const collision=existing.find(p=>p.name===def.name&&p.id!==id);
      let name=collision?def.name+' · Pet World':def.name;
      for(let suffix=2;existing.some(p=>p.name===name&&p.id!==id);suffix++)name=def.name+' · Pet World '+suffix;
      const pet=await tx.pet.upsert({where:{id},create:{id,guildId,name,emoji:def.emoji,description:def.description,price:def.price,active:true},update:{emoji:def.emoji,description:def.description,active:true,imageUrl:null}});
      catalog.push(pet);
    }
    if(!oldIds.length)return {retired:0,owners:0};
    const purchases=await tx.userPurchase.findMany({where:{itemType:'pet',itemRef:{in:oldIds}}});
    const owners=[...new Set(purchases.map(p=>p.userId))];
    if(owners.length){
      await tx.userPurchase.createMany({data:owners.flatMap(userId=>catalog.filter(p=>!p.id.startsWith('pw2-pimentinha-')).map(p=>({userId,guildId,itemType:'pet',itemRef:p.id}))),skipDuplicates:true});
      // Keep the highest existing progression on Luna. The second new pet is free.
      const prior=await tx.petLife.findMany({where:{guildId,userId:{in:owners},petId:{in:oldIds}},orderBy:[{xp:'desc'},{bond:'desc'}]});
      const best=new Map();for(const state of prior)if(!best.has(state.userId))best.set(state.userId,state);
      if(best.size){
        await tx.petLife.createMany({data:[...best.values()].map(s=>({userId:s.userId,guildId,petId:catalog[0].id,xp:s.xp,fullness:s.fullness,happiness:s.happiness,energy:s.energy,hygiene:s.hygiene,bond:s.bond,careAt:s.careAt,lastBath:s.lastBath,lastNap:s.lastNap,adventureUntil:s.adventureUntil,room:s.room,ownedRooms:s.ownedRooms})),skipDuplicates:true});
      }
      await tx.userProfile.updateMany({where:{userId:{in:owners},activePet:{in:oldIds}},data:{activePet:catalog[0].id}});
    }
    // Retain audit records and old purchases, but remove them from the playable catalog.
    // Existing wallet balances and cooldowns are untouched.
    await tx.userProfile.updateMany({where:{activePet:{in:oldIds}},data:{activePet:null}});
    await tx.pet.updateMany({where:{id:{in:oldIds}},data:{active:false}});
    await tx.userPurchase.updateMany({where:{itemType:'pet',itemRef:{in:oldIds}},data:{itemType:'pet_legacy'}});
    return {retired:legacy.length,owners:owners.length};
  },{timeout:60000});
}
export async function migrateIllustratedPetCatalog(db=prisma){
  if(!validatePetIllustrations())throw new Error('Pet World illustration pack incomplete.');
  const [pets,configs]=await Promise.all([db.pet.findMany({distinct:['guildId'],select:{guildId:true}}),db.guildConfig.findMany({select:{guildId:true}})]);
  for(const guildId of new Set([...pets,...configs].map(x=>x.guildId))){
    const result=await migratePetCatalogForGuild(guildId,db);
    if(result.owners)console.log('[Pet World] Catalog replaced for guild',guildId,result);
  }
}
