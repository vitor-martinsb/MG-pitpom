import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room} from '../src/room.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
const levels=Array.from({length:cfg.num_levels},(_,i)=>cfg[`level${i+1}`]);
const socket=()=>({readyState:1,bufferedAmount:0,send(){},close(){}} as unknown as WebSocket);
test('host map pools enforce 20 originals, 60 evolutions, 80 total and validated manual selection',async()=>{
 const room=new Room('POOL1',root,levels),host=room.join(socket(),'Host','#ffffff',0),guest=room.join(socket(),'Guest','#ffffff',0);
 try{
  assert.equal(room.validLevels.length,80);
  for(const [kind,count] of [['originals',20],['evolutions',60],['all',80]] as const){
   room.configurePool(host,kind,undefined);assert.equal(room.mapPool.length,count);
   assert.equal(room.state().mapPoolKind,kind);
   if(kind!=='all')assert.ok(room.mapPool.every(i=>kind==='originals'?i%4===0:i%4!==0));
   assert.throws(()=>room.configurePool(guest,kind,[]));
  }
  for(const ids of [[],[0,0],[-1],[80],[1.5],['1'],null])assert.throws(()=>room.configurePool(host,'custom',ids));
  room.configurePool(host,'custom',[0,3,79]);room.configure(host,3);
  await room.start(host,3);
  assert.deepEqual([...room.selectedLevels].sort((a,b)=>a-b),[0,3,79]);
  assert.equal(new Set(room.selectedLevels).size,3);
  assert.throws(()=>room.configurePool(host,'all',[]));
  const sequence=[...room.selectedLevels],first=host.socket!;room.disconnect(host,first);
  await room.reconnect(socket(),host.token);assert.deepEqual(room.selectedLevels,sequence);
  room.phase='finished';room.hole=3;room.rematch(guest);
  assert.deepEqual(room.mapPool,[0,3,79]);assert.equal(room.mapPoolKind,'custom');
  await room.start(guest,3);assert.deepEqual([...room.selectedLevels].sort((a,b)=>a-b),[0,3,79]);
 }finally{room.close();}
});
