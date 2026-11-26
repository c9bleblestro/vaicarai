import {SlashCommandBuilder} from 'discord.js';
import {v2Simple} from '../../utils/embed.js';
import {getInteractionStreak} from '../../utils/interactionStreak.js';
import {appendStreakCard} from '../../utils/interactionStreakCard.js';

async function show(guildId,actor,target){
  if(!guildId||!target||target.id===actor.id||target.bot||target.user?.bot)
    return v2Simple('Escolha outro membro do servidor. Ex.: `s foguinho @membro`');
  const streak=await getInteractionStreak(guildId,actor.id,target.id);
  return appendStreakCard(v2Simple('🔥 **Foguinho da dupla**\nRecorde: '+streak.bestDays+' dias.'),streak,actor,target);
}
export default {
  data:new SlashCommandBuilder().setName('foguinho').setDescription('🔥 Consulte os dias de interação com um membro')
    .addUserOption(o=>o.setName('usuario').setDescription('Membro da dupla').setRequired(true)),
  name:'foguinho',aliases:['streak'],
  async execute(i){
    if(!i.guildId)return i.reply(v2Simple('Use em um servidor.'));
    await i.deferReply();
    const target=i.options.getUser('usuario');
    const member=await i.guild.members.fetch(target.id).catch(()=>target);
    try{return await i.editReply(await show(i.guildId,i.member??i.user,member));}
    catch{return i.editReply(v2Simple('Não consegui consultar o foguinho agora.'));}
  },
  async executePrefix(m){
    const target=m.mentions.users.first();
    if(!m.guildId||!target)return m.reply(v2Simple('Use `s foguinho @membro`.'));
    const member=await m.guild.members.fetch(target.id).catch(()=>target);
    return m.reply(await show(m.guildId,m.member??m.author,member));
  }
};
