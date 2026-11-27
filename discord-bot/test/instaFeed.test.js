import test from 'node:test';
import assert from 'node:assert/strict';
import {loadImage} from '@napi-rs/canvas';
import {INSTA_EMOJI_ASSETS} from '../src/utils/instaEmojiAssets.js';
import {buildInstaPost,updateInstaCounts,toggleInstaVote,getInstaVotes,nextVote} from '../src/utils/instaFeed.js';
import prisma from '../src/database/client.js';
test('four uploaded icons decode',async()=>{for(const value of Object.values(INSTA_EMOJI_ASSETS)){const im=await loadImage(Buffer.from(value,'base64'));assert.equal(im.width,48);assert.equal(im.height,48);}});
test('reference container layout',()=>{
 const c=buildInstaPost({postId:'123_456',authorId:'123456789012345678',imageUrl:'attachment://post.png'}).components[0].toJSON();
 assert.equal(c.accent_color,0xffffff);assert.deepEqual(c.components.map(x=>x.type),[10,14,12,14,1]);
 const buttons=c.components[4].components;assert.equal(buttons.length,4);assert.ok(buttons.every(b=>b.style===2&&b.emoji));
 assert.deepEqual(buttons.map(b=>b.label),['0','0',undefined,undefined]);
 const [updated]=updateInstaCounts([c],'123_456',{yes:['1','2'],no:['3']});
 assert.deepEqual(updated.components[4].components.map(b=>b.label),['2','1',undefined,undefined]);assert.deepEqual(updated.components.slice(0,4),c.components.slice(0,4));
});
test('exclusive persisted votes toggle and switch',async()=>{
 const postId='insta-test-'+Date.now();
 try{assert.equal(nextVote(1,1),null);await toggleInstaVote(postId,'one',1);await toggleInstaVote(postId,'two',-1);await toggleInstaVote(postId,'one',-1);assert.equal((await getInstaVotes(postId)).no.length,2);await toggleInstaVote(postId,'one',-1);assert.deepEqual((await getInstaVotes(postId)).no,['two']);}
 finally{await prisma.instaVote.deleteMany({where:{postId}});await prisma.$disconnect();}
});
