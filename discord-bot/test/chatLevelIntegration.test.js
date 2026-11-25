import test from 'node:test';
import assert from 'node:assert/strict';
import prisma,{ensureChatLevelSchema} from '../src/database/client.js';
import {awardChatMessageXp,getMemberLevel} from '../src/utils/chatLevel.js';
import {computeLevel} from '../src/utils/profileCard.js';

test('PostgreSQL: migração idempotente e 50 mensagens sem intervalo; perfil e nível iguais',async()=>{
  const guildId='level-integration-'+Date.now(),userId='user',legacy='legacy';
  try{
    await prisma.guildConfig.create({data:{guildId,chatLevelEnabled:true}});
    await prisma.chatLevelCooldown.create({data:{guildId,userId:legacy,chatXp:211}});
    await ensureChatLevelSchema();
    const migrated=await getMemberLevel(guildId,legacy);
    assert.equal(migrated.level,1);
    assert.equal(migrated.current,1);
    assert.equal((await getMemberLevel(guildId,userId)).level,0);
    for(let i=1;i<=101;i++){
      const result=await awardChatMessageXp({guildId,author:{id:userId,bot:false},content:'mensagem '+i});
      assert.equal(result.xp,i);
      assert.equal(result.leveled,i%50===0);
    }
    const state=await getMemberLevel(guildId,userId);
    assert.equal(state.level,2);assert.equal(state.current,1);assert.equal(state.required,50);
    assert.deepEqual(computeLevel(state.xp),{level:state.level,current:state.current,needed:state.required});
    assert.equal(await awardChatMessageXp({guildId,author:{id:userId,bot:false},content:'mensagem 101'}),null);
    await ensureChatLevelSchema();
    assert.deepEqual(await getMemberLevel(guildId,userId),state);
    assert.equal((await prisma.chatLevelCooldown.findUnique({where:{guildId_userId:{guildId,userId:legacy}}})).chatXp,211);
  }finally{
    await prisma.chatLevelCooldown.deleteMany({where:{guildId}});
    await prisma.guildConfig.deleteMany({where:{guildId}});
    await prisma.$disconnect();
  }
});
