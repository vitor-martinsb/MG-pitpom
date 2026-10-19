import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';

const app=createServer();let browser;
try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const contexts=await Promise.all([browser.newContext({viewport:{width:1200,height:900}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
  const pages=await Promise.all(contexts.map(c=>c.newPage())),[a,b]=pages,errors=[];
  for(const p of pages){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/\bERROR\b|INVALID_OPERATION|failed to compile/i.test(m.text()))errors.push(m.text());});}
  await Promise.all(pages.map(p=>p.goto(url)));await Promise.all(pages.map(p=>p.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000})));
  assert.equal(await a.locator('#holes option').count(),100);
  await a.locator('#nickname').fill('Campaign Host');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});
  const code=await a.locator('#room-code').textContent();await b.locator('#nickname').fill('Mobile Guest');await b.locator('#join-code').fill(code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});
  await b.evaluate(()=>GolfI18n.setLanguage('pt-BR'));await a.locator('#start').click();
  await Promise.all(pages.map(p=>p.locator('#presentation').waitFor({state:'visible'})));await Promise.all(pages.map(p=>p.locator('#skip-presentation').click()));
  const room=app.rooms.get(code);room.selectedLevels=Array.from({length:100},(_,i)=>i);room.holes=100;
  fs.mkdirSync('../out/campaign-validation',{recursive:true});const budgets=[];
  for(let index=0;index<100;index++){
    room.hole=index;await room.load();
    await Promise.all(pages.map(p=>p.waitForFunction(index=>GolfCourse.inspect().frame?.course===index+1&&GolfCourse.inspect().frame.intro,index,{timeout:30000})));
    await Promise.all(pages.map(p=>p.evaluate(()=>Module.ccall('golf_course_skip',null,[],[]))));
    await Promise.all(pages.map(p=>p.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&document.getElementById('loading').hidden&&document.getElementById('status').textContent===GolfI18n.t('phase.playing'))));
    const f=await a.evaluate(()=>GolfCourse.inspect().frame),g=await b.evaluate(()=>GolfCourse.inspect().frame);
    assert.equal(f.world,Math.floor(index/10)+1);assert.equal(f.stage,index%10+1);assert.equal(g.course,f.course);
    assert.ok(f.surfaceGroups>=3,`actual terrain draw calls, map ${index+1}`);
    assert.ok(f.landscapeGap>=9.9&&g.landscapeGap>=9.9,`landscape and camera clearance, map ${index+1}: ${f.landscapeGap}`);
    const metadata=await a.evaluate(i=>GOLF_CAMPAIGN.courses[i],index);
    assert.equal(f.wildlife.filter(a=>a.active).length,metadata.animals.length);
    for(const animal of f.wildlife.filter(a=>a.active))assert.ok(animal.pos.every(Number.isFinite));
    assert.ok(f.actorVertices>0&&f.actorVertices<16384,`actor capacity, map ${index+1}: ${f.actorVertices}`);
    const vertices=await a.evaluate(()=>Module.ccall('golf_garden_vertex_count','number',[],[]));assert.ok(vertices>0&&vertices<72000);
    budgets.push({course:index+1,vertices,actors:f.actorVertices,landscapeGap:f.landscapeGap});
    if(index%10===9){await a.waitForTimeout(500);await a.screenshot({path:`../out/campaign-validation/world-${f.world}.png`});await b.screenshot({path:`../out/campaign-validation/world-${f.world}-mobile.png`});console.log(`World ${f.world}: 10 courses rendered on desktop and mobile.`);}
    assert.ok((await b.locator('#campaign-world').textContent()).includes('Fase'));
  }
  // Both renderers consume the very same trusted server animal frame.
  const frame=await room.physics.step(0),trusted=JSON.stringify({type:'snapshot',hole:room.hole,time:frame.time,mascots:frame.mascots,players:frame.players});
  const states=await Promise.all(pages.map(p=>p.evaluate(snapshot=>{Module.ccall('golf_online_receive',null,['string'],[snapshot]);return JSON.parse(Module.ccall('golf_course_frame','string',[],[])).wildlife;},trusted)));
  assert.deepEqual(states[0],states[1]);
  // Trusted renderer fixtures: labels, capture visibility and cosmetics; native
  // tests separately trigger these interactions using physical contact.
  await b.evaluate(()=>GolfI18n.setLanguage('es'));
  assert.ok((await b.locator('#campaign-world').textContent()).includes('Nivel'));
  room.busy=true;
  for(const kind of [1,2,3,4]){
    await b.evaluate(({snapshot,kind})=>{
      const f=GolfCourse.inspect().frame,ball=snapshot.players.find(p=>p.id===f.local);
      ball.slowUntil=kind===1?f.time+10:0;ball.captureKind=kind===1?0:kind;
      ball.captured=kind>1;ball.captureUntil=kind>1?f.time+10:0;
      ball.effectKind=kind;ball.effectSerial=kind;
      Module.ccall('golf_online_receive',null,['string'],[JSON.stringify({...snapshot,type:'snapshot',hole:99})]);
    },{snapshot:frame,kind});
    await b.waitForFunction(kind=>document.getElementById('wildlife-effect').textContent===GolfI18n.t('effect.'+['','romeu','luna','frida','portal'][kind]),kind);
    for(const language of ['en','pt-BR','es']){
      const text=await b.evaluate(({language,kind})=>{GolfI18n.setLanguage(language);return [document.getElementById('wildlife-effect').textContent,GolfI18n.t('effect.'+['','romeu','luna','frida','portal'][kind])];},{language,kind});
      assert.equal(text[0],text[1]);
    }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('../out/campaign-validation/budgets.json',JSON.stringify(budgets,null,2));
  await Promise.all(contexts.map(c=>c.close()));
  console.log('100 WebAssembly maps: desktop/mobile rendering, biome HUD, animal counts, buffers, EN/PT/ES and shared authority passed.');
}finally{await browser?.close();app.close();}
