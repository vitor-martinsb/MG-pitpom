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
  assert.deepEqual(manifest.petRoster,{fixed:['pituca','pompom'],thirdCandidates:['romeu','luna','frida'],count:3});
  const translations=JSON.parse(fs.readFileSync(path.join(root,'data/locales.json'),'utf8'));
  for(const lang of ['en','pt-BR','es']){
    const names=Array.from({length:20},(_,i)=>translations[lang][`family.${i+1}`]);
    assert.equal(new Set(names).size,20);assert.ok(names.every(name=>typeof name==='string'&&name.length>4));
    for(const row of manifest.courses){assert.equal(row.familyNameKey,`family.${row.family}`);assert.equal(row.displayNumber,row.revision+1);}
  }
});
test('two authoritative workers reproduce the same animal patrols and fifty-ball state in classic and Impact',async()=>{
  for(const impact of [false,true]){
    const a=new Physics(root,'data/levels/level-20.level'),b=new Physics(root,'data/levels/level-20.level');
    try{
      await Promise.all([a.configure(impact,735),b.configure(impact,735)]);
      for(let slot=0;slot<50;slot++)await Promise.all([a.add(slot,slot+1),b.add(slot,slot+1)]);
      // Cross the former appearance/absence windows without reloading the field.
      for(const ticks of [120,1200,1200,1200,1200,1200,1200]){
        const [x,y]=await Promise.all([a.step(ticks),b.step(ticks)]);
        assert.deepEqual(x.mascots,y.mascots);assert.deepEqual(x.players,y.players);
        assert.equal(x.mascots.wildlife?.filter(a=>a.active).length,1);assert.equal(x.players.length,50);
        assert.equal(x.mascots.catActive,true);assert.equal(x.mascots.dogActive,true);
        assert.equal(x.mascots.wildlife?.find(a=>a.active)?.kind,x.mascots.thirdKind);
        assert.equal(Number(x.mascots.catVisible)+Number(x.mascots.dogVisible)+x.mascots.wildlife!.filter(a=>a.visible).length,3);
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

test('resident selection stays fixed for a whole field and never repeats the previous companion',async()=>{
  let previous=-1;
  for(let field=0;field<9;field++){
    const physics=new Physics(root,'data/levels/level-3.level');
    try{
      const configured=await physics.configure(false,field*735+19,.5,previous);
      assert.ok([0,1,2].includes(configured.thirdKind));
      assert.notEqual(configured.thirdKind,previous);
      previous=configured.thirdKind;
      for(const ticks of [0,1200,1200,1200]){
        const {mascots}=await physics.step(ticks);
        assert.equal(mascots.thirdKind,previous);
        assert.equal(mascots.catVisible,true);assert.equal(mascots.dogVisible,true);
        assert.deepEqual(mascots.wildlife?.filter(a=>a.visible).map(a=>a.kind),[previous]);
      }
    }finally{physics.close();}
  }
});
