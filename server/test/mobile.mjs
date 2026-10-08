import { chromium } from '@playwright/test';
import { createServer } from '../dist/index.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=createServer();
let browser;
const diagnostics=page=>page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])));
try {
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(url);
  await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  await page.locator('#nickname').tap();
  await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('MobileHost');
  assert.equal(await page.locator('#nickname').inputValue(),'MobileHost');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#create').tap();await page.locator('#lobby').waitFor({state:'visible'});
  const room=[...app.rooms.values()][0];
  assert.equal(room.members.get(1).nickname,'MobileHost');
  // A second mobile browser joins using an actual room-code input.
  const guestContext=await browser.newContext({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
  const guest=await guestContext.newPage();await guest.goto(url);
  await guest.waitForFunction(()=>!document.getElementById('join').disabled,{},{timeout:90000});
  await guest.locator('#join-code').tap();await guest.keyboard.type(room.code);
  await guest.locator('#join').tap();await guest.locator('#lobby').waitFor({state:'visible'});
  await page.locator('#start').tap();
  await page.waitForFunction(()=>document.getElementById('status').textContent==='Tacadas simultâneas',{},{timeout:30000});
  await guest.waitForFunction(()=>document.getElementById('status').textContent==='Tacadas simultâneas',{},{timeout:30000});
  assert.match(await page.locator('#help').textContent(),/Toque na bola/);
  const cdp=await context.newCDPSession(page);
  const touch=async(type,points=[])=>{
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5}))});
    await page.waitForTimeout(100);
  };
  let [x,y]=(await diagnostics(page)).screen;
  // Expanded finger hit target, followed by cancellation: zero shots.
  await touch('touchStart',[[1,x+20,y]]);assert.equal((await diagnostics(page)).state,3);
  await touch('touchMove',[[1,x,y+100]]);await touch('touchCancel');
  assert.equal(room.members.get(1).ball.strokes,0);assert.equal((await diagnostics(page)).state,2);
  // Lifting a second finger must not release the primary aiming finger.
  await touch('touchStart',[[1,x,y]]);
  await touch('touchMove',[[1,x,y+100]]);
  await touch('touchStart',[[1,x,y+100],[2,x+70,y]]);
  await touch('touchEnd',[[2,x+70,y]]);
  assert.equal(room.members.get(1).ball.strokes,0);assert.equal((await diagnostics(page)).state,3);
  await touch('touchEnd');
  await page.waitForTimeout(400);
  assert.equal(room.members.get(1).ball.strokes,1);assert.equal(room.members.get(2).ball.strokes,0);
  assert.equal((await diagnostics(page)).touch,true);
  const angle=(await diagnostics(page)).cameraAngle;
  await touch('touchStart',[[1,300,430]]);await touch('touchMove',[[1,340,430]]);await touch('touchEnd');
  assert.notEqual((await diagnostics(page)).cameraAngle,angle);
  await page.locator('#show-scores').tap();await page.locator('#scores').waitFor({state:'visible'});
  assert.equal(await page.locator('#score-body tr').count(),2);
  await page.locator('#close-scores').tap();await page.locator('#scores').waitFor({state:'hidden'});
  fs.mkdirSync('../out/mobile-validation',{recursive:true});
  await page.screenshot({path:'../out/mobile-validation/portrait.png'});
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);
  const hud=await page.locator('#hud').boundingBox(),actions=await page.locator('#actions').boundingBox();
  assert.ok(hud.x+hud.width<=actions.x);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#show-scores').tap();await page.locator('#close-scores').tap();
  await page.screenshot({path:'../out/mobile-validation/landscape.png'});
  await page.locator('#leave').tap();await page.locator('#connect').waitFor({state:'visible'});
  await page.locator('#offline').tap();
  await page.waitForTimeout(500);
  assert.equal((await diagnostics(page)).active,false);
  assert.deepEqual(errors,[]);
  console.log('Mobile browsers: nickname, join, expanded touch target, cancel, two fingers, release-to-shoot, camera, scoreboard, portrait/landscape and offline return passed.');
} finally {
  await browser?.close();app.close();
}
