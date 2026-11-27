import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { isVoiceConfigured, textToSpeech } from './voiceAiManager.js';

const localYtdlp=fileURLToPath(new URL('../../.venv/bin/yt-dlp',import.meta.url));
const vendorDir=fileURLToPath(new URL('../../vendor/fm-extractor/',import.meta.url));
const runFile=promisify(execFile);
const youtubeHosts=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be'];
const soundcloudHosts=['soundcloud.com','www.soundcloud.com','m.soundcloud.com'];
export function trackPlatform(value){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    const paths=u.pathname.split('/').filter(Boolean);
    if(soundcloudHosts.includes(u.hostname)&&paths.length===2&&paths[1]!=='sets')return 'soundcloud';
    if(youtubeHosts.includes(u.hostname)){
      const id=u.hostname==='youtu.be'?paths[0]:u.pathname==='/watch'?u.searchParams.get('v'):paths[0]==='shorts'?paths[1]:null;
      if(/^[a-zA-Z0-9_-]{11}$/.test(id??''))return 'youtube';
    }
    if(u.hostname==='open.spotify.com'&&paths[0]==='track'&&/^[a-zA-Z0-9]{22}$/.test(paths[1]??'')&&paths.length===2)return 'spotify';
  }catch{}
  return null;
}
export function validTrackUrl(value){return ['youtube','soundcloud'].includes(trackPlatform(value));}
export function validQuery(value){
  const q=String(value??'').trim();
  if(!q||q.length>250)return false;
  return /[a-z][a-z0-9+.-]*:\/\//i.test(q)?Boolean(trackPlatform(q)):true;
}
export function extractorInvocation(){
  if(process.env.YT_DLP_PATH?.trim())return {command:process.env.YT_DLP_PATH.trim(),prefix:[]};
  // Pure Python package copied into the deployed app, independent of venv shebangs.
  if(existsSync(vendorDir+'yt_dlp/__init__.py'))return {command:'python3',prefix:['-c','import sys; sys.path.insert(0, sys.argv.pop(1)); from yt_dlp import main; main()',vendorDir]};
  return {command:existsSync(localYtdlp)?localYtdlp:'yt-dlp',prefix:[]};
}
export function ytdlpExecutable(){return extractorInvocation().command;}
export function extractorFailure(error){
  const detail=String(error?.stderr||error?.message||'').toLowerCase();
  if(error?.code==='ENOENT'||/no module named yt_dlp|bad interpreter/.test(detail))return 'EXTRACTOR_MISSING';
  if(error?.killed||error?.code==='ETIMEDOUT'||/timed out|timeout/.test(detail))return 'SOURCE_TIMEOUT';
  if(/sign in|log in|not a bot|http error (403|429)|too many requests|login required|authentication/.test(detail))return 'SOURCE_RESTRICTED';
  if(/no video formats|requested format is not available|no supported javascript runtime/.test(detail))return 'FORMAT_UNAVAILABLE';
  return 'SOURCE_UNAVAILABLE';
}
export function fmSourceError(code){
  const messages={
    EXTRACTOR_MISSING:'O reprodutor de músicas não está instalado no ambiente da rádio. A administração pode conferir /fm diagnostico.',
    SOURCE_TIMEOUT:'A fonte de áudio demorou demais para responder. Tente novamente.',
    SOURCE_RESTRICTED:'A plataforma não autorizou a reprodução pelo servidor. Tente uma versão pública no SoundCloud.',
    FORMAT_UNAVAILABLE:'A fonte não forneceu um formato de áudio compatível.',
    SOURCE_UNAVAILABLE:'Essa faixa está indisponível para a rádio. Tente outro link público ou pesquise pelo nome e artista.',
  };
  const e=new Error(messages[code]||messages.SOURCE_UNAVAILABLE);e.code=code;return e;
}
export async function checkFmRuntime(){
  const {command,prefix}=extractorInvocation();
  const checks=await Promise.allSettled([
    runFile(command,[...prefix,'--version'],{timeout:5000,maxBuffer:65536}),
    runFile(process.env.FFMPEG_PATH||'ffmpeg',['-version'],{timeout:5000,maxBuffer:65536}),
  ]);
  return {extractor:checks[0].status==='fulfilled'?checks[0].value.stdout.trim().slice(0,80):null,
    ffmpeg:checks[1].status==='fulfilled'?checks[1].value.stdout.split('\n')[0].slice(0,100):null};
}
// Search metadata separately from audio extraction: one unavailable video must not
// abort the entire result list. Only individual, public track URLs are returned.
export async function discoverFmTracks(query,platform,limit=15){
  if(!['soundcloud','youtube'].includes(platform)||!validQuery(query)||trackPlatform(query))return [];
  const q=query.trim().replace(/[\r\n]/g,' ');
  const count=Math.max(1,Math.min(20,Math.floor(limit)));
  const {command,prefix}=extractorInvocation();
  let stdout;
  try{
    ({stdout}=await runFile(command,[...prefix,'--ignore-config','--flat-playlist','--skip-download','--no-warnings','--socket-timeout','8','--js-runtimes','node','--dump-single-json','--', (platform==='soundcloud'?'scsearch':'ytsearch')+count+':'+q],{timeout:14000,maxBuffer:4*1024*1024,killSignal:'SIGKILL'}));
  }catch(error){const code=extractorFailure(error);console.warn('[FM SEARCH]',platform,code);throw fmSourceError(code);}
  const result=JSON.parse(stdout);
  return (result.entries??[]).map(entry=>{
    const raw=entry.webpage_url||entry.url;
    const url=platform==='youtube'&&/^[a-zA-Z0-9_-]{11}$/.test(raw??'')?'https://www.youtube.com/watch?v='+raw:raw;
    return {url,title:entry.track||entry.title,uploader:entry.artist||entry.uploader||entry.channel||'',durationSeconds:Number(entry.duration)||0,thumbnail:entry.thumbnail||null,platform};
  }).filter(t=>trackPlatform(t.url)===platform&&t.title&&t.durationSeconds<=900);
}
export async function readTrackMetadata(query){
  if(!validTrackUrl(query)&&!/^ytsearch1:[^\r\n]{1,250}$/.test(query))throw new Error('Fonte inválida.');
  const {command,prefix}=extractorInvocation();
  let stdout;
  try{
    ({stdout}=await runFile(command,[...prefix,
      '--ignore-config','--no-playlist','--skip-download','--no-warnings','--socket-timeout','8',
      '--js-runtimes','node','--dump-single-json','--format','bestaudio/best','--',query,
    ],{timeout:18000,maxBuffer:4*1024*1024,killSignal:'SIGKILL'}));
  }catch(error){
    const code=extractorFailure(error);console.warn('[FM METADATA]',trackPlatform(query)||'search',code);throw fmSourceError(code);
  }
  let data;try{data=JSON.parse(stdout);}catch{throw fmSourceError('SOURCE_UNAVAILABLE');}
  const track=Array.isArray(data.entries)?data.entries[0]:data;
  if(!track||!validTrackUrl(track.webpage_url)||track.is_live||track.live_status==='is_live'||track.availability==='private'||track.availability==='subscriber_only'||track.availability==='premium_only'||track.availability==='needs_auth')throw new Error('Faixa indisponível para reprodução.');
  const seconds=Math.floor(Number(track.duration)||0);
  if(seconds<=0||seconds>900)throw new Error('Escolha uma faixa de até 15 minutos.');
  return {title:track.track||track.title,uploader:track.artist||track.creator||track.uploader||'',album:track.album||null,
    duration:Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'),durationSeconds:seconds,
    thumbnail:track.thumbnail||null,url:track.webpage_url,platform:trackPlatform(track.webpage_url)};
}
function makeProcess(command,args,stdio){
  const p=spawn(command,args,{stdio});
  p.on('error',()=>{});
  p.stderr?.on('data',()=>{});
  p.stdout?.on('error',()=>{});
  p.stdin?.on('error',()=>{});
  return p;
}
function ffmpeg(input,live=false){
  return makeProcess(process.env.FFMPEG_PATH||'ffmpeg',[
    '-hide_banner','-loglevel','error',
    ...(live?['-rw_timeout','15000000','-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5']:[]),
    '-i',input,'-vn','-c:a','libopus','-b:a','96k','-ar','48000','-ac','2','-f','ogg','pipe:1',
  ],[input==='pipe:0'?'pipe':'ignore','pipe','pipe']);
}
function managed(proc,children=[]){
  return {resource:createAudioResource(proc.stdout,{inputType:StreamType.OggOpus}),
    close(){for(const p of [proc,...children])try{p.kill('SIGKILL');}catch{}}
  };
}
export function openStation(url){return managed(ffmpeg(url,true));}
export function openTrack(url){
  if(!validTrackUrl(url))throw new Error('Fonte de áudio não compatível.');
  const {command,prefix}=extractorInvocation();
  const dl=makeProcess(command,[...prefix,
    '--ignore-config','--no-playlist','--no-warnings','--socket-timeout','15','--js-runtimes','node','--format','bestaudio/best','-o','-','--',url,
  ],['ignore','pipe','pipe']);
  const ff=ffmpeg('pipe:0');dl.stdout.pipe(ff.stdin);
  let diagnostic='';dl.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk.toString()).slice(-4096);});
  dl.on('error',e=>console.warn('[FM AUDIO]',extractorFailure(e)));
  dl.on('close',code=>{if(code&&code!==null)console.warn('[FM AUDIO]',trackPlatform(url),extractorFailure({stderr:diagnostic}));try{ff.stdin.end();}catch{}});
  return managed(ff,[dl]);
}
export function speechText(item){
  const clean=v=>String(v??'').replace(/https?:\/\/\S+|<[^>]*>/g,'').replace(/[\x00-\x1f*_~`#]/g,' ').trim().slice(0,240);
  const title=clean(item.track.title),sender=item.anonymous?'Uma pessoa anônima':clean(item.requesterName)||'Um ouvinte';
  return item.recipientName
    ? 'Você está na Substancy FM. '+sender+' dedica '+title+' para '+clean(item.recipientName)+'. '+clean(item.message)
    : 'Substancy FM. Agora, '+title+', um pedido de '+sender+'.';
}
function deadline(p,ms){
  let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tempo de voz excedido')),ms);})]).finally(()=>clearTimeout(timer));
}
export async function openAnnouncement(text){
  if(isVoiceConfigured()){
    try{
      const audio=await deadline(textToSpeech(text),18000);
      const ff=ffmpeg('pipe:0');ff.stdin.end(audio);return managed(ff);
    }catch(error){console.warn('[FM] Locução principal indisponível:',error?.code??'erro');}
  }
  // Fallback local, já instalado no Railway: sem chave ou serviço externo.
  const speech=makeProcess('espeak-ng',['-v','pt-br','-s','155','--stdout','--stdin'],['pipe','pipe','pipe']);
  const ff=ffmpeg('pipe:0');speech.stdout.pipe(ff.stdin);speech.stdin.end(text);
  return managed(ff,[speech]);
}
