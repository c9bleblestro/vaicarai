import {ActionRowBuilder,ButtonBuilder,ButtonStyle,ContainerBuilder,TextDisplayBuilder,SeparatorBuilder,MediaGalleryBuilder,MediaGalleryItemBuilder,MessageFlags} from 'discord.js';
import {getEmoji} from './emojiManager.js';
import prisma from '../database/client.js';
const button=(id,icon,label)=>{const b=new ButtonBuilder().setCustomId(id).setStyle(ButtonStyle.Secondary).setEmoji(getEmoji(icon));if(label!==undefined)b.setLabel(String(label));return b;};
export function buildInstaPost({postId,authorId,content='',imageUrl,likes=0,dislikes=0}){
 const c=new ContainerBuilder().setAccentColor(0xffffff);
 c.addTextDisplayComponents(new TextDisplayBuilder().setContent(getEmoji('insta_comment')+' **postador por:** <@'+authorId+'>'+(content?'\n'+content:'')));
 c.addSeparatorComponents(new SeparatorBuilder());
 c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)));
 c.addSeparatorComponents(new SeparatorBuilder());
 c.addActionRowComponents(new ActionRowBuilder().addComponents(button('insta_v2_yes_'+postId,'insta_white_like',likes),button('insta_v2_no_'+postId,'insta_white_dislike',dislikes),button('insta_del_'+postId+'_'+authorId,'insta_white_delete'),button('insta_v2_info_'+postId,'insta_white_details')));
 return {components:[c],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[],repliedUser:false}};
}
export function nextVote(previous,requested){return previous===requested?null:requested;}
export async function getInstaVotes(postId,db=prisma){
 const rows=await db.instaVote.findMany({where:{postId},select:{userId:true,vote:true}});
 return {yes:rows.filter(r=>r.vote===1).map(r=>r.userId),no:rows.filter(r=>r.vote===-1).map(r=>r.userId)};
}
export async function toggleInstaVote(postId,userId,vote,db=prisma){
 if(![1,-1].includes(vote))throw Error('Invalid vote');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${postId}))::text`;
  const where={postId_userId:{postId,userId}},old=await tx.instaVote.findUnique({where}),next=nextVote(old?.vote,vote);
  if(next===null)await tx.instaVote.delete({where});
  else await tx.instaVote.upsert({where,create:{postId,userId,vote:next},update:{vote:next}});
  return getInstaVotes(postId,tx);
 });
}
export function updateInstaCounts(components,postId,counts){
 const walk=c=>{const next={...(typeof c.toJSON==='function'?c.toJSON():c)};
 if(next.custom_id==='insta_v2_yes_'+postId)next.label=String(counts.yes.length);
 if(next.custom_id==='insta_v2_no_'+postId)next.label=String(counts.no.length);
 if(next.components)next.components=next.components.map(walk);return next;};
 return components.map(walk);
}
const queues=new Map();
export function serializeInstaPost(postId,fn){const prev=queues.get(postId)??Promise.resolve(),next=prev.catch(()=>{}).then(fn);queues.set(postId,next);return next.finally(()=>{if(queues.get(postId)===next)queues.delete(postId);});}
