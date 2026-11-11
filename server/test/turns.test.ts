import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
async function fixture(style:'turns'|'simultaneous'='turns'){
 let now=0;const room=new Room('TURNS',root,['data/levels/level-1.level'],{...defaults,duration:300000},()=>now),a=socket(),b=socket();
 const host=room.join(a,'Host','#ffffff',0),guest=room.join(b,'Guest','#ff0000',1);
 await room.start(host,1,'classic',style);room.ready(host,0);room.ready(guest,0);
 return {room,host,guest,a,b,async tick(){now+=50;await room.tick();}};
}
const shot=(sequence:number)=>({sequence,direction:[1,0,0],power:.01});
test('turns authorize one stroke, reject duplicates and advance only after the authoritative ball settles',async()=>{
 const f=await fixture();const {room,host,guest}=f;
 try{
  assert.equal(room.turn,host.id);assert.deepEqual(room.state().turnOrder,[host.id,guest.id]);
  await assert.rejects(room.shot(guest,shot(1)),/indisponível/);
  const first=room.shot(host,shot(1));await assert.rejects(room.shot(host,shot(2)),/indisponível/);await first;
  assert.equal(room.turn,host.id);assert.equal(host.ball!.strokes,1);
  for(let i=0;i<600&&room.turn===host.id;i++){await f.tick();if(host.ball!.moving)assert.equal(room.turn,host.id);}
  assert.equal(room.turn,guest.id);assert.equal(host.ball!.moving,false);
  assert.deepEqual(room.state().turnOrder,[guest.id,host.id]);
  await room.shot(guest,shot(2));assert.equal(guest.ball!.strokes,1);
  assert.equal(f.a.messages.findLast(m=>m.type==='snapshot').turn,f.b.messages.findLast(m=>m.type==='snapshot').turn);
 }finally{room.close();}
});
test('disconnecting during a stroke releases a turn even though disconnected balls stop being simulated',async()=>{
 const f=await fixture();try{
  await f.room.shot(f.host,shot(1));f.room.disconnect(f.host,f.a);assert.equal(f.room.turn,f.guest.id);
  const reconnected=await f.room.reconnect(socket(),f.host.token);assert.equal(reconnected.id,f.host.id);f.room.ready(reconnected,0);
  assert.equal(f.room.turn,f.guest.id);assert.deepEqual(f.room.state().turnOrder,[f.guest.id,f.host.id]);
 }finally{f.room.close();}
});
test('finished players are skipped; simultaneous mode accepts both players independently; guests cannot change turn policy',async()=>{
 for(const style of ['turns','simultaneous'] as const){const f=await fixture(style);try{
  assert.throws(()=>f.room.configure(f.guest,1,'classic','turns'),/anfitrião/);
  if(style==='simultaneous'){await Promise.all([f.room.shot(f.host,shot(1)),f.room.shot(f.guest,shot(1))]);assert.equal(f.host.ball!.strokes,1);assert.equal(f.guest.ball!.strokes,1);}
  else {f.host.ball!.hole=true;(f.room as any).rotateTurn();assert.equal(f.room.turn,f.guest.id);assert.deepEqual(f.room.state().turnOrder,[f.guest.id]);}
 }finally{f.room.close();}}
});
test('turn mode bots take their authorized stroke without bypassing the human turn',async()=>{
 let now=0;const room=new Room('BOTS',root,['data/levels/level-1.level'],{...defaults,duration:300000},()=>now),a=socket(),host=room.join(a,'Host','#ffffff',0);
 try{
  room.botSettings(host,'add',null,{difficulty:'easy'});await room.start(host,1,'impact','turns');room.ready(host,0);
  const bot=[...room.members.values()].find(m=>m.bot)!;now+=50;await room.tick();assert.equal(bot.ball!.strokes,0);
  room.disconnect(host,a);assert.equal(room.turn,bot.id);
  for(let i=0;i<20&&bot.ball!.strokes===0;i++){now+=50;await room.tick();await (room as any).botPlanning;}
  assert.equal(bot.ball!.strokes,1);assert.equal(room.mode,'impact');
 }finally{room.close();}
});
