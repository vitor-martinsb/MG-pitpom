// Sokol converts pointer coordinates during its frame update. Let the move
// reach that update before pressing, as it does during a real mouse gesture.
export async function canvasClick(page,x,y){
  await page.mouse.move(x,y);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.mouse.click(x,y,{delay:100});
}
