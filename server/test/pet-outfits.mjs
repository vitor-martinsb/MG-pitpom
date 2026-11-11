import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,createLobby,lobbyTab,finishPresentation} from './navigation-fixture.mjs';
import {freezePhysics} from './room-fixture.mjs';
process.env.GOLF_HOLE_SECONDS='600';
const app=createServer();let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/INVALID_OPERATION|failed to compile|\bERROR\b/.test(m.text()))errors.push(m.text());});
 await visitMultiplayer(page,url);await createLobby(page);const room=[...app.rooms.values()][0],host=[...room.members.values()][0];
 room.configurePool(host,'custom',[0]);await lobbyTab(page,'mode');await page.locator('#room-season-theme').selectOption('christmas');await page.locator('#start').click();await finishPresentation(page);
 await page.locator('#camera-zoom').waitFor({state:'visible',timeout:90000});await page.locator('#toggle-match-info').click();
 // Rotate through the actual camera gesture before framing the trusted render fixture.
 await page.mouse.move(850,380);await page.mouse.down();await page.mouse.move(880,390,{steps:4});await page.mouse.up();await page.waitForTimeout(500);
 const source=await freezePhysics(room);
 const camera=await page.evaluate(()=>JSON.parse(Module.ccall('golf_course_frame','string',[],[])).camera),ball=source.players[0].pos;
 let facing=[camera[0]-ball[0],0,camera[2]-ball[2]],len=Math.hypot(facing[0],facing[2]);facing=facing.map(n=>n/len);const right=[facing[2],0,-facing[0]],center=source.mascots.cat;
 const offset=(base,axis,n)=>base.map((v,i)=>v+axis[i]*n);
 fs.mkdirSync('../out/pet-outfits',{recursive:true});let lastHeading;
 for(const [width,height]of [[1200,900],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(value=>Module.ccall('golf_course_zoom','number',['number'],[value]),width<600?1.3:.65);
  let index=0;
  for(const kind of [1,2])for(const pose of ['rest','walk','reaction']){
   const s=structuredClone(source),time=(2+index)*Math.PI/.95;index++;
   s.time=time;s.mascots.thirdKind=kind;s.mascots.catPhase=0;s.mascots.catActive=s.mascots.catVisible=true;s.mascots.catPresence=1;s.mascots.dogActive=s.mascots.dogVisible=false;
   s.mascots.cat=offset(center,right,-.57);s.mascots.slapTime=pose==='reaction'?time-.17:-100;
   s.players[0].pos=offset(center,facing,.30);s.players[0].pos[1]+=.12;s.players[0].vel=[0,0,0];s.players[0].moving=false;
   for(const a of s.mascots.wildlife){a.active=a.visible=a.kind===kind;a.presence=a.active?1:0;a.pos=offset(center,right,.57);a.forward=facing;a.clock=time;a.gait=pose==='rest'?0:1;a.stride=index*.8;a.speed=0;a.walking=pose==='walk';a.actionTime=pose==='reaction'?time-.17:-100;}
   room.send(host,{...s,type:'snapshot',full:true,hole:0,playStyle:'simultaneous',turn:0,turnOrder:[],remaining:500000});
   await page.waitForFunction(({kind,time})=>{const f=JSON.parse(Module.ccall('golf_course_frame','string',[],[]));return f.time>=time&&f.time<time+.4&&f.wildlife[kind].visible&&f.actorVertices>0;},{kind,time},{timeout:30000});
   await page.waitForTimeout(350);
   const f=await page.evaluate(()=>JSON.parse(Module.ccall('golf_course_frame','string',[],[])));
   assert.ok(f.actorVertices>1000&&f.actorVertices<40960);assert.equal(f.season.theme,true);
   if(lastHeading&&pose!=='rest')assert.ok(f.catForward.reduce((n,x,i)=>n+x*lastHeading[i],0)<-.99,'Pompom turns with successive half crossings');lastHeading=f.catForward;
   await page.screenshot({path:`../out/pet-outfits/${kind===1?'luna':'frida'}-${pose}-${width}x${height}.png`});
  }
 }
 const dressed=await page.evaluate(()=>JSON.parse(Module.ccall('golf_course_frame','string',[],[])).actorVertices);
 await page.evaluate(()=>Module.ccall('golf_season_settings','number',['number','number','number','number'],[0,0,0,0]));
 await page.waitForFunction(count=>JSON.parse(Module.ccall('golf_course_frame','string',[],[])).actorVertices<count-1000,dressed);
 assert.deepEqual(errors,[]);console.log('Pet outfits: Pompom forward clock, Luna/Frida torso fit in rest/walk/reaction, desktop/mobile rendering, original-theme restoration and bounded actor buffers passed.');
}finally{await browser?.close();app.close();}
