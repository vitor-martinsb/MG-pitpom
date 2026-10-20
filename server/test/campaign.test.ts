import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Physics} from '../src/physics.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('campaign publishes 100 different routes in ten worlds without replacing the original maps',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/campaign/manifest.json'),'utf8'));
  const config=JSON.parse(fs.readFileSync(path.join(root,'data/config/game.cfg'),'utf8'));
  assert.equal(config.num_levels,100);assert.equal(manifest.worlds.length,10);assert.equal(manifest.courses.length,100);
  assert.equal(new Set(manifest.courses.map((c:any)=>c.geometryHash)).size,100);
  assert.equal(manifest.version,2);assert.ok(manifest.similarity.maximum<manifest.similarity.limit);
  for(let world=1;world<=10;world++)assert.ok(new Set(manifest.courses.filter((c:any)=>c.world===world).map((c:any)=>c.layout)).size>=8);
  assert.ok(manifest.courses.filter((c:any)=>c.branches.length>0).length>=20);
  assert.ok(manifest.courses.filter((c:any)=>c.gapCount>0).length>=4);
  for(const c of manifest.courses){assert.equal(config[`level${c.number}`],c.path);assert.ok(fs.existsSync(path.join(root,c.path)));assert.equal(c.world,Math.ceil(c.number/10));}
  for(let i=1;i<=20;i++)assert.ok(fs.existsSync(path.join(root,`data/levels/level-${i}.level`)));
});
test('two authoritative workers reproduce the same animal patrols and fifty-ball state in classic and Impact',async()=>{
  for(const impact of [false,true]){
    const a=new Physics(root,'data/campaign/course-100.level'),b=new Physics(root,'data/campaign/course-100.level');
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
