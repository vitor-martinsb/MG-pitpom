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
 const room=[...app.rooms.values()][0],owner=room.members.get(1);room.physicsSeed=6;room.configurePool(owner,'custom',[room.levels.indexOf('data/levels/level-3.level')]);room.configure(owner,1,'classic','simultaneous');
 await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Meg mobile'});
 await host.locator('#start').click();for(const page of [host,guest])await finishPresentation(page);
 await freezePhysics(room);await captureMeg(room,[...room.members.values()]);
 for(const page of [host,guest])await page.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f?.players.find(p=>p.id===f.local)?.captureKind===6&&f.wildlife[4].visible;});
 // Let the existing snapshot interpolation and camera settle before inspecting
 // the held illustration or calculating a direct tap on its visible body.
 for(const page of [host,guest])await page.waitForTimeout(500);
 fs.mkdirSync('../out/meg',{recursive:true});
 const actorVertices=await host.evaluate(()=>GolfCourse.inspect().frame.actorVertices);assert.ok(actorVertices>0&&actorVertices<49152,'Meg stays inside the existing actor buffer');
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
 assert.deepEqual(errors,[]);console.log('Meg: real collision capture, visible held ball, direct desktop click and mobile touch, outside-click rejection, independent owners, maximum speed, unchanged strokes and ball tracking in four directions while lying/idle passed.');
}catch(error){console.error(error);throw error;}finally{await browser?.close();app.close();}
