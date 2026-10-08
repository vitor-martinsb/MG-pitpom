import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { WebSocket } from 'ws';
import { Room, defaults } from '../src/room.js';
import { Physics } from '../src/physics.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const config=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
const levels=Array.from({length:20},(_,i)=>config[`level${i+1}`]);
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(data:string)=>messages.push(JSON.parse(data)),close:()=>{},messages} as unknown as WebSocket & {messages:any[]};}

test('all 20 original maps load and simulate finite geometry',async()=>{
  for(const level of levels){
    const physics=new Physics(root,level);
    try{await physics.add(0,1);await physics.shot(0,[0,0,-1],.5);const frame=await physics.step(120);assert.equal(frame.players.length,1);assert.ok(frame.players[0]!.pos.every(Number.isFinite),level);}
    finally{physics.close();}
  }
});

test('50 independent balls follow the same original-map trajectory; second moving shot rejected',async()=>{
  const physics=new Physics(root,levels[0]);
  try{
    await physics.ready;
    for(let i=0;i<50;i++)await physics.add(i,i+1);
    await physics.step(120);
    for(let i=0;i<50;i++)assert.equal(await physics.shot(i,[0,0,-1],.2),true);
    assert.equal(await physics.shot(0,[0,0,-1],.2),false);
    const frame=await physics.step(600);
    assert.equal(frame.players.length,50);
    const first=frame.players[0]!;
    for(const ball of frame.players){assert.deepEqual(ball.pos,first.pos);assert.equal(ball.strokes,1);assert.ok(ball.pos.every(Number.isFinite));}
    assert.ok(first.pos[2]! < -5);
  }finally{physics.close();}
});

test('capacity, identity, host-only start and nickname validation',async()=>{
  const room=new Room('TEST1',root,levels);
  try{
    assert.throws(()=>room.join(socket(),'á','#ff0000',0),/ASCII/);
    for(let i=0;i<50;i++)room.join(socket(),`Bot${i}`,'#ff0000',0);
    assert.equal(new Set([...room.members.keys()]).size,50);
    assert.throws(()=>room.join(socket(),'Extra','#ff0000',0),/cheia/);
    await assert.rejects(room.start(room.members.get(2)!,3),/anfitrião/);
  }finally{room.close();}
});

test('loading waits, deadline rejects shots, grace simulates and DNF accumulates across maps',async()=>{
  let now=0;const room=new Room('TEST2',root,levels,{...defaults,duration:1000,grace:500,resultsDuration:10,loadingTimeout:100},()=>now);
  const host=room.join(socket(),'Host','#ffffff',0), other=room.join(socket(),'Other','#ff0000',1);
  try{
    await room.start(host,3);assert.equal(room.phase,'loading');
    room.ready(host,0);assert.equal(room.phase,'loading');
    now=101;await room.tick();assert.equal(room.phase,'playing');
    await assert.rejects(room.shot(other,{sequence:1,direction:[0,0,-1],power:.2}),/indisponível/);
    room.ready(other,0);
    await room.shot(host,{sequence:1,direction:[0,0,-1],power:.2});
    await assert.rejects(room.shot(host,{sequence:1,direction:[0,0,-1],power:.2}),/duplicada/);
    await assert.rejects(room.shot(host,{sequence:2,direction:[0,0,-1],power:.2}),/indisponível/);
    now=1101;await assert.rejects(room.shot(other,{sequence:2,direction:[0,0,-1],power:.2}),/indisponível/);
    await room.tick();assert.equal(room.phase,'settling');const before=host.ball!.pos[2]!;
    now=1400;await room.tick();assert.notEqual(host.ball!.pos[2],before);
    now=1601;await room.tick();assert.equal(room.phase,'results');assert.deepEqual(host.scores,[12]);assert.deepEqual(host.dnf,[true]);
    for(let hole=1;hole<3;hole++){
      now+=11;await room.tick();assert.equal(room.phase,'loading');assert.equal(room.hole,hole);
      room.ready(host,hole);room.ready(other,hole);assert.equal(room.phase,'playing');assert.equal(host.ball!.strokes,0);
      now+=1501;await room.tick();assert.equal(room.phase,'results');
    }
    now+=11;await room.tick();assert.equal(room.phase,'finished');assert.deepEqual(host.scores,[12,12,12]);
  }finally{room.close();}
});

test('reconnect preserves ball, identity and shot sequence; token cannot replace an active socket',async()=>{
  let now=0;const room=new Room('TEST3',root,levels,{...defaults},()=>now);
  const first=socket(),host=room.join(first,'Host','#12ab34',4), other=room.join(socket(),'Other','#ffff00',2);
  try{
    await room.start(host,3);room.ready(host,0);room.ready(other,0);
    await room.shot(host,{sequence:1,direction:[0,0,-1],power:.1});
    now=500;await room.tick();const position=[...host.ball!.pos];
    room.disconnect(host,first);assert.equal(room.host,other.id);
    const again=socket();assert.equal(await room.reconnect(again,host.token),host);
    assert.deepEqual(host.ball!.pos,position);assert.equal(host.color,'#12ab34');assert.equal(host.avatar,4);assert.equal(host.lastSequence,1);
    await assert.rejects(room.reconnect(socket(),host.token),/já conectado/);
    room.ready(host,0);await assert.rejects(room.shot(host,{sequence:1,direction:[0,0,-1],power:.2}),/duplicada/);
    room.disconnect(host,again);now+=60001;await assert.rejects(room.reconnect(socket(),host.token),/expirada/);
  }finally{room.close();}
});
