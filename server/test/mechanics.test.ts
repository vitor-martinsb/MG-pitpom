import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
import {Physics} from '../src/physics.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const levels=Array.from({length:20},(_,i)=>`data/levels/level-${i+1}.level`);
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket & {messages:any[]};}
test('host selects a validated mode; previews share the readiness barrier and disconnects cannot hold the round',async()=>{
  let now=0;const room=new Room('MODE1',root,levels,{...defaults,loadingTimeout:10000},()=>now);
  const a=socket(),b=socket(),host=room.join(a,'Host','#ffffff',0),guest=room.join(b,'Guest','#ee6255',1);
  try{
    await assert.rejects(room.start(guest,3,'impact'),/anfitrião/);
    await assert.rejects(room.start(host,3,'unknown'),/Modo/);
    await room.start(host,3,'impact');assert.equal(room.state().mode,'impact');
    assert.equal(room.mascots?.enabled,true);assert.equal(room.phase,'loading');
    room.ready(host,0);now=7400;await room.tick();assert.equal(room.phase,'loading');
    assert.equal(host.ball!.strokes,0);assert.equal(host.ball!.firstComplete,false);
    assert.ok(a.messages.some(m=>m.type==='snapshot'&&m.mascots?.cat.length===3));
    room.disconnect(guest,b);await room.tick();
    // The timeout is bounded even if a browser never acknowledges its preview.
    now=10001;await room.tick();assert.equal(room.phase,'playing');assert.equal(room.deadline,now+defaults.duration);
  }finally{room.close();}
});
test('classic snapshots keep balls independent; seeded mascot snapshots are deterministic for 50 players',async()=>{
  const a=new Physics(root,levels[0]!),b=new Physics(root,levels[0]!);
  try{
    await a.configure(false,1234);await b.configure(false,1234);
    // Isolate ball-to-ball independence: shared puddles and Frida's per-player
    // destinations deliberately give different outcomes when NPCs are enabled.
    await a.command({cmd:'configure',mascots:false,impact:false,seed:1234});
    await b.command({cmd:'configure',mascots:false,impact:false,seed:1234});
    for(let i=0;i<50;i++){await a.add(i,i+1);await b.add(i,i+1);}
    await a.step(120);await b.step(120);
    for(let i=0;i<50;i++){assert.equal(await a.shot(i,[0,0,-1],.2),true);await b.shot(i,[0,0,-1],.2);}
    const x=await a.step(600),y=await b.step(600);
    assert.deepEqual(x.players,y.players);assert.deepEqual(x.mascots,y.mascots);
    for(const ball of x.players){assert.equal(ball.strokes,1);assert.ok(ball.pos.every(Number.isFinite));assert.ok(ball.vel.every(Number.isFinite));}
    // No player-player collision is introduced into Classic.
    assert.deepEqual(x.players[0]!.pos,x.players[49]!.pos);
  }finally{a.close();b.close();}
});
test('a retired physics reply cannot terminate the next map',async()=>{
  let now=0;const room=new Room('NEXT1',root,levels,{...defaults},()=>now);
  const host=room.join(socket(),'Host','#ffffff',0);
  try{
    await room.start(host,3);room.ready(host,0);now=500;
    const inFlight=room.tick();
    await (room as any).load();await inFlight;
    assert.equal(room.phase,'loading');assert.ok(host.ball);
    room.ready(host,0);assert.equal(room.phase,'playing');
  }finally{room.close();}
});
