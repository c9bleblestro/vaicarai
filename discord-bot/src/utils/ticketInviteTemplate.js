import { PermissionFlagsBits } from 'discord.js';
import prisma from '../database/client.js';

const MAX_BYTES=8*1024*1024;
const MAX_FILES=10;
const linkRegex=/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})\/?$/i;
export function parseMessageLink(input) {
  const match=String(input??'').trim().replace(/^<|>$/g,'').match(linkRegex);
  return match ? {guildId:match[1],channelId:match[2],messageId:match[3]} : null;
}

function safeFilename(name) {
  return String(name??'arquivo').replace(/[\\/\x00-\x1f]/g,'_').slice(0,180)||'arquivo';
}
export async function snapshotInviteMessage(message, officialUrl, fetcher=fetch) {
  let content=message.content??'';
  const items=[...(message.attachments?.values()??[])];
  if(items.length>MAX_FILES)throw new Error('Use até 10 anexos na divulgação.');
  if(items.some(a=>!Number.isSafeInteger(a.size)||a.size<0)||items.reduce((n,a)=>n+a.size,0)>MAX_BYTES) {
    throw new Error('A divulgação pode ter até 8 MB de anexos no total.');
  }
  if(message.embeds?.some(e=>e.data?.type==='rich'||e.type==='rich')) {
    throw new Error('Use uma mensagem comum com texto, links e imagens anexadas, não uma embed personalizada.');
  }
  if(!content.trim()&&!items.length)throw new Error('A mensagem não possui texto ou anexos para salvar.');
  // Preserva o texto tal como foi enviado; acrescenta o convite oficial se faltar.
  const code=officialUrl.split('/').at(-1);
  const codes=[...content.matchAll(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9_-]+)/gi)].map(m=>m[1]);
  if(!codes.some(c=>c===code))content+=(content?'\n\n':'')+officialUrl;
  if(content.length>2000)throw new Error('O texto com o convite precisa ter até 2.000 caracteres.');
  const attachments=[];
  let total=0;
  for(const a of items){
    const url=new URL(a.url);
    if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname))throw new Error('Anexo não hospedado no Discord.');
    const res=await fetcher(url.href,{signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!res.ok)throw new Error('Não consegui baixar um anexo. Envie a imagem novamente e tente salvar.');
    const declared=Number(res.headers.get('content-length'));
    if(declared>MAX_BYTES-total)throw new Error('A divulgação pode ter até 8 MB de anexos no total.');
    const reader=res.body?.getReader();
    if(!reader)throw new Error('Anexo indisponível.');
    const chunks=[];
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BYTES){await reader.cancel();throw new Error('A divulgação pode ter até 8 MB de anexos no total.');}
      chunks.push(Buffer.from(value));
    }
    attachments.push({name:safeFilename(a.name),data:Buffer.concat(chunks).toString('base64'),description:a.description??undefined});
  }
  return {content,attachments};
}
export async function saveInviteTemplate(guildId,userId,snapshot,db=prisma){
  // O JSON não inclui propriedades undefined.
  const data={content:snapshot.content,attachments:JSON.parse(JSON.stringify(snapshot.attachments)),savedBy:userId};
  return db.ticketInviteTemplate.upsert({where:{guildId},create:{guildId,...data},update:data});
}
export function templateMessagePayload(template){
  return {
    content:template.content,
    files:template.attachments.map(a=>({attachment:Buffer.from(a.data,'base64'),name:a.name,...(a.description?{description:a.description}:{})})),
    allowedMentions:{parse:[],repliedUser:false},
  };
}
export async function configureTicketInvite({guild,member,link,userId}){
  if(!guild||!member?.permissions?.has(PermissionFlagsBits.ManageGuild))return '❌ Apenas a administração pode configurar o convite.';
  const ref=parseMessageLink(link);
  if(!ref||ref.guildId!==guild.id)return '❌ Cole o link de uma mensagem deste servidor. No Discord, mantenha pressionada a mensagem e escolha Copiar link da mensagem.';
  try {
    const channel=await guild.channels.fetch(ref.channelId);
    if(!channel?.isTextBased?.()||!channel.messages||!channel.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ReadMessageHistory]))return '❌ Você precisa ter acesso à mensagem que deseja salvar.';
    const message=await channel.messages.fetch(ref.messageId);
    // Evita dependência circular no carregamento dos comandos.
    const {getVanityInvite}=await import('../commands/ticket/convite.js');
    const url=await getVanityInvite(guild);
    if(!url)return '❌ Não encontrei o convite personalizado oficial do servidor.';
    const snapshot=await snapshotInviteMessage(message,url);
    await saveInviteTemplate(guild.id,userId,snapshot);
    return '✅ **Divulgação salva!**\nTexto, emojis, links e '+snapshot.attachments.length+' anexo(s) armazenados. Use `/convite` ou `s invite` dentro de um ticket. Para substituir a divulgação, salve outra mensagem.';
  }catch(error){
    console.warn('[TICKET CONVITE CONFIG]',error?.message??error);
    return '❌ Não consegui salvar a divulgação. '+(error?.message?.startsWith('A divulgação')||error?.message?.startsWith('Use ')||error?.message?.startsWith('O texto')||error?.message?.startsWith('A mensagem')||error?.message?.startsWith('Não consegui baixar')?error.message:'Verifique o link e o acesso do bot à mensagem.');
  }
}
