import assert from 'node:assert/strict';
export async function exerciseTutorial(page,{width,height,touch=false,webkit=false,win=false}){
 await page.setViewportSize({width,height});
 const before=await page.evaluate(()=>({scores:JSON.parse(Module.ccall('golf_ui_level_selection','string',[],[])),profile:JSON.parse(Module.ccall('golf_ui_solo_profile','string',[],[]))}));
 await page.evaluate(()=>Module.ccall('golf_course_zoom','number',['number'],[1.3]));
 await page.locator('#open-tutorial').click();await page.waitForFunction(()=>GolfTutorial.ready&&GolfCourse.inspect().frame.tutorial,{},{timeout:90000});
 assert.equal(await page.locator('#tutorial-step').textContent(),'Etapa 1 de 6');
 assert.equal(await page.locator('#tutorial svg,#tutorial-pet,#tutorial-demo').count(),0,'the rehearsal is a real native field, not a second illustration/physics');
 const f=await page.evaluate(()=>GolfCourse.inspect().frame);
 assert.equal(f.level,-1);assert.equal(f.catActive,false);assert.equal(f.dogActive,false);assert.equal(f.beneditaActive,false);assert.equal(f.smanataActive,false);assert.equal(f.alfredoActive,false);assert.ok(f.wildlife.every(a=>!a.active&&!a.visible));assert.equal(f.wind.length,0);assert.equal(f.season.enabled,false);
 assert.equal(f.zoom,1);await page.locator('#camera-zoom').waitFor({state:'visible'});
 assert.match(await page.locator('#tutorial-copy').textContent(),touch?/Toque/:/botão esquerdo/);
 await page.locator('#tutorial-next').click();assert.equal(await page.locator('#tutorial-step').textContent(),'Etapa 2 de 6');
 await page.locator('#tutorial-practice').click();assert.equal(await page.locator('.tutorial-details').isHidden(),true);
 await page.waitForTimeout(150);
 const [x,y]=await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).screen);
 const drag=(100+320*.26)*height/(1.777*720);
 const cdp=touch&&!webkit?await page.context().newCDPSession(page):null;
 if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:5,radiusY:5}]});await page.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+drag,radiusX:5,radiusY:5}]});}
 else{await page.mouse.move(x,y);await page.waitForTimeout(100);await page.mouse.down();await page.waitForTimeout(150);await page.mouse.move(x,y+drag,{steps:8});}
 await page.waitForFunction(()=>GolfCourse.inspect().frame.aimPower>.05);
 assert.ok(await page.locator('#tutorial-force').evaluate(e=>e.value)>.05,'native aim controls the instructional meter');
 if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
 else await page.mouse.up();
 await page.waitForFunction(()=>GolfCourse.inspect().frame.players.find(p=>p.id===GolfCourse.inspect().frame.local).strokes===1);
 if(win){await page.waitForFunction(()=>GolfCourse.inspect().frame.players.some(p=>p.hole),{},{timeout:15000});assert.match(await page.locator('#tutorial-feedback').textContent(),/acertou o buraco/);assert.equal(await page.locator('.tutorial-details').isVisible(),true);}
 await page.locator('#tutorial-reset').click();await page.waitForFunction(()=>GolfCourse.inspect().frame.players.every(p=>p.strokes===0&&!p.hole));
 await page.locator('#tutorial-practice').click();if(await page.locator('.tutorial-details').isHidden())await page.locator('#tutorial-practice').click();
 await page.locator('#tutorial-next').click();assert.equal(await page.locator('#tutorial-step').textContent(),'Etapa 3 de 6');
 await page.locator('#zoom-in').click();await page.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);await page.locator('#zoom-reset').click();await page.waitForFunction(()=>GolfCourse.inspect().frame.zoom===1);
 const angle=await page.evaluate(()=>JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraAngle);
 await page.mouse.move(width*.20,height*.32);await page.waitForTimeout(100);await page.mouse.down();await page.mouse.move(width*.20+50,height*.32,{steps:8});await page.waitForTimeout(150);await page.mouse.up();
 await page.waitForFunction(angle=>Math.abs(JSON.parse(Module.ccall('golf_online_diagnostics','string',[],[])).cameraAngle-angle)>.02,angle);
 if(!touch){await page.mouse.move(width*.5,height*.35);await page.mouse.wheel(0,-60);await page.waitForFunction(()=>GolfCourse.inspect().frame.zoom<1);await page.locator('#zoom-reset').click();}
 for(let n=0;n<3;n++)await page.locator('#tutorial-next').click();assert.equal(await page.locator('#tutorial-step').textContent(),'Etapa 6 de 6');
 const boxes=await page.evaluate(()=>{
  const ids=['.tutorial-toolbar','.tutorial-card','#camera-zoom'];return {height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollWidth,boxes:ids.map(id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})};
 });
 assert.ok(boxes.scroll<=width);for(const r of boxes.boxes)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+.5&&r.y+r.h<=height+.5,`tutorial controls fit ${width}x${height}: ${JSON.stringify(r)}`);
 await page.screenshot({path:`../out/gameplay/tutorial-${touch?'touch-':''}${width}x${height}.png`});
 await page.locator('#tutorial-next').click();await page.locator('#main-menu').waitFor({state:'visible'});assert.equal(await page.locator('#tutorial').isVisible(),false);
 const after=await page.evaluate(()=>({scores:JSON.parse(Module.ccall('golf_ui_level_selection','string',[],[])),profile:JSON.parse(Module.ccall('golf_ui_solo_profile','string',[],[])),zoom:Module.ccall('golf_course_zoom','number',['number'],[-1])}));
 assert.deepEqual(after.scores.levels,before.scores.levels,'real tutorial shots and a hole never change campaign scores');assert.equal(after.scores.current,before.scores.current);assert.deepEqual(after.profile,before.profile);assert.ok(Math.abs(after.zoom-1.3)<.001);
 await page.locator('#open-tutorial').click();await page.waitForFunction(()=>GolfTutorial.ready);await page.keyboard.press('Escape');assert.equal(await page.locator('#tutorial').isVisible(),false);
 await page.evaluate(()=>{document.getElementById('open-tutorial').click();document.getElementById('tutorial-close').click();});
 await page.waitForFunction(()=>JSON.parse(Module.ccall('golf_ui_level_selection','string',[],[])).menu);
 assert.equal(await page.locator('#tutorial').isHidden(),true,'exiting during loading returns safely to the menu');
}
