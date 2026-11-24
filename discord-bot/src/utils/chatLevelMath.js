/** XP de conversa integrado ao saldo de XP (não às moedas) da economia. */
export const MESSAGE_XP_COOLDOWN_MS = 45_000;
export const DUPLICATE_MESSAGE_WINDOW_MS = 300_000;
export const CHAT_XP_MIN = 12;
export const CHAT_XP_MAX = 20;
export function totalXpForLevel(level) {
  const n=Math.max(0,Math.trunc(level)-1);
  return 40*n*n+160*n;
}
export function levelFromXp(xp) {
  const points=Math.max(0,Math.floor(Number(xp)||0));
  return 1+Math.max(0,Math.floor((Math.sqrt(25_600+160*points)-160)/80));
}
export function xpProgress(xp) {
  const level=levelFromXp(xp);
  const base=totalXpForLevel(level);
  const required=totalXpForLevel(level+1)-base;
  const current=Math.max(0,Math.floor(Number(xp)||0)-base);
  return {level,current,required,remaining:Math.max(0,required-current),percent:Math.min(1,current/required)};
}
export function eligibleChatText(text) {
  const raw=String(text??'').trim();
  if(raw.length<8 || raw.length>4000)return false;
  if(/^(?:\/|!|\.gf\b|safk\b|savage\s|s\s)/i.test(raw))return false;
  if(!/[\p{L}\p{N}]/u.test(raw))return false;
  if(/^(?:https?:\/\/|www\.)\S+$/i.test(raw))return false;
  const letters=raw.replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
  if(letters.length<6)return false;
  if(new Set([...letters]).size<3)return false;
  return true;
}
