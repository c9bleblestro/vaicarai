import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import prisma from '../database/client.js';

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 60_000;
const activeCallStarts = new Map();
let refreshTimer = null;
let refreshRunning = false;

const callKey = (guildId, userId) => `${guildId}:${userId}`;

export async function handleCallRankVoiceStateUpdate(oldState, newState) {
  const userId = newState.id ?? oldState.id;
  const guildId = newState.guild?.id ?? oldState.guild?.id;
  if (!userId || !guildId) return;

  const member = newState.member ?? oldState.member;
  if (member?.user?.bot) return;

  const key = callKey(guildId, userId);
  if (!oldState.channelId && newState.channelId) {
    activeCallStarts.set(key, Date.now());
    return;
  }

  if (!oldState.channelId || newState.channelId) return;

  const startedAt = activeCallStarts.get(key);
  activeCallStarts.delete(key);
  if (!startedAt) return;

  const elapsedMinutes = Math.floor((Date.now() - startedAt) / 60_000);
  if (elapsedMinutes < 1) return;

  await prisma.economy.upsert({
    where: { userId_guildId: { userId, guildId } },
    create: { userId, guildId, callMinutes: elapsedMinutes },
    update: { callMinutes: { increment: elapsedMinutes } },
  }).catch((error) => {
    console.error('[CALL RANK] Falha ao salvar tempo de voz:', error.code ?? error.name);
  });
}

export function initializeCallRankVoiceSessions(client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (!state.channelId || state.member?.user?.bot) continue;
      activeCallStarts.set(callKey(guild.id, state.id), now);
    }
  }
}

async function getRankEntries(guildId) {
  const records = await prisma.economy.findMany({
    where: { guildId, callMinutes: { gt: 0 } },
    select: { userId: true, callMinutes: true },
  });
  const totals = new Map(records.map(({ userId, callMinutes }) => [userId, callMinutes]));
  const prefix = `${guildId}:`;
  const now = Date.now();

  for (const [key, startedAt] of activeCallStarts) {
    if (!key.startsWith(prefix)) continue;
    const userId = key.slice(prefix.length);
    const liveMinutes = Math.floor((now - startedAt) / 60_000);
    if (liveMinutes > 0) totals.set(userId, (totals.get(userId) ?? 0) + liveMinutes);
  }

  return [...totals.entries()]
    .filter(([, minutes]) => minutes > 0)
    .map(([userId, minutes]) => ({ userId, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.userId.localeCompare(b.userId));
}

function formatCallTime(totalMinutes) {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}min`;
  return `${hours}h ${minutes}min`;
}

export function buildCallRankPayload(guildId, config, entries, requestedPage = 0) {
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.max(0, Math.min(Number(requestedPage) || 0, pageCount - 1));
  const pageEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rankLines = pageEntries.length
    ? pageEntries.map(({ userId, minutes }, index) => {
      const rank = page * PAGE_SIZE + index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
      return `${medal} <@${userId}> — **${formatCallTime(minutes)}**`;
    }).join('\n')
    : '*Ainda não há tempo de call registrado neste servidor.*';

  const title = config.callRankTitle?.trim() || '🏆 Ranking de tempo em call';
  const description = config.callRankDescription?.trim()
    || 'Tempo total conectado aos canais de voz do servidor.';
  const footerText = config.callRankFooter?.trim()
    || 'Atualiza automaticamente a cada minuto.';
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${description}`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(rankLines))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${footerText}\nPágina ${page + 1} de ${pageCount}`),
    );

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`callrank_page:${guildId}:${page - 1}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`callrank_page:${guildId}:${page + 1}`)
      .setLabel('Próxima')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount - 1),
  );

  return {
    components: [container, controls],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
    page,
  };
}

async function loadCallRankConfig(guildId) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });
}

