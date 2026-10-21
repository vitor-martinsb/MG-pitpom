import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
import {Physics} from '../src/physics.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
function deferred<T=any>(){let resolve!:(v:T)=>void,reject!:(e:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const shot={ok:true,safe:true,wait:0,direction:[0,0,-1],power:.1};

test('a pending bot never blocks human shots, snapshots, chat or subsequent physics ticks; stale positions are discarded',async()=>{
  let now=0;const room=new Room('SMOOTH',root,['data/levels/level-3.level'],defaults,()=>now),ws=socket();
  const host=room.join(ws,'Host','#ffffff',0);const pending=deferred();
  try{
    room.botSettings(host,'count',null,{count:4,difficulty:'hard'});await room.start(host,1);room.ready(host,0);
    const physics=(room as any).physics;let plans=0;physics.plan=()=>{plans++;return pending.promise;};
    now=100;await room.tick();const job=(room as any).botPlanning;assert.ok(job);
    await room.shot(host,{sequence:1,direction:[0,0,-1],power:.2});
    const snapshots=room.metrics.snapshots,start=room.worldTime;
    for(let i=0;i<12;i++){now+=70;await room.tick();}
    room.chat(host,'Still moving');
    assert.equal(plans,1,'one in-flight decision, no queued bot backlog');
    assert.ok(room.worldTime>start+.7);assert.ok(room.metrics.snapshots>=snapshots+12);
    assert.equal(host.ball!.strokes,1);assert.ok(host.ball!.pos[2]! < -2.5);
    assert.ok(ws.messages.some(m=>m.type==='chat'&&m.text==='Still moving'));
    const bot=[...room.members.values()].find(m=>m.bot)!;bot.ball!.pos[0]!+=1;
    pending.resolve(shot);await job;
    assert.equal(bot.ball!.strokes,0,'a moved/captured ball cannot use the old forecast');
    assert.equal(room.phase,'playing');assert.equal(room.metrics.botPlanFailures,0);
  }finally{pending.resolve(shot);room.close();}
});

test('a failed bot planner leaves the authoritative match running',async()=>{
  let now=0;const room=new Room('RETRY',root,['data/levels/level-3.level'],defaults,()=>now),host=room.join(socket(),'Host','#ffffff',0);
  try{
    room.botSettings(host,'count',null,{count:1});await room.start(host,1);room.ready(host,0);
    (room as any).physics.plan=async()=>{throw Error('Planner timed out');};
    now=100;await room.tick();await (room as any).botPlanning;
    now=200;await room.tick();assert.equal(room.phase,'playing');assert.ok(room.worldTime>.1);
    assert.equal(room.metrics.botPlanFailures,1);assert.equal(room.state().completed,false);
  }finally{room.close();}
});

test('a retired bot decision cannot shoot on the next field',async()=>{
  let now=0;const room=new Room('STALE',root,['data/levels/level-3.level','data/levels/level-2.level'],defaults,()=>now),host=room.join(socket(),'Host','#ffffff',0),pending=deferred();
  try{
    room.botSettings(host,'count',null,{count:1});await room.start(host,2);room.ready(host,0);
    (room as any).physics.plan=()=>pending.promise;now=100;await room.tick();const old=(room as any).botPlanning;
    room.hole=1;await (room as any).load();room.ready(host,1);
    pending.resolve(shot);await old;
    assert.equal(room.phase,'playing');assert.ok([...room.members.values()].every(m=>m.ball!.strokes===0));
  }finally{pending.resolve(shot);room.close();}
});

test('real expert planning runs in an isolated worker while authoritative frames continue',async()=>{
  const p=new Physics(root,'data/campaign/family-04-3.level');
  try{
    await p.configure(false,12345);await p.add(0,1);await p.add(1,2);await p.prepareBots();
    await p.shot(0,[0,0,-1],.2);
    const planner=(p as any).planner,command=planner.command.bind(planner),started=deferred<void>();
    planner.command=(message:any)=>{const result=command(message);if(message.cmd==='plan')started.resolve();return result;};
    let finished=false;const job=p.plan(1,'expert').finally(()=>{finished=true;});await started.promise;
    const frame=await p.step(8);assert.equal(finished,false,'the frame must arrive before the expensive plan');
    assert.ok(frame.time>0);assert.equal(frame.players[1]!.strokes,0);
    const plan=await job;assert.equal(plan.ok,true);assert.ok(plan.candidates>0);
    assert.equal((await p.step(0)).time,frame.time,'candidate forecasts cannot advance authority time');
  }finally{p.close();}
});

test('planner transfers cannot restore or replace the authoritative ball state',async()=>{
  const p=new Physics(root,'data/levels/level-3.level');
  try{
    await p.add(0,1);const snapshot=await p.command({cmd:'plannerState',slot:0});assert.equal(snapshot.ok,true);
    assert.equal(await p.shot(0,[0,0,-1],.2),true);const before=await p.step(30);
    assert.equal((await p.command({cmd:'restorePlanner',state:snapshot.state})).ok,false);
    assert.deepEqual((await p.step(0)).players,before.players);
  }finally{p.close();}
});

test('conservative mover culling preserves expert forecasts against the full geometry reference',async()=>{
  for(const level of ['data/campaign/family-04-3.level','data/levels/level-7.level']){
    const previous=process.env.GOLF_BOT_FULL_MOVERS;process.env.GOLF_BOT_FULL_MOVERS='1';
    const full=new Physics(root,level);
    if(previous===undefined)delete process.env.GOLF_BOT_FULL_MOVERS;else process.env.GOLF_BOT_FULL_MOVERS=previous;
    const fast=new Physics(root,level);
    try{
      for(const p of [full,fast]){await p.configure(false,12345);await p.add(0,2);await p.command({cmd:'prepareBots'});}
      const a=await full.command({cmd:'plan',slot:0,difficulty:'expert'}),b=await fast.command({cmd:'plan',slot:0,difficulty:'expert'});
      assert.equal(a.safe,b.safe);assert.ok(Math.abs(a.power-b.power)<.00001,level);
      assert.ok(Math.hypot(...a.direction.map((v:number,i:number)=>v-b.direction[i]))<.00001,level);
      assert.ok(Math.hypot(...a.landing.map((v:number,i:number)=>v-b.landing[i]))<.03,level);
    }finally{full.close();fast.close();}
  }
});
