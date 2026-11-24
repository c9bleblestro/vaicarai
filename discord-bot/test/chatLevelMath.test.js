import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eligibleChatText,levelFromXp,totalXpForLevel,xpProgress,
  MESSAGE_XP_COOLDOWN_MS,DUPLICATE_MESSAGE_WINDOW_MS,
} from '../src/utils/chatLevelMath.js';

test('a curva de chat começa no nível zero e cresce',()=>{
  assert.equal(totalXpForLevel(0),0);
  assert.equal(totalXpForLevel(1),200);
  assert.equal(totalXpForLevel(2),480);
  assert.equal(levelFromXp(0),0);
  assert.equal(levelFromXp(199),0);
  assert.equal(levelFromXp(200),1);
  assert.equal(levelFromXp(479),1);
  assert.equal(levelFromXp(480),2);
  assert.equal(levelFromXp(840),3);
});
test('progresso usa XP reais e informa quanto falta',()=>{
  assert.deepEqual(xpProgress(0),{level:0,current:0,required:200,remaining:200,percent:0});
  const p=xpProgress(211);
  assert.equal(p.level,1);
  assert.equal(p.current,11);
  assert.equal(p.required,280);
  assert.equal(p.remaining,269);
  assert.ok(p.percent>0&&p.percent<1);
});
test('XP apenas por mensagens de conversa, não por comandos ou spam trivial',()=>{
  assert.equal(eligibleChatText('Olá pessoal, tudo certo por aqui?'),true);
  assert.equal(eligibleChatText('Hoje vou jogar com vocês mais tarde'),true);
  for(const msg of ['','oi','aaaaaaaaaaaaaa','12345678999999999999','/help comando','!ban usuario',
    'savage ajuda','s ajuda','.gf @alguém','safk teste','https://site.com/link','www.site.com/xyz']){
    assert.equal(eligibleChatText(msg),false,msg);
  }
  assert.equal(MESSAGE_XP_COOLDOWN_MS,45000);
  assert.equal(DUPLICATE_MESSAGE_WINDOW_MS,300000);
});
test('a progressão aguenta XP alto sem arredondar níveis para valores falsos',()=>{
  for(const xp of [0,1,199,200,201,700,840,10000,1000000]){
    const lvl=levelFromXp(xp);
    assert.ok(xp>=totalXpForLevel(lvl));
    assert.ok(xp<totalXpForLevel(lvl+1));
  }
});
