import { randomUUID } from 'node:crypto';
import {
  createAudioPlayer, AudioPlayerStatus, joinVoiceChannel, getVoiceConnection,
  VoiceConnectionStatus, entersState,
} from '@discordjs/voice';
import {
  ChannelType, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder,
  SectionBuilder, ThumbnailBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, escapeMarkdown,
} from 'discord.js';
import prisma from '../database/client.js';
import { PLAYLISTS, radioSessions } from './radioManager.js';
import { getTrackInfo, musicSessions } from './musicManager.js';
import { isFmVoiceReserved, reserveFmVoice, releaseFmVoice } from './fmVoiceGuard.js';
import { validQuery, validTrackUrl, openStation, openTrack, openAnnouncement, speechText } from './fmAudio.js';

export const fmSessions=new Map();
export const MAX_QUEUE=25, MAX_USER_QUEUE=3;
export const STATIONS={auto:'Programação automática',...Object.fromEntries(Object.entries(PLAYLISTS).map(([k,v])=>[k,v.name]))};
const hourFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'});
export function scheduledStation(date=new Date()){
  const h=Number(hourFormatter.format(date));
  return h<6?'lofi':h<12?'pop':h<18?'hiphop':h<22?'soul':'chill';
}
export function stationKey(mode,date=new Date()){return mode==='auto'||!PLAYLISTS[mode]?scheduledStation(date):mode;}
export function rankQueue(queue){
  return [...queue].sort((a,b)=>(b.votes?.length??0)-(a.votes?.length??0)||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
}
export function toggleQueueVote(queue,id,userId){
  if(!queue.some(x=>x.id===id))throw new Error('Esse pedido não está mais na fila.');
  return queue.map(x=>x.id!==id?x:{...x,votes:x.votes.includes(userId)?x.votes.filter(v=>v!==userId):[...x.votes,userId]});
}
export function checkQueueLimit(queue,userId){
  if(queue.length>=MAX_QUEUE)throw new Error('A fila está cheia. Aguarde uma faixa terminar.');
  if(queue.filter(x=>x.requesterId===userId).length>=MAX_USER_QUEUE)throw new Error('Você já tem três pedidos na fila.');
}
const clip=(s,n=150)=>String(s??'').slice(0,n);
const md=(s,n=150)=>clip(escapeMarkdown(clip(s,n)),n);
const durationSeconds=s=>{
  const parts=String(s??'').split(':');
  return parts.length>=2&&parts.length<=3&&parts.every(x=>/^\d+$/.test(x))?parts.reduce((v,x)=>v*60+Number(x),0):0;
};
const time=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function timeout(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('A busca demorou demais. Tente novamente.')),ms);})]).finally(()=>clearTimeout(timer));}
export function canDj(member,roleId){
  return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild)||roleId&&(member?.roles?.cache?.has(roleId)||Array.isArray(member?.roles)&&member.roles.includes(roleId)));
}
export function safeDedication(item){
  return {from:item.anonymous?'Anônimo':item.requesterName,to:item.recipientName,message:item.message};
}
const row=(...buttons)=>new ActionRowBuilder().addComponents(...buttons);
const button=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId('fm:'+id).setLabel(label).setStyle(style);
const text=t=>new TextDisplayBuilder().setContent(t);
export function buildFmPanel(session){
  const item=session.current, track=item?.track;
  const station=PLAYLISTS[session.liveKey||stationKey(session.config.station)];
  const actualPlaying=session.player.state.status===AudioPlayerStatus.Playing;
  const status=session.stopped?'⚫ Encerrada':session.paused?'⏸ Pausada':actualPlaying?'🔴 Ao vivo':session.lastError?'🟠 Reconectando fonte':'🟡 Preparando áudio';
  const listeners=session.voiceChannel.members?.filter(m=>!m.user.bot).size??0;
  const c=new ContainerBuilder().addTextDisplayComponents(text('## ♫  Substancy FM\n-# '+status+' • '+listeners+' ouvinte(s) • <#'+session.config.voiceChannelId+'>'));
  c.addSeparatorComponents(new SeparatorBuilder());
  const total=durationSeconds(track?.duration), elapsed=Math.floor((session.player.state.resource?.playbackDuration??0)/1000);
  const ratio=total>0&&session.phase==='track'?Math.min(1,elapsed/total):0;
  const filled=Math.round(ratio*14);
  const details=item
    ? '-# '+(session.phase==='announcement'?'LOCUÇÃO • PRÓXIMA MÚSICA':'PEDIDO DA COMUNIDADE')+'\n**'+md(track.title,180)+'**\n'+md(track.uploader||'SoundCloud',120)+'\n'+(total?'\n'+(session.phase==='track'?'▰'.repeat(filled)+'▱'.repeat(14-filled)+'  '+time(Math.min(elapsed,total))+' / '+track.duration:'Duração: '+track.duration):'')
    : '-# PROGRAMAÇÃO AO VIVO\n**'+md(station?.name||'Substancy FM')+'**\n'+md(station?.genre||'Programação contínua')+'\n-# Transmissão de estação • faixas individuais não identificadas';
  const thumb=track?.thumbnail;
  if(typeof thumb==='string'&&/^https:\/\//.test(thumb)){
    c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(details)).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb)));
  }else c.addTextDisplayComponents(text(details));
  if(item){
    const d=safeDedication(item);
    c.addSeparatorComponents(new SeparatorBuilder());
    c.addTextDisplayComponents(text(d.to?'### 💌 Dedicatória\n**De:** '+md(d.from,80)+'\n**Para:** '+md(d.to,80)+'\n> '+md(d.message||'Uma música especial para você.',240):'🎧 Pedido de **'+md(d.from,80)+'**'));
  }
  const queue=rankQueue(session.queue);
  c.addSeparatorComponents(new SeparatorBuilder());
  c.addTextDisplayComponents(text('**Na fila** · '+queue.length+' pedido(s)\n'+(queue.slice(0,3).map((x,i)=>(i+1)+'. '+md(x.track.title,80)+' · '+x.votes.length+' voto(s)').join('\n')||'Nenhum pedido. Escolha a próxima música!')+'\n-# '+md(STATIONS[session.config.station]||STATIONS.auto)+' • DJ: '+(session.config.djRoleId?'<@&'+session.config.djRoleId+'>':'Administração')));
  const publicButtons=row(
    button('request','Pedir música',ButtonStyle.Primary),
    button('dedicate','Dedicar'),
    button('anonymous','Anônima'),
    button('queue','Fila / votar'),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Entrar na rádio').setURL('https://discord.com/channels/'+session.config.guildId+'/'+session.config.voiceChannelId),
  );
  if(session.stopped)for(const b of publicButtons.components.slice(0,4))b.setDisabled(true);
  const djButtons=row(button('toggle',session.paused?'Continuar':'Pausar').setDisabled(session.stopped),button('skip','Pular').setDisabled(session.stopped),button('stop','Encerrar',ButtonStyle.Danger).setDisabled(session.stopped));
  return {components:[c,publicButtons,djButtons],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}

