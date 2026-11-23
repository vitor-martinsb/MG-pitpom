import test from 'node:test';
import assert from 'node:assert/strict';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
// @ts-expect-error Native/browser fixture shares real shots.
import {captureAlfredo} from './alfredo-fixture.mjs';
// @ts-expect-error Shared frame fixture.
import {companionFrame} from './companions-fixture.mjs';
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
const root=new URL('../..',import.meta.url).pathname.replace(/\/$/,'');
for(const style of ['simultaneous','turns'] as const)test(`Alfredo ${style}: real capture, three rebounds, fourth aerial kick, authoritative sync and turn/score preservation`,async()=>{
 const room=new Room('ALFR',root,['data/levels/level-1.level'],defaults,()=>0),a=socket(),b=socket();
 try{
  (room as any).physicsSeed=7;const host=room.join(a,'Host','#ffffff',0),guest=room.join(b,'Guest','#ff0000',1);
  await room.start(host,1,'classic',style);room.ready(host,0);room.ready(guest,0);
  await captureAlfredo(room,host);assert.equal(host.ball!.captureKind,9);assert.equal(host.ball!.strokes,1);
  await assert.rejects(room.shot(host,{sequence:2,direction:[1,0,0],power:.1}),/indisponível/);
  const seen=new Set<number>();let released=false,above=false;
  for(let i=0;i<900;i++){
   const f=await companionFrame(room,1),cat=f.mascots.companions.alfredo,ball=host.ball!;
   assert.deepEqual(a.messages.findLast(m=>m.type==='snapshot').mascots,b.messages.findLast(m=>m.type==='snapshot').mascots);
   if(cat.state===4){seen.add(cat.beats);above||=ball.pos[1]!>cat.pos[1]+.9;assert.equal(ball.captureKind,9);assert.equal(ball.captured,false);}
   if(cat.state===5){assert.equal(cat.beats,4);assert.equal(ball.captureKind,0);assert.equal(ball.captureUntil,0);assert.ok(ball.vel[1]!>3);released=true;break;}
   assert.equal(ball.strokes,1);if(style==='turns')assert.equal(room.turn,host.id);
  }
  assert.deepEqual([...seen],[1,2,3]);assert.ok(released&&above);assert.equal(host.ball!.strokes,1);assert.equal(guest.ball!.strokes,0);
  for(let i=0;i<180&&(host.ball!.moving||host.ball!.captureUntil);i++)await companionFrame(room,30);
  assert.equal(host.ball!.captureKind,0);assert.equal(host.ball!.captureUntil,0);assert.equal(host.ball!.moving,false);
  if(style==='turns'){await room.tick();assert.equal(room.turn,guest.id);await room.shot(guest,{sequence:1,direction:[1,0,0],power:.1});}
  else{await room.shot(host,{sequence:3,direction:[1,0,0],power:.1});assert.equal(host.ball!.strokes,2);}
 }finally{room.close();}
});
