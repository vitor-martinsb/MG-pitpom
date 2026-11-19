import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {createLobby,visitMultiplayer,joinLobby,finishPresentation} from './navigation-fixture.mjs';
import {freezePhysics} from './room-fixture.mjs';
import {captureMeg} from './meg-fixture.mjs';
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
 const actorVertices=await host.evaluate(()=>GolfCourse.inspect().frame.actorVertices);assert.ok(actorVertices>0&&actorVertices<40960,'Meg stays inside the existing actor buffer');
 assert.equal(await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),false);
 await host.screenshot({path:'../out/meg/desktop-holding.png'});await guest.screenshot({path:'../out/meg/mobile-holding.png'});
 const angle=await host.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraAngle);
 await host.mouse.move(1050,430);await host.mouse.down();await host.mouse.move(1190,470,{steps:12});await host.mouse.up();
 await host.waitForFunction(angle=>Math.abs(JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraAngle-angle)>.1,angle);
 await host.waitForTimeout(300);await host.screenshot({path:'../out/meg/desktop-3d-profile.png'});
 const screen=await host.evaluate(()=>GolfCourse.inspect().frame.megScreen);
 await host.locator('#canvas').focus();await host.mouse.click(screen[0]>640?120:1160,400);await host.waitForTimeout(200);
 assert.equal(owner.ball.captureKind,6,'clicking outside Meg cannot release the ball');
 await host.mouse.click(...screen);
 await host.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f.players.find(p=>p.id===f.local).captureKind===0;});
 assert.equal(owner.ball.strokes,1);assert.ok(Math.abs(Math.hypot(...owner.ball.vel)-20)<.0001);assert.equal(room.members.get(2).ball.captureKind,6,'desktop tap never releases the mobile player');
 await guest.waitForFunction(()=>GolfCourse.inspect().frame.players.find(p=>p.id===1).captureKind===0);
 await guest.locator('#canvas').focus();await guest.touchscreen.tap(...await guest.evaluate(()=>GolfCourse.inspect().frame.megScreen));
 await guest.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f.players.find(p=>p.id===f.local).captureKind===0;});
 assert.equal(room.members.get(2).ball.strokes,1);assert.equal(owner.ball.strokes,1);
 assert.ok(Math.abs(Math.hypot(...room.members.get(2).ball.vel)-20)<.0001);
 await guest.screenshot({path:'../out/meg/mobile-release.png'});
 assert.deepEqual(errors,[]);console.log('Meg: real collision capture, visible held ball, direct desktop click and mobile touch, outside-click rejection, independent owners, maximum speed and unchanged strokes passed.');
}catch(error){console.error(error);throw error;}finally{await browser?.close();app.close();}
