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
  scene.innerHTML=`<svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="home-sky" x2="0" y2="1"><stop stop-color="#b7d9db"/><stop offset="1" stop-color="#f9e8bd"/></linearGradient><linearGradient id="home-green" x2="0" y2="1"><stop stop-color="#b5c68e"/><stop offset="1" stop-color="#6e9568"/></linearGradient>
    <g id="home-tree"><path d="M0 0L-3 80" stroke="#967557" stroke-width="10"/><g class="canopy"><ellipse cy="-20" rx="43" ry="57" fill="#749575"/><ellipse cx="-25" cy="-5" rx="29" ry="42" fill="#8daa7c"/><ellipse cx="26" cy="-21" rx="29" ry="42" fill="#8daa7c"/></g></g></defs>
    <path fill="url(#home-sky)" d="M0 0H1440V900H0Z"/><circle cx="1140" cy="150" r="64" fill="#fff2c9"/>
    <g fill="#fff8e8" opacity=".65" class="home-clouds"><path d="M130 160Q100 120 150 114Q176 65 210 113Q260 100 265 145Q300 174 130 160"/><path d="M820 110Q780 78 825 61Q850 25 884 62Q941 45 946 88Q990 120 820 110"/></g>
    <path d="M0 340L130 200L270 320L440 150L620 330L810 230L1000 355L1180 210L1440 340V650H0Z" fill="#9bb4a0"/>
    <path d="M0 410Q240 260 450 390T880 360T1440 385V900H0Z" fill="#b3c39c"/>
    <path d="M0 520Q270 320 560 470T1070 420T1440 470V900H0Z" fill="url(#home-green)"/>
    <path d="M1520 580C900 380 1150 780 400 710S-130 940-100 1000" fill="none" stroke="#89bac2" stroke-width="85"/>
    <path class="home-water" d="M1520 580C900 380 1150 780 400 710S-130 940-100 1000" fill="none" stroke="#c8e1d7" stroke-width="3" stroke-dasharray="32 95"/>
    <path d="M245 585Q450 365 790 485T1240 660Q1390 850 1110 870H300Q105 810 245 585Z" fill="#749666" stroke="#b69566" stroke-width="15"/>
    <path d="M245 577Q450 357 790 477T1240 652Q1390 842 1110 862H300Q105 802 245 577Z" fill="#a8bd7b" stroke="#e3cda0" stroke-width="6"/>
    <path d="M1025 558L1014 666M1044 560L1031 668M1063 562L1049 670M1082 564L1067 672M1101 566L1084 674" stroke="#b99065" stroke-width="15"/>
    <path d="M1013 554L1115 569M1002 665L1094 681" stroke="#6e654b" stroke-width="7"/>
    <g transform="translate(1075 355)"><path d="M-40 92L-31-10H31L42 92Z" fill="#efdfb8" stroke="#ab906a" stroke-width="3"/><path d="M-46-10L0-59L45-10Z" fill="#b77e64"/><path d="M-9 92V55Q0 40 10 55V92" fill="#7c8261"/>
    <g class="home-mill"><path d="M0 0L-13-95L12-95Z M0 0L95-13L95 12Z M0 0L13 95L-12 95Z M0 0L-95 13L-95-12Z" fill="#fff2d2" stroke="#ac8b60" stroke-width="3"/><circle r="10" fill="#8e7254"/></g></g>
    <g transform="translate(1280 420)"><path d="M0 70V-30" stroke="#847459" stroke-width="5"/><path d="M2-30L46-15L2 0Z" fill="#cd8f71"/><ellipse cy="72" rx="19" ry="6" fill="#586e4c"/></g>
    <use href="#home-tree" x="110" y="375"/><use href="#home-tree" x="300" y="365" transform="translate(80 140) scale(.7)"/><use href="#home-tree" x="1330" y="415"/>
    <path d="M0 800Q350 710 630 860Q970 770 1440 820V900H0Z" fill="#65895e"/>
    <g fill="#f6edd5"><path d="M70 780l-8-12 13 4 8-13 1 15 14 5-14 3-6 14-2-15Z"/><path d="M1280 832l-8-12 13 4 8-13 1 15 14 5-14 3-6 14-2-15Z"/><path d="M1200 765l-8-12 13 4 8-13 1 15 14 5-14 3-6 14-2-15Z"/></g>
  </svg>`;
  // Pituca and Pompom use the very same reference artwork as the loader.
  // The companion silhouettes retain their coats, ears and Romeu's sweater.
  $('home-pets').innerHTML=`<svg viewBox="0 0 900 540" role="img" aria-labelledby="home-pet-title"><title id="home-pet-title">Pituca, Pompom, Romeu, Luna, Frida, Maritaca</title>
    <g class="home-companion frida" transform="translate(670 255)"><ellipse cy="100" rx="70" ry="12" fill="#455b3430"/><g stroke="#45423d" stroke-width="5" stroke-linejoin="round"><path d="M-35 60Q-75 6-76 60Q-85 104-36 94" fill="#f6f0df"/><path d="M-43 87Q-53 2 0-1Q52 8 45 90Z" fill="#f8f2e4"/><path d="M-42 90L-28 87M23 90L41 89"/><path d="M-49-24L-51-67L-14-41M18-42L52-67L50-13" fill="#858179"/><path d="M-54-20Q-53-61 0-48Q57-59 55-12Q47 37 0 38Q-46 37-54-20Z" fill="#f8f2e4"/><path d="M-52-24Q-45-57-6-48L-12-4L-37 10ZM9-48Q48-57 54-24L41 9L13-3Z" fill="#858179" stroke="none"/><path d="M-22-15L-10-13M13-13L25-15" stroke="#343b31"/><path d="M-4-1L4-1L0 4Z" fill="#d49591"/><path d="M-9 12Q0 18 9 12" fill="none"/></g></g>
    <g class="home-companion luna" transform="translate(255 250)"><ellipse cy="105" rx="65" ry="11" fill="#455b3430"/><g stroke="#323136" stroke-width="5" stroke-linejoin="round"><path d="M-43 62Q-77 13-73 70" fill="none" stroke-width="15"/><ellipse cy="57" rx="41" ry="42" fill="#343236"/><path d="M-38 58L-42 104H-22L-14 65M17 65L25 104H44L39 56" fill="#343236"/><path d="M-47-20L-62-65L-25-54L-12-23M17-27L29-62L60-70L52-16" fill="#343236"/><path d="M-52-58L-48-22L-30-43M32-49L47-58L43-23" fill="#644840" stroke="none"/><ellipse cy="-7" rx="51" ry="46" fill="#343236"/><g fill="#b77d48" stroke="none"><ellipse cx="-22" cy="-10" rx="12" ry="16"/><ellipse cx="22" cy="-10" rx="12" ry="16"/></g><g fill="#25252a" stroke="none"><ellipse cx="-20" cy="-8" rx="7" ry="11"/><ellipse cx="20" cy="-8" rx="7" ry="11"/></g><path d="M-28 17Q0 0 28 17Q28 40 0 39Q-27 39-28 17Z" fill="#454349"/><path d="M-10 18L10 18L0 26Z" fill="#22242a"/><g fill="#fff8e6" stroke="none"><circle cx="-18" cy="-15" r="4"/><circle cx="22" cy="-15" r="4"/></g></g></g>
    <g class="home-companion romeu" transform="translate(445 205)"><ellipse cy="113" rx="73" ry="12" fill="#455b3430"/><g stroke="#343238" stroke-width="5" stroke-linejoin="round"><path d="M-40 77L-47 112H-20L-14 77M20 77L26 112H49L44 72" fill="#343236"/><path d="M-55 28Q-65 103 0 103Q66 104 56 30Z" fill="#a7a9af"/><path d="M-55 53L55 53M-57 77L58 77" stroke="#435e8c" stroke-width="10"/><path d="M-53 66L57 66" stroke="#bd665e" stroke-width="7"/><path d="M-48 34Q-68-23-42-46Q-12-67 0-52Q30-67 49-41Q70-13 46 34Z" fill="#343236"/><ellipse cx="-51" cy="2" rx="22" ry="40" fill="#343236"/><ellipse cx="52" cy="2" rx="22" ry="40" fill="#343236"/><path d="M-27 13Q0-9 29 13Q32 43 0 45Q-31 44-27 13Z" fill="#535057"/><path d="M-11 13Q0 5 12 13L0 24Z" fill="#27272c"/><path d="M-9 32Q1 52 14 33" fill="#da9698" stroke-width="3"/><g fill="#ad8257" stroke="none"><ellipse cx="-23" cy="-16" rx="10" ry="13"/><ellipse cx="23" cy="-16" rx="10" ry="13"/></g><g fill="#fff8e6" stroke="none"><circle cx="-20" cy="-20" r="4"/><circle cx="25" cy="-20" r="4"/></g><path d="M-38-40Q-27-51-15-43M6-45Q20-53 35-43" fill="none" stroke="#514c53" stroke-width="9"/></g></g>
    <g class="home-bird" transform="translate(720 100) rotate(12)"><path d="M-16 23L-29 77L0 51" fill="#598150"/><ellipse rx="28" ry="38" fill="#7caa4b"/><path d="M-20-9Q-68-59-79-28Q-41 10-21 18M20-9Q68-59 79-28Q41 10 21 18" fill="#669b45" stroke="#4e7f40" stroke-width="4"/><path d="M-22-8L-37-19L-26 7M22-8L37-19L26 7" fill="#c16b4b"/><circle cy="-24" r="25" fill="#7caa4b"/><circle cx="-11" cy="-28" r="6" fill="#faf0d5"/><circle cx="-10" cy="-28" r="3" fill="#343b2d"/><path d="M-3-21Q20-24 15-9L5 2L-4-10Z" fill="#d9bc91"/></g>
    <g class="home-lead pituca"><ellipse cx="350" cy="440" rx="148" ry="18" fill="#455b3430"/><use href="#pitpom-running-8" x="130" y="250" width="425" height="290"/></g>
    <g class="home-lead pompom"><ellipse cx="560" cy="449" rx="123" ry="17" fill="#455b3430"/><use href="#pitpom-running-0" x="390" y="280" width="365" height="250"/></g>
  </svg>`;
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
