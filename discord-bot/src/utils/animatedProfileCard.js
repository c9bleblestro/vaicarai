/**
 * animatedProfileCard.js
 * Gera um card de perfil GIF animado quando o banner do usuário é um GIF.
 * Usa @napi-rs/canvas (GifEncoder nativo) + gifuct-js para decodificar frames.
 */

import { GifEncoder, createCanvas } from '@napi-rs/canvas';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run=promisify(execFile);
import { parseGIF, decompressFrames } from 'gifuct-js';
import { generateProfileCard } from './profileCard.js';
import { resolveBanner }      from './shopData.js';
import { isGifProfileBanner } from './profileBannerFormat.js';
import { drawProfileEffect, normalizeAppearance } from './profileStudioArt.js';

// ── Detecção de GIF ───────────────────────────────────────────────────────────

/** Verifica se a URL/buffer é de um GIF (por extensão ou Content-Type). */
export async function isGifUrl(url) {
  if (!url) return false;
  if (/\.gif(\?.*)?$/i.test(url)) return true;
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 5000);
    const r    = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    return (r.headers.get('content-type') ?? '').includes('image/gif');
  } catch { return false; }
}

// ── Extração e composição de frames GIF ──────────────────────────────────────

/**
 * Baixa um GIF, extrai e compõe até `maxFrames` frames.
 * Retorna Array de { image: Image, delayMs: number }.
 */
async function fetchGifFrames(banner, rect) {
  let gifBuffer;
  if (banner.imageBuffer?.length) {
    gifBuffer = Buffer.from(banner.imageBuffer);
  } else {
    if (!banner.imageUrl) throw new Error('Banner sem imagem disponível');
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const r = await fetch(banner.imageUrl, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      gifBuffer = Buffer.from(await r.arrayBuffer());
    } finally { clearTimeout(timer); }
  }

  // Decodifica
  if(gifBuffer.length>8*1024*1024)throw new Error('GIF muito grande');
  const gif = parseGIF(gifBuffer.buffer.slice(gifBuffer.byteOffset, gifBuffer.byteOffset + gifBuffer.byteLength));

  const gW = gif.lsd.width;
  const gH = gif.lsd.height;
  if (!gW || !gH || gW * gH > 12_000_000) {
    throw new Error(`GIF grande demais (${gW}x${gH})`);
  }

  const sourceFrames=gif.frames.filter(f=>f.image);
  if(sourceFrames.length>240||sourceFrames.length*gW*gH>100_000_000)throw new Error('GIF complexo demais');
  const frames=decompressFrames(gif,true);
  if(!frames.length)throw new Error('GIF sem frames');

  // Canvas de composição
  const compCanvas = createCanvas(gW, gH);
  const compCtx    = compCanvas.getContext('2d');

  // Keep every source frame and its original timing. Store only the fitted banner region.
  const selected = [];
  const [, , bw,bh]=rect;
  const patchCanvas=createCanvas(gW,gH),patchCtx=patchCanvas.getContext('2d');

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // Compõe o patch deste frame no canvas acumulado
    const previous=frame.disposalType===3?compCtx.getImageData(0,0,gW,gH):null;
    const patchData=patchCtx.createImageData(frame.dims.width,frame.dims.height);
    patchData.data.set(frame.patch);
    patchCtx.clearRect(0,0,gW,gH);patchCtx.putImageData(patchData,0,0);
    compCtx.drawImage(patchCanvas,0,0,frame.dims.width,frame.dims.height,frame.dims.left,frame.dims.top,frame.dims.width,frame.dims.height);

    const image=createCanvas(bw,bh),ic=image.getContext('2d');
    const scale=Math.max(bw/gW,bh/gH);
    ic.drawImage(compCanvas,(bw-gW*scale)/2,(bh-gH*scale)/2,gW*scale,gH*scale);
    selected.push({image,delayMs:Math.max(20,Math.round((frame.delay||100)/10)*10)});
    
    // Disposal: limpa a região para o próximo frame se necessário
    if(previous)compCtx.putImageData(previous,0,0);
    if (frame.disposalType === 2) {
      compCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    }
  }

  return selected;
}

// ── Gerador principal ─────────────────────────────────────────────────────────

const W = 800, H = 600;

function encodeCanvasAsGif(canvas, delayMs = 100) {
  const encoder = new GifEncoder(W, H, { repeat: 0, quality: 8 });
  try {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, W, H);
    encoder.addFrame(new Uint8Array(data.data.buffer), W, H, { delay: delayMs });
    return encoder.finish();
  } finally {
    encoder.dispose();
  }
}

/**
 * Gera um card de perfil animado (GIF).
 * @param {object} params — mesmos parâmetros de generateProfileCard
 * @returns {Promise<Buffer>} Buffer do GIF animado
 */
