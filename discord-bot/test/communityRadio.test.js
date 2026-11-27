import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import prisma,{ensureCommunityRadioSchema} from '../src/database/client.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { scheduledStation, stationKey, rankQueue, toggleQueueVote, checkQueueLimit, safeDedication, canDj, buildFmPanel, CommunityRadioSession } from '../src/utils/communityRadio.js';
import { validQuery, validTrackUrl, speechText, openAnnouncement } from '../src/utils/fmAudio.js';
import { reserveFmVoice, releaseFmVoice, isFmVoiceReserved } from '../src/utils/fmVoiceGuard.js';
import cmd,{buildQueuePayload,buildRequestModal} from '../src/commands/general/fm.js';
const item=(id,votes=[],createdAt=1)=>({id,votes,createdAt,requesterId:'u',requesterName:'Alice',recipientName:'Bob',anonymous:true,message:'Olá!',track:{title:'Faixa',uploader:'Artista',duration:'4:20',url:'https://soundcloud.com/artista/faixa',thumbnail:null}});
test('programação local, votos únicos por faixa e ordem estável',()=>{
  assert.equal(scheduledStation(new Date('2026-11-27T04:00:00Z')),'lofi');
  assert.equal(scheduledStation(new Date('2026-11-27T13:00:00Z')),'pop');
  assert.equal(scheduledStation(new Date('2026-11-27T17:00:00Z')),'hiphop');
  assert.equal(scheduledStation(new Date('2026-11-27T23:00:00Z')),'soul');
  assert.equal(stationKey('jazz'),'jazz');
  const q=[item('a'),item('b',[],2)];
  const voted=toggleQueueVote(q,'b','listener');
  assert.equal(rankQueue(voted)[0].id,'b');
  assert.deepEqual(toggleQueueVote(voted,'b','listener')[1].votes,[]);
  assert.throws(()=>toggleQueueVote(q,'missing','listener'));
  assert.throws(()=>checkQueueLimit([item('a'),item('b'),item('c')],'u'));
});
test('anonimato público e do locutor, fontes e proteção da conexão',()=>{
  const i=item('a');
  assert.equal(safeDedication(i).from,'Anônimo');
  assert.match(speechText(i),/anônima/);
  assert.doesNotMatch(speechText(i),/Alice/);
  assert.match(speechText({...i,anonymous:false}),/Alice/);
  assert.equal(validQuery('nome da música'),true);
  assert.equal(validQuery('https://youtu.be/abcdefghijk'),true);
  assert.equal(validQuery('https://localhost/a'),false);
  assert.equal(validTrackUrl('https://soundcloud.com/artista/faixa'),true);
  assert.equal(validTrackUrl('https://soundcloud.com.evil.invalid/a/b'),false);
  assert.equal(reserveFmVoice('test-guild'),true);
  assert.equal(reserveFmVoice('test-guild'),false);
  assert.equal(isFmVoiceReserved('test-guild'),true);
  releaseFmVoice('test-guild');
  assert.equal(isFmVoiceReserved('test-guild'),false);
  assert.equal(canDj({permissions:new PermissionsBitField(PermissionFlagsBits.ManageGuild)},null),true);
  assert.equal(canDj({roles:['dj']},'dj'),true);
  assert.equal(canDj({roles:['other']},'dj'),false);
});
test('painel real V2, fila e modais serializam corretamente',()=>{
  const s={guild:{id:'123'},config:{guildId:'123',voiceChannelId:'456',textChannelId:'789',station:'auto',djRoleId:null},voiceChannel:{members:new Collection()},current:item('a'),queue:[item('b',['listener'])],player:{state:{status:AudioPlayerStatus.Playing,resource:{playbackDuration:30000}}},phase:'track'};
  s.current.track.artwork='https://is1-ssl.mzstatic.com/image/thumb/test/600x600bb.jpg';
  s.current.track.album='Álbum de teste';
  const p=buildFmPanel(s);
  const parts=p.components[0].toJSON().components;
  assert.equal(parts[1].type,12);
  assert.equal(parts[1].items[0].media.url,s.current.track.artwork);
  assert.match(JSON.stringify(parts),/Álbum de teste/);
  const json=JSON.stringify(p.components.map(c=>c.toJSON()));
  assert.match(json,/Substancy FM/);assert.match(json,/Anônimo/);assert.doesNotMatch(json,/Alice/);
  assert.match(json,/0:30/);assert.match(json,/fm:request/);assert.match(json,/discord.com\/channels\/123\/456/);
  assert.equal(p.components[1].toJSON().components.length,5);
  assert.equal(buildQueuePayload(s,{roles:[]}).components[0].toJSON().components[0].options[0].value,'b');
  assert.equal(buildRequestModal().toJSON().components.length,1);
  assert.equal(buildRequestModal('123456789012345678',true).toJSON().custom_id,'fm:submit:123456789012345678:1');
  assert.equal(cmd.data.toJSON().name,'fm');
});
test('configuração e fila persistem no PostgreSQL e remoção é transacional na sessão',async()=>{
  const guildId='fm-test-'+Date.now();
  try{
    await ensureCommunityRadioSchema();
    const cfg=await prisma.communityRadio.create({data:{guildId,voiceChannelId:'voice',textChannelId:'text',enabled:true,queue:[item('a'),item('b')]}});
    const session=new CommunityRadioSession({guild:{id:guildId},voiceChannel:{},textChannel:{},connection:{subscribe(){}},config:cfg,panel:null});
    await session.vote('b','listener');
    const next=await session.next();assert.equal(next.id,'b');
    const saved=await prisma.communityRadio.findUnique({where:{guildId}});
    assert.deepEqual(saved.queue.map(x=>x.id),['a']);
    assert.equal(saved.enabled,true);
    await session.remove('a');
    assert.equal((await prisma.communityRadio.findUnique({where:{guildId}})).queue.length,0);
  }finally{await prisma.communityRadio.deleteMany({where:{guildId}});await prisma.$disconnect();}
});

