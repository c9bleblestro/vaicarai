import { trackPlatform, validQuery, validTrackUrl, readTrackMetadata } from './fmAudio.js';
import { searchSoundCloudCandidates } from './musicManager.js';

const clean=v=>String(v??'').trim();
const normalize=v=>clean(v).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const tokens=v=>normalize(v).split(/\s+/).filter(Boolean);
const meaningful=v=>tokens(v).filter(t=>!['official','audio','video','lyrics','lyric','hd','hq','topic','music','visualizer','oficial'].includes(t));
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
function score(query,track){
  const target=meaningful(query),candidate=meaningful(track.title+' '+track.uploader);
  if(!target.length||!versionMatches(query,track.title))return -1;
  if(!target.every(t=>candidate.includes(t)))return -1;
  return 100-(candidate.length-target.length)+ (normalize(query)===normalize(track.title)?20:0);
}
export function rankCandidates(query,tracks){
  return tracks.filter(t=>validTrackUrl(t.url)).map(t=>({track:t,score:score(query,t)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score).map(x=>x.track);
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
function deadline(p,ms){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tempo de busca excedido')),ms);})]).finally(()=>clearTimeout(timer));}
async function searchPlayable(query,{search,inspect}){
  let candidates=[];
  try{candidates=rankCandidates(query,await deadline(search(query),8000));}catch{}
  // Usa a faixa que passou pela verificação de correspondência, não o primeiro
  // resultado aleatório. Verifica disponibilidade e duração antes de enfileirar.
  for(const candidate of candidates.slice(0,1)){
    try{
      const info=await inspect(candidate.url);
      if(score(query,info)>=0)return info;
    }catch{}
  }
  try{
    const info=await inspect('ytsearch1:'+query);
    if(score(query,info)>=0)return info;
  }catch{}
  throw new Error('Não encontrei uma versão disponível que corresponda ao pedido. Tente nome + artista ou o link exato da faixa.');
}
export async function resolveFmTrack(query,deps={}){
  query=clean(query);
  if(!validQuery(query))throw new Error('Use nome + artista ou link de uma faixa individual do SoundCloud, YouTube ou Spotify.');
  const inspect=deps.inspect??readTrackMetadata,search=deps.search??searchSoundCloudCandidates,catalog=deps.catalog??catalogSearch,spotify=deps.spotify??spotifyInfo;
  const platform=trackPlatform(query);
  let track,requested;
  if(platform==='spotify'){
    requested=await spotify(query);
    track=await searchPlayable(requested.title+' '+requested.artist,{search,inspect});
  }else if(platform){
    try{track=await inspect(query);}catch{throw new Error('Essa faixa está indisponível para a rádio. Tente outro link público ou pesquise pelo nome e artista.');}
    // Links explícitos nunca são convertidos para um resultado de busca.
    if(trackPlatform(track.url)!==platform)throw new Error('Não consegui confirmar a fonte original dessa faixa.');
  }else{
    track=await searchPlayable(query,{search,inspect});
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
    platform:trackPlatform(track.url),
  };
}
