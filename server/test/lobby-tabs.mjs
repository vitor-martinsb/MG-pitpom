import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,createLobby,joinLobby,customizePlayer,lobbyTab,selectLobbyMode,fillBotCount} from './navigation-fixture.mjs';
const useWebkit=process.argv.includes('--webkit'),app=createServer();let browser;
fs.mkdirSync('../out/lobby-redesign',{recursive:true});
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await(useWebkit?webkit:chromium).launch({headless:true,...(!useWebkit?{...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),args:['--enable-unsafe-swiftshader']}:{} )});
 const a=await browser.newPage({viewport:{width:1200,height:900}}),b=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await visitMultiplayer(p,url);await p.evaluate(()=>GolfI18n.setLanguage('pt-BR'));assert.equal(await p.locator('#entry-actions button:visible').count(),2);assert.equal(await p.locator('#connect input:visible,#connect select:visible').count(),0);assert.equal(await p.locator('#connect #color,#connect #avatar').count(),0);assert.equal(await p.locator('#home').isVisible(),true,'entry retains the original living menu');assert.equal(await p.locator('#home-scenery .living-menu-art').count(),1);assert.equal(await p.locator('#home .home-brand').isVisible(),false);await p.screenshot({path:`../out/lobby-redesign/entry-${p===a?'desktop':useWebkit?'ios':'android'}.png`});}
 console.log('Lobby: entry choices verified');
 await createLobby(a);const room=[...app.rooms.values()][0],owner=[...room.members.values()][0];
 await joinLobby(b,{code:room.code,nickname:'Convidado'});assert.equal(room.members.size,2);
 assert.equal(await b.locator('#tab-players').getAttribute('aria-selected'),'true');assert.equal(await b.locator('#start').isHidden(),true);assert.match(await b.locator('#host-note').textContent(),/Aguardando/);
 await a.locator('#profile-editor summary').click();await a.locator('#nickname').fill('Anfitriao');await a.locator('[data-field=color][data-value="#2685dc"]').click();await a.locator('[data-field=avatar][data-value="2"]').click();assert.equal(await a.locator('#color').inputValue(),'#2685dc');assert.equal(await a.locator('#avatar').inputValue(),'2');
 assert.equal(await a.evaluate(()=>{document.getElementById('profile-form').requestSubmit();return ['nickname','color','avatar','save-profile','start'].every(id=>document.getElementById(id).disabled);}),true,'profile inputs and Start wait for the authoritative acknowledgement');
 await a.waitForFunction(()=>!document.getElementById('save-profile').disabled);assert.equal(owner.color,'#2685dc');assert.equal(owner.avatar,2);assert.equal(await a.locator('[data-field=color][aria-pressed=true]').count(),1);await a.locator('#profile-editor summary').click();
 await customizePlayer(a,{nickname:'Anfitriao',color:'#3366aa',avatar:4});await b.waitForFunction(()=>document.getElementById('host-identity').textContent.includes('Anfitriao'));
 await customizePlayer(b,{color:'#ff9900',avatar:7});const guest=[...room.members.values()][1];assert.equal(owner.color,'#3366aa');assert.equal(guest.color,'#ff9900');assert.equal(guest.avatar,7);
 // The same room event updates the real native player cosmetics.
 await b.waitForFunction(()=>window.GolfOnline.active());
 for(const p of [a,b])assert.equal(await p.locator('#members .player').count(),2);
 console.log('Lobby: synchronized personal customization verified');
 await a.locator('#add-bot').click();await b.waitForFunction(()=>document.querySelectorAll('#bot-members .bot-badge').length===1);
 assert.equal(await b.locator('#add-bot').isDisabled(),true);assert.equal(await b.locator('.remove-bot').count(),0);
 await a.locator('.bot-controls select').selectOption('hard');await b.waitForFunction(()=>document.getElementById('bot-members').textContent.includes('Difícil'));
 await a.locator('.remove-bot').click();await b.locator('#bot-roster').waitFor({state:'hidden'});
 console.log('Lobby: bot addition, difficulty and removal verified');
 await lobbyTab(a,'maps');await a.locator('#map-pool').selectOption('custom');await a.locator('#custom-maps').waitFor({state:'visible'});
 assert.equal(await a.locator('[data-map-id]').count(),80);assert.equal(await a.locator('input[data-world-id]:not([data-map-id])').count(),10);
 await a.locator('input[data-world-id="1"]:not([data-map-id])').uncheck();assert.equal(await a.locator('[data-map-id]:checked').count(),72);
 await lobbyTab(a,'players');await a.locator('#add-bot').click();await b.waitForFunction(()=>document.querySelectorAll('#bot-members .bot-badge').length===1);
 await lobbyTab(a,'maps');assert.equal(await a.locator('[data-map-id]:checked').count(),72,'draft survives tab switches and unrelated room publications');
 for(const input of await a.locator('input[data-world-id]:not([data-map-id])').all())await input.uncheck();
 assert.equal(await a.locator('#apply-maps').isDisabled(),true);
 await a.locator('input[data-world-id="1"]:not([data-map-id])').check();await a.locator('.map-world').first().locator('summary').click();await a.locator('[data-map-id="0"]').uncheck();assert.equal(await a.locator('[data-map-id]:checked').count(),7);
 console.log('Lobby: individual/world selection and draft persistence verified');
 await a.locator('#apply-maps').click();await b.waitForFunction(()=>document.getElementById('selected-maps').textContent.includes('7'));
 await a.locator('#holes').selectOption('7');await lobbyTab(a,'mode');assert.equal(await a.evaluate(()=>{document.querySelector('[data-mode=impact]').click();return document.getElementById('start').disabled;}),true,'wait for the authoritative configuration acknowledgement');await a.waitForFunction(()=>!document.getElementById('start').disabled);assert.equal(await a.locator('[data-mode=impact]').getAttribute('aria-pressed'),'true');await lobbyTab(a,'players');await lobbyTab(a,'maps');assert.equal(await a.locator('#holes').inputValue(),'7');
 assert.deepEqual(room.mapPool,[1,2,3,4,5,6,7]);assert.equal(room.mode,'impact');assert.equal(room.holes,7);
 await lobbyTab(b,'maps');for(const id of ['holes','map-pool','apply-maps'])assert.equal(await b.locator('#'+id).isDisabled(),true);
 await lobbyTab(b,'mode');assert.equal(await b.locator('[data-mode=impact]').getAttribute('aria-pressed'),'true');assert.equal(await b.locator('[data-mode=classic]').isDisabled(),true);
 console.log('Lobby: map limits, mode acknowledgements and guest permissions verified');
 // A focused nickname remains visible as the keyboard reduces the viewport.
 await lobbyTab(b,'players');await b.locator('#profile-editor summary').click();await b.locator('#nickname').focus();await b.setViewportSize({width:390,height:520});await b.waitForTimeout(150);
 const inputBox=await b.locator('#nickname').boundingBox(),scrollBox=await b.locator('.lobby-body').boundingBox();assert.ok(inputBox.y>=scrollBox.y-2&&inputBox.y+inputBox.height<=scrollBox.y+scrollBox.height+2);
 await b.locator('#profile-editor summary').click();await b.setViewportSize({width:390,height:844});
 console.log('Lobby: reduced viewport keyboard layout verified');
 await fillBotCount(a,'48');await a.locator('#apply-bot-count').click();await b.waitForFunction(()=>document.getElementById('count').textContent.startsWith('50/50'));
 assert.equal(room.members.size,50);assert.equal(await a.locator('#add-bot').isDisabled(),true);assert.throws(()=>room.botSettings(owner,'add',null),/50|cheia/);
 console.log('Lobby: 50-participant capacity verified');
 await a.locator('#copy-room-code').click();await a.locator('#toast').waitFor({state:'visible'});
 fs.mkdirSync('../out/lobby-redesign',{recursive:true});
 for(const [p,name]of [[a,'desktop'],[b,useWebkit?'ios':'android']]){
  for(const tab of ['players','maps','mode']){await lobbyTab(p,tab);const footer=await p.locator('.lobby-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=p.viewportSize().height+1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`../out/lobby-redesign/${name}-${tab}.png`});}
 }
 await fillBotCount(a,'0');await a.locator('#apply-bot-count').click();await b.locator('#bot-roster').waitFor({state:'hidden'});
 // Start uses the existing no-repetition draw, loader and shared collision mode.
 await a.locator('#start').click();await a.locator('#presentation').waitFor({state:'visible',timeout:90000});assert.equal(new Set(room.selectedLevels).size,7);assert.equal(room.selectedLevels.length,7);assert.ok(room.selectedLevels.every(i=>room.mapPool.includes(i)));
 assert.deepEqual(errors,[]);console.log(`${useWebkit?'WebKit/iOS':'Chromium desktop/Android'}: two-action entry, lobby tabs, personal profiles, world/map drafts, bots and 50-player cap, permissions, keyboard layout, footer, synchronized mode and no-repeat start passed.`);
}finally{await browser?.close();app.close();}
