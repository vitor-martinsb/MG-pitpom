import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const external=process.argv.includes('--url'),app=external?null:(await import('../dist/index.js')).createServer();
let browser;
try{
  if(app)await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const url=app?`http://127.0.0.1:${app.server.address().port}`:process.argv[process.argv.indexOf('--url')+1];
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const contexts=await Promise.all([browser.newContext({viewport:{width:1200,height:900}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
  const [a,b]=await Promise.all(contexts.map(c=>c.newPage())),errors=[];
  for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/\bERROR\b|failed to compile|INVALID_OPERATION/i.test(m.text()))errors.push(m.text());});}
  await Promise.all([a.goto(url),b.goto(url)]);
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000})));
  assert.equal(await a.locator('#connect .adventure-map').count(),0);
  fs.mkdirSync('../out/evolution-validation',{recursive:true});await a.screenshot({path:'../out/evolution-validation/welcome.png'});
  assert.equal(await a.locator('#loading .mascot-chase').count(),1);
  assert.equal(await a.evaluate(()=>getComputedStyle(document.querySelector('.mascot-run.pompom')).animationName),'pompom-run');
  for(const [page,name]of [[a,'desktop'],[b,'mobile']]){
    await page.locator('#offline').click();await page.waitForTimeout(500);
    const viewport=page.viewportSize();await page.mouse.click(viewport.width/2,viewport.height*.75);
    await page.locator('#level-selection').waitFor({state:'visible'});
    assert.equal(await page.locator('#level-adventure .trail-node').count(),20);
    assert.equal(await page.locator('#level-adventure .locked').count(),19);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[1])),0);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[-1])),0);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[20])),0);
    for(const [lang,title]of [['pt-BR','Escolha de Fase'],['es','Elegir nivel'],['en','Choose a course']]){
      await page.evaluate(lang=>GolfI18n.setLanguage(lang),lang);assert.equal(await page.locator('#level-selection-title').textContent(),title);
    }
    await page.screenshot({path:`../out/evolution-validation/course-selection-${name}.png`});
    await page.locator('#close-level-selection').click();await page.locator('#level-selection').waitFor({state:'hidden'});
    await page.mouse.click(viewport.width/2,viewport.height*.75);await page.locator('#level-selection').waitFor({state:'visible'});
    await page.locator('#level-adventure [data-level="0"]').click();
    await page.locator('#presentation').waitFor({state:'visible'});await page.locator('#skip-presentation').click();
    await page.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&GolfCourse.inspect().frame.level===0);
    assert.equal(await page.locator('#level-selection').isHidden(),true);
    assert.equal(await page.evaluate(()=>Module.ccall('golf_ui_choose_level','number',['number'],[0])),0);
    await page.reload();await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  }
  await a.locator('#nickname').fill('Host');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});
  const code=await a.locator('#room-code').textContent();await b.locator('#nickname').fill('Guest');await b.locator('#join-code').fill(code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});
  for(const id of ['holes','game-mode','add-bot'])assert.equal(await b.locator('#'+id).isDisabled(),true);
  await a.locator('#holes').selectOption('2');await a.locator('#game-mode').selectOption('impact');
  await b.waitForFunction(()=>document.getElementById('holes').value==='2'&&document.getElementById('game-mode').value==='impact');
  await a.locator('#add-bot').click();await a.locator('.bot-controls').waitFor();
  await a.locator('.bot-controls input:not([type=color])').fill('Garden Bot');await a.locator('.bot-controls select').selectOption('hard');
  await a.locator('.bot-row button').first().click();await b.waitForFunction(()=>document.getElementById('members').textContent.includes('Garden Bot'));
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
  await a.reload();await a.waitForFunction(()=>window.GolfAudio);const audio=await a.evaluate(()=>GolfAudio.status());assert.equal(audio.master,.61);assert.equal(audio.effects,.37);assert.equal(audio.ui,.19);
  assert.deepEqual(errors,[]);await Promise.all(contexts.map(c=>c.close()));
  console.log('Evolution browser: host/guest configuration, bot CRUD, visible protection, shared adventure order, mobile layout, independent audio preferences and final-only celebration passed.');
}finally{await browser?.close();app?.close();}
