import { chromium } from '@playwright/test';
import { createServer } from '../dist/index.js';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocket } from 'ws';

process.env.GOLF_HOLE_SECONDS='120';
const app=createServer();
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const address=app.server.address(),url=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const pages=[],errors=[],bots=[];
try{
  for(let i=0;i<5;i++){
    const context=await browser.newContext({viewport:{width:1100,height:720}}),page=await context.newPage();pages.push(page);
    page.on('pageerror',error=>{errors.push(String(error));console.log('PAGE ERROR:',String(error));});page.on('console',message=>{if(process.env.GOLF_BROWSER_VERBOSE||message.type()==='error'||message.text().includes('WARNING'))console.log('BROWSER:',message.type(),message.text());});
    await page.goto(url);await page.locator('#create').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
    await page.locator('#nickname').fill(`Browser${i+1}`);await page.locator('#color').fill(['#ff0000','#0000ff','#00ff00','#ffff00','#ff00ff'][i]);
    if(!i)await page.locator('#create').click();else{await page.locator('#join-code').fill([...app.rooms.keys()][0]);await page.locator('#join').click();}
    await page.locator('#lobby').waitFor({state:'visible'});console.log('Joined browser',i+1);
  }
  const room=[...app.rooms.values()][0];assert.equal(room.members.size,5);
  await pages[0].locator('#start').click();
  await pages[0].waitForFunction(()=>document.getElementById('status').textContent==='Tacadas simultâneas',{},{timeout:30000});
  assert.equal(room.phase,'playing');assert.ok([...room.members.values()].every(m=>m.ready));
  const diagnostics=await pages[0].evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])));
  assert.equal(diagnostics.players.length,5);assert.deepEqual(diagnostics.players[0].slice(8),[1,0,0]);
  const [x,y]=diagnostics.screen;
  await pages[0].mouse.move(x,y);await pages[0].mouse.down();await new Promise(resolve=>setTimeout(resolve,150));
  await pages[0].mouse.move(x,y+180,{steps:10});await new Promise(resolve=>setTimeout(resolve,150));await pages[0].mouse.up();
  await new Promise(resolve=>setTimeout(resolve,1200));
  assert.equal(room.members.get(1).ball.strokes,1);assert.equal(room.members.get(2).ball.strokes,0);
  assert.notDeepEqual(room.members.get(1).ball.pos,room.members.get(2).ball.pos);
  await pages[0].keyboard.down('Tab');await pages[0].locator('#scores').waitFor({state:'visible'});assert.equal(await pages[0].locator('#score-body tr').count(),5);await pages[0].keyboard.up('Tab');
  await pages[0].setViewportSize({width:850,height:600});
  fs.mkdirSync(path.resolve('../out/multiplayer-validation'),{recursive:true});
  await pages[0].screenshot({path:path.resolve('../out/multiplayer-validation/five-players.png')});
  await pages[0].reload();await pages[0].waitForFunction(()=>document.getElementById('status').textContent==='Tacadas simultâneas',{},{timeout:90000});
  assert.equal(room.members.size,5);assert.equal(room.members.get(1).nickname,'Browser1');assert.equal(room.members.get(1).ball.strokes,1);
  assert.deepEqual(errors,[]);
  console.log('Five real WebGL clients: loaded, ready, authoritative shot, scoreboard, resize and reconnect passed.');
  for(let i=1;i<5;i++)await pages[i].evaluate(i=>window.GolfOnline.shot([Math.sin((i-2.5)*.6),0,-Math.cos((i-2.5)*.6)],.13),i);
  await new Promise(resolve=>setTimeout(resolve,1400));
  await pages[4].screenshot({path:path.resolve('../out/multiplayer-validation/five-colors.png')});
  assert.ok([...room.members.values()].every(m=>m.ball.strokes===1));

  await pages[0].locator('#leave').click();await pages[0].locator('#nickname').fill('FiftyHost');await pages[0].locator('#create').click();
  await pages[0].locator('#lobby').waitFor({state:'visible'});
  const fifty=[...app.rooms.values()].find(r=>r!==room),code=fifty.code;
  for(let i=1;i<50;i++)await new Promise((resolve,reject)=>{
    const socket=new WebSocket(url.replace('http','ws')+'/ws');bots.push(socket);
    socket.on('error',reject);
    socket.on('open',()=>socket.send(JSON.stringify({type:'join',code,nickname:`Load${i}`,color:'#00ff00',avatar:i%8})));
    socket.on('message',data=>{const m=JSON.parse(data.toString());if(m.type==='welcome')resolve();if(m.type==='load')socket.send(JSON.stringify({type:'ready',hole:m.hole}));if(m.type==='error')reject(Error(m.message));});
  });
  await pages[0].locator('#start').click();await pages[0].waitForFunction(()=>document.getElementById('status').textContent==='Tacadas simultâneas',{},{timeout:30000});
  await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).players.length===50);
  assert.equal(fifty.members.size,50);
  await pages[0].keyboard.down('Tab');assert.equal(await pages[0].locator('#score-body tr').count(),50);await pages[0].keyboard.up('Tab');
  await pages[0].screenshot({path:path.resolve('../out/multiplayer-validation/fifty-overlapping.png')});
  assert.deepEqual(errors,[]);console.log('One WebGL client plus 49 WebSocket clients: 50 balls, coincident labels and scrolling scoreboard passed.');
  await pages[0].locator('#leave').click();await pages[0].locator('#offline').click();
  assert.equal(await pages[0].evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).active),false);
  await new Promise(resolve=>setTimeout(resolve,1000));
  await pages[0].screenshot({path:path.resolve('../out/multiplayer-validation/offline-return.png')});
  await pages[0].mouse.click(425,450);await new Promise(resolve=>setTimeout(resolve,300));await pages[0].mouse.click(247,208);
  await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===2,{},{timeout:15000});
  const offline=await pages[0].evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])));
  assert.equal(offline.players.length,1);
  const [ox,oy]=offline.screen;
  await pages[0].mouse.move(ox,oy);await pages[0].mouse.down();await new Promise(resolve=>setTimeout(resolve,150));await pages[0].mouse.move(ox,oy+80,{steps:8});await new Promise(resolve=>setTimeout(resolve,150));await pages[0].mouse.up();
  await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===4);
  await pages[0].mouse.click(783,67);await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===7);
  await pages[0].mouse.click(425,342);await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===2,{},{timeout:15000});
  const retried=await pages[0].evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])));
  assert.deepEqual(retried.players[0].slice(2,5),offline.players[0].slice(2,5));
  await pages[0].mouse.click(783,67);await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===7);
  await pages[0].mouse.click(425,250);await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===2);
  await pages[0].mouse.click(783,67);await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===7);
  await pages[0].mouse.click(425,433);await pages[0].waitForFunction(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).state===0);
  assert.deepEqual(errors,[]);console.log('Offline flow after online: level select, aim/shot, pause, retry, resume and exit passed.');
}catch(error){console.log('FAILED:',String(error));for(const page of pages){console.log(await page.title());await page.screenshot({path:path.resolve('../out/browser-failed.png')}).catch(()=>{});}throw error;}finally{for(const bot of bots)bot.terminate();await browser.close();app.close();}
