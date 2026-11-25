import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleChatText,levelFromXp,totalXpForLevel,xpProgress,MESSAGES_PER_LEVEL} from '../src/utils/chatLevelMath.js';
test('exatamente 50 mensagens válidas por nível, sem curva crescente',()=>{
  assert.equal(MESSAGES_PER_LEVEL,50);
  for(let n=0;n<1000;n++){
    assert.equal(totalXpForLevel(n),n*50);
    assert.equal(levelFromXp(n*50),n);
    assert.equal(levelFromXp(n*50+49),n);
  }
  assert.deepEqual(xpProgress(0),{level:0,current:0,required:50,remaining:50,percent:0});
  assert.deepEqual(xpProgress(49),{level:0,current:49,required:50,remaining:1,percent:.98});
  assert.deepEqual(xpProgress(50),{level:1,current:0,required:50,remaining:50,percent:0});
  assert.deepEqual(xpProgress(123),{level:2,current:23,required:50,remaining:27,percent:.46});
});
test('conta conversa curta, não comandos, links soltos ou spam trivial',()=>{
  for(const msg of ['oi','sim','kkk','💗','Olá pessoal, tudo certo?'])assert.equal(eligibleChatText(msg),true,msg);
  for(const msg of ['','aaaaaaaaaaaaaa','/help comando','!ban usuario','savage ajuda','s nivel','.gf @alguém','safk teste','https://site.com/link','www.site.com/xyz'])assert.equal(eligibleChatText(msg),false,msg);
});
