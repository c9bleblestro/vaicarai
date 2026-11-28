import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {parseGIF,decompressFrames} from 'gifuct-js';
import prisma,{ensureProfileStudioSchema} from '../src/database/client.js';
import {generateProfileCard} from '../src/utils/profileCard.js';
import {generateAnimatedProfileCard,buildMotionTimeline} from '../src/utils/animatedProfileCard.js';
import {renderProfileAttachment} from '../src/commands/general/perfil.js';
import {ECONOMY_COSMETICS} from '../src/utils/economyProgress.js';
import {PROFILE_THEMES,PROFILE_EFFECTS,PROFILE_DECORS,normalizeAppearance,drawProfileEffect} from '../src/utils/profileStudioArt.js';
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

test('grafite é o padrão neutro e não altera escolhas salvas',()=>{
 assert.deepEqual(normalizeAppearance(),{theme:'graphite',effect:'off',decor:'none',signature:''});
 assert.equal(normalizeAppearance({theme:'rose',decor:'floral'}).theme,'rose');
 assert.equal(normalizeAppearance({theme:'rose',decor:'floral'}).decor,'floral');
});
test('novos efeitos animam pixels sem substituir foto, banner ou valores',async()=>{
 const bannerCanvas=createCanvas(120,80),b=bannerCanvas.getContext('2d');b.fillStyle='#11cc77';b.fillRect(0,0,120,80);
 const banner=await loadImage(bannerCanvas.toBuffer('image/png'));
 for(const effect of ['reflection','butterflies','crystal']){
  const appearance={theme:'graphite',effect,decor:'none'};
  const base=await generateProfileCard({...params,appearance,_bannerImage:banner,_returnCanvas:true});
  const render=phase=>{const c=createCanvas(800,600),ctx=c.getContext('2d');ctx.drawImage(base,0,0);drawProfileEffect(ctx,appearance,phase,base);return c;};
  const a=render(.31),z=render(.66);
  assert.ok(!a.toBuffer('image/png').equals(z.toBuffer('image/png')),effect+' needs real movement');
  for(const c of [a,z]){const ctx=c.getContext('2d');assert.deepEqual([...ctx.getImageData(280,90,1,1).data],[17,204,119,255]);assert.deepEqual([...ctx.getImageData(659,124,1,1).data],[...base.getContext('2d').getImageData(659,124,1,1).data]);}
  if(effect==='reflection'){
   assert.ok(base.profileTextMask);
   const c=a.getContext('2d').getImageData(0,0,800,600).data,original=base.getContext('2d').getImageData(0,0,800,600).data,m=base.profileTextMask.getContext('2d').getImageData(0,0,800,600).data;
   let changed=0;for(let i=0;i<c.length;i+=4){if(c[i]!==original[i]||c[i+1]!==original[i+1]||c[i+2]!==original[i+2]){changed++;assert.ok(m[i+3]>0,'shine must stay in glyphs');}}assert.ok(changed>20);
  }
  const gif=await generateAnimatedProfileCard({...params,appearance,_resolvedBanner:{gradient:['#10151b','#1b222b']}});
  const frames=framesOf(gif);assert.ok(frames.length>=24);assert.ok(gif.length<=8*1024*1024);
  assert.ok(frames.some((f,i)=>i>0&&!Buffer.from(f.patch).equals(Buffer.from(frames[0].patch))));
 }
});

test('o layout novo é universal e não depende de trocar tema ou cores',async()=>{
 const c=createCanvas(100,60),ctx=c.getContext('2d');ctx.fillStyle='#11cc77';ctx.fillRect(0,0,100,60);
 const banner=await loadImage(c.toBuffer('image/png'));
 for(const theme of ['classic','noir','rose','blush','graphite']){
  const card=await generateProfileCard({...params,appearance:{theme,decor:'none',signature:'Assinatura real'},cardBg1:'#18191b',cardBg2:'#18191b',cardPanelColor:'#222326',_bannerImage:banner,_returnLayers:true});
  assert.deepEqual(card.bannerRect,[24,24,516,150,20]);
  const fg=card.foreground.getContext('2d');
  assert.ok(fg.getImageData(60,317,1,1).data[3]>0);
 }
});
test('Onda Cristalina move luz entre painéis e não muda o topo',async()=>{
 const appearance={theme:'noir',effect:'crystal',decor:'none'};
 const base=await generateProfileCard({...params,appearance,_returnCanvas:true});
 const src=base.getContext('2d').getImageData(0,0,800,600).data;
 const diff=(phase)=>{
  const c=createCanvas(800,600),ctx=c.getContext('2d');ctx.drawImage(base,0,0);drawProfileEffect(ctx,appearance,phase,base);
  const d=ctx.getImageData(0,0,800,600).data;let n=0,first=0,last=0;
  for(let y=0;y<600;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;if(d[i]===src[i]&&d[i+1]===src[i+1]&&d[i+2]===src[i+2])continue;n++;assert.ok(y>=284&&y<579);if(y<350&&x<400)first++;if(y>=514&&x>=484)last++;}
  return {n,first,last};
 };
 assert.ok(diff(.10).first>100);assert.ok(diff(.89).last>100);
});
