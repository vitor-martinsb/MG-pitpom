import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';

const urlIndex=process.argv.indexOf('--url');
const app=urlIndex<0?createServer():null;
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
    await page.goto(url);
    await page.waitForFunction(()=>{const image=document.querySelector('.garden-header img');return image?.complete&&image.naturalWidth===1774;});
    const image=page.locator('.garden-header img');
    assert.equal(await image.evaluate(e=>e.naturalHeight),887);
    assert.equal(await image.evaluate(e=>getComputedStyle(e).objectFit),'contain');
    const bounds=await image.boundingBox();assert.ok(bounds.width>100&&bounds.height>60);
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width);
    await page.screenshot({path:`../out/mascot-validation/${name}.png`});
    await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
    await page.locator('#nickname').fill('Pituca & Pompom');
    assert.equal(await page.locator('#nickname').inputValue(),'Pituca & Pompom');
    await page.locator('#create').click();await page.locator('#lobby').waitFor({state:'visible'});
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Mascot artwork: identical served PNG, complete image, desktop/mobile layout and accessible nickname/create controls passed.');
}finally{await browser?.close();app?.close();}
