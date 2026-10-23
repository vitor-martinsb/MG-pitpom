import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {enterMultiplayer,openCampaign,reloadMultiplayer} from './navigation-fixture.mjs';
import {canvasClick} from './canvas-input.mjs';
const app=createServer(),errors=[];let browser;
try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  fs.mkdirSync('../out/home-navigation',{recursive:true});
  const pages=[];
  for(const [name,width,height,touch]of [['desktop',1280,900,false],['mobile',390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,locale:'pt-BR'}),page=await context.newPage();pages.push(page);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});
    assert.equal(await page.locator('#home').isVisible(),true);assert.equal(await page.locator('#connect').isHidden(),true);
    assert.equal(await page.locator('#main-menu').isHidden(),true);assert.equal(await page.locator('html').getAttribute('lang'),'en');
    await page.waitForFunction(()=>document.querySelector('.home-art')?.complete&&document.querySelector('.home-art').naturalWidth>900);
    assert.equal(await page.locator('.home-art').getAttribute('alt'),'Pituca, Pompom, Romeu, Luna, Frida, Maritaca');
    assert.ok((await page.locator('.home-art').evaluate(e=>e.currentSrc)).endsWith('menu-supplied.jpg'));
    await page.screenshot({path:`../out/home-navigation/welcome-${name}.png`});
    if(touch)await page.locator('#continue-home').tap();else await page.keyboard.press('Enter');
    await page.locator('#main-menu').waitFor({state:'visible'});
    assert.equal(await page.locator('#main-menu button').count(),3);assert.equal(await page.locator('#home .adventure-map').count(),0);
    await page.waitForFunction(()=>!document.getElementById('offline').disabled);
    await page.waitForTimeout(400);await page.screenshot({path:`../out/home-navigation/menu-${name}.png`});
    await page.locator('#exit-game').click();assert.equal(await page.locator('#continue-home').isVisible(),true);
    await page.keyboard.press('Space');await page.locator('#main-menu').waitFor({state:'visible'});
    await page.locator('#music-controls summary').click();await page.locator('#language').selectOption('pt-BR');await page.locator('#music-controls summary').click();
    assert.ok((await page.locator('#offline').innerText()).includes('Campanha'));
    await openCampaign(page);
    assert.equal(await page.locator('#level-adventure .trail-node').count(),80);assert.equal(await page.locator('.campaign-world').count(),10);assert.equal(await page.locator('.family-title').count(),20);
    assert.equal(await page.locator('#level-adventure .locked').count(),0);
    await page.locator('#solo-progression').check();await page.waitForFunction(()=>document.querySelectorAll('#level-adventure .locked').length===79);
    await page.locator('#level-adventure [data-level="1"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#play-course').isDisabled(),true);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[1])),0);
    await page.locator('#level-adventure .world-navigation button').last().click();await page.locator('.campaign-world[data-world="10"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:`../out/home-navigation/world-ten-${name}.png`});
    await page.locator('#level-adventure .world-navigation button').first().click();await page.locator('#level-adventure [data-level="0"]').click();
    assert.ok((await page.locator('#selected-course-name').textContent()).includes(await page.evaluate(()=>GolfI18n.familyName(1))));
    await page.screenshot({path:`../out/home-navigation/campaign-${name}.png`});
    for(const language of ['en','es','pt-BR']){
      await page.evaluate(lang=>GolfI18n.setLanguage(lang),language);
      assert.equal(await page.locator('#play-course').textContent(),await page.evaluate(()=>GolfI18n.t('playCourse')));
    }
    await page.locator('#close-level-selection').click();await page.locator('#main-menu').waitFor({state:'visible'});
    if(touch){await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.querySelector('.home-art').complete&&document.querySelector('.home-art').currentSrc.endsWith('menu-supplied.jpg'));await page.waitForTimeout(400);await page.screenshot({path:'../out/home-navigation/menu-landscape.png'});await page.setViewportSize({width,height});}
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // Seed actual legacy/new records on IDBFS, then verify the new menu reads
    // them without changing keys, scores or sequential native validation.
    await page.evaluate(()=>new Promise((resolve,reject)=>{
      FS.writeFile('/opengolf_persistent_data/storage.json',JSON.stringify({stroke_count_level_0:4,pitpom80_best_1_1:6}));
      FS.syncfs(false,error=>error?reject(error):resolve());
    }));
    await page.reload();await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});
    assert.equal(await page.locator('#continue-home').isVisible(),true);assert.equal(await page.locator('html').getAttribute('lang'),'pt-BR');
    await page.locator('#continue-home').click();await openCampaign(page);
    await page.waitForFunction(()=>document.querySelectorAll('#level-adventure .locked').length===77);
    const saved=await page.evaluate(()=>JSON.parse(Module.ccall('golf_ui_level_selection','string',[],[])).levels);
    assert.deepEqual(saved.slice(0,3),[4,6,null]);assert.equal(await page.locator('#level-adventure .current').getAttribute('data-level'),'2');
    await page.locator('#level-adventure [data-level="2"]').click();await page.locator('#play-course').click();
    await page.locator('#presentation').waitFor({state:'visible'});await page.locator('#skip-presentation').click();
    await page.waitForFunction(()=>GolfCourse.inspect().frame?.active&&!GolfCourse.inspect().frame.intro);
    assert.equal(await page.locator('#home').isHidden(),true);assert.equal(await page.locator('#level-selection').isHidden(),true);
    const scale=Math.min(width,height)/720;
    await canvasClick(page,width-80*scale,80*scale);await page.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===7);
    await canvasClick(page,width/2,height/2+160*scale);await page.locator('#main-menu').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>GolfAudio.status().scene),'menu');
    await openCampaign(page);await page.locator('#level-adventure [data-level="2"]').click();await page.locator('#play-course').click();
    await page.locator('#presentation').waitFor({state:'visible'});await page.locator('#skip-presentation').click();
    await page.waitForFunction(()=>GolfAudio.status().scene==='game');
    // Return through a fresh application load; progress and preference persist.
    await page.reload();await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await enterMultiplayer(page);
  }
  const [a,b]=pages;
  await a.locator('#nickname').fill('Garden Host');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});
  const room=[...app.rooms.values()][0];await b.locator('#nickname').fill('Garden Guest');await b.locator('#join-code').fill(room.code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});
  for(const id of ['bot-count','bot-difficulty-all','add-bot','apply-bot-count'])assert.equal(await b.locator('#'+id).isDisabled(),true);
  await a.locator('#bot-count').fill('5');await a.locator('#bot-difficulty-all').selectOption('hard');await a.locator('#apply-bot-count').click();
  await b.locator('#bot-roster').waitFor({state:'visible'});
  assert.equal(await a.locator('#bot-members').locator('.bot-row').count(),0);
  assert.equal(await b.locator('#bot-members .bot-badge').count(),0);
  await a.locator('#bot-roster>summary').click();await b.locator('#bot-roster>summary').click();
  await b.waitForFunction(()=>document.querySelectorAll('#bot-members .bot-badge').length===5);
  assert.equal(room.members.size,7);assert.ok((await b.locator('#count').textContent()).includes('7/50'));
  await a.locator('.bot-controls select').first().selectOption('easy');await b.waitForFunction(()=>document.getElementById('bot-members').textContent.includes(GolfI18n.t('difficulty.easy')));
  await a.locator('.remove-bot').first().click();await b.waitForFunction(()=>document.querySelectorAll('#bot-members .bot-badge').length===4);
  await a.locator('#add-bot').click();await b.waitForFunction(()=>document.querySelectorAll('#bot-members .bot-badge').length===5);
  await a.locator('#lobby-open-chat').click();await a.locator('#chat-input').fill('Garden lobby chat');await a.locator('#send-chat').click();
  await b.waitForFunction(()=>document.getElementById('chat-messages').textContent.includes('Garden lobby chat'));await a.locator('#close-chat').click();
  for(const [page,name]of [[a,'desktop'],[b,'mobile']])await page.screenshot({path:`../out/home-navigation/lobby-${name}.png`});
  await reloadMultiplayer(b);await b.locator('#lobby').waitFor({state:'visible',timeout:90000});await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});assert.equal(room.members.size,7);
  await a.locator('#lobby-leave').click();await a.locator('#main-menu').waitFor({state:'visible'});
  await a.emulateMedia({reducedMotion:'reduce'});assert.equal(await a.locator('#continue-home').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(errors,[]);
  console.log('Welcome click/touch/Enter/Space, three choices, 80 courses/10 worlds, native saved scores/locks, real solo loading, EN/PT/ES, bot CRUD/host permissions and reconnect passed on desktop/mobile.');
}finally{await browser?.close();app.close();}
