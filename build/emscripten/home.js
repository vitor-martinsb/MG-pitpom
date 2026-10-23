/* Browser navigation. Saved scores and the actual course loader remain in C. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),home=$('home');
  let route='splash',ready=false,lastNativeMenu=false;
  const connectSettings=document.createElement('span');connectSettings.id='connect-settings-slot';$('back-main').before(connectSettings);
  const lobbyChat=document.createElement('button');lobbyChat.id='lobby-open-chat';lobbyChat.className='secondary';lobbyChat.dataset.i18n='chat';lobbyChat.textContent=GolfI18n.t('chat');$('lobby-leave').before(lobbyChat);
  const trail=$('lobby-adventure'),journey=document.createElement('details'),journeyTitle=document.createElement('summary');
  journey.className='room-route';journeyTitle.dataset.i18n='adventure';journeyTitle.textContent=GolfI18n.t('adventure');trail.before(journey);journey.append(journeyTitle,trail);trail.hidden=false;
  function roomPhase(phase){
    document.body.dataset.roomPhase=phase;
    const settings=$('music-controls'),slot=$('lobby-settings-slot');
    const parent=phase==='lobby'&&slot?slot:route==='multiplayer'?connectSettings:document.body;
    if(settings.parentElement!==parent)parent.append(settings);
  }
  const scene=$('home-scenery');
  scene.innerHTML='<picture><source media="(orientation:portrait)" srcset="art/menu-garden-portrait.png"><img class="home-art" src="art/menu-garden.png" alt="Pituca, Pompom, Romeu, Luna, Frida, Maritaca" width="1672" height="941" fetchpriority="high"></picture>';
  $('home-pets').hidden=true;
  function show(next,focus=true){
    route=next;home.hidden=!['splash','menu'].includes(next);home.dataset.screen=next;
    if(next!=='game')roomPhase('');
    document.body.dataset.home=next;
    $('main-menu').hidden=next!=='menu';$('continue-home').hidden=next!=='splash';
    $('connect').hidden=next!=='multiplayer';
    if(!home.hidden){window.GolfAudio?.phase('menu');$('music-controls').open=false;}
    if(focus)requestAnimationFrame(()=>{(next==='menu'?$('offline'):next==='splash'?$('continue-home'):next==='multiplayer'?$('nickname'):null)?.focus({preventScroll:true});});
  }
  function proceed(){if(route!=='splash')return;window.GolfAudio?.play('ui');show('menu');}
  home.addEventListener('click',e=>{if(route==='splash'&&!e.target.closest('summary,input,select')&&(!e.target.closest('button')||e.target.closest('button').id==='continue-home'))proceed();});
  window.addEventListener('keydown',e=>{
    if(home.hidden||e.target.closest?.('input,select,summary'))return;
    if(route==='splash'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();proceed();}
  },true);
  $('offline').onclick=()=>{
    if(!ready)return;window.GolfOnline?.cancelAim();
    if(Module.ccall('golf_ui_open_level_selection','number',[],[])){show('campaign',false);}
  };
  $('open-multiplayer').onclick=()=>{show('multiplayer');window.GolfOnline?.resume();};
  $('back-main').onclick=()=>show('menu');
  $('exit-game').onclick=()=>show('splash');
  for(const button of $('main-menu').querySelectorAll('button'))button.addEventListener('pointerenter',()=>window.GolfAudio?.play('ui',.15));
  window.GolfHome={
    get route(){return route;},
    ready(){ready=true;},
    show,
    roomPhase,
    native(selection){
      $('offline').disabled=!ready||!selection.menu;
      if(selection.menu&&!selection.open&&!lastNativeMenu&&route==='game'&&!window.GolfOnline?.active())show('menu');
      if(selection.loading&&route==='campaign')show('game',false);
      lastNativeMenu=!!selection.menu;
    }
  };
  // Each page load starts at the welcome screen, including reconnections.
  show('splash',false);
})();
