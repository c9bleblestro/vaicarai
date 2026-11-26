import test from 'node:test';
import assert from 'node:assert/strict';
import prisma,{ensureInteractionStreakSchema} from '../src/database/client.js';
import {streakDay,recordInteractionStreak,getInteractionStreak,streakMilestone} from '../src/utils/interactionStreak.js';
import {renderStreakCard,appendStreakCard} from '../src/utils/interactionStreakCard.js';
import {v2Simple} from '../src/utils/embed.js';

test('timezone, reciprocidade, concorrência, dia perdido e isolamento persistente',async()=>{
  const g='streak-test-'+Date.now(),a='100',b='200';
  const d1=new Date('2026-11-25T23:00:00Z'),d2=new Date('2026-11-26T03:00:00Z'),d4=new Date('2026-11-28T03:00:00Z');
  assert.equal(streakDay(new Date('2026-11-26T02:59:00Z')),streakDay(d1));
  assert.equal(streakDay(d2),streakDay(d1)+1);
  try{
    await ensureInteractionStreakSchema();
    assert.equal((await getInteractionStreak(g,a,b,d1)).days,0);
    assert.equal((await recordInteractionStreak(g,a,b,d1)).days,0);
    assert.equal((await recordInteractionStreak(g,a,b,d1)).days,0);
    await Promise.all([recordInteractionStreak(g,b,a,d1),recordInteractionStreak(g,b,a,d1)]);
    assert.equal((await getInteractionStreak(g,b,a,d1)).days,1);
    await Promise.all([recordInteractionStreak(g,a,b,d2),recordInteractionStreak(g,b,a,d2)]);
    const state=await getInteractionStreak(g,a,b,d2);
    assert.equal(state.days,2);assert.equal(state.complete,true);
    assert.equal((await getInteractionStreak(g+'-other',a,b,d2)).days,0);
    assert.equal((await getInteractionStreak(g,a,b,d4)).days,0);
    await recordInteractionStreak(g,a,b,d4);await recordInteractionStreak(g,b,a,d4);
    const reset=await getInteractionStreak(g,a,b,d4);assert.equal(reset.days,1);assert.equal(reset.bestDays,2);
    assert.equal(streakMilestone(27).next.days,30);
  }finally{await prisma.interactionStreak.deleteMany({where:{guildId:g}});await prisma.$disconnect();}
});

test('PNG e componentes V2 preservam conteúdo e anexam card',async()=>{
  const s={days:27,bestDays:27,complete:true,mask:3};
  const a={username:'Alice'},b={username:'Bob'};
  const png=await renderStreakCard(s,a,b);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const payload=await appendStreakCard(v2Simple('Interação original'),s,a,b);
  assert.equal(payload.files.length,1);assert.equal(payload.files[0].name,'foguinho.png');
  const json=payload.components[0].toJSON();
  assert.equal(json.components[0].content,'Interação original');
  assert.equal(json.components.at(-1).items[0].media.url,'attachment://foguinho.png');
});
