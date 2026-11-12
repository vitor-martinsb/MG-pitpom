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
 return {room,host,guest,a,b,async tick(ms=50){now+=ms;await room.tick();}};
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

test('shared aiming is turn-authorized, bounded, throttled and never changes ball physics',async()=>{
 const f=await fixture();const {room,host,guest}=f;
 const aim=(sequence=1,extra:any={})=>({sequence,match:room.match,hole:room.hole,active:true,direction:[1,0,0],power:.6,...extra});
 try{
  const original=structuredClone(host.ball);
  assert.equal(room.aim(guest,aim()),false);
  assert.equal(room.aim(host,aim(1,{match:room.match+1})),false);
  assert.equal(room.aim(host,aim(1,{hole:1})),false);
  for(const extra of [{power:NaN},{power:1.1},{power:0},{direction:[0,0,0]},{direction:[0,1,0]},{direction:[Infinity,0,1]},{active:'true'}])assert.throws(()=>room.aim(host,aim(1,extra)),/Mira/);
  assert.equal(room.aim(host,aim(1,{player:guest.id})),true);
  assert.deepEqual(room.state().aim,{player:host.id,direction:[1,0,0],power:.6});
  assert.equal(room.aim(host,aim(1)),false);assert.equal(room.aim(host,aim(2,{power:.8})),false);
  await f.tick();await f.tick();assert.equal(room.aim(host,aim(3,{direction:[0,0,1],power:.8})),true);
  await f.tick();await f.tick();
  assert.deepEqual(f.a.messages.findLast(m=>m.type==='snapshot').aim,f.b.messages.findLast(m=>m.type==='snapshot').aim);
  assert.deepEqual(room.state().aim,{player:host.id,direction:[0,0,1],power:.8});
  assert.equal(host.ball!.strokes,original!.strokes);assert.deepEqual(host.ball!.vel,original!.vel);
  assert.equal(room.aim(host,aim(4,{active:false})),true);assert.equal(room.state().aim,null);
  await f.tick();await f.tick();assert.equal(room.aim(host,aim(5)),true);
  for(let i=0;i<25;i++)await f.tick();assert.equal(room.state().aim,null,'stale previews expire');
  assert.equal(room.aim(host,aim(6)),true);await room.shot(host,shot(1));assert.equal(room.state().aim,null);
  assert.equal(room.aim(host,aim(7)),false,'cannot aim during the accepted stroke');
  room.disconnect(host,f.a);assert.equal(room.state().aim,null);
 }finally{room.close();}
 const s=await fixture('simultaneous');try{assert.equal(s.room.aim(s.host,{sequence:1,match:s.room.match,hole:0,active:true,direction:[1,0,0],power:.5}),false);assert.equal(s.room.state().aim,null);}finally{s.room.close();}
});

test('reloading a client resets only its preview sequence and cannot retain another turn’s aim',async()=>{
 const f=await fixture();const {room,host,guest}=f;
 const aim=(sequence:number)=>({sequence,match:room.match,hole:room.hole,active:true,direction:[1,0,0],power:.5});
 try{
  assert.equal(room.aim(host,aim(50)),true);room.disconnect(host,f.a);assert.equal(room.state().aim,null);
  const reconnected=await room.reconnect(socket(),host.token);room.ready(reconnected,0);
  assert.equal(room.turn,guest.id);assert.equal(room.aim(host,aim(1)),false);
  room.disconnect(guest,f.b);assert.equal(room.turn,host.id);assert.equal(room.aim(host,aim(1)),true);
  assert.equal(host.lastSequence,0,'preview sequencing never consumes a shot');
 }finally{room.close();}
});

