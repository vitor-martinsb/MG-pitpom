import { chromium } from '@playwright/test';
import { createServer } from '../dist/index.js';
import assert from 'node:assert/strict';

const app=createServer();
let browser;
try {
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  await page.waitForFunction(()=>!document.getElementById('create').disabled,{},{timeout:90000});
  // fill() bypasses key events and cannot catch the engine swallowing typing.
  const nickname=page.locator('#nickname');
  await nickname.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Vitor');
  assert.equal(await nickname.inputValue(),'Vitor');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('r Golf');
  assert.equal(await nickname.inputValue(),'Vitor Golf');
  await page.keyboard.press('Home');
  await page.keyboard.press('Delete');
  assert.equal(await nickname.inputValue(),'itor Golf');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'color');
  const code=page.locator('#join-code');
  await code.click();
  await page.keyboard.type('RD7K2');
  assert.equal(await code.inputValue(),'RD7K2');
  await nickname.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Vitor Golf');
  await page.locator('#create').click();
  await page.locator('#lobby').waitFor({state:'visible'});
  assert.equal([...app.rooms.values()][0].members.get(1).nickname,'Vitor Golf');
  await page.locator('#start').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent==='Tacadas simultâneas',{},{timeout:30000});
  await page.locator('#canvas').focus();
  await page.keyboard.down('Tab');
  await page.locator('#scores').waitFor({state:'visible'});
  await page.keyboard.up('Tab');
  await page.locator('#scores').waitFor({state:'hidden'});
  console.log('Profile keyboard: typing, selection, deletion, focus navigation, room code, saved nickname and game Tab passed.');
} finally {
  await browser?.close();
  app.close();
}
