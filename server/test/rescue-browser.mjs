import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {WebSocket} from 'ws';
import {createServer} from '../dist/index.js';
import {freezePhysics} from './room-fixture.mjs';

const app=createServer(),clients=[],errors=[];let browser;
try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/\bERROR\b|INVALID_OPERATION|failed to compile/i.test(m.text()))errors.push(m.text());});
  await page.goto(url);await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  await page.locator('#nickname').fill('Wildlife Host');await page.locator('#create').click();
  await page.locator('#lobby').waitFor({state:'visible'});const room=[...app.rooms.values()][0];
  for(let i=1;i<50;i++)await new Promise((resolve,reject)=>{
    const socket=new WebSocket(url.replace('http','ws')+'/ws');clients.push(socket);
    socket.on('error',reject);
    socket.on('open',()=>socket.send(JSON.stringify({type:'join',code:room.code,nickname:`Wildlife${i}`,color:'#66aa88',avatar:i%8})));
    socket.on('message',data=>{const m=JSON.parse(data.toString());if(m.type==='welcome')resolve();if(m.type==='load')socket.send(JSON.stringify({type:'ready',hole:m.hole}));if(m.type==='error')reject(Error(m.message));});
  });
  await page.locator('#game-mode').selectOption('impact');await page.locator('#start').click();
  await page.locator('#presentation').waitFor({state:'visible'});await page.locator('#skip-presentation').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.playing'));
  room.selectedLevels=[76];room.holes=1;room.hole=0;await room.load();
  await page.waitForFunction(()=>GolfCourse.inspect().frame?.course===77&&GolfCourse.inspect().frame.intro,{},{timeout:30000});
  await page.evaluate(()=>Module.ccall('golf_course_skip',null,[],[]));
  await page.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&document.getElementById('loading').hidden);
  const snapshot=await freezePhysics(room);
  assert.equal(snapshot.players.length,50);assert.equal(snapshot.mascots.wildlife.filter(a=>a.active).length,1);
  snapshot.time+=10;
  // Include both original mascots even if their safe-spawn search omitted one.
  snapshot.mascots.catActive=snapshot.mascots.dogActive=true;
  snapshot.mascots.catVisible=snapshot.mascots.dogVisible=true;
  snapshot.mascots.catPresence=snapshot.mascots.dogPresence=1;
  // Deliberately overpopulate only this trusted renderer capacity fixture.
  for(const animal of snapshot.mascots.wildlife){animal.active=animal.visible=true;animal.presence=1;animal.actionTime=snapshot.time-.2;animal.walking=true;}
  // Trusted snapshot render fixture: 50 rescues, alongside all five pets.
  for(const ball of snapshot.players){
    ball.captureKind=5;ball.captured=false;ball.moving=true;
    ball.rescueStarted=snapshot.time-1.2;ball.captureUntil=snapshot.time+2;
  }
  fs.mkdirSync('../out/campaign-validation',{recursive:true});
  for(const [name,width,height] of [['desktop',1200,900],['mobile',390,844]]){
    await page.setViewportSize({width,height});
    // Use the ordered server transport: a pending real snapshot must arrive
    // before this fixture, rather than overwriting a direct C bridge call.
    room.send([...room.members.values()][0],{...snapshot,type:'snapshot',hole:0});
    // The WebAssembly renderer may trail the received state. Wait until its
    // actor buffer actually contains the action geometry before measuring it.
    await page.waitForFunction(time=>{
      const f=JSON.parse(Module.ccall('golf_course_frame','string',[],[]));
      return f.time>=time&&f.actorVertices>0&&f.players.every(p=>p.captureKind===5&&!p.captured)&&f.wildlife.every(a=>Math.abs(a.actionTime-(time-.2))<.001);
    },snapshot.time);
    const frame=await page.evaluate(async()=>{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return JSON.parse(Module.ccall('golf_course_frame','string',[],[]));
    });
    assert.equal(frame.mode,'impact');assert.equal(frame.players.length,50);
    for(const lang of ['en','pt-BR','es']){
      await page.evaluate(lang=>GolfI18n.setLanguage(lang),lang);
      await page.waitForFunction(()=>document.getElementById('wildlife-effect').textContent===GolfI18n.t('effect.maritaca'));
      assert.doesNotMatch(await page.locator('#wildlife-effect').innerText(),/undefined|effect\./);
    }
    assert.equal(room.busy,true,'the room stays frozen throughout the renderer fixture');
    assert.ok(frame.actorVertices>0&&frame.actorVertices<24576,`${name} complete actors fit the reserved capacity: ${frame.actorVertices}`);
    await page.screenshot({path:`../out/campaign-validation/maritaca-fifty-${name}.png`});
    console.log(`${name}: 50 simultaneous maritaca rescues and five pets: ${frame.actorVertices}/24576 vertices.`);
  }
  assert.deepEqual(errors,[]);
}finally{for(const socket of clients)socket.terminate();await browser?.close();app.close();}
