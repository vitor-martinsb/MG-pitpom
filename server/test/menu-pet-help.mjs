import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {createServer} from '../dist/index.js';

const app=createServer(),errors=[];let browser;
const pets=['luna','romeu','frida','maritaca','pituca','pompom','juju'];
try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${app.server.address().port}`;
  browser=await chromium.launch({...(process.env.CI?{}:{channel:'chrome'}),headless:true,args:['--enable-unsafe-swiftshader']});
  fs.mkdirSync('../out/menu-pet-help',{recursive:true});
  for(const [device,width,height,touch]of [['desktop',1280,900,false],['mobile',390,844,true]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.locator('#continue-home').click({timeout:90000});await page.locator('#main-menu').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-pet-help]').count(),7);
    assert.equal(await page.locator('#main-menu button').count(),3);
    const tooltip=page.locator('#menu-pet-tooltip');assert.equal(await tooltip.isHidden(),true);
    for(const language of ['en','pt-BR','es']){
      await page.evaluate(language=>GolfI18n.setLanguage(language),language);
      for(const pet of pets){
        const button=page.locator(`[data-pet-help="${pet}"]`),bounds=await button.boundingBox();
        assert.ok(bounds.width>20&&bounds.height>20,`${pet} has a usable target on ${device}`);
        const options={position:{x:bounds.width*.5,y:bounds.height*.25}};
        if(touch)await button.tap(options);else await button.hover(options);
        assert.equal(await button.evaluate(button=>getComputedStyle(button).backgroundColor),'rgba(0, 0, 0, 0)','interactive regions never cover the artwork');
        await tooltip.waitFor({state:'visible'});assert.equal(await tooltip.getAttribute('data-pet'),pet);
        const expected=await page.evaluate(pet=>[GolfI18n.t(`pet.${pet}.name`),GolfI18n.t(`pet.${pet}.description`)],pet);
        assert.equal(await tooltip.locator('strong').textContent(),expected[0]);assert.equal(await tooltip.locator('span').textContent(),expected[1]);
        assert.equal(await button.getAttribute('aria-label'),expected[0]);assert.equal(await button.getAttribute('aria-describedby'),'menu-pet-tooltip');
        const box=await tooltip.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,`${pet} tooltip stays in the viewport`);
        if(pet==='maritaca')assert.equal(expected[0],'Cocota');
        if(pet==='juju')await page.screenshot({path:`../out/menu-pet-help/${device}-${language}.png`});
        if(touch){await button.tap(options);await tooltip.waitFor({state:'hidden'});}
      }
    }
    // Update an already open description immediately when the language changes.
    const bird=page.locator('[data-pet-help="maritaca"]');await bird.focus();
    await page.keyboard.press('Enter');await tooltip.waitFor({state:'visible'});
    await page.evaluate(()=>GolfI18n.setLanguage('pt-BR'));
    assert.equal(await tooltip.locator('span').textContent(),await page.evaluate(()=>GolfI18n.t('pet.maritaca.description')));
    await page.keyboard.press('Escape');await tooltip.waitFor({state:'hidden'});
    await bird.click();await tooltip.waitFor({state:'visible'});
    await page.locator('#open-multiplayer').click();await page.locator('#connect').waitFor({state:'visible'});await tooltip.waitFor({state:'hidden'});
    await page.locator('#back-main').click();await page.locator('#main-menu').waitFor({state:'visible'});
    if(touch){
      await page.setViewportSize({width:844,height:390});
      await page.waitForFunction(()=>GolfHome.scene.layout==='landscape');
      await page.setViewportSize({width,height});await page.waitForFunction(()=>GolfHome.scene.layout==='portrait');
      assert.equal(await page.locator('[data-pet-help]').count(),7);
      await page.locator('[data-pet-help="juju"]').tap();await tooltip.waitFor({state:'visible'});assert.equal(await tooltip.locator('strong').textContent(),'Juju');
    }
    await page.locator('#exit-game').click();await page.locator('#continue-home').waitFor({state:'visible'});await tooltip.waitFor({state:'hidden'});
    assert.equal(await page.locator('[data-pet-help="pituca"]').isVisible(),false);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Seven animal descriptions: desktop hover, mobile touch, EN/PT/ES, live translation, keyboard/Escape, viewport bounds, rotation and multiplayer/exit navigation passed. Cocota named in every language.');
}finally{await browser?.close();app.close();}
