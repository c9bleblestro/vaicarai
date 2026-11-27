import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { isVoiceConfigured, textToSpeech } from './voiceAiManager.js';

const localYtdlp=fileURLToPath(new URL('../../.venv/bin/yt-dlp',import.meta.url));
export function validTrackUrl(value){
  try{const u=new URL(value);return u.protocol==='https:'&&['soundcloud.com','www.soundcloud.com','m.soundcloud.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&u.pathname.split('/').filter(Boolean).length>=2;}catch{return false;}
}
export function validQuery(value){
  const q=String(value??'').trim();
  if(!q||q.length>250)return false;
  if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(q))return !/[a-z][a-z0-9+.-]*:\/\//i.test(q);
  try{const u=new URL(q);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['soundcloud.com','www.soundcloud.com','m.soundcloud.com','youtube.com','www.youtube.com','m.youtube.com','youtu.be','open.spotify.com'].includes(u.hostname);}catch{return false;}
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
  const dl=makeProcess(process.env.YT_DLP_PATH||(existsSync(localYtdlp)?localYtdlp:'yt-dlp'),[
    '--no-playlist','--no-warnings','--socket-timeout','15','--format','bestaudio/best','-o','-','--',url,
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