export async function publishCallRankPanel(guild, channel) {
  const config = await loadCallRankConfig(guild.id);
  const entries = await getRankEntries(guild.id);
  const payload = buildCallRankPayload(guild.id, config, entries, 0);
  let message = null;

  if (config.callRankChannelId === channel.id && config.callRankMessageId) {
    const existingChannel = guild.channels.cache.get(config.callRankChannelId);
    const existingMessage = await existingChannel?.messages
      .fetch(config.callRankMessageId)
      .catch(() => null);
    if (existingMessage) message = await existingMessage.edit(payload);
  }

  if (!message) message = await channel.send(payload);

  await prisma.guildConfig.update({
    where: { guildId: guild.id },
    data: {
      callRankChannelId: channel.id,
      callRankMessageId: message.id,
      callRankPage: 0,
    },
  });

  return message;
}

export async function refreshCallRankPanel(guild, requestedPage = null) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
  if (!config?.callRankChannelId || !config.callRankMessageId) return false;

  const channel = guild.channels.cache.get(config.callRankChannelId)
    ?? await guild.channels.fetch(config.callRankChannelId).catch(() => null);
  if (!channel?.isTextBased()) return false;

  const entries = await getRankEntries(guild.id);
  const page = requestedPage ?? config.callRankPage ?? 0;
  const payload = buildCallRankPayload(guild.id, config, entries, page);
  let message = await channel.messages.fetch(config.callRankMessageId).catch(() => null);

  if (!message) {
    message = await channel.send(payload);
    await prisma.guildConfig.update({
      where: { guildId: guild.id },
      data: { callRankMessageId: message.id, callRankPage: payload.page },
    });
    return true;
  }

  await message.edit(payload);
  if (payload.page !== config.callRankPage) {
    await prisma.guildConfig.update({
      where: { guildId: guild.id },
      data: { callRankPage: payload.page },
    });
  }
  return true;
}

export async function handleCallRankPage(interaction) {
  const [, guildId, rawPage] = interaction.customId.split(':');
  if (!interaction.guild || guildId !== interaction.guildId) {
    return interaction.reply({ content: 'Este painel pertence a outro servidor.', ephemeral: true });
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config?.callRankMessageId || config.callRankMessageId !== interaction.message.id) {
    return interaction.reply({ content: 'Este painel não está mais ativo.', ephemeral: true });
  }

  const entries = await getRankEntries(guildId);
  const payload = buildCallRankPayload(guildId, config, entries, Number.parseInt(rawPage, 10));
  await prisma.guildConfig.update({
    where: { guildId },
    data: { callRankPage: payload.page },
  });
  return interaction.update(payload);
}

export async function handleCallRankCustomization(interaction) {
  if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'Você precisa de Gerenciar Servidor para personalizar este painel.', ephemeral: true });
  }

  const title = interaction.fields.getTextInputValue('callrank_title').trim();
  const description = interaction.fields.getTextInputValue('callrank_description').trim();
  const footer = interaction.fields.getTextInputValue('callrank_footer').trim();
  await prisma.guildConfig.upsert({
    where: { guildId: interaction.guildId },
    create: {
      guildId: interaction.guildId,
      callRankTitle: title || null,
      callRankDescription: description || null,
      callRankFooter: footer || null,
    },
    update: {
      callRankTitle: title || null,
      callRankDescription: description || null,
      callRankFooter: footer || null,
    },
  });

  await refreshCallRankPanel(interaction.guild).catch((error) => {
    console.error('[CALL RANK] Falha ao atualizar painel personalizado:', error.code ?? error.name);
  });
  return interaction.reply({ content: 'Personalização do ranking de call salva.', ephemeral: true });
}

export function startCallRankScheduler(client) {
  initializeCallRankVoiceSessions(client);
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    if (refreshRunning) return;
    refreshRunning = true;
    try {
      const configs = await prisma.guildConfig.findMany({
        where: { callRankChannelId: { not: null }, callRankMessageId: { not: null } },
        select: { guildId: true },
      });
      for (const { guildId } of configs) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        await refreshCallRankPanel(guild).catch((error) => {
          console.error('[CALL RANK] Falha ao atualizar ranking:', error.code ?? error.name);
        });
      }
    } catch (error) {
      console.error('[CALL RANK] Falha no ciclo de atualização:', error.code ?? error.name);
    } finally {
      refreshRunning = false;
    }
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref?.();
}
