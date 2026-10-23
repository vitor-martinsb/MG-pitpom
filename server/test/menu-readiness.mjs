import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
const app=createServer();let browser;
try {
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let releaseArt;const gate=new Promise(resolve=>releaseArt=resolve);
 await page.route('**/art/menu-garden*.png',async route=>{await gate;await route.continue();});
 await page.addInitScript(()=>{
  window.partialMenus=[];
  function sample(){
   const buttons=[...document.querySelectorAll('#main-menu button')];
   const visible=buttons.filter(b=>b.getClientRects().length);
   if(visible.length&& (visible.length!==3||visible.some(b=>b.disabled)))window.partialMenus.push(visible.length);
   requestAnimationFrame(sample);
  }requestAnimationFrame(sample);
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});
 assert.equal(await page.locator('#home-loading').isVisible(),true);
 assert.equal(await page.locator('#home').isHidden(),true);
 await page.keyboard.press('Enter');assert.equal(await page.locator('#main-menu').isHidden(),true);
 releaseArt();await page.locator('#continue-home').click({timeout:90000});
 await page.locator('#main-menu').waitFor({state:'visible'});
 for(const name of ['menu-garden.png','menu-garden-portrait.png']){
  const original=fs.readFileSync('../build/emscripten/art/'+name);
  const served=Buffer.from(await (await fetch(url+'/art/'+name)).arrayBuffer());
  assert.equal(createHash('sha256').update(served).digest('hex'),createHash('sha256').update(original).digest('hex'));
 }
 fs.mkdirSync('../out/menu-readiness',{recursive:true});
 for(const [width,height]of [[1280,800],[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  await page.waitForFunction(portrait=>{const img=document.querySelector('.home-art');return img.complete&&img.currentSrc.endsWith(portrait?'menu-garden-portrait.png':'menu-garden.png');},height>width);
  assert.equal(await page.locator('.home-art').evaluate(e=>getComputedStyle(e).objectFit),'cover');
  const bounds=await page.locator('.living-menu-art').boundingBox();
  assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.width,width);assert.equal(bounds.height,height);
  assert.equal(await page.locator('#continue-home').isHidden(),true);
  for(const button of await page.locator('#main-menu button').all()){
   assert.equal(await button.isEnabled(),true);const r=await button.boundingBox();
   assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);
  }
  await page.screenshot({path:`../out/menu-readiness/menu-${width}x${height}.png`});
  await page.locator('#exit-game').click();
  assert.equal(await page.locator('#continue-home').isVisible(),true);
  assert.equal(await page.locator('#main-menu').isHidden(),true);
  const button=await page.locator('#continue-home').boundingBox();
  assert.ok(button.x>=0&&button.y>=0&&button.x+button.width<=width&&button.y+button.height<=height);
  await page.screenshot({path:`../out/menu-readiness/welcome-${width}x${height}.png`});
  await page.locator('#continue-home').click();
 }
 await page.locator('#offline').click();await page.locator('#level-selection').waitFor({state:'visible'});
 const scene=()=>page.locator('.campaign-world .map-decoration').evaluateAll(nodes=>nodes.map(e=>({matrix:[e.getCTM().a,e.getCTM().b,e.getCTM().c,e.getCTM().d,e.getCTM().e,e.getCTM().f],animation:getComputedStyle(e).animationName})));
 const before=await scene();assert.ok(before.length>=50);assert.ok(before.every(e=>e.animation==='none'));
 await page.waitForTimeout(600);assert.deepEqual(await scene(),before);
 assert.equal(await page.locator('.map-mill').first().evaluate(e=>getComputedStyle(e).animationName),'mill-turn');
 assert.equal(await page.locator('.map-current').first().evaluate(e=>getComputedStyle(e).animationName),'stream-flow');
 await page.locator('#close-level-selection').click();await page.locator('#open-multiplayer').click();
 assert.equal(await page.locator('#connect img,#connect .garden-header').count(),0);
 await page.locator('#back-main').click();await page.locator('#exit-game').click();
 assert.equal(await page.locator('#continue-home').isVisible(),true);
 assert.deepEqual(await page.evaluate(()=>window.partialMenus),[]);assert.deepEqual(errors,[]);
 console.log('Menu readiness: delayed artwork gate, simultaneous enabled buttons, clean responsive artwork, full viewport in three resolutions, separate welcome button, static campaign decorations, moving mill/water and multiplayer/back/exit passed.');
} finally {await browser?.close();app.close();}
