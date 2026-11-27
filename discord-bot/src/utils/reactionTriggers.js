import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags,
  ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle,
  escapeMarkdown,
} from 'discord.js';
import prisma from '../database/client.js';
import { buildTriggerConfigPayload, matchesTriggerKeyword, parseTriggerKeywords } from './messageTriggers.js';

const PAGE_SIZE=10;
const cooldowns=new Map();
const COOLDOWN=3000;
const canConfigure=i=>Boolean(i.guildId&&i.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
const noPermission=i=>i.reply({content:'❌ Apenas administradores podem configurar os gatilhos.',flags:MessageFlags.Ephemeral});
const textLimit=(s,n)=>String(s??'').slice(0,n);
export function parseReactionEmojiId(input){
  const raw=String(input??'').trim();
  if(/^\d{17,20}$/.test(raw))return raw;
  return raw.match(/^<a?:[a-zA-Z0-9_]{2,32}:(\d{17,20})>$/)?.[1]??null;
}
export function matchingReactionTrigger(rules,content){
  return rules.find(rule=>parseTriggerKeywords(rule.keywords).some(keyword=>matchesTriggerKeyword(content,keyword)))??null;
}
async function listRules(guildId,db=prisma){
  return db.reactionTrigger.findMany({where:{guildId},orderBy:[{createdAt:'asc'},{id:'asc'}]});
}
export async function findMatchingReactionTrigger(guildId,content,db=prisma){
  if(!guildId||!content?.trim())return null;
  return matchingReactionTrigger(await listRules(guildId,db),content);
}
export async function applyReactionTrigger(message,db=prisma,now=Date.now()){
  if(!message.guildId||message.author?.bot||!message.content?.trim())return false;
  const rule=await findMatchingReactionTrigger(message.guildId,message.content,db);
  if(!rule)return false;
  const emoji=message.guild?.emojis.cache.get(rule.emojiId);
  if(!emoji||emoji.available===false)return false;
  const key=message.guildId+':'+message.author.id+':'+rule.id;
  const previous=cooldowns.get(key);
  if(previous!==undefined&&now-previous<COOLDOWN)return false;
  cooldowns.set(key,now);
  const timer=setTimeout(()=>{if(cooldowns.get(key)===now)cooldowns.delete(key);},10000);
  timer.unref?.();
  try{await message.react(emoji);return true;}
  catch(error){
    if(cooldowns.get(key)===now)cooldowns.delete(key);
    console.warn('[GATILHO REAÇÃO]',error?.code??error?.message??error);
    return false;
  }
}
export async function createReactionTrigger({guildId,name,keywords,emojiId},db=prisma){
  const normalized=parseTriggerKeywords(keywords);
  if(!guildId||!normalized.length||!parseReactionEmojiId(emojiId)||!/^\d{17,20}$/.test(emojiId))throw new Error('Gatilho inválido.');
  return db.reactionTrigger.create({data:{guildId,name:textLimit(name?.trim(),80),keywords:normalized.join('\n'),emojiId}});
}
export async function deleteReactionTrigger(guildId,id,db=prisma){
  if(!guildId||!id)return {count:0};
  return db.reactionTrigger.deleteMany({where:{guildId,id}});
}
export function reactionPage(rules,page=0){
  const pages=Math.max(1,Math.ceil(rules.length/PAGE_SIZE));
  const index=Math.min(pages-1,Math.max(0,Number.isSafeInteger(page)?page:0));
  return {index,pages,items:rules.slice(index*PAGE_SIZE,(index+1)*PAGE_SIZE)};
}
const emojiText=(guild,id)=>{
  const e=guild.emojis.cache.get(id);
  return e?'<'+(e.animated?'a':'')+':'+e.name+':'+id+'>':'Emoji indisponível';
};
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
export async function buildReactionTriggerPanel(guild,page=0,db=prisma){
  const rules=await listRules(guild.id,db);
  const {index,pages,items}=reactionPage(rules,page);
  const lines=items.map((r,i)=>[
    '**'+(index*PAGE_SIZE+i+1)+'. '+textLimit(escapeMarkdown(r.name||'Sem apelido'),100)+'** • '+emojiText(guild,r.emojiId),
    'Palavras-chave: '+textLimit(escapeMarkdown(parseTriggerKeywords(r.keywords).join(', ')),160),
  ].join('\n'));
  const c=new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent([
    '## Gatilhos de reação',
    'Painel › Funções › Gatilhos › Reações',
    'O bot reage à mensagem com um emoji personalizado deste servidor quando encontra uma das palavras ou frases cadastradas. Não envia uma mensagem extra.',
    'Ativos: **'+rules.length+'** • Página '+(index+1)+'/'+pages,
    '',lines.join('\n\n')||'*Nenhum gatilho de reação cadastrado.*',
  ].join('\n')));
  const rows=[];
  if(items.length){
    rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
      .setCustomId('reaction_trigger_delete:'+index).setPlaceholder('Selecione um gatilho para excluir')
      .addOptions(items.map(r=>new StringSelectMenuOptionBuilder()
        .setValue(r.id).setLabel(textLimit(r.name||parseTriggerKeywords(r.keywords)[0]||'Gatilho',100))
        .setDescription(textLimit(parseTriggerKeywords(r.keywords).join(', '),100)||'Sem palavras-chave')))));
  }
  rows.push(new ActionRowBuilder().addComponents(
    btn('reaction_trigger_add','Adicionar reação',ButtonStyle.Success),
    btn('reaction_trigger_page:'+index,'Atualizar'),
  ));
  if(pages>1)rows.push(new ActionRowBuilder().addComponents(
    btn('reaction_trigger_prev:'+Math.max(0,index-1),'Anterior').setDisabled(index===0),
    btn('reaction_trigger_next:'+Math.min(pages-1,index+1),'Próxima').setDisabled(index===pages-1),
  ));
  rows.push(new ActionRowBuilder().addComponents(btn('reaction_trigger_back','Voltar aos gatilhos')));
  return {components:[c,...rows],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}
