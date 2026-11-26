import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import prisma from '../../database/client.js';
import { errorEmbed, successEmbed, v2Simple } from '../../utils/embed.js';
import { configureTicketInvite } from '../../utils/ticketInviteTemplate.js';
import {
  buildTicketConfigPayload,
  buildTicketPanelV2,
} from '../../utils/configPanels.js';

async function getOrCreate(guildId) {
  return prisma.guildConfig.upsert({ where: { guildId }, create: { guildId }, update: {} });
}

async function sendPanel(target, guildId) {
  const cfg = await getOrCreate(guildId);
  return target.send(buildTicketPanelV2(cfg));
}

export async function sendTicketConfigPanel(interaction) {
  const cfg     = await getOrCreate(interaction.guildId);
  const payload = buildTicketConfigPayload(cfg);
  return interaction.reply({ ...payload, ephemeral: true });
}

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de tickets de suporte')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub => sub.setName('painel').setDescription('Envia o painel de tickets neste canal'))
    .addSubcommand(sub => sub.setName('config').setDescription('[Admin] Abre o painel de configuração do ticket'))
    .addSubcommand(sub => sub.setName('salvarconvite').setDescription('[Admin] Salva uma divulgação completa para o comando convite')
      .addStringOption(opt => opt.setName('mensagem').setDescription('Cole o link da mensagem com texto, imagem e convite').setRequired(true).setMaxLength(200))),
  name: 'ticket',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'salvarconvite') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: 'Apenas a administração pode configurar o convite.', flags: MessageFlags.Ephemeral });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const text = await configureTicketInvite({ guild: interaction.guild, member: interaction.member, link: interaction.options.getString('mensagem', true), userId: interaction.user.id });
      return interaction.editReply(v2Simple(text));
    }
    if (sub === 'painel') {
      await sendPanel(interaction.channel, interaction.guildId);
      return interaction.reply({ embeds: [successEmbed('Painel Enviado', 'O painel de tickets foi enviado neste canal.')], ephemeral: true });
    }
    if (sub === 'config') {
      return sendTicketConfigPanel(interaction);
    }
  },

  async executePrefix(message, args) {
    const sub = args[0]?.toLowerCase();
    if (sub === 'salvarconvite') {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Apenas a administração pode configurar o convite.');
      let link = args[1];
      if (!link && message.reference?.messageId && message.reference.channelId && message.guildId) {
        link = 'https://discord.com/channels/' + message.guildId + '/' + message.reference.channelId + '/' + message.reference.messageId;
      }
      const text = await configureTicketInvite({ guild: message.guild, member: message.member, link, userId: message.author.id });
      return message.reply(v2Simple(text));
    }
    if (sub === 'painel') {
      await sendPanel(message.channel, message.guildId);
      return message.reply({ embeds: [successEmbed('Painel Enviado', 'O painel de tickets foi enviado.')] });
    }
    return message.reply({ embeds: [errorEmbed('Use: `savage ticket painel`, `/ticket config` ou `/ticket salvarconvite`')] });
  },
};
