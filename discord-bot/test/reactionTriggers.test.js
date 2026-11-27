import test from 'node:test';
import assert from 'node:assert/strict';
import prisma,{ensureReactionTriggerSchema} from '../src/database/client.js';
import { parseReactionEmojiId, matchingReactionTrigger, createReactionTrigger, deleteReactionTrigger, findMatchingReactionTrigger, applyReactionTrigger, reactionPage, buildReactionTriggerPanel, buildReactionTriggerModal } from '../src/utils/reactionTriggers.js';

const emojiId='123456789012345678';
test('reusa palavras inteiras, normalização e frases dos gatilhos de mídia',()=>{
  const rules=[{id:'r',keywords:'bom dia\nfofo'}];
  assert.equal(matchingReactionTrigger(rules,'BOM   DIA!!')?.id,'r');
  assert.equal(matchingReactionTrigger(rules,'que FoFo!')?.id,'r');
  assert.equal(matchingReactionTrigger(rules,'fofoca'),null);
  assert.equal(matchingReactionTrigger(rules,'abom dia'),null);
  assert.equal(parseReactionEmojiId('<a:teste:'+emojiId+'>'),emojiId);
  assert.equal(parseReactionEmojiId('<:teste:'+emojiId+'>'),emojiId);
  assert.equal(parseReactionEmojiId(emojiId),emojiId);
  assert.equal(parseReactionEmojiId('❤️'),null);
});
test('persistência, isolamento, reação real mockada, cooldown, exclusão e coexistência de mídia',async()=>{
  const g='reaction-'+Date.now(),other=g+'-other';
  try{
    await ensureReactionTriggerSchema();
    const rule=await createReactionTrigger({guildId:g,name:'Saudação',keywords:'Bom dia\nbom dia\nOlá',emojiId});
    assert.equal(rule.keywords,'bom dia\nolá');
    const rule2=await createReactionTrigger({guildId:other,name:'Outro',keywords:'bom dia',emojiId});
    assert.equal((await findMatchingReactionTrigger(g,'BOM DIA!')).id,rule.id);
    assert.equal((await findMatchingReactionTrigger(other,'bom dia')).id,rule2.id);
    const emoji={id:emojiId,name:'cute',available:true};
    const calls=[];
    const guild={id:g,emojis:{cache:new Map([[emojiId,emoji]])}};
    const msg={guildId:g,guild,author:{id:'user',bot:false},content:'Bom dia!',react:async e=>calls.push(e)};
    assert.equal(await applyReactionTrigger(msg,prisma,10000),true);
    assert.equal(await applyReactionTrigger(msg,prisma,11000),false);
    assert.equal(await applyReactionTrigger(msg,prisma,14000),true);
    assert.deepEqual(calls,[emoji,emoji]);
    assert.equal(await applyReactionTrigger({...msg,author:{id:'bot',bot:true}},prisma,18000),false);
    assert.equal(await applyReactionTrigger({...msg,guild:{emojis:{cache:new Map()}}},prisma,18000),false);
    assert.equal((await deleteReactionTrigger(other,rule.id)).count,0);
    const payload=await buildReactionTriggerPanel(guild);
    assert.match(payload.components[0].toJSON().components[0].content,/Saudação/);
    assert.equal(payload.components[1].toJSON().components[0].options[0].value,rule.id);
    assert.equal(buildReactionTriggerModal().toJSON().components.length,3);
    assert.equal(reactionPage(Array.from({length:21},(_,i)=>i),2).items[0],20);
    assert.equal((await deleteReactionTrigger(g,rule.id)).count,1);
    assert.equal(await findMatchingReactionTrigger(g,'bom dia'),null);
    assert.equal((await findMatchingReactionTrigger(other,'bom dia')).id,rule2.id);
  }finally{
    await prisma.reactionTrigger.deleteMany({where:{guildId:{in:[g,other]}}});
    await prisma.$disconnect();
  }
});