export function buildReactionTriggerModal(){
  return new ModalBuilder().setCustomId('reaction_trigger_add_modal').setTitle('Novo gatilho de reação').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reaction_name').setLabel('Apelido (opcional)').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(false).setPlaceholder('Ex: Saudação')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reaction_keywords').setLabel('Palavras-chave (uma por linha)').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true).setPlaceholder('bom dia\nboa noite')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reaction_emoji').setLabel('Emoji personalizado ou ID').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true).setPlaceholder('<:nome:123456789012345678> ou ID')),
  );
}
export async function handleReactionTriggerControl(i){
  if(!canConfigure(i))return noPermission(i);
  const [action,value]=i.customId.split(':');
  if(action==='reaction_trigger_add')return i.showModal(buildReactionTriggerModal());
  if(action==='reaction_trigger_back'){
    await i.deferUpdate();return i.editReply(await buildTriggerConfigPayload(i.guildId));
  }
  if(!['reaction_trigger_open','reaction_trigger_page','reaction_trigger_prev','reaction_trigger_next','reaction_trigger_delete'].includes(action))return;
  await i.deferUpdate();
  if(action==='reaction_trigger_delete')await deleteReactionTrigger(i.guildId,i.values?.[0]);
  return i.editReply(await buildReactionTriggerPanel(i.guild,Number(value)||0));
}
export async function handleReactionTriggerModal(i){
  if(!canConfigure(i))return noPermission(i);
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const name=i.fields.getTextInputValue('reaction_name');
  const keywords=i.fields.getTextInputValue('reaction_keywords');
  const id=parseReactionEmojiId(i.fields.getTextInputValue('reaction_emoji'));
  if(!parseTriggerKeywords(keywords).length)return i.editReply('❌ Adicione pelo menos uma palavra ou frase.');
  if(!id)return i.editReply('❌ Envie o ID ou código de um emoji personalizado, como <:nome:123456789012345678>.');
  const emoji=i.guild.emojis.cache.get(id)??await i.guild.emojis.fetch(id).catch(()=>null);
  if(!emoji||emoji.guild?.id!==i.guildId||emoji.available===false)return i.editReply('❌ Esse emoji não está disponível neste servidor.');
  try{
    await createReactionTrigger({guildId:i.guildId,name,keywords,emojiId:id});
    // Atualiza a tela original, se o modal veio do painel.
    if(i.message)await i.message.edit(await buildReactionTriggerPanel(i.guild)).catch(()=>{});
    return i.editReply({content:'✅ Gatilho de reação criado! '+emojiText(i.guild,id)+' já está ativo. Se o painel não atualizar, clique em Atualizar.',allowedMentions:{parse:[]}});
  }catch(error){
    console.warn('[GATILHO REAÇÃO CONFIG]',error?.message??error);
    return i.editReply('❌ Não consegui salvar o gatilho. Tente novamente.');
  }
}
