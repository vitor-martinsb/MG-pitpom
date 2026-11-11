import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,createLobby,joinLobby,lobbyTab} from './navigation-fixture.mjs';
const app=createServer();let browser;
try{
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await (process.argv.includes('--webkit')?webkit.launch({headless:true}):chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--enable-unsafe-swiftshader']}));
 const errors=[],artRequests=[],context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/menu-christmas(?:-portrait)?\.png$/.test(r.url()))artRequests.push(r.url());});
 await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await page.locator('#continue-home').click();
 assert.equal(await page.evaluate(()=>GolfSeason.theme),'original');assert.equal(artRequests.length,0,'original theme does not download Christmas illustrations');await page.locator('#music-controls summary').click();await page.locator('#season-theme').selectOption('christmas');await page.locator('#season-obstacles').check();
 await page.waitForFunction(()=>Module.ccall('golf_season_settings','number',['number'],[-1])===1);
 assert.equal(await page.evaluate(()=>GolfSeason.theme),'christmas');const music=await page.evaluate(async()=>{const a=await GolfMusic.renderPreview(1,4),data=a.getChannelData(0);let sum=0,peak=0;for(const n of data){sum+=n*n;peak=Math.max(peak,Math.abs(n));}return {rms:Math.sqrt(sum/data.length),peak};});assert.ok(music.rms>.0001&&music.peak<.5);await page.locator('#music-controls summary').click();
 await page.waitForFunction(()=>GolfChristmasMenu.diagnostics().active&&GolfChristmasMenu.diagnostics().frames>0);assert.equal(artRequests.length,2,'both Christmas compositions decode before activation');assert.equal(await page.evaluate(()=>GolfHome.scene.running),0,'the original renderer pauses behind Christmas artwork');
 fs.mkdirSync('../out/christmas',{recursive:true});await page.waitForTimeout(700);await page.screenshot({path:'../out/christmas/menu-desktop.png'});
 await page.locator('#music-controls summary').click();await page.locator('#season-theme').selectOption('original');await page.waitForFunction(()=>Module.ccall('golf_season_settings','number',['number'],[-1])===0);await page.waitForFunction(()=>!GolfChristmasMenu.active&&GolfHome.scene.running>0);await page.locator('#season-theme').selectOption('christmas');await page.locator('#music-controls summary').click();
 for(const [width,height]of [[1280,800],[390,844],[320,900],[768,1024],[844,390],[1920,1080]]){
  await page.setViewportSize({width,height});
  await page.waitForFunction(key=>GolfChristmasMenu.diagnostics().composition===key,height>=width?'portrait':'landscape');
  await page.waitForTimeout(200);
  const geometry=await page.evaluate(()=>{
   const canvas=document.getElementById('christmas-menu-art'),menu=document.getElementById('main-menu').getBoundingClientRect();
   const pets=[...document.querySelectorAll('[data-pet-help]')].map(p=>{const b=p.getBoundingClientRect();return {id:p.dataset.petHelp,x:b.x,y:b.y,w:b.width,h:b.height};});
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let clear=0;for(let i=3;i<pixels.length;i+=400)if(pixels[i]!==255)clear++;
   return {pets,menu:{x:menu.x,y:menu.y,w:menu.width,h:menu.height},clear,ink:getComputedStyle(document.getElementById('home')).getPropertyValue('--menu-ink').trim()};
  });
  assert.equal(geometry.pets.length,7);assert.equal(geometry.clear,0,'complete opaque illustration without cutout gaps');assert.equal(geometry.ink,'#173f26','Christmas artwork keeps the bright reference palette');
  for(const p of geometry.pets){assert.ok(p.x>=-1&&p.y>=-1&&p.x+p.w<=width+1&&p.y+p.h<=height+1,`${p.id} fits ${width}x${height}`);const m=geometry.menu;assert.ok(p.x+p.w<=m.x||p.x>=m.x+m.w||p.y+p.h<=m.y||p.y>=m.y+m.h,`${p.id} does not overlap menu buttons`);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`../out/christmas/reference-${width}x${height}.png`});
 }
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
 assert.deepEqual(errors,[]);console.log('Christmas: live toggle, original restoration, desktop/mobile artwork, 2-client lobby sync, host permissions, saved cosmetics and bounded WebGL decoration passed.');
}finally{await browser?.close();app.close();}