test('turns have no course deadline and cap each human at exactly 20 real shots',async()=>{
 const f=await fixture();const {room,host,guest}=f;
 try{
  assert.equal(room.state().strokeLimit,20);assert.equal(room.state().remaining,null);assert.equal(room.deadline,0);
  await f.tick(3600000);assert.equal(room.phase,'playing');assert.equal(room.state().remaining,null);
  for(let stroke=1;stroke<=20;stroke++)for(const m of [host,guest]){
   assert.equal(room.turn,m.id);await room.shot(m,shot(stroke));assert.equal(m.ball!.strokes,stroke);
   if(stroke===20){assert.equal(room.phase,'playing');assert.equal(room.turn,m.id);assert.ok(room.state().turnOrder.includes(m.id),'the last moving stroke remains in the active order');}
   for(let tick=0;tick<600&&room.phase==='playing'&&room.turn===m.id;tick++)await f.tick();
   assert.equal(m.ball!.moving,false);
   if(stroke===20){assert.equal(m.dnf[0],true);await assert.rejects(room.shot(m,shot(21)),/indisponível/);}
  }
  assert.equal(room.phase,'results');assert.deepEqual(host.scores,[32]);assert.deepEqual(guest.scores,[32]);
  assert.equal(f.a.messages.findLast(m=>m.type==='snapshot').strokeLimit,20);
  await f.tick(6000);assert.equal(room.phase,'finished','normal result progression still works');
 }finally{room.close();}
});
test('a ball holed on stroke 20 succeeds, and a capped bot is skipped and cannot take stroke 21',async()=>{
 const f=await fixture();const {room,host,guest}=f;
 try{
  room.disconnect(guest,f.b);host.ball!.strokes=19;
  const physics=(room as any).physics,step=physics.step.bind(physics);
  physics.step=async(ticks:number)=>{const frame=await step(ticks);const b=frame.players.find((b:any)=>b.id===host.id);b.strokes=20;b.moving=false;b.hole=true;b.captureUntil=0;return frame;};
  await room.shot(host,shot(1));await f.tick();assert.equal(room.phase,'results');assert.equal(host.scores[0],20);assert.equal(host.dnf[0],false);
 }finally{room.close();}
 let now=0;const bots=new Room('CAPBOT',root,['data/levels/level-1.level'],defaults,()=>now),a=socket(),human=bots.join(a,'Host','#ffffff',0);
 try{
  bots.botSettings(human,'add',null,{difficulty:'easy'});await bots.start(human,1,'classic','turns');bots.ready(human,0);
  const bot=[...bots.members.values()].find(m=>m.bot)!;bot.ball!.strokes=20;bot.ball!.moving=false;
  const physics=(bots as any).physics,step=physics.step.bind(physics);
  physics.step=async(ticks:number)=>{const frame=await step(ticks);const b=frame.players.find((b:any)=>b.id===bot.id);b.strokes=20;b.moving=false;return frame;};
  now+=50;await bots.tick();assert.equal(bot.dnf[0],true);assert.deepEqual(bots.state().turnOrder,[human.id]);
  await assert.rejects(bots.shot(bot,shot(1)),/indisponível/);assert.equal(bot.ball!.strokes,20);
 }finally{bots.close();}
});
test('simultaneous keeps its existing deadline and allows human stroke 21',async()=>{
 const f=await fixture('simultaneous');try{
  assert.equal(f.room.state().strokeLimit,null);assert.ok(f.room.state().remaining!>0);
  f.host.ball!.strokes=20;await f.room.shot(f.host,shot(1));assert.equal(f.host.ball!.strokes,21);
  await f.tick(306000);assert.notEqual(f.room.phase,'playing');
 }finally{f.room.close();}
});

test('the 20-shot allowance resets on the next course while the previous DNF score is retained',async()=>{
 let now=0;const room=new Room('NEXT',root,['data/levels/level-1.level','data/levels/level-2.level'],defaults,()=>now),a=socket(),host=room.join(a,'Host','#ffffff',0);
 try{
  await room.start(host,2,'classic','turns');room.ready(host,0);
  const physics=(room as any).physics,step=physics.step.bind(physics);
  physics.step=async(ticks:number)=>{const frame=await step(ticks);frame.players[0].strokes=20;frame.players[0].moving=false;return frame;};
  now+=50;await room.tick();assert.equal(room.phase,'results');assert.deepEqual(host.scores,[32]);
  now+=6000;await room.tick();assert.equal(room.hole,1);room.ready(host,1);
  assert.equal(room.phase,'playing');assert.equal(room.state().remaining,null);assert.equal(host.ball!.strokes,0);assert.equal(host.dnf[1],undefined);
  await room.shot(host,shot(1));assert.equal(host.ball!.strokes,1);assert.deepEqual(host.scores,[32]);
 }finally{room.close();}
});
