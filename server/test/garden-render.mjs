import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=createServer();let browser;
try {
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1100,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.gardenGLErrors=[];
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){
      const gl=original.apply(this,args);
      if(gl&&args[0]==='webgl2'&&!gl.__gardenChecked){
        gl.__gardenChecked=true;
        const compile=gl.compileShader,link=gl.linkProgram;
        gl.compileShader=function(shader){compile.call(this,shader);if(!this.getShaderParameter(shader,this.COMPILE_STATUS))gardenGLErrors.push(this.getShaderInfoLog(shader));};
        gl.linkProgram=function(program){link.call(this,program);if(!this.getProgramParameter(program,this.LINK_STATUS))gardenGLErrors.push(this.getProgramInfoLog(program));};
      }
      return gl;
    };
  });
  await page.goto(url);await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  await page.locator('#nickname').fill('GardenTester');await page.locator('#create').click();await page.locator('#lobby').waitFor({state:'visible'});
  await page.locator('#start').click();
  const room=[...app.rooms.values()][0],counts=[];
  await page.waitForFunction(()=>document.getElementById('status').textContent===GolfI18n.t('phase.playing'),{},{timeout:30000});
  room.selectedLevels=Array.from({length:20},(_,i)=>i*4);room.holes=20;room.hole=0;await room.load();
  fs.mkdirSync('../out/garden-validation',{recursive:true});
  for(let index=0;index<20;index++){
    // Exercise original maps directly through the server test fixture, preserving production rules.
    if(index){room.hole=index;room.holes=20;await room.load();}
    await page.waitForFunction(index=>{
      const d=JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[]));
      return d.state===2&&document.getElementById('status').textContent===GolfI18n.t('phase.playing');
    },index,{timeout:30000});
    await page.waitForTimeout(200);
    const vertices=await page.evaluate(()=>Module.ccall('golf_garden_vertex_count','number',[],[]));
    assert.ok(vertices>0&&vertices<=72000,`Map ${index+1} stays within the decoration budget`);
    assert.equal(vertices%3,0);
    counts.push({map:index+1,vertices});
    if([0,9,19].includes(index))await page.screenshot({path:`../out/garden-validation/course-${index+1}.png`});
    assert.deepEqual(await page.evaluate(()=>gardenGLErrors),[]);
  }
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(250);await page.screenshot({path:'../out/garden-validation/garden-portrait.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('../out/garden-validation/geometry-budget.json',JSON.stringify(counts,null,2));
  console.log('All 20 original maps render without shader errors; decoration buffers stay within 72,000 vertices.');
}finally{await browser?.close();app.close();}
