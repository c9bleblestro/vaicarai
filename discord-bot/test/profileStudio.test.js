import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {parseGIF,decompressFrames} from 'gifuct-js';
import prisma,{ensureProfileStudioSchema} from '../src/database/client.js';
import {generateProfileCard} from '../src/utils/profileCard.js';
import {generateAnimatedProfileCard,buildMotionTimeline} from '../src/utils/animatedProfileCard.js';
import {renderProfileAttachment} from '../src/commands/general/perfil.js';
import {ECONOMY_COSMETICS} from '../src/utils/economyProgress.js';
import {PROFILE_THEMES,PROFILE_EFFECTS,PROFILE_DECORS,normalizeAppearance} from '../src/utils/profileStudioArt.js';
import {buildProfileStudioPayload,saveProfileAppearance,profileAppearance} from '../src/utils/profileStudio.js';

const params={username:'yas bb do ph',avatarUrl:null,balance:0,bank:0,purchases:0,xp:132,reps:1,marriedToName:'Pessoa A',bestFriendName:'Pessoa B',bio:'Meu perfil',appearance:{theme:'rose',effect:'off',decor:'cat'}};
const framesOf=buf=>decompressFrames(parseGIF(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)),true);
const pngHeader='89504e470d0a1a0a';
test('temas, decoração, assinatura e dados variáveis produzem cartões de verdade',async()=>{
  const c=createCanvas(120,40),ctx=c.getContext('2d');ctx.fillStyle='#11cc77';ctx.fillRect(0,0,120,40);
  const banner=await loadImage(c.toBuffer('image/png'));
  const hashes=new Set();
  for(const theme of Object.keys(PROFILE_THEMES)){
    const img=await generateProfileCard({...params,appearance:{theme,decor:'floral'},_bannerImage:banner,_returnCanvas:true});
    assert.equal(img.width,800);assert.equal(img.height,600);
    assert.deepEqual([...img.getContext('2d').getImageData(500,80,1,1).data],[17,204,119,255]);
    hashes.add(img.toBuffer('image/png').toString('base64'));
  }
  assert.equal(hashes.size,Object.keys(PROFILE_THEMES).length);
  const one=await generateProfileCard({...params,_bannerImage:banner});
  const two=await generateProfileCard({...params,_bannerImage:banner,balance:42,marriedStreak:7,appearance:{theme:'rose',decor:'bow',signature:'Minha assinatura'}});
  assert.equal(one.subarray(0,8).toString('hex'),pngHeader);
  assert.ok(!one.equals(two),'cartões com dados e estilos distintos precisam mudar');
  const custom=await generateProfileCard({...params,_bannerImage:banner,cardBg1:'#11aa33',cardBg2:'#11aa33',_returnCanvas:true});
  assert.deepEqual([...custom.getContext('2d').getImageData(400,10,1,1).data],[17,170,51,255]);
});
test('animação desligada por padrão, PNG mesmo com banner GIF, efeitos geram vários frames',async()=>{
  assert.equal(normalizeAppearance().effect,'off');
  const frame=createCanvas(16,16),ctx=frame.getContext('2d'),enc=new GifEncoder(16,16,{repeat:0,quality:8});
  let gif;
  try{for(const color of ['#ff0000','#0000ff']){ctx.fillStyle=color;ctx.fillRect(0,0,16,16);enc.addFrame(new Uint8Array(ctx.getImageData(0,0,16,16).data.buffer),16,16,{delay:100});}gif=enc.finish();}finally{enc.dispose();}
  const resolved={key:'test',imageBuffer:gif};
  const staticResult=await renderProfileAttachment({...params,_resolvedBanner:resolved});
  assert.equal(staticResult.filename,'perfil.png');assert.equal(staticResult.buf.subarray(0,8).toString('hex'),pngHeader);
  const anim=await renderProfileAttachment({...params,appearance:{theme:'rose',effect:'banner'},_resolvedBanner:resolved});
  assert.equal(anim.filename,'perfil.gif');assert.ok(framesOf(anim.buf).length>=2);
  // Effects also work without a GIF banner.
  const effect=await generateAnimatedProfileCard({...params,appearance:{theme:'rose',effect:'sparkle'},_resolvedBanner:{gradient:['#221122','#442244']}});
  const frames=framesOf(effect);
  assert.ok(frames.length>=24);assert.ok(Math.abs(frames.reduce((sum,f)=>sum+f.delay,0)-2400)<=100);assert.ok(frames.some((frame,index)=>index>0&&!Buffer.from(frame.patch).equals(Buffer.from(frames[0].patch))),'GIF deve ter frames visualmente distintos');
  assert.ok(effect.length<=8*1024*1024);
});
test('estúdio oferece opções, valida seleção e salva somente a preferência escolhida',async()=>{
  const userId='studio-test-'+Date.now(),guildId='test';
  try{
    await ensureProfileStudioSchema();
    await prisma.userProfile.create({data:{userId,guildId,activeBanner:'owned-banner',activeRing:'roxo',bio:'Bio',reps:5,cardBg1:'#123456'}});
    await saveProfileAppearance(userId,guildId,'theme','lilac');
    await saveProfileAppearance(userId,guildId,'effect','hearts');
    await saveProfileAppearance(userId,guildId,'decor','cat');
    await saveProfileAppearance(userId,guildId,'signature','Assinatura');
    await assert.rejects(saveProfileAppearance(userId,guildId,'theme','bad'),/inválida/);
    const saved=await prisma.userProfile.findUnique({where:{userId}});
    assert.equal(saved.activeBanner,'owned-banner');assert.equal(saved.activeRing,'roxo');assert.equal(saved.bio,'Bio');assert.equal(saved.reps,5);assert.equal(saved.cardBg1,'#123456');
    assert.deepEqual(profileAppearance(saved),{theme:'lilac',effect:'hearts',decor:'cat',signature:'Assinatura'});
    const payload=buildProfileStudioPayload(userId,saved);
    assert.equal(payload.components.length,4);
    for(const [i,options] of [PROFILE_THEMES,PROFILE_EFFECTS,PROFILE_DECORS].entries()){
      const select=payload.components[i].toJSON().components[0];
      assert.equal(select.options.length,Object.keys(options).filter(k=>!Object.hasOwn(ECONOMY_COSMETICS,k)).length);assert.ok(select.custom_id.endsWith(userId));
      assert.equal(select.options.filter(o=>o.default).length,1);
    }
    await saveProfileAppearance(userId,guildId,'effect','off');
    assert.equal((await prisma.userProfile.findUnique({where:{userId}})).profileEffect,'off');
  }finally{await prisma.userProfile.deleteMany({where:{userId}});await prisma.$disconnect();}
});

