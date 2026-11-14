import { handleMarriageVoiceStateUpdate } from '../utils/marriageCallTracker.js';
import { handleCallRankVoiceStateUpdate } from '../utils/callRank.js';

export default {
  name: 'voiceStateUpdate',
  once: false,

  async execute(oldState, newState) {
    const userId  = newState.id ?? oldState.id;
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!userId || !guildId) return;

    const member = newState.member ?? oldState.member;
    if (member?.user?.bot) return;

    await handleMarriageVoiceStateUpdate(oldState, newState);
    await handleCallRankVoiceStateUpdate(oldState, newState);
  },
};
