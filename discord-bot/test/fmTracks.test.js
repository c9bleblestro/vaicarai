import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFmTrack, matchCatalog, rankCandidates, safeArtworkUrl } from '../src/utils/fmTracks.js';
import { validQuery, validTrackUrl, trackPlatform, extractorFailure, fmSourceError } from '../src/utils/fmAudio.js';
const sc='https://soundcloud.com/the-weeknd/die-for-you';
const yt='https://www.youtube.com/watch?v=abcdefghijk';
const sp='https://open.spotify.com/track/1234567890123456789012';
const song={title:'Die For You',uploader:'The Weeknd',duration:'4:20',durationSeconds:260,thumbnail:'https://i1.sndcdn.com/artworks-test-large.jpg',url:sc};
const album={trackName:'Die For You',artistName:'The Weeknd',collectionName:'Starboy',artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/test/100x100bb.jpg'};
const other={...album,artistName:'Other Singer',collectionName:'Wrong Album'};
test('links individuais e fontes permitidas; nunca usa uma URL arbitrária',()=>{
  for(const url of [sc,yt,'https://youtu.be/abcdefghijk','https://music.youtube.com/watch?v=abcdefghijk'])assert.equal(validTrackUrl(url),true);
  assert.equal(trackPlatform(sp),'spotify');assert.equal(validTrackUrl(sp),false);
  assert.equal(validQuery(sp),true);assert.equal(validQuery('Die For You The Weeknd'),true);
  for(const url of ['https://youtube.com.evil.invalid/watch?v=abcdefghijk','https://open.spotify.com/playlist/1234567890123456789012','https://youtube.com/playlist?list=abc','https://soundcloud.com/user/sets/playlist','https://127.0.0.1/a','text https://evil.invalid'])assert.equal(validQuery(url),false);
  assert.equal(safeArtworkUrl('http://example.invalid/image.jpg'),null);
});
test('capa real só corresponde à faixa e artista, sem usar capa aleatória',()=>{
  assert.equal(matchCatalog([other,album],song),album);
  assert.equal(matchCatalog([other],song),null);
  assert.equal(matchCatalog([album],{...song,title:'Die For You Remix'}),null);
  assert.equal(rankCandidates('Die For You The Weeknd',[{...song,title:'Die For You remix'},{...song,title:'Die For You',uploader:'Other Singer'},song])[0],song);
});
test('link direto permanece na fonte solicitada, álbum aparece em alta resolução',async()=>{
  const calls=[];
  const result=await resolveFmTrack(yt,{inspect:async url=>{calls.push(url);return {...song,url:yt};},search:async()=>{throw new Error('não deve pesquisar');},catalog:async()=>[other,album]});
  assert.deepEqual(calls,[yt]);
  assert.equal(result.url,yt);assert.equal(result.platform,'youtube');
  assert.equal(result.album,'Starboy');assert.match(result.artwork,/600x600bb/);
});
test('Spotify resolve por título e artista sem fingir que reproduz o Spotify',async()=>{
  const calls=[];
  const result=await resolveFmTrack(sp,{spotify:async()=>({title:'Die For You',artist:'The Weeknd',artwork:'https://i.scdn.co/image/test'}),search:async q=>{calls.push(q);return [{...song,title:'Die For You Remix'},song];},inspect:async url=>{assert.equal(url,sc);return song;},catalog:async()=>[album]});
  assert.deepEqual(calls,['Die For You The Weeknd']);assert.equal(result.platform,'soundcloud');
  assert.equal(result.artwork,'https://i.scdn.co/image/test');assert.equal(result.album,'Starboy');
});
test('pesquisa não aceita remix por engano e conserva imagem da faixa sem capa confirmada',async()=>{
  const result=await resolveFmTrack('Die For You The Weeknd',{search:async()=>[song],inspect:async()=>song,catalog:async()=>[other]});
  assert.equal(result.album,null);assert.match(result.artwork,/-t500x500/);
  await assert.rejects(resolveFmTrack('Die For You The Weeknd',{search:async()=>[{...song,title:'Die For You Remix'}],inspect:async()=>({...song,title:'Die For You Remix'}),catalog:async()=>[]}),/Não encontrei/);
  await assert.rejects(resolveFmTrack(yt,{inspect:async()=>{throw new Error('bloqueado');},search:async()=>[song],youtube:async()=>{throw new Error('sem metadata');}}),/indisponível/);
});

test('falha técnica não é confundida com música indisponível',()=>{
  assert.equal(extractorFailure({code:'ENOENT'}),'EXTRACTOR_MISSING');
  assert.equal(extractorFailure({stderr:'ERROR: Sign in to confirm you are not a bot'}),'SOURCE_RESTRICTED');
  assert.equal(extractorFailure({killed:true}),'SOURCE_TIMEOUT');
  assert.equal(extractorFailure({stderr:'Requested format is not available'}),'FORMAT_UNAVAILABLE');
});
test('YouTube indisponível: identifica faixa e tenta publicação correspondente, sem ocultar a troca',async()=>{
  const calls=[];
  const result=await resolveFmTrack(yt,{inspect:async url=>{calls.push(url);if(url===yt)throw fmSourceError('SOURCE_RESTRICTED');return song;},
    youtube:async()=>({title:'Die For You (Official Audio)',artist:'The Weeknd - Topic'}),search:async q=>{assert.equal(q,'Die For You The Weeknd');return [song];},catalog:async()=>[album]});
  assert.deepEqual(calls,[yt,sc]);assert.equal(result.sourceFallback,true);assert.equal(result.requestedPlatform,'youtube');
  assert.equal(result.platform,'soundcloud');assert.equal(result.album,'Starboy');
});
test('não troca por faixa diferente e não tenta contornar ausência do extrator',async()=>{
  await assert.rejects(resolveFmTrack(yt,{inspect:async()=>{throw fmSourceError('EXTRACTOR_MISSING');},youtube:async()=>{throw Error('não deve consultar');}}),e=>e.code==='EXTRACTOR_MISSING');
  await assert.rejects(resolveFmTrack(yt,{inspect:async()=>{throw fmSourceError('SOURCE_RESTRICTED');},youtube:async()=>({title:'Die For You',artist:'The Weeknd'}),search:async()=>[{...song,title:'Die For You Remix'}]}),e=>e.code==='SOURCE_RESTRICTED');
});
test('busca não desiste quando o primeiro candidato não está disponível',async()=>{
  const second={...song,url:'https://soundcloud.com/artist/second'};
  const result=await resolveFmTrack('Die For You The Weeknd',{search:async()=>[song,second],inspect:async url=>{if(url===sc)throw fmSourceError('SOURCE_UNAVAILABLE');return second;},catalog:async()=>[album]});
  assert.equal(result.url,second.url);
});
