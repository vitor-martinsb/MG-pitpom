import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {freezePhysics} from './room-fixture.mjs';

const app=createServer(),errors=[];let browser;
try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const contexts=await Promise.all([browser.newContext({viewport:{width:1200,height:900}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
  const pages=await Promise.all(contexts.map(c=>c.newPage())),[a,b]=pages;
  for(const page of pages){
    page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
    await page.evaluate(()=>{const call=Module.ccall;Module.ccall=function(...args){if(args[0]==='golf_online_receive'){const m=JSON.parse(args[3][0]);if(m.type==='room')window.nativeRoster=m.players;}return call.apply(Module,args);};});
  }
  await a.locator('#nickname').fill('Human Host');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});
  const room=[...app.rooms.values()][0];await b.locator('#nickname').fill('Jogador PT');await b.locator('#join-code').fill(room.code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});await b.evaluate(()=>GolfI18n.setLanguage('pt-BR'));
  for(const id of ['bot-count','bot-difficulty-all','apply-bot-count'])assert.equal(await b.locator('#'+id).isDisabled(),true);
  await a.locator('#bot-count').fill('3');await a.locator('#bot-difficulty-all').selectOption('expert');await a.locator('#apply-bot-count').click();
  await b.waitForFunction(()=>document.querySelectorAll('#members .bot-badge').length===3);
  assert.deepEqual([...room.members.values()].filter(m=>m.bot).map(m=>m.nickname),['GPT-6','Claude','Gemini']);
  await b.evaluate(()=>{document.getElementById('bot-count').value='20';document.getElementById('apply-bot-count').disabled=false;document.getElementById('apply-bot-count').click();});
  await b.locator('#toast').waitFor({state:'visible'});assert.match(await b.locator('#toast').textContent(),/anfitrião/);assert.equal([...room.members.values()].filter(m=>m.bot).length,3);
  await a.locator('.bot-controls select').first().selectOption('easy');await a.locator('.bot-row button').first().click();
  await b.waitForFunction(()=>document.getElementById('members').textContent.includes('Fácil'));
  await a.waitForFunction(()=>window.nativeRoster?.filter(p=>p.nickname.startsWith('[BOT] ')).length===3);
  const roster=await a.evaluate(()=>window.nativeRoster);assert.equal(roster.find(p=>p.nickname==='Human Host').bot,undefined);assert.equal(roster.filter(p=>p.nickname.startsWith('[BOT] ')).length,3);
  await a.locator('#holes').selectOption('1');await a.locator('#start').click();await Promise.all(pages.map(p=>p.locator('#presentation').waitFor({state:'visible'})));
  room.selectedLevels=[0];room.holes=1;room.hole=0;await room.load();
  await Promise.all(pages.map(p=>p.waitForFunction(()=>GolfCourse.inspect().frame?.course===1&&GolfCourse.inspect().frame.intro)));
  const bots=[...room.members.values()].filter(m=>m.bot),humans=[...room.members.values()].filter(m=>!m.bot);for(const bot of bots)bot.nextDecision=Infinity;
  await Promise.all(pages.map(p=>p.locator('#skip-presentation').click()));await a.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.playing'));
  await freezePhysics(room);let clock=room.now();room.now=()=>clock;room.deadline=clock+120000;room.lastStep=clock;room.busy=false;
  async function advance(ms=100){while(room.busy)await delay(1);clock+=ms;await room.tick();await delay(1);}
  // Real human intents and real C simulation; no score, hole or ball-position
  // injection. One bot makes three valid short strokes and then times out.
  for(let tick=0;tick<700&&!humans.every(m=>m.ball?.hole);tick++){
    const bot=bots[0];if(bot.ball&&!bot.ball.moving&&!bot.ball.captureUntil&&bot.ball.strokes<3)await room.shot(bot,{sequence:bot.lastSequence+1,direction:[1,0,0],power:0});
    for(const human of humans)if(human.ball&&!human.ball.moving&&!human.ball.hole&&!human.ball.captureUntil){const plan=await room.physics.plan(human.slot,'expert');await room.shot(human,{sequence:human.lastSequence+1,direction:plan.direction,power:plan.power});}
    assert.equal(room.simulationSpeed,1,'no acceleration before every human finishes');await advance();
  }
  assert.ok(humans.every(m=>m.ball.hole),'both real human balls complete the course');assert.equal(bots[0].ball.strokes,3);await advance();
  assert.equal(room.simulationSpeed,5);await Promise.all(pages.map(p=>p.waitForFunction(()=>!document.getElementById('bot-speed').hidden)));
  assert.match(await b.locator('#bot-speed').textContent(),/Acelerando/);assert.match(await a.locator('#bot-speed').textContent(),/Speeding/);
  await b.reload();await b.locator('#presentation').waitFor({state:'visible',timeout:90000});await b.locator('#skip-presentation').click();
  await b.waitForFunction(()=>GolfOnline.active()&&GolfCourse.inspect().frame?.course===1&&!GolfCourse.inspect().frame.intro&&document.getElementById('loading').hidden);
  await b.waitForFunction(()=>!document.getElementById('bot-speed').hidden);assert.match(await b.locator('#bot-speed').textContent(),/Acelerando/);
  for(const bot of bots.slice(1))bot.nextDecision=0;
  for(let tick=0;tick<500&&!['results','finished'].includes(room.phase);tick++)await advance();
  assert.ok(['results','finished'].includes(room.phase));assert.equal(bots[0].scores[0],15);assert.equal(bots[0].dnf[0],true);
  assert.ok(bots.slice(1).every(m=>m.ball.hole),'remaining expert bots finish using accelerated original physics');
  await Promise.all(pages.map(p=>p.locator('#scores').waitFor({state:'visible'})));
  fs.mkdirSync('../out/bots-audio-validation',{recursive:true});
  for(const [page,name]of [[a,'desktop'],[b,'mobile']]){assert.match(await page.locator('#score-body tr').filter({hasText:'GPT-6'}).textContent(),/15 DNF/);await page.screenshot({path:`../out/bots-audio-validation/dnf-bots-${name}.png`});}
  assert.deepEqual(errors,[]);console.log('Host-only bot quantity/difficulty, AI identities, real human completion, synced 5x simulation/reconnect and strokes + 12 DNF passed on desktop/mobile.');
}finally{await browser?.close();app.close();}
