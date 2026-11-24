import {SlashCommandBuilder,AttachmentBuilder} from 'discord.js';
import {getMemberLevel} from '../../utils/chatLevel.js';
import {createChatLevelImage} from '../../utils/chatLevelCard.js';

async function buildLevelPayload(guild,user){
  const state=await getMemberLevel(guild.id,user.id);
  const member=guild.members.cache.get(user.id)
    ??await guild.members.fetch(user.id).catch(()=>null);
  const buffer=await createChatLevelImage({
    mode:'progress',
    avatarUrl:member?.displayAvatarURL({extension:'png',size:256})
      ??user.displayAvatarURL({extension:'png',size:256}),
    username:user.username,
    displayName:member?.displayName??user.globalName??user.username,
    fromLevel:state.level,
    toLevel:state.level,
    totalXp:state.xp,
  });
  return {
    files:[new AttachmentBuilder(buffer,{name:'nivel.png'})],
    allowedMentions:{parse:[],repliedUser:false},
  };
}

export default {
  data:new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('💗 Veja seu nível e XP de conversa neste servidor')
    .addUserOption(option=>option.setName('membro').setDescription('Membro para consultar').setRequired(false)),
  name:'nivel',
  async execute(interaction){
    if(!interaction.guildId||!interaction.guild)return interaction.reply({content:'Use esse comando em um servidor.',ephemeral:true});
    await interaction.deferReply();
    try{
      const user=interaction.options.getUser('membro')??interaction.user;
      return await interaction.editReply(await buildLevelPayload(interaction.guild,user));
    }catch(error){
      console.error('[NÍVEL COMANDO]',error?.message??error);
      return interaction.editReply({content:'Não consegui consultar seu XP agora. Tente novamente.'});
    }
  },
  async executePrefix(message){
    if(!message.guildId||!message.guild)return message.reply({content:'Use esse comando em um servidor.',allowedMentions:{parse:[],repliedUser:false}});
    try{
      const user=message.mentions.users.first()??message.author;
      return await message.reply(await buildLevelPayload(message.guild,user));
    }catch(error){
      console.error('[NÍVEL PREFIXO]',error?.message??error);
      return message.reply({content:'Não consegui consultar seu XP agora. Tente novamente.',allowedMentions:{parse:[],repliedUser:false}});
    }
  },
};
