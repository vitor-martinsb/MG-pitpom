import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
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
 for(const [width,height]of [[1280,800],[390,844],[320,740],[844,390]]){
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
 await host.setViewportSize({width:1280,height:800});await host.locator('#open-multiplayer').click();await createLobby(host,{nickname:'Host'});
 const room=[...app.rooms.values()][0],guest=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});guest.on('pageerror',e=>errors.push(e.message));await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Guest'});
 await lobbyTab(host,'mode');await host.locator('#play-style').selectOption('turns');await host.waitForFunction(()=>GolfOnline.turnState().style==='turns');
 await lobbyTab(guest,'mode');await guest.waitForFunction(()=>document.getElementById('play-style').value==='turns');assert.equal(await guest.locator('#play-style').isDisabled(),true);
 await lobbyTab(host,'maps');await lobbyTab(host,'mode');assert.equal(await host.locator('#play-style').inputValue(),'turns');
 await host.locator('#start').click();
 for(const p of [host,guest])await finishPresentation(p);
 for(const p of [host,guest]){
  await p.locator('#camera-zoom').waitFor({state:'visible',timeout:90000});
  assert.equal(await p.evaluate(()=>{const a=document.getElementById('camera-zoom').getBoundingClientRect(),b=document.getElementById('toggle-match-info').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}),false,'zoom must not cover the existing information toggle');
 }
 await host.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
 assert.equal(await guest.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
 assert.equal(await host.locator('#status').textContent(),'Por turnos');
 await host.locator('#turn-status').waitFor({state:'visible'});
 for(const p of [host,guest])assert.equal(await p.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraPlayer),1,'both cameras follow the current host');assert.match(await host.locator('#turn-status').textContent(),/Sua vez/);
 const before=await host.evaluate(()=>GolfCourse.inspect().frame.camera);
 await host.locator('#zoom-in').click();await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);
 await host.locator('#zoom-reset').click();await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom===1);
 await host.locator('#canvas').hover({position:{x:800,y:350}});await host.mouse.wheel(0,100);await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom>1);
 for(let i=0;i<12;i++)if(await host.locator('#zoom-out').isEnabled())await host.locator('#zoom-out').click();
 await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom===2.25);assert.equal(await host.locator('#zoom-out').isDisabled(),true);
 await host.locator('#zoom-reset').click();for(let i=0;i<12;i++)if(await host.locator('#zoom-in').isEnabled())await host.locator('#zoom-in').click();
 await host.waitForFunction(()=>GolfCourse.inspect().frame.zoom===.65);assert.equal(await host.locator('#zoom-in').isDisabled(),true);await host.locator('#zoom-reset').click();
 await guest.locator('#zoom-in').tap();await guest.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);assert.equal(room.members.get(2).ball.strokes,0,'mobile camera control never shoots');
 await host.screenshot({path:'../out/gameplay/turns-desktop.png'});await guest.screenshot({path:'../out/gameplay/turns-mobile.png'});
 assert.ok(before.every(Number.isFinite));await host.evaluate(()=>GolfOnline.shot([1,0,0],.01));
 await guest.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot,{},{timeout:60000});
 assert.equal(room.turn,2);assert.equal(room.members.get(1).ball.moving,false);assert.equal(await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
 for(const p of [host,guest])await p.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraPlayer===2);
 assert.equal(await guest.evaluate(()=>GolfCourse.inspect().frame.zoom<1),true,'automatic following preserves personal zoom');
 await guest.close();await host.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraPlayer===1);
 assert.equal(room.turn,1,'disconnect restores the remaining player and camera');
 assert.deepEqual(errors,[]);console.log('Gameplay: interactive six-step tutorial, responsive navigation, native zoom limits/reset/wheel/mobile, synced turn settings, native turn gating, settled-ball rotation, automatic opponent following, own-turn return and disconnect recovery passed.');
}finally{await browser?.close();app.close();}
