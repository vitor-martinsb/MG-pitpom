import {createLobby} from './navigation-fixture.mjs';
import {visitMultiplayer,reloadMultiplayer,openCampaign} from './navigation-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const urlIndex=process.argv.indexOf('--url');
const app=urlIndex<0?(await import('../dist/index.js')).createServer():null;
let browser;
try{
  if(app)await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=app?`http://127.0.0.1:${app.server.address().port}`:process.argv[urlIndex+1];
  const response=await fetch(url+'/art/pit-and-pom.png');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(fs.readFileSync('../build/emscripten/art/pit-and-pom.png')).digest('hex'));
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  fs.mkdirSync('../out/mascot-validation',{recursive:true});
  for(const [name,viewport,touch] of [['desktop',{width:1100,height:900},false],['portrait',{width:390,height:844},true],['landscape',{width:844,height:390},true]]){
    const context=await browser.newContext({viewport,isMobile:touch,hasTouch:touch}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await visitMultiplayer(page,url);
    assert.equal(await page.locator('#connect .garden-header,#connect img').count(),0);
    const panel=await page.locator('#connect .panel').boundingBox();
    assert.ok(panel.width>100&&panel.x>=0&&panel.x+panel.width<=viewport.width);
    await page.screenshot({path:`../out/mascot-validation/${name}.png`});
    await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
    await createLobby(page,{nickname:'Pituca & Pompom'});
    assert.equal(await page.locator('#profile-display-name').textContent(),'Pituca & Pompom');
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Multiplayer: existing art asset preserved, decorative header removed, desktop/mobile layout and accessible nickname/create controls passed.');
}finally{await browser?.close();app?.close();}
