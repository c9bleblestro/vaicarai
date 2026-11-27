import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {parseGIF,decompressFrames} from 'gifuct-js';
import prisma from '../src/database/client.js';
import {getPetWorld,changePetWorld,petStats,petLevel,petCooldown,MINUTE} from '../src/utils/petLife.js';
import {decodePetSprite,renderPetWorld} from '../src/utils/petWorldArt.js';
import {rigPose,drawRigFrame,RIG_ACTIONS,RIG_DURATION,RIG_STEP} from '../src/utils/petRigArt.js';
import {buildWorldPayload} from '../src/commands/general/pet.js';
import {getPetIllustration,validatePetIllustrations} from '../src/utils/petIllustrationPack.js';
import {migratePetCatalogForGuild} from '../src/utils/petCatalogV2.js';
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

test('illustrated catalog serves the actual four GIF files without the old renderer',async()=>{
  assert.equal(validatePetIllustrations(),true);
  for(const species of ['luna','koda']){
    const pet={id:'pw2-'+species+'-test',name:species,emoji:'🐾'};
    for(const view of ['portrait','room']){
      const original=getPetIllustration(pet.id,view);
      const art=await renderPetWorld(pet,{theme:'neon',view,action:'idle'});
      assert.equal(art.illustrated,true);
      assert.equal(art.ext,'gif');
      assert.deepEqual(art.buffer,original);
      const frames=await decodePetSprite(original);
      assert.ok(frames.length>=100);
      assert.ok(frames.reduce((sum,f)=>sum+f.delay,0)>=5500);
      if(view==='portrait'){
        assert.ok(frames.every(f=>f.image.getContext('2d').getImageData(0,0,1,1).data[3]===0));
        const decoded=decompressFrames(parseGIF(original.buffer.slice(original.byteOffset,original.byteOffset+original.byteLength)),true);
        assert.ok(decoded.every(f=>f.disposalType===2));
      }
    }
    const art=await renderPetWorld(pet,{theme:'neon',view:'room',action:'acariciar'});
    assert.equal(art.illustrated,true);assert.equal(art.ext,'gif');
    assert.ok(art.buffer.length<=8*1024*1024);
  }
});
test('catalog migration retires old pets and transfers ownership and progression exactly once',async()=>{
  const userId='pet-v2-owner-'+Date.now(),guildId='pet-v2-guild-'+Date.now();
  try{
    const old=await prisma.pet.create({data:{guildId,name:'Pet antigo',emoji:'🐱',price:100}});
    await prisma.userPurchase.create({data:{userId,guildId,itemType:'pet',itemRef:old.id}});
    await prisma.userProfile.create({data:{userId,guildId,activePet:old.id}});
    await prisma.economy.create({data:{userId,guildId,balance:2345,bank:6789}});
    await prisma.petLife.create({data:{userId,guildId,petId:old.id,xp:321,bond:72,room:'rose',ownedRooms:'neon,rose'}});
    const res=await migratePetCatalogForGuild(guildId,prisma);
    assert.equal(res.retired,1);assert.equal(res.owners,1);
    const live=await prisma.pet.findMany({where:{guildId,active:true}});
    assert.deepEqual(live.map(p=>p.id).sort(),['pw2-koda-'+guildId,'pw2-luna-'+guildId]);
    assert.equal((await prisma.pet.findUnique({where:{id:old.id}})).active,false);
    assert.equal(await prisma.userPurchase.count({where:{userId,itemType:'pet'}}),2);
    assert.equal(await prisma.userPurchase.count({where:{userId,itemType:'pet_legacy'}}),1);
    const world=await getPetWorld(userId,guildId);
    assert.equal(world.pet.id,'pw2-luna-'+guildId);assert.equal(world.life.xp,321);assert.equal(world.life.bond,72);
    assert.equal(world.life.room,'rose');assert.equal(world.eco.balance,2345);assert.equal(world.eco.bank,6789);
    await migratePetCatalogForGuild(guildId,prisma);
    assert.equal(await prisma.userPurchase.count({where:{userId,itemType:'pet'}}),2);
    assert.equal((await getPetWorld(userId,guildId)).life.xp,321);
  }finally{
    await prisma.petLife.deleteMany({where:{userId,guildId}});
    await prisma.userPurchase.deleteMany({where:{userId}});
    await prisma.userProfile.deleteMany({where:{userId}});
    await prisma.economy.deleteMany({where:{userId,guildId}});
    await prisma.pet.deleteMany({where:{guildId}});
    await prisma.$disconnect();
  }
});

