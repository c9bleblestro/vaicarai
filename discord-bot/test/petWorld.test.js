import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {parseGIF,decompressFrames} from 'gifuct-js';
import prisma from '../src/database/client.js';
import {getPetWorld,changePetWorld,petStats,petLevel,petCooldown,MINUTE} from '../src/utils/petLife.js';
import {decodePetSprite,renderPetWorld} from '../src/utils/petWorldArt.js';
const sample={careAt:new Date(100000),fullness:90,happiness:90,energy:90,hygiene:90,bond:10};
test('life decay is bounded, persistent bond and levels are independent',()=>{
  const s=petStats(sample,100000+100*3600000);
  assert.equal(s.fullness,10);assert.equal(s.happiness,10);assert.equal(s.bond,10);
  assert.equal(petLevel(0).level,1);assert.equal(petLevel(30).level,2);
  assert.equal(petLevel(30*9**2).stage,'Jovem');
  assert.equal(petCooldown(sample,{lastPetPlay:new Date(100000)},'brincar',100000+MINUTE),19*MINUTE);
});
test('source GIF keeps animation frames and room/portrait produce animated files',async()=>{
  const c=createCanvas(32,32),ctx=c.getContext('2d'),enc=new GifEncoder(32,32,{repeat:0,quality:8});
  let sprite;
  try{
    for(let i=0;i<3;i++){ctx.clearRect(0,0,32,32);ctx.fillStyle=['#ee9cad','#a9ccff','#cab5f7'][i];ctx.fillRect(2+i*2,2,22,27);
      const data=ctx.getImageData(0,0,32,32).data;enc.addFrame(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),32,32,{delay:80+i*40});}
    sprite=Buffer.from(enc.finish());
  }finally{enc.dispose();}
  const source=await decodePetSprite(sprite);assert.ok(source.length>=2);
  const pet={id:'test',name:'Teste',emoji:'🐱'};
  for(const view of ['portrait','room']){
    const art=await renderPetWorld(pet,{theme:'neon',view,action:'brincar',spriteBuffer:sprite});
    assert.equal(art.ext,'gif');assert.equal(art.sourceAnimated,true);assert.ok(art.buffer.length<=8*1024*1024);
    const gif=parseGIF(art.buffer.buffer.slice(art.buffer.byteOffset,art.buffer.byteOffset+art.buffer.byteLength));
    const frames=decompressFrames(gif,true);assert.ok(frames.length>=24);
    assert.ok(gif.lsd.width>=400);assert.ok(gif.lsd.height>=267);
    assert.ok(frames.some((f,i)=>i>0&&Buffer.compare(Buffer.from(f.patch),Buffer.from(frames[0].patch))!==0));
  }
});
test('same-pet parallel actions and theme purchases cannot double-pay; adventures collect once',async()=>{
  const id='petlife-'+Date.now(),userId=id,guildId=id;
  try{
    const pet=await prisma.pet.create({data:{guildId,name:'Pet test',emoji:'🐱',price:0}});
    await prisma.userPurchase.create({data:{userId,guildId,itemType:'pet',itemRef:pet.id}});
    await prisma.userProfile.create({data:{userId,guildId,activePet:pet.id}});
    const world=await getPetWorld(userId,guildId);assert.equal(world.life.xp,0);
    const now=Date.now(),a={userId,guildId,petId:pet.id,now,rng:()=>0};
    const res=await Promise.all([changePetWorld({...a,action:'brincar'}),changePetWorld({...a,action:'brincar'})]);
    assert.equal(res.filter(r=>r.ok).length,1);
    const w=await getPetWorld(userId,guildId);assert.equal(w.eco.balance,150);assert.equal(w.life.xp,12);
    await prisma.economy.update({where:{userId_guildId:{userId,guildId}},data:{balance:3000}});
    const themes=await Promise.all([changePetWorld({...a,action:'tema',theme:'rose'}),changePetWorld({...a,action:'tema',theme:'rose'})]);
    assert.equal(themes.reduce((s,r)=>s+(r.amount??0),0),-2500);
    assert.equal((await getPetWorld(userId,guildId)).eco.balance,500);
    assert.equal((await changePetWorld({...a,action:'aventura'})).ok,true);
    assert.equal((await changePetWorld({...a,action:'coletar'})).ok,false);
    const finish={...a,now:now+16*MINUTE,action:'coletar'};
    const loot=await Promise.all([changePetWorld(finish),changePetWorld(finish)]);
    assert.equal(loot.filter(r=>r.ok).length,1);
    const final=await getPetWorld(userId,guildId);assert.equal(final.eco.balance,620);assert.equal(final.life.xp,32);
  }finally{
    await prisma.petLife.deleteMany({where:{userId,guildId}});
    await prisma.userPurchase.deleteMany({where:{userId}});
    await prisma.userProfile.deleteMany({where:{userId}});
    await prisma.economy.deleteMany({where:{userId,guildId}});
    await prisma.pet.deleteMany({where:{guildId}});
    await prisma.$disconnect();
  }
});
