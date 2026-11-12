import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,createLobby,joinLobby,lobbyTab} from './navigation-fixture.mjs';
const app=createServer();let browser;
try{
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await (process.argv.includes('--webkit')?webkit.launch({headless:true}):chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--enable-unsafe-swiftshader']}));
 const errors=[],artRequests=[],treeRequests=[],context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/menu-christmas-tree.png'))treeRequests.push(r.url());if(/menu-christmas(?:-portrait)?\.png$/.test(r.url()))artRequests.push(r.url());});
 await page.addInitScript(()=>{localStorage.setItem('pitpom-language','pt-BR');const D=Date;globalThis.Date=class extends D{constructor(...args){super(...(args.length?args:[globalThis.__seasonalDate||'2026-12-15T12:00:00-03:00']));}};});
 await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await page.locator('#continue-home').click();
 assert.equal(await page.evaluate(()=>GolfSeason.theme),'original');assert.equal(artRequests.length,0,'original theme does not download Christmas illustrations');assert.equal(treeRequests.length,0,'original theme never requests the decoration sprite');await page.locator('#music-controls summary').click();await page.locator('#season-theme').selectOption('christmas');await page.locator('#season-obstacles').check();
 await page.waitForFunction(()=>Module.ccall('golf_season_settings','number',['number'],[-1])===1);
 assert.equal(await page.evaluate(()=>GolfSeason.theme),'christmas');const music=await page.evaluate(async()=>{const a=await GolfMusic.renderPreview(1,4),data=a.getChannelData(0);let sum=0,peak=0;for(const n of data){sum+=n*n;peak=Math.max(peak,Math.abs(n));}return {rms:Math.sqrt(sum/data.length),peak};});assert.ok(music.rms>.0001&&music.peak<.5);await page.locator('#music-controls summary').click();
 assert.equal(artRequests.length,0,'Christmas decor reuses the standard art without alternative illustrations');
 await page.waitForFunction(()=>GolfSeason.diagnostics().decorReady);assert.equal(treeRequests.length,1);
 assert.ok(await page.evaluate(()=>GolfHome.scene.running)>35,'original scene and pet animations keep running in Christmas mode');
 fs.mkdirSync('../out/christmas',{recursive:true});
 for(const [width,height]of [[1280,800],[390,844],[320,900],[768,1024],[844,390],[1920,1080]]){
  await page.setViewportSize({width,height});
  await page.waitForFunction(key=>GolfHome.scene.layout===key&&GolfHome.scene.loaded,height>=width?'portrait':'landscape');
  await page.locator('#music-controls summary').click();await page.locator('#season-theme').selectOption('original');await page.locator('#music-controls summary').click();
  await page.waitForFunction(()=>Module.ccall('golf_season_settings','number',['number'],[-1])===0);
  const freeze=async()=>{await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>{a.pause();a.effect.updateTiming({delay:0});a.currentTime=0;}));const n=await page.evaluate(()=>GolfHome.scene.petFrames);await page.waitForFunction(n=>GolfHome.scene.petFrames>n+2,n);};
  const snapshot=()=>page.evaluate(async()=>({
   pets:[...document.querySelectorAll('[data-pet-help]')].map(p=>{const b=p.getBoundingClientRect();return {id:p.dataset.petHelp,x:b.x,y:b.y,w:b.width,h:b.height};}),
   pixels:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(document.querySelector('[data-pet-surface]').toDataURL())))).map(v=>v.toString(16).padStart(2,'0')).join(''),
   sources:[...document.querySelectorAll('[data-pet]')].map(p=>[p.dataset.pet,p.dataset.sourceArt])
  }));
  await freeze();const original=await snapshot();
  assert.equal(await page.locator('.season-subtitle').isHidden(),true);
  assert.equal(await page.locator('#season-atmosphere').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.every((v,i)=>i%4!==3||v===0)),true,'original theme clears every decoration');
  await page.locator('#music-controls summary').click();await page.locator('#season-theme').selectOption('christmas');await page.locator('#music-controls summary').click();
  await page.waitForFunction(()=>Module.ccall('golf_season_settings','number',['number'],[-1])===1);await freeze();const festive=await snapshot();
  assert.equal(festive.pets.length,7);assert.deepEqual(festive,original,`unaltered pet pixels, art and placement at ${width}x${height}`);
  assert.equal(await page.locator('#christmas-menu-art').count(),0,'no alternative art renderer');
  assert.equal(await page.locator('.season-subtitle').isVisible(),true);
  const decor=await page.locator('#season-atmosphere').evaluate(c=>{
   const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data,d=c.width/innerWidth;let visible=0,overPets=0;
   for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;
   for(const p of document.querySelectorAll('[data-pet-help]')){const r=p.getBoundingClientRect();for(let y=Math.max(0,Math.ceil(r.top*d));y<Math.min(c.height,Math.floor(r.bottom*d));y++)for(let x=Math.max(0,Math.ceil(r.left*d));x<Math.min(c.width,Math.floor(r.right*d));x++)if(pixels[(y*c.width+x)*4+3])overPets++;}
   return {visible,overPets};
  });
  const bounds=await page.evaluate(()=>GolfSeason.diagnostics().treeBounds);assert.ok(bounds.left>=7.9&&bounds.right<=width-7.9,'the whole tree stays inside the viewport');
  assert.ok(decor.visible>100,'Christmas decorations are visible');assert.equal(decor.overPets,0,`no Christmas ornament or snow is painted over pets at ${width}x${height}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`../out/christmas/standard-${width}x${height}.png`});
  await page.evaluate(()=>document.querySelector('.living-menu-art').getAnimations({subtree:true}).forEach(a=>a.play()));
  const frame=await page.evaluate(()=>GolfHome.scene.petFrames);await page.waitForFunction(n=>GolfHome.scene.petFrames>n+2,frame);
 }
 for(const [width,height]of [[390,844],[1280,800]]){
  await page.setViewportSize({width,height});await page.waitForFunction(key=>GolfHome.scene.layout===key&&GolfHome.scene.loaded,height>=width?'portrait':'landscape');
  await page.evaluate(()=>{window.__seasonalDate='2026-12-15T23:00:00-03:00';});
  await page.waitForFunction(()=>document.getElementById('home').dataset.period==='night'&&GolfSeason.diagnostics().decorLighting.startsWith('1.00'));
  await page.screenshot({path:`../out/christmas/integrated-night-${width}x${height}.png`});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>GolfHome.show('splash',false));
 await page.locator('#continue-home').waitFor({state:'visible'});await page.waitForFunction(()=>GolfHome.scene.layout==='portrait'&&GolfSeason.diagnostics().decorLighting.startsWith('1.00'));
 await page.screenshot({path:'../out/christmas/welcome-night-390x844.png'});await page.locator('#continue-home').click();
 assert.equal(treeRequests.length,1,'responsive layouts reuse one decoration sprite');
 if(process.argv.includes('--menu-only')){assert.deepEqual(errors,[]);console.log('Christmas menu: integrated tree art, day/night lighting, unchanged pets, six responsive layouts and original-theme restoration passed.');process.exitCode=0;}
 else {
 assert.equal(artRequests.length,0,'neither theme downloads discarded artwork');
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-pet-help=juju]').click();assert.equal(await page.locator('#menu-pet-tooltip').getAttribute('data-pet'),'juju');await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-pet-tooltip').isHidden(),true);
 await page.locator('#open-multiplayer').click();await createLobby(page);
 const room=[...app.rooms.values()][0];await lobbyTab(page,'mode');await page.locator('#room-season-theme').selectOption('christmas');await page.locator('#season-tournament').check();await page.locator('#room-season-obstacles').check();
 await page.waitForFunction(()=>GolfSeason.tournament&&GolfSeason.diagnostics().obstacles);
 const guest=await browser.newPage({viewport:{width:390,height:844}});guest.on('pageerror',e=>errors.push(e.message));await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Elf'});await lobbyTab(guest,'mode');
 assert.equal(await guest.locator('#room-season-theme').isDisabled(),true);assert.equal(await guest.locator('#season-tournament').isChecked(),true);assert.equal(await guest.evaluate(()=>GolfSeason.theme),'christmas');
 await lobbyTab(page,'players');await page.locator('#profile-editor summary').click();await page.locator('#season-skin').selectOption('4');await page.locator('#season-trail').selectOption('3');await page.locator('#save-profile').click();
 await page.waitForFunction(()=>!document.getElementById('save-profile').disabled);assert.equal(room.members.get(1).seasonSkin,4);assert.equal(room.members.get(1).seasonTrail,3);assert.equal(room.members.get(2).seasonSkin,0);
 await page.locator('#profile-editor summary').click();await lobbyTab(page,'mode');await page.screenshot({path:'../out/christmas/lobby-mobile.png'});
 await page.locator('#start').click();await page.waitForFunction(()=>GolfCourse.inspect().frame?.active,{},{timeout:90000});await page.evaluate(()=>Module.ccall('golf_course_skip',null,[],[]));
 await page.waitForFunction(()=>{const f=GolfCourse.inspect().frame;return f?.active&&!f.intro&&f.season.enabled&&f.season.vertices>0;},{},{timeout:30000});
 await guest.waitForFunction(()=>GolfCourse.inspect().frame?.active,{},{timeout:90000});await guest.evaluate(()=>Module.ccall('golf_course_skip',null,[],[]));
 await page.waitForFunction(()=>document.getElementById('loading').hidden&&document.getElementById('status').textContent===GolfI18n.t('phase.playing'),{},{timeout:90000});
 const frame=await page.evaluate(()=>GolfCourse.inspect().frame);assert.ok(frame.season.vertices<36000);assert.equal(frame.season.theme,true);const own=frame.players.find(p=>p.id===frame.local);assert.equal(own.seasonSkin,4);assert.equal(own.seasonTrail,3);assert.ok(own.seasonColor[0]>.9&&own.seasonColor[1]>.7);await page.screenshot({path:'../out/christmas/course-mobile.png'});
 await guest.waitForFunction(()=>GolfCourse.inspect().frame?.season.enabled,{},{timeout:30000});
 assert.deepEqual(errors,[]);console.log('Christmas: live toggle, original restoration, unchanged pets and mobile/desktop menu decorations, 2-client lobby sync, host permissions, saved cosmetics and bounded WebGL decoration passed.');
}
}finally{await browser?.close();app.close();}