test('layout novo preserva o banner à esquerda e o avatar real à direita',async()=>{
  const c=createCanvas(120,120),ctx=c.getContext('2d');ctx.fillStyle='#11cc77';ctx.fillRect(0,0,120,120);
  const banner=await loadImage(c.toBuffer('image/png'));
  ctx.fillStyle='#3377ff';ctx.fillRect(0,0,120,120);
  const avatarUrl='data:image/png;base64,'+c.toBuffer('image/png').toString('base64');
  const img=await generateProfileCard({...params,avatarUrl,_bannerImage:banner,_returnCanvas:true,appearance:{theme:'blush',decor:'none'}});
  const result=img.getContext('2d');
  assert.deepEqual([...result.getImageData(280,90,1,1).data],[17,204,119,255]);
  // The right-hand portrait area cannot be part of the equipped banner.
  assert.notDeepEqual([...result.getImageData(659,124,1,1).data],[17,204,119,255]);
  assert.ok(Object.hasOwn(PROFILE_EFFECTS,'dream'));
  assert.ok(Object.hasOwn(PROFILE_EFFECTS,'aurora'));
});

test('relógio do GIF respeita os delays originais e efeitos não esticam banner',()=>{
  const source=[{delayMs:40},{delayMs:80},{delayMs:120}];
  assert.deepEqual(buildMotionTimeline(source,false).map(x=>x.delayMs),[40,80,120]);
  const motion=buildMotionTimeline(source,true,40);
  assert.deepEqual(motion.slice(0,7).map(x=>x.index),[0,1,1,2,2,2,0]);
  assert.equal(motion.reduce((sum,x)=>sum+x.delayMs,0)%240,0);
  assert.ok(motion.every(x=>x.delayMs>=20));
  assert.equal(buildMotionTimeline([],true,40).length,60);
});
