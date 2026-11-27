import {ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags,AttachmentBuilder} from 'discord.js';
import prisma from '../database/client.js';
import {PROFILE_THEMES,PROFILE_EFFECTS,PROFILE_DECORS,normalizeAppearance} from './profileStudioArt.js';
const PRIVATE=MessageFlags.Ephemeral;
const allowedMentions={parse:[],repliedUser:false};
export function profileAppearance(profile){
  return normalizeAppearance({theme:profile?.profileTheme,effect:profile?.profileEffect,decor:profile?.profileDecor,signature:profile?.profileSignature});
}
const groups={theme:{field:'profileTheme',options:PROFILE_THEMES},effect:{field:'profileEffect',options:PROFILE_EFFECTS},decor:{field:'profileDecor',options:PROFILE_DECORS}};
export async function saveProfileAppearance(userId,guildId,key,value,db=prisma){
  if(key==='signature'){
    if(typeof value!=='string'||value.length>42)throw Error('Assinatura inválida.');
    value=normalizeAppearance({signature:value}).signature||null;
  }else if(!groups[key]||!Object.hasOwn(groups[key].options,value))throw Error('Opção inválida.');
  const data={[key==='signature'?'profileSignature':groups[key].field]:value};
  return db.userProfile.upsert({where:{userId},create:{userId,guildId,...data},update:data});
}
const row=(...components)=>new ActionRowBuilder().addComponents(...components);
const label=v=>typeof v==='string'?v:v.name;
export function buildProfileStudioPayload(userId,profile){
  const a=profileAppearance(profile);
  const select=(key,title)=>row(new StringSelectMenuBuilder().setCustomId('profile_studio:'+key+':'+userId).setPlaceholder(title).addOptions(Object.entries(groups[key].options).map(([value,name])=>({label:label(name),value,default:a[key]===value}))));
  return {content:'## ✧ Estúdio de perfil\nEscolha seu visual. O novo cartão tem avatar à direita, flores, brilho nas estatísticas e animações de até seis segundos. As alterações são salvas apenas no seu perfil.\n**Tema:** '+PROFILE_THEMES[a.theme].name+' • **Animação:** '+PROFILE_EFFECTS[a.effect]+'\n**Decoração:** '+PROFILE_DECORS[a.decor]+'\n-# Suas cores personalizadas de fundo e painel têm prioridade sobre o tema. O clássico mantém o layout anterior, sem decoração ou assinatura nova. O efeito Sonho combina brilhos e pétalas; Aurora anima os contornos.\n-# Banner, argola, moldura VIP, pet, conquistas e cores continuam no menu original. Use Atualizar no perfil público para aplicar as escolhas.',components:[
    select('theme','Escolha um tema'),select('effect','Escolha uma animação'),select('decor','Escolha uma decoração'),
    row(new ButtonBuilder().setCustomId('profile_studio:signature:'+userId).setLabel('Assinatura').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('profile_studio:preview:'+userId).setLabel('Prévia real').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('profile_studio:reset:'+userId).setLabel('Restaurar visual').setStyle(ButtonStyle.Secondary))
  ],allowedMentions};
}
export async function handleProfileStudio(i){
  if(!i.guildId)return i.reply({content:'Use no servidor.',flags:PRIVATE});
  const [,action,owner]=i.customId.split(':');
  if(owner&&owner!==i.user.id)return i.reply({content:'Este estúdio pertence a outro membro.',flags:PRIVATE});
  const where={userId:i.user.id};
  if(i.customId==='profile_menu'){
    // profile_menu is shared with the old shop; only this user's preferences can be edited.
    await i.deferReply({flags:PRIVATE});
    return i.editReply(buildProfileStudioPayload(i.user.id,await prisma.userProfile.findUnique({where})));
  }
  if(action==='signature'&&i.isButton()){
    const input=new TextInputBuilder().setCustomId('signature').setLabel('Assinatura (vazio para remover)').setStyle(TextInputStyle.Short).setMaxLength(42).setRequired(false);
    return i.showModal(new ModalBuilder().setCustomId('profile_studio:signature:'+i.user.id).setTitle('Sua assinatura').addComponents(row(input)));
  }
  if(action==='preview'&&i.isButton()){
    await i.deferReply({flags:PRIVATE});
    try{
      const {buildProfilePayload}=await import('../commands/general/perfil.js');
      const p=await buildProfilePayload({userId:i.user.id,guildId:i.guildId,guild:i.guild,target:i.user});
      return i.editReply({content:'Prévia com seus dados e itens atuais.',files:p.files,allowedMentions});
    }catch(error){console.warn('[PROFILE STUDIO]',error?.message??error);return i.editReply('Não consegui gerar a prévia. Tente novamente.');}
  }
  if(!['theme','effect','decor','signature','reset'].includes(action))return;
  if(action==='signature'&&i.isModalSubmit()){
    await i.deferReply({flags:PRIVATE});
    const p=await saveProfileAppearance(i.user.id,i.guildId,'signature',i.fields.getTextInputValue('signature'));
    return i.editReply(buildProfileStudioPayload(i.user.id,p));
  }
  await i.deferUpdate();
  let p;
  if(action==='reset'){
    const data={profileTheme:'rose',profileEffect:'off',profileDecor:'floral',profileSignature:null};
    p=await prisma.userProfile.upsert({where,create:{userId:i.user.id,guildId:i.guildId,...data},update:data});
  }else p=await saveProfileAppearance(i.user.id,i.guildId,action,i.values?.[0]);
  return i.editReply(buildProfileStudioPayload(i.user.id,p));
}
