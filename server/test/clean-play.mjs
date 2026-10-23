import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,reloadMultiplayer,openCampaign} from './navigation-fixture.mjs';
import {canvasClick} from './canvas-input.mjs';
const app=createServer(),errors=[];let browser;
try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  fs.mkdirSync('../out/clean-play',{recursive:true});
  const pages=[];
  for(const [width,height,mobile]of [[1200,900,false],[390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();pages.push(page);
    page.on('pageerror',error=>errors.push(error.message));await visitMultiplayer(page,url);
    await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
    assert.equal(await page.locator('#connect .garden-header,#connect img').count(),0);

    assert.equal(await page.locator('#toggle-match-info').isHidden(),true);
  }
  const [a,b]=pages;
  await a.locator('#nickname').fill('Clean Host');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});
  const room=[...app.rooms.values()][0];await b.locator('#nickname').fill('Clean Guest');await b.locator('#join-code').fill(room.code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});
  await a.locator('#bot-count').fill('30');await a.locator('#apply-bot-count').click();
  await b.waitForFunction(()=>document.getElementById('bot-roster-label').textContent.startsWith('30 '));
  const bots=[...room.members.values()].filter(m=>m.bot);assert.equal(new Set(bots.map(m=>m.color)).size,30);
  assert.ok(bots.every(m=>/^#[0-9a-f]{6}$/.test(m.color)));
  for(const page of pages){
    await page.waitForFunction(()=>document.querySelectorAll('#bot-colors i').length===8);
    assert.equal(await page.locator('#members .player').count(),2);assert.equal(await page.locator('#bot-members .player').count(),0);
    assert.equal(await page.locator('#bot-roster').getAttribute('open'),null);assert.equal(await page.locator('#bot-colors i').count(),8);
  }
  assert.deepEqual(await a.locator('#bot-colors i').evaluateAll(items=>items.map(e=>e.style.background)),await b.locator('#bot-colors i').evaluateAll(items=>items.map(e=>e.style.background)));
  await a.screenshot({path:'../out/clean-play/lobby-desktop.png'});await b.screenshot({path:'../out/clean-play/lobby-mobile.png'});
  await a.locator('#bot-roster>summary').click();await a.locator('.bot-row').last().waitFor();assert.equal(await a.locator('.bot-row').count(),30);
  await a.locator('#bot-roster>summary').click();await a.waitForFunction(()=>!document.querySelectorAll('#bot-members .bot-row').length);
  for(const id of ['bot-count','bot-difficulty-all','apply-bot-count','add-bot'])assert.equal(await b.locator('#'+id).isDisabled(),true);
  // Live input checks use the existing original first course, without AI load.
  await a.locator('#bot-count').fill('0');await a.locator('#apply-bot-count').click();await b.locator('#bot-roster').waitFor({state:'hidden'});
  room.configurePool([...room.members.values()][0],'custom',[0]);await a.locator('#holes').selectOption('1');await a.locator('#start').click();
  for(const page of pages){await page.locator('#presentation').waitFor({state:'visible'});await page.locator('#skip-presentation').click();}
  for(const page of pages)await page.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.playing'));
  for(const [page,name,id]of [[a,'desktop',1],[b,'mobile',2]]){
    await page.locator('#toggle-match-info').waitFor({state:'visible'});assert.equal(await page.locator('#toggle-match-info').getAttribute('aria-pressed'),'false');
    if(name==='mobile')await page.locator('#toggle-match-info').tap();else await page.locator('#toggle-match-info').click();
    for(const selector of ['#hud','#actions','#minimap','#course-status','#music-controls','#help'])assert.equal(await page.locator(selector).isVisible(),false,selector);
    await page.waitForTimeout(250);assert.equal(room.members.get(id).ball.strokes,0,'toggling never shoots');
    await page.screenshot({path:`../out/clean-play/hidden-${name}.png`});
    await page.waitForTimeout(800);
    const [x,y]=await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
    if(name==='mobile'){
      const cdp=await page.context().newCDPSession(page);
      for(const [type,points]of [['touchStart',[[1,x,y]]],['touchMove',[[1,x,y+75]]],['touchEnd',[]]]){
        await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5}))});await page.waitForTimeout(120);
      }
    }else{
      await page.mouse.move(x,y);await page.waitForTimeout(80);await page.mouse.down();await page.waitForTimeout(120);await page.mouse.move(x,y+75,{steps:6});await page.waitForTimeout(120);await page.mouse.up();
    }
    for(let n=0;room.members.get(id).ball.strokes!==1;n++){assert.ok(n<100,JSON.stringify({message:'real shot works with information hidden',name,x,y,diagnostics:await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[]))),focused:await page.evaluate(()=>document.activeElement?.id),blocked:await page.evaluate(()=>GolfOnline.blocked())}));await page.waitForTimeout(50);}
    for(const lang of ['pt-BR','es','en']){
      await page.evaluate(value=>GolfI18n.setLanguage(value),lang);
      assert.equal(await page.locator('#toggle-match-info').getAttribute('aria-label'),await page.evaluate(()=>GolfI18n.t('showMatchInfo')));
    }
  }
  await reloadMultiplayer(a);await a.locator('#presentation').waitFor({state:'visible',timeout:90000});await a.locator('#skip-presentation').click();
  await a.waitForFunction(()=>document.body.classList.contains('match-info-hidden'));
  assert.equal(await a.locator('#toggle-match-info').getAttribute('aria-pressed'),'true');assert.equal(room.members.size,2);
  await a.locator('#toggle-match-info').click();await a.waitForFunction(()=>document.getElementById('toggle-match-info').getAttribute('aria-pressed')==='false');await a.locator('#show-scores').click();await a.locator('#scores').waitFor({state:'visible'});
  await a.locator('#toggle-match-info').click();await a.locator('#scores').waitFor({state:'hidden'});
  // Mandatory end-of-course results remain available in the quiet display mode.
  room.deadline=performance.now()-6000;while(room.busy)await a.waitForTimeout(10);await room.tick();
  for(const page of pages){await page.locator('#scores').waitFor({state:'visible'});await page.locator('#toggle-match-info').waitFor({state:'hidden'});}
  room.deadline=0;while(room.busy)await a.waitForTimeout(10);await room.tick();await a.locator('#finish-exit').click();await a.locator('#main-menu').waitFor({state:'visible'});
  assert.equal(await a.locator('#music-controls').isVisible(),true);assert.equal(await a.locator('#toggle-match-info').isHidden(),true);
  // The preference also applies offline, and never hides the native pause/exit.
  await openCampaign(a);await a.locator('#level-adventure [data-level="0"]').click();await a.locator('#play-course').click();await a.locator('#presentation').waitFor({state:'visible'});await a.locator('#skip-presentation').click();
  await a.waitForFunction(()=>document.body.classList.contains('match-info-hidden'));
  await canvasClick(a,1200-80*900/720,80*900/720);await a.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===7);
  await canvasClick(a,600,450+160*900/720);await a.locator('#main-menu').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('30 bots collapsed by default, unique replicated colors, host permissions, hidden HUD and labels, mouse/touch shots, persistent quiet mode, mandatory results, native pause and EN/PT/ES passed.');
}finally{await browser?.close();app.close();}
