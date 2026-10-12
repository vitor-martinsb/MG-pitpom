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
  let celebrated=false;
  const avatars=['⛳','🏌️','⭐','🌙','🍀','🔥','🌊','🎯'];
  const send=m=>{if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(m));};
  const call=m=>{if(initialized) Module.ccall('golf_online_receive',null,['string'],[JSON.stringify(m)]);};
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function profile(){return {nickname:$('nickname').value.trim(),color:$('color').value,avatar:Number($('avatar').value)};}
  function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
  function playerRow(p){const row=document.createElement('div');row.className='player';const dot=document.createElement('span');dot.className='dot';dot.style.background=p.color;row.append(dot,text('span',`${p.bot?'🤖':avatars[p.avatar]??''} ${p.nickname}${p.id===identity?.id?' · '+t('you'):''}${p.connected?'':' · '+t('disconnected')}`));if(p.bot){const badge=text('small',t('difficulty.'+p.bot));badge.className='bot-badge';row.append(badge);}if(room?.mode==='impact'&&!lastBalls.get(p.id)?.firstComplete){const shield=text('small','🛡');shield.title=t('protected');row.append(shield);}return row;}
  function lobbyRow(p){
    if(!p.bot||room.host!==identity?.id)return playerRow(p);
    const row=document.createElement('div');row.className='bot-row';row.append(playerRow(p));
    const controls=document.createElement('div');controls.className='bot-controls';
    const name=document.createElement('input');name.value=p.nickname;name.maxLength=24;name.setAttribute('aria-label',t('botName'));
    const difficulty=document.createElement('select');difficulty.setAttribute('aria-label',t('botDifficulty'));
    for(const level of ['easy','medium','hard']){const option=text('option',t('difficulty.'+level));option.value=level;difficulty.append(option);}difficulty.value=p.bot;
    const color=document.createElement('input');color.type='color';color.value=p.color;color.setAttribute('aria-label',t('ballColor'));
    const apply=text('button',t('applyBot'));apply.onclick=()=>send({type:'bot',action:'update',id:p.id,settings:{nickname:name.value,color:color.value,difficulty:difficulty.value}});
    const remove=text('button',t('removeBot'));remove.className='secondary';remove.onclick=()=>send({type:'bot',action:'remove',id:p.id});
    controls.append(name,difficulty,color);row.append(controls,apply,remove);return row;
  }
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
        sessionStorage.setItem('golf-session',JSON.stringify(identity));call(m);$('connect').hidden=true;$('actions').hidden=false;$('send-chat').disabled=false;
      } else if(m.type==='chat-history'){
        lastChatId=0;unreadChat=0;$('open-chat').textContent=t('chat');$('chat-messages').replaceChildren();
        for(const message of m.messages)appendChat(message,true);
      } else if(m.type==='chat'){
        appendChat(m);
      } else if(m.type==='room'){
        const previous=phase;room=m;phase=m.phase;deadline=performance.now()+m.remaining;call(m);
        $('lobby').hidden=phase!=='lobby';$('hud').hidden=phase==='lobby';$('help').hidden=phase==='lobby';
        $('room-code').textContent=m.code;$('count').textContent=t('players',{count:m.players.filter(p=>p.connected).length});
        $('members').replaceChildren(...m.players.map(lobbyRow));$('start').hidden=m.host!==identity?.id;$('start').disabled=m.host!==identity?.id;
        $('holes').disabled=m.host!==identity?.id;$('holes').value=String(m.holes);$('game-mode').value=m.mode;
        for(const option of $('holes').options)option.disabled=Number(option.value)>m.availableMaps;
        $('add-bot').disabled=m.host!==identity?.id||m.players.length>=50;
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
        deadline=performance.now()+m.remaining;call(m);GolfAudio?.events(m.events??[],m.hole);renderSummary();renderSpectators();
      } else if(m.type==='shot'){call(m);
      } else if(m.type==='error'){
        if(m.scope!=='chat')call(m);toast(GolfI18n.error(m));
        if(!identity){$('create').disabled=false;$('join').disabled=false;GolfAdventure.busy(false);}
        if(['RECONNECT_EXPIRED','ROOM_NOT_FOUND'].includes(m.code)||m.message==='Reconexão expirada.'||m.message==='Sala não encontrada.') leave();
      }
    };
    socket.onerror=()=>{if(generation===epoch)toast(t('connectionFailed'));};
    socket.onclose=()=>{
      if(generation!==epoch)return;
      connected=false;call({type:'disconnected'});
      if(online&&identity){
        if(!reconnectStart)reconnectStart=performance.now();
        if(performance.now()-reconnectStart<60000){toast(t('reconnecting'));retryTimer=setTimeout(()=>connect({type:'reconnect',...identity}),1500);}
        else{toast(t('reconnectExpired'));leave();}
      } else {$('create').disabled=false;$('join').disabled=false;}
    };
  }
  function join(create){
    const p=profile();if(!/^[\x20-\x7e]{1,24}$/.test(p.nickname)){toast(t('error.INVALID_NICKNAME'));return;}
    localStorage.setItem('golf-profile',JSON.stringify(p));$('create').disabled=true;$('join').disabled=true;
    GolfAdventure.busy(true);celebrated=false;$('winner-banner').hidden=true;GolfAudio?.phase('menu');
    connect({type:create?'create':'join',code:$('join-code').value.trim().toUpperCase(),...p});
  }
  function leave(){++epoch;connected=false;online=false;identity=undefined;room=undefined;phase='lobby';lastBalls.clear();clearTimeout(retryTimer);sessionStorage.removeItem('golf-session');socket?.close();call({type:'leave'});
    closeChat();clearTimeout(chatCooldown);$('send-chat').disabled=false;$('chat-input').value='';$('chat-messages').replaceChildren();lastChatId=0;unreadChat=0;$('open-chat').textContent=t('chat');
    for(const id of ['lobby','hud','actions','help','scores','loading','adventure-modal','celebration'])$(id).hidden=true;$('connect').hidden=false;$('create').disabled=false;$('join').disabled=false;GolfAdventure.reset();GolfAdventure.busy(false);GolfAudio?.phase('menu');}
  function sorted(){return room?[...room.players].sort((a,b)=>a.total-b.total||a.id-b.id):[];}
  function renderSummary(){
    if(!room)return;const list=sorted();let visible=list.slice(0,5);const local=list.find(p=>p.id===identity?.id);if(local&&!visible.includes(local))visible.push(local);
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
    for(let i=0;i<room.holes;i++)head.append(text('th',String(i+1)));head.append(text('th',t('total')));$('score-head').replaceChildren(head);
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
    active(){return online;},
    initialized(){initialized=true;window.GolfCourse.initialized=true;GolfI18n.ready();GolfAdventure.busy(false);$('engine-status').textContent=t('engineReady');$('create').disabled=false;$('join').disabled=false;$('offline').disabled=false;
      try{const saved=JSON.parse(sessionStorage.getItem('golf-session'));if(saved){identity=saved;online=true;connect({type:'reconnect',...saved});}}catch{}},
    preview(){presenting=true;$('loading').hidden=true;},
    ready(hole){loading=false;presenting=false;send({type:'ready',hole});},
    shot(direction,power){if(connected&&phase==='playing')send({type:'shot',direction,power,sequence:++sequence});else call({type:'error'});},
    cancelAim(){call({type:'cancel-aim'});},
    blocked(){return !$('level-selection').hidden||!$('solo-loading').hidden||document.getElementById('music-controls').open||online&&(loading||!connected||!$('scores').hidden||!$('adventure-modal').hidden||!$('lobby').hidden||!$('connect').hidden||!$('chat-panel').hidden||$('music-controls').open);}
  };
  window.addEventListener('languagechange',()=>{
    $('engine-status').textContent=t(initialized?'engineReady':'engineLoading');
    $('open-chat').textContent=unreadChat?t('chatUnread',{count:unreadChat}):t('chat');
    if(!room)return;
    $('count').textContent=t('players',{count:room.players.filter(p=>p.connected).length});
    $('members').replaceChildren(...room.players.map(lobbyRow));
    document.querySelector('[data-i18n="mapPolicy"]').textContent=t('mapPolicy',{count:room.availableMaps});
    $('host-note').textContent=t(room.host===identity?.id?'hostYou':'hostWait');
    $('hole').textContent=t('hole',{current:Math.min(room.hole+1,room.holes),total:room.holes});
    $('status').textContent=phase==='lobby'?'':t('phase.'+phase);
    $('mode-indicator').textContent=t('modeBadge.'+room.mode);
    $('loading-count').textContent=t('readyCount',{ready:room.players.filter(p=>p.ready&&p.connected).length,total:room.players.filter(p=>p.connected).length});
    renderSummary();if(!$('scores').hidden)showScores(scoresForced);
  });
  $('create').onclick=()=>join(true);$('join').onclick=()=>join(false);$('start').onclick=()=>send({type:'start',holes:Number($('holes').value),mode:$('game-mode').value});
  $('holes').onchange=$('game-mode').onchange=()=>send({type:'configure',holes:Number($('holes').value),mode:$('game-mode').value});
  $('add-bot').onclick=()=>send({type:'bot',action:'add'});
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
  $('offline').onclick=()=>{$('connect').hidden=true;online=false;};
  document.addEventListener('keydown',e=>{if(e.key==='Tab'&&online){e.preventDefault();showScores(phase==='results'||phase==='finished');}});
  document.addEventListener('keyup',e=>{if(e.key==='Tab'&&online&&!['results','finished'].includes(phase))$('scores').hidden=true;});
  let lastCountdown;
  setInterval(()=>{if(room){const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));$('timer').textContent=phase==='finished'?t('final'):seconds+'s';if(phase==='playing'&&seconds<=5&&seconds>0&&lastCountdown!==seconds)GolfAudio?.play('countdown');lastCountdown=seconds;}},100);
  try{const p=JSON.parse(localStorage.getItem('golf-profile'));if(p){$('nickname').value=p.nickname;$('color').value=p.color;$('avatar').value=String(p.avatar);}}catch{}
})();
