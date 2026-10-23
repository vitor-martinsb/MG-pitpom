// Existing multiplayer regressions enter through the public welcome/menu flow.
export async function enterMultiplayer(page){
  await page.locator("#home-loading").waitFor({state:"hidden",timeout:90000});
  if(await page.locator('#continue-home').isVisible())await page.locator('#continue-home').click();
  if(await page.locator('#open-multiplayer').isVisible())await page.locator('#open-multiplayer').click();
}
export async function visitMultiplayer(page,url){await page.goto(url);await enterMultiplayer(page);}
export async function reloadMultiplayer(page){await page.reload();await page.waitForFunction(()=>window.GolfCourse?.initialized,{},{timeout:90000});await enterMultiplayer(page);}
export async function openCampaign(page){
  await page.locator("#home-loading").waitFor({state:"hidden",timeout:90000});
  if(await page.locator('#level-selection').isVisible())return;
  if(await page.locator('#continue-home').isVisible())await page.locator('#continue-home').click();
  if(await page.locator('#back-main').isVisible())await page.locator('#back-main').click();
  await page.locator('#offline').click();await page.locator('#level-selection').waitFor({state:'visible'});
}
