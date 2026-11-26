import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/database/client.js';
import { snapshotInviteMessage, templateMessagePayload, saveInviteTemplate, parseMessageLink } from '../src/utils/ticketInviteTemplate.js';
import cmd, { getVanityInvite, buildTicketInvite } from '../src/commands/ticket/convite.js';

const guild = { id: 'g', name: 'Substancy', vanityURLCode: 'personalizado', features: ['VANITY_URL'] };
const ticket = { guildId: 'g', channelId: 'c', status: 'open' };
const db = (record, template=null) => ({ ticket: { findUnique: async ({where}) => { assert.equal(where.channelId,'c'); return record; } }, ticketInviteTemplate: { findUnique: async () => template } });

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
  assert.equal(result.payload.content,'https://discord.gg/personalizado');
  assert.equal(result.payload.flags,undefined);
  assert.equal(result.payload.components,undefined);
  assert.equal(cmd.data.toJSON().name,'convite');
  assert.ok(cmd.aliases.includes('invite'));
});


test('salva a mensagem completa e bytes dos anexos, sem depender do CDN', async () => {
  const stamp=String(Date.now()), guildId='invite-template-'+stamp;
  const content='**Substancy**\n✦ social • amizades • icons\nhttps://discord.gg/substancy';
  const bytes=Buffer.from([137,80,78,71,13,10,26,10]);
  const message={content, attachments:new Map([['image',{name:'banner.png',size:bytes.length,url:'https://cdn.discordapp.com/attachments/1/2/banner.png'}]])};
  try {
    const snapshot=await snapshotInviteMessage(message,'https://discord.gg/substancy',async()=>new Response(bytes));
    assert.equal(snapshot.content,content);
    assert.equal(snapshot.attachments[0].data,bytes.toString('base64'));
    await saveInviteTemplate(guildId,'admin',snapshot);
    const stored=await prisma.ticketInviteTemplate.findUnique({where:{guildId}});
    const result=await buildTicketInvite({...guild,id:guildId},'c',db({...ticket,guildId},stored));
    assert.equal(result.ok,true);
    assert.equal(result.payload.content,content);
    assert.deepEqual(result.payload.files[0].attachment,bytes);
    assert.equal(result.payload.files[0].name,'banner.png');
    assert.deepEqual(result.payload.allowedMentions.parse,[]);
    assert.equal(result.payload.flags,undefined);
    await saveInviteTemplate(guildId,'admin',{content:'novo https://discord.gg/substancy',attachments:[]});
    assert.equal((await prisma.ticketInviteTemplate.findUnique({where:{guildId}})).content,'novo https://discord.gg/substancy');
    assert.equal(templateMessagePayload(snapshot).files.length,1);
  } finally {
    await prisma.ticketInviteTemplate.deleteMany({where:{guildId}});
    await prisma.$disconnect();
  }
});

test('valida link de mensagem e rejeita anexos grandes antes de baixar', async () => {
  assert.deepEqual(parseMessageLink('https://discord.com/channels/123456789012345678/123456789012345679/123456789012345680'),{guildId:'123456789012345678',channelId:'123456789012345679',messageId:'123456789012345680'});
  assert.equal(parseMessageLink('https://example.com/channels/1/2/3'),null);
  await assert.rejects(snapshotInviteMessage({content:'x',attachments:new Map([['x',{size:9*1024*1024}]])},'https://discord.gg/substancy'),/8 MB/);
  const snapshot=await snapshotInviteMessage({content:'texto',attachments:new Map()},'https://discord.gg/substancy');
  assert.equal(snapshot.content,'texto\n\nhttps://discord.gg/substancy');
});
