import prisma from '../database/client.js';

const dateFormat = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
export function streakDay(date = new Date()) {
  const parts = Object.fromEntries(dateFormat.formatToParts(date).map(p=>[p.type,p.value]));
  return Math.floor(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/86400000);
}

export function pairIds(a,b) {
  if (!a || !b || a===b) throw new Error('Dupla inválida');
  return a<b?[a,b]:[b,a];
}

export function advanceStreak(row,day,bit) {
  if(day<row.day)return row;
  const dayMask=(day===row.day?row.dayMask:0)|bit;
  let {days,bestDays,lastCompletedDay}=row;
  if(dayMask===3 && lastCompletedDay!==day){
    days=lastCompletedDay===day-1?days+1:1;
    bestDays=Math.max(bestDays,days);
    lastCompletedDay=day;
  }
  return {day,dayMask,days,bestDays,lastCompletedDay};
}

export function streakView(row,day) {
  const mask=row?.day===day?row.dayMask:0;
  const days=row?.lastCompletedDay!=null && row.lastCompletedDay>=day-1?row.days:0;
  return {days,bestDays:row?.bestDays??0,mask,complete:mask===3,day};
}

export const MILESTONES=[{days:3,name:'Centelha',color:'#ffb85c'},{days:7,name:'Chama dourada',color:'#ffc54e'},{days:14,name:'Chama rosa',color:'#f38aaa'},{days:30,name:'Chama azul',color:'#79baff'},{days:60,name:'Chama violeta',color:'#bd99ff'},{days:100,name:'Chama opala',color:'#a8e8e0'}];
export function streakMilestone(days){
  const tier=[...MILESTONES].reverse().find(m=>days>=m.days)??{days:0,name:'Foguinho',color:'#fca055'};
  const next=MILESTONES.find(m=>m.days>days)??null;
  return {tier,next};
}

export async function recordInteractionStreak(guildId,fromId,toId,date=new Date()){
  if(!guildId)throw new Error('Servidor obrigatório');
  const [userAId,userBId]=pairIds(fromId,toId);
  const day=streakDay(date),bit=fromId===userAId?1:2;
  const key={guildId,userAId,userBId};
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`INSERT INTO "InteractionStreak" ("guildId","userAId","userBId","day")
      VALUES (${guildId},${userAId},${userBId},${day}) ON CONFLICT DO NOTHING`;
    const [row]=await tx.$queryRaw`SELECT * FROM "InteractionStreak" WHERE "guildId"=${guildId}
      AND "userAId"=${userAId} AND "userBId"=${userBId} FOR UPDATE`;
    const data=advanceStreak(row,day,bit);
    const updated=await tx.interactionStreak.update({where:{guildId_userAId_userBId:key},data:{
      day:data.day,dayMask:data.dayMask,days:data.days,bestDays:data.bestDays,lastCompletedDay:data.lastCompletedDay
    }});
    return streakView(updated,day);
  });
}

export async function getInteractionStreak(guildId,a,b,date=new Date()){
  const [userAId,userBId]=pairIds(a,b);
  const row=await prisma.interactionStreak.findUnique({where:{guildId_userAId_userBId:{guildId,userAId,userBId}}});
  return streakView(row,streakDay(date));
}

/** Coleção do membro no servidor: sequência atual, pendências e recordes antigos. */
export async function listInteractionStreaks(guildId,userId,date=new Date()){
  const day=streakDay(date);
  const rows=await prisma.interactionStreak.findMany({where:{guildId,OR:[{userAId:userId},{userBId:userId}]}});
  return rows.map(row=>({
    partnerId:row.userAId===userId?row.userBId:row.userAId,
    ...streakView(row,day),
  })).sort((a,b)=>b.days-a.days||Number(b.complete)-Number(a.complete)||Number(Boolean(b.mask))-Number(Boolean(a.mask))||b.bestDays-a.bestDays||a.partnerId.localeCompare(b.partnerId));
}
