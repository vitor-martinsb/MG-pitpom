import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Physics} from '../src/physics.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('eighty courses preserve the twenty originals and group three cumulative evolutions per family',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/campaign/manifest.json'),'utf8'));
  const config=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
  const order=[3,2,4,1,...Array.from({length:16},(_,i)=>i+5)];
  assert.equal(config.num_levels,80);assert.equal(manifest.courses.length,80);
  assert.equal(config.campaign_version,undefined);
  assert.equal(manifest.reference,'ecaf879c1611601931338dfe5c234e01db22de89');
  for(const [index,number] of order.entries()){
    const expected=`data/levels/level-${number}.level`;
    assert.equal(config[`level${index*4+1}`],expected);
    assert.equal(manifest.courses[index*4].path,expected);
    for(let revision=0;revision<4;revision++){
      const row=manifest.courses[index*4+revision];
      assert.equal(row.label,`${index+1}${revision?'.'+revision:''}`);
      assert.equal(row.parent,revision?manifest.courses[index*4+revision-1].label:null);
      assert.equal(row.path,config[`level${index*4+revision+1}`]);
    }
    assert.ok(fs.existsSync(path.join(root,expected)));
  }
  assert.equal(fs.readdirSync(path.join(root,'data/campaign')).filter(n=>n.endsWith('.level')).length,60);
});
test('two authoritative workers reproduce the same animal patrols and fifty-ball state in classic and Impact',async()=>{
  for(const impact of [false,true]){
    const a=new Physics(root,'data/levels/level-20.level'),b=new Physics(root,'data/levels/level-20.level');
    try{
      await Promise.all([a.configure(impact,735),b.configure(impact,735)]);
      for(let slot=0;slot<50;slot++)await Promise.all([a.add(slot,slot+1),b.add(slot,slot+1)]);
      for(const ticks of [120,120,120]){
        const [x,y]=await Promise.all([a.step(ticks),b.step(ticks)]);
        assert.deepEqual(x.mascots,y.mascots);assert.deepEqual(x.players,y.players);
        assert.equal(x.mascots.wildlife?.filter(a=>a.active).length,3);assert.equal(x.players.length,50);
        for(const p of x.players){assert.ok(p.pos.every(Number.isFinite));assert.equal(p.strokes,0);assert.equal(p.effectSerial,0);}
      }
      const before=await a.step(0);await a.plan(0,'hard');const after=await a.step(0);
      assert.deepEqual(after.players,before.players);assert.deepEqual(after.mascots,before.mascots);
      assert.equal(await a.shot(0,[0,0,-1],.25),true);
      const frame=await a.step(120);
      assert.equal(frame.players[0]!.strokes,1);assert.ok(frame.players.slice(1).every(p=>p.strokes===0));
      assert.ok(frame.events.some(e=>e.kind==='shot'&&e.player===1));
    }finally{a.close();b.close();}
  }
});
