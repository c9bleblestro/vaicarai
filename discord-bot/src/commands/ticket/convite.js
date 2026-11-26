import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import prisma from '../../database/client.js';
import { v2Simple } from '../../utils/embed.js';
import { templateMessagePayload } from '../../utils/ticketInviteTemplate.js';

const validCode = code => typeof code === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(code);
export async function getVanityInvite(guild) {
  // O código oficial vem do objeto Guild recebido do Discord (sem criar convite).
  if (validCode(guild?.vanityURLCode)) return 'https://discord.gg/' + guild.vanityURLCode;
  if (!guild?.features?.includes('VANITY_URL')) return null;
  // Consulta complementar caso o código não esteja disponível no cache.
  const data = await guild.fetchVanityData();
  return validCode(data?.code) ? 'https://discord.gg/' + data.code : null;
}

export async function buildTicketInvite(guild, channelId, db = prisma) {
  if (!guild?.id || !channelId) return { ok: false, text: 'Este comando funciona apenas dentro de um ticket aberto.' };
  const ticket = await db.ticket.findUnique({
    where: { channelId },
    select: { guildId: true, channelId: true, status: true },
  });
  if (!ticket || ticket.guildId !== guild.id || ticket.channelId !== channelId || ticket.status !== 'open') {
    return { ok: false, text: 'Este comando funciona apenas dentro de um ticket aberto.' };
  }
  const template = await db.ticketInviteTemplate.findUnique({ where: { guildId: guild.id } });
  if (template) return { ok: true, payload: templateMessagePayload(template) };
  let url;
  try { url = await getVanityInvite(guild); }
  catch (error) {
    console.warn('[TICKET CONVITE]', error?.message ?? error);
    return { ok: false, text: 'Não consegui consultar o convite personalizado. Peça ajuda à equipe.' };
  }
  if (!url) return { ok: false, text: 'O servidor não possui um convite personalizado disponível no Discord.' };
  // Mensagem comum para o Discord gerar o próprio cartão de convite.
  return { ok: true, payload: { content: url, allowedMentions: { parse: [], repliedUser: false } } };
}

export default {
  data: new SlashCommandBuilder().setName('convite')
    .setDescription('Envia o convite personalizado do servidor dentro de um ticket aberto'),
  name: 'convite',
  aliases: ['invite'],
  async execute(interaction) {
    // Reconhece a interação antes de consultas externas para evitar timeout.
    if (!interaction.guildId) return interaction.reply({ ...v2Simple('Este comando funciona apenas dentro de um ticket aberto.'), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    await interaction.deferReply();
    try {
      const result = await buildTicketInvite(interaction.guild, interaction.channelId);
      return await interaction.editReply(result.ok ? result.payload : v2Simple(result.text));
    } catch (error) {
      console.warn('[TICKET CONVITE]', error?.message ?? error);
      return interaction.editReply(v2Simple('Não consegui consultar o convite agora.'));
    }
  },
  async executePrefix(message) {
    try {
      const result = await buildTicketInvite(message.guild, message.channelId);
      return result.ok ? await message.channel.send(result.payload) : await message.reply({ ...v2Simple(result.text), allowedMentions: { repliedUser: false } });
    } catch (error) {
      console.warn('[TICKET CONVITE]', error?.message ?? error);
      return message.reply(v2Simple('Não consegui consultar o convite agora.'));
    }
  },
};
