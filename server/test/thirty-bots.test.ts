import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Physics} from '../src/physics.js';
import {Room,defaults} from '../src/room.js';
import {cpuBudget,loadingBudget,plannerEnvironment} from '../src/resources.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function worker(level:string,env:Record<string,string>={}){
  const saved={...process.env};Object.assign(process.env,env);
  try{return new Physics(root,level);}finally{for(const key of Object.keys(env))if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
}
test('31 resting balls and later real shots match the full physics reference, including movers and NPCs',async()=>{
  for(const level of ['data/levels/level-3.level','data/campaign/family-04-3.level']){
    const fast=worker(level),full=worker(level,{GOLF_PHYSICS_FULL_REST:'1',GOLF_PHYSICS_FULL_PLAYERS:'1'});
    try{
      for(const p of [fast,full]){await p.configure(false,12345);for(let i=0;i<31;i++)await p.add(i,i+1);}
      const a=await fast.step(1200),b=await full.step(1200);assert.deepEqual(a.players,b.players,level);
      assert.deepEqual(a.mascots,b.mascots);
      for(const p of [fast,full])assert.equal(await p.shot(0,[0,0,-1],.3),true);
      for(let i=0;i<8;i++){const a=await fast.step(120),b=await full.step(120);assert.deepEqual(a.players,b.players,`${level}, step ${i}`);}
      // Distinct simultaneous shots must stop sharing a physics evaluation.
      for(let i=1;i<31;i++){
        const direction=[Math.sin(i*.2),0,-Math.cos(i*.2)],power=.08+i*.003;
        assert.equal(await fast.shot(i,direction,power),await full.shot(i,direction,power));
      }
      for(let i=0;i<8;i++){
        const a=await fast.step(120),b=await full.step(120);
        assert.deepEqual(a.players,b.players,`${level}, distinct shots ${i}`);
        assert.deepEqual(a.mascots,b.mascots);
      }
    }finally{fast.close();full.close();}
  }
});
test('CPU-limited shared decisions are revalidated in real physics for 30 different bots',async()=>{
  const saved={...process.env};process.env.GOLF_BOT_CPU_FRACTION='1';process.env.GOLF_BOT_SEARCH_MS='150';
  const p=new Physics(root,'data/levels/level-3.level');
  try{
    await p.command({cmd:'configure',mascots:false,impact:false,seed:12345});
    for(let i=0;i<31;i++)await p.add(i,i+1);
    await p.prepareBots();const before=await p.step(0);let reused=0;
    for(let i=1;i<=30;i++){
      const current=await p.step(8);
      const plan=await p.plan(i,'expert');assert.equal(plan.ok,true);assert.equal(plan.safe,true);
      assert.equal((await p.step(0)).time,current.time);
      if(plan.reused){reused++;assert.equal(plan.candidates,1);assert.equal(plan.lookahead,0);}
      assert.ok(plan.cpuMs<1000,'one complete forecast may slightly exceed the search budget');
    }
    assert.ok(reused>=29,`expected shared safe forecasts, got ${reused}`);
    assert.deepEqual((await p.step(0)).players,before.players,'planning never moves authority');
    const shot=await p.plan(30,'expert');assert.equal(await p.shot(30,shot.direction,shot.power),true);
    const result=(await p.step(600)).players[30]!;
    assert.equal(result.strokes,1);assert.ok(result.hole||Math.hypot(...result.pos.map((v,i)=>v-before.players[30]!.pos[i]!))>1);
  }finally{p.close();for(const k of ['GOLF_BOT_CPU_FRACTION','GOLF_BOT_SEARCH_MS'])if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
test('a constrained planner voluntarily yields CPU while the authoritative frame continues',async()=>{
  const saved={...process.env};process.env.GOLF_BOT_CPU_FRACTION='.1';process.env.GOLF_BOT_SEARCH_MS='100';
  const p=new Physics(root,'data/campaign/family-04-3.level');
  try{
    await p.configure(false,123);await p.add(0,1);await p.prepareBots();
    const job=p.plan(0,'expert'),frame=await p.step(12),plan=await job;
    assert.ok(frame.time>0);assert.equal(plan.ok,true);assert.ok(plan.candidates>=1);
    assert.ok(plan.cpuMs>0&&plan.cpuMs<1000);assert.ok(plan.wallMs>=plan.cpuMs*7,JSON.stringify(plan));
  }finally{p.close();for(const k of ['GOLF_BOT_CPU_FRACTION','GOLF_BOT_SEARCH_MS'])if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
test('Render CPU budget preserves 1x under load and allows 5x with headroom',async()=>{
  const old=process.env.GOLF_CPU_BUDGET;process.env.GOLF_CPU_BUDGET='.1';
  const room=new Room('CPU30',root,['data/levels/level-3.level'],defaults,()=>1000);
  try{
    assert.equal(cpuBudget(),.1);assert.equal(loadingBudget(),120000);
    const host=room.join({readyState:1,bufferedAmount:0,send(){},close(){}} as any,'Host','#ffffff',0);
    room.botSettings(host,'count',null,{count:30});
    for(const m of room.members.values())m.ball={id:m.id,pos:[0,.12,0],vel:[0,0,0],moving:false,hole:!m.bot,water:false,strokes:1,firstComplete:true,captured:false,captureUntil:0};
    room.phase='playing';room.deadline=100000;(room as any).lastStep=1000;
    let time=0;
    (room as any).physics={step:async(n:number)=>({time:time+=n/120,players:[],events:[],mascots:{},cpuMs:0,rssBytes:0,memoryBytes:0}),close(){}};
    (room as any).cpuSamples=1;(room as any).cpuRate=.04;
    await room.tick();assert.equal(room.simulationSpeed,1);
    (room as any).cpuRate=.005;await room.tick();assert.equal(room.simulationSpeed,5);
    (room as any).cpuRate=.04;await room.tick();assert.equal(room.simulationSpeed,1);
  }finally{room.close();if(old===undefined)delete process.env.GOLF_CPU_BUDGET;else process.env.GOLF_CPU_BUDGET=old;}
});

test('interactive search budget still completes straight, curved and moving-obstacle courses with real shots',async()=>{
  for(const level of ['data/levels/level-3.level','data/campaign/family-04-3.level','data/levels/level-7.level']){
    // Same 20 ms search allowance as Render; omit artificial CPU sleeps so
    // this checks shot quality independently of the CI machine's wall clock.
    const p=worker(level,{GOLF_BOT_CPU_FRACTION:'1',GOLF_BOT_SEARCH_MS:'20'});
    try{
      await p.configure(false,12345);await p.add(0,2);await p.prepareBots();let frame=await p.step(120);
      for(let i=0;i<300&&!frame.players[0]!.hole&&frame.players[0]!.strokes<48;i++){
        const ball=frame.players[0]!;
        if(!ball.moving&&!ball.captureUntil){const plan=await p.plan(0,'hard');assert.equal(plan.ok,true);assert.ok(plan.direction.every(Number.isFinite));assert.equal(await p.shot(0,plan.direction,plan.power),true);}
        frame=await p.step(1200);
      }
      assert.equal(frame.players[0]!.hole,true,`${level}: the bounded search must finish without teleporting or awarding a hole`);
      assert.ok(frame.players[0]!.strokes<=48);
    }finally{p.close();}
  }
});

test('the free-host planner caps legacy search settings without changing the live worker environment',()=>{
  const saved={...process.env};
  try{
    process.env.GOLF_CPU_BUDGET='.1';process.env.GOLF_BOT_SEARCH_MS='150';process.env.GOLF_BOT_CPU_FRACTION='.02';
    assert.equal(plannerEnvironment().GOLF_BOT_SEARCH_MS,'20');assert.equal(plannerEnvironment().GOLF_BOT_CPU_FRACTION,'.02');assert.equal(process.env.GOLF_BOT_SEARCH_MS,'150');
    process.env.GOLF_BOT_SEARCH_MS='5';assert.equal(plannerEnvironment().GOLF_BOT_SEARCH_MS,'5');
    delete process.env.GOLF_CPU_BUDGET;process.env.GOLF_BOT_SEARCH_MS='150';assert.equal(plannerEnvironment().GOLF_BOT_SEARCH_MS,'150');
  }finally{for(const key of ['GOLF_CPU_BUDGET','GOLF_BOT_SEARCH_MS','GOLF_BOT_CPU_FRACTION'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