// A banner-only timeline preserves each original frame's delay. When effects are
// enabled, use a separate clock, never stretch or rescale the banner's cycle.
export function buildMotionTimeline(frames,hasEffect,step=40){
  const total=frames.reduce((sum,f)=>sum+f.delayMs,0);
  if(!hasEffect)return frames.map((_,i)=>({index:i,delayMs:frames[i].delayMs,phase:0}));
  // Whole source cycles close the loop without a reset halfway through the banner.
  const duration=total?total*Math.max(1,Math.min(6,Math.ceil(2400/total))):2400;
  const interval=Math.max(step,Math.ceil(duration/180/10)*10);
  let index=0,edge=frames[0]?.delayMs??0,cycle=-1;
  const result=[];
  for(let t=0;t<duration;t+=interval){
    if(total){
      const n=Math.floor(t/total),at=t%total;
      if(n!==cycle){cycle=n;index=0;edge=frames[0].delayMs;}
      while(index<frames.length-1&&at>=edge){index++;edge+=frames[index].delayMs;}
    }
    result.push({index,delayMs:Math.min(interval,duration-t),phase:t/duration});
  }
  // GIF delays below 20ms are clamped in many clients; fold a short remainder.
  if(result.length>1&&result.at(-1).delayMs<20)result[result.length-2].delayMs+=result.pop().delayMs;
  return result;
}
function rounded(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
const LIMIT=8*1024*1024;
async function optimizedGif(timeline,draw){
  // FFmpeg is already installed for the bot's FM runtime. A global palette and
  // changed rectangles prevent quantization flicker and full-frame GIF bloat.
  const dir=await mkdtemp(join(tmpdir(),'profile-gif-'));
  try{
    let list='ffconcat version 1.0\n';
    for(let i=0;i<timeline.length;i++){
      const name='f'+i+'.png';
      await writeFile(join(dir,name),draw(timeline[i]).toBuffer('image/png'));
      list+="file '"+name+"'\noption framerate 100\nduration "+(timeline[i].delayMs/1000).toFixed(2)+"\n";
    }
    await writeFile(join(dir,'frames.txt'),list);
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i','frames.txt','-filter_complex_threads','1','-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-fps_mode','passthrough','-gifflags','+transdiff+offsetting','-loop','0','-final_delay',String(Math.round(timeline.at(-1).delayMs/10)),'output.gif'],{cwd:dir,timeout:45000,maxBuffer:1024*1024});
    return await readFile(join(dir,'output.gif'));
  }finally{await rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
function nativeGif(timeline,draw){
  const encoder=new GifEncoder(W,H,{repeat:0,quality:8});
  try{
    for(const item of timeline){
      const data=draw(item).getContext('2d').getImageData(0,0,W,H).data;
      encoder.addFrame(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),W,H,{delay:item.delayMs});
    }
    return encoder.finish();
  }finally{encoder.dispose();}
}
export async function generateAnimatedProfileCard(params){
  const banner=params._resolvedBanner??await resolveBanner(params.activeBanner,params.guildId,{includeImageData:true});
  const appearance=params.appearance?normalizeAppearance(params.appearance):{theme:'classic',effect:'banner'};
  const hasEffect=!['off','banner'].includes(appearance.effect);
  const rect=appearance.theme==='classic'?[18,18,764,128,24]:[24,24,516,150,20];
  let frames=[];
  if(isGifProfileBanner(banner)){
    try{frames=await fetchGifFrames(banner,rect);}catch(error){
      if(!hasEffect)throw error;
      console.warn('[animCard] Banner estático no efeito:',error?.message??error);
    }
  }
  if(!frames.length&&!hasEffect)throw Error('Não há animação selecionada para este banner.');
  // Draw avatar, text, icons and equipped items just once, including foreground
  // decorations that overlap the banner. Recompose the region each frame.
  const layers=frames.length?await generateProfileCard({...params,_resolvedBanner:banner,_bannerImage:frames[0].image,_returnLayers:true}):null;
  const still=layers?null:await generateProfileCard({...params,_resolvedBanner:banner,_returnCanvas:true});
  const base=createCanvas(W,H),bc=base.getContext('2d'),out=createCanvas(W,H),ctx=out.getContext('2d');
  function draw(item){
    bc.clearRect(0,0,W,H);
    if(layers){
      bc.drawImage(layers.background,0,0);
      const [x,y,w,h,r]=layers.bannerRect;
      bc.save();rounded(bc,x,y,w,h,r);bc.clip();bc.drawImage(frames[item.index].image,x,y,w,h);bc.restore();
      bc.drawImage(layers.foreground,0,0);
    }else bc.drawImage(still,0,0);
    ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0);
    if(hasEffect)drawProfileEffect(ctx,appearance,item.phase,base);
    return out;
  }
  const steps=hasEffect?[40,50,70,100]:[40];
  for(const step of steps){
    const timeline=buildMotionTimeline(frames,hasEffect,step);
    let result;
    try{result=await optimizedGif(timeline,draw);}catch(error){
      console.warn('[animCard] FFmpeg indisponível; encoder nativo:',error?.message??error);
      result=nativeGif(timeline,draw);
    }
    if(result.length<=LIMIT)return result;
  }
  // If a very large native banner cannot fit, retain the source duration and
  // aggregate adjacent delays rather than slowing the original cycle.
  if(!hasEffect){
    for(const stride of [2,3,4]){
      const reduced=frames.filter((_,i)=>i%stride===0).map((_,i)=>({index:i*stride,phase:0,delayMs:frames.slice(i*stride,i*stride+stride).reduce((sum,f)=>sum+f.delayMs,0)}));
      let result;try{result=await optimizedGif(reduced,draw);}catch{result=nativeGif(reduced,draw);}
      if(result.length<=LIMIT)return result;
    }
  }
  throw Error('GIF de perfil excedeu 8 MB');
}

/**
 * Gera um GIF válido de um único frame para banners incompatíveis ou lentos.
 * Mesmo no fallback, o /perfil continua entregando GIF, nunca PNG.
 */
export async function generateStaticProfileGifCard(params) {
  const canvas = await generateProfileCard({
    ...params,
    _returnCanvas: true,
  });
  const gifBuffer = encodeCanvasAsGif(canvas);
  console.log(`[animCard] GIF estático de segurança pronto: ${(gifBuffer.length / 1024).toFixed(0)} KB`);
  return gifBuffer;
}
