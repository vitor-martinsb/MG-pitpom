import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
const app=createServer(),errors=[];let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});fs.mkdirSync('../out/menu-motion',{recursive:true});
 for(const [name,width,height,reducedMotion]of [['desktop',1920,900,'no-preference'],['desktop-gentle',1920,900,'reduce'],['mobile',390,844,'no-preference']]){
  const page=await browser.newPage({viewport:{width,height},isMobile:name==='mobile',hasTouch:name==='mobile',reducedMotion});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-10-23T15:00:00-03:00']));}};});
  await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await page.locator('#continue-home').click();await page.locator('#main-menu').waitFor({state:'visible'});
  assert.equal(await page.locator('.home-kicker').count(),0);assert.equal(await page.locator('[data-pet=frida] [data-motion=tail]').count(),1);assert.equal(await page.locator('[data-pet=pituca] [data-motion=tail]').count(),0);
  assert.equal(await page.locator('.home-art').isVisible(),false,'static illustration cannot cover the animated scene');
  const initial=await page.locator('[data-motion=mill]').evaluate(e=>getComputedStyle(e).transform);await page.screenshot({path:`../out/menu-motion/${name}-before.png`});await page.waitForTimeout(2300);
  assert.notEqual(await page.locator('[data-motion=mill]').evaluate(e=>getComputedStyle(e).transform),initial,'mill must actually advance automatically, also on reduced-motion desktops');await page.screenshot({path:`../out/menu-motion/${name}-after.png`});
  assert.equal(await page.locator('#home').getAttribute('data-motion'),reducedMotion==='reduce'?'gentle':'full');
  const alpha=await page.locator('[data-pet=frida] [data-motion=body] image').evaluate(async e=>{const i=new Image();i.src=e.href.baseVal;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const [x,y]=[Number(e.getAttribute('x')),Number(e.getAttribute('y'))],portrait=matchMedia('(orientation:portrait)').matches,points=portrait?[[679,1002],[570,1010]]:[[1060,600],[934,617]];const scale=i.naturalWidth/Number(e.getAttribute('width'));return points.map(([a,b])=>ctx.getImageData(Math.floor((a-x)*scale),Math.floor((b-y)*scale),1,1).data[3]);});assert.deepEqual(alpha,[0,0],'no static right tail or second left appendage in Frida body sprite');
  const edges=await page.locator('[data-pet=romeu] [data-motion=body] image').evaluate(async e=>{
   const i=new Image();i.src=e.href.baseVal;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);
   const scale=i.naturalWidth/Number(e.getAttribute('width')),x=Number(e.getAttribute('x')),y=Number(e.getAttribute('y')),point=matchMedia('(orientation:portrait)').matches?[420,972]:[768,577],pixels=ctx.getImageData(0,0,c.width,c.height).data;let smooth=0;
   for(let k=3;k<pixels.length;k+=4)if(pixels[k]>0&&pixels[k]<255)smooth++;
   return {scale,smooth,scenery:ctx.getImageData(Math.floor((point[0]-x)*scale),Math.floor((point[1]-y)*scale),1,1).data[3]};
  });assert.equal(edges.scale,2);assert.ok(edges.smooth>100,'vector boundary has antialiased coverage');assert.equal(edges.scenery,0,'path fragment between Romeu ear and shoulder is transparent');
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>{a.pause();a.effect.updateTiming({delay:0});a.currentTime=0;}));
  const still=await page.locator('.living-menu-art').screenshot();await page.waitForTimeout(80);assert.equal(Buffer.compare(still,await page.locator('.living-menu-art').screenshot()),0,'frozen scene is pixel-stable before testing each motion');
  // These comparisons inspect the browser's rendered PNG pixels, rather than
  // merely checking that a timer or a WAAPI animation object exists.
  const cases=[['mill','[data-motion=mill]',.1],['cloud','[data-motion=cloud]',.02],['water','[data-motion=water]',.48],['wind','[data-motion=wind]',.43],['breathing','[data-pet=pituca]',.5],['head','[data-pet=pituca] [data-motion=head]',.73],['ear','[data-pet=pituca] [data-motion=ear]',.8],['tail','[data-pet=frida] [data-motion=tail]',.42],['blink','[data-pet=luna] [data-motion=blink]',.1535]];
  for(const [kind,selector,offset]of cases){
   const seek=fraction=>page.locator(selector).first().evaluate((e,f)=>{const a=e.getAnimations().length?e.getAnimations():e.getAnimations({subtree:true});for(const item of a){const timing=item.effect.getTiming();item.currentTime=Number(timing.duration)*f+Number(timing.delay);}},fraction);
   await seek(0);await page.waitForTimeout(35);const before=await page.locator('.living-menu-art').screenshot();await seek(offset);await page.waitForTimeout(35);const after=await page.locator('.living-menu-art').screenshot();
   if(name==='desktop'){fs.writeFileSync(`../out/menu-motion/${kind}-before.png`,before);fs.writeFileSync(`../out/menu-motion/${kind}-after.png`,after);}
   assert.notEqual(Buffer.compare(before,after),0,`${name}: ${kind} must change real rendered pixels: ${JSON.stringify(await page.locator(selector).first().evaluate(e=>({transform:getComputedStyle(e).transform,animations:e.getAnimations({subtree:true}).map(a=>({time:a.currentTime,frames:a.effect.getKeyframes(),timing:a.effect.getTiming()}))})))}`);
  }
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>a.play()));
  await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>GolfHome.scene.running),0);await page.locator('#back-main').click();assert.ok(await page.evaluate(()=>GolfHome.scene.running)>45);
  await page.locator('#exit-game').click();await page.locator('#continue-home').waitFor({state:'visible'});await page.locator('#continue-home').click();await page.locator('#offline').click();await page.locator('#level-selection').waitFor({state:'visible'});await page.close();
  console.log(`${name}: automatic motion and rendered pixel changes for mill, cloud, water, wind, breathing, head, ear, tail and blink passed; no duplicate Frida tail or tagline; menu controls passed.`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();app.close();}
