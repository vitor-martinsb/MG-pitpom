import {createLobby} from './navigation-fixture.mjs';
import {joinLobby} from './navigation-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {freezePhysics} from './room-fixture.mjs';
import {visitMultiplayer} from './navigation-fixture.mjs';
const app=createServer(),errors=[];let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});fs.mkdirSync('../out/juju-validation',{recursive:true});
 const pages=[];
 for(const [name,width,height,mobile]of [['desktop',1440,900,false],['mobile',390,844,true]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/INVALID_OPERATION|failed to compile/i.test(m.text()))errors.push(m.text());});
  await page.goto(url);await page.locator('#home-loading').waitFor({state:'hidden',timeout:90000});await page.locator('#continue-home').click();assert.equal(await page.locator('#meet-juju').count(),0);
  await page.waitForFunction(()=>document.querySelector('[data-pet=juju]'));
  assert.equal(await page.locator('[data-pet=juju]').getAttribute('data-source-art'),'menu-cast-reference.png');
  await page.waitForFunction(()=>GolfAudio.status().state==='running');
  const sounds=await page.evaluate(()=>{const proto=AudioContext.prototype,original=proto.createOscillator;let count=0;proto.createOscillator=function(...args){count++;return original.apply(this,args);};try{GolfAudio.play('juju');return count;}finally{proto.createOscillator=original;}});
  assert.equal(sounds,3);
  await page.screenshot({path:'../out/juju-validation/menu-'+name+'.png'});
  await page.locator('#open-multiplayer').click();await page.waitForFunction(()=>!document.getElementById('create').disabled);

 }
 const [host,guest]=pages;await createLobby(host,{color:'#ffffff'});const code=await host.locator('#room-code').textContent();
 await joinLobby(guest,{code:code,color:'#ffffff'});await guest.locator('#lobby').waitFor({state:'visible'});
 const room=app.rooms.get(code),owner=[...room.members.values()][0];room.configurePool(owner,'custom',[0]);room.configure(owner,1,'classic');
 await host.waitForFunction(()=>document.getElementById('holes').value==='1');await host.locator('#start').click();
 await Promise.all(pages.map(page=>page.waitForFunction(()=>GolfCourse.inspect().frame?.active)));
 await Promise.all(pages.map(page=>page.evaluate(()=>Module.ccall('golf_course_skip',null,[],[]))));
 await Promise.all(pages.map(page=>page.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&document.getElementById('loading').hidden)));
 const snapshot=await freezePhysics(room);assert.equal(snapshot.mascots.wildlife.length,4);
 // Isolate the new actor and clean white ball for visual inspection. Native
 // tests separately verify the real three-resident composition on all maps.
 snapshot.mascots.catVisible=snapshot.mascots.dogVisible=false;
 snapshot.time+=10;snapshot.mascots.thirdKind=3;
 for(const a of snapshot.mascots.wildlife){a.active=a.visible=a.kind===3;a.presence=a.active?1:0;}
 const juju=snapshot.mascots.wildlife[3],tee=[...snapshot.players[0].pos];juju.pos=[tee[0]+.85,tee[1]-.12,tee[2]-.8];juju.forward=[0,0,1];juju.action=4;juju.actionTime=snapshot.time-.2;juju.walking=false;
 for(const [i,ball]of snapshot.players.entries()){ball.pos=[tee[0]-i*.5,tee[1],tee[2]-.2-i*.6];ball.vel=[0,0,-2];ball.moving=true;ball.strokes=1;ball.effectKind=6;ball.effectSerial=1;ball.effectTime=snapshot.time;}
 snapshot.mascots.mudPrints=Array.from({length:8},(_,i)=>({id:i+1,pos:[tee[0]+.4+(i%2)*.2,tee[1]-.12,tee[2]-.3-i*.2],forward:[0,0,1],born:snapshot.time}));
 const send=()=>{for(const member of room.members.values())room.send(member,{...snapshot,type:'snapshot',hole:room.hole});};
 for(const amount of [3,2,1,0]){
  snapshot.time+=1;juju.actionTime=snapshot.time-.2;
  for(const ball of snapshot.players){ball.mudShots=amount;ball.mudFadeUntil=0;}
  juju.walking=true;juju.gait=1;juju.stride=amount*.9;
  send();
  for(const [i,page]of pages.entries()){
   await page.waitForFunction(({time,amount})=>{const f=GolfCourse.inspect().frame;return f.time>=time&&f.players.every(p=>p.mudShots===amount)&&f.wildlife[3].active;},{time:snapshot.time,amount});
   const frame=await page.evaluate(()=>GolfCourse.inspect().frame);assert.equal(frame.mudPrints.length,8);assert.equal(frame.wildlife[3].walking,true);assert.equal(frame.wildlife.filter(a=>a.visible).length,1);assert.ok(frame.actorVertices>0&&frame.actorVertices<24576);
   if(amount){await page.waitForFunction(()=>document.getElementById('wildlife-effect').textContent.includes(String(GolfCourse.inspect().frame.players[0].mudShots)));}
   else await page.waitForFunction(()=>!document.getElementById('wildlife-effect').textContent.includes('juju.muddy'));
   await page.screenshot({path:`../out/juju-validation/mud-${amount}-${i?'mobile':'desktop'}.png`});
  }
 }
 // Exercise the exact poses in which paws used to detach, including the old
 // resting/walking threshold and a side view of shoulders and rear hips.
 for(const [name,gait,stride,age,forward]of [
  ['resting',0,0,2,[0,0,1]],['transition',.005,.8,2,[1,0,0]],
  ['walking',1,2.1,2,[1,0,0]],['swiping',0,0,.2,[0,0,1]]]){
  snapshot.time+=1;juju.actionTime=snapshot.time-age;juju.action=age<1?4:0;
  juju.walking=gait>0;juju.gait=gait;juju.stride=stride;juju.speed=0;juju.forward=forward;
  send();
  for(const [i,page]of pages.entries()){
   await page.waitForFunction(({time,gait})=>{const f=GolfCourse.inspect().frame;return f.time>=time&&Math.abs(f.wildlife[3].gait-gait)<.0001;},{time:snapshot.time,gait});
   const frame=await page.evaluate(()=>GolfCourse.inspect().frame);assert.ok(frame.actorVertices>0&&frame.actorVertices<24576);
   await page.screenshot({path:`../out/juju-validation/connected-paws-${name}-${i?'mobile':'desktop'}.png`});
  }
 }
 // Both client renderers consume the same authoritative animal/effect state.
 const state=await Promise.all(pages.map(p=>p.evaluate(()=>{const f=GolfCourse.inspect().frame;return {wildlife:f.wildlife,mudPrints:f.mudPrints,balls:f.players.map(p=>({id:p.id,mud:p.mudShots})).sort((a,b)=>a.id-b.id)};})));assert.deepEqual(state[0],state[1]);
 assert.deepEqual(errors,[]);console.log('Juju: vector menu Juju on desktop/mobile, two-client shared animal, connected resting/transition/walking/swiping paws and shared muddy footprints, muddy clumps 3/2/1/0, HUD and finite WebGL buffers passed.');
}finally{await browser?.close();app.close();}
