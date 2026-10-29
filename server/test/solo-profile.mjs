import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {openCampaign,enterMultiplayer,createLobby} from './navigation-fixture.mjs';
const app=createServer();let browser;fs.mkdirSync('../out/solo-profile',{recursive:true});
const nativeProfile=p=>p.evaluate(()=>JSON.parse(Module.ccall('golf_ui_solo_profile','string',[],[])));
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),args:['--enable-unsafe-swiftshader']});
 for(const [width,height,mobile]of [[1200,900,false],[390,844,true]]){
  const p=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${app.server.address().port}`);await openCampaign(p);
  await p.locator('#solo-profile-slot #profile-editor').waitFor({state:'visible'});await p.locator('#profile-editor summary').click();await p.locator('#nickname').fill('Solo Juju');await p.locator('[data-field=color][data-value="#2685dc"]').click();await p.locator('[data-field=avatar][data-value="5"]').click();
  await p.locator('#save-profile').click();assert.equal(await p.locator('#profile-display-name').textContent(),'Solo Juju');assert.notEqual(await p.locator('.color-choices button').first().evaluate(e=>getComputedStyle(e,'::before').backgroundColor),'rgba(0, 0, 0, 0)');await p.screenshot({path:`../out/solo-profile/editor-${width}.png`});await p.locator('#nickname').fill('Solo Frida');await p.locator('[data-field=avatar][data-value="4"]').click();await p.locator('#profile-editor summary').click();
  await p.locator('#level-adventure [data-level="0"]').click();await p.locator('#play-course').click();await p.locator('#presentation').waitFor({state:'visible',timeout:90000});await p.locator('#skip-presentation').click();await p.waitForFunction(()=>GolfCourse.inspect().frame?.active&&!GolfCourse.inspect().frame.intro);
  const native=await nativeProfile(p);assert.equal(native.nickname,'Solo Frida');assert.equal(native.avatar,4);assert.ok(Math.abs(native.r-38/255)<.001);assert.ok(Math.abs(native.g-133/255)<.001);assert.ok(Math.abs(native.b-220/255)<.001);
  await p.reload();await openCampaign(p);assert.equal(await p.locator('#profile-display-name').textContent(),'Solo Frida');assert.equal((await nativeProfile(p)).avatar,4);
  await p.locator('#close-level-selection').click();await enterMultiplayer(p);await createLobby(p);assert.equal(await p.locator('#lobby-profile-slot #profile-editor').count(),1);assert.equal(await p.locator('#profile-editor').count(),1);const member=[...app.rooms.values()].at(-1).members.values().next().value;assert.equal(member.nickname,'Solo Frida');assert.equal(member.avatar,4);assert.equal(member.color,'#2685dc');assert.deepEqual(errors,[]);await p.close();
 }
 console.log('Solo profile: shared pet/color/name editor, native playing ball cosmetics, reload persistence and reuse in multiplayer passed on desktop/mobile.');
}finally{await browser?.close();app.close();}
