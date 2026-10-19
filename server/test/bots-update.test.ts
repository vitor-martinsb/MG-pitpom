import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
import {Physics,type Ball,type BotDifficulty} from '../src/physics.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const config=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
const levels=[config.level1,config.level31];
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(text:string)=>messages.push(JSON.parse(text)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
function ball(id:number,strokes=0,hole=false):Ball{return {id,pos:[0,.12,0],vel:[0,0,0],moving:false,hole,water:false,strokes,firstComplete:false,captured:false,captureUntil:0};}

test('DNF adds exactly twelve to every valid stroke, once, for humans and bots',()=>{
  const room=new Room('DNF12',root,levels,{...defaults,penalty:99});
  try{
    const host=room.join(socket(),'Host','#ffffff',0);room.botSettings(host,'count',null,{count:4});
    const members=[...room.members.values()];
    for(const [i,strokes]of [3,6,10,0,2].entries())members[i]!.ball=ball(members[i]!.id,strokes,i===4);
    room.phase='playing';(room as any).finishHole();
    assert.deepEqual(members.map(m=>m.scores[0]),[15,18,22,12,2]);
    assert.deepEqual(members.map(m=>m.dnf[0]),[true,true,true,true,false]);
    (room as any).finishHole();assert.deepEqual(members.map(m=>m.scores[0]),[15,18,22,12,2]);
    assert.equal(room.state().penalty,12);assert.equal(room.state().players[0]!.total,15);
    room.phase='playing';room.hole=1;host.ball=ball(host.id,6);(room as any).finishHole();
    assert.deepEqual(host.scores,[15,18]);assert.equal(room.state().players[0]!.total,33);
  }finally{room.close();}
});

test('the host configures an exact integer bot count and unique AI names without renaming humans',()=>{
  const room=new Room('NAMES',root,levels);
  try{
    const host=room.join(socket(),'Claude','#ffffff',0),guest=room.join(socket(),'GPT-6','#aabbcc',0);
    assert.throws(()=>room.botSettings(guest,'count',null,{count:3}),/anfitrião/);
    for(const count of [-1,.5,49,NaN,'2'])assert.throws(()=>room.botSettings(host,'count',null,{count}),/Quantidade/);
    room.botSettings(host,'count',null,{count:48,difficulty:'expert'});
    let bots=[...room.members.values()].filter(m=>m.bot);
    assert.equal(bots.length,48);assert.equal(room.members.size,50);
    assert.equal(new Set(bots.map(m=>m.nickname)).size,48);assert.ok(bots.some(m=>m.nickname.endsWith(' 2')));
    assert.ok(bots.every(m=>m.bot==='expert'&&!['Claude','GPT-6'].includes(m.nickname)));
    assert.equal(host.nickname,'Claude');assert.equal(guest.nickname,'GPT-6');
    assert.throws(()=>room.botSettings(host,'update',bots[0]!.id,{nickname:'claude'}),/utilizado/);
    room.botSettings(host,'update',bots[0]!.id,{difficulty:'easy'});assert.equal(bots[0]!.bot,'easy');
    room.botSettings(host,'count',null,{count:2,difficulty:'hard'});assert.equal(room.members.size,4);
    bots=[...room.members.values()].filter(m=>m.bot);const original=bots[0]!.nickname;
    const newcomer=room.join(socket(),original,'#aabbcc',1);assert.equal(newcomer.nickname,original);assert.notEqual(bots[0]!.nickname,original);
    assert.throws(()=>room.botSettings(host,'count',null,{count:48}),/Quantidade/);
    room.botSettings(host,'count',null,{count:0});assert.equal(room.members.size,3);
  }finally{room.close();}
});

test('only finished or DNF humans permit fivefold fixed-tick simulation, and the next map resets speed',async()=>{
  let now=0,time=0;const ticks:number[]=[];
  const room=new Room('SPEED',root,levels,{...defaults,resultsDuration:0},()=>now),first=socket(),second=socket();
  try{
    const host=room.join(first,'Host','#ffffff',0),guest=room.join(second,'Guest','#aabbcc',0);
    room.botSettings(host,'count',null,{count:1});room.selectedLevels=[0,1];room.holes=2;
    for(const m of room.members.values()){m.ball=ball(m.id);m.ready=true;}
    (room as any).physics={
      async step(n:number){ticks.push(n);time+=n/120;return {time,players:[...room.members.values()].map(m=>m.ball),events:[],mascots:{},cpuMs:0,rssBytes:0,memoryBytes:0};},
      async plan(){return {ok:true,safe:true,direction:[0,0,-1],power:.1};},async shot(){return true;},async connected(){return {ok:true};},close(){}
    };
    room.phase='playing';room.deadline=120000;
    now=100;await room.tick();assert.equal(room.simulationSpeed,1);assert.equal(ticks.at(-1),12);
    host.ball!.hole=true;now=200;await room.tick();assert.equal(room.simulationSpeed,1);
    guest.ball!.hole=true;now=300;await room.tick();assert.equal(room.simulationSpeed,5);assert.equal(ticks.at(-1),60);
    assert.ok(second.messages.some(m=>m.type==='snapshot'&&m.simulationSpeed===5));
    guest.ball!.hole=false;room.disconnect(guest,second);now=400;await room.tick();assert.equal(room.simulationSpeed,1,'an unfinished disconnected human is still protected');
    guest.dnf[0]=true;guest.scores[0]=12;now=500;await room.tick();assert.equal(room.simulationSpeed,5);
    (room as any).finishHole();now++;await room.tick();assert.equal(room.simulationSpeed,1);assert.equal(room.phase,'loading');
  }finally{room.close();}
});

test('onefold and fivefold batching preserve the same original C trajectory',async()=>{
  const workers=[new Physics(root,levels[1]),new Physics(root,levels[1])];
  try{
    for(const p of workers){await p.command({cmd:'configure',mascots:false,impact:false,seed:917});await p.add(0,1);await p.step(120);await p.shot(0,[0,0,-1],.9);}
    let slow,fast;for(let i=0;i<10;i++)slow=await workers[0]!.step(120);for(let i=0;i<2;i++)fast=await workers[1]!.step(600);
    assert.equal(slow!.time,fast!.time);assert.deepEqual(slow!.players,fast!.players);
  }finally{workers.forEach(p=>p.close());}
});

test('all four difficulties use real launch/landing physics for rising and descending gaps',async()=>{
  for(const fixture of ['ramp-gap','drop-gap'])for(const difficulty of ['easy','medium','hard','expert'] as BotDifficulty[]){
    const p=new Physics(root,`tests/fixtures/bot-${fixture}.level`);let peak=0;
    try{
      await p.command({cmd:'configure',mascots:false,impact:false,seed:123});await p.add(0,1);let frame=await p.step(120);
      for(let stroke=0;stroke<24&&!frame.players[0]!.hole;stroke++){
        const before=frame,plan=await p.plan(0,difficulty),after=await p.step(0);
        assert.deepEqual(after.players,before.players,'candidate simulations never move the real ball');assert.equal(after.time,before.time);
        assert.ok(plan.candidates>=1&&plan.candidates<=144);assert.ok(plan.power>=0&&plan.power<=1);
        assert.equal(await p.shot(0,plan.direction,plan.power),true);
        for(let n=0;n<160;n++){frame=await p.step(30);peak=Math.max(peak,frame.players[0]!.pos[1]!);if(!frame.players[0]!.moving&&!frame.players[0]!.captureUntil||frame.players[0]!.hole)break;}
      }
      assert.equal(frame.players[0]!.hole,true,`${fixture}, ${difficulty}: ${JSON.stringify(frame.players[0])}`);
      if(fixture==='ramp-gap')assert.ok(peak>2,'actual flight clears the elevated landing');
    }finally{p.close();}
  }
});

test('failed real attempts are remembered once and repeated planning stays read-only and deterministic',async()=>{
  const p=new Physics(root,'tests/fixtures/bot-ramp-gap.level');
  try{
    await p.command({cmd:'configure',mascots:false,impact:false,seed:123});await p.add(0,1);await p.step(120);
    await p.shot(0,[1,0,0],.9);let frame=await p.step(1200);if(frame.players[0]!.moving)frame=await p.step(1200);
    assert.equal(frame.players[0]!.strokes,1);const a=await p.plan(0,'expert'),b=await p.plan(0,'expert');
    assert.ok(a.stalled>=1);assert.equal(a.stalled,b.stalled);assert.deepEqual(a.direction,b.direction);assert.equal(a.power,b.power);
    assert.deepEqual((await p.step(0)).players,frame.players);assert.ok(a.direction[0]<.99,'does not choose the failed sideways shot again');
  }finally{p.close();}
});
