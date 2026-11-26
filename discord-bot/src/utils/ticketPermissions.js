import prisma from '../database/client.js';
import { ChannelType, PermissionFlagsBits, OverwriteType } from 'discord.js';

function idList(...values) {
  return [...new Set(
    values
      .flatMap(value => String(value ?? '').split(','))
      .map(value => value.trim())
      .filter(Boolean),
  )];
}

function isPartnershipTicket(label = '') {
  return /\b(parceria|parcerias|partner|partnership)\b/i.test(label);
}

export async function getTicketNotificationTargets(ticket) {
  const [config, option] = await Promise.all([
    prisma.guildConfig.findUnique({ where: { guildId: ticket.guildId } }),
    ticket.reason
      ? prisma.ticketOption.findFirst({ where: { guildId: ticket.guildId, label: ticket.reason } })
      : null,
  ]);

  const partnershipTicket = isPartnershipTicket(ticket.reason ?? '');
  return {
    roleIds: idList(
      option?.pingRole,
      config?.ticketPingRole,
      partnershipTicket ? config?.partnerResponsibleRole : null,
    ),
    userIds: idList(option?.pingUser, config?.ticketPingUser),
  };
}

export function memberHasTicketRole(member, roleIds) {
  const roles = member?.roles;
  if (roles?.cache?.has) {
    return roleIds.some(roleId => roles.cache.has(roleId));
  }

  const memberRoleIds = Array.isArray(roles)
    ? roles
    : Array.isArray(member?.roleIds)
      ? member.roleIds
      : [];
  return roleIds.some(roleId => memberRoleIds.includes(roleId));
}

export function canAssumeTicket(member, roleIds) {
  return memberHasTicketRole(member, roleIds);
}

export function canCloseTicket(ticket, userId, member, roleIds) {
  return ticket?.claimedBy === userId || memberHasTicketRole(member, roleIds);
}


// A permissão pertence exclusivamente ao membro autor, no canal do ticket.
export const TICKET_OWNER_PERMISSIONS = Object.freeze([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
]);

export function isOpenTicketOwner(ticket, guildId, channelId, userId) {
  return Boolean(guildId && channelId && userId && ticket
    && ticket.status === 'open' && ticket.guildId === guildId
    && ticket.channelId === channelId && ticket.userId === userId);
}

// Não muda permissões de cargos, categoria ou outros membros. Edita apenas
// os dois bits necessários, preservando os demais allow/deny existentes.
export async function ensureTicketOwnerMedia(channel, ticket) {
  if (!channel || channel.type !== ChannelType.GuildText
    || !isOpenTicketOwner(ticket, channel.guildId, channel.id, ticket?.userId)
    || !channel.permissionOverwrites) return false;
  const existing = channel.permissionOverwrites.cache.get(ticket.userId);
  // Tickets reais já possuem overwrite individual; nunca criar acesso novo
  // para um usuário cujo acesso ao canal tenha sido retirado manualmente.
  if (!existing || existing.type !== OverwriteType.Member
    || !existing.allow.has(PermissionFlagsBits.ViewChannel)
    || !existing.allow.has(PermissionFlagsBits.SendMessages)) return false;
  if (existing.allow.has(PermissionFlagsBits.AttachFiles)
    && existing.allow.has(PermissionFlagsBits.EmbedLinks)) return false;
  await channel.permissionOverwrites.edit(ticket.userId, {
    AttachFiles: true,
    EmbedLinks: true,
  }, { type: OverwriteType.Member, reason: 'Mídias e links exclusivos do ticket' });
  return true;
}

export async function syncOpenTicketMediaPermissions(client) {
  const tickets = await prisma.ticket.findMany({
    where: { status: 'open' },
    select: { guildId: true, channelId: true, userId: true, status: true },
  });
  let updated = 0, failed = 0;
  for (const ticket of tickets) {
    const guild = client.guilds.cache.get(ticket.guildId);
    if (!guild) continue;
    try {
      const channel = guild.channels.cache.get(ticket.channelId)
        ?? await guild.channels.fetch(ticket.channelId);
      // Confere novamente o registro, pois o ticket pode fechar durante o sync.
      const current = await prisma.ticket.findUnique({ where: { channelId: ticket.channelId } });
      if (!isOpenTicketOwner(current, ticket.guildId, ticket.channelId, ticket.userId)) continue;
      if (await ensureTicketOwnerMedia(channel, current)) updated++;
      // O bot precisa inserir links para o cartão nativo do Discord.
      const botId = client.user?.id;
      const botOverwrite = botId && channel.permissionOverwrites?.cache.get(botId);
      if (channel.type === ChannelType.GuildText && botOverwrite?.type === OverwriteType.Member
        && botOverwrite.allow.has(PermissionFlagsBits.ViewChannel)
        && botOverwrite.allow.has(PermissionFlagsBits.SendMessages)
        && !botOverwrite.allow.has(PermissionFlagsBits.EmbedLinks)) {
        await channel.permissionOverwrites.edit(botId, { EmbedLinks: true }, { type: OverwriteType.Member, reason: 'Prévia do convite no ticket' });
      }
    } catch (error) {
      failed++;
      console.warn('[TICKET MÍDIA]', ticket.channelId, error?.message ?? error);
    }
  }
  console.info('[TICKET MÍDIA]', updated, 'atualizados;', failed, 'falhas');
  return { updated, failed };
}
