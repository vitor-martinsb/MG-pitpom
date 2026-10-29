import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
const app=createServer(),errors=[],tailsOnly=process.argv.includes('--tails-only');let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});fs.mkdirSync('../out/menu-motion',{recursive:true});
 for(const [name,width,height,reducedMotion]of [['desktop',1920,900,'no-preference'],['desktop-gentle',1920,900,'reduce'],['mobile',390,844,'no-preference']]){
  const page=await browser.newPage({viewport:{width,height},isMobile:name==='mobile',hasTouch:name==='mobile',reducedMotion});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-10-23T15:00:00-03:00']));}};});
  await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await page.locator('#continue-home').click();await page.locator('#main-menu').waitFor({state:'visible'});
  assert.equal(await page.locator('.home-kicker').count(),0);assert.equal(await page.locator('[data-pet=frida] [data-motion=tail]').count(),1);assert.equal(await page.locator('[data-pet=pituca] [data-motion=tail]').count(),0);
  assert.equal(await page.locator('.home-art').isVisible(),false,'static illustration cannot cover the animated scene');
  const initial=await page.locator('[data-motion=mill]').evaluate(e=>getComputedStyle(e).transform);if(!tailsOnly)await page.screenshot({path:`../out/menu-motion/${name}-before.png`});await page.waitForTimeout(2300);
  assert.notEqual(await page.locator('[data-motion=mill]').evaluate(e=>getComputedStyle(e).transform),initial,'mill must actually advance automatically, also on reduced-motion desktops');if(!tailsOnly)await page.screenshot({path:`../out/menu-motion/${name}-after.png`});
  assert.equal(await page.locator('#home').getAttribute('data-motion'),reducedMotion==='reduce'?'gentle':'full');
  const tailCoverage=await page.locator('[data-pet=frida]').evaluate(async e=>{
   const nodes=['body','tail'].map(part=>e.querySelector('[data-motion='+part+'] image'));
   const pixels=await Promise.all(nodes.map(async node=>{const i=new Image();i.src=node.href.baseVal;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}));
   let tail=0,duplicate=0;for(let k=3;k<pixels[1].length;k+=4)if(pixels[1][k]>240){tail++;if(pixels[0][k]>20)duplicate++;}
   return {tail,duplicate};
  });assert.ok(tailCoverage.tail>20);assert.equal(tailCoverage.duplicate,0,'the one tail cannot also remain in the body layer');
  const edges=await page.locator('[data-pet=romeu] [data-motion=body] image').evaluate(async e=>{
   const i=new Image();i.src=e.href.baseVal;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);
   const scale=i.naturalWidth/Number(e.getAttribute('width')),x=Number(e.getAttribute('x')),y=Number(e.getAttribute('y')),point=matchMedia('(orientation:portrait)').matches?[395,975]:[735,575],pixels=ctx.getImageData(0,0,c.width,c.height).data;let smooth=0;
   for(let k=3;k<pixels.length;k+=4)if(pixels[k]>0&&pixels[k]<255)smooth++;
   return {scale,smooth,scenery:ctx.getImageData(Math.floor((point[0]-x)*scale),Math.floor((point[1]-y)*scale),1,1).data[3]};
  });assert.equal(edges.scale,2);assert.ok(edges.smooth>100,'vector boundary has antialiased coverage');assert.equal(edges.scenery,0,'empty space beside the reference bandana is transparent');
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>{a.pause();a.effect.updateTiming({delay:0});a.currentTime=0;}));
  if(!tailsOnly){const still=await page.locator('.living-scene').screenshot();await page.waitForTimeout(80);assert.equal(Buffer.compare(still,await page.locator('.living-scene').screenshot()),0,'frozen scene is pixel-stable before testing each motion');}
  // Each real tail must visibly advance on its own, without seeking it to
  // a distant keyframe or borrowing movement from the rest of the animal.
  for(const tail of await page.locator('[data-motion=tail]').all()){
   const movement=await tail.evaluate(async node=>{
    const a=node.getAnimations()[0],canvas=document.querySelector('[data-pet-surface]'),ctx=canvas.getContext('2d');
    const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    a.currentTime=0;await settle();const before=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const angle=()=>{const m=new DOMMatrix(getComputedStyle(node).transform);return Math.atan2(m.b,m.a)*180/Math.PI;};
    const start=angle();a.play();await new Promise(r=>setTimeout(r,750));await settle();a.pause();
    const end=angle(),after=ctx.getImageData(0,0,canvas.width,canvas.height).data;let changed=0,visible=0,wasVisible=0;
    for(let i=0;i<after.length;i+=4){if(after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]||after[i+3]!==before[i+3])changed++;if(after[i+3])visible++;if(before[i+3])wasVisible++;}
    return {id:node.closest('[data-pet]').dataset.pet,changed,angle:Math.abs(end-start),visible,wasVisible};
   });
   assert.ok(movement.angle>(reducedMotion==='reduce'?.1:.4),`${name}: ${movement.id} tail must advance visibly in 750 ms: ${JSON.stringify(movement)}`);
   assert.ok(movement.changed>5,`${name}: ${movement.id} must change actual painted pixels`);
   assert.ok(movement.visible>movement.wasVisible*.97,`${name}: animals remain visible while tails move`);
  }
  // Opaque pixels at the cut/body socket must remain opaque through an entire
  // wag. Total visible area alone misses the rectangular wedges seen in-game.
  const joints=await page.evaluate(async()=>{
   const svg=document.querySelector('.living-menu-art'),canvas=document.querySelector('[data-pet-surface]'),ctx=canvas.getContext('2d'),region=JSON.parse(canvas.dataset.region);
   const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const tails=[...svg.querySelectorAll('[data-flex-bounds]')].map(node=>({node,a:node.getAnimations()[0],bounds:JSON.parse(node.dataset.flexBounds),points:[],minimum:1}));
   for(const t of tails)t.a.currentTime=Number(t.a.effect.getTiming().duration)*.25;
   await settle();
   const before=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const project=(t,x,y)=>{const m=svg.getCTM().inverse().multiply(t.node.parentNode.getCTM()),q=new DOMPoint(x,y).matrixTransform(m);return [Math.floor((q.x-region.x)/region.w*canvas.width),Math.floor((q.y-region.y)/region.h*canvas.height)];};
   for(const t of tails){const [x,y,w,h]=t.bounds;
    for(let iy=.5;iy<h;iy+=.5)for(let ix=.5;ix<w;ix+=.5){
     if(Math.min(ix,iy,w-ix,h-iy)>3)continue;
     const [px,py]=project(t,x+ix,y+iy);
     if([[-1,0],[0,0],[1,0],[0,-1],[0,1]].every(([dx,dy])=>before[((py+dy)*canvas.width+px+dx)*4+3]>250))t.points.push([px,py]);
    }
   }
   for(let phase=0;phase<=16;phase++){
    for(const t of tails)t.a.currentTime=Number(t.a.effect.getTiming().duration)*phase/16;
    await settle();const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    for(const t of tails)if(t.points.length)t.minimum=Math.min(t.minimum,t.points.filter(([x,y])=>pixels[(y*canvas.width+x)*4+3]>240).length/t.points.length);
   }
   return tails.map(t=>({id:t.node.closest('[data-pet]').dataset.pet,samples:t.points.length,minimum:t.minimum}));
  });
  assert.equal(joints.length,6,'all existing tail sockets are exercised');
  assert.ok(joints.reduce((n,joint)=>n+joint.samples,0)>40,'socket samples cover the actual opaque cut boundaries');
  for(const joint of joints)assert.ok(joint.minimum>.98,`${name}: ${joint.id} must not expose scenery at its cut boundary: ${JSON.stringify(joint)}`);
  await page.screenshot({path:`../out/menu-motion/${name}-joined.png`});
  // These comparisons inspect the browser's rendered PNG pixels, rather than
  // merely checking that a timer or a WAAPI animation object exists.
  // Blink timing is staggered by roster index. Seek the real closed-eye frame
  // rather than assuming Luna is the first entry in the cast.
  const blinkAt=await page.locator('[data-pet=luna] [data-motion=blink]').evaluate(e=>{
   const a=e.getAnimations({subtree:true})[0];return a.effect.getKeyframes().find(f=>Number(f.opacity)===1).offset;
  });assert.ok(blinkAt>0&&blinkAt<1);
  const cases=[['mill','[data-motion=mill]',.1],['cloud','[data-motion=cloud]',.02],['water','[data-motion=water]',.48],['flag','[data-motion=flag]',.48],['grass','[data-motion=grass]',.46],['wind','[data-motion=wind]',.43],['breathing','[data-pet=pituca]',.5],['head','[data-pet=pituca] [data-motion=head]',.73],['ear','[data-pet=pituca] [data-motion=ear]',.8],['tail','[data-pet=frida] [data-motion=tail]',.42],['blink','[data-pet=luna] [data-motion=blink]',blinkAt]];
  for(const [kind,selector,offset]of tailsOnly?[]:cases){
   const seek=fraction=>page.locator(selector).first().evaluate((e,f)=>{const a=e.getAnimations().length?e.getAnimations():e.getAnimations({subtree:true});for(const item of a){const timing=item.effect.getTiming();item.currentTime=Number(timing.duration)*f+Number(timing.delay);}},fraction);
   await seek(0);await page.waitForTimeout(35);const before=await page.locator('.living-scene').screenshot();await seek(offset);await page.waitForTimeout(35);const after=await page.locator('.living-scene').screenshot();
   if(name==='desktop'){fs.writeFileSync(`../out/menu-motion/${kind}-before.png`,before);fs.writeFileSync(`../out/menu-motion/${kind}-after.png`,after);}
   assert.notEqual(Buffer.compare(before,after),0,`${name}: ${kind} must change real rendered pixels: ${JSON.stringify(await page.locator(selector).first().evaluate(e=>({transform:getComputedStyle(e).transform,animations:e.getAnimations({subtree:true}).map(a=>({time:a.currentTime,frames:a.effect.getKeyframes(),timing:a.effect.getTiming()}))})))}`);
  }
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>a.play()));
  await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});assert.ok(await page.evaluate(()=>GolfHome.scene.running)>45,'multiplayer entry keeps the original living menu');await page.locator('#back-main').click();assert.ok(await page.evaluate(()=>GolfHome.scene.running)>45);
  await page.locator('#exit-game').click();await page.locator('#continue-home').waitFor({state:'visible'});await page.locator('#continue-home').click();await page.locator('#offline').click();await page.locator('#level-selection').waitFor({state:'visible'});await page.close();
  console.log(`${name}: ${tailsOnly?'six independently moving tails and their painted pixels':'automatic motion and rendered pixel changes for mill, cloud, water, wind, breathing, head, ear, tail and blink'} passed; no duplicate Frida tail or tagline; menu controls passed.`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();app.close();}