test('ciclo do player: termina locução, interrompe estação e limpa recursos',async()=>{
  const session=new CommunityRadioSession({guild:{id:'g'},voiceChannel:{},textChannel:{},connection:{subscribe(){}},config:{queue:[]},panel:null});
  const player=new EventEmitter();
  player.state={status:AudioPlayerStatus.Idle};
  player.play=resource=>{
    const old=player.state;player.state={status:AudioPlayerStatus.Playing,resource};player.emit('stateChange',old,player.state);
  };
  player.stop=()=>{
    const old=player.state;player.state={status:AudioPlayerStatus.Idle};player.emit('stateChange',old,player.state);
  };
  session.player=player;
  let closes=0;
  const p=session.playManaged({resource:{},close(){closes++;}},5000);
  player.stop();
  assert.equal(await p,'ended');
  const live=session.playManaged({resource:{},close(){closes++;}});
  session.interrupt('request');
  assert.equal(await live,'request');
  assert.equal(closes,2);
  assert.equal(player.listenerCount('stateChange'),0);
});

test('locução local gera pacotes Opus reais sem chave externa', {skip:spawnSync('espeak-ng',['--version']).status!==0||spawnSync('ffmpeg',['-version']).status!==0},async()=>{
  const previous=process.env.VOICE_TTS_DISABLED;
  process.env.VOICE_TTS_DISABLED='true';
  let opened;
  try{
    opened=await openAnnouncement('Substancy FM. Boa noite, ouvintes.');
    let count=0;
    for await(const packet of opened.resource.playStream){if(packet.length)count++;if(count>=5)break;}
    assert.ok(count>=5);
  }finally{
    opened?.close();
    if(previous===undefined)delete process.env.VOICE_TTS_DISABLED;else process.env.VOICE_TTS_DISABLED=previous;
  }
});

test('comando legado de rádio removido e FM preservada',async()=>{
  const {existsSync,readFileSync}=await import('node:fs');
  const root=new URL('../src/',import.meta.url);
  assert.equal(existsSync(new URL('commands/general/radio.js',root)),false);
  const help=readFileSync(new URL('commands/general/ajuda.js',root),'utf8');
  assert.doesNotMatch(help,/'radio'/);
  assert.match(help,/'fm'/);
  assert.equal(cmd.data.toJSON().name,'fm');
  assert.ok(cmd.data.toJSON().options.some(o=>o.name==='iniciar'));
  assert.ok(cmd.data.toJSON().options.some(o=>o.name==='dedicar'));
  const handlers=readFileSync(new URL('events/interactionCreate.js',root),'utf8');
  assert.doesNotMatch(handlers,/createRadioSession|buildRadioPanel/);
  assert.match(handlers,/handleFmInteraction/);
});
