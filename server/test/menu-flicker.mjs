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
  assert.ok(bounds.length===2&&bounds.every(b=>b.units==='userSpaceOnUse'&&Number(b.w)>0&&Number(b.h)>0),'lighting buffers must have fixed scene-space bounds');
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
  assert.deepEqual(await page.locator('.living-menu-art filter').evaluateAll(filters=>filters.map(e=>({units:e.getAttribute('filterUnits'),x:e.getAttribute('x'),y:e.getAttribute('y'),w:e.getAttribute('width'),h:e.getAttribute('height')}))),bounds,'moving parts cannot resize the filter buffers');
  await page.evaluate(()=>{window.__liveClock=false;window.__menuClock=Date.parse('2026-10-24T22:00:00-03:00');});
  await page.waitForFunction(()=>document.getElementById('home').style.getPropertyValue('--menu-night')==='1');
  const started=await page.evaluate(()=>{
   window.__matrixChanges=0;window.__lightObserver=new MutationObserver(list=>window.__matrixChanges+=list.length);
   for(const e of document.querySelectorAll('.living-menu-art feColorMatrix'))window.__lightObserver.observe(e,{attributes:true,attributeFilter:['values']});return GolfHome.scene.lastClock;
  });
  await page.waitForFunction(start=>GolfHome.scene.lastClock>start+1700,started,{timeout:15000});
  assert.equal(await page.evaluate(()=>{window.__lightObserver.disconnect();return window.__matrixChanges;}),0,'unchanged lighting must not invalidate every animated SVG layer once per second');
  await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});await page.locator('#back-main').click();assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35);
  assert.deepEqual(errors,[]);await context.close();console.log(`${name}: 19:04 animated body visibility, stable filter surfaces, zero redundant night repaints and navigation passed.`);
 }
}finally{await browser?.close();app.close();}
