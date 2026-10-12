import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {WebSocket} from 'ws';
import {Room,defaults} from '../src/room.js';
import {Physics} from '../src/physics.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const config=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
const levels=Array.from({length:20},(_,i)=>config[`level${i+1}`]);
function socket(){const messages:any[]=[];return {readyState:1,bufferedAmount:0,send:(s:string)=>messages.push(JSON.parse(s)),close(){},messages} as unknown as WebSocket&{messages:any[]};}
test('only the human host can configure every room setting and bot; human plus bot capacity is fifty',()=>{
  const room=new Room('RULES',root,levels),a=socket(),b=socket();
  const host=room.join(a,'Host','#ffffff',0),guest=room.join(b,'Guest','#ff0000',1);
  try{
    assert.throws(()=>room.configure(guest,5,'impact'),/anfitrião/);
    assert.throws(()=>room.botSettings(guest,'add',null),/anfitrião/);
    room.configure(host,5,'impact');assert.equal(room.state().holes,5);assert.equal(room.state().mode,'impact');
    assert.equal(b.messages.at(-1).mode,'impact');
    room.botSettings(host,'add',null,{nickname:'Pompom Bot',difficulty:'easy',color:'#ffaa44'});
    const bot=[...room.members.values()].find(m=>m.bot)!;
    assert.throws(()=>room.botSettings(guest,'update',bot.id,{difficulty:'hard'}),/anfitrião/);
    room.botSettings(host,'update',bot.id,{difficulty:'hard',nickname:'Planner'});assert.equal(bot.bot,'hard');
    assert.throws(()=>room.botSettings(host,'update',host.id,{difficulty:'easy'}),/não encontrado/);
    room.botSettings(host,'remove',bot.id);assert.equal(room.members.has(bot.id),false);
    for(let i=0;i<48;i++)room.botSettings(host,'add',null,{difficulty:i%3===0?'hard':i%3===1?'medium':'easy'});
    assert.equal(room.members.size,50);assert.equal(room.state().players.filter(m=>m.bot).length,48);
    assert.throws(()=>room.join(socket(),'Extra','#ffffff',0),/cheia/);
    assert.throws(()=>room.botSettings(host,'add',null),/cheia/);
    room.disconnect(host,a);assert.equal(room.host,guest.id);
    room.configure(guest,1,'classic');assert.equal(room.holes,1);
  }finally{room.close();}
});
test('draw uses all valid unique maps, stays fixed across transitions and reconnects, and rejects excess courses',async()=>{
  let now=0;const room=new Room('DRAW1',root,[...levels,levels[0],'missing.level'],{...defaults,resultsDuration:0},()=>now);
  const first=socket(),host=room.join(first,'Host','#ffffff',0);
  try{
    assert.equal(room.validLevels.length,20);await assert.rejects(room.start(host,21),/Quantidade/);
    await room.start(host,5,'impact');const order=[...room.selectedLevels];
    assert.equal(new Set(order).size,5);assert.ok(order.every(i=>i<20));
    assert.equal(first.messages.filter(m=>m.type==='load').at(-1).level,order[0]);
    assert.throws(()=>room.configure(host,1,'classic'),/anfitrião/);
    room.ready(host,0);(room as any).finishHole();now++;
    await room.tick();assert.equal(room.hole,1);assert.deepEqual(room.selectedLevels,order);
    room.disconnect(host,first);const second=socket();await room.reconnect(second,host.token);
    assert.deepEqual(second.messages.find(m=>m.type==='room').sequence,order);
    assert.equal(second.messages.find(m=>m.type==='load').level,order[1]);
  }finally{room.close();}
});
test('native candidate planning cannot mutate real balls; all difficulties use real shots and make progress',async()=>{
  for(const difficulty of ['easy','medium','hard'] as const){
    const p=new Physics(root,'data/levels/level-3.level');
    try{
      await p.add(0,1);await p.step(120);const before=(await p.step(0)).players[0]!;
      const plan=await p.plan(0,difficulty);assert.equal(plan.ok,true);assert.ok(plan.candidates>=1&&plan.candidates<=64);
      assert.deepEqual((await p.step(0)).players[0],before);
      assert.deepEqual((await p.step(0)).events,[],'planning produces no real sound events');
      assert.ok(plan.direction.every(Number.isFinite));assert.ok(plan.power>=0&&plan.power<=1);
      await p.shot(0,plan.direction,plan.power);
      let frame=await p.step(1200);assert.equal(frame.players[0]!.strokes,1);
      assert.ok(frame.events.some(e=>e.kind==='shot'&&e.player===1));
      assert.deepEqual((await p.step(0)).events,[],'events are delivered once');
      assert.notDeepEqual(frame.players[0]!.pos,before.pos);
      for(let shot=1;shot<12&&!frame.players[0]!.hole;shot++){
        if(frame.players[0]!.moving){frame=await p.step(1200);continue;}
        const next=await p.plan(0,difficulty);await p.shot(0,next.direction,next.power);frame=await p.step(1200);
        assert.ok(frame.players[0]!.pos.every(Number.isFinite));assert.ok(frame.players[0]!.strokes<=12);
      }
      if(difficulty==='hard')assert.equal(frame.players[0]!.hole,true,'hard planner completes the straight real course');
    }finally{p.close();}
  }
});
test('a new match requires the finished human host and draws a fresh fixed sequence',async()=>{
  const room=new Room('AGAIN',root,levels),host=room.join(socket(),'Host','#ffffff',0),guest=room.join(socket(),'Guest','#ff0000',0);
  try{
    assert.throws(()=>room.rematch(host),/reiniciar/);
    await room.start(host,20);const first=[...room.selectedLevels];assert.equal(room.match,1);
    room.phase='finished';host.scores=[12];host.dnf=[true];
    assert.throws(()=>room.rematch(guest),/reiniciar/);room.rematch(host);
    assert.equal(room.phase,'lobby');assert.deepEqual(host.scores,[]);assert.deepEqual(room.selectedLevels,[]);
    await room.start(host,20);assert.equal(room.match,2);assert.notDeepEqual(room.selectedLevels,first);
    assert.equal(new Set(room.selectedLevels).size,20);
  }finally{room.close();}
});
test('a retired startup cannot fail the newer map or publish a celebration',async()=>{
  const room=new Room('LOAD1',root,levels),host=room.join(socket(),'Host','#ffffff',0);
  try{
    const old=room.start(host,3);const next=(room as any).load();await Promise.all([old,next]);
    assert.equal(room.phase,'loading');assert.equal(room.state().completed,false);assert.ok(host.ball);
    room.ready(host,0);assert.equal(room.phase,'playing');
  }finally{room.close();}
});
test('49 server bots share one physics world and no sockets, respect readiness, and publish real finite shots',async()=>{
  let now=0;const room=new Room('BOTS1',root,levels,{...defaults,duration:120000},()=>now),host=room.join(socket(),'Host','#ffffff',0);
  try{
    for(let i=0;i<49;i++)room.botSettings(host,'add',null,{difficulty:i%3===0?'hard':i%3===1?'medium':'easy'});
    await room.start(host,1,'impact');await room.tick();assert.ok([...room.members.values()].every(p=>p.ball?.strokes===0));
    assert.equal(room.phase,'loading');room.ready(host,0);assert.equal(room.phase,'playing');
    for(let i=0;i<180;i++){now+=100;await room.tick();}
    const bots=[...room.members.values()].filter(m=>m.bot);assert.equal(bots.length,49);
    assert.ok(bots.every(b=>!b.socket&&b.ball&&b.ball.pos.every(Number.isFinite)&&b.ball.strokes>0));
    assert.ok(bots.every(b=>b.ball!.strokes<=room.options.penalty));assert.equal(host.ball!.strokes,0);
  }finally{room.close();}
});
