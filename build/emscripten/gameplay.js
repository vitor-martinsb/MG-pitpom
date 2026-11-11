/* Presentation controls reuse the native camera and the authoritative room. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),t=(key,values)=>GolfI18n.t(key,values);
  const zoom=document.createElement('nav');zoom.className='camera-zoom';zoom.id='camera-zoom';zoom.hidden=true;
  zoom.innerHTML='<button type="button" id="zoom-out">−</button><button type="button" id="zoom-reset">1×</button><button type="button" id="zoom-in">+</button>';document.body.append(zoom);
  const turn=document.createElement('aside');turn.id='turn-status';turn.hidden=true;turn.setAttribute('role','status');turn.setAttribute('aria-live','polite');$('summary').before(turn);
  const aim=document.createElement('div');aim.id='turn-aim-status';aim.hidden=true;
  const aimLabel=document.createElement('span'),aimMeter=document.createElement('meter');aimMeter.min=0;aimMeter.max=1;aim.append(aimLabel,aimMeter);turn.after(aim);
  let frame,distance=1,turnText='';
  function changeZoom(value){
    if(zoom.hidden||!GolfCourse.initialized)return;
    GolfOnline.cancelAim();distance=Module.ccall('golf_course_zoom','number',['number'],[value]);paintZoom();$('canvas').focus({preventScroll:true});
  }
  function paintZoom(){
    zoom.setAttribute('aria-label',t('camera.zoom'));$('zoom-in').setAttribute('aria-label',t('camera.in'));$('zoom-out').setAttribute('aria-label',t('camera.out'));$('zoom-reset').setAttribute('aria-label',t('camera.reset'));
    $('zoom-reset').textContent=(1/distance).toFixed(1)+'×';$('zoom-in').disabled=distance<=.6501;$('zoom-out').disabled=distance>=2.2499;
  }
  $('zoom-in').onclick=()=>changeZoom(distance*.85);$('zoom-out').onclick=()=>changeZoom(distance/.85);$('zoom-reset').onclick=()=>changeZoom(1);
  $('canvas').addEventListener('wheel',e=>{if(zoom.hidden||GolfOnline.blocked())return;e.preventDefault();changeZoom(distance*Math.exp(Math.max(-100,Math.min(100,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1)))*.002));},{passive:false});
  window.addEventListener('courseframe',e=>{
    frame=e.detail;
    const showGame=!!(frame.active&&!frame.intro&&GolfHome.route==='game'&&['home','connect','lobby','loading','solo-loading','level-selection','scores','chat-panel','adventure-modal'].every(id=>$(id).hidden)&&!$('music-controls').open);
    zoom.hidden=!showGame||!!frame.overview;
    if(!zoom.hidden){distance=frame.zoom||1;paintZoom();}
    const state=GolfOnline.turnState();turn.hidden=!showGame||state.style!=='turns'||state.phase!=='playing';
    const preview=state.aim;
    aim.hidden=turn.hidden||!frame.overview||!preview||!frame.remoteAimPower;
    if(!aim.hidden){
      const name=state.players.find(p=>p.id===preview.player)?.nickname??'…';
      aimLabel.textContent=t('turns.aim',{name,power:Math.round(preview.power*100)});aimMeter.value=preview.power;aimMeter.setAttribute('aria-label',aimLabel.textContent);
    }
    if(!turn.hidden){
      const name=id=>state.players.find(p=>p.id===id)?.nickname??'…';
      const text=[t(state.turn===state.local?'turns.yours':'turns.current',{name:name(state.turn)}),state.order.length>1?t('turns.next',{names:state.order.slice(1,4).map(name).join(' → ')}):''].filter(Boolean).join(' · ');
      if(turnText!==text){turnText=text;turn.textContent=text;}
    }
  });
  // This illustrated rehearsal never enters a match or changes a player's score.
  const dialog=document.createElement('dialog');dialog.id='tutorial';dialog.setAttribute('aria-labelledby','tutorial-heading');
  dialog.innerHTML='<section class="tutorial-panel"><header class="chat-heading"><h2 id="tutorial-heading"></h2><button type="button" id="tutorial-close"></button></header><p id="tutorial-step" role="status"></p><h3 id="tutorial-title" tabindex="-1"></h3><p id="tutorial-copy"></p><div id="tutorial-demo"><svg viewBox="0 0 320 170" aria-hidden="true"><g id="tutorial-field"><rect x="10" y="20" width="300" height="135" rx="35" fill="#96b477" stroke="#6d885b" stroke-width="5"/><path d="M170 25v45m-13 0h26" stroke="#936e48" stroke-width="9" stroke-linecap="round"/><ellipse cx="260" cy="105" rx="12" ry="6" fill="#294632"/><path d="M260 104V45l30 9-30 11" fill="#c74a3d" stroke="#8e3d35" stroke-width="2"/><path id="tutorial-aim" d="M70 108h80" stroke="#fff7dc" stroke-width="4" stroke-dasharray="6 4"/><circle id="tutorial-ball" cx="70" cy="108" r="9" fill="#fff9e9" stroke="#415c42" stroke-width="2"/></g></svg><div id="tutorial-pet"></div></div><label id="tutorial-force-label" for="tutorial-force"></label><input id="tutorial-force" type="range" min="10" max="100" value="55"><div class="tutorial-demo-actions"><button type="button" id="tutorial-practice"></button><button type="button" id="tutorial-demo-out">−</button><button type="button" id="tutorial-demo-in">+</button></div><p id="tutorial-feedback" role="status"></p><footer><button type="button" id="tutorial-prev" class="secondary"></button><button type="button" id="tutorial-next"></button></footer></section>';
  document.body.append(dialog);let step=0,animation,demonstrationZoom=1,pointer;
  function force(){const v=Number($('tutorial-force').value);$('tutorial-aim').setAttribute('d',`M70 108h${v*1.7}`);$('tutorial-force-label').textContent=t('tutorial.power',{value:v});}
  function showStep(focus=true){
    animation?.cancel();$('tutorial-feedback').textContent='';demonstrationZoom=1;$('tutorial-field').style.transform='';
    $('tutorial-heading').textContent=t('tutorial.title');$('tutorial-title').textContent=t('tutorial.step'+step+'.title');$('tutorial-copy').textContent=t('tutorial.step'+step+'.body');$('tutorial-step').textContent=t('tutorial.progress',{current:step+1,total:6});
    for(const [id,key]of [['tutorial-close','tutorial.close'],['tutorial-prev','back'],['tutorial-next',step===5?'tutorial.done':'tutorial.next'],['tutorial-practice','tutorial.practice']])$(id).textContent=t(key);
    $('tutorial-demo-in').setAttribute('aria-label',t('camera.in'));$('tutorial-demo-out').setAttribute('aria-label',t('camera.out'));
    $('tutorial-prev').disabled=step===0;$('tutorial-demo-in').hidden=$('tutorial-demo-out').hidden=step!==1;
    $('tutorial-pet').hidden=step!==2;if(step===2&&!$('tutorial-pet').firstChild)$('tutorial-pet').append(GolfOnline.petAvatar(5));
    force();if(focus)$('tutorial-title').focus();
  }
  $('open-tutorial').onclick=()=>{step=0;GolfOnline.cancelAim();dialog.showModal();showStep();};
  window.addEventListener('keydown',e=>{if(dialog.open){e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();dialog.close();}}},true);
  $('tutorial-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{animation?.cancel();$('open-tutorial').focus();});
  $('tutorial-prev').onclick=()=>{if(step>0){step--;showStep();}};$('tutorial-next').onclick=()=>{if(step===5)dialog.close();else {step++;showStep();}};
  $('tutorial-force').oninput=force;
  $('tutorial-practice').onclick=()=>{
    animation?.cancel();const v=Number($('tutorial-force').value),target=Math.min(190,v*2.3);
    animation=$('tutorial-ball').animate([{transform:'translateX(0)'},{transform:`translateX(${target}px)`}],{duration:matchMedia('(prefers-reduced-motion:reduce)').matches?1:950,easing:'cubic-bezier(.15,.6,.3,1)',fill:'forwards'});
    $('tutorial-feedback').textContent=t('tutorial.demoNote');
  };
  const demo=$('tutorial-demo');demo.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;demo.setPointerCapture(pointer);setForce(e);});
  function setForce(e){const r=demo.getBoundingClientRect();$('tutorial-force').value=Math.round(Math.max(10,Math.min(100,(e.clientX-r.left)/r.width*140-20)));force();}
  demo.addEventListener('pointermove',e=>{if(e.pointerId===pointer)setForce(e);});demo.addEventListener('pointerup',e=>{if(e.pointerId===pointer){pointer=undefined;$('tutorial-practice').click();}});demo.addEventListener('pointercancel',()=>{pointer=undefined;});
  for(const [id,delta]of [['tutorial-demo-in',.15],['tutorial-demo-out',-.15]])$(id).onclick=()=>{demonstrationZoom=Math.max(.8,Math.min(1.5,demonstrationZoom+delta));$('tutorial-field').style.transform=`scale(${demonstrationZoom})`;};
  window.addEventListener('languagechange',()=>{paintZoom();if(dialog.open)showStep(false);});paintZoom();
})();
