import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';

const app=createServer(),errors=[];let browser;
const out='../out/bots-audio-validation';
function wav(pcm,rate){const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);}
try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});fs.mkdirSync(out,{recursive:true});
  const pages=[];
  for(const [name,width,height,mobile]of [['desktop',1200,900,false],['mobile',390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();pages.push(page);
    page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});
    await page.evaluate(()=>{document.getElementById('connect').hidden=true;document.getElementById('loading').hidden=false;});
    await page.waitForTimeout(150);
    const seen=[new Set(),new Set()];let last;
    for(let sample=0;sample<32;sample++){
      const state=await page.evaluate(()=>{
        const chase=document.querySelector('#loading .mascot-chase'),bounds=chase.getBoundingClientRect();
        return {ring:chase.querySelectorAll('.chase-ring,.chase-orbit').length,pets:[...chase.querySelectorAll('.mascot-run')].map(p=>{
          const r=p.getBoundingClientRect(),u=p.querySelector('use');return {name:p.classList.contains('pituca')?'pituca':'pompom',x:r.x,y:r.y,w:r.width,h:r.height,href:u.getAttribute('href'),frames:p.querySelectorAll('use').length,cx:(r.x+r.width/2-bounds.x)/bounds.width,cy:(r.y+r.height/2-bounds.y)/bounds.height};
        })};
      });
      assert.equal(state.ring,0);assert.equal(state.pets.length,2);
      const [dog,cat]=state.pets;assert.equal(dog.name,'pituca');assert.equal(cat.name,'pompom');
      for(const [i,p]of state.pets.entries()){
        assert.equal(p.frames,1);assert.ok(p.w>0&&p.h>0);const frame=Number(p.href.split('-').at(-1));assert.ok(i===0?frame>=8&&frame<16:frame>=0&&frame<8);seen[i].add(frame);
      }
      const overlap=Math.min(dog.x+dog.w,cat.x+cat.w)>Math.max(dog.x,cat.x)&&Math.min(dog.y+dog.h,cat.y+cat.h)>Math.max(dog.y,cat.y);
      assert.equal(overlap,false,`${name}: separate sprites at sample ${sample}`);
      assert.ok(Math.abs(dog.cx+cat.cx-1)<.025&&Math.abs(dog.cy+cat.cy-1)<.025,'stable opposite positions on the chase');
      if(last)assert.ok(Math.hypot(dog.cx-last.cx,dog.cy-last.cy)<.15,'continuous travel');last=dog;
      if(sample===15){await page.setViewportSize({width:mobile?844:1000,height:mobile?390:760});last=null;}
      await page.waitForTimeout(110);
    }
    assert.equal(seen[0].size,8);assert.equal(seen[1].size,8);
    await page.screenshot({path:`${out}/loading-${name}.png`});
    await page.evaluate(()=>{document.getElementById('loading').hidden=true;document.getElementById('connect').hidden=false;});
    console.log(`${name}: independent eight-frame runs, spacing, continuous orbit, resize and no dotted lines passed.`);
  }
  const page=pages[0];await page.locator('#music-controls summary').click();await page.waitForFunction(()=>GolfMusic.status().state==='running');
  const hashes=new Set(),metrics=[];
  for(let world=1;world<=10;world++){
    const audio=await page.evaluate(async world=>{
      const score=PitPomLofi.scores[world],cycle=Math.max(score.chords.length*4,score.melody.length)*60/score.bpm,buffer=await GolfMusic.renderPreview(world,cycle+2),data=buffer.getChannelData(0),pcm=new Int16Array(data.length);let sum=0,peak=0,delta=0,seam=0,seamCount=0;
      for(let i=0;i<data.length;i++){sum+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));pcm[i]=Math.round(Math.max(-1,Math.min(1,data[i]))*32767);if(Math.abs(i-buffer.sampleRate*cycle)<buffer.sampleRate*.1){seam+=data[i]*data[i];seamCount++;if(i)delta=Math.max(delta,Math.abs(data[i]-data[i-1]));}}
      const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
      return {pcm:btoa(binary),rate:buffer.sampleRate,rms:Math.sqrt(sum/data.length),peak,seamRms:Math.sqrt(seam/seamCount),seamDelta:delta,bpm:score.bpm,cycle};
    },world);
    const pcm=Buffer.from(audio.pcm,'base64'),hash=crypto.createHash('sha256').update(pcm).digest('hex');hashes.add(hash);
    assert.ok(audio.rms>.0001&&audio.rms<.15&&audio.peak<.5,`balanced audible instrumental, world ${world}: ${audio.rms}`);
    assert.ok(audio.seamRms>.00001&&audio.seamDelta<.06,`continuous musical loop, world ${world}`);
    fs.writeFileSync(`${out}/world-${world}.wav`,wav(pcm,audio.rate));delete audio.pcm;metrics.push({world,...audio,hash});
  }
  assert.equal(hashes.size,10);fs.writeFileSync(`${out}/music-metrics.json`,JSON.stringify(metrics,null,2));
  await page.evaluate(()=>GolfMusic.world(1));await page.waitForTimeout(1200);const before=await page.evaluate(()=>GolfMusic.status());
  await page.evaluate(()=>{for(let i=0;i<10;i++)GolfMusic.world(1);});await page.waitForTimeout(1200);const same=await page.evaluate(()=>GolfMusic.status());
  assert.equal(before.switches,same.switches);assert.ok(same.beat>before.beat,'same-world maps preserve the musical cursor');
  await page.evaluate(()=>GolfMusic.world(2));assert.ok((await page.evaluate(()=>GolfMusic.status())).layers>=2,'crossfade retains the outgoing layer');
  await page.waitForTimeout(2000);assert.ok(await page.evaluate(()=>GolfMusic.level()>0.00001));
  await page.locator('#toggle-music').click();await page.waitForFunction(()=>GolfMusic.level()<.00001);assert.equal(await page.evaluate(()=>GolfMusic.status().enabled),false);
  await page.reload();await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});assert.equal(await page.evaluate(()=>GolfMusic.status().enabled),false);
  assert.deepEqual(errors,[]);console.log('Ten distinct original soundtracks: audible balanced waveforms, continuous loops, crossfade, persistent mute and no same-world restart passed.');
}finally{await browser?.close();app.close();}
