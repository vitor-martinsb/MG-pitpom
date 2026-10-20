import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';

const external=process.argv.includes('--url');
const app=external?null:(await import('../dist/index.js')).createServer();
let browser;
try{
  if(app)await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const url=app?`http://127.0.0.1:${app.server.address().port}`:process.argv[process.argv.indexOf('--url')+1];
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  fs.mkdirSync('../out/course-validation',{recursive:true});
  const contexts=await Promise.all([browser.newContext({viewport:{width:1100,height:900}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
  const [a,b]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
  for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/\bERROR\b|failed to compile|INVALID_OPERATION/i.test(m.text()))errors.push(m.text());});}
  await Promise.all([a.goto(url),b.goto(url)]);
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000})));
  await a.locator('#nickname').fill('Pituca');await a.locator('#create').click();
  await a.locator('#lobby').waitFor({state:'visible'});
  const code=await a.locator('#room-code').textContent();await b.locator('#nickname').fill('Pompom');await b.locator('#join-code').fill(code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});
  await a.locator('#game-mode').selectOption('impact');assert.equal(await b.locator('#game-mode').isDisabled(),true);
  await a.locator('#start').click();
  await Promise.all([a,b].map(p=>p.locator('#presentation').waitFor({state:'visible'})));
  const before=await a.evaluate(()=>GolfCourse.inspect());assert.ok(before.geometry.triangles.length>10);assert.ok(before.frame.intro);
  const previewFlag=await b.evaluate(()=>GolfCourse.inspect().frame.flagPoint);
  const distance=(x,y)=>Math.hypot(...x.map((value,index)=>value-y[index]));
  assert.ok(distance([before.frame.camera[0],before.frame.camera[2]],before.geometry.hole)<distance([before.frame.camera[0],before.frame.camera[2]],before.geometry.start));
  await a.locator('#skip-presentation').click();await a.locator('#presentation').waitFor({state:'hidden'});
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await b.locator('#presentation').isVisible(),true);
  assert.notDeepEqual(await b.evaluate(()=>GolfCourse.inspect().frame.flagPoint),previewFlag);
  if(app){const room=app.rooms.get(code);assert.equal(room.phase,'loading');assert.equal(room.members.get(1).ball.strokes,0);}
  await b.screenshot({path:'../out/course-validation/mobile-preview.png'});
  // Leave the second browser's seven-and-a-half-second presentation uninterrupted.
  await b.locator('#presentation').waitFor({state:'hidden',timeout:20000});
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>document.getElementById('loading').hidden && document.getElementById('status').textContent===GolfI18n.t('phase.playing'),{},{timeout:15000})));
  for(const p of [a,b]){
    await p.waitForFunction(()=>GolfCourse.inspect().frame.mode==='impact'&&!GolfCourse.inspect().frame.intro);
    const f=await p.evaluate(()=>GolfCourse.inspect().frame);assert.equal(f.players.filter(p=>p.visible).length,2);assert.ok(f.players.every(p=>!p.firstComplete));
    await p.locator('#minimap').waitFor({state:'visible'});
    assert.equal(await p.locator('#minimap-canvas').isVisible(),true);
  }
  if(app){const room=app.rooms.get(code);assert.equal(room.phase,'playing');assert.ok(room.deadline-performance.now()>110000);}
  const cat0=await a.evaluate(()=>GolfCourse.inspect().frame.cat);
  const flag0=await a.evaluate(()=>GolfCourse.inspect().frame.flagPoint);
  await a.evaluate(()=>GolfOnline.shot([0,0,-1],0));
  await a.waitForFunction(()=>GolfCourse.inspect().frame.players.find(p=>p.id===GolfCourse.inspect().frame.local).firstComplete,{},{timeout:20000});
  // Local course orientation can put the crossing on X or Z. Observe all
  // three axes across a short window, including a pause at a turning point.
  const movement=await a.waitForFunction(({cat,flag})=>{
    const f=GolfCourse.inspect().frame;
    return Math.hypot(...f.cat.map((v,i)=>v-cat[i]))>.005&&Math.abs(f.flagPoint[0]-flag[0])>.0001?f:false;
  },{cat:cat0,flag:flag0},{timeout:3000});
  const after=await movement.jsonValue();await movement.dispose();assert.equal(after.players.filter(p=>p.visible).length,2);
  const guest=await b.evaluate(()=>GolfCourse.inspect().frame);assert.equal(guest.players.filter(p=>p.visible).length,2);assert.equal(guest.players.find(p=>p.id===guest.local).firstComplete,false);
  assert.ok(distance(after.cat,cat0)>.005);
  assert.ok(Math.abs(after.flagPoint[0]-flag0[0])>.0001);assert.ok(after.actorVertices>1000&&after.actorVertices<24576);
  // Exercise a trusted capture/return snapshot in the renderer. The native
  // tests separately perform real captures for all 50 authoritative balls.
  const capture=await a.evaluate(()=>{
    const d=JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])),p=d.players[0],pos=p.slice(2,5);
    const send=ball=>Module.ccall('golf_online_receive',null,['string'],[JSON.stringify({type:'snapshot',hole:0,time:GolfCourse.inspect().frame.time,players:[ball]})]);
    const ball={id:p[0],pos:[pos[0]+.5,pos[1],pos[2]+.5],vel:[0,0,0],moving:true,hole:false,water:false,strokes:1,firstComplete:true,captured:true,captureUntil:9999};
    send(ball);const hidden=JSON.parse(Module.ccall('golf_course_frame','string',[],[])).players[0];
    send({...ball,pos,moving:false,captured:false,captureUntil:0});
    const returned=JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).players[0].slice(5,8);
    return {hidden,pos,returned};
  });
  assert.equal(capture.hidden.visible,false);assert.equal(capture.hidden.captured,true);
  for(let i=0;i<3;i++)assert.ok(Math.abs(capture.returned[i]-capture.pos[i])<.0001);
  await b.locator('#toggle-minimap').click();assert.equal(await b.locator('#minimap-canvas').isVisible(),false);await b.locator('#toggle-minimap').click();
  await b.locator('#music-controls').click();await b.locator('#language').selectOption('pt-BR');assert.equal(await b.locator('#toggle-minimap').getAttribute('aria-label'),'Mapa da pista');assert.equal((await b.locator('#minimap').textContent()).trim(),'');await b.locator('#music-controls summary').click();
  await a.screenshot({path:'../out/course-validation/desktop-course.png'});await b.screenshot({path:'../out/course-validation/mobile-course.png'});
  assert.deepEqual(errors,[]);
  await Promise.all(contexts.map(c=>c.close()));
  console.log('Course features: host mode, shared preview readiness, complete drone/skip, visible first-shot protection, live minimap/mascots, mobile collapse and translation passed.');
}finally{await browser?.close();app?.close();}
