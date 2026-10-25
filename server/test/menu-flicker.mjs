import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
const app=createServer();let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
 fs.mkdirSync('../out/menu-flicker',{recursive:true});
 for(const [name,width,height,mobile]of [['desktop',1280,800,false],['mobile',390,844,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const D=Date,start=performance.now();window.__menuClock=D.parse('2026-10-24T19:04:00-03:00');window.__liveClock=true;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:[window.__menuClock+(window.__liveClock?performance.now()-start:0)]));}};});
  await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await page.locator('#continue-home').click();
  const bounds=await page.locator('.living-menu-art filter').evaluateAll(filters=>filters.map(e=>({units:e.getAttribute('filterUnits'),x:e.getAttribute('x'),y:e.getAttribute('y'),w:e.getAttribute('width'),h:e.getAttribute('height')})));
  assert.ok(bounds.length===1&&bounds.every(b=>b.units==='userSpaceOnUse'&&Number(b.w)>0&&Number(b.h)>0),'lighting buffers must have fixed scene-space bounds');
  const samples=await page.locator('[data-pet=luna] [data-motion=body] image').evaluate(async e=>{
   const i=new Image();i.src=e.href.baseVal;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data,points=[];
   for(let y=3;y<c.height-3;y+=3)for(let x=3;x<c.width-3;x+=3){
    const k=(y*c.width+x)*4;
    if(p[k+3]<248||p[k]<100||p[k]<p[k+1]*1.5)continue;
    if([[x-2,y],[x+2,y],[x,y-2],[x,y+2]].some(([a,b])=>p[(b*c.width+a)*4+3]<248))continue;
    points.push({x:Number(e.getAttribute('x'))+x/c.width*Number(e.getAttribute('width')),y:Number(e.getAttribute('y'))+y/c.height*Number(e.getAttribute('height'))});
   }
   return points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/96))===0).slice(0,96);
  });
  assert.ok(samples.length>24,'sample the actual opaque tan chest and legs, not the head or background');
  let previousTime=await page.locator('[data-motion=mill]').evaluate(e=>e.getAnimations()[0].currentTime);
  for(let frame=0;frame<12;frame++){
   const projected=await page.locator('[data-pet=luna] [data-motion=body] image').evaluate((e,points)=>{const m=e.getScreenCTM();return points.map(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(m);return {x:q.x,y:q.y};});},samples);
   const png=await page.screenshot({scale:'css'});
   const visible=await page.evaluate(async({bytes,points})=>{
    const i=new Image();i.src='data:image/png;base64,'+bytes;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);let count=0;
    for(const q of points){const [r,g]=ctx.getImageData(Math.round(q.x),Math.round(q.y),1,1).data;if(r>30&&r>g*1.15)count++;}return count/points.length;
   },{bytes:png.toString('base64'),points:projected});
   fs.writeFileSync(`../out/menu-flicker/${name}-${frame}.png`,png);
   assert.ok(visible>.65,`${name} frame ${frame}: the puppy chest/legs must not disappear (${visible})`);
   const time=await page.locator('[data-motion=mill]').evaluate(e=>e.getAnimations()[0].currentTime);assert.ok(time>previousTime,'keep animation running while checking visible frames');previousTime=time;
   await page.waitForTimeout(180);
  }
  const observation=page.evaluate(async()=>{
   const svg=document.querySelector('.living-menu-art'),surface=document.querySelector('canvas[data-pet-surface]');
   if(!surface||surface.closest('svg'))throw new Error('Pets must paint together on a separate HTML canvas, outside SVG compositing');
   if(svg.querySelector('[data-pet-rig]').getAttribute('visibility')!=='hidden')throw new Error('Articulated SVG rig must not paint GPU layers');
   const bodies=[];
   for(const node of svg.querySelectorAll('[data-pet] [data-motion=body] image')){
    const image=new Image();image.src=node.href.baseVal;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
    const context=c.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,c.width,c.height).data,points=[];
    for(let y=4;y<c.height-4;y+=4)for(let x=4;x<c.width-4;x+=4){
     const k=(y*c.width+x)*4;if(pixels[k+3]<250)continue;
     if([[x-3,y],[x+3,y],[x,y-3],[x,y+3]].some(([a,b])=>{const n=(b*c.width+a)*4;return pixels[n+3]<250||[0,1,2].some(i=>Math.abs(pixels[n+i]-pixels[k+i])>15);}))continue;
     points.push({x:Number(node.getAttribute('x'))+(x+.5)/c.width*Number(node.getAttribute('width')),y:Number(node.getAttribute('y'))+(y+.5)/c.height*Number(node.getAttribute('height')),rgb:Array.from(pixels.slice(k,k+3))});
    }
    bodies.push({node,id:node.closest('[data-pet]').dataset.pet,points:points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/32))===0).slice(0,32),minimum:1});
   }
   if(bodies.length!==6||bodies.some(b=>b.points.length<5))throw new Error('Need opaque interior samples from every actual animal body');
   window.__petSamples=bodies;
   const start=performance.now();let checks=0,previousFrames=-1;
   while(performance.now()-start<40000){
    await new Promise(r=>requestAnimationFrame(r));
    const count=GolfHome.scene.petFrames;if(count<=previousFrames)throw new Error('The painted pet animation stopped');previousFrames=count;
    const ctx=surface.getContext('2d'),pixels=ctx.getImageData(0,0,surface.width,surface.height).data,inverse=svg.getCTM().inverse(),region=JSON.parse(surface.dataset.region);
    const values=svg._characterLight,factors=values.slice(0,3),blue=values[3]*255;
    for(const body of bodies){
     const matrix=inverse.multiply(body.node.getCTM());let visible=0;
     for(const point of body.points){const q=new DOMPoint(point.x,point.y).matrixTransform(matrix),x=Math.floor((q.x-region.x)/region.w*surface.width),y=Math.floor((q.y-region.y)/region.h*surface.height),k=(y*surface.width+x)*4;
      if(pixels[k+3]>240&&point.rgb.every((v,i)=>Math.abs(pixels[k+i]-(v*factors[i]+(i===2?blue:0)))<48))visible++;
     }
     const ratio=visible/body.points.length;body.minimum=Math.min(body.minimum,ratio);
     if(ratio<.70)throw new Error(body.id+' body disappeared/distorted during a full motion cycle: '+ratio);
    }
    checks++;await new Promise(r=>setTimeout(r,350));
   }
   return {checks,bodies:bodies.map(({id,minimum})=>({id,minimum}))};
  });
  const capture=(async()=>{
   await page.waitForFunction(()=>window.__petSamples?.length===6);
   for(let frame=0;frame<8;frame++){
    await page.waitForTimeout(4500);
    const samples=await page.evaluate(()=>{const v=document.querySelector('.living-menu-art')._characterLight;return window.__petSamples.map(body=>{const m=body.node.getScreenCTM();return {id:body.id,points:body.points.map(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(m);return {x:q.x,y:q.y,rgb:p.rgb.map((c,i)=>c*v[i]+(i===2?v[3]*255:0))};})};});});
    const png=await page.screenshot({scale:'css'});fs.writeFileSync(`../out/menu-flicker/${name}-cycle-${frame}.png`,png);
    const ratios=await page.evaluate(async({bytes,samples})=>{const image=new Image();image.src='data:image/png;base64,'+bytes;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;return samples.map(body=>({id:body.id,visible:body.points.filter(p=>{const k=(Math.round(p.y)*c.width+Math.round(p.x))*4;return p.rgb.every((color,i)=>Math.abs(color-pixels[k+i])<55);}).length/body.points.length}));},{bytes:png.toString('base64'),samples});
    for(const body of ratios)assert.ok(body.visible>=.70,`${name} composited frame ${frame}: ${body.id} must remain visibly complete (${body.visible})`);
   }
  })();
  const [coverage]=await Promise.all([observation,capture]);
  assert.ok(coverage.checks>40,'observe complete blink, head and ear cycles, not just the first seconds');
  console.log(name+': full-cycle visible body pixels '+JSON.stringify(coverage));
  assert.deepEqual(await page.locator('.living-menu-art filter').evaluateAll(filters=>filters.map(e=>({units:e.getAttribute('filterUnits'),x:e.getAttribute('x'),y:e.getAttribute('y'),w:e.getAttribute('width'),h:e.getAttribute('height')}))),bounds,'moving parts cannot resize the filter buffers');
  await page.evaluate(()=>{window.__liveClock=false;window.__menuClock=Date.parse('2026-10-24T22:00:00-03:00');});
  await page.waitForFunction(()=>document.getElementById('home').style.getPropertyValue('--menu-night')==='1');
  const started=await page.evaluate(()=>{
   window.__petLayoutWrites=0;window.__petLayoutObserver=new MutationObserver(list=>window.__petLayoutWrites+=list.length);window.__petLayoutObserver.observe(document.querySelector('canvas[data-pet-surface]'),{attributes:true,attributeFilter:['style']});
   window.__matrixChanges=0;window.__lightObserver=new MutationObserver(list=>window.__matrixChanges+=list.length);
   for(const e of document.querySelectorAll('.living-menu-art feColorMatrix'))window.__lightObserver.observe(e,{attributes:true,attributeFilter:['values']});return GolfHome.scene.lastClock;
  });
  await page.waitForFunction(start=>GolfHome.scene.lastClock>start+1700,started,{timeout:15000});
  assert.equal(await page.evaluate(()=>{window.__lightObserver.disconnect();return window.__matrixChanges;}),0,'unchanged lighting must not invalidate every animated SVG layer once per second');
  assert.equal(await page.evaluate(()=>{window.__petLayoutObserver.disconnect();return window.__petLayoutWrites;}),0,'a stable viewport cannot rewrite character placement every frame');
  await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});
  const paused=await page.evaluate(()=>GolfHome.scene.petFrames);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>GolfHome.scene.petFrames),paused,'stop painting when menu is hidden');
  await page.locator('#back-main').click();await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>GolfHome.scene.petFrames)>paused,'resume painted animal motion after navigation');assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35);
  if(mobile){for(const viewport of [{width:844,height:390},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForFunction(layout=>GolfHome.scene.layout===layout&&GolfHome.scene.petFrames>3,viewport.width>viewport.height?'landscape':'portrait');assert.equal(await page.locator('canvas[data-pet-surface]').count(),1);const alpha=await page.locator('canvas[data-pet-surface]').evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let opaque=0;for(let k=3;k<pixels.length;k+=4)if(pixels[k]>240)opaque++;return opaque;});assert.ok(alpha>10000,'animals remain painted after rotating the phone');}}

  await page.locator('#exit-game').click();await page.locator('#continue-home').waitFor({state:'visible'});
  assert.equal(await page.locator('.home-brand,#continue-home').evaluateAll(nodes=>nodes.reduce((n,e)=>n+e.getAnimations({subtree:true}).length,0)),0,'title and welcome control must not pulse');
  const boxes=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};return {title:box(document.querySelector('.home-brand h1')),button:box(document.getElementById('continue-home')),ink:getComputedStyle(document.querySelector('.home-brand h1')).color.match(/\d+/g).slice(0,3).map(Number),frames:GolfHome.scene.petFrames};});
  const still=(await page.screenshot({scale:'css'})).toString('base64');
  const welcomeSamples=await page.evaluate(async({bytes,boxes})=>{const i=new Image();i.src='data:image/png;base64,'+bytes;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data,read=(x,y)=>Array.from(p.slice((y*c.width+x)*4,(y*c.width+x)*4+3)),title=[],button=[];
   for(let y=Math.ceil(boxes.title.y);y<boxes.title.y+boxes.title.h;y++)for(let x=Math.ceil(boxes.title.x);x<boxes.title.x+boxes.title.w;x++){const rgb=read(x,y);if(rgb.every((v,k)=>Math.abs(v-boxes.ink[k])<2))title.push({x,y,rgb});}
   for(let y=Math.ceil(boxes.button.y+12);y<boxes.button.y+boxes.button.h-12;y+=2)for(let x=Math.ceil(boxes.button.x+24);x<boxes.button.x+boxes.button.w-24;x+=2)button.push({x,y,rgb:read(x,y)});
   return {title:title.filter((_,i)=>i%Math.max(1,Math.floor(title.length/256))===0).slice(0,256),button};
  },{bytes:still,boxes});
  assert.ok(welcomeSamples.title.length>30&&welcomeSamples.button.length>100,'sample visible glyph interiors and the real welcome control');
  for(let frame=0;frame<8;frame++){
   await page.waitForTimeout(450);const png=await page.screenshot({scale:'css'});fs.writeFileSync(`../out/menu-flicker/${name}-welcome-${frame}.png`,png);
   const stable=await page.evaluate(async({bytes,samples})=>{const i=new Image();i.src='data:image/png;base64,'+bytes;await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;return Object.fromEntries(Object.entries(samples).map(([name,points])=>[name,points.filter(q=>{const k=(q.y*c.width+q.x)*4;return q.rgb.every((v,i)=>Math.abs(v-p[k+i])<=5);}).length/points.length]));},{bytes:png.toString('base64'),samples:welcomeSamples});
   assert.ok(stable.title>.98&&stable.button>.98,`${name}: stable foreground over the moving scenery ${JSON.stringify(stable)}`);
  }
  assert.ok(await page.evaluate(()=>GolfHome.scene.petFrames)>boxes.frames,'static labels cannot stop animal animation');
  await page.locator('#continue-home').click();await page.locator('#main-menu').waitFor({state:'visible'});
  console.log(name+': title glyphs and welcome control stay visible and stable while scenery/animals animate.');
  assert.deepEqual(errors,[]);await context.close();console.log(`${name}: 19:04 animated body visibility, stable filter surfaces, zero redundant night repaints and navigation passed.`);
 }
}finally{await browser?.close();app.close();}
