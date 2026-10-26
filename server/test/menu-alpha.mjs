import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
const app=createServer();let browser;
try {
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
 fs.mkdirSync('../out/menu-alpha',{recursive:true});
 for(const [name,width,height,mobile]of [['desktop',1672,941,false],['mobile',390,844,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const D=Date;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:['2026-10-24T15:00:00-03:00']));}};});
  await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});
  assert.equal(await page.locator('[data-pet]').count(),7,'six pets including vector Juju and the existing bird');
  for(const pet of ['luna','romeu','frida','pituca','pompom']){
   const file=`menu-pet-${pet}.png`;assert.equal(await page.locator(`[data-pet=${pet}]`).getAttribute('data-source-art'),file);
   const local=fs.readFileSync('../build/emscripten/art/'+file),served=Buffer.from(await (await fetch(url+'/art/'+file)).arrayBuffer());
   assert.equal(createHash('sha256').update(served).digest('hex'),createHash('sha256').update(local).digest('hex'));
  }
  assert.equal(await page.locator('[data-pet=juju]').getAttribute('data-source-art'),'menu-pet-juju.svg');
  assert.equal(await page.locator('#meet-juju').count(),0);
  const foliage=await page.locator('[data-motion=wind] image').first().evaluate(async e=>{
   const image=new Image();image.src=e.href.baseVal;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
   const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let sky=0,visible=0,transparent=0;
   for(let i=0;i<p.length;i+=4){if(!p[i+3]){transparent++;continue;}visible++;if(p[i+3]>32&&(p[i+2]>=p[i+1]-20||p[i]>=p[i+1]))sky++;}
   return {sky,visible,transparent,mask:e.closest('[data-motion=wind]').getAttribute('mask')};
  });
  assert.equal(foliage.sky,0,'opaque cyan sky pixels cannot enter animated foliage');
  assert.ok(foliage.visible>10000&&foliage.transparent>10000,'real leaves and real transparency');assert.match(foliage.mask,/url\(#menu-foliage-/);
  for(const cloud of await page.locator('[data-motion=cloud] image').all()){
   const edge=await cloud.evaluate(async e=>{
    const i=new Image();i.src=e.href.baseVal;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let cut=0;
    for(let x=0;x<c.width;x++)cut+=p[x*4+3]+p[((c.height-1)*c.width+x)*4+3];
    for(let y=0;y<c.height;y++)cut+=p[y*c.width*4+3]+p[(y*c.width+c.width-1)*4+3];return cut;
   });assert.equal(edge,0,'moving clouds must have complete silhouettes with transparent margins');
  }
  assert.equal(await page.locator('[data-pet=frida] [data-motion=blink] ellipse').count(),0,'retain the reference cat’s closed eyes');
  assert.equal(await page.locator('[data-pet=pituca] [data-motion=tail]').count(),0);assert.equal(await page.locator('[data-pet=frida] [data-motion=tail]').count(),1);
  if(mobile)await page.locator('#continue-home').tap();else await page.locator('#continue-home').click();
  await page.locator('#main-menu').waitFor({state:'visible'});
  // The welcome button deliberately pulses outside the scene. Inspect the menu
  // so that pulse cannot be mistaken for a trail in the SVG screenshot.
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>{a.pause();a.effect.updateTiming({delay:0});a.currentTime=0;}));
  const scene=page.locator('.living-scene'),still=await scene.screenshot();await page.waitForTimeout(100);
  assert.equal(Buffer.compare(still,await scene.screenshot()),0,'frozen frames must not accumulate trails');
  const frames=[];
  for(const fraction of [0,.43,.8]){
   await page.evaluate(f=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>{a.currentTime=Number(a.effect.getTiming().duration)*f;}),fraction);
   const frame=await scene.screenshot();frames.push(frame);fs.writeFileSync(`../out/menu-alpha/${name}-${fraction}.png`,frame);
  }
  assert.notEqual(Buffer.compare(frames[0],frames[1]),0,'retain visible motion');
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>a.play()));
  await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>GolfHome.scene.running),0);
  await page.locator('#back-main').click();assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35);
  assert.deepEqual(errors,[]);await context.close();console.log(`${name}: reference RGBA pets, sky-free tree alpha, stable compositing, moving frames and navigation passed.`);
 }
}finally{await browser?.close();app.close();}
