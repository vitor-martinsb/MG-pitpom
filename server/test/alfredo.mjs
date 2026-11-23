import {assertPetRoster} from './pet-roster-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import {visitMultiplayer,createLobby,joinLobby,finishPresentation} from './navigation-fixture.mjs';
import {captureAlfredo} from './alfredo-fixture.mjs';
import {companionFrame} from './companions-fixture.mjs';
const app=createServer();let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-unsafe-swiftshader']});
 fs.mkdirSync('../out/alfredo',{recursive:true});
 for(const style of ['simultaneous','turns'].filter(s=>!process.argv.includes('--turns-only')||s==='turns')){
  const mobile={viewport:{width:390,height:844},isMobile:true,hasTouch:true},desktop={viewport:{width:1280,height:800}};
  const host=await browser.newPage(style==='turns'?mobile:desktop),guest=await browser.newPage(style==='turns'?desktop:mobile),errors=[];
  const views=style==='turns'?[['mobile',host],['desktop',guest]]:[['desktop',host],['mobile',guest]];
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(e.message));
  await visitMultiplayer(host,url);await createLobby(host,{nickname:'Alfredo Host'});const room=[...app.rooms.values()].find(r=>r.phase==='lobby'),member=room.members.get(1);
  room.physicsSeed=7;room.configurePool(member,'custom',[room.levels.indexOf('data/levels/level-1.level')]);room.configure(member,1,'classic',style);
  await visitMultiplayer(guest,url);await joinLobby(guest,{code:room.code,nickname:'Mobile'});
  room.busy=true; // Advance the authority only at explicitly observed test ticks.
  await host.locator('#start').click();for(const p of [host,guest]){await finishPresentation(p);await p.waitForFunction(()=>GolfCourse.inspect().frame?.alfredoActive);}
  for(const p of [host,guest])assertPetRoster(await p.evaluate(()=>GolfCourse.inspect().frame));
  await captureAlfredo(room,member,async(m,shot)=>{
   await host.evaluate(shot=>GolfOnline.shot(shot.direction,shot.power),shot);
   for(let i=0;i<160&&m.lastSequence!==1;i++)await host.waitForTimeout(25);
   assert.equal(m.lastSequence,1);
  });
  for(const p of [host,guest]){await p.waitForFunction(()=>GolfCourse.inspect().frame.players.find(p=>p.id===1)?.captureKind===9);assert.equal(await p.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot),p===host||style==='turns'?false:true);}
  assert.equal(await host.locator('#course-status').isHidden(),true,'capture overlays leave the character visible');
  for(let beat=1;beat<=3;beat++){
   let apex=false;
   for(let i=0;i<240;i++){
    const f=await companionFrame(room,1),a=f.mascots.companions.alfredo,b=member.ball;
    if(a.state===4&&a.beats===beat&&Math.abs(b.vel[1])<.15&&b.pos[1]>a.pos[1]+.9){apex=true;break;}
   }
   assert.ok(apex,`a real 3D apex is visible for rebound ${beat}`);
   for(const [device,p]of views){
    await p.waitForFunction(beat=>GolfCourse.inspect().frame.alfredoState===4&&GolfCourse.inspect().frame.alfredoBeats===beat,beat);
    assert.ok(await p.evaluate(()=>GolfCourse.inspect().frame.actorVertices)<73728,'the shared actor mesh stays within its existing budget');
    await p.screenshot({path:`../out/alfredo/${style}-${device}-rebound-${beat}.png`});
   }
  }
  for(let i=0;i<240&&room.mascots.companions.alfredo.state!==5;i++)await companionFrame(room,1);
  assert.equal(room.mascots.companions.alfredo.beats,4);assert.equal(member.ball.captureKind,0);assert.ok(member.ball.vel[1]>3);
  for(const p of [host,guest])await p.waitForFunction(()=>GolfCourse.inspect().frame.alfredoBeats===4&&GolfCourse.inspect().frame.players.find(p=>p.id===1)?.captureKind===0);
  await companionFrame(room,30);await host.screenshot({path:`../out/alfredo/${style}-aerial-kick.png`});
  for(let i=0;i<180&&(member.ball.moving||member.ball.captureUntil);i++)await companionFrame(room,30);
  assert.equal(member.ball.captureUntil,0);assert.equal(member.ball.strokes,1);assert.equal(member.ball.moving,false);
  await host.waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).canShoot);
  const a=room.mascots.companions.alfredo;assert.ok(a.state===0||a.state===8);assert.ok(Math.hypot(...a.pos.map((x,i)=>x-a.home[i]))<.021);
  assert.deepEqual(errors,[]);await host.close();await guest.close();room.close();
  console.log(`Alfredo ${style}: real shot/capture, three airborne rebounds, fourth launch, both native clients, desktop/mobile renders and next-shot unlock passed.`);
 }
}finally{await browser?.close();app.close();}
