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
  const avatars=['⛳','🏌️','⭐','🌙','🍀','🔥','🌊','🎯'];
  const send=m=>{if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(m));};
  const call=m=>{if(initialized) Module.ccall('golf_online_receive',null,['string'],[JSON.stringify(m)]);};
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function profile(){return {nickname:$('nickname').value.trim(),color:$('color').value,avatar:Number($('avatar').value)};}
  function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
  function playerRow(p){const row=document.createElement('div');row.className='player';const dot=document.createElement('span');dot.className='dot';dot.style.background=p.color;row.append(dot,text('span',`${avatars[p.avatar]??''} ${p.nickname}${p.id===identity?.id?' · '+t('you'):''}${p.connected?'':' · '+t('disconnected')}`));return row;}
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
        $('members').replaceChildren(...m.players.map(playerRow));$('start').hidden=m.host!==identity?.id;
        $('host-note').textContent=t(m.host===identity?.id?'hostYou':'hostWait');
        $('hole').textContent=t('hole',{current:Math.min(m.hole+1,m.holes),total:m.holes});
        $('status').textContent=phase==='lobby'?'':t('phase.'+phase);
        $('loading').hidden=phase!=='loading'||presenting;$('loading-count').textContent=t('readyCount',{ready:m.players.filter(p=>p.ready&&p.connected).length,total:m.players.filter(p=>p.connected).length});
        $('game-mode').disabled=m.host!==identity?.id;if(m.host!==identity?.id||phase!=='lobby')$('game-mode').value=m.mode;
        $('mode-indicator').textContent=t('modeBadge.'+m.mode);
        if(phase==='results'||phase==='finished') showScores(true);else if(previous==='results') $('scores').hidden=true;
        renderSummary();renderSpectators();
      } else if(m.type==='load'){
        loading=true;presenting=false;lastBalls.clear();call(m);$('scores').hidden=true;
      } else if(m.type==='snapshot'){
        if(!room||m.hole!==room.hole)return;
        if(m.full)lastBalls.clear();for(const b of m.players)lastBalls.set(b.id,b);
        deadline=performance.now()+m.remaining;call(m);renderSummary();renderSpectators();
      } else if(m.type==='shot'){call(m);
      } else if(m.type==='error'){
        if(m.scope!=='chat')call(m);toast(GolfI18n.error(m));
        if(!identity){$('create').disabled=false;$('join').disabled=false;}
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
    connect({type:create?'create':'join',code:$('join-code').value.trim().toUpperCase(),...p});
  }
  function leave(){++epoch;connected=false;online=false;identity=undefined;room=undefined;phase='lobby';lastBalls.clear();clearTimeout(retryTimer);sessionStorage.removeItem('golf-session');socket?.close();call({type:'leave'});
    closeChat();clearTimeout(chatCooldown);$('send-chat').disabled=false;$('chat-input').value='';$('chat-messages').replaceChildren();lastChatId=0;unreadChat=0;$('open-chat').textContent=t('chat');
    for(const id of ['lobby','hud','actions','help','scores','loading'])$(id).hidden=true;$('connect').hidden=false;$('create').disabled=false;$('join').disabled=false;}
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
    $('score-note').textContent=t('scoresNote',{penalty:room.penalty});
    const head=text('tr','');head.append(text('th','#'),text('th',t('player')));
    for(let i=0;i<room.holes;i++)head.append(text('th',String(i+1)));head.append(text('th',t('total')));$('score-head').replaceChildren(head);
    $('score-body').replaceChildren(...sorted().map((p,index)=>{const row=document.createElement('tr');if(p.id===identity?.id)row.className='local';row.append(text('td',String(index+1)));const name=document.createElement('td');name.append(playerRow(p));row.append(name);
      for(let i=0;i<room.holes;i++)row.append(text('td',p.scores[i]===undefined?'—':p.dnf[i]?`${p.scores[i]} DNF`:String(p.scores[i])));row.append(text('td',String(p.total)));return row;}));
    $('close-scores').hidden=force;$('finish-exit').hidden=phase!=='finished';
  }
  function renderSpectators(){
    if(!room)return;const enabled=lastBalls.get(identity?.id)?.hole||['results','finished'].includes(phase);$('spectator').hidden=!enabled;
    const old=$('spectate').value;const options=room.players.filter(p=>p.connected).map(p=>{const e=text('option',p.nickname);e.value=String(p.id);return e;});$('spectate').replaceChildren(...options);
    if(options.some(o=>o.value===old))$('spectate').value=old;else $('spectate').value=String(identity?.id);
  }
  window.GolfOnline={
    initialized(){initialized=true;window.GolfCourse.initialized=true;GolfI18n.ready();$('engine-status').textContent=t('engineReady');$('create').disabled=false;$('join').disabled=false;$('offline').disabled=false;
      try{const saved=JSON.parse(sessionStorage.getItem('golf-session'));if(saved){identity=saved;online=true;connect({type:'reconnect',...saved});}}catch{}},
    preview(){presenting=true;$('loading').hidden=true;},
    ready(hole){loading=false;presenting=false;send({type:'ready',hole});},
    shot(direction,power){if(connected&&phase==='playing')send({type:'shot',direction,power,sequence:++sequence});else call({type:'error'});},
    cancelAim(){call({type:'cancel-aim'});},
    blocked(){return document.getElementById('music-controls').open||online&&(loading||!connected||!$('scores').hidden||!$('lobby').hidden||!$('connect').hidden||!$('chat-panel').hidden||$('music-controls').open);}
  };
  window.addEventListener('languagechange',()=>{
    $('engine-status').textContent=t(initialized?'engineReady':'engineLoading');
    $('open-chat').textContent=unreadChat?t('chatUnread',{count:unreadChat}):t('chat');
    if(!room)return;
    $('count').textContent=t('players',{count:room.players.filter(p=>p.connected).length});
    $('members').replaceChildren(...room.players.map(playerRow));
    $('host-note').textContent=t(room.host===identity?.id?'hostYou':'hostWait');
    $('hole').textContent=t('hole',{current:Math.min(room.hole+1,room.holes),total:room.holes});
    $('status').textContent=phase==='lobby'?'':t('phase.'+phase);
    $('mode-indicator').textContent=t('modeBadge.'+room.mode);
    $('loading-count').textContent=t('readyCount',{ready:room.players.filter(p=>p.ready&&p.connected).length,total:room.players.filter(p=>p.connected).length});
    renderSummary();if(!$('scores').hidden)showScores(scoresForced);
  });
  $('create').onclick=()=>join(true);$('join').onclick=()=>join(false);$('start').onclick=()=>send({type:'start',holes:Number($('holes').value),mode:$('game-mode').value});
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
  setInterval(()=>{if(room)$('timer').textContent=phase==='finished'?t('final'):Math.max(0,Math.ceil((deadline-performance.now())/1000))+'s';},100);
  try{const p=JSON.parse(localStorage.getItem('golf-profile'));if(p){$('nickname').value=p.nickname;$('color').value=p.color;$('avatar').value=String(p.avatar);}}catch{}
})();
