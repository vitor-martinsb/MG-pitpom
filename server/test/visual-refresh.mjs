import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {freezePhysics} from './room-fixture.mjs';
const app=createServer(),errors=[];let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
 const contexts=await Promise.all([browser.newContext({viewport:{width:1200,height:900}}),browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})]);
 const pages=await Promise.all(contexts.map(c=>c.newPage())),[a,b]=pages;
 for(const p of pages){p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  await p.evaluate(async()=>{for(const weight of [400,500,600,700])await document.fonts.load(`${weight} 16px Poppins`);});
  assert.ok(await p.evaluate(()=>[...document.fonts].filter(f=>f.family==='Poppins').every(f=>f.status==='loaded')));
  for(const selector of ['body','#create','#nickname','#music-controls'])assert.match(await p.locator(selector).evaluate(e=>getComputedStyle(e).fontFamily),/Poppins/);
  await p.evaluate(()=>{window.mapTextCalls=0;const canvas=document.getElementById('minimap-canvas'),c=canvas.getContext('2d');c.fillText=()=>window.mapTextCalls++;c.strokeText=()=>window.mapTextCalls++;});
 }
 await a.locator('#nickname').fill('Visual Host');await a.locator('#create').click();await a.locator('#lobby').waitFor({state:'visible'});
 const room=[...app.rooms.values()][0];await b.locator('#nickname').fill('Mobile');await b.locator('#join-code').fill(room.code);await b.locator('#join').click();await b.locator('#lobby').waitFor({state:'visible'});
 await a.locator('#start').click();await Promise.all(pages.map(p=>p.locator('#presentation').waitFor({state:'visible'})));
 room.selectedLevels=[10];room.holes=1;room.hole=0;await room.load();
 await Promise.all(pages.map(p=>p.waitForFunction(()=>GolfCourse.inspect().frame?.course===11&&GolfCourse.inspect().frame.intro)));
 await Promise.all(pages.map(p=>p.locator('#skip-presentation').click()));
 await Promise.all(pages.map(p=>p.waitForFunction(()=>GolfCourse.inspect().frame.active&&!GolfCourse.inspect().frame.intro&&document.getElementById('loading').hidden)));
 fs.mkdirSync('../out/visual-refresh',{recursive:true});
 for(const [p,name]of [[a,'desktop'],[b,'mobile']]){
  await p.waitForTimeout(200);
  assert.equal((await p.locator('#minimap').textContent()).trim(),'');assert.equal(await p.evaluate(()=>window.mapTextCalls),0);
  const map=await p.locator('#minimap').boundingBox(),status=await p.locator('#course-status').boundingBox();assert.ok(status.y+status.height<=map.y-4,'labels remain visibly outside the minimap');
  assert.equal(await p.locator('#minimap svg text').count(),0);
  assert.ok(await p.evaluate(()=>new Set(document.getElementById('minimap-canvas').getContext('2d').getImageData(0,0,240,240).data).size>20));
  const f=await p.evaluate(()=>GolfCourse.inspect().frame);assert.ok(f.actorVertices>0&&f.actorVertices<24576);
  await p.screenshot({path:`../out/visual-refresh/forest-${name}.png`});
 }
 const frame=await freezePhysics(room),romeu=frame.mascots.wildlife[0];assert.equal(romeu.active,true);
 // Renderer fixture only: trusted snapshots are used to check replication of
 // every puddle state. Native tests exercise creation and real shot counting.
 for(const remaining of [3,2,1,0]){
  const snapshot=structuredClone(frame);snapshot.mascots.puddles=remaining?[{id:42,pos:romeu.pos,born:7,remaining}]:[];snapshot.mascots.acceptedShots=10-remaining;
  for(const p of pages)room.send([...room.members.values()].find(m=>m.nickname===(p===a?'Visual Host':'Mobile')),{...snapshot,type:'snapshot',full:true,hole:0});
  for(const p of pages)await p.waitForFunction(n=>{const f=JSON.parse(Module.ccall('golf_course_frame','string',[],[]));return n?f.puddles?.[0]?.remaining===n:f.puddles?.length===0;},remaining);
 }
 // A player's debuff persists independently of whether the puddle still exists.
 for(const remaining of [3,2,1,0]){
  const snapshot=structuredClone(frame);snapshot.mascots.puddles=[];
  snapshot.players[0].slowShots=remaining;snapshot.players[0].slowUntil=remaining?frame.time+100:0;
  snapshot.players[1].slowShots=0;snapshot.players[1].slowUntil=0;
  for(const p of pages)room.send([...room.members.values()].find(m=>m.nickname===(p===a?'Visual Host':'Mobile')),{...snapshot,type:'snapshot',full:true,hole:0});
  for(const p of pages)await p.waitForFunction(n=>{
   const f=JSON.parse(Module.ccall('golf_course_frame','string',[],[]));
   return f.players[0].slowShots===n&&f.players[1].slowShots===0&&f.puddles.length===0;
  },remaining);
 }
 // Close-up of the same geometry used in play, without changing the animal's
 // physical location. Move only the trusted renderer's observed local ball.
 const closeup=structuredClone(frame);closeup.mascots.catActive=closeup.mascots.dogActive=false;
 closeup.mascots.wildlife.slice(1).forEach(x=>x.active=false);romeu.forward=[0,0,1];
 closeup.mascots.wildlife[0].forward=[0,0,1];closeup.players[0].pos=[romeu.pos[0]+.4,romeu.pos[1]+.12,romeu.pos[2]+1];
 closeup.players[0].moving=false;closeup.players[0].firstComplete=true;
 room.send([...room.members.values()][0],{...closeup,type:'snapshot',full:true,hole:0});await a.waitForTimeout(600);
 await a.screenshot({path:'../out/visual-refresh/romeu.png'});
 for(let angle=1;angle<=3;angle++){
  await a.mouse.move(1050,650);await a.mouse.down();await a.mouse.move(500,650,{steps:10});await a.mouse.up();await a.waitForTimeout(200);
  await a.screenshot({path:`../out/visual-refresh/romeu-angle-${angle}.png`});
 }
 for(const [kind,name]of [[1,'luna'],[2,'frida']]){
  const pose=structuredClone(frame),animal=pose.mascots.wildlife[kind];
  assert.ok(animal.active,`${name} has a safe patrol`);
  pose.mascots.catActive=pose.mascots.dogActive=false;
  pose.mascots.wildlife.forEach((x,i)=>{x.active=i===kind;x.forward=[0,0,1];});
  pose.players[0].pos=[animal.pos[0]+.4,animal.pos[1]+.12,animal.pos[2]+1];
  pose.players[0].moving=false;pose.players[0].firstComplete=true;
  room.send([...room.members.values()][0],{...pose,type:'snapshot',full:true,hole:0});await a.waitForTimeout(600);
  await a.screenshot({path:`../out/visual-refresh/${name}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Poppins four weights, clean minimap, forest, Luna/Frida reference models and puddle replication passed on desktop/mobile.');
}finally{await browser?.close();app.close();}