test('portrait and room stay distinct; away panel retains a real GIF',async()=>{
  for(const species of ['luna','koda']){
    const pet={id:'pw2-'+species+'-test',name:species,emoji:'🐾'};
    const portrait=await decodePetSprite(getPetIllustration(pet.id,'portrait'));
    const room=await decodePetSprite(getPetIllustration(pet.id,'room'));
    assert.ok(portrait[0].image.getContext('2d').getImageData(0,0,1,1).data[3]<128,'shop portrait must have transparent corners');
    assert.equal(room[0].image.getContext('2d').getImageData(0,0,1,1).data[3],255);
    const world={pet,life:{...sample,careAt:new Date(),xp:0,room:'neon',ownedRooms:'neon',adventureUntil:new Date(Date.now()+600000)},eco:{}};
    const payload=await buildWorldPayload(world,{owner:'123456789012345678',view:'room'});
    assert.equal(payload.files.length,1);
    assert.equal(payload.files[0].name,'pet-world.gif');
    assert.deepEqual(payload.files[0].attachment,getPetIllustration(pet.id,'room'));
    assert.ok(JSON.stringify(payload.components.map(c=>c.toJSON())).includes('attachment://pet-world.gif'));
  }
});


test('continuous rig motion is closed at the loop boundary and poses are bounded',()=>{
  for(const action of RIG_ACTIONS){
    const a=rigPose(action,0),b=rigPose(action,1);
    for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<1e-8,action+':'+key);
    for(let i=0;i<=100;i++){
      const p=rigPose(action,i/100);assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.blink>=0&&p.blink<=1);assert.ok(Math.abs(p.x)<=34);
    }
  }
  assert.equal(RIG_DURATION/RIG_STEP,112);
});
test('rig frames keep one room and one character across actions; portraits have transparent edges',()=>{
  for(const species of ['luna','koda'])for(const theme of ['neon','rose','moon']){
    const canvas=createCanvas(480,320),ctx=canvas.getContext('2d');
    drawRigFrame(ctx,species,{view:'room',theme,t:0});
    const stable=Buffer.from(ctx.getImageData(0,0,100,100).data);
    for(const action of RIG_ACTIONS){
      drawRigFrame(ctx,species,{view:'room',theme,action,t:.5});
      assert.deepEqual(Buffer.from(ctx.getImageData(0,0,100,100).data),stable);
      assert.equal(ctx.getImageData(0,0,1,1).data[3],255);
    }
    const portrait=createCanvas(384,256),pc=portrait.getContext('2d');
    for(const action of RIG_ACTIONS){
      drawRigFrame(pc,species,{view:'portrait',action,t:.5});
      assert.equal(pc.getImageData(0,0,1,1).data[3],0);
      assert.ok(pc.getImageData(192,155,1,1).data[3]>0||pc.getImageData(220,155,1,1).data[3]>0);
    }
  }
});
test('same species uses one cached reaction across guilds; real themed room returns a GIF',async()=>{
  const options={view:'room',theme:'moon',action:'brincar'};
  const [a,b]=await Promise.all(['one','two'].map(guild=>renderPetWorld({id:'pw2-luna-'+guild},options)));
  assert.equal(a.fallback,undefined);
  assert.deepEqual(a.buffer,b.buffer);
  const frames=await decodePetSprite(a.buffer);
  assert.ok(frames.length>=8);
  assert.ok(frames.reduce((s,f)=>s+f.delay,0)>=5500);
});

test('room and portrait controls preserve the selected view and do not freeze at a cooldown',async()=>{
  const pet={id:'pw2-luna-test',name:'Luna',emoji:'🐱'};
  const world={pet,life:{...sample,careAt:new Date(),xp:0,room:'neon',ownedRooms:'neon'},eco:{lastPetPlay:new Date()}};
  const payload=await buildWorldPayload(world,{owner:'123456789012345678',view:'portrait'});
  const play=payload.components.flatMap(c=>c.toJSON().components??[]).find(b=>b.custom_id?.startsWith('pet_action:brincar:'));
  assert.ok(play);assert.ok(play.custom_id.endsWith(':p'));assert.equal(play.disabled,false);
  assert.ok(JSON.stringify(payload.components.map(c=>c.toJSON())).includes('<t:'));
});
