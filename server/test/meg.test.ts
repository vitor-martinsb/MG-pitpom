import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
// @ts-expect-error Shared browser/native fixture is intentionally plain JS.
import {captureMeg,finishMegRelease} from './meg-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
async function fixture(style:'turns'|'simultaneous'){
 const room=new Room('MEG',root,['data/levels/level-2.level'],defaults,()=>0),a=socket(),b=socket();
 (room as any).physicsSeed=7;
 const host=room.join(a,'Host','#ffffff',0),guest=room.join(b,'Guest','#ff0000',1);
 await room.start(host,1,'classic',style);room.ready(host,0);room.ready(guest,0);
 return {room,host,guest,a,b};
}
for(const style of ['turns','simultaneous'] as const)test(`Meg ${style}: real capture, owner-only manual release and synchronized max force without another stroke`,async()=>{
 const {room,host,guest,a,b}=await fixture(style),physics=(room as any).physics;
 try{
  await captureMeg(room,style==='turns'?[host]:[host,guest]);
  const request={hole:room.hole,match:room.match};
  const before=structuredClone(guest.ball);const originalSequence=host.lastSequence;
  for(let i=0;i<6;i++){const frame=await physics.step(1200);assert.equal(frame.players.find((p:any)=>p.id===host.id).captureKind,6);}
  if(style==='turns'){
   await room.tick();assert.equal(room.turn,host.id,'holding cannot finish the current stroke or advance the turn');
   await assert.rejects(room.releaseMeg(guest,request),/indisponível/);
  }
  await assert.rejects(room.shot(host,{sequence:2,direction:[1,0,0],power:1}),/indisponível/);
  await assert.rejects(room.releaseMeg(host,{...request,hole:1}),/indisponível/);
  await assert.rejects(room.releaseMeg(host,{...request,match:room.match+1}),/indisponível/);
  await assert.rejects(room.releaseMeg({...host,id:999},request),/indisponível/);
  await room.releaseMeg(host,{...request,player:guest.id,direction:[1,0,0],power:0});
  assert.equal(host.ball!.captureKind,6);assert.equal(host.ball!.captured,true);assert.deepEqual(host.ball!.vel,[0,0,0]);
  assert.ok(host.ball!.captureUntil<1e30);await assert.rejects(room.releaseMeg(host,request),/indisponível/);
  await finishMegRelease(room,[host]);
  assert.equal(host.ball!.strokes,1);assert.equal(host.ball!.captureKind,0);assert.equal(host.ball!.moving,true);
  assert.ok(Math.abs(Math.hypot(...host.ball!.vel)-20)<.0001);
  assert.equal(guest.ball!.captureKind,before!.captureKind,'another participant keeps their own hold');assert.equal(guest.ball!.strokes,before!.strokes);
  assert.equal(host.ball!.vel[1],0);assert.ok(Math.abs(host.ball!.pos[1]-(-.375+ .12))<.002,'released at floor height plus the ball radius');
  assert.equal(host.lastSequence,originalSequence+1,'only the deliberately rejected shot consumes a shot sequence');
  assert.deepEqual(a.messages.findLast(m=>m.type==='snapshot').players,b.messages.findLast(m=>m.type==='snapshot').players);
  await assert.rejects(room.releaseMeg(host,request),/indisponível/);
  if(style==='simultaneous'){await room.releaseMeg(guest,request);await finishMegRelease(room,[guest]);assert.equal(guest.ball!.strokes,1);assert.equal(guest.ball!.captureKind,0);}
 }finally{room.close();}
});

test('a captured bot explicitly taps Meg through the same authority without another stroke or stalled planning',async()=>{
 const room=new Room('MEGBOT',root,['data/levels/level-2.level'],defaults,()=>0),host=room.join(socket(),'Host','#ffffff',0);
 try{
  (room as any).physicsSeed=7;room.botSettings(host,'add',null,{difficulty:'medium'});
  const bot=[...room.members.values()].find(m=>m.bot)!;
  await room.start(host,1,'classic','simultaneous');room.ready(host,0);
  await captureMeg(room,[bot]);assert.equal(bot.ball!.captureKind,6);
  await room.tick();assert.equal(bot.ball!.captureKind,6);await room.tick();assert.equal(bot.ball!.captureKind,6);
  await finishMegRelease(room,[bot]);assert.equal(bot.ball!.captureKind,0);assert.equal(bot.ball!.strokes,1);assert.equal(bot.ball!.moving,true);
  assert.ok(Math.abs(Math.hypot(...bot.ball!.vel)-20)<.0001);
 }finally{room.close();}
});
