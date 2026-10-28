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

// All multiplayer regression fixtures use the same public entry and lobby UI.
export async function lobbyTab(page,name){
 if(await page.locator('#tab-'+name).getAttribute('aria-selected')!=='true')await page.locator('#tab-'+name).click();
}
export async function customizePlayer(page,profile){
 await lobbyTab(page,'players');
 if(!await page.locator('#profile-editor').evaluate(e=>e.open))await page.locator('#profile-editor summary').click();
 if(profile.nickname!==undefined)await page.locator('#nickname').fill(profile.nickname);
 if(profile.color!==undefined)await page.locator('#color').fill(profile.color);
 if(profile.avatar!==undefined)await page.locator('#avatar').selectOption(String(profile.avatar));
 await page.locator('#save-profile').click();
 await page.waitForFunction(p=>{const saved=JSON.parse(localStorage.getItem('golf-profile'));return Object.entries(p).every(([k,v])=>saved?.[k]===v)&&!document.getElementById('save-profile').disabled;},profile);
 await page.locator('#profile-editor summary').click();
}
export async function createLobby(page,profile={}){
 await page.locator('#create').click();await page.locator('#lobby').waitFor({state:'visible'});
 if(Object.keys(profile).length)await customizePlayer(page,profile);
}
export async function joinLobby(page,{code,nickname,...profile}){
 await page.locator('#open-join').click();await page.locator('#join-code').fill(code);
 if(nickname!==undefined)await page.locator('#join-nickname').fill(nickname);
 await page.locator('#join').click();await page.locator('#lobby').waitFor({state:'visible'});
 if(Object.keys(profile).length)await customizePlayer(page,profile);
}
export async function selectLobbyMode(page,mode){
 await lobbyTab(page,'mode');await page.locator(`[data-mode="${mode}"]`).click();
 await page.waitForFunction(mode=>document.querySelector(`[data-mode="${mode}"]`).getAttribute('aria-pressed')==='true',mode);
}
export async function fillBotCount(page,count){
 await lobbyTab(page,'players');
 if(!await page.locator('.bot-bulk').evaluate(e=>e.open))await page.locator('.bot-bulk summary').click();
 await page.locator('#bot-count').fill(count);
}
export async function showBotRoster(page){
 await lobbyTab(page,'players');
 if(!await page.locator('#bot-roster').evaluate(e=>e.open))await page.locator('#bot-roster>summary').click();
}
