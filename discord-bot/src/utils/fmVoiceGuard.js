const reserved=new Set();
export function isFmVoiceReserved(guildId){return reserved.has(guildId);}
export function reserveFmVoice(guildId){if(reserved.has(guildId))return false;reserved.add(guildId);return true;}
export function releaseFmVoice(guildId){reserved.delete(guildId);}
