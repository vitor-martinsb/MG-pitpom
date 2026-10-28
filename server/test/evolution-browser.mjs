import {showBotRoster} from './navigation-fixture.mjs';
import {createLobby,joinLobby,lobbyTab,selectLobbyMode} from './navigation-fixture.mjs';
import {visitMultiplayer,reloadMultiplayer,openCampaign} from './navigation-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {canvasClick} from './canvas-input.mjs';
const external=process.argv.includes('--url'),app=external?null:(await import('../dist/index.js')).createServer();
let browser;
const openCourseSelection=openCampaign;

try{
  if(app)await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const url=app?`http://127.0.0.1:${app.server.address().port}`:process.argv[process.argv.indexOf('--url')+1];
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const contexts=await Promise.all([browser.newContext({viewport:{width:1200,height:900}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
  const [a,b]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
  for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/\bERROR\b|failed to compile|INVALID_OPERATION/i.test(m.text()))errors.push(m.text());});}
  await Promise.all([visitMultiplayer(a,url),visitMultiplayer(b,url)]);
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000})));
  assert.equal(await a.locator('#connect .adventure-map').count(),0);
  fs.mkdirSync('../out/evolution-validation',{recursive:true});await a.screenshot({path:'../out/evolution-validation/welcome.png'});
  assert.equal(await a.locator('#loading .mascot-chase').count(),1);
  assert.equal(await a.locator('#loading .mascot-run .run-frame').count(),2);
  assert.equal(await a.locator('#loading .chase-ring').count(),0);
  for(const [page,name]of [[a,'desktop'],[b,'mobile']]){
    await openCampaign(page);
    await openCourseSelection(page);
    assert.equal(await page.locator('#level-adventure .trail-node').count(),80);
    assert.equal(await page.locator('#level-adventure .locked').count(),0);
    await page.locator('#solo-progression').check();
    await page.waitForFunction(()=>document.querySelectorAll('#level-adventure .locked').length===79);
    assert.equal(await page.locator('#level-adventure .family-title').count(),20);
    assert.equal(await page.locator('#level-adventure .world-navigation button').count(),10);
    assert.equal(await page.locator('#level-adventure .world-navigation [aria-current=location]').count(),1);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[1])),0);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[-1])),0);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[80])),0);
    for(const [lang,title]of [['pt-BR','Escolha de Fase'],['es','Elegir nivel'],['en','Choose a course']]){
      await page.evaluate(lang=>GolfI18n.setLanguage(lang),lang);assert.equal(await page.locator('#level-selection-title').textContent(),title);
      assert.equal(await page.locator('#level-adventure .family-title').first().textContent(),await page.evaluate(()=>GolfI18n.familyName(1)));
      assert.equal(await page.locator('#level-adventure [data-level="3"]').getAttribute('aria-label'),await page.evaluate(()=>`${GolfI18n.courseName(GOLF_CAMPAIGN.courses[3])}, ${GolfI18n.t('levelLocked')}`));
    }
    await page.screenshot({path:`../out/evolution-validation/course-selection-${name}.png`});
    await page.locator('#close-level-selection').click();await page.locator('#level-selection').waitFor({state:'hidden'});
    await openCourseSelection(page);
    await page.locator('#level-adventure [data-level="0"]').click();await page.locator('#play-course').click();
    await page.locator('#presentation').waitFor({state:'visible'});await page.locator('#skip-presentation').click();
    await page.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&GolfCourse.inspect().frame.level===0);
    assert.equal(await page.locator('#level-selection').isHidden(),true);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[0])),0);
    await reloadMultiplayer(page);await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  }
  await createLobby(a,{nickname:'Host'});await a.locator('#lobby').waitFor({state:'visible'});
  const code=await a.locator('#room-code').textContent();await joinLobby(b,{code:code,nickname:'Guest'});await b.locator('#lobby').waitFor({state:'visible'});
  for(const id of ['holes','game-mode','add-bot','map-pool'])assert.equal(await b.locator('#'+id).isDisabled(),true);
  await lobbyTab(a,'maps');await a.locator('#map-pool').selectOption('originals');
  await b.waitForFunction(()=>document.getElementById('map-pool').value==='originals');
  assert.equal(await a.locator('#holes option:not(:disabled)').count(),20);
  await lobbyTab(a,'maps');await a.locator('#map-pool').selectOption('evolutions');
  await a.waitForFunction(()=>document.querySelectorAll('#holes option:not(:disabled)').length===60);
  await lobbyTab(a,'maps');await a.locator('#map-pool').selectOption('custom');
  await b.waitForFunction(()=>document.getElementById('map-pool').value==='custom');
  await a.locator('#custom-maps').waitFor({state:'visible'});
  await a.locator('#map-options input').evaluateAll(inputs=>inputs.forEach(input=>{input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));}));
  await a.locator('.map-world').first().locator('summary').click();
  await a.locator('#map-options input[data-map-id="0"]').check();
  await a.locator('#map-options input[data-map-id="3"]').check();
  await a.locator('#apply-maps').click();
  await b.waitForFunction(()=>[...document.getElementById('holes').options].filter(option=>!option.disabled).length===2);
  await lobbyTab(a,'maps');await a.locator('#holes').selectOption('2');await selectLobbyMode(a,'impact');
  await b.waitForFunction(()=>document.getElementById('holes').value==='2'&&document.getElementById('game-mode').value==='impact');
  await lobbyTab(a,'players');await a.locator('#add-bot').click();await b.locator('#bot-roster').waitFor({state:'visible'});await showBotRoster(a);await showBotRoster(b);await a.locator('.bot-controls').waitFor();
  await a.locator('.bot-controls select').selectOption('hard');await b.waitForFunction(()=>document.getElementById('bot-members').textContent.includes(GolfI18n.t('difficulty.hard')));await a.locator('.bot-cosmetics summary').click();await a.locator('.bot-cosmetics input:not([type=color])').fill('Garden Bot');
  await a.locator('.bot-cosmetics button').click();await b.waitForFunction(()=>document.getElementById('bot-members').textContent.includes('Garden Bot'));
  await a.locator('#music-controls').click();for(const [id,value]of [['master-volume','61'],['effects-volume','37'],['ui-volume','19']])await a.locator('#'+id).evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await a.locator('#music-controls summary').click();
  await a.locator('#start').click();await a.locator('#loading').waitFor({state:'visible'});await a.screenshot({path:'../out/evolution-validation/loading.png'});
  await Promise.all([a,b].map(p=>p.locator('#presentation').waitFor({state:'visible'})));
  await Promise.all([a,b].map(p=>p.locator('#skip-presentation').click()));
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&document.getElementById('status').textContent===GolfI18n.t('phase.playing'))));
  const initial=await a.evaluate(()=>GolfCourse.inspect().frame);assert.equal(initial.players.filter(p=>p.visible).length,3);
  assert.equal(initial.players.find(p=>p.id===initial.local).firstComplete,false);
  await a.locator('#open-adventure').click();await a.locator('#adventure-modal').waitFor({state:'visible'});
  assert.equal(await a.locator('#match-adventure .trail-node').count(),2);assert.equal(await a.locator('#match-adventure .current').count(),1);await a.locator('#close-adventure').click();
  fs.mkdirSync('../out/evolution-validation',{recursive:true});await a.screenshot({path:'../out/evolution-validation/desktop.png'});await b.screenshot({path:'../out/evolution-validation/mobile.png'});
  if(app){
    const room=app.rooms.get(code);room.deadline=performance.now()-6000;await room.tick();
    await a.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.results'));assert.equal(room.phase,'results');
    await a.waitForFunction(()=>document.getElementById('scores-title').textContent===GolfI18n.t('holeScores'));assert.equal(await a.evaluate(()=>GolfAudio.status().celebrations),0);
    room.deadline=0;await room.tick();await Promise.all([a,b].map(p=>p.locator('#presentation').waitFor({state:'visible'})));await Promise.all([a,b].map(p=>p.locator('#skip-presentation').click()));
    await a.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.playing'));
    room.deadline=performance.now()-6000;await room.tick();await a.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.results'));room.deadline=0;await room.tick();
    await Promise.all([a,b].map(p=>p.waitForFunction(()=>GolfAudio.status().celebrations===1)));
    assert.equal(await a.locator('#results-adventure .completed').count(),2);assert.ok((await a.locator('#winner-banner').textContent()).length>0);
    room.publish();await a.waitForTimeout(150);assert.equal(await a.evaluate(()=>GolfAudio.status().celebrations),1);
    await a.screenshot({path:'../out/evolution-validation/final.png'});
    await a.locator('#play-again').click();await Promise.all([a,b].map(p=>p.locator('#lobby').waitFor({state:'visible'})));
    assert.equal(room.phase,'lobby');assert.equal(await b.locator('#start').isDisabled(),true);
  }
  await reloadMultiplayer(a);await a.waitForFunction(()=>window.GolfAudio);const audio=await a.evaluate(()=>GolfAudio.status());assert.equal(audio.master,.61);assert.equal(audio.effects,.37);assert.equal(audio.ui,.19);
  assert.deepEqual(errors,[]);await Promise.all(contexts.map(c=>c.close()));
  console.log('Evolution browser: host/guest configuration, bot CRUD, visible protection, shared adventure order, mobile layout, independent audio preferences and final-only celebration passed.');
}finally{await browser?.close();app?.close();}
