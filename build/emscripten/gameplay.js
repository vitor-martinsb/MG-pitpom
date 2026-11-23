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
    zoom.hidden=!showGame;
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
  // A separate practice course uses the SAME native physics and input as a match.
  const tutorial=document.createElement('section');tutorial.id='tutorial';tutorial.hidden=true;
  tutorial.setAttribute('aria-labelledby','tutorial-heading');
  tutorial.innerHTML='<header class="tutorial-toolbar"><div><h2 id="tutorial-heading"></h2><small id="tutorial-shot-count"></small></div><button id="tutorial-reset" type="button">↺</button><button id="tutorial-close" type="button">×</button></header><section class="tutorial-card"><div class="tutorial-details"><p id="tutorial-step" role="status"></p><h3 id="tutorial-title" tabindex="-1"></h3><p id="tutorial-copy"></p><label id="tutorial-force-label" for="tutorial-force"></label><meter id="tutorial-force" min="0" max="1" value="0"></meter><p id="tutorial-feedback" role="status" aria-live="polite"></p></div><footer><button type="button" id="tutorial-prev" class="secondary"></button><button type="button" id="tutorial-practice"></button><button type="button" id="tutorial-next"></button></footer></section>';
  document.body.append(tutorial);
  const card=tutorial.querySelector('.tutorial-card'),coarse=matchMedia('(pointer:coarse)');
  let active=false,pending=false,step=0,ready=false,completed=false,collapsed=false,trainingFrame;
  function call(name,result='number'){return Module.ccall(name,result,[],[]);}
  function layoutTutorial(){document.body.style.setProperty('--tutorial-card-height',`${Math.ceil(card.getBoundingClientRect().height)}px`);}
  new ResizeObserver(layoutTutorial).observe(card);
  function setCollapsed(value){collapsed=value;card.classList.toggle('is-collapsed',value);$('tutorial-practice').setAttribute('aria-expanded',String(!value));$('tutorial-practice').textContent=t(value?'tutorial.instructions':'tutorial.practice');layoutTutorial();}
  function showStep(focus=true){
    const device=coarse.matches||navigator.maxTouchPoints>0?'touch':'mouse';
    $('tutorial-heading').textContent=t('tutorial.field');$('tutorial-title').textContent=t(`tutorial.lesson${step}.title`);$('tutorial-copy').textContent=t(`tutorial.lesson${step}.${device}`);
    $('tutorial-step').textContent=t('tutorial.progress',{current:step+1,total:6});
    for(const [id,key]of [['tutorial-close','tutorial.close'],['tutorial-reset','tutorial.reset']]){$(id).setAttribute('aria-label',t(key));$(id).title=t(key);}
    $('tutorial-prev').textContent=t('back');$('tutorial-next').textContent=t(step===5?'tutorial.done':'tutorial.next');$('tutorial-prev').disabled=step===0;
    $('tutorial-practice').disabled=!ready;$('tutorial-reset').disabled=!ready;
    setCollapsed(collapsed);feedback();if(focus&&!collapsed)$('tutorial-title').focus({preventScroll:true});
  }
  function put(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
  function feedback(){
    const ball=trainingFrame?.players.find(p=>p.id===trainingFrame.local),shots=ball?.strokes??0,power=trainingFrame?.aimPower??0;
    put('tutorial-shot-count',t(ready?'tutorial.strokes':'tutorial.loading',{count:shots}));
    $('tutorial-force').value=power;put('tutorial-force-label',t('tutorial.power',{value:Math.round(power*100)}));
    put('tutorial-feedback',!ready?t('tutorial.loading'):ball?.hole?t('tutorial.complete'):power>0?t('tutorial.release'):shots>0?t('tutorial.afterShot'):t('tutorial.ready'));
  }
  function attempt(){
    if(!active||!pending)return;
    if(call('golf_tutorial_start')){pending=false;GolfHome.show('game',false);GolfAudio?.phase('game');}
  }
  function close(){
    if(!active)return;active=pending=ready=false;trainingFrame=undefined;tutorial.hidden=true;
    delete document.body.dataset.tutorial;document.body.style.removeProperty('--tutorial-card-height');
    call('golf_tutorial_stop',null);GolfHome.show('menu');$('open-tutorial').focus({preventScroll:true});
  }
  $('open-tutorial').onclick=()=>{
    if(active||!GolfCourse.initialized)return;
    active=pending=true;ready=completed=collapsed=false;step=0;trainingFrame=undefined;tutorial.hidden=false;tutorial.dataset.ready='false';document.body.dataset.tutorial='true';
    GolfOnline.cancelAim();showStep();attempt();
  };
  $('tutorial-close').onclick=close;
  $('tutorial-reset').onclick=()=>{if(!ready)return;GolfOnline.cancelAim();if(call('golf_tutorial_reset')){completed=false;trainingFrame=undefined;feedback();$('canvas').focus({preventScroll:true});}};
  $('tutorial-prev').onclick=()=>{if(step>0){step--;setCollapsed(false);showStep();}};
  $('tutorial-next').onclick=()=>{if(step===5)close();else{step++;setCollapsed(false);showStep();}};
  $('tutorial-practice').onclick=()=>{setCollapsed(!collapsed);if(collapsed)$('canvas').focus({preventScroll:true});};
  window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  window.addEventListener('courseframe',e=>{
    if(!active)return;
    if(pending){attempt();return;}
    trainingFrame=e.detail;
    if(!trainingFrame.tutorial)return;
    const wasReady=ready;ready=!!trainingFrame.active;tutorial.dataset.ready=String(ready);
    if(wasReady!==ready){$('tutorial-reset').disabled=$('tutorial-practice').disabled=!ready;}
    const ball=trainingFrame.players.find(p=>p.id===trainingFrame.local);
    if(ball?.hole&&!completed){completed=true;setCollapsed(false);}
    feedback();
  });
  window.addEventListener('languagechange',()=>{paintZoom();if(active)showStep(false);});
  coarse.addEventListener('change',()=>{if(active)showStep(false);});paintZoom();
  window.GolfTutorial=Object.freeze({get active(){return active;},get ready(){return ready;},close});
})();
