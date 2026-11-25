/** Um ponto de XP por mensagem válida; 50 pontos por nível. */
export const MESSAGES_PER_LEVEL = 50;
export const DUPLICATE_MESSAGE_WINDOW_MS = 300_000;
export function totalXpForLevel(level) {
  return Math.max(0,Math.trunc(Number(level)||0))*MESSAGES_PER_LEVEL;
}
export function levelFromXp(xp) {
  return Math.floor(Math.max(0,Math.floor(Number(xp)||0))/MESSAGES_PER_LEVEL);
}
export function xpProgress(xp) {
  const points=Math.max(0,Math.floor(Number(xp)||0));
  const level=levelFromXp(points), current=points-totalXpForLevel(level);
  const required=MESSAGES_PER_LEVEL;
  return {level,current,required,remaining:required-current,percent:current/required};
}
export function eligibleChatText(text) {
  const raw=String(text??'').trim();
  if(!raw || raw.length>4000)return false;
  if(/^(?:\/|!|\.gf\b|safk\b|savage\s|s\s)/i.test(raw))return false;
  if(/^(?:https?:\/\/|www\.)\S+$/i.test(raw))return false;
  if(!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(raw))return false;
  // Aceita mensagens curtas reais ("oi", "sim", emoji), mas não spam longo de um caractere.
  const chars=[...raw.replace(/\s+/g,'').toLocaleLowerCase('pt-BR')];
  if(chars.length>=6&&new Set(chars).size===1)return false;
  return true;
}
