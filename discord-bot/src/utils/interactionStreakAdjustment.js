import prisma from '../database/client.js';
import {pairIds,streakDay} from './interactionStreak.js';

// Pedido administrativo único: reconhecer a sequência anterior do casal.
// Não cria duplas nem concede XP/moedas; exige casamento recíproco e uma
// única sequência existente do casal. O recibo impede reaplicação no boot.
export async function applyCoupleStreakAdjustment({userId,key,now=new Date()}){
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "InteractionStreakAdjustment" (
      "key" TEXT PRIMARY KEY, "guildId" TEXT NOT NULL,
      "userAId" TEXT NOT NULL, "userBId" TEXT NOT NULL,
      "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
  const day=streakDay(now);
  return prisma.$transaction(async tx=>{
    if(await tx.interactionStreakAdjustment.findUnique({where:{key}}))return {status:'already-applied'};
    const profile=await tx.userProfile.findUnique({where:{userId},select:{marriedTo:true}});
    const partner=profile?.marriedTo;
    if(!partner||partner===userId)return {status:'unverified-couple'};
    const other=await tx.userProfile.findUnique({where:{userId:partner},select:{marriedTo:true}});
    if(other?.marriedTo!==userId)return {status:'unverified-couple'};
    const [userAId,userBId]=pairIds(userId,partner);
    const rows=await tx.$queryRaw`SELECT * FROM "InteractionStreak" WHERE "userAId"=${userAId}
      AND "userBId"=${userBId} ORDER BY "guildId" LIMIT 2 FOR UPDATE`;
    if(rows.length!==1)return {status:rows.length?'ambiguous-pair':'missing-pair'};
    const row=rows[0],guildId=row.guildId;
    const inserted=await tx.$executeRaw`INSERT INTO "InteractionStreakAdjustment" ("key","guildId","userAId","userBId")
      VALUES (${key},${guildId},${userAId},${userBId}) ON CONFLICT ("key") DO NOTHING`;
    if(!inserted)return {status:'already-applied'};
    const days=Math.max(100,row.lastCompletedDay!=null&&row.lastCompletedDay>=day-1?row.days:0);
    await tx.interactionStreak.update({where:{guildId_userAId_userBId:{guildId,userAId,userBId}},data:{
      days,bestDays:Math.max(row.bestDays,days),day,dayMask:3,lastCompletedDay:day
    }});
    return {status:'applied',days};
  });
}
export async function applyRequestedCoupleStreakAdjustment(){
  const result=await applyCoupleStreakAdjustment({userId:'1543135631587151906',key:'couple-streak-legacy-2026-11-26'});
  console.info('[FOGUINHO AJUSTE]',result.status);
  return result;
}
