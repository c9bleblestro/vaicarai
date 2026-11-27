import {
  SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  AttachmentBuilder
} from 'discord.js';
import {getEmoji} from '../../utils/emojiManager.js';
import {buildPetPanel,petDisplayName,resolvePetEmoji} from '../../utils/petComponents.js';
import {getPetWorld,changePetWorld,petStats,petLevel,petMood,petCooldown,ROOM_THEMES,CARE_ACTIONS} from '../../utils/petLife.js';
import {renderPetWorld} from '../../utils/petWorldArt.js';
const coin=()=>getEmoji('futecoins');
const flags=MessageFlags.IsComponentsV2;
const privateFlag=MessageFlags.Ephemeral;
const ts=x=>x?new Date(x).getTime():0;
const mentionSafe={parse:[],repliedUser:false};
const duration=ms=>{const m=Math.ceil(ms/60000);return m>=60?Math.floor(m/60)+'h '+m%60+'min':m+'min';};
const bar=n=>'▰'.repeat(Math.round(n/10))+'▱'.repeat(10-Math.round(n/10));
function noPet(){
  return {...buildPetPanel({title:'Seu primeiro companheiro',body:'Equipe um pet do seu inventário ou compre um em /loja painel → Pets.',includeActions:false,extraRows:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('profile_pet_btn').setLabel('Meus pets').setEmoji('🐾').setStyle(ButtonStyle.Secondary))]}),allowedMentions:mentionSafe};
}
function button(action,owner,petId,label,emoji,disabled=false,style=ButtonStyle.Secondary){
  return new ButtonBuilder().setCustomId('pet_action:'+action+':'+owner+':'+petId).setLabel(label).setEmoji(emoji).setDisabled(disabled).setStyle(style);
}
const row=(...items)=>new ActionRowBuilder().addComponents(items);
function errorText(result){
  return ({
    changed:'Seu pet equipado mudou. Abra S pet novamente.',
    cooldown:'Seu pet ainda precisa de '+duration(result.remaining||0)+' antes dessa interação.',
    away:'Seu pet está explorando! Volta em '+duration(result.remaining||0)+'.',
    collect:'Sua aventura terminou. Recolha o tesouro primeiro.',
    noadventure:'Não há nenhuma aventura para coletar.',
    needs:'Alimente seu pet e deixe-o descansar antes de explorar.',
    money:'Você precisa de '+Number(result.cost||0).toLocaleString('pt-BR')+' coins na carteira.',
    busy:'Outra interação foi concluída ao mesmo tempo. Tente novamente.',
    invalid:'Ação inválida.'
  })[result.reason]??'Não foi possível concluir esta interação.';
}
export async function buildWorldPayload(world,{owner,guild,view='room',action='idle',notice='',now=Date.now()}={}){
  if(!world)return noPet();
  const {pet,life,eco}=world,stats=petStats(life,now),lvl=petLevel(life.xp),mood=petMood(stats);
  const away=ts(life.adventureUntil)>now,ready=Boolean(life.adventureUntil)&&!away;
  const owned=new Set(life.ownedRooms.split(','));
  if(away&&action!=='aventura')action='away';
  else if(action==='idle'&&mood==='Sonolento')action='dormir';
  const artPet={...pet,emoji:resolvePetEmoji(pet.emoji,guild)};
  let art;
  try{art=await renderPetWorld(artPet,{theme:life.room,view,action});}catch(error){console.warn('[PET WORLD]',error?.message??error);}
  const container=new ContainerBuilder();
  const top='## '+petDisplayName(pet,guild)+' · '+(view==='room'?'Meu quartinho':'Meu pet')+'\n'+
    '**Nível '+lvl.level+'** · '+lvl.stage+' · '+mood+'\n-# '+lvl.current+' / '+lvl.needed+' XP';
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(top));
  const files=[];
  if(art){
    const filename='pet-world.'+art.ext;
    files.push(new AttachmentBuilder(art.buffer,{name:filename}));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://'+filename)));
  }
  const statText=[
    '🍓 Saciedade  '+bar(stats.fullness)+' **'+stats.fullness+'%**',
    '💗 Felicidade  '+bar(stats.happiness)+' **'+stats.happiness+'%**',
    '🌙 Energia  '+bar(stats.energy)+' **'+stats.energy+'%**',
    '🫧 Higiene  '+bar(stats.hygiene)+' **'+stats.hygiene+'%**',
    '🐾 Vínculo  '+bar(stats.bond)+' **'+stats.bond+'%**'
  ].join('\n');
  const adventure=away?'Explorando · retorna <t:'+Math.floor(ts(life.adventureUntil)/1000)+':R>':ready?'Sua aventura terminou! Recolha a recompensa.':'Pronto para explorar a floresta.';
  const cooldowns=Object.keys(CARE_ACTIONS).map(k=>{
    const wait=petCooldown(life,eco,k,now);return k+': '+(wait?duration(wait):'pronto');
  }).join(' · ');
  const info=(notice?'**'+notice+'**\n\n':'')+statText+'\n\n'+
    '**Aventura:** '+adventure+'\n**Quarto:** '+(ROOM_THEMES[life.room]?.name??'Neon')+'\n-# '+cooldowns+
    (art&&!art.sourceFound&&pet.imageUrl?'\n-# A imagem original não pôde ser carregada; representação alternativa.':'')+
    (art?.ext==='png'?'\n-# Animação indisponível nesta tentativa.':'');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(info));
  const disabled=k=>away||petCooldown(life,eco,k,now)>0;
  const rows=[
    row(button('alimentar',owner,pet.id,'Alimentar','🍓',disabled('alimentar'),ButtonStyle.Success),button('brincar',owner,pet.id,'Brincar','🎾',disabled('brincar'),ButtonStyle.Primary),button('acariciar',owner,pet.id,'Carinho','💗',disabled('acariciar')),button('banho',owner,pet.id,'Banho','🫧',disabled('banho')),button('dormir',owner,pet.id,'Dormir','🌙',disabled('dormir'))),
    row(button('aventura',owner,pet.id,'Explorar','🧭',away||ready),button('coletar',owner,pet.id,'Tesouro','🎁',!ready),button(view==='room'?'ver':'quarto',owner,pet.id,view==='room'?'Ver pet':'Quartinho',view==='room'?'🐾':'🏠'),button('status',owner,pet.id,'Atualizar','🔄'),new ButtonBuilder().setCustomId('profile_pet_btn').setLabel('Meus pets').setEmoji('🐾').setStyle(ButtonStyle.Secondary)),
    row(...Object.entries(ROOM_THEMES).map(([key,p])=>button('tema_'+key,owner,pet.id,p.name+(owned.has(key)?'':' · '+p.price.toLocaleString('pt-BR')+'c'),key==='neon'?'🌌':key==='rose'?'🎀':'🌙',life.room===key)))
  ];
  return {flags,components:[container,...rows],files,allowedMentions:mentionSafe};
}
async function runAction(i,action,{petId=null,legacy=false}={}){
  const isButton=typeof i.isButton==='function'&&i.isButton();
  if(isButton&&!legacy)await i.deferUpdate();
  else await i.deferReply(legacy?{flags:privateFlag}:{});
  const userId=i.user.id,guildId=i.guildId;
  if(!guildId)return i.editReply({content:'Use no servidor.'});
  const world=await getPetWorld(userId,guildId);
  const deliver=payload=>i.editReply(isButton&&!legacy?{attachments:[],...payload}:payload);
  if(!world)return deliver(noPet());
  if(petId&&petId!==world.pet.id)return i.followUp({content:'Seu pet equipado mudou. Abra S pet novamente.',flags:privateFlag});
  let view=action==='ver'?'portrait':'room';
  if(['status','ver','quarto','painel'].includes(action))return deliver(await buildWorldPayload(world,{owner:userId,guild:i.guild,view}));
  const theme=action.startsWith('tema_')?action.slice(5):undefined;
  const result=await changePetWorld({userId,guildId,petId:world.pet.id,action:theme?'tema':action,theme});
  if(!result.ok){
    const updated=await getPetWorld(userId,guildId);
    return deliver(await buildWorldPayload(updated,{owner:userId,guild:i.guild,notice:errorText(result)}));
  }
  const notice=result.notice+(result.amount>0?' +'+result.amount.toLocaleString('pt-BR')+' '+coin():result.amount<0?' −'+Math.abs(result.amount).toLocaleString('pt-BR')+' coins':'')+(result.xp?' · +'+result.xp+' XP':'');
  return deliver(await buildWorldPayload(result,{owner:userId,guild:i.guild,view,action:theme?'idle':action,notice}));
}
const actions=new Set(['painel','ver','quarto','status','brincar','alimentar','acariciar','banho','dormir','aventura','coletar','tema_neon','tema_rose','tema_moon']);
export async function handlePetButton(i){
  const [,action,owner,petId]=i.customId.split(':');
  if(!actions.has(action))return i.reply({content:'Ação de pet inválida.',flags:privateFlag});
  if(owner&&owner!==i.user.id)return i.reply({content:'Este quartinho pertence a outro membro. Use S pet para abrir o seu.',flags:privateFlag});
  // Older shop panels had unbound buttons. Open a private panel instead of editing another member's message.
  return runAction(i,action,{petId,legacy:!owner});
}
const descriptions={
  painel:'Abra o quartinho animado e interaja com seu pet',
  ver:'Veja seu pet animado de perto',quarto:'Abra o quarto do seu pet',status:'Veja atributos e intervalos',
  brincar:'Brinque e ganhe coins',alimentar:'Alimente seu pet',acariciar:'Faça carinho',banho:'Dê um banho',
  dormir:'Deixe seu pet descansar',aventura:'Explore a floresta por 15 minutos',coletar:'Receba o tesouro da aventura'
};
const data=new SlashCommandBuilder().setName('pet').setDescription('Cuide, evolua e personalize seu companheiro');
for(const [name,description] of Object.entries(descriptions))data.addSubcommand(s=>s.setName(name).setDescription(description));
const aliases={b:'brincar',a:'alimentar',c:'acariciar',s:'status',carinho:'acariciar',room:'quarto',explorar:'aventura',tesouro:'coletar'};
export default {
  data,name:'pet',aliases:['meu-pet','meupet'],
  async execute(i){return runAction(i,i.options.getSubcommand());},
  async executePrefix(m,args=[]){
    const sub=args[0]?.toLowerCase()||'painel',action=aliases[sub]??sub;
    if(!actions.has(action))return m.reply('Use S pet, S pet ver, S pet quarto ou uma ação do painel.');
    return runAction({user:m.author,guildId:m.guildId,guild:m.guild,deferReply:async()=>m.channel.sendTyping().catch(()=>{}),editReply:payload=>m.reply(payload)},action);
  }
};
