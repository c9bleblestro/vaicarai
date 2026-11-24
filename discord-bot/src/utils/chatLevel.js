import {createHash,randomInt,randomUUID} from 'node:crypto';
import {AttachmentBuilder} from 'discord.js';
import prisma from '../database/client.js';
import {createChatLevelImage} from './chatLevelCard.js';
import {
  CHAT_XP_MIN,CHAT_XP_MAX,eligibleChatText,levelFromXp,xpProgress,
} from './chatLevelMath.js';

const configCache=new Map();
const CONFIG_TTL_MS=12_000;
export function invalidateChatLevelConfig(guildId) { configCache.delete(guildId); }
async function enabledOnGuild(guildId){
  const cached=configCache.get(guildId);
  if(cached&&cached.until>Date.now())return cached.enabled;
  const cfg=await prisma.guildConfig.findUnique({where:{guildId},select:{chatLevelEnabled:true}});
  const enabled=cfg?.chatLevelEnabled===true;
  if(configCache.size>1000)configCache.clear();
  configCache.set(guildId,{enabled,until:Date.now()+CONFIG_TTL_MS});
  return enabled;
}
/** Cooldown persistente no PostgreSQL, sem XP por spam copiado.
 * SQL parametrizado: os IDs, horários e hashes não são concatenados à query.
 */
const COOLDOWN_SQL=[
  'INSERT INTO "ChatLevelCooldown" ("id","guildId","userId","lastXpAt","lastHash")',
  'VALUES ($1,$2,$3,$4,$5)',
  'ON CONFLICT ("guildId","userId") DO UPDATE SET',
  '"lastXpAt"=EXCLUDED."lastXpAt","lastHash"=EXCLUDED."lastHash"',
  'WHERE (EXCLUDED."lastXpAt" - "ChatLevelCooldown"."lastXpAt") >= INTERVAL \'45 seconds\'',
  'AND ("ChatLevelCooldown"."lastHash" IS DISTINCT FROM EXCLUDED."lastHash"',
  'OR (EXCLUDED."lastXpAt" - "ChatLevelCooldown"."lastXpAt") >= INTERVAL \'5 minutes\')',
  'RETURNING "userId"',
].join(' ');

export async function awardChatMessageXp(message){
  if(!message.guildId||message.author?.bot||message.webhookId||
     !eligibleChatText(message.content))return null;
  if(!await enabledOnGuild(message.guildId))return null;
  const guildId=message.guildId,userId=message.author.id,now=new Date();
  const normalized=message.content.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
  const hash=createHash('sha256').update(normalized).digest('hex').slice(0,32);
  const gain=randomInt(CHAT_XP_MIN,CHAT_XP_MAX+1);
  const accepted=await prisma.$queryRawUnsafe(
    COOLDOWN_SQL,randomUUID(),guildId,userId,now,hash,
  );
  if(!accepted.length)return null;
  // XP e nível da economia existentes; coins, banco e compras não são tocados.
  const eco=await prisma.economy.upsert({
    where:{userId_guildId:{userId,guildId}},
    create:{userId,guildId,xp:gain,level:levelFromXp(gain)},
    update:{xp:{increment:gain}},
  });
  const reached=levelFromXp(eco.xp);
  const previous=eco.level;
  let leveled=false;
  if(reached>eco.level){
    const updated=await prisma.economy.updateMany({
      where:{userId,guildId,level:{lt:reached}},
      data:{level:reached},
    });
    leveled=updated.count>0;
  }
  return {gain,level:reached,previous,leveled,xp:eco.xp};
}
export async function processChatLevelMessage(message){
  let result=null;
  try{result=await awardChatMessageXp(message);}
  catch(error){
    console.error('[CHAT LEVEL] Erro ao acumular XP:',error?.code??error?.message??error);
    return null;
  }
  if(!result?.leveled)return result;
  const member=message.member;
  const avatarUrl=member?.displayAvatarURL?.({extension:'png',size:256})
    ??message.author.displayAvatarURL?.({extension:'png',size:256});
  try{
    const png=await createChatLevelImage({
      avatarUrl,
      displayName:member?.displayName??message.author.globalName??message.author.username,
      username:message.author.username,
      fromLevel:result.previous,
      toLevel:result.level,
      totalXp:result.xp,
    });
    await message.channel.send({
      files:[new AttachmentBuilder(png,{name:'subiu-de-nivel.png'})],
      allowedMentions:{parse:[]},
    });
  }catch(err){
    console.error('[CHAT LEVEL] Não foi possível publicar a arte:',err?.message??err);
  }
  return result;
}
export async function getMemberLevel(guildId,userId){
  const record=await prisma.economy.findUnique({
    where:{userId_guildId:{userId,guildId}},select:{xp:true,level:true},
  });
  const xp=record?.xp??0;
  return {xp,...xpProgress(xp)};
}
