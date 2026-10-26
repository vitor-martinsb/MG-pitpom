import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
const app=createServer(),errors=[];let browser;
try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  fs.mkdirSync('../out/living-menu',{recursive:true});
  for(const [width,height,zone,mobile]of [[1280,800,'Pacific/Auckland',false],[390,844,'America/Los_Angeles',true]]){
    const context=await browser.newContext({viewport:{width,height},timezoneId:zone,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{const Original=Date;window.__menuTime=Original.parse('2026-10-23T09:00:00-03:00');globalThis.Date=class extends Original{constructor(...args){super(...(args.length?args:[window.__menuTime]));}};});
    await page.goto(url);await page.waitForFunction(()=>document.getElementById('home').dataset.sceneReady==='true',null,{timeout:90000});
    await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});
    const kind=mobile?'mobile':'desktop';
    for(const [hour,period]of [[9,'morning'],[15,'afternoon'],[18.5,'sunset'],[22,'night']]){
      await page.evaluate(hour=>{window.__menuTime=Date.parse(`2026-10-23T${String(Math.floor(hour)).padStart(2,'0')}:${hour%1?'30':'00'}:00-03:00`);},hour);
      await page.waitForFunction(period=>document.getElementById('home').dataset.period===period,period);
      assert.equal(await page.locator('#home').getAttribute('data-time-zone'),'America/Sao_Paulo');
      assert.equal(await page.locator('[data-pet]').count(),7);assert.equal(await page.locator('[data-pet=pituca] [data-motion=tail]').count(),0);assert.equal(await page.locator('[data-motion=tail]').count(),5);
      await page.waitForTimeout(350);await page.screenshot({path:`../out/living-menu/${kind}-${period}.png`});
      const contrast=await page.locator('#continue-home').evaluate(e=>{const s=getComputedStyle(e),lum=color=>{const c=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];};const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert.ok(contrast>=4.5,`${kind} ${period} button contrast: ${contrast}`);
    }
    const getAnimations=()=>page.evaluate(()=>document.getElementById('home').getAnimations({subtree:true}).map(a=>({time:a.currentTime,duration:a.effect.getTiming().duration,state:a.playState})));
    const first=await getAnimations();assert.ok(first.filter(a=>a.state==='running').length>35);
    const frameCount=await page.evaluate(()=>new Promise(resolve=>{let count=0,start=performance.now();function frame(now){count++;if(now-start>=1000)resolve(count);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));console.log(`${kind}: ${frameCount} browser frames in one second (headless validation)`);
    await page.waitForTimeout(250);const second=await getAnimations();assert.ok(second.some((a,i)=>a.time>first[i].time));assert.ok(new Set(second.map(a=>a.duration)).size>15);
    const rotor=await page.locator('[data-motion=mill]').evaluate(e=>e.getAnimations()[0].currentTime);
    await page.locator('#continue-home').click();await page.locator('#main-menu').waitFor({state:'visible'});
    assert.ok(await page.locator('[data-motion=mill]').evaluate(e=>e.getAnimations()[0].currentTime)>rotor,'splash to menu does not restart the mill');
    assert.equal(await page.locator('#main-menu button').count(),3);
    // Exact palette handover without recreating the scene or animations.
    await page.evaluate(()=>{window.__menuTime=Date.parse('2026-10-23T18:59:59-03:00');});await page.waitForFunction(()=>document.getElementById('home').dataset.period==='sunset');
    const start=await page.locator('#home').evaluate(e=>e.style.getPropertyValue('--menu-surface'));
    await page.evaluate(()=>{window.__menuTime+=1000;});await page.waitForFunction(()=>document.getElementById('home').dataset.period==='night');
    assert.equal(await page.locator('#home').evaluate(e=>e.style.getPropertyValue('--menu-surface')),start);
    await page.evaluate(()=>{window.__menuTime+=360000;});await page.waitForTimeout(1200);assert.notEqual(await page.locator('#home').evaluate(e=>e.style.getPropertyValue('--menu-surface')),start);
    await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>GolfHome.scene.running),0);
    await page.locator('#back-main').click();assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35);
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35);assert.equal(await page.locator('#home').getAttribute('data-motion'),'gentle');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35);
    await page.waitForFunction(()=>!document.getElementById('offline').disabled,null,{timeout:90000});await page.locator('#offline').click();await page.locator('#level-selection').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>GolfHome.scene.running),0);
    await context.close();
  }
  assert.deepEqual(errors,[]);console.log('Brasilia time under Auckland/Los Angeles device zones, all four palettes, continuous boundaries, seven independent animals, tailless Pituca, mill/wind, pause/resume, reduced motion and campaign/multiplayer navigation passed.');
}finally{await browser?.close();app.close();}
