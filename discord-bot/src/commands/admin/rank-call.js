import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import prisma from '../../database/client.js';
import { publishCallRankPanel, refreshCallRankPanel } from '../../utils/callRank.js';

function makeInput(customId, label, style, maxLength, value, placeholder) {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setRequired(false)
    .setMaxLength(maxLength)
    .setPlaceholder(placeholder);
  if (value) input.setValue(value.slice(0, maxLength));
  return new ActionRowBuilder().addComponents(input);
}

export default {
  data: new SlashCommandBuilder()
    .setName('rankcall')
    .setDescription('Cria e personaliza o ranking de tempo em call')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('publicar')
      .setDescription('Publica ou atualiza o painel fixo de ranking')
      .addChannelOption((option) => option
        .setName('canal')
        .setDescription('Canal de texto onde ficará o painel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('personalizar')
      .setDescription('Edita título, introdução e rodapé do painel'))
    .addSubcommand((sub) => sub
      .setName('resetar')
      .setDescription('Restaura os textos padrão do painel')),
  name: 'rankcall',

  async execute(interaction) {
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Você precisa de Gerenciar Servidor para usar este comando.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'publicar') {
      const channel = interaction.options.getChannel('canal');
      try {
        const message = await publishCallRankPanel(interaction.guild, channel);
        return interaction.reply({
          content: `Painel fixo do ranking publicado em <#${channel.id}>. [Abrir painel](${message.url})`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('[CALL RANK] Falha ao publicar painel:', error.code ?? error.name);
        return interaction.reply({
          content: 'Não consegui publicar o painel. Confira se o bot pode ver e enviar mensagens nesse canal.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'personalizar') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } });
      const modal = new ModalBuilder()
        .setCustomId('callrank_customize')
        .setTitle('Personalizar ranking de call')
        .addComponents(
          makeInput(
            'callrank_title',
            'Título',
            TextInputStyle.Short,
            100,
            config?.callRankTitle,
            '🏆 Ranking de tempo em call',
          ),
          makeInput(
            'callrank_description',
            'Introdução',
            TextInputStyle.Paragraph,
            300,
            config?.callRankDescription,
            'Tempo total conectado aos canais de voz do servidor.',
          ),
          makeInput(
            'callrank_footer',
            'Rodapé',
            TextInputStyle.Short,
            180,
            config?.callRankFooter,
            'Atualiza automaticamente a cada minuto.',
          ),
        );
      return interaction.showModal(modal);
    }

    if (subcommand === 'resetar') {
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guildId },
        create: { guildId: interaction.guildId },
        update: {
          callRankTitle: null,
          callRankDescription: null,
          callRankFooter: null,
        },
      });
      await refreshCallRankPanel(interaction.guild).catch((error) => {
        console.error('[CALL RANK] Falha ao restaurar textos padrão:', error.code ?? error.name);
      });
      return interaction.reply({ content: 'Textos do ranking restaurados para o padrão.', ephemeral: true });
    }
  },
};