export class CommunityRadioSession {
  constructor({guild,voiceChannel,textChannel,connection,config,panel,db=prisma}){
    Object.assign(this,{guild,voiceChannel,textChannel,connection,config,panel,db});
    this.queue=Array.isArray(config.queue)?config.queue:[];this.player=createAudioPlayer();this.current=null;this.phase='station';
    this.stopped=false;this.paused=false;this.lastError='';this.skipCurrent=false;this.liveKey=null;this.pending=Promise.resolve();this.requesting=new Set();this.requestTimes=new Map();
    this.player.on('error',error=>console.warn('[FM] Player:',error?.code??error?.message??error));
    connection.subscribe(this.player);
  }
  start(){
    this.refresh();
    this.timer=setInterval(()=>{
      if(this.phase==='station'&&this.liveKey&&stationKey(this.config.station)!==this.liveKey)this.interrupt('schedule');
      this.refresh();
    },15000);
    this.timer.unref?.();
    this.run().catch(error=>{
      console.warn('[FM] Sessão:',error?.message??error);this.stop().catch(()=>{});
    });
  }
  async refresh(){
    if(!this.panel||this.refreshing)return;
    this.refreshing=true;
    try{await this.panel.edit(buildFmPanel(this));}
    catch(error){
      if(Number(error?.code)===10008&&!this.stopped){
        try{
          this.panel=await this.textChannel.send(buildFmPanel(this));
          this.config.panelMessageId=this.panel.id;
          await this.db.communityRadio.update({where:{guildId:this.guild.id},data:{panelMessageId:this.panel.id}});
        }catch(e){console.warn('[FM] Novo painel:',e?.code??e?.message??e);}
      }else console.warn('[FM] Painel:',error?.code??error?.message??error);
    }
    finally{this.refreshing=false;}
  }
  mutateQueue(fn){
    const op=this.pending.then(async()=>{
      if(this.stopped)throw new Error('A rádio foi encerrada.');
      const {queue,value}=fn(this.queue);
      await this.db.communityRadio.update({where:{guildId:this.guild.id},data:{queue}});
      this.queue=queue;return value;
    });
    this.pending=op.catch(()=>{});
    return op;
  }
  async request({userId,name,query,recipientName=null,message='',anonymous=false}){
    if(!validQuery(query))throw new Error('Use um nome ou link HTTPS do SoundCloud, YouTube ou Spotify.');
    checkQueueLimit(this.queue,userId);
    if(this.requesting.has(userId)||Date.now()-(this.requestTimes.get(userId)??0)<10000)throw new Error('Aguarde alguns segundos entre os pedidos.');
    if(this.requesting.size>=5)throw new Error('Muitos pedidos simultâneos. Tente novamente.');
    this.requesting.add(userId);this.requestTimes.set(userId,Date.now());
    if(this.requestTimes.size>1000)for(const [id,t] of this.requestTimes)if(Date.now()-t>60000)this.requestTimes.delete(id);
    try{
      let info;
      try{info=await timeout(getTrackInfo(query.trim()),25000);}catch{throw new Error('Não encontrei uma faixa disponível. Tente outro nome ou link.');}
      if(!validTrackUrl(info.url))throw new Error('A busca não retornou uma fonte de áudio compatível.');
      if(durationSeconds(info.duration)>900)throw new Error('Escolha uma faixa de até 15 minutos.');
      const item={id:randomUUID(),requesterId:userId,requesterName:clip(name,80),recipientName:recipientName?clip(recipientName,80):null,
        anonymous:Boolean(anonymous),message:clip(message,240),createdAt:Date.now(),votes:[],
        track:{title:clip(info.title||'Música',180),uploader:clip(info.uploader||'SoundCloud',120),duration:clip(info.duration,20),thumbnail:info.thumbnail||null,url:info.url}};
      await this.mutateQueue(q=>{checkQueueLimit(q,userId);return {queue:[...q,item],value:item};});
      if(this.phase==='station')this.interrupt('request');
      this.refresh();return item;
    }finally{this.requesting.delete(userId);}
  }
  async vote(id,userId){
    await this.mutateQueue(q=>({queue:toggleQueueVote(q,id,userId)}));this.refresh();
  }
  async remove(id){
    await this.mutateQueue(q=>{if(!q.some(x=>x.id===id))throw new Error('Pedido não encontrado.');return {queue:q.filter(x=>x.id!==id)};});this.refresh();
  }
  async next(){
    if(!this.queue.length)return null;
    return this.mutateQueue(q=>{
      const item=rankQueue(q)[0];return {queue:item?q.filter(x=>x.id!==item.id):q,value:item??null};
    });
  }
  interrupt(reason){this.finishPlayback?.(reason);}
  skip(){this.skipCurrent=true;this.interrupt('skip');}
  toggle(){
    if(this.paused){this.player.unpause();this.paused=false;}
    else if(this.player.pause())this.paused=true;
    this.refresh();return this.paused;
  }
  async changeStation(station){
    if(!Object.hasOwn(STATIONS,station))throw new Error('Estação inválida.');
    await this.db.communityRadio.update({where:{guildId:this.guild.id},data:{station}});
    this.config.station=station;
    if(this.phase==='station')this.interrupt('schedule');
    this.refresh();
  }
  async playManaged(opened,maxMs=0){
    if(this.stopped||this.skipCurrent){opened.close();return 'skip';}
    this.paused=false;
    return new Promise(resolve=>{
      let settled=false,playing=false,startTimer,maxTimer;
      const cleanup=reason=>{
        if(settled)return;settled=true;
        clearTimeout(startTimer);clearTimeout(maxTimer);
        this.player.off('stateChange',onState);this.player.off('error',onError);
        this.finishPlayback=null;
        try{this.player.stop(true);}catch{}
        opened.close();this.paused=false;resolve(reason);
      };
      const onState=(old,next)=>{
        if(next.status===AudioPlayerStatus.Playing){
          if(!playing){playing=true;clearTimeout(startTimer);this.lastError='';this.refresh();}
        }
        if(next.status===AudioPlayerStatus.Idle&&old.status!==AudioPlayerStatus.Idle)cleanup(playing?'ended':'failed');
      };
      const onError=()=>cleanup('failed');
      this.finishPlayback=cleanup;
      this.player.on('stateChange',onState);this.player.on('error',onError);
      startTimer=setTimeout(()=>cleanup('failed'),25000);
      if(maxMs)maxTimer=setTimeout(()=>cleanup('limit'),maxMs);
      try{this.player.play(opened.resource);}catch{cleanup('failed');}
    });
  }
  async run(){
    while(!this.stopped){
      this.skipCurrent=false;this.current=await this.next();
      if(this.stopped)break;
      if(this.current){
        this.phase='announcement';this.lastError='';this.refresh();
        try{
          const speech=await openAnnouncement(speechText(this.current));
          if(!this.stopped&&!this.skipCurrent)await this.playManaged(speech,45000);else speech.close();
        }catch(error){console.warn('[FM] Locução:',error?.code??'erro');}
        if(!this.stopped&&!this.skipCurrent){
          this.phase='track';this.refresh();
          let outcome='failed';try{outcome=await this.playManaged(openTrack(this.current.track.url),16*60000);}catch(error){console.warn('[FM] Faixa:',error?.message??error);}
          if(outcome==='failed'&&!this.stopped){
            await this.textChannel.send({content:'⚠️ Não foi possível reproduzir **'+md(this.current.track.title,120)+'**. A rádio seguirá para o próximo pedido.',allowedMentions:{parse:[]}}).catch(()=>{});
          }
        }
        this.current=null;
      }else{
        this.phase='station';if(this.queue.length)continue;
        this.liveKey=stationKey(this.config.station);this.refresh();
        let outcome='failed';try{outcome=await this.playManaged(openStation(PLAYLISTS[this.liveKey].streamUrl));}catch(error){console.warn('[FM] Estação:',error?.message??error);}
        if(!this.stopped&&['failed','ended'].includes(outcome)){
          this.lastError='Fonte temporariamente indisponível';this.refresh();await sleep(4000);
        }
      }
    }
  }
  async stop(){
    if(this.stopped)return;
    this.stopped=true;clearInterval(this.timer);this.interrupt('stop');
    try{this.player.stop(true);}catch{}
    try{this.connection.destroy();}catch{}
    await this.pending;
    // Aguarda uma edição anterior do painel para que o estado offline prevaleça.
    for(let i=0;i<20&&this.refreshing;i++)await sleep(100);
    await this.refresh();
    if(fmSessions.get(this.guild.id)===this)fmSessions.delete(this.guild.id);
    releaseFmVoice(this.guild.id);
  }
}
export async function startFm(guild,settings,db=prisma){
  if(!reserveFmVoice(guild.id))throw new Error('A Substancy FM já está ativa ou iniciando.');
  let connection, session;
  try{
    if(radioSessions.has(guild.id)||musicSessions.has(guild.id)||getVoiceConnection(guild.id))throw new Error('Encerre a sessão de áudio atual antes de iniciar a FM.');
    if(settings.enabled===true){const current=await db.communityRadio.findUnique({where:{guildId:guild.id}});if(!current?.enabled)throw new Error('A rádio está desativada.');settings=current;}
    const voice=await guild.channels.fetch(settings.voiceChannelId);
    const channel=await guild.channels.fetch(settings.textChannelId);
    const me=guild.members.me;
    if(voice?.type!==ChannelType.GuildVoice||!voice.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak]))throw new Error('Escolha uma call comum e dê ao bot permissões de conectar e falar.');
    if(channel?.type!==ChannelType.GuildText||!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.EmbedLinks]))throw new Error('O canal do painel precisa permitir enviar mensagens, ler histórico e inserir links.');
    if(getVoiceConnection(guild.id))throw new Error('Outra sessão de voz foi iniciada.');
    connection=joinVoiceChannel({guildId:guild.id,channelId:voice.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,selfMute:false});
    connection.on('error',err=>console.warn('[FM] Voz:',err?.message??err));
    await entersState(connection,VoiceConnectionStatus.Ready,25000);
    const existing=await db.communityRadio.findUnique({where:{guildId:guild.id}});
    const config={guildId:guild.id,voiceChannelId:voice.id,textChannelId:channel.id,station:settings.station||'auto',djRoleId:settings.djRoleId??null,enabled:true,queue:existing?.queue??[]};
    session=new CommunityRadioSession({guild,voiceChannel:voice,textChannel:channel,connection,config,panel:null,db});
    if(existing?.textChannelId===channel.id&&existing.panelMessageId){
      const old=await channel.messages.fetch(existing.panelMessageId).catch(()=>null);
      if(old?.author?.id===guild.client.user.id)session.panel=old;
    }
    if(!session.panel)session.panel=await channel.send(buildFmPanel(session));
    await db.communityRadio.upsert({where:{guildId:guild.id},create:{...config,panelMessageId:session.panel.id},update:{...config,panelMessageId:session.panel.id}});
    session.config.panelMessageId=session.panel.id;
    fmSessions.set(guild.id,session);
    connection.on(VoiceConnectionStatus.Disconnected,async()=>{
      if(session.stopped)return;
      try{await Promise.race([entersState(connection,VoiceConnectionStatus.Signalling,5000),entersState(connection,VoiceConnectionStatus.Connecting,5000)]);}
      catch{await session.stop();}
    });
    session.start();return session;
  }catch(error){
    if(session)await session.stop();else{try{connection?.destroy();}catch{}releaseFmVoice(guild.id);}
    throw error;
  }
}
export async function stopFm(guildId,db=prisma){
  const s=fmSessions.get(guildId);
  if(!s&&isFmVoiceReserved(guildId))throw new Error('A rádio ainda está conectando. Tente novamente.');
  await db.communityRadio.updateMany({where:{guildId},data:{enabled:false}});
  if(s)await s.stop();
}
let schedulerStarted=false;
export function startCommunityRadioScheduler(client){
  if(schedulerStarted)return;schedulerStarted=true;let running=false;
  const sync=async()=>{
    if(running)return;running=true;
    try{
      const rows=await prisma.communityRadio.findMany({where:{enabled:true}});
      for(const cfg of rows){
        const guild=client.guilds.cache.get(cfg.guildId);
        if(!guild||isFmVoiceReserved(guild.id)||getVoiceConnection(guild.id))continue;
        try{await startFm(guild,cfg);}catch(error){console.warn('[FM] Retomada:',error?.message??error);}
      }
    }catch(error){console.warn('[FM] Scheduler:',error?.message??error);}
    finally{running=false;}
  };
  sync();setInterval(sync,60000).unref?.();
}
