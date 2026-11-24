import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,GifEncoder} from '@napi-rs/canvas';
import {generateProfileCard,loadProfileStatIconSheet,drawProfileStatIcon,computeLevel} from '../src/utils/profileCard.js';
import {generateAnimatedProfileCard,generateStaticProfileGifCard} from '../src/utils/animatedProfileCard.js';
import {parseGIF,decompressFrames} from 'gifuct-js';
import {xpProgress} from '../src/utils/chatLevelMath.js';

const params={username:'Teste',avatarUrl:null,balance:0,bank:0,purchases:0,xp:432,reps:1,marriedToName:'Pessoa A',bestFriendName:'Pessoa B',cardBg1:'#f4d1a6',cardBg2:'#f4d1a6',cardPanelColor:'#1c1e21'};

test('seis ícones locais carregam e não desenham fora do círculo',async()=>{
  const sheet=await loadProfileStatIconSheet();
  assert.ok(sheet);
  assert.equal(sheet.width,336);
  assert.equal(sheet.height,56);
  const c=createCanvas(408,68),ctx=c.getContext('2d');
  const fingerprints=new Set();
  for(let i=0;i<6;i++){
    assert.equal(drawProfileStatIcon(ctx,sheet,i,i*68,0,68),true);
    assert.equal(ctx.getImageData(i*68,0,1,1).data[3],0);
    assert.equal(ctx.getImageData(i*68+34,34,1,1).data[3],255);
    fingerprints.add(Buffer.from(ctx.getImageData(i*68,0,68,68).data).toString('base64'));
  }
  assert.equal(fingerprints.size,6);
  assert.equal(drawProfileStatIcon(ctx,null,0,0,0,68),false);
});

test('perfil PNG conserva banner equipado, dados variáveis e dimensões',async()=>{
  const c=createCanvas(120,40),ctx=c.getContext('2d');
  ctx.fillStyle='#11cc77';ctx.fillRect(0,0,120,40);
  const banner=await loadImage(c.toBuffer('image/png'));
  const first=await generateProfileCard({...params,_bannerImage:banner,_returnCanvas:true});
  const second=await generateProfileCard({...params,xp:800,balance:1234,_bannerImage:banner,_returnCanvas:true});
  assert.equal(first.width,800);assert.equal(first.height,600);
  assert.deepEqual([...first.getContext('2d').getImageData(500,80,1,1).data],[17,204,119,255]);
  assert.notDeepEqual(first.toBuffer('image/png'),second.toBuffer('image/png'));
  const png=await generateProfileCard({...params,_bannerImage:banner});
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});

test('banner GIF continua animado e fallback continua GIF',async()=>{
  const enc=new GifEncoder(16,16,{repeat:0,quality:8});
  const frame=createCanvas(16,16),ctx=frame.getContext('2d');
  let buffer;
  try{
    for(const color of ['#ff0000','#0000ff']){
      ctx.fillStyle=color;ctx.fillRect(0,0,16,16);
      enc.addFrame(new Uint8Array(ctx.getImageData(0,0,16,16).data.buffer),16,16,{delay:100});
    }
    buffer=enc.finish();
  }finally{enc.dispose();}
  const resolved={key:'test',imageBuffer:buffer};
  const gif=await generateAnimatedProfileCard({...params,_resolvedBanner:resolved});
  assert.match(gif.subarray(0,6).toString(),/^GIF8[79]a$/);
  const frames=decompressFrames(parseGIF(gif.buffer.slice(gif.byteOffset,gif.byteOffset+gif.byteLength)),true);
  assert.ok(frames.length>=2);
  const still=await generateStaticProfileGifCard({...params,_resolvedBanner:resolved});
  assert.match(still.subarray(0,6).toString(),/^GIF8[79]a$/);
});

test('perfil e /nivel usam a mesma curva de XP, inclusive nível zero e limites',()=>{
  for(const xp of [0,1,199,200,201,479,480,839,840,1280,10000,1000000]){
    const expected=xpProgress(xp);
    assert.deepEqual(computeLevel(xp),{level:expected.level,current:expected.current,needed:expected.required});
  }
  assert.deepEqual(computeLevel(0),{level:0,current:0,needed:200});
  assert.deepEqual(computeLevel(200),{level:1,current:0,needed:280});
});
