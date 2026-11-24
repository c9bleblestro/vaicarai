import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatLevelImage} from '../src/utils/chatLevelCard.js';

test('a arte rosa é um PNG real e usa dados do perfil, sem avatar externo',async()=>{
  const buffer=await createChatLevelImage({
    displayName:'Pessoa no Servidor',
    username:'usuario_exemplo',
    fromLevel:1,toLevel:2,totalXp:211,
    avatarUrl:null,
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length>10000);
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(buffer.readUInt32BE(16),1600);
  assert.equal(buffer.readUInt32BE(20),430);
});
test('a arte pode mostrar progresso normal sem fingir subida',async()=>{
  const buf=await createChatLevelImage({
    displayName:'Pessoa',
    username:'user',
    mode:'progress',fromLevel:2,toLevel:2,totalXp:211,
  });
  assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
