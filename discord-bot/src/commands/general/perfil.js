import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';
import prisma from '../../database/client.js';
import { getMemberLevel } from '../../utils/chatLevel.js';
import { generateProfileCard }         from '../../utils/profileCard.js';
import { generateAnimatedProfileCard, generateStaticProfileGifCard } from '../../utils/animatedProfileCard.js';
import { resolveBanner }               from '../../utils/shopData.js';
import { normalizeAppearance } from '../../utils/profileStudioArt.js';
import { listInteractionStreaks } from '../../utils/interactionStreak.js';
import { isGifProfileBanner }           from '../../utils/profileBannerFormat.js';
import { getEmoji }                    from '../../utils/emojiManager.js';

const REFRESH = () => getEmoji('refresh_button');

async function getGuildBadgeEmojis(guildId) {
  const overrides = await prisma.guildBadgeEmoji.findMany({ where: { guildId } }).catch(() => []);
  const map = {};
  for (const o of overrides) map[o.badgeKey] = o.emoji;
  return map;
}

async function fetchProfileData(userId, guildId) {
  const [eco, profile, purchases, guildBadgeEmojis, chatLevel] = await Promise.all([
    prisma.economy.findUnique({ where: { userId_guildId: { userId, guildId } } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userPurchase.count({ where: { userId } }),
    getGuildBadgeEmojis(guildId),
    getMemberLevel(guildId, userId),
  ]);
  return { eco, profile, purchases, guildBadgeEmojis, chatLevel };
}

export async function renderProfileAttachment(cardParams) {
  const banner = await resolveBanner(
    cardParams.activeBanner,
    cardParams.guildId,
    { includeImageData: true },
  );
  const bannerIsGif = isGifProfileBanner(banner);
  const renderParams = { ...cardParams, _resolvedBanner: banner };

  const effect=normalizeAppearance(cardParams.appearance).effect;
  if (effect!=='off'&&(bannerIsGif||effect!=='banner')) {
    try {
      return {
        buf: await generateAnimatedProfileCard(renderParams),
        filename: 'perfil.gif',
      };
    } catch (error) {
      // A tentativa animada precisa terminar antes do renderizador estático:
      // o encoder nativo não pode ser cancelado com segurança.
      console.warn('[perfil] Não foi possível animar; usando GIF estático:', error?.message ?? error);
      return {
        buf: await generateStaticProfileGifCard(renderParams),
        filename: 'perfil.gif',
      };
    }
  }

  return {
    buf: await generateProfileCard(renderParams),
    filename: 'perfil.png',
  };
}

function profileEditMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('profile_menu')
      .setPlaceholder('✨ Personalizar perfil...')
      .addOptions([
        { label: 'Estúdio de perfil', value: 'profile_studio', emoji: '✨' },
        { label: 'Banner',      value: 'profile_banner_btn',     emoji: '🖼️' },
        { label: 'Argola',      value: 'profile_ring_btn',       emoji: '💠' },
        { label: 'Molduras VIP', value: 'profile_ring_vip',      emoji: '👑' },
        { label: 'Fundo',       value: 'profile_bg_btn',         emoji: '🎨' },
        { label: 'Painel',      value: 'profile_panel_btn',      emoji: '🟦' },
        { label: 'Pet',         value: 'profile_pet_btn',        emoji: '🐾' },
        { label: 'Conquistas',  value: 'profile_conquistas_btn', emoji: '🏅' },
      ]),
  );
}

export function profileRefreshRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`profile_refresh:${userId}`)
      .setLabel('Atualizar')
      .setEmoji(REFRESH())
      .setStyle(ButtonStyle.Secondary),
  );
}

export async function buildProfilePayload({ userId, guildId, guild, target, includeCustomization = false }) {
  const member = await guild.members.fetch(userId).catch(() => null);
  const { eco, profile, purchases, guildBadgeEmojis, chatLevel } = await fetchProfileData(userId, guildId);

  let activePetEmoji = null;
  if (profile?.activePet) {
    const pet = await prisma.pet.findUnique({ where: { id: profile.activePet } }).catch(() => null);
    activePetEmoji = pet?.emoji ?? null;
  }

  const streaks=await listInteractionStreaks(guildId,userId).catch(()=>[]);
  const appearance=normalizeAppearance({theme:profile?.profileTheme,effect:profile?.profileEffect,decor:profile?.profileDecor,signature:profile?.profileSignature});
  const cardParams = {
    appearance,
    marriedStreak: streaks.find(s=>s.partnerId===profile?.marriedTo)?.days??0,
    friendStreak: streaks.find(s=>s.partnerId===profile?.bestFriendId)?.days??0,
    username:        member?.displayName ?? target.username,
    avatarUrl:       target.displayAvatarURL({ extension: 'png', size: 256 }),
    balance:         eco?.balance          ?? 0,
    bank:            eco?.bank             ?? 0,
    xp:              chatLevel.xp, // 1 XP por mensagem válida
    chatLevel, // usa o mesmo snapshot de nível e progresso que /nivel
    activeBanner:    profile?.activeBanner  ?? null,
    activeRing:      profile?.activeRing    ?? null,
    ringBorderColor: profile?.ringBorderColor ?? null,
    activePet:       activePetEmoji,
    marriedToName:   profile?.marriedToName  ?? null,
    bestFriendName:  profile?.bestFriendName ?? null,
    reps:            profile?.reps           ?? 0,
    bio:             profile?.bio            ?? null,
    cardBg1:         profile?.cardBg1        ?? null,
    cardBg2:         profile?.cardBg2        ?? null,
    cardPanelColor:  profile?.cardPanelColor ?? null,
    purchases,
    guildBadgeEmojis,
    guildId,
  };

  const { buf, filename } = await renderProfileAttachment(cardParams);
  const components = [];
  if (includeCustomization) components.push(profileEditMenu());
  components.push(profileRefreshRow(userId));

  return {
    files: [new AttachmentBuilder(buf, { name: filename })],
    components,
    content: null,
    allowedMentions: {parse:[],repliedUser:false},
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('🪪 Ver seu card de perfil com banner equipado'),
  name: 'perfil',
  aliases: ['profile', 'card'],

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // A renderização pode envolver download e composição de imagens. Atualiza
      // primeiro para o Discord não ficar preso mostrando apenas "pensando...".
      await interaction.editReply({ content: '⏳ Gerando seu perfil…' });

      const target = interaction.user;
      return interaction.editReply(await buildProfilePayload({
        userId: target.id,
        guildId: interaction.guildId,
        guild: interaction.guild,
        target,
        includeCustomization: true,
      }));
    } catch (error) {
      console.error('[perfil] Falha ao responder slash:', error?.stack ?? error);
      return interaction.editReply({
        content: '❌ Não consegui carregar seu perfil agora. Tente novamente em alguns segundos.',
        components: [],
      }).catch(() => {});
    }
  },

  async executePrefix(message) {
    // Se mencionar alguém, mostra o perfil dessa pessoa
    const target = message.mentions.users.first() ?? message.author;
    return message.reply(await buildProfilePayload({
      userId: target.id,
      guildId: message.guildId,
      guild: message.guild,
      target,
      includeCustomization: target.id===message.author.id,
    }));
  },
};
