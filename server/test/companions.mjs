import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,createLobby,joinLobby,finishPresentation} from './navigation-fixture.mjs';
import {freezePhysics} from './room-fixture.mjs';
import {companionFrame} from './companions-fixture.mjs';
const app=createServer();let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-unsafe-swiftshader']});
 fs.mkdirSync('../out/companions',{recursive:true});
 for(const device of ['desktop','mobile']){
  const host=await browser.newPage({viewport:{width:1280,height:800}}),guest=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('pitpom-language','pt-BR'));}
  await visitMultiplayer(host,url);await createLobby(host,{nickname:'Desktop'});const room=[...app.rooms.values()].find(r=>r.phase==='lobby'),ownerHost=room.members.get(1);
  room.physicsSeed=6;room.configurePool(ownerHost,'custom',[room.levels.indexOf('data/levels/level-3.level')]);room.configure(ownerHost,1,'classic','simultaneous');
  await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Mobile'});
  await host.locator('#start').click();for(const page of [host,guest]){await finishPresentation(page);await page.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);}
  await freezePhysics(room);await companionFrame(room,0);
  const owner=device==='desktop'?ownerHost:room.members.get(2),page=device==='desktop'?host:guest,observer=page===host?guest:host,ball=owner.ball,s=room.mascots.companions.smanata;
  const dx=s.pos[0]-ball.pos[0],dz=s.pos[2]-ball.pos[2],distance=Math.hypot(dx,dz);
  await page.evaluate(direction=>GolfOnline.shot(direction,.22),[dx/distance,0,dz/distance]);
  for(let i=0;i<100&&owner.lastSequence!==1;i++)await page.waitForTimeout(25);assert.equal(owner.lastSequence,1);
  for(let i=0;i<60&&owner.ball.captureKind!==7;i++)await companionFrame(room,5);
  assert.equal(owner.ball.captureKind,7);const frozen=[...owner.ball.pos];
  for(const p of [host,guest])await p.waitForFunction(id=>GolfCourse.inspect().frame.players.find(p=>p.id===id)?.captureKind===7,owner.id);
  assert.equal(await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
  await page.screenshot({path:`../out/companions/${device}-benedita-gaze.png`});
  await companionFrame(room,120);assert.deepEqual(owner.ball.pos,frozen);assert.deepEqual(owner.ball.vel,[0,0,0]);
  for(let i=0;i<100&&owner.ball.captureKind!==8;i++)await companionFrame(room);
  assert.equal(owner.ball.captureKind,8);assert.equal(owner.ball.strokes,1);
  await page.waitForFunction(id=>GolfCourse.inspect().frame.players.find(p=>p.id===id)?.captureKind===8,owner.id);
  await page.screenshot({path:`../out/companions/${device}-smanata-running.png`});
  for(let i=0;i<100&&room.mascots.companions.smanata.state!==3;i++)await companionFrame(room);
  assert.equal(room.mascots.companions.smanata.state,3);
  for(const p of [host,guest])await p.waitForFunction(()=>GolfCourse.inspect().frame.smanataState===3);
  await observer.evaluate(()=>GolfOnline.releaseSmanata());await observer.waitForTimeout(100);assert.equal(owner.ball.captureKind,8,'only the held ball owner may tap');
  await page.locator('#canvas').focus();await page.waitForTimeout(400);
  await page.screenshot({path:`../out/companions/${device}-smanata-holding.png`});
  const screen=await page.evaluate(()=>GolfCourse.inspect().frame.smanataScreen),drop=[...room.mascots.companions.smanata.pos];
  if(device==='mobile')await page.touchscreen.tap(...screen);else await page.mouse.click(...screen);
  await page.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
  assert.equal(owner.ball.captureKind,0);assert.equal(owner.ball.moving,false);assert.equal(owner.ball.strokes,1);assert.deepEqual(owner.ball.vel,[0,0,0]);
  assert.ok(Math.abs(owner.ball.pos[0]-drop[0])<.0002&&Math.abs(owner.ball.pos[2]-drop[2])<.0002);
  await page.waitForFunction(()=>{const s=JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen,old=window.__companionScreen;window.__companionScreen=s;return old&&Math.hypot(old[0]-s[0],old[1]-s[1])<.1;});
  const [x,y]=await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
  if(device==='mobile'){
   const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await page.waitForTimeout(150);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+80}]});await page.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(150);await page.mouse.move(x,y+80,{steps:10});await page.waitForTimeout(150);await page.mouse.up();}
  for(let i=0;i<160&&owner.ball.strokes!==2;i++)await page.waitForTimeout(25);assert.equal(owner.ball.strokes,2,'the next real shot is available after the drop');
  for(let i=0;i<100&&![0,5].includes(room.mascots.companions.smanata.state);i++)await companionFrame(room);
  const returned=room.mascots.companions.smanata;assert.ok([0,5].includes(returned.state));assert.ok(Math.hypot(...returned.pos.map((v,i)=>v-returned.home[i]))<.001);
  assert.deepEqual(errors,[]);await host.close();await guest.close();room.close();
  console.log(`${device}: real gaze, chase, carry, owner-only click/touch, stationary drop, subsequent shot and safe return passed.`);
 }
}finally{await browser?.close();app.close();}
