(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const t=(key,values)=>GolfI18n.t(key,values);
  let scoresForced=false,presenting=false;
  const touchControls=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
  function fitPanels(){
    const viewport=window.visualViewport;
    document.documentElement.style.setProperty('--overlay-height',`${viewport?.height??innerHeight}px`);
    document.documentElement.style.setProperty('--overlay-top',`${viewport?.offsetTop??0}px`);
    const active=document.activeElement;if(active?.matches('input,select,textarea')&&active.closest('#lobby,#connect'))requestAnimationFrame(()=>active.scrollIntoView({block:'nearest',inline:'nearest'}));
  }
  window.addEventListener('resize',fitPanels);
  window.visualViewport?.addEventListener('resize',fitPanels);
  window.visualViewport?.addEventListener('scroll',fitPanels);
  fitPanels();
  // Register before the engine's window capture handlers so form controls keep
  // their native typing, editing and keyboard navigation.
  for(const type of ['keydown','keyup','keypress']) window.addEventListener(type,event=>{
    if(event.composedPath().some(target=>target instanceof HTMLElement&&
      (target.matches('input,textarea,select')||target.isContentEditable))) event.stopImmediatePropagation();
  },true);
  let socket, identity, room, phase='lobby', sequence=0, initialized=false, online=false, loading=true;
  let retryTimer, connected=false, deadline=0, lastBalls=new Map(), reconnectStart=0, toastTimer,epoch=0;
  let lastChatId=0, unreadChat=0, chatCooldown;
  let celebrated=false,playbackSpeed=1;
  // The existing numeric avatar IDs stay compatible with saved profiles and rooms.
  const avatars=[
    [535,483,435,335], [1043,455,453,340], [687,55,420,360],
    [277,0,431,330], [1159,110,341,335], [129,451,364,355],
    [1498,82,248,300], [0,0,1774,887]
  ];
  const avatarClips={0:'M506 483H746L772 487L792 492L819 495L840 505H969V887H506Z',1:'M1043 455H1159V473L1174 483L1190 512H1496V887H1043Z',5:'M129 451H315V506H493V887H129Z'};
  let avatarSerial=0;
  function petAvatar(id){
    const index=Number.isInteger(Number(id))&&avatars[Number(id)]?Number(id):0;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
    svg.classList.add('pet-avatar');svg.setAttribute('viewBox',avatars[index].join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',t('avatar'+index));
    if(avatarClips[index]){const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),path=document.createElementNS(ns,'path');clip.id='pet-avatar-'+(++avatarSerial);path.setAttribute('d',avatarClips[index]);clip.append(path);defs.append(clip);svg.append(defs);image.setAttribute('clip-path','url(#'+clip.id+')');}
    image.setAttribute('href','art/menu-cast-reference.png');image.setAttribute('width','1774');image.setAttribute('height','887');svg.append(image);return svg;
  }
  const send=m=>{if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(m));};
  const call=m=>{if(initialized) Module.ccall('golf_online_receive',null,['string'],[JSON.stringify(m.type==='room'?{...m,players:m.players.map(p=>p.bot?{...p,nickname:'[BOT] '+p.nickname}:p)}:m)]);};
  const speedLabel=document.createElement('small');speedLabel.id='bot-speed';speedLabel.hidden=true;speedLabel.setAttribute('role','status');$('hud').append(speedLabel);
  let activeLobbyTab='players',profileDirty=false,profilePending=false,pendingConfig,pendingPool;
  function startState(){if(room)$('start').disabled=room.host!==identity?.id||!connected||phase!=='lobby'||profilePending||!!pendingConfig||!!pendingPool;}
  const tabScroll={players:0,maps:0,mode:0};
  function selectLobbyTab(name,focus=false){
    const body=document.querySelector('.lobby-body');tabScroll[activeLobbyTab]=body.scrollTop;
    activeLobbyTab=name;
    for(const id of ['players','maps','mode']){
      const selected=id===name;$(`panel-${id}`).hidden=!selected;
      $(`tab-${id}`).setAttribute('aria-selected',String(selected));$(`tab-${id}`).tabIndex=selected?0:-1;
    }
    body.scrollTop=tabScroll[name];if(focus)$(`tab-${name}`).focus();
  }
  for(const name of ['players','maps','mode'])$('tab-'+name).onclick=()=>selectLobbyTab(name);
  document.querySelector('.lobby-tabs').addEventListener('keydown',e=>{
    const ids=['players','maps','mode'],i=ids.indexOf(activeLobbyTab);let next;
    if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;
    else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;
    e.preventDefault();selectLobbyTab(ids[next],true);
  });
  function entryView(joining=false){
    $('entry-actions').hidden=joining;$('join-form').hidden=!joining;$('connect').dataset.entry=joining?'join':'choices';
    if(joining){$('join-nickname').value=$('nickname').value;$('join-code').focus();}
  }
  $('open-join').onclick=()=>entryView(true);$('join-back').onclick=()=>entryView(false);
  $('copy-room-code').onclick=async()=>{
    if(!room)return;
    try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(room.code);toast(t('lobby.codeCopied'));}
    catch{const range=document.createRange();range.selectNodeContents($('room-code'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);toast(t('lobby.copyManually'));}
  };
  function previewProfile(){
    $('ball-preview').style.setProperty('--ball-color',$('color').value);
    $('ball-preview').replaceChildren(petAvatar($('avatar').value));
    for(const button of $('profile-shortcuts').querySelectorAll('button')){const field=$(button.dataset.field);button.disabled=field.disabled;button.setAttribute('aria-pressed',String(field.value.toLowerCase()===button.dataset.value));}
  }
  function renderProfile(){
    const me=room?.players.find(p=>p.id===identity?.id);if(!me)return;
    const current=profile();
    if(profilePending&&me.nickname===current.nickname&&me.color.toLowerCase()===current.color.toLowerCase()&&me.avatar===current.avatar){profilePending=false;profileDirty=false;}
    if(!profileDirty){$('nickname').value=me.nickname;$('color').value=me.color;$('avatar').value=String(me.avatar);}
    $('profile-display-name').textContent=me.nickname;$('save-profile').disabled=profilePending||phase!=='lobby'||!connected;
    for(const id of ['nickname','color','avatar'])$(id).disabled=profilePending||phase!=='lobby';
    try{localStorage.setItem('golf-profile',JSON.stringify({nickname:me.nickname,color:me.color,avatar:me.avatar}));}catch{}
    previewProfile();
  }
  // Quick choices edit the existing fields; saving still uses the same profile intent.
  for(const [field,values]of [['color',['#ee6255','#2685dc','#33964b','#f3be38','#a253ce','#ee73a0','#ffffff','#20292b']],['avatar',avatars.map((_,i)=>String(i))]]){
    const group=document.createElement('div');group.className='profile-choices '+field+'-choices';group.setAttribute('role','group');group.dataset.i18nLabel=field==='color'?'ballColor':'avatar';group.setAttribute('aria-label',t(group.dataset.i18nLabel));
    for(const value of values){const button=document.createElement('button');button.type='button';button.dataset.field=field;button.dataset.value=value;
      if(field==='color'){button.style.setProperty('--choice-color',value);button.setAttribute('aria-label',value);}else{const portrait=petAvatar(value);portrait.setAttribute('aria-hidden','true');button.append(portrait);button.setAttribute('aria-label',t('avatar'+value));}
      button.onclick=()=>{if($(field).disabled)return;$(field).value=value;$(field).dispatchEvent(new Event('input',{bubbles:true}));};group.append(button);
    }
    $('profile-shortcuts').append(group);
  }
  for(const id of ['nickname','color','avatar'])$(id).addEventListener('input',()=>{profileDirty=true;previewProfile();});
  $('profile-form').onsubmit=e=>{e.preventDefault();if(!room||phase!=='lobby')return;const submitted=profile();profilePending=true;startState();$('save-profile').disabled=true;for(const id of ['nickname','color','avatar'])$(id).disabled=true;previewProfile();send({type:'profile',...submitted});};
  function modeControls(){
    if(!room)return;const host=room.host===identity?.id&&phase==='lobby';
    for(const button of document.querySelectorAll('[data-mode]')){button.disabled=!host;button.setAttribute('aria-pressed',String(button.dataset.mode===(pendingConfig?.mode??room.mode)));}
  }
  for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>{if(room?.host!==identity?.id)return;$('game-mode').value=button.dataset.mode;$('game-mode').dispatchEvent(new Event('change'));};
  function roomLabels(){
    if(!room)return;
    const connected=room.players.filter(p=>p.connected);
    $('count').textContent=t('lobby.count',{count:connected.length,bots:connected.filter(p=>p.bot).length});
    $('host-identity').textContent=t('lobby.hostName',{name:room.players.find(p=>p.id===room.host)?.nickname??'—'});
  }
  function mapDraftCount(){
    const inputs=[...$('map-options').querySelectorAll('[data-map-id]')],count=inputs.filter(i=>i.checked).length;
    $('map-draft-count').textContent=t('lobby.mapDraft',{count});
    $('apply-maps').disabled=room?.host!==identity?.id||!count;
    for(const checkbox of $('map-options').querySelectorAll('[data-world-id]:not([data-map-id])')){
      const choices=inputs.filter(i=>i.dataset.worldId===checkbox.dataset.worldId),selected=choices.filter(i=>i.checked).length;
      checkbox.checked=choices.length>0&&selected===choices.length;checkbox.indeterminate=selected>0&&selected<choices.length;
    }
  }
  $('map-options').addEventListener('change',e=>{
    const input=e.target;if(input.matches('[data-world-id]:not([data-map-id])'))
      for(const child of $('map-options').querySelectorAll('[data-map-id]'))if(child.dataset.worldId===input.dataset.worldId)child.checked=input.checked;
    mapDraftCount();
  });
  let poolSignature='';
  function poolControls(force=false){
    if(!room)return;const host=room.host===identity?.id&&phase==='lobby';
    const ids=room.mapPool??GOLF_CAMPAIGN.courses.map((_,i)=>i),kind=pendingPool?.kind??room.mapPoolKind??'all';
    $('map-pool').value=kind;$('map-pool').disabled=!host;$('custom-maps').hidden=kind!=='custom';$('apply-maps').disabled=!host;
    $('selected-maps').textContent=t('selectedMaps',{count:ids.length});
    const signature=JSON.stringify([ids,kind,GolfI18n.language]);
    if(force||poolSignature!==signature){
      poolSignature=signature;$('map-options').replaceChildren();
      for(const world of GOLF_CAMPAIGN.worlds){
        const group=document.createElement('fieldset');group.className='map-family';
        const legend=document.createElement('legend'),worldLabel=document.createElement('label'),worldChoice=document.createElement('input');
        worldChoice.type='checkbox';worldChoice.dataset.worldId=String(world.id);worldChoice.disabled=!host;worldLabel.className='world-choice';
        worldLabel.append(worldChoice,document.createTextNode(world.names[GolfI18n.language]??world.names.en));legend.append(worldLabel);group.append(legend);
        const choices=document.createElement('details');choices.className='map-world';const summary=text('summary',t('lobby.showCourses',{count:GOLF_CAMPAIGN.courses.filter(c=>c.world===world.id).length}));choices.append(summary);group.append(choices);
        for(const [id,course]of GOLF_CAMPAIGN.courses.entries())if(course.world===world.id){
          const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.mapId=String(id);input.dataset.worldId=String(world.id);input.checked=ids.includes(id);input.disabled=!host;
          label.append(input);
          if(course.thumbnail){const img=document.createElement('img');img.src=course.thumbnail;img.alt='';img.loading='lazy';img.className='map-thumbnail';label.append(img);}
          label.append(document.createTextNode(GolfI18n.courseName(course)));choices.append(label);
        }
        $('map-options').append(group);
      }
    }
    for(const input of $('map-options').querySelectorAll('input'))input.disabled=!host;
    mapDraftCount();
  }
  function syncClock(m){playbackSpeed=m.simulationSpeed??1;if(Number.isFinite(m.remaining))deadline=performance.now()+m.remaining/playbackSpeed;}
  function botControls(){
    if(!room)return;const host=room.host===identity?.id&&phase==='lobby',bots=room.players.filter(p=>p.bot),max=50-room.players.filter(p=>!p.bot).length;
    $('bot-count').max=String(max);if(document.activeElement!==$('bot-count'))$('bot-count').value=String(bots.length);
    for(const id of ['bot-count','bot-difficulty-all','apply-bot-count'])$(id).disabled=!host;
    $('bot-capacity').textContent=t('botCapacity',{max});
  }
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function profile(){return {nickname:$('nickname').value.trim(),color:$('color').value,avatar:Number($('avatar').value)};}
  function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
  function playerRow(p){const row=document.createElement('div');row.className='player';const dot=document.createElement('span');dot.className='dot';dot.style.background=p.color;row.append(dot,petAvatar(p.avatar),text('span',`${p.bot?'🤖 ':''}${p.nickname}${p.id===identity?.id?' · '+t('you'):''}${p.connected?'':' · '+t('disconnected')}`));if(p.bot){const badge=text('small',t('difficulty.'+p.bot));badge.className='bot-badge';row.append(badge);}if(room?.mode==='impact'&&!lastBalls.get(p.id)?.firstComplete){const shield=text('small','🛡');shield.title=t('protected');row.append(shield);}if(p.id===room?.host){const badge=text('small',t('lobby.host'));badge.className='host-badge';row.append(badge);}return row;}
  function lobbyRow(p){
    if(!p.bot||room.host!==identity?.id)return playerRow(p);
    const row=document.createElement('div');row.className='bot-row';row.append(playerRow(p));
    const controls=document.createElement('div');controls.className='bot-controls';
    const difficulty=document.createElement('select');difficulty.setAttribute('aria-label',`${t('botDifficulty')}: ${p.nickname}`);
    for(const level of ['easy','medium','hard','expert']){const option=text('option',t('difficulty.'+level));option.value=level;difficulty.append(option);}difficulty.value=p.bot;
    difficulty.onchange=()=>send({type:'bot',action:'update',id:p.id,settings:{difficulty:difficulty.value}});
    const remove=text('button','×');remove.className='secondary remove-bot';remove.setAttribute('aria-label',`${t('removeBot')}: ${p.nickname}`);remove.onclick=()=>send({type:'bot',action:'remove',id:p.id});
    controls.append(difficulty,remove);row.append(controls);
    const details=document.createElement('details');details.className='bot-cosmetics';details.append(text('summary',t('editBot')));
    const name=document.createElement('input');name.value=p.nickname;name.maxLength=24;name.setAttribute('aria-label',t('botName'));
    const color=document.createElement('input');color.type='color';color.value=p.color;color.setAttribute('aria-label',t('ballColor'));
    const apply=text('button',t('applyBot'));apply.onclick=()=>send({type:'bot',action:'update',id:p.id,settings:{nickname:name.value,color:color.value}});
    details.append(name,color,apply);row.append(details);return row;
  }

  function renderBotRoster(){
    const bots=room?.players.filter(p=>p.bot)??[];
    $('bot-members').replaceChildren(...($('bot-roster').open?bots.map(lobbyRow):[]));
  }
  function renderMembers(){
    if(!room)return;
    const bots=room.players.filter(p=>p.bot);
    $('members').replaceChildren(...room.players.filter(p=>!p.bot&&p.connected).map(playerRow));
    $('bot-roster').hidden=!bots.length;
    $('bot-roster-label').textContent=t('botsSummary',{count:bots.length});
    $('bot-colors').replaceChildren(...bots.slice(0,8).map(p=>{const dot=document.createElement('i');dot.style.background=p.color;return dot;}));
    renderBotRoster();
  }
  $('bot-roster').addEventListener('toggle',renderBotRoster);
  function appendChat(m,history=false){
    if(!Number.isSafeInteger(m.id)||m.id<=lastChatId)return;
    lastChatId=m.id;
    const list=$('chat-messages'),follow=list.scrollHeight-list.scrollTop-list.clientHeight<40;
    const row=document.createElement('p');row.className='chat-message';
    const name=text('strong',`${m.nickname}: `);name.style.color=m.color;
    row.append(name,text('span',m.text));list.append(row);
    while(list.children.length>50)list.firstElementChild.remove();
    if(follow)list.scrollTop=list.scrollHeight;
    if(!history&&$('chat-panel').hidden){unreadChat++;$('open-chat').textContent=t('chatUnread',{count:unreadChat});}
    if(m.playerId===identity?.id&&$('chat-input').value.trim()===m.text)$('chat-input').value='';
  }
  function closeChat(){$('chat-panel').hidden=true;$('chat-input').blur();}
  function openChat(){
    if(!identity)return;
    call({type:'cancel-aim'});$('music-controls').open=false;
    $('chat-panel').hidden=false;unreadChat=0;$('open-chat').textContent=t('chat');
    $('chat-messages').scrollTop=$('chat-messages').scrollHeight;$('chat-input').focus();
  }
  function connect(first){
    clearTimeout(retryTimer);
    const generation=++epoch;socket?.close();
    socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
    socket.onopen=()=>{if(generation!==epoch)return;connected=true;send(first);};
    socket.onmessage=e=>{
      if(generation!==epoch)return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.type==='welcome'){
        identity={id:m.id,token:m.token,code:m.code};sequence=m.sequence??0;online=true;reconnectStart=0;
        sessionStorage.setItem('golf-session',JSON.stringify(identity));call(m);$('send-chat').disabled=false;
      } else if(m.type==='chat-history'){
        lastChatId=0;unreadChat=0;$('open-chat').textContent=t('chat');$('chat-messages').replaceChildren();
        for(const message of m.messages)appendChat(message,true);
      } else if(m.type==='chat'){
        appendChat(m);
      } else if(m.type==='room'){
        if(!$('connect').hidden)window.GolfHome?.show('game',false);
        const previous=phase,previousCode=room?.code;room=m;phase=m.phase;
        if(phase==='lobby'&&(previousCode!==m.code||previous!=='lobby')){selectLobbyTab('players');profileDirty=profilePending=false;}window.GolfHome?.roomPhase(phase);syncClock(m);call(m);
        if(m.host!==identity?.id)pendingConfig=pendingPool=undefined;
        if(pendingConfig&&pendingConfig.holes===m.holes&&pendingConfig.mode===m.mode)pendingConfig=undefined;
        if(pendingPool&&pendingPool.kind===m.mapPoolKind&&JSON.stringify(pendingPool.ids)===JSON.stringify(m.mapPool))pendingPool=undefined;
        $('lobby').hidden=phase!=='lobby';$('hud').hidden=phase==='lobby';$('help').hidden=phase==='lobby';
        $('room-code').textContent=m.code;roomLabels();renderProfile();modeControls();$('actions').hidden=phase==='lobby';
        renderMembers();$('start').hidden=m.host!==identity?.id;startState();
        $('holes').disabled=m.host!==identity?.id;$('holes').value=String(pendingConfig?.holes??m.holes);$('game-mode').value=pendingConfig?.mode??m.mode;
        for(const option of $('holes').options){option.disabled=Number(option.value)>(m.mapPool?.length??m.availableMaps);option.hidden=option.disabled;}
        poolControls();
        $('add-bot').disabled=m.host!==identity?.id||m.players.length>=50;
        botControls();
        document.querySelector('[data-i18n="mapPolicy"]').textContent=t('mapPolicy',{count:m.availableMaps});
        GolfAdventure.render(m);
        $('host-note').textContent=t(m.host===identity?.id?'hostYou':'hostWait');
        $('hole').textContent=t('hole',{current:Math.min(m.hole+1,m.holes),total:m.holes});
        $('status').textContent=phase==='lobby'?'':t('phase.'+phase);
        $('loading').hidden=phase!=='loading'||presenting;$('loading-count').textContent=t('readyCount',{ready:m.players.filter(p=>p.ready&&p.connected).length,total:m.players.filter(p=>p.connected).length});
        const readyFraction=m.players.filter(p=>p.ready&&p.connected).length/Math.max(1,m.players.filter(p=>p.connected).length);
        if(readyFraction<1)$('ready-progress').value=readyFraction;else $('ready-progress').removeAttribute('value');
        $('game-mode').disabled=m.host!==identity?.id;if(m.host!==identity?.id||phase!=='lobby')$('game-mode').value=m.mode;
        $('mode-indicator').textContent=t('modeBadge.'+m.mode);
        if(previous!==phase&&phase==='playing')GolfAudio?.phase('game');
        if(previous!==phase&&phase==='lobby')GolfAudio?.phase('menu');
        if(previous!==phase&&phase==='results')GolfAudio?.play('courseDone');
        if(phase==='results'||phase==='finished') showScores(true);else if(previous==='results') $('scores').hidden=true;
        if(phase==='finished'&&m.completed&&!celebrated){celebrated=true;const key=`pitpom-celebrated-${m.code}-${m.match}`;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');const winners=sorted().filter(p=>p.total===sorted()[0]?.total);GolfAdventure.celebrate(winners);GolfAudio?.victory();}else $('winner-banner').hidden=false;}
        if(phase==='lobby'){$('scores').hidden=true;$('winner-banner').hidden=true;celebrated=false;}
        renderSummary();renderSpectators();
      } else if(m.type==='load'){
        loading=true;presenting=false;lastBalls.clear();call(m);$('scores').hidden=true;$('adventure-modal').hidden=true;
      } else if(m.type==='snapshot'){
        if(!room||m.hole!==room.hole)return;
        if(m.full)lastBalls.clear();for(const b of m.players)lastBalls.set(b.id,b);
        syncClock(m);room.simulationSpeed=m.simulationSpeed??1;call(m);GolfAudio?.events(m.events??[],m.hole);renderSummary();renderSpectators();
      } else if(m.type==='shot'){call(m);
      } else if(m.type==='error'){
        if(m.scope!=='chat')call(m);toast(GolfI18n.error(m));
        if(m.scope==='profile'){profilePending=false;renderProfile();}
        if(m.scope==='configure'){pendingConfig=undefined;if(room){$('holes').value=String(room.holes);$('game-mode').value=room.mode;modeControls();}}if(m.scope==='map-pool'){pendingPool=undefined;poolControls();}startState();
        if(!identity){$('create').disabled=false;$('join').disabled=false;GolfAdventure.busy(false);}
        if(m.code==='RECONNECT_EXPIRED'||m.message==='Reconexão expirada.'||identity&&m.code==='ROOM_NOT_FOUND')leave();
      }
    };
    socket.onerror=()=>{if(generation===epoch)toast(t('connectionFailed'));};
    socket.onclose=()=>{
      if(generation!==epoch)return;
      connected=false;profilePending=false;pendingConfig=pendingPool=undefined;if(room)renderProfile();call({type:'disconnected'});
      if(online&&identity){
        if(!reconnectStart)reconnectStart=performance.now();
        if(performance.now()-reconnectStart<60000){toast(t('reconnecting'));retryTimer=setTimeout(()=>connect({type:'reconnect',...identity}),1500);}
        else{toast(t('reconnectExpired'));leave();}
      } else {$('create').disabled=false;$('join').disabled=false;}
    };
  }
  function join(create){
    const p=profile();if(!create)p.nickname=$('join-nickname').value.trim();if(!/^[\x20-\x7e]{1,24}$/.test(p.nickname)){toast(t('error.INVALID_NICKNAME'));return;}
    try{localStorage.setItem('golf-profile',JSON.stringify(p));}catch{}$('nickname').value=p.nickname;$('create').disabled=true;$('join').disabled=true;
    GolfAdventure.busy(true);celebrated=false;$('winner-banner').hidden=true;GolfAudio?.phase('menu');
    connect({type:create?'create':'join',code:$('join-code').value.trim().toUpperCase(),...p});
  }
  function leave(){++epoch;connected=false;online=false;identity=undefined;room=undefined;phase='lobby';lastBalls.clear();clearTimeout(retryTimer);sessionStorage.removeItem('golf-session');socket?.close();call({type:'leave'});
    entryView(false);profileDirty=profilePending=false;pendingConfig=pendingPool=undefined;$('profile-editor').open=false;$('bot-roster').open=true;$('bot-members').replaceChildren();closeChat();clearTimeout(chatCooldown);$('send-chat').disabled=false;$('chat-input').value='';$('chat-messages').replaceChildren();lastChatId=0;unreadChat=0;$('open-chat').textContent=t('chat');
    for(const id of ['lobby','hud','actions','help','scores','loading','adventure-modal','celebration'])$(id).hidden=true;window.GolfHome?.show('menu');$('create').disabled=false;$('join').disabled=false;GolfAdventure.reset();GolfAdventure.busy(false);GolfAudio?.phase('menu');}
  function sorted(){return room?[...room.players].sort((a,b)=>a.total-b.total||a.id-b.id):[];}
  function renderSummary(){
    if(!room)return;speedLabel.hidden=(room.simulationSpeed??1)<2||!['playing','settling'].includes(phase);speedLabel.textContent=t('botSpeed');const list=sorted();let visible=list.slice(0,5);const local=list.find(p=>p.id===identity?.id);if(local&&!visible.includes(local))visible.push(local);
    $('summary').replaceChildren(...visible.map(p=>{const row=playerRow(p),b=lastBalls.get(p.id);row.append(text('span',`${t('points',{count:p.total})} · ${b?.hole?'✓':t((b?.strokes??0)===1?'strokes.one':'strokes.other',{count:b?.strokes??0})}`));return row;}));
    const ball=lastBalls.get(identity?.id);
    $('help').textContent=ball?.hole?t('helpDone'):phase==='playing'
      ?t(touchControls?'helpTouch':'helpMouse')
      :phase==='settling'?t('helpSettling'):t(touchControls?'helpScoresTouch':'helpScoresMouse');
  }
  function showScores(force=false){
    if(!room)return;scoresForced=force;closeChat();$('scores').hidden=false;$('scores-title').textContent=t(phase==='finished'?'finalScores':phase==='results'?'holeScores':'matchScores');
    if(phase==='finished')$('winner-banner').textContent=t('winners',{names:sorted().filter(p=>p.total===sorted()[0]?.total).map(p=>p.nickname).join(', ')});
    $('score-note').textContent=t('scoresNote',{penalty:room.penalty});
    const head=text('tr','');head.append(text('th','#'),text('th',t('player')));
    for(let i=0;i<room.holes;i++)head.append(text('th',GolfI18n.courseName(GOLF_CAMPAIGN.courses[room.sequence[i]])||String(i+1)));head.append(text('th',t('total')));$('score-head').replaceChildren(head);
    $('score-body').replaceChildren(...sorted().map((p,index)=>{const row=document.createElement('tr');if(p.id===identity?.id)row.classList.add('local');if(phase==='finished'&&p.total===sorted()[0]?.total)row.classList.add('winner');row.append(text('td',String(index+1)));const name=document.createElement('td');name.append(playerRow(p));row.append(name);
      for(let i=0;i<room.holes;i++)row.append(text('td',p.scores[i]===undefined?'—':p.dnf[i]?`${p.scores[i]} DNF`:String(p.scores[i])));row.append(text('td',String(p.total)));return row;}));
    $('close-scores').hidden=force;$('finish-exit').hidden=phase!=='finished';
    $('play-again').hidden=phase!=='finished'||room.host!==identity?.id;
  }
  function renderSpectators(){
    if(!room)return;const enabled=lastBalls.get(identity?.id)?.hole||['results','finished'].includes(phase);$('spectator').hidden=!enabled;
    const old=$('spectate').value;const options=room.players.filter(p=>p.connected).map(p=>{const e=text('option',p.nickname);e.value=String(p.id);return e;});$('spectate').replaceChildren(...options);
    if(options.some(o=>o.value===old))$('spectate').value=old;else $('spectate').value=String(identity?.id);
  }
  window.GolfOnline={
    entry(){entryView(false);},
    active(){return online;},
    initialized(){initialized=true;window.GolfCourse.initialized=true;GolfI18n.ready();GolfAdventure.busy(false);$('engine-status').textContent=t('engineReady');$('create').disabled=false;$('join').disabled=false;window.GolfHome?.ready();
      if(window.GOLF_CAMPAIGN){$('holes').replaceChildren(...GOLF_CAMPAIGN.courses.map((_,i)=>{const option=new Option(String(i+1),String(i+1));option.selected=i===2;return option;}));}
      if(window.GolfHome?.route==='multiplayer')window.GolfOnline.resume();
      },
    resume(){try{const saved=JSON.parse(sessionStorage.getItem('golf-session'));if(saved&&initialized){identity=saved;online=true;connect({type:'reconnect',...saved});}}catch{}},
    preview(){presenting=true;$('loading').hidden=true;},
    ready(hole){loading=false;presenting=false;send({type:'ready',hole});},
    shot(direction,power){if(connected&&phase==='playing')send({type:'shot',direction,power,sequence:++sequence});else call({type:'error'});},
    cancelAim(){call({type:'cancel-aim'});},
    blocked(){return document.activeElement?.id==='toggle-match-info'||!document.getElementById('home').hidden||!$('connect').hidden||!$('level-selection').hidden||!$('solo-loading').hidden||document.getElementById('music-controls').open||online&&(loading||!connected||!$('scores').hidden||!$('adventure-modal').hidden||!$('lobby').hidden||!$('connect').hidden||!$('chat-panel').hidden||$('music-controls').open);}
  };
  window.addEventListener('languagechange',()=>{
    $('engine-status').textContent=t(initialized?'engineReady':'engineLoading');
    for(const group of $('profile-shortcuts').children)group.setAttribute('aria-label',t(group.dataset.i18nLabel));for(const button of $('profile-shortcuts').querySelectorAll('[data-field=avatar]'))button.setAttribute('aria-label',t('avatar'+button.dataset.value));
    $('open-chat').textContent=unreadChat?t('chatUnread',{count:unreadChat}):t('chat');
    if(!room)return;
    roomLabels();modeControls();renderProfile();
    renderMembers();
    botControls();
    poolControls(true);
    document.querySelector('[data-i18n="mapPolicy"]').textContent=t('mapPolicy',{count:room.availableMaps});
    $('host-note').textContent=t(room.host===identity?.id?'hostYou':'hostWait');
    $('hole').textContent=t('hole',{current:Math.min(room.hole+1,room.holes),total:room.holes});
    $('status').textContent=phase==='lobby'?'':t('phase.'+phase);
    $('mode-indicator').textContent=t('modeBadge.'+room.mode);
    $('loading-count').textContent=t('readyCount',{ready:room.players.filter(p=>p.ready&&p.connected).length,total:room.players.filter(p=>p.connected).length});
    renderSummary();if(!$('scores').hidden)showScores(scoresForced);
  });
  $('create').onclick=()=>join(true);$('join-form').onsubmit=e=>{e.preventDefault();join(false);};$('start').onclick=()=>{
    if(!room||room.host!==identity?.id)return;
    let holes=Number($('holes').value);
    if(room.mapPoolKind==='custom'){
      const ids=[...$('map-options').querySelectorAll('[data-map-id]:checked')].map(i=>Number(i.dataset.mapId));
      if(!ids.length){toast(t('selectOneMap'));return;}
      if(JSON.stringify(ids)!==JSON.stringify(room.mapPool))send({type:'map-pool',kind:'custom',ids});
      holes=Math.min(holes,ids.length);
    }
    send({type:'start',holes,mode:$('game-mode').value});
  };
  $('holes').onchange=$('game-mode').onchange=()=>{pendingConfig={holes:Number($('holes').value),mode:$('game-mode').value};startState();modeControls();send({type:'configure',...pendingConfig});};
  $('map-pool').onchange=()=>{const kind=$('map-pool').value;const ids=GOLF_CAMPAIGN.courses.map((_,i)=>i).filter(i=>kind==='custom'?room.mapPool.includes(i):kind==='all'||(kind==='originals'?GOLF_CAMPAIGN.courses[i].revision===0:GOLF_CAMPAIGN.courses[i].revision!==0));pendingPool={kind,ids};startState();send({type:'map-pool',...pendingPool});};
  $('apply-maps').onclick=()=>{
    const ids=[...$('map-options').querySelectorAll('[data-map-id]:checked')].map(input=>Number(input.dataset.mapId));
    if(!ids.length){toast(t('selectOneMap'));return;}
    pendingPool={kind:'custom',ids};startState();send({type:'map-pool',...pendingPool});
  };
  $('add-bot').onclick=()=>send({type:'bot',action:'add',settings:{difficulty:$('bot-difficulty-all').value}});
  $('apply-bot-count').onclick=()=>send({type:'bot',action:'count',settings:{count:Number($('bot-count').value),difficulty:$('bot-difficulty-all').value}});
  $('play-again').onclick=()=>send({type:'rematch'});
  $('leave').onclick=leave;$('finish-exit').onclick=leave;$('show-scores').onclick=()=>showScores();$('close-scores').onclick=()=>$('scores').hidden=true;
  $('spectate').onchange=()=>call({type:'spectate',id:Number($('spectate').value)});
  $('open-chat').onclick=openChat;$('close-chat').onclick=closeChat;
  $('chat-form').onsubmit=event=>{
    event.preventDefault();
    if(!identity||!connected){toast(t('chatWaitConnection'));return;}
    const message=$('chat-input').value.trim();if(!message||$('send-chat').disabled)return;
    send({type:'chat',text:message});$('send-chat').disabled=true;
    clearTimeout(chatCooldown);chatCooldown=setTimeout(()=>$('send-chat').disabled=false,1000);
  };
  $('lobby-leave').onclick=leave;
  $('lobby-open-chat').onclick=openChat;
  document.addEventListener('keydown',e=>{if(e.key==='Tab'&&online&&!['lobby','loading'].includes(phase)){e.preventDefault();showScores(phase==='results'||phase==='finished');}});
  document.addEventListener('keyup',e=>{if(e.key==='Tab'&&online&&!['results','finished'].includes(phase))$('scores').hidden=true;});
  let lastCountdown;
  setInterval(()=>{if(room){const seconds=Math.max(0,Math.ceil((deadline-performance.now())*playbackSpeed/1000));$('timer').textContent=phase==='finished'?t('final'):seconds+'s';if(phase==='playing'&&seconds<=5&&seconds>0&&lastCountdown!==seconds)GolfAudio?.play('countdown');lastCountdown=seconds;}},100);
  try{const p=JSON.parse(localStorage.getItem('golf-profile'));if(p){$('nickname').value=p.nickname;$('color').value=p.color;$('avatar').value=String(p.avatar);}}catch{}
  previewProfile();
})();
