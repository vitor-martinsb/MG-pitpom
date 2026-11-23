import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
// @ts-expect-error Shared native/browser fixture is plain JS.
import {captureSmanata,companionFrame} from './companions-fixture.mjs';
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
const root=new URL('../..',import.meta.url).pathname.replace(/\/$/,'');
for(const style of ['simultaneous','turns'] as const)test(`Benedita/Smanata ${style}: gaze, ownership, manual drop, next shot and synchronized safe return`,async()=>{
 const room=new Room('DOGS',root,['data/levels/level-3.level'],defaults,()=>0),a=socket(),b=socket();
 try{
  (room as any).physicsSeed=6;const host=room.join(a,'Host','#ffffff',0),guest=room.join(b,'Guest','#ff0000',1);
  await room.start(host,1,'classic',style);room.ready(host,0);room.ready(guest,0);
  const captured=await captureSmanata(room,host,undefined,true);assert.equal(captured.gazed,true);assert.equal(host.ball!.captureKind,8);assert.equal(host.ball!.strokes,1);
  const request={hole:room.hole,match:room.match};
  await assert.rejects(room.releaseSmanata(guest,request),/indisponível/);
  await assert.rejects(room.releaseSmanata(host,{...request,match:room.match+1}),/indisponível/);
  await assert.rejects(room.shot(host,{sequence:2,direction:[1,0,0],power:.1}),/indisponível/);
  if((room as any).mascots.companions.smanata.state!==3)await assert.rejects(room.releaseSmanata(host,request),/pronta/);
  for(let i=0;i<80&&(room as any).mascots.companions.smanata.state!==3;i++)await companionFrame(room);
  assert.equal((room as any).mascots.companions.smanata.state,3);
  const animal=structuredClone((room as any).mascots.companions.smanata),other=structuredClone(guest.ball);
  await companionFrame(room,1200);assert.equal(host.ball!.captureKind,8);assert.equal(host.ball!.strokes,1);
  assert.deepEqual(a.messages.findLast(m=>m.type==='snapshot').mascots,b.messages.findLast(m=>m.type==='snapshot').mascots);
  await room.releaseSmanata(host,{...request,player:guest.id});
  assert.equal(host.ball!.captured,false);assert.equal(host.ball!.captureKind,0);assert.equal(host.ball!.captureUntil,0);assert.equal(host.ball!.moving,false);assert.equal(host.ball!.strokes,1);
  assert.deepEqual(host.ball!.vel,[0,0,0]);assert.ok(Math.abs(host.ball!.pos[0]!-animal.pos[0]!)<.0002&&Math.abs(host.ball!.pos[2]!-animal.pos[2]!)<.0002);
  assert.equal(guest.ball!.strokes,other!.strokes);assert.equal(guest.ball!.captureKind,other!.captureKind);
  await assert.rejects(room.releaseSmanata(host,request),/indisponível/);
  if(style==='turns'){
   await room.tick();assert.equal(room.turn,guest.id);
   await assert.rejects(room.shot(host,{sequence:3,direction:[1,0,0],power:.1}),/indisponível/);
   await room.shot(guest,{sequence:1,direction:[1,0,0],power:.1});
   for(let i=0;i<100&&guest.ball!.moving;i++)await companionFrame(room);
   await room.tick();assert.equal(room.turn,host.id);
  }
  for(let i=0;i<120&&(host.ball!.moving||host.ball!.captureUntil);i++)await companionFrame(room);
  await room.shot(host,{sequence:4,direction:[1,0,0],power:.1});assert.equal(host.ball!.strokes,2);
  for(let i=0;i<120&&(room as any).mascots.companions.smanata.state!==5&&(room as any).mascots.companions.smanata.state!==0;i++)await companionFrame(room);
  const returned=(room as any).mascots.companions.smanata;assert.ok(returned.state===5||returned.state===0);assert.ok(Math.hypot(...returned.pos.map((x:number,i:number)=>x-returned.home[i]))<.001);
 }finally{room.close();}
});


test('a bot explicitly recovers its own Smanata ball without an extra stroke',async()=>{
 const room=new Room('SMBOT',root,['data/levels/level-3.level'],defaults,()=>0),host=room.join(socket(),'Host','#ffffff',0);
 try{
  (room as any).physicsSeed=6;room.botSettings(host,'add',null,{difficulty:'medium'});const bot=[...room.members.values()].find(m=>m.bot)!;
  await room.start(host,1,'classic','simultaneous');room.ready(host,0);await captureSmanata(room,bot);
  assert.equal(bot.ball!.captureKind,8);await room.tick();assert.equal(bot.ball!.captureKind,0);assert.equal(bot.ball!.strokes,1);
  assert.deepEqual(bot.ball!.vel,[0,0,0]);assert.equal((room as any).mascots.companions.smanata.state,4);
 }finally{room.close();}
});
