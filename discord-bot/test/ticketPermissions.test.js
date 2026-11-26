import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, PermissionFlagsBits, PermissionsBitField, OverwriteType } from 'discord.js';
import prisma from '../src/database/client.js';
import { enforceAntiLink } from '../src/utils/antiLink.js';
import {
  canAssumeTicket,
  canCloseTicket,
  TICKET_OWNER_PERMISSIONS,
  isOpenTicketOwner,
  ensureTicketOwnerMedia,
  syncOpenTicketMediaPermissions,
} from '../src/utils/ticketPermissions.js';

const TEAM_ROLE_ID = 'team-role';
const OTHER_ROLE_ID = 'other-role';
const TICKET = { claimedBy: 'assigned-staff' };

test('membro sem cargo da equipe não pode assumir ticket', () => {
  assert.equal(
    canAssumeTicket({ roles: [OTHER_ROLE_ID] }, [TEAM_ROLE_ID]),
    false,
  );
});

test('membro com cargo de ping pode assumir ticket', () => {
  assert.equal(
    canAssumeTicket({ roles: [TEAM_ROLE_ID] }, [TEAM_ROLE_ID]),
    true,
  );
});

test('cargo de atendimento funciona com o cache de cargos do Discord', () => {
  assert.equal(
    canAssumeTicket({ roles: { cache: new Map([[TEAM_ROLE_ID, { id: TEAM_ROLE_ID }]]) } }, [TEAM_ROLE_ID]),
    true,
  );
});

test('quem assumiu ou tem cargo de atendimento pode fechar', () => {
  assert.equal(canCloseTicket(TICKET, 'assigned-staff', { roles: [] }, [TEAM_ROLE_ID]), true);
  assert.equal(canCloseTicket(TICKET, 'team-staff', { roles: [TEAM_ROLE_ID] }, [TEAM_ROLE_ID]), true);
});

test('membro comum não pode fechar ticket assumido por outra pessoa', () => {
  assert.equal(canCloseTicket(TICKET, 'regular-member', { roles: [OTHER_ROLE_ID] }, [TEAM_ROLE_ID]), false);
});


test('novos tickets liberam apenas as permissões de conversa, mídia e embed do autor', () => {
  assert.deepEqual(TICKET_OWNER_PERMISSIONS, [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ]);
});

test('exceção exige servidor, canal, autor e status aberto exatos', () => {
  const ticket = { guildId: 'g', channelId: 'c', userId: 'u', status: 'open' };
  assert.equal(isOpenTicketOwner(ticket, 'g', 'c', 'u'), true);
  for (const args of [['x','c','u'],['g','x','u'],['g','c','x']])
    assert.equal(isOpenTicketOwner(ticket, ...args), false);
  assert.equal(isOpenTicketOwner({...ticket,status:'closed'},'g','c','u'),false);
  assert.equal(isOpenTicketOwner({...ticket,status:'closing'},'g','c','u'),false);
  assert.equal(isOpenTicketOwner(null,'g','c','u'),false);
});

test('ticket existente altera somente o overwrite do autor e dois bits', async () => {
  const ticket = { guildId: 'g', channelId: 'c', userId: 'u', status: 'open' };
  const edits = [];
  const existing = { type: OverwriteType.Member, allow: new PermissionsBitField([
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ]) };
  const channel = { id:'c', guildId:'g', type:ChannelType.GuildText,
    permissionOverwrites:{cache:new Map([['u',existing]]),edit:async(...args)=>edits.push(args)} };
  assert.equal(await ensureTicketOwnerMedia(channel,ticket),true);
  assert.equal(edits.length,1);
  assert.equal(edits[0][0],'u');
  assert.deepEqual(edits[0][1],{AttachFiles:true,EmbedLinks:true});
  assert.equal(await ensureTicketOwnerMedia({...channel,id:'normal'},ticket),false);
  assert.equal(await ensureTicketOwnerMedia({...channel,guildId:'other'},ticket),false);
  assert.equal(await ensureTicketOwnerMedia(channel,{...ticket,status:'closed'}),false);
  existing.allow.add(PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks);
  assert.equal(await ensureTicketOwnerMedia(channel,ticket),false);
  existing.allow.remove(PermissionFlagsBits.SendMessages);
  assert.equal(await ensureTicketOwnerMedia(channel,ticket),false);
  channel.permissionOverwrites.cache.clear();
  assert.equal(await ensureTicketOwnerMedia(channel,ticket),false);
  assert.equal(edits.length,1);
});

test('anti-link real: autor do ticket aberto pode mandar convite, demais continuam bloqueados', async () => {
  const stamp=String(Date.now()),guildId='ticket-test-'+stamp,channelId='channel-'+stamp,userId='owner-'+stamp;
  const cfg={antiLinkEnabled:true,antiLinkBlockAll:true,antiLinkAction:'delete'};
  let deleted=0;
  const makeMessage=(overrides={})=>({
    id:'message-'+(++messageCount),guildId,channelId,author:{id:userId},
    content:'https://discord.gg/exemplo',embeds:[],components:[],
    member:{permissions:{has:()=>false},roles:{cache:new Map()}},
    channel:{bulkDelete:async ids=>{deleted+=ids.length;return new Map(ids.map(id=>[id,{}]));}},
    ...overrides,
  });
  let messageCount=0;
  try {
    await prisma.ticket.create({data:{guildId,channelId,userId,status:'open'}});
    assert.equal(await enforceAntiLink(makeMessage(),cfg),false);
    assert.equal(deleted,0);
    assert.equal(await enforceAntiLink(makeMessage({author:{id:'other'}}),cfg),true);
    assert.equal(await enforceAntiLink(makeMessage({channelId:'normal-'+stamp}),cfg),true);
    assert.equal(await enforceAntiLink(makeMessage({guildId:'other-guild'}),cfg),true);
    await prisma.ticket.update({where:{channelId},data:{status:'closed'}});
    assert.equal(await enforceAntiLink(makeMessage(),cfg),true);
    assert.equal(deleted,4);
  } finally {
    await prisma.ticket.deleteMany({where:{guildId}});
    await prisma.$disconnect();
  }
});
