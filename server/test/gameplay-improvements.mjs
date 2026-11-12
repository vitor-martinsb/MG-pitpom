import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {freezePhysics} from './room-fixture.mjs';
import {visitMultiplayer,createLobby,joinLobby,lobbyTab,finishPresentation} from './navigation-fixture.mjs';
process.env.GOLF_HOLE_SECONDS='300';
const app=createServer();let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await (process.argv.includes('--webkit')?webkit.launch({headless:true}):chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--enable-unsafe-swiftshader']}));
 const errors=[],host=await browser.newPage({viewport:{width:1280,height:800}});host.on('pageerror',e=>errors.push(e.message));
 await host.addInitScript(()=>localStorage.setItem('pitpom-language','pt-BR'));
 await host.goto(url);await host.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await host.locator('#continue-home').click();
 fs.mkdirSync('../out/gameplay',{recursive:true});
 if(!process.argv.includes('--turns-only'))for(const [width,height]of [[1280,800],[390,844],[320,740],[844,390]]){
  await host.setViewportSize({width,height});await host.locator('#open-tutorial').click();
  await host.locator('#tutorial').waitFor({state:'visible'});assert.equal(await host.locator('#tutorial-step').textContent(),'Etapa 1 de 6');
  await host.locator('#tutorial-force').focus();await host.locator('#tutorial-force').press('End');await host.locator('#tutorial-practice').click();assert.match(await host.locator('#tutorial-feedback').textContent(),/Demonstração/);
  await host.locator('#tutorial-next').click();await host.locator('#tutorial-demo-in').click();assert.match(await host.locator('#tutorial-field').getAttribute('style'),/scale\(1.15\)/);
  await host.locator('#tutorial-prev').click();assert.equal(await host.locator('#tutorial-step').textContent(),'Etapa 1 de 6');
  for(let n=0;n<5;n++)await host.locator('#tutorial-next').click();assert.equal(await host.locator('#tutorial-step').textContent(),'Etapa 6 de 6');
  const g=await host.locator('#tutorial').evaluate(e=>({w:e.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(g.w<=width&&g.scroll<=width);
  await host.screenshot({path:`../out/gameplay/tutorial-${width}x${height}.png`});await host.locator('#tutorial-next').click();assert.equal(await host.locator('#tutorial').isVisible(),false);
  await host.locator('#open-tutorial').click();await host.keyboard.press('Escape');assert.equal(await host.locator('#tutorial').isVisible(),false);
 }
 if(!process.argv.includes('--turns-only'))console.log('Tutorial desktop/mobile passed');
 await host.setViewportSize({width:1280,height:800});await host.locator('#open-multiplayer').click();await createLobby(host,{nickname:'Host'});
 const room=[...app.rooms.values()][0];room.configurePool([...room.members.values()][0],'custom',[0]);room.configure([...room.members.values()][0],1,'classic','simultaneous');const guest=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});guest.on('pageerror',e=>errors.push(e.message));await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Guest'});
 const observer=await browser.newPage({viewport:{width:1024,height:768}});observer.on('pageerror',e=>errors.push(e.message));await visitMultiplayer(observer,url);await joinLobby(observer,{code:room.code,nickname:'Observer'});
 await lobbyTab(host,'mode');await host.locator('#play-style').selectOption('turns');await host.waitForFunction(()=>GolfOnline.turnState().style==='turns');
 await lobbyTab(guest,'mode');await guest.waitForFunction(()=>document.getElementById('play-style').value==='turns');assert.equal(await guest.locator('#play-style').isDisabled(),true);
 await lobbyTab(host,'maps');await lobbyTab(host,'mode');assert.equal(await host.locator('#play-style').inputValue(),'turns');
 await host.locator('#start').click();
 for(const p of [host,guest,observer]){await finishPresentation(p);await p.waitForFunction(()=>document.getElementById('timer').textContent===GolfI18n.t('turns.noTime'));}console.log('All three clients loaded an untimed turn match');
 for(const p of [host]){
  await p.locator('#camera-zoom').waitFor({state:'visible',timeout:90000});
  assert.equal(await p.evaluate(()=>{const a=document.getElementById('camera-zoom').getBoundingClientRect(),b=document.getElementById('toggle-match-info').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}),false,'zoom must not cover the existing information toggle');
 }
 await host.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
 assert.equal(await guest.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
 assert.equal(await host.locator('#status').textContent(),'Por turnos');
 await host.locator('#turn-status').waitFor({state:'visible'});
 await guest.waitForFunction(()=>GolfCourse.inspect().frame.overview);assert.equal(await guest.locator('#camera-zoom').isVisible(),true);assert.equal(await host.evaluate(()=>GolfCourse.inspect().frame.overview),false);assert.match(await host.locator('#turn-status').textContent(),/Sua vez/);
 const before=await host.evaluate(()=>GolfCourse.inspect().frame.camera);
 if(!process.argv.includes('--turns-only')){
 await host.locator('#zoom-in').click();await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);
 await host.locator('#zoom-reset').click();await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom===1);
 await host.locator('#canvas').hover({position:{x:800,y:350}});await host.mouse.wheel(0,100);await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom>1);
 for(let i=0;i<12;i++)if(await host.locator('#zoom-out').isEnabled())await host.locator('#zoom-out').click();
 await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom===2.25);assert.equal(await host.locator('#zoom-out').isDisabled(),true);
 await host.locator('#zoom-reset').click();for(let i=0;i<12;i++)if(await host.locator('#zoom-in').isEnabled())await host.locator('#zoom-in').click();
 await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom===.65);assert.equal(await host.locator('#zoom-in').isDisabled(),true);await host.locator('#zoom-reset').click();
 }
 if(!process.argv.includes('--turns-only'))console.log('Native zoom controls passed');
 // Real native aiming: broadcast the same direction/path and strength seen locally.
 for(const p of [guest,observer]){
  await p.waitForFunction(()=>GolfCourse.inspect().frame.overview&&GolfCourse.inspect().frame.cameraPlayer===1);
  await p.locator('#camera-zoom').waitFor({state:'visible'});
 }
 await guest.locator('#zoom-in').tap();await guest.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);
 assert.equal(room.members.get(2).ball.strokes,0,'spectator zoom cannot shoot');
 await guest.locator('#zoom-reset').tap();await guest.waitForFunction(()=>GolfCourse.inspect().frame.zoom===1);
 await host.bringToFront();await host.locator('#canvas').focus();await host.waitForTimeout(1500);
 const ball=await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
 await host.mouse.move(...ball);await host.mouse.down();await host.mouse.move(ball[0]+80,ball[1]+30,{steps:8});
 await guest.waitForFunction(()=>GolfCourse.inspect().frame.remoteAimArrows===5,{},{timeout:15000});
 const localPower=await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).aimPower);
 assert.ok(localPower>0);await guest.waitForFunction(power=>Math.abs(GolfCourse.inspect().frame.remoteAimPower-power)<.01,localPower,{timeout:15000});
 await guest.locator('#turn-aim-status').waitFor({state:'visible'});assert.match(await guest.locator('#turn-aim-status').textContent(),/Host.*%/);
 const initialAim=room.state().aim;
 await host.mouse.move(ball[0]-60,ball[1]+50,{steps:8});
 await guest.waitForFunction(previous=>{const a=GolfOnline.turnState().aim;return a&&Math.hypot(...a.direction.map((v,i)=>v-previous[i]))>.3;},initialAim.direction);
 await guest.waitForFunction(()=>Math.abs(GolfCourse.inspect().frame.remoteAimPower-GolfOnline.turnState().aim.power)<.001);
 assert.equal(await guest.evaluate(()=>GolfCourse.inspect().frame.cameraPlayer),1,'mobile guest follows the active host');
 await guest.screenshot({path:'../out/gameplay/shared-aim-mobile.png'});
 await host.evaluate(()=>GolfOnline.cancelAim());await host.mouse.up();await guest.waitForFunction(()=>GolfCourse.inspect().frame.remoteAimPower===0);
 assert.equal(room.members.get(1).ball.strokes,0,'canceling the preview never shoots');
 await host.screenshot({path:'../out/gameplay/turns-desktop.png'});await guest.screenshot({path:'../out/gameplay/turns-mobile.png'});
 for(const p of [guest,observer])await p.evaluate(()=>{
  window.followFrames=[];window.followListener=e=>{const f=e.detail,b=f.players.find(p=>p.id===1);if(f.overview&&f.cameraPlayer===1)window.followFrames.push({ball:b.pos,focus:f.cameraFocus});};window.addEventListener('courseframe',window.followListener);
 });
 assert.ok(before.every(Number.isFinite));await host.evaluate(()=>GolfOnline.shot([1,0,0],.28));
 await guest.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot,{},{timeout:60000});
 for(const p of [guest,observer])assert.equal(await p.evaluate(()=>{
  window.removeEventListener('courseframe',window.followListener);const frames=window.followFrames;
  return frames.length>1&&frames.some(f=>Math.hypot(f.focus[0]-frames[0].focus[0],f.focus[2]-frames[0].focus[2])>.01);
 }),true,'both non-host spectators pan with the moving host ball');
 assert.equal(room.turn,2);assert.equal(room.members.get(1).ball.moving,false);assert.equal(await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
 for(const p of [host,observer])await p.waitForFunction(()=>GolfCourse.inspect().frame.overview&&GolfCourse.inspect().frame.cameraPlayer===2);await guest.waitForFunction(()=>!GolfCourse.inspect().frame.overview);
 await guest.locator('#zoom-in').tap();await guest.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);assert.equal(room.members.get(2).ball.strokes,0,'mobile camera control never shoots');
 await guest.locator('#canvas').focus();await guest.bringToFront();await guest.waitForTimeout(1800);
 const mobileBall=await guest.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
 // Touch events exercise the native mobile aiming path, with the mouse on WebKit.
 const cdp=process.argv.includes('--webkit')?null:await guest.context().newCDPSession(guest);
 if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:mobileBall[0],y:mobileBall[1],radiusX:5,radiusY:5}]});await guest.waitForTimeout(120);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:mobileBall[0]+45,y:mobileBall[1]+110,radiusX:5,radiusY:5}]});}
 else {await guest.mouse.move(...mobileBall);await guest.mouse.down();await guest.mouse.move(mobileBall[0]+45,mobileBall[1]+110,{steps:6});}
 await host.waitForFunction(()=>GolfCourse.inspect().frame.remoteAimArrows===5,{},{timeout:15000});
 await host.locator('#turn-aim-status').waitFor({state:'visible'});await host.screenshot({path:'../out/gameplay/shared-aim-desktop.png'});
 const waitingCamera=await host.evaluate(()=>GolfCourse.inspect().frame.camera);
 await host.locator('#camera-zoom').waitFor({state:'visible'});await host.locator('#zoom-in').click();await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);
 assert.ok(waitingCamera.every(Number.isFinite));
 await observer.close();await guest.close();await host.waitForFunction(()=>!GolfCourse.inspect().frame.overview&&GolfCourse.inspect().frame.remoteAimPower===0&&GolfCourse.inspect().frame.zoom===1);await host.locator('#camera-zoom').waitFor({state:'visible'});
 assert.equal(room.turn,1,'disconnect restores the remaining player and camera');
 await host.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
 await freezePhysics(room);
 // Authoritative snapshots can now be shot-ready while a ramp still creeps.
 const creeping=room.members.get(1).ball;creeping.moving=false;creeping.vel=[.04,-.002,0];creeping.pos[0]+=.002;room.snapshot(true);
 await host.waitForFunction(x=>{const d=JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[]));return d.canShoot&&Math.abs(d.players.find(p=>p[0]===d.local)[2]-x)<.00001;},creeping.pos[0]);
 await host.locator('#canvas').focus();const slowBall=await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
 await host.mouse.move(...slowBall);await host.mouse.down();await host.waitForTimeout(120);await host.mouse.move(slowBall[0]+80,slowBall[1]+30,{steps:8});
 await host.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).aimArrows===5);await host.mouse.up();
 for(let tick=0;room.members.get(1).ball.strokes!==2;tick++){assert.ok(tick<100,'a real input stroke is accepted during slow ramp creep');await host.waitForTimeout(50);}
 room.members.get(1).ball.strokes=20;room.members.get(1).ball.moving=false;room.members.get(1).dnf[room.hole]=true;room.publish();room.snapshot(true);
 await host.waitForFunction(()=>!JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
 await host.waitForFunction(()=>document.getElementById('summary').textContent.includes('20/20'));
 assert.equal(await host.locator('#timer').textContent(),'Sem limite de tempo');assert.match(await host.locator('#help').textContent(),/20.*DNF/);

 assert.deepEqual(errors,[]);console.log('Gameplay: synced turn settings, native turn gating, settled-ball rotation, host and two guests follow the current ball with independent spectator zoom, shared native mouse/touch aiming and power, mobile zoom, own-turn return and disconnect recovery passed.');
}catch(error){
 for(const [index,page]of (browser?.contexts().flatMap(c=>c.pages())??[]).entries()){
  try{console.error('Gameplay failure client',index,await page.evaluate(()=>({native:JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])),frame:GolfCourse.inspect().frame,turn:GolfOnline.turnState()})));await page.screenshot({path:`../out/gameplay/failure-${index}.png`,timeout:10000});}catch{}
 }
 throw error;
}finally{await browser?.close();app.close();}
