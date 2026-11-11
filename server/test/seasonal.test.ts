import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room} from '../src/room.js';
import {Physics} from '../src/physics.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
const levels=Object.entries(cfg).filter(([key,value])=>/^level\d+$/.test(key)&&typeof value==='string').map(([,value])=>value as string);
const socket=()=>({readyState:1,bufferedAmount:0,send:()=>{},close:()=>{}} as unknown as WebSocket);
test('Christmas tournament uses the real lobby, permissions, profiles, roster limit and scoring',async()=>{
 const room=new Room('XMAS',root,levels),host=room.join(socket(),'Santa','#ffffff',0,{seasonSkin:4,seasonTrail:3}),guest=room.join(socket(),'Elf','#ff0000',1);
 try{
  assert.deepEqual(room.seasonal,{theme:'original',tournament:false,obstacles:false});
  assert.throws(()=>room.configureSeason(guest,{theme:'christmas',tournament:true,obstacles:true}));
  assert.throws(()=>room.configureSeason(host,{theme:'other',tournament:true,obstacles:true}));
  room.configureSeason(host,{theme:'christmas',tournament:true,obstacles:true});room.configure(host,levels.length,'impact');
  room.updateProfile(guest,{seasonSkin:2,seasonTrail:4});assert.equal(guest.seasonSkin,2);assert.equal(host.seasonSkin,4);
  assert.throws(()=>room.updateProfile(guest,{nickname:'Changed',seasonSkin:5}));assert.equal(guest.nickname,'Elf');
  room.botSettings(host,'count',null,{count:48,difficulty:'hard'});assert.equal(room.members.size,50);
  assert.throws(()=>room.botSettings(host,'add',null,{difficulty:'hard'}));
  const state=room.state();assert.equal(state.players.length,50);assert.equal(state.seasonal.tournament,true);assert.equal(state.mode,'impact');assert.equal(state.mapPool.length,levels.length);
  room.configureSeason(host,{theme:'original',tournament:true,obstacles:true});assert.deepEqual(room.seasonal,{theme:'original',tournament:false,obstacles:false});
 }finally{room.close();}
});
test('every configured course automatically receives a deterministic seasonal layout without editing geometry',async()=>{
 let total=0,compatible=0;
 for(const file of levels){
  const physics=new Physics(root,file);
  try{
   await physics.configure(false,171,.5,-1,true);const a=await physics.step(0);const season=a.mascots.season;
   assert.equal(season.enabled,true,file);assert.ok(season.items.length<=9,file);total+=season.items.length;if(season.items.length)compatible++;
   const portals=season.items.filter((i:any)=>i.kind===2);assert.ok(portals.length===0||portals.length===2,file);
   await physics.configure(false,171,.5,-1,true);const b=await physics.step(0);assert.deepEqual(b.mascots.season,season,file);
   await physics.configure(false,171,.5,-1,false);assert.deepEqual((await physics.step(0)).mascots.season,{enabled:false,items:[]},file);
  }finally{await physics.close();}
 }
 assert.ok(compatible>levels.length/2);assert.ok(total>levels.length);console.log(`Christmas layouts: ${levels.length} courses, ${compatible} compatible, ${total} reusable obstacles.`);
});
test('Christmas forecasts remain read-only and both authoritative simulations stay identical with 50 balls',async()=>{
 const a=new Physics(root,'data/levels/level-3.level'),b=new Physics(root,'data/levels/level-3.level');
 try{
  for(const p of [a,b]){await p.configure(true,908,.5,-1,true);for(let i=0;i<50;i++)await p.add(i,i+1);}
  const before=await a.step(0);await a.plan(0,'medium');const after=await a.step(0);
  assert.equal(after.time,before.time);assert.deepEqual(after.players,before.players);assert.deepEqual(after.mascots,before.mascots);
  for(const p of [a,b])for(let i=0;i<50;i++)await p.shot(i,[Math.sin(i*.04),0,-1],.3+i*.002);
  for(let tick=0;tick<6;tick++){const x=await a.step(120),y=await b.step(120);assert.deepEqual(x.players,y.players);assert.deepEqual(x.mascots,y.mascots);}
 }finally{a.close();b.close();}
});
