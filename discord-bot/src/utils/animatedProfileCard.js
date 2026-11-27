/**
 * animatedProfileCard.js
 * Gera um card de perfil GIF animado quando o banner do usuário é um GIF.
 * Usa @napi-rs/canvas (GifEncoder nativo) + gifuct-js para decodificar frames.
 */

import { GifEncoder, createCanvas, loadImage } from '@napi-rs/canvas';
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
async function fetchGifFrames(banner, maxFrames = 6) {
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
  const gif    = parseGIF(gifBuffer.buffer.slice(gifBuffer.byteOffset, gifBuffer.byteOffset + gifBuffer.byteLength));
  if(gifBuffer.length>8*1024*1024)throw new Error('GIF muito grande');

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

  // Amostragem: se o GIF tem muitos frames, pega 1 a cada N
  const step     = Math.max(1, Math.ceil(frames.length / maxFrames));
  const selected = [];
  const patchCanvas=createCanvas(gW,gH),patchCtx=patchCanvas.getContext('2d');

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // Compõe o patch deste frame no canvas acumulado
    const previous=frame.disposalType===3?compCtx.getImageData(0,0,gW,gH):null;
    const patchData=patchCtx.createImageData(frame.dims.width,frame.dims.height);
    patchData.data.set(frame.patch);
    patchCtx.clearRect(0,0,gW,gH);patchCtx.putImageData(patchData,0,0);
    compCtx.drawImage(patchCanvas,0,0,frame.dims.width,frame.dims.height,frame.dims.left,frame.dims.top,frame.dims.width,frame.dims.height);

    if (i % step === 0) {
      // Exporta o estado atual como PNG e recarrega como Image
      const pngBuf = compCanvas.toBuffer('image/png');
      const image  = await loadImage(pngBuf);
      const delay = Math.max(40, Math.min(6000, frames.slice(i,i+step).reduce((total,f)=>total+Math.max(20,f.delay??100),0))); // gifuct-js already returns ms
      selected.push({ image, delayMs: delay });
    }

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
export async function generateAnimatedProfileCard(params) {
  const { activeBanner, guildId, _resolvedBanner } = params;

  // Resolve o banner para checar se é GIF
  const banner = _resolvedBanner ?? await resolveBanner(
    activeBanner,
    guildId,
    { includeImageData: true },
  );
  const appearance=params.appearance?normalizeAppearance(params.appearance):{theme:'classic',effect:'banner'};
  const effect=appearance.effect;
  let gifFrames=[];
  if(isGifProfileBanner(banner)){
    try{gifFrames=await fetchGifFrames(banner,12);}catch(error){
      if(effect==='banner')throw error;
      console.warn('[animCard] Banner estático no efeito:',error?.message??error);
    }
  }
  const hasEffect=!['off','banner'].includes(effect);
  if(!gifFrames.length&&!hasEffect)throw new Error('Não há animação selecionada para este banner.');
  const count=hasEffect?12:gifFrames.length;
  const base=gifFrames.length?null:await generateProfileCard({...params,_resolvedBanner:banner,_returnCanvas:true});
  const bases=new Map();
  const encoder=new GifEncoder(W,H,{repeat:0,quality:8});
  try{
    for(let i=0;i<count;i++){
      const index=gifFrames.length?Math.floor(i*gifFrames.length/count):0;
      const f=gifFrames[index];
      if(f&&!bases.has(index))bases.set(index,await generateProfileCard({...params,_bannerImage:f.image,_resolvedBanner:banner,_returnCanvas:true}));
      const frame=createCanvas(W,H),ctx=frame.getContext('2d');
      ctx.drawImage(base??bases.get(index),0,0);
      if(hasEffect)drawProfileEffect(ctx,appearance,i/count);
      encoder.addFrame(new Uint8Array(ctx.getImageData(0,0,W,H).data.buffer),W,H,{delay:hasEffect?140:f.delayMs});
    }
    const result=encoder.finish();
    if(result.length>8*1024*1024)throw new Error('GIF de perfil excedeu 8 MB');
    return result;
  }finally{encoder.dispose();}
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
