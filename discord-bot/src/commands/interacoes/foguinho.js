import {SlashCommandBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags} from 'discord.js';
import {v2Simple} from '../../utils/embed.js';
import {getInteractionStreak,listInteractionStreaks} from '../../utils/interactionStreak.js';
import {appendStreakCard} from '../../utils/interactionStreakCard.js';

const PAGE_SIZE=3;
export function collectionPage(entries,page=0){
  const pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE));
  const index=Math.min(pages-1,Math.max(0,Number.isSafeInteger(page)?page:0));
  return {index,pages,items:entries.slice(index*PAGE_SIZE,(index+1)*PAGE_SIZE)};
}
async function resolveMember(guild,id){
  return guild.members.cache.get(id)??await guild.members.fetch(id).catch(()=>null)
    ??await guild.client.users.fetch(id).catch(()=>({id,username:'Membro '+id}));
}
async function show(guildId,actor,target){
  if(!guildId||!target||target.id===actor.id||target.bot||target.user?.bot)
    return v2Simple('Escolha outro membro do servidor. Ex.: `s foguinho @membro`');
  const streak=await getInteractionStreak(guildId,actor.id,target.id);
  return appendStreakCard(v2Simple('🔥 **Foguinho da dupla**\nRecorde: '+streak.bestDays+' dias.'),streak,actor,target);
}
export async function buildStreakCollection(guild,actor,page=0){
  const entries=await listInteractionStreaks(guild.id,actor.id);
  if(!entries.length)return v2Simple('🔥 **Seus foguinhos**\nVocê ainda não tem foguinhos. Interaja com alguém e receba uma retribuição para começar!');
  const {index,pages,items}=collectionPage(entries,page);
  const active=entries.filter(s=>s.days>0).length;
  let payload=v2Simple('🔥 **Seus foguinhos**\n'+active+' ativos • '+entries.length+' duplas registradas\nPágina '+(index+1)+'/'+pages+' • Maiores sequências primeiro');
  const partners=await Promise.all(items.map(s=>resolveMember(guild,s.partnerId)));
  // A mesma arte das interações, com nomes e avatares reais.
  for(let i=0;i<items.length;i++){
    payload=await appendStreakCard(payload,items[i],actor,partners[i],'foguinho-'+i+'.png');
  }
  const id=n=>'foguinho_page:'+actor.id+':'+n;
  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id(Math.max(0,index-1))+':prev').setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(index===0),
    new ButtonBuilder().setCustomId(id(index)+':refresh').setLabel('Atualizar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(id(Math.min(pages-1,index+1))+':next').setLabel('Próxima').setStyle(ButtonStyle.Secondary).setDisabled(index===pages-1),
  );
  return {...payload,components:[...payload.components,row]};
}
export async function handleStreakCollectionPage(i){
  const [,owner,page]=i.customId.split(':');
  if(owner!==i.user.id)return i.reply({content:'Somente o dono da coleção pode navegar por ela.',flags:MessageFlags.Ephemeral});
  if(!i.guild)return i.reply({content:'Use em um servidor.',flags:MessageFlags.Ephemeral});
  await i.deferUpdate();
  try{
    const payload=await buildStreakCollection(i.guild,i.member??i.user,Number(page));
    return await i.editReply({...payload,attachments:[]});
  }catch(error){
    console.warn('[FOGUINHO COLEÇÃO]',error?.message??error);
    return i.followUp({content:'Não consegui atualizar sua coleção. Tente novamente.',flags:MessageFlags.Ephemeral});
  }
}
export default {
  data:new SlashCommandBuilder().setName('foguinho').setDescription('🔥 Veja todos os seus foguinhos ou consulte uma dupla')
    .addUserOption(o=>o.setName('usuario').setDescription('Opcional: consultar apenas esta dupla').setRequired(false)),
  name:'foguinho',aliases:['streak'],
  async execute(i){
    if(!i.guildId)return i.reply(v2Simple('Use em um servidor.'));
    await i.deferReply();
    try{
      const target=i.options.getUser('usuario'),actor=i.member??i.user;
      if(!target)return await i.editReply(await buildStreakCollection(i.guild,actor));
      const member=await i.guild.members.fetch(target.id).catch(()=>target);
      return await i.editReply(await show(i.guildId,actor,member));
    }catch{return i.editReply(v2Simple('Não consegui consultar o foguinho agora.'));}
  },
  async executePrefix(m){
    if(!m.guildId)return m.reply(v2Simple('Use em um servidor.'));
    try{
      const target=m.mentions.users.first(),actor=m.member??m.author;
      if(!target)return m.reply(await buildStreakCollection(m.guild,actor));
      const member=await m.guild.members.fetch(target.id).catch(()=>target);
      return m.reply(await show(m.guildId,actor,member));
    }catch{return m.reply(v2Simple('Não consegui consultar o foguinho agora.'));}
  }
};
