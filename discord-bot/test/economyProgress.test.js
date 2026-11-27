import test from 'node:test';
import assert from 'node:assert/strict';
import {loadImage} from '@napi-rs/canvas';
import {parseGIF,decompressFrames} from 'gifuct-js';
import {rewardStatus,activeStreak,makeWorkChallenge,DAY,workProgressValue} from '../src/utils/economyProgress.js';
import {generateEconomyRewardArt,generateBalanceCard} from '../src/utils/economyCards.js';
import {claimRewardAtomic} from '../src/commands/economia/eco.js';
import prisma from '../src/database/client.js';
test('wallet status shares precise cooldowns and streak expiration',()=>{
  const now=Date.now(),eco={lastDaily:new Date(now-DAY),lastWeekly:new Date(now-2*DAY),dailyStreak:7};
  assert.deepEqual(rewardStatus(eco,now).map(s=>s.ready),[true,false,true,true]);assert.equal(activeStreak(eco,now),7);
  assert.equal(activeStreak(eco,now+DAY),0);assert.equal(workProgressValue(999).level,10);
});
test('all careers offer a unique correct answer',()=>{
  for(const job of ['entregador','freelancer','investidor','gerente','magnata']){
    for(let i=0;i<30;i++){const ch=makeWorkChallenge(job);assert.equal(new Set(ch.options).size,4);assert.ok(ch.correctIndex>=0&&ch.correctIndex<4);}
  }
});
test('dynamic wallet and all reward cards render and reward animation has real frames',async()=>{
  const status=rewardStatus(null),dashboard={status,streak:4,workXp:125};
  const card=await generateBalanceCard({username:'Teste',avatarUrl:null,balance:1500,bank:4000,dashboard});
  const img=await loadImage(card);assert.equal(img.width,900);assert.equal(img.height,760);
  for(const kind of ['daily','weekly','monthly','work']){
    const png=generateEconomyRewardArt(kind,{amount:1234,streak:4,job:'freelancer'});assert.equal((await loadImage(png)).width,720);
    const gif=generateEconomyRewardArt(kind,{amount:1234,streak:4,job:'freelancer'},true);
    assert.equal(gif.subarray(0,3).toString(),'GIF');
    assert.ok(decompressFrames(parseGIF(gif.buffer.slice(gif.byteOffset,gif.byteOffset+gif.byteLength)),true).length>=24);
  }
});
test('simultaneous daily claims can only credit once',async()=>{
  const userId='eco-test-'+Date.now(),guildId='test';
  try{
    await prisma.economy.create({data:{userId,guildId}});
    const now=Date.now(),args={userId,guildId,kind:'daily',now,amountFactory:()=>1000};
    const results=await Promise.all([claimRewardAtomic(args),claimRewardAtomic(args)]);
    assert.equal(results.filter(r=>r.ok).length,1);
    const eco=await prisma.economy.findUnique({where:{userId_guildId:{userId,guildId}}});assert.equal(eco.balance,1020);assert.equal(eco.dailyStreak,1);
  }finally{await prisma.economy.deleteMany({where:{userId,guildId}});await prisma.$disconnect();}
});
