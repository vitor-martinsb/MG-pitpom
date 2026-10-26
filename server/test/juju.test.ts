import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Physics} from '../src/physics.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('Juju is a stable fourth companion candidate; authority includes clean mud state and preserves planner isolation',async()=>{
 const p=new Physics(root,'data/levels/level-3.level');
 try{
  await p.add(0,1);await p.add(1,2);let selected=-1;
  for(let seed=1;seed<=32;seed++){
   await p.configure(false,seed);const frame=await p.step(0);
   assert.equal(frame.mascots.wildlife!.length,4);assert.equal(frame.mascots.wildlife!.filter(a=>a.active).length,1);
   if(frame.mascots.thirdKind===3){selected=seed;break;}
  }
  assert.ok(selected>0);const before=await p.step(0),after=await p.step(1200);
  assert.equal(after.mascots.thirdKind,3);assert.equal(after.mascots.wildlife![3]!.visible,true);
  assert.notDeepEqual(after.mascots.wildlife![3]!.pos,before.mascots.wildlife![3]!.pos);
   assert.ok(after.mascots.wildlife![3]!.stride>0);
   assert.ok(after.mascots.mudPrints!.length>0&&after.mascots.mudPrints!.length<=48);
   const prints=structuredClone(after.mascots.mudPrints);await p.plan(0,'easy');assert.deepEqual((await p.step(0)).mascots.mudPrints,prints);
  for(const ball of after.players){assert.equal(ball.mudShots,0);assert.equal(ball.mudFadeUntil,0);}
  const balls=structuredClone(after.players);await p.plan(0,'easy');assert.deepEqual((await p.step(0)).players,balls);
  await p.configure(false,selected,.5,3);assert.notEqual((await p.step(0)).mascots.thirdKind,3);
 }finally{p.close();}
});
