import {SlashCommandBuilder,AttachmentBuilder} from 'discord.js';
import {getMemberLevel} from '../../utils/chatLevel.js';
import {createChatLevelImage} from '../../utils/chatLevelCard.js';

export default {
  data:new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('💗 Veja seu nível e XP de conversa neste servidor')
    .addUserOption(option=>option.setName('membro').setDescription('Membro para consultar').setRequired(false)),
  name:'nivel',
  async execute(interaction){
    if(!interaction.guildId)return interaction.reply({content:'Use esse comando em um servidor.',ephemeral:true});
    await interaction.deferReply();
    const user=interaction.options.getUser('membro')??interaction.user;
    try{
      const state=await getMemberLevel(interaction.guildId,user.id);
      const member=interaction.guild.members.cache.get(user.id)
        ??await interaction.guild.members.fetch(user.id).catch(()=>null);
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
      return interaction.editReply({
        files:[new AttachmentBuilder(buffer,{name:'nivel.png'})],
        allowedMentions:{parse:[]},
      });
    }catch(error){
      console.error('[NÍVEL COMANDO]',error?.message??error);
      return interaction.editReply({content:'Não consegui consultar seu XP agora. Tente novamente.'});
    }
  },
};
