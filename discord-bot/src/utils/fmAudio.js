import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { isVoiceConfigured, textToSpeech } from './voiceAiManager.js';

const localYtdlp=fileURLToPath(new URL('../../.venv/bin/yt-dlp',import.meta.url));
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
export function ytdlpExecutable(){return process.env.YT_DLP_PATH||(existsSync(localYtdlp)?localYtdlp:'yt-dlp');}
export async function readTrackMetadata(query){
  if(!validTrackUrl(query)&&!/^ytsearch1:[^\r\n]{1,250}$/.test(query))throw new Error('Fonte inválida.');
  const {stdout}=await promisify(execFile)(ytdlpExecutable(),[
    '--ignore-config','--no-playlist','--skip-download','--no-warnings','--socket-timeout','8',
    '--dump-single-json','--format','bestaudio/best','--',query,
  ],{timeout:18000,maxBuffer:2*1024*1024,killSignal:'SIGKILL'});
  const data=JSON.parse(stdout);
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
  const dl=makeProcess(ytdlpExecutable(),[
    '--ignore-config','--no-playlist','--no-warnings','--socket-timeout','15','--format','bestaudio/best','-o','-','--',url,
  ],['ignore','pipe','pipe']);
  const ff=ffmpeg('pipe:0');dl.stdout.pipe(ff.stdin);
  dl.on('close',()=>{try{ff.stdin.end();}catch{}});
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
