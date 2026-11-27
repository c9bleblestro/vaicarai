import {
  SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, UserSelectMenuBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, escapeMarkdown,
} from 'discord.js';
import prisma from '../../database/client.js';
import { fmSessions, startFm, stopFm, rankQueue, STATIONS, canDj } from '../../utils/communityRadio.js';

const PRIVATE=MessageFlags.Ephemeral;
const clip=(v,n=120)=>String(v??'').slice(0,n);
const safe=(v,n=120)=>clip(escapeMarkdown(clip(v,n)),n);
const admin=m=>Boolean(m?.permissions?.has(PermissionFlagsBits.ManageGuild));
const stationChoices=Object.entries(STATIONS).map(([value,name])=>({name,value}));
const textResult=content=>({content,allowedMentions:{parse:[],repliedUser:false}});
const usage='**Substancy FM**\nUse `/fm iniciar` para configurar a rádio e publicar o painel.\nPedidos: `/fm pedir`, `/fm dedicar`, `/fm fila` ou os botões do painel.';
const needsRadio='A Substancy FM não está ativa. Peça à administração para usar /fm iniciar.';
const inVoice=(member,s)=>member?.voice?.channelId===s.config.voiceChannelId;
const friendly=e=>clip(e?.message||'Não foi possível concluir a ação.',350);
function panelLink(s){return 'https://discord.com/channels/'+s.guild.id+'/'+s.config.textChannelId+'/'+s.config.panelMessageId;}
function selectOption(item){
  return new StringSelectMenuOptionBuilder().setLabel(clip(item.track.title||'Música',100)).setDescription(clip(item.votes.length+' voto(s) • '+item.track.uploader,100)).setValue(item.id);
}
export function buildQueuePayload(s,member){
  const queue=rankQueue(s.queue);
  const content='**♫ Fila da Substancy FM**\n'+(s.current?'Agora: **'+safe(s.current.track.title)+'**\n':'Programação de rádio ao vivo.\n')+'\n'+(queue.slice(0,15).map((x,i)=>(i+1)+'. **'+safe(x.track.title,65)+'** — '+x.votes.length+' voto(s)'+(x.recipientName?' 💌':'')).join('\n')||'Nenhum pedido na fila.')+(queue.length>15?'\n-# Mais '+(queue.length-15)+' pedido(s).':'')+'\n-# Selecione uma faixa para votar. Escolha novamente para retirar o voto. É necessário estar na call da rádio.';
  const components=[];
  if(queue.length){
    components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('fm:vote').setPlaceholder('Votar em uma música').addOptions(queue.map(selectOption))));
    if(canDj(member,s.config.djRoleId))components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('fm:remove').setPlaceholder('DJ • Retirar pedido da fila').addOptions(queue.map(selectOption))));
  }
  return {...textResult(content),components};
}
export function buildRequestModal(recipientId=null,anonymous=false){
  const modal=new ModalBuilder().setCustomId(recipientId?'fm:submit:'+recipientId+':'+(anonymous?'1':'0'):'fm:submit:request').setTitle(recipientId?'Dedicar uma música':'Pedir uma música');
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('query').setLabel('Música + artista ou link da faixa').setStyle(TextInputStyle.Short).setMaxLength(250).setRequired(true)));
  if(recipientId)modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Recado público, lido pelo locutor (opcional)').setStyle(TextInputStyle.Paragraph).setMaxLength(240).setRequired(false)));
  return modal;
}
async function makeRequest(s,user,member,query,recipient,message,anonymous){
  if(recipient?.user?.bot)throw new Error('Escolha um membro, não um bot.');
  if(recipient&&recipient.id===user.id)throw new Error('Escolha outra pessoa para dedicar a música.');
  const item=await s.request({userId:user.id,name:member?.displayName??user.globalName??user.username,query,recipientName:recipient?.displayName??null,message,anonymous});
  return '✅ **'+safe(item.track.title)+'** adicionada à fila!'+(recipient?' A dedicatória aparecerá quando tocar.':'')+'\n'+panelLink(s);
}
async function memberById(guild,id){if(!/^\d{17,20}$/.test(id??''))return null;return guild.members.fetch(id).catch(()=>null);}
async function djAction(s,member,action,station){
  if(!canDj(member,s.config.djRoleId))throw new Error('Apenas a administração ou o cargo DJ pode controlar a rádio.');
  if(action==='skip'){s.skip();return '⏭️ Próxima programação.';}
  if(action==='toggle'){return s.toggle()?'⏸️ Rádio pausada.':'▶️ Rádio retomada.';}
  if(action==='station'){await s.changeStation(station);return '🎙️ Programação alterada para '+STATIONS[station]+'.';}
  throw new Error('Ação desconhecida.');
}
export async function handleFmInteraction(i){
  if(!i.guildId)return i.reply({...textResult(needsRadio),flags:PRIVATE});
  const s=fmSessions.get(i.guildId);
  if(!s||s.stopped)return i.reply({...textResult(needsRadio),flags:PRIVATE});
  const [,action,a,b]=i.customId.split(':');
  if(i.isButton()){
    if(action==='request')return i.showModal(buildRequestModal());
    if(action==='dedicate'||action==='anonymous'){
      const select=new UserSelectMenuBuilder().setCustomId('fm:recipient:'+(action==='anonymous'?'1':'0')).setPlaceholder('Escolha quem receberá a música').setMaxValues(1);
      return i.reply({...textResult('Escolha um membro. O recado será público e poderá ser lido por voz na call.'+(action==='anonymous'?' Seu nome não será exibido ao público.':'')),components:[new ActionRowBuilder().addComponents(select)],flags:PRIVATE});
    }
    if(action==='queue')return i.reply({...buildQueuePayload(s,i.member),flags:PRIVATE});
    await i.deferReply({flags:PRIVATE});
    try{
      if(action==='stop'){
        if(!admin(i.member))throw new Error('Somente a administração pode encerrar a rádio.');
        await stopFm(i.guildId);return i.editReply('Rádio encerrada.');
      }
      return i.editReply(await djAction(s,i.member,action));
    }catch(e){return i.editReply(textResult('❌ '+friendly(e)));}
  }
  if(i.isUserSelectMenu()&&action==='recipient'){
    if(!i.values?.[0])return i.reply({...textResult('Escolha um membro.'),flags:PRIVATE});
    return i.showModal(buildRequestModal(i.values[0],a==='1'));
  }
  if(i.isStringSelectMenu()&&(action==='vote'||action==='remove')){
    await i.deferUpdate();
    try{
      if(action==='vote'){
        if(!inVoice(i.member,s))throw new Error('Entre na call da rádio para votar.');
        await s.vote(i.values[0],i.user.id);
      }else{
        if(!canDj(i.member,s.config.djRoleId))throw new Error('Apenas DJs podem retirar pedidos.');
        await s.remove(i.values[0]);
      }
      return i.editReply(buildQueuePayload(s,i.member));
    }catch(e){return i.followUp({...textResult('❌ '+friendly(e)),flags:PRIVATE});}
  }
  if(i.isModalSubmit()&&action==='submit'){
    await i.deferReply({flags:PRIVATE});
    try{
      const recipient=a==='request'?null:await memberById(i.guild,a);
      if(a!=='request'&&!recipient)throw new Error('Não encontrei esse membro no servidor.');
      const msg=recipient?i.fields.getTextInputValue('message'):'';
      return i.editReply(textResult(await makeRequest(s,i.user,i.member,i.fields.getTextInputValue('query'),recipient,msg,b==='1')));
    }catch(e){return i.editReply(textResult('❌ '+friendly(e)));}
  }
}
const data=new SlashCommandBuilder().setName('fm').setDescription('Substancy FM — rádio comunitária e dedicatórias')
  .addSubcommand(sub=>sub.setName('iniciar').setDescription('Admin: configura e liga a rádio oficial')
    .addChannelOption(o=>o.setName('voz').setDescription('Call oficial da rádio').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
    .addChannelOption(o=>o.setName('painel').setDescription('Canal de texto do painel permanente').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(o=>o.setName('estacao').setDescription('Programação quando a fila estiver vazia').addChoices(...stationChoices))
    .addRoleOption(o=>o.setName('dj').setDescription('Cargo autorizado a controlar a programação')))
  .addSubcommand(sub=>sub.setName('pedir').setDescription('Adiciona uma música à fila da rádio')
    .addStringOption(o=>o.setName('musica').setDescription('Nome + artista ou link de faixa do YouTube, SoundCloud ou Spotify').setMaxLength(250).setRequired(true)))
  .addSubcommand(sub=>sub.setName('dedicar').setDescription('Dedica uma música a outro membro com recado público')
    .addUserOption(o=>o.setName('membro').setDescription('Quem recebe a dedicatória').setRequired(true))
    .addStringOption(o=>o.setName('musica').setDescription('Nome + artista ou link de faixa do YouTube, SoundCloud ou Spotify').setRequired(true).setMaxLength(250))
    .addStringOption(o=>o.setName('mensagem').setDescription('Recado público que poderá ser lido pelo locutor').setMaxLength(240))
    .addBooleanOption(o=>o.setName('anonimo').setDescription('Esconder seu nome do público')))
  .addSubcommand(sub=>sub.setName('fila').setDescription('Mostra a fila e permite votar'))
  .addSubcommand(sub=>sub.setName('painel').setDescription('Localiza o painel oficial da rádio'))
  .addSubcommand(sub=>sub.setName('pular').setDescription('DJ: pula a faixa atual'))
  .addSubcommand(sub=>sub.setName('pausar').setDescription('DJ: alterna entre pausa e reprodução'))
  .addSubcommand(sub=>sub.setName('estacao').setDescription('DJ: altera a programação automática')
    .addStringOption(o=>o.setName('modo').setDescription('Estação').setRequired(true).addChoices(...stationChoices)))
  .addSubcommand(sub=>sub.setName('parar').setDescription('Admin: encerra a rádio oficial'));
export default {
  data,name:'fm',aliases:['substancyfm'],
  async execute(i){
    if(!i.guildId)return i.reply({...textResult('Use este comando no servidor.'),flags:PRIVATE});
    const sub=i.options.getSubcommand();
    await i.deferReply({flags:PRIVATE});
    try{
      if(sub==='iniciar'){
        if(!admin(i.member))throw new Error('Apenas a administração pode iniciar a rádio.');
        const role=i.options.getRole('dj');
        if(role?.id===i.guildId)throw new Error('Escolha um cargo de DJ diferente de @everyone.');
        const s=await startFm(i.guild,{voiceChannelId:i.options.getChannel('voz',true).id,textChannelId:i.options.getChannel('painel',true).id,station:i.options.getString('estacao')||'auto',djRoleId:role?.id??null});
        return i.editReply(textResult('✅ Substancy FM conectada! Painel: '+panelLink(s)));
      }
      if(sub==='parar'){
        if(!admin(i.member))throw new Error('Apenas a administração pode parar a rádio.');
        await stopFm(i.guildId);return i.editReply('Rádio encerrada.');
      }
      const s=fmSessions.get(i.guildId);
      if(!s||s.stopped)throw new Error(needsRadio);
      if(sub==='painel')return i.editReply(textResult('Painel oficial: '+panelLink(s)));
      if(sub==='fila')return i.editReply(buildQueuePayload(s,i.member));
      if(sub==='pedir'||sub==='dedicar'){
        const recipient=sub==='dedicar'?await memberById(i.guild,i.options.getUser('membro',true).id):null;
        if(sub==='dedicar'&&!recipient)throw new Error('Membro não encontrado.');
        return i.editReply(textResult(await makeRequest(s,i.user,i.member,i.options.getString('musica',true),recipient,i.options.getString('mensagem')||'',Boolean(i.options.getBoolean('anonimo')))));
      }
      return i.editReply(textResult(await djAction(s,i.member,{pular:'skip',pausar:'toggle',estacao:'station'}[sub],i.options.getString('modo'))));
    }catch(e){return i.editReply(textResult('❌ '+friendly(e)));}
  },
  async executePrefix(message,args){
    if(!message.guildId)return;
    const sub=(args.shift()||'painel').toLowerCase();
    const respond=t=>message.reply(textResult(t));
    try{
      if(sub==='iniciar'){
        if(!admin(message.member))throw new Error('Apenas a administração pode iniciar a rádio.');
        const ids=args.map(x=>x.match(/^<#(\d{17,20})>$/)?.[1]??x);
        if(!/^\d{17,20}$/.test(ids[0]??'')||!/^\d{17,20}$/.test(ids[1]??''))return respond('Use `s fm iniciar #call #canal-de-texto` ou `/fm iniciar`.');
        const station=args[2]||'auto';
        if(!Object.hasOwn(STATIONS,station))throw new Error('Estação inválida. Use /fm iniciar para escolher.');
        const s=await startFm(message.guild,{voiceChannelId:ids[0],textChannelId:ids[1],station});
        return respond('✅ Substancy FM conectada! '+panelLink(s));
      }
      if(sub==='parar'){
        if(!admin(message.member))throw new Error('Apenas a administração pode parar a rádio.');
        await stopFm(message.guildId);return respond('Rádio encerrada.');
      }
      const s=fmSessions.get(message.guildId);
      if(!s||s.stopped)return respond(usage);
      if(sub==='painel'||sub==='entrar')return respond('Painel oficial: '+panelLink(s));
      if(sub==='fila')return message.reply(buildQueuePayload(s,message.member));
      if(sub==='pedir')return respond(await makeRequest(s,message.author,message.member,args.join(' '),null,'',false));
      if(sub==='anonima')return respond('Use o botão Anônima no painel ou /fm dedicar com anonimo: sim. Evite publicar um pedido anônimo no chat.');
      if(sub==='dedicar'){
        const parts=args.join(' ').split('|').map(x=>x.trim());
        const id=parts[0]?.match(/^<@!?(\d{17,20})>$/)?.[1]??parts[0];
        const recipient=await memberById(message.guild,id);
        if(!recipient||!parts[1])return respond('Use `s fm dedicar @membro | música | recado` ou `/fm dedicar`.');
        return respond(await makeRequest(s,message.author,message.member,parts[1],recipient,parts.slice(2).join(' | '),false));
      }
      if(['pular','pausar','estacao'].includes(sub))return respond(await djAction(s,message.member,{pular:'skip',pausar:'toggle',estacao:'station'}[sub],args[0]));
      return respond(usage);
    }catch(e){return respond('❌ '+friendly(e));}
  },
};
