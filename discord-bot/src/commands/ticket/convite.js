import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } from 'discord.js';
import prisma from '../../database/client.js';
import { v2Simple, v2Rich, v2Payload } from '../../utils/embed.js';

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
  let url;
  try { url = await getVanityInvite(guild); }
  catch (error) {
    console.warn('[TICKET CONVITE]', error?.message ?? error);
    return { ok: false, text: 'Não consegui consultar o convite personalizado. Peça ajuda à equipe.' };
  }
  if (!url) return { ok: false, text: 'O servidor não possui um convite personalizado disponível no Discord.' };
  const title = escapeMarkdown(guild.name ?? 'Servidor');
  const container = v2Rich({
    text: '## 🔗 Convite oficial\n**' + title + '**\n\n' + url + '\n\n-# Copie o link acima para usar na parceria.',
    thumbnailUrl: guild.iconURL?.({ size: 128 }) ?? null,
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Abrir convite').setURL(url),
  );
  return { ok: true, payload: { ...v2Payload(container, row), allowedMentions: { parse: [], repliedUser: false } } };
}

export default {
  data: new SlashCommandBuilder().setName('convite')
    .setDescription('Envia o convite personalizado do servidor dentro de um ticket aberto'),
  name: 'convite',
  aliases: ['invite'],
  async execute(interaction) {
    // Resposta pública no ticket: autor e equipe podem copiar o mesmo link.
    try {
      const result = await buildTicketInvite(interaction.guild, interaction.channelId);
      if (!result.ok) return await interaction.reply({ ...v2Simple(result.text), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return await interaction.reply(result.payload);
    } catch (error) {
      console.warn('[TICKET CONVITE]', error?.message ?? error);
      if (!interaction.replied && !interaction.deferred) return interaction.reply({ ...v2Simple('Não consegui consultar o convite agora.'), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
  },
  async executePrefix(message) {
    try {
      const result = await buildTicketInvite(message.guild, message.channelId);
      return await message.reply(result.ok ? result.payload : { ...v2Simple(result.text), allowedMentions: { repliedUser: false } });
    } catch (error) {
      console.warn('[TICKET CONVITE]', error?.message ?? error);
      return message.reply(v2Simple('Não consegui consultar o convite agora.'));
    }
  },
};
