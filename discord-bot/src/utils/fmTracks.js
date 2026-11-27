import { trackPlatform, validQuery, validTrackUrl, readTrackMetadata, fmSourceError, discoverFmTracks } from './fmAudio.js';
import { searchSoundCloudCandidates } from './musicManager.js';

const clean=v=>String(v??'').trim();
const normalize=v=>clean(v).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const tokens=v=>normalize(v).split(/\s+/).filter(Boolean);
const meaningful=v=>tokens(v).filter(t=>!['official','audio','video','lyrics','lyric','hd','hq','topic','music','visualizer','oficial','clipe','feat','ft','letra'].includes(t));
const contains=(value,part)=>(' '+normalize(value)+' ').includes(' '+normalize(part)+' ');
const versions=/\b(remix|cover|karaoke|sped up|slowed|nightcore|instrumental|live|acoustic|ao vivo|acustico|mashup|reverb)\b/;
const versionMatches=(target,candidate)=>{
  const found=normalize(candidate).match(versions)?.[0];
  return !found||contains(target,found);
};
export function safeArtworkUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.href.length<=2048?u.href:null;}catch{return null;}
}
function coverSize(value){
  const url=safeArtworkUrl(value);if(!url)return null;
  const u=new URL(url);
  if(u.hostname.endsWith('.mzstatic.com'))u.pathname=u.pathname.replace(/\d+x\d+bb(?=\.)/,'600x600bb');
  if(u.hostname.endsWith('.sndcdn.com'))u.pathname=u.pathname.replace(/-(?:large|t\d+x\d+)(?=\.)/,'-t500x500');
  return u.href;
}
async function json(url){
  const r=await fetch(url,{signal:AbortSignal.timeout(6500),redirect:'error'});
  if(!r.ok)throw new Error('Metadados indisponíveis.');
  return r.json();
}
async function catalogSearch(query){
  const url=new URL('https://itunes.apple.com/search');
  url.search=new URLSearchParams({term:query,entity:'song',country:'BR',limit:'20'});
  return (await json(url)).results??[];
}
export function matchCatalog(results,track){
  const title=normalize(track.title),artist=normalize(track.uploader);
  if(!title||!artist)return null;
  return results.find(r=>{
    const t=normalize(r.trackName),a=normalize(r.artistName);
    if(!t||!a||!versionMatches(title,r.trackName)||!versionMatches(t,track.title))return false;
    // A capa só entra se faixa E artista forem compatíveis com a fonte tocada.
    const titleOk=title===t||(contains(title,t)&&meaningful(track.title).every(w=>tokens(t+' '+a).includes(w)||['feat','ft','ft.','ft','official','audio','video'].includes(w)));
    const artistOk=artist===a||contains(artist,a)||(contains(title,a)&&contains(title,t));
    return titleOk&&artistOk;
  })??null;
}
function editDistance(a,b){
  if(Math.abs(a.length-b.length)>2)return 3;
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];
    for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1]));
    row=next;
  }return row[b.length];
}
function similarity(a,b){
  if(a===b)return 1;
  if(a.length>=3&&b.startsWith(a))return .78;
  if(a.length>=4&&b.length>=4&&editDistance(a,b)<=(a.length>=7?2:1))return .72;
  return 0;
}
export function candidateScore(query,track){
  const target=[...new Set(meaningful(query))],title=meaningful(track.title),artist=meaningful(track.uploader),candidate=[...new Set([...title,...artist])];
  if(!target.length||!candidate.length||!versionMatches(query,track.title))return -1;
  const matches=target.map(t=>Math.max(0,...candidate.map(c=>similarity(t,c))));
  const coverage=matches.reduce((a,b)=>a+b,0)/target.length;
  if(coverage<.64||!target.some(t=>title.some(c=>similarity(t,c)>0)))return -1;
  const exact=matches.every(m=>m===1);
  const titleMatches=target.filter(t=>title.includes(t)).length;
  return Math.round(coverage*100)+(exact?35:0)+(normalize(query)===normalize(track.title)?25:0)+(titleMatches?8:0)-Math.min(15,Math.max(0,candidate.length-target.length));
}
function strictMatch(query,track){
  const target=meaningful(query),all=meaningful(track.title+' '+track.uploader);
  return target.length>0&&versionMatches(query,track.title)&&target.every(t=>all.includes(t));
}
export function rankCandidates(query,tracks){
  const unique=new Map();
  for(const t of tracks??[])if(validTrackUrl(t?.url)&&t.title&&!unique.has(t.url))unique.set(t.url,t);
  return [...unique.values()].map(t=>({track:t,score:candidateScore(query,t)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.track);
}
async function spotifyInfo(url){
  const data=await json('https://open.spotify.com/oembed?url='+encodeURIComponent(url));
  if(!clean(data.title))throw new Error('Não consegui identificar a faixa do Spotify.');
  // A API oEmbed nem sempre fornece o artista. Se não fornecer, a página pública
  // de faixa pode fornecer a identificação no título de compartilhamento.
  let title=clean(data.title),artist=clean(data.author_name);
  if(!artist||normalize(artist)==='spotify'){
    artist='';
    try{
      const page=await fetch(url,{signal:AbortSignal.timeout(6500),redirect:'error'});
      if(page.ok){
        const html=(await page.text()).slice(0,1000000);
        const raw=html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1]??html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i)?.[1];
        const desc=raw?.replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&middot;|&#183;/g,'·');
        if(desc?.includes('·'))artist=clean(desc.split('·')[0]);
        if(!artist){
          const tag=html.match(/<title>([^<]+)<\/title>/i)?.[1]??'';
          const m=tag.match(/^(.*?)\s+-\s+song(?: and lyrics)? by (.*?)\s*\|\s*Spotify/i);
          if(m){title=clean(m[1]);artist=clean(m[2]);}
        }
      }
    }catch{}
  }
  if(!artist)throw new Error('O Spotify não informou o artista. Pesquise pelo nome da música e do cantor ou envie um link do YouTube/SoundCloud.');
  return {title,artist,artwork:safeArtworkUrl(data.thumbnail_url)};
}
async function youtubeInfo(url){
  const d=await json('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(url));
  const title=clean(d.title),artist=clean(d.author_name).replace(/\s+-\s+Topic$/i,'');
  if(!title||!artist)throw new Error('Não consegui identificar o vídeo.');
  return {title,artist,artwork:safeArtworkUrl(d.thumbnail_url)};
}
function deadline(p,ms){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tempo de busca excedido')),ms);})]).finally(()=>clearTimeout(timer));}
function suggestionError(tracks){
  const e=new Error('Encontrei algumas versões próximas. Escolha a música correta no menu.');
  e.code='FM_CHOOSE_TRACK';e.suggestions=tracks.slice(0,5);return e;
}
async function searchPlayable(query,{search,inspect,discover,catalog,onlySoundCloud=false,strict=false}){
  let failure=null;
  const variants=[query];
  const simplified=meaningful(query).join(' ');
  if(simplified&&normalize(query)!==simplified)variants.push(simplified);
  const discoverFor=q=>Promise.allSettled([
    deadline(search(q,15),9000),
    ...(discover?[discover(q,'soundcloud',15),...(!onlySoundCloud?[discover(q,'youtube',15)]:[])]:[]),
  ]);
  const results=await discoverFor(variants[0]);
  let candidates=[];
  for(const result of results){if(result.status==='fulfilled')candidates.push(...(result.value??[]));else failure=result.reason;}
  // Catalog is metadata only. It can identify a misspelled title or missing artist.
  // Don't assume the catalog result is playable.
  if(discover&&catalog){
    try{
      const metadata=await deadline(catalog(query),6500);
      for(const t of metadata.slice(0,2)){
        const full=clean(t.trackName)+' '+clean(t.artistName);
        if(candidateScore(query,{title:t.trackName,uploader:t.artistName})>=90&&!variants.some(v=>normalize(v)===normalize(full)))variants.push(full);
      }
    }catch{}
  }
  const accepted=[],nearby=[],visited=new Set();
  const inspectBatch=async(list)=>{
    const ranked=rankCandidates(query,list).filter(t=>!visited.has(t.url)&&(!onlySoundCloud||trackPlatform(t.url)==='soundcloud')).slice(0,8);
    // Limit concurrency; never inspect a whole playlist or dozens of tracks at once.
    for(let i=0;i<ranked.length;i+=4){
      const batch=ranked.slice(i,i+4);
      batch.forEach(t=>visited.add(t.url));
      const checked=await Promise.allSettled(batch.map(t=>inspect(t.url)));
      for(const result of checked){
        if(result.status==='rejected'){failure=result.reason;continue;}
        const t=result.value;
        if(!validTrackUrl(t?.url)||onlySoundCloud&&trackPlatform(t.url)!=='soundcloud'||candidateScore(query,t)<0)continue;
        if(strictMatch(query,t))accepted.push(t);
        else if(!strict)nearby.push(t);
      }
      if(accepted.length)break;
    }
  };
  await inspectBatch(candidates);
  if(!accepted.length&&discover&&variants.length>1){
    // One additional focused search, rather than unlimited retries.
    const next=await discoverFor(variants.at(-1));
    for(const r of next){if(r.status==='fulfilled')candidates.push(...(r.value??[]));else failure=r.reason;}
    await inspectBatch(candidates);
  }
  if(accepted.length){
    const ranked=rankCandidates(query,accepted);
    // Exact titles shared by different artists are ambiguous. Let the listener decide.
    const top=ranked[0];
    const ambiguous=!strict&&ranked.filter(t=>normalize(t.title)===normalize(top.title)&&normalize(t.uploader)!==normalize(top.uploader));
    if(ambiguous?.length)throw suggestionError([top,...ambiguous]);
    return top;
  }
  // Compatibility for callers with an injected old search adapter (tests).
  if(!discover&&!onlySoundCloud){
    try{const info=await inspect('ytsearch1:'+query);if(strictMatch(query,info)&&validTrackUrl(info.url))return info;}catch(error){failure=error;}
  }
  if(nearby.length&&!strict)throw suggestionError(rankCandidates(query,nearby));
  if(failure?.code==='EXTRACTOR_MISSING')throw failure;
  throw new Error('Não encontrei uma faixa pública reproduzível que corresponda ao pedido. Tente outro nome ou artista.');
}
function youtubeSearchQuery(meta){
  const title=clean(meta.title).replace(/\s*[\[(](?:official (?:music )?video|official audio|lyric(?:s| video)?|clipe oficial|audio oficial|visualizer)[\])]\s*/gi,' ').trim();
  const artist=clean(meta.artist).replace(/VEVO$/i,'').replace(/\s+-\s+Topic$/i,'').trim();
  // Music videos commonly encode artist and track in the title; uploader may be a label.
  if(/\s[-–—|]\s/.test(title))return title;
  return artist&&contains(title,artist)?title:(title+' '+artist).trim();
}
export async function resolveFmTrack(query,deps={}){
  query=clean(query);
  if(!validQuery(query))throw new Error('Use nome + artista ou link de uma faixa individual do SoundCloud, YouTube ou Spotify.');
  const inspect=deps.inspect??readTrackMetadata,search=deps.search??searchSoundCloudCandidates,catalog=deps.catalog??catalogSearch,spotify=deps.spotify??spotifyInfo;
  const platform=trackPlatform(query);
  const discover=deps.discover??(deps.search?null:discoverFmTracks);
  let track,requested,sourceFallback=false;
  if(platform==='spotify'){
    requested=await spotify(query);
    track=await searchPlayable(requested.title+' '+requested.artist,{search,inspect,discover,catalog,strict:true});
  }else if(platform){
    try{track=await inspect(query);}
    catch(error){
      if(error?.code==='EXTRACTOR_MISSING')throw error;
      if(platform!=='youtube')throw error?.code?error:fmSourceError('SOURCE_UNAVAILABLE');
      // Se a fonte não liberar o áudio, consultar apenas os metadados públicos
      // e procurar outra publicação compatível. Não tenta contornar o bloqueio.
      try{
        const meta=await (deps.youtube??youtubeInfo)(query);
        track=await searchPlayable(youtubeSearchQuery(meta),{search,inspect,discover,catalog,onlySoundCloud:true,strict:true});
        sourceFallback=true;
      }catch(fallbackError){
        if(fallbackError?.code==='EXTRACTOR_MISSING')throw fallbackError;
        if(error?.code==='SOURCE_RESTRICTED')throw Object.assign(new Error('O YouTube bloqueou o áudio e não encontrei uma versão pública correspondente no SoundCloud. Pesquise pelo título ou artista para ver alternativas.'),{code:error.code});
        throw error?.code?error:fmSourceError('SOURCE_UNAVAILABLE');
      }
    }
    if(!sourceFallback&&trackPlatform(track.url)!==platform)throw new Error('Não consegui confirmar a fonte original dessa faixa.');
  }else{
    track=await searchPlayable(query,{search,inspect,discover,catalog});
  }
  if(!validTrackUrl(track.url))throw new Error('Fonte de áudio incompatível.');
  let album=null;
  try{album=matchCatalog(await deadline(catalog((requested?.title??track.title)+' '+(requested?.artist??track.uploader)),6500),{title:requested?.title??track.title,uploader:requested?.artist??track.uploader});}catch{}
  const artwork=coverSize(requested?.artwork)||coverSize(album?.artworkUrl100)||coverSize(track.thumbnail);
  return {...track,
    title:requested?.title??album?.trackName??track.title,
    uploader:requested?.artist??album?.artistName??track.uploader,
    album:album?.collectionName??track.album??null,
    artwork,thumbnail:safeArtworkUrl(track.thumbnail),
    platform:trackPlatform(track.url),sourceFallback,requestedPlatform:platform,
  };
}
