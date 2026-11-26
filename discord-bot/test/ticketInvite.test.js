import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import cmd, { getVanityInvite, buildTicketInvite } from '../src/commands/ticket/convite.js';

const guild = { id: 'g', name: 'Substancy', vanityURLCode: 'personalizado', features: ['VANITY_URL'] };
const ticket = { guildId: 'g', channelId: 'c', status: 'open' };
const db = record => ({ ticket: { findUnique: async ({where}) => { assert.equal(where.channelId,'c'); return record; } } });

test('convite usa código oficial atual, sem gerar outro convite', async () => {
  assert.equal(await getVanityInvite(guild),'https://discord.gg/personalizado');
  assert.equal(await getVanityInvite({...guild,vanityURLCode:'novo'}),'https://discord.gg/novo');
  assert.equal(await getVanityInvite({...guild,vanityURLCode:null,fetchVanityData:async()=>({code:'consultado'})}),'https://discord.gg/consultado');
  assert.equal(await getVanityInvite({...guild,features:[],vanityURLCode:null}),null);
  assert.equal(await getVanityInvite({...guild,features:[],vanityURLCode:'https://bad.invalid'}),null);
});

test('somente canal de ticket aberto do mesmo servidor', async () => {
  for (const record of [null,{...ticket,status:'closed'},{...ticket,status:'closing'},{...ticket,guildId:'other'},{...ticket,channelId:'other'}]) {
    assert.equal((await buildTicketInvite(guild,'c',db(record))).ok,false);
  }
  assert.equal((await buildTicketInvite(null,'c',db(ticket))).ok,false);
  assert.equal((await buildTicketInvite({...guild,vanityURLCode:null,features:[]},'c',db(ticket))).ok,false);
  const result=await buildTicketInvite(guild,'c',db(ticket));
  assert.equal(result.ok,true);
  assert.equal(result.payload.flags,MessageFlags.IsComponentsV2);
  assert.match(result.payload.components[0].toJSON().components[0].content,/https:\/\/discord\.gg\/personalizado/);
  assert.equal(result.payload.components[1].toJSON().components[0].url,'https://discord.gg/personalizado');
  assert.equal(cmd.data.toJSON().name,'convite');
  assert.ok(cmd.aliases.includes('invite'));
});
