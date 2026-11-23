import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {createLobby,visitMultiplayer,joinLobby,finishPresentation} from './navigation-fixture.mjs';
import {freezePhysics} from './room-fixture.mjs';
import {captureMeg,finishMegRelease} from './meg-fixture.mjs';
const app=createServer();let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await (process.argv.includes('--webkit')?webkit.launch({headless:true}):chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-unsafe-swiftshader']}));
 const errors=[],host=await browser.newPage({viewport:{width:1280,height:800}}),guest=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('pitpom-language','pt-BR'));}
 await visitMultiplayer(host,url);await createLobby(host,{nickname:'Meg desktop'});
 const room=[...app.rooms.values()][0],owner=room.members.get(1);room.physicsSeed=7;room.configurePool(owner,'custom',[room.levels.indexOf('data/levels/level-2.level')]);room.configure(owner,1,'classic','simultaneous');
 await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Meg mobile'});
 await host.locator('#start').click();for(const page of [host,guest])await finishPresentation(page);
 for(const page of [host,guest])await page.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
 await freezePhysics(room);await captureMeg(room,[...room.members.values()],async(member,shot)=>{
  const page=member.id===owner.id?host:guest;
  await page.evaluate(shot=>GolfOnline.shot(shot.direction,shot.power),shot);
  const deadline=performance.now()+10000;
  while(member.lastSequence!==1&&performance.now()<deadline)await page.waitForTimeout(25);
  assert.equal(member.lastSequence,1,'the real browser sequence must include the capture shot');
 });
 for(const page of [host,guest])await page.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f?.players.find(p=>p.id===f.local)?.captureKind===6&&f.wildlife[4].visible;});
 // Let the existing snapshot interpolation and camera settle before inspecting
 // the held illustration or calculating a direct tap on its visible body.
 for(const page of [host,guest])await page.waitForTimeout(500);
 fs.mkdirSync('../out/meg',{recursive:true});
 const actorVertices=await host.evaluate(()=>GolfCourse.inspect().frame.actorVertices);assert.ok(actorVertices>0&&actorVertices<73728,'Meg stays inside the existing actor buffer');
 assert.equal(await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
 await host.screenshot({path:'../out/meg/desktop-holding.png'});await guest.screenshot({path:'../out/meg/mobile-holding.png'});
 const angle=await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraAngle);
 await host.locator('#canvas').focus();await host.mouse.move(1050,430);await host.mouse.down();
 await host.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await host.mouse.move(1190,470,{steps:12});
 await host.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await host.mouse.up();
 await host.waitForFunction(angle=>Math.abs(JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraAngle-angle)>.1,angle);
 await host.waitForTimeout(300);await host.screenshot({path:'../out/meg/desktop-3d-profile.png'});
 const screen=await host.evaluate(()=>GolfCourse.inspect().frame.megScreen);
 await host.locator('#canvas').focus();await host.mouse.click(screen[0]>640?120:1160,400);await host.waitForTimeout(200);
 assert.equal(owner.ball.captureKind,6,'clicking outside Meg cannot release the ball');
 await host.mouse.click(...screen);
 await host.waitForFunction(()=>GolfCourse.inspect().frame.wildlife[4].action===3);
 assert.equal(owner.ball.captureKind,6);assert.deepEqual(owner.ball.vel,[0,0,0]);await finishMegRelease(room,[owner]);
 await host.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f.players.find(p=>p.id===f.local).captureKind===0;});
 assert.equal(owner.ball.strokes,1);assert.ok(Math.abs(Math.hypot(...owner.ball.vel)-20)<.0001);assert.equal(room.members.get(2).ball.captureKind,6,'desktop tap never releases the mobile player');
 await host.waitForFunction(()=>GolfCourse.inspect().frame.megLie>.99);
 await host.screenshot({path:'../out/meg/desktop-lying-release.png'});
 assert.equal(owner.ball.vel[1],0);assert.ok(Math.abs(owner.ball.pos[1]-(-.375+.12))<.002);
 await guest.waitForFunction(()=>GolfCourse.inspect().frame.players.find(p=>p.id===1).captureKind===0);
 await guest.locator('#canvas').focus();await guest.touchscreen.tap(...await guest.evaluate(()=>GolfCourse.inspect().frame.megScreen));
 await guest.waitForFunction(()=>GolfCourse.inspect().frame.wildlife[4].action===3);
 await finishMegRelease(room,[room.members.get(2)]);
 await guest.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f.players.find(p=>p.id===f.local).captureKind===0;});
 assert.equal(room.members.get(2).ball.strokes,1);assert.equal(owner.ball.strokes,1);
 assert.ok(Math.abs(Math.hypot(...room.members.get(2).ball.vel)-20)<.0001);
 await guest.screenshot({path:'../out/meg/mobile-release.png'});
 // Complete the real launch instead of ending the test at release velocity.
 // Both owners must regain aim and submit a real second shot through the UI.
 for(let tick=0;tick<80;tick++){
  const f=await room.physics.step(60);room.worldTime=f.time;room.mascots=f.mascots;
  for(const ball of f.players)room.members.get(ball.id).ball=ball;room.snapshot(true);
  if([...room.members.values()].every(m=>!m.ball.moving))break;
 }
 for(const [page,member] of [[host,owner],[guest,room.members.get(2)]]){
  assert.equal(member.ball.moving,false);assert.equal(member.ball.captureKind,0);assert.equal(member.ball.strokes,1);
  await page.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
  await page.locator('#canvas').focus();
  await page.waitForFunction(()=>{
   const screen=JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen,previous=window.__megAimScreen;
   window.__megAimScreen=screen;return previous&&Math.hypot(screen[0]-previous[0],screen[1]-previous[1])<.1;
  });
  const [x,y]=await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
  if(page===host){
   await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(150);
   await page.mouse.move(x,y+80,{steps:10});await page.waitForTimeout(150);await page.mouse.up();
  }else{
   const cdp=await page.context().newCDPSession(page).catch(()=>null);
   if(cdp){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+80}]});await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }else{
    // Playwright WebKit's touchscreen only exposes taps; the same pointer
    // path still proves a real second shot on its mobile viewport.
    await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(150);
    await page.mouse.move(x,y+80,{steps:10});await page.waitForTimeout(150);await page.mouse.up();
   }
  }
  const deadline=performance.now()+10000;
  while(member.ball.strokes!==2&&performance.now()<deadline)await page.waitForTimeout(25);
  assert.equal(member.ball.strokes,2,'a real follow-up shot must be accepted after tapping Meg: '+member.nickname+' '+await page.evaluate(()=>Module.ccall('golf_online_diagnostics','string',[],[])));
 }
 // Trusted render fixture: both free balls move around the resting Meg.
 // Verify the actual rendered heading, including the lying recovery pose.
 for(const pose of ['lying','idle'])for(const direction of [[1,0],[-1,0],[0,1],[0,-1]]){
  const meg=room.mascots.wildlife[4];room.worldTime+=.05;
  meg.action=pose==='lying'?4:0;meg.actionTime=room.worldTime-.4;
  for(const member of room.members.values()){
   member.ball.pos=[meg.pos[0]+direction[0]*3,meg.pos[1]+.12,meg.pos[2]+direction[1]*3];
   member.ball.vel=[0,0,0];member.ball.moving=false;
  }
  room.snapshot(true);
  for(const page of [host,guest])await page.waitForFunction(({direction,pose})=>{
   const f=GolfCourse.inspect().frame,a=f?.wildlife[4],ball=f?.players.find(p=>p.id===f.local);
   if(!a||!ball||f.megForward[0]*direction[0]+f.megForward[2]*direction[1]<.99)return false;
   return pose==='lying'?f.megLie>.99:f.megLie===0;
  },{direction,pose});
 }
 assert.deepEqual(errors,[]);console.log('Meg: real collision capture, visible held ball, direct desktop click and mobile touch, outside-click rejection, independent owners, maximum speed, follow-up shots after settling on desktop/mobile and ball tracking in four directions while lying/idle passed.');
}catch(error){console.error(error);throw error;}finally{await browser?.close();app.close();}
