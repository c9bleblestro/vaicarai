import prisma from '../database/client.js';
export const MINUTE=60000, CARE_CD=20*MINUTE;
export const ROOM_THEMES=Object.freeze({
  neon:{name:'Neon',price:0},rose:{name:'Rosa',price:2500},moon:{name:'Lunar',price:5000}
});
export const CARE_ACTIONS=Object.freeze({
  brincar:{field:'lastPetPlay',min:150,max:300,xp:12,delta:{happiness:25,energy:-15,fullness:-8,hygiene:-6,bond:3}},
  alimentar:{field:'lastPetFeed',min:80,max:160,xp:8,delta:{fullness:35,happiness:5,bond:2}},
  acariciar:{field:'lastPetPet',min:40,max:100,xp:6,delta:{happiness:15,bond:5}},
  banho:{field:'lastBath',cd:30*MINUTE,xp:8,delta:{hygiene:45,happiness:4,bond:2}},
  dormir:{field:'lastNap',cd:30*MINUTE,xp:6,delta:{energy:45,fullness:-5}}
});
const clamp=(n,low=0,high=100)=>Math.max(low,Math.min(high,n));
const rand=(min,max,rng)=>min+Math.floor(rng()*(max-min+1));
const ts=x=>x?new Date(x).getTime():0;
export function petStats(row,now=Date.now()){
  const hours=Math.min(72,Math.max(0,Math.floor((now-ts(row.careAt))/3600000)));
  return {fullness:clamp(row.fullness-hours*3,10),happiness:clamp(row.happiness-hours*2,10),energy:clamp(row.energy-hours,10),hygiene:clamp(row.hygiene-hours*2,10),bond:clamp(row.bond)};
}
export function petLevel(xp){
  const n=Math.max(0,Number(xp)||0),level=Math.floor(Math.sqrt(n/30))+1;
  return {level,current:n-30*(level-1)**2,needed:30*(2*level-1),stage:level>=25?'Adulto':level>=10?'Jovem':'Filhote'};
}
export function petMood(s){
  if(s.energy<30)return 'Sonolento';
  if(s.fullness<30)return 'Com fome';
  if(s.hygiene<30)return 'Precisa de banho';
  if(s.happiness<35)return 'Entediado';
  return s.happiness>=75?'Feliz':'Tranquilo';
}
export function petCooldown(row,eco,action,now=Date.now()){
  const rule=CARE_ACTIONS[action];if(!rule)return 0;
  return Math.max(0,ts(rule.min!=null?eco[rule.field]:row[rule.field])+(rule.cd??CARE_CD)-now);
}
export async function activeCompanion(userId,guildId,db=prisma){
  const profile=await db.userProfile.findUnique({where:{userId}});
  if(!profile?.activePet)return null;
  const [pet,owned]=await Promise.all([
    db.pet.findUnique({where:{id:profile.activePet}}),
    db.userPurchase.findUnique({where:{userId_itemType_itemRef:{userId,itemType:'pet',itemRef:profile.activePet}}})
  ]);
  if(!pet?.active||!owned)return null;
  return pet;
}
const keyFor=(userId,guildId,petId)=>({userId_guildId_petId:{userId,guildId,petId}});
export async function getPetWorld(userId,guildId,db=prisma){
  const pet=await activeCompanion(userId,guildId,db);
  if(!pet)return null;
  const [life,eco]=await Promise.all([
    db.petLife.upsert({where:keyFor(userId,guildId,pet.id),create:{userId,guildId,petId:pet.id},update:{}}),
    db.economy.upsert({where:{userId_guildId:{userId,guildId}},create:{userId,guildId},update:{}})
  ]);
  return {pet,life,eco};
}
class RetryPet extends Error{}
export async function changePetWorld({userId,guildId,petId,action,theme,now=Date.now(),rng=Math.random,db=prisma}){
  // Initialize outside transaction to avoid parallel upsert races and preserve legacy cooldowns.
  const initial=await getPetWorld(userId,guildId,db);
  if(!initial||initial.pet.id!==petId)return {ok:false,reason:'changed'};
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await db.$transaction(async tx=>{
        const pet=await activeCompanion(userId,guildId,tx);
        if(!pet||pet.id!==petId)return {ok:false,reason:'changed'};
        const where=keyFor(userId,guildId,petId);
        const life=await tx.petLife.findUnique({where});
        const ecoWhere={userId_guildId:{userId,guildId}};
        const eco=await tx.economy.findUnique({where:ecoWhere});
        const stats=petStats(life,now),data={...stats,careAt:new Date(now),revision:{increment:1}};
        let amount=0,xp=0,notice='',ecoFilter={userId,guildId},ecoData=null;
        const rule=CARE_ACTIONS[action],away=life.adventureUntil&&ts(life.adventureUntil)>now;
        if(rule){
          if(away)return {ok:false,reason:'away',remaining:ts(life.adventureUntil)-now};
          const remaining=petCooldown(life,eco,action,now);
          if(remaining>0)return {ok:false,reason:'cooldown',remaining};
          for(const [k,v] of Object.entries(rule.delta))data[k]=clamp(stats[k]+v);
          xp=rule.xp;
          if(rule.min!=null){
            amount=rand(rule.min,rule.max,rng);
            ecoFilter[rule.field]=eco[rule.field];
            ecoData={balance:{increment:amount},[rule.field]:new Date(now)};
          }else data[rule.field]=new Date(now);
          notice={brincar:'Seu pet se divertiu com a bolinha!',alimentar:'Seu pet ficou de barriga cheia!',acariciar:'Seu pet adorou o carinho!',banho:'Seu pet ficou limpinho!',dormir:'Seu pet recuperou energia!'}[action];
        }else if(action==='aventura'){
          if(life.adventureUntil)return {ok:false,reason:away?'away':'collect',remaining:Math.max(0,ts(life.adventureUntil)-now)};
          if(stats.energy<35||stats.fullness<30)return {ok:false,reason:'needs'};
          data.energy=clamp(stats.energy-25);data.fullness=clamp(stats.fullness-15);data.hygiene=clamp(stats.hygiene-10);
          data.adventureUntil=new Date(now+15*MINUTE);notice='Seu pet saiu para explorar a floresta!';
        }else if(action==='coletar'){
          if(!life.adventureUntil)return {ok:false,reason:'noadventure'};
          if(away)return {ok:false,reason:'away',remaining:ts(life.adventureUntil)-now};
          data.adventureUntil=null;data.happiness=clamp(stats.happiness+10);data.bond=clamp(stats.bond+4);
          xp=20;amount=rand(120,250,rng);ecoData={balance:{increment:amount}};notice='Seu pet voltou da aventura com um tesouro!';
        }else if(action==='tema'){
          if(!Object.hasOwn(ROOM_THEMES,theme))return {ok:false,reason:'invalid'};
          // Theme changes must not reset the decay clock.
          for(const k of Object.keys(stats))delete data[k];delete data.careAt;
          const owned=new Set(life.ownedRooms.split(',').filter(x=>Object.hasOwn(ROOM_THEMES,x)));owned.add('neon');
          if(!owned.has(theme)){
            const cost=ROOM_THEMES[theme].price;
            if(eco.balance<cost)return {ok:false,reason:'money',cost};
            amount=-cost;ecoFilter.balance={gte:cost};ecoData={balance:{decrement:cost}};owned.add(theme);
          }
          data.room=theme;data.ownedRooms=[...owned].join(',');notice='Quarto '+ROOM_THEMES[theme].name+' equipado!';
        }else return {ok:false,reason:'invalid'};
        // One committed state revision per action; both updates roll back on conflict.
        data.xp={increment:xp};
        const change=await tx.petLife.updateMany({where:{userId,guildId,petId,revision:life.revision},data});
        if(change.count!==1)throw new RetryPet();
        if(ecoData){
          const paid=await tx.economy.updateMany({where:ecoFilter,data:ecoData});
          if(paid.count!==1)throw new RetryPet();
        }
        return {ok:true,amount,xp,notice,life:await tx.petLife.findUnique({where}),eco:await tx.economy.findUnique({where:ecoWhere}),pet};
      });
    }catch(error){
      if(!(error instanceof RetryPet)&&error.code!=='P2034')throw error;
    }
  }
  return {ok:false,reason:'busy'};
}
