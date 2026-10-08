(() => {
  'use strict';
  const $=id=>document.getElementById(id);
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
  const avatars=['⛳','🏌️','⭐','🌙','🍀','🔥','🌊','🎯'];
  const send=m=>{if(socket?.readyState===WebSocket.OPEN) socket.send(JSON.stringify(m));};
  const call=m=>{if(initialized) Module.ccall('golf_online_receive',null,['string'],[JSON.stringify(m)]);};
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function profile(){return {nickname:$('nickname').value.trim(),color:$('color').value,avatar:Number($('avatar').value)};}
  function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
  function playerRow(p){const row=document.createElement('div');row.className='player';const dot=document.createElement('span');dot.className='dot';dot.style.background=p.color;row.append(dot,text('span',`${avatars[p.avatar]??''} ${p.nickname}${p.id===identity?.id?' · você':''}${p.connected?'':' · desconectado'}`));return row;}
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
        sessionStorage.setItem('golf-session',JSON.stringify(identity));call(m);$('connect').hidden=true;$('actions').hidden=false;
      } else if(m.type==='room'){
        const previous=phase;room=m;phase=m.phase;deadline=performance.now()+m.remaining;call(m);
        $('lobby').hidden=phase!=='lobby';$('hud').hidden=phase==='lobby';$('help').hidden=phase==='lobby';
        $('room-code').textContent=m.code;$('count').textContent=`${m.players.filter(p=>p.connected).length}/50 jogadores`;
        $('members').replaceChildren(...m.players.map(playerRow));$('start').hidden=m.host!==identity?.id;
        $('host-note').textContent=m.host===identity?.id?'Você é o anfitrião.':'Aguardando o anfitrião iniciar.';
        $('hole').textContent=`Mapa ${Math.min(m.hole+1,m.holes)} / ${m.holes}`;
        $('status').textContent=({loading:'Carregando mapas…',playing:'Tacadas simultâneas',settling:'Últimas bolas em movimento',results:'Resultado do mapa',finished:'Partida encerrada'})[phase]??'';
        $('loading').hidden=phase!=='loading';$('loading-count').textContent=`${m.players.filter(p=>p.ready&&p.connected).length} / ${m.players.filter(p=>p.connected).length} prontos`;
        if(phase==='results'||phase==='finished') showScores(true);else if(previous==='results') $('scores').hidden=true;
        renderSummary();renderSpectators();
      } else if(m.type==='load'){
        loading=true;lastBalls.clear();call(m);$('scores').hidden=true;
      } else if(m.type==='snapshot'){
        if(!room||m.hole!==room.hole)return;
        if(m.full)lastBalls.clear();for(const b of m.players)lastBalls.set(b.id,b);
        deadline=performance.now()+m.remaining;call(m);renderSummary();renderSpectators();
      } else if(m.type==='shot'){call(m);
      } else if(m.type==='error'){
        call(m);toast(m.message);
        if(!identity){$('create').disabled=false;$('join').disabled=false;}
        if(m.message==='Reconexão expirada.'||m.message==='Sala não encontrada.') leave();
      }
    };
    socket.onerror=()=>{if(generation===epoch)toast('Não foi possível conectar ao servidor.');};
    socket.onclose=()=>{
      if(generation!==epoch)return;
      connected=false;call({type:'disconnected'});
      if(online&&identity){
        if(!reconnectStart)reconnectStart=performance.now();
        if(performance.now()-reconnectStart<60000){toast('Conexão perdida. Reconectando…');retryTimer=setTimeout(()=>connect({type:'reconnect',...identity}),1500);}
        else{toast('Reconexão expirada. Entre em uma nova sala.');leave();}
      } else {$('create').disabled=false;$('join').disabled=false;}
    };
  }
  function join(create){
    const p=profile();if(!/^[\x20-\x7e]{1,24}$/.test(p.nickname)){toast('Use um nickname ASCII de 1 a 24 caracteres.');return;}
    localStorage.setItem('golf-profile',JSON.stringify(p));$('create').disabled=true;$('join').disabled=true;
    connect({type:create?'create':'join',code:$('join-code').value.trim().toUpperCase(),...p});
  }
  function leave(){++epoch;connected=false;online=false;identity=undefined;room=undefined;phase='lobby';lastBalls.clear();clearTimeout(retryTimer);sessionStorage.removeItem('golf-session');socket?.close();call({type:'leave'});
    for(const id of ['lobby','hud','actions','help','scores','loading'])$(id).hidden=true;$('connect').hidden=false;$('create').disabled=false;$('join').disabled=false;}
  function sorted(){return room?[...room.players].sort((a,b)=>a.total-b.total||a.id-b.id):[];}
  function renderSummary(){
    if(!room)return;const list=sorted();let visible=list.slice(0,5);const local=list.find(p=>p.id===identity?.id);if(local&&!visible.includes(local))visible.push(local);
    $('summary').replaceChildren(...visible.map(p=>{const row=playerRow(p),b=lastBalls.get(p.id);row.append(text('span',`${p.total} pts · ${b?.hole?'✓':(b?.strokes??0)+' tac.'}`));return row;}));
    const ball=lastBalls.get(identity?.id);
    $('help').textContent=ball?.hole?'Você concluiu! Acompanhe outros jogadores.':phase==='playing'
      ?touchControls?'Toque na bola, arraste para mirar e solte para tacar. Arraste fora da bola para girar a câmera.':'Clique no círculo da bola para mirar; mova o mouse e clique para tacar. Arraste para girar a câmera. Tab: placar.'
      :phase==='settling'?'Tempo esgotado. Aguardando as bolas pararem.':touchControls?'Toque em Placar para ver a classificação.':'Tab: placar completo';
  }
  function showScores(force=false){
    if(!room)return;$('scores').hidden=false;$('scores-title').textContent=phase==='finished'?'Classificação final':phase==='results'?'Resultado do mapa':'Placar da partida';
    $('score-note').textContent=`Menos pontos vence. DNF: ${room.penalty} pontos por mapa não concluído.`;
    const head=text('tr','');head.append(text('th','#'),text('th','Jogador'));
    for(let i=0;i<room.holes;i++)head.append(text('th',String(i+1)));head.append(text('th','Total'));$('score-head').replaceChildren(head);
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
    initialized(){initialized=true;$('engine-status').textContent='Pronto para jogar';$('create').disabled=false;$('join').disabled=false;$('offline').disabled=false;
      try{const saved=JSON.parse(sessionStorage.getItem('golf-session'));if(saved){identity=saved;online=true;connect({type:'reconnect',...saved});}}catch{}},
    ready(hole){loading=false;send({type:'ready',hole});},
    shot(direction,power){if(connected&&phase==='playing')send({type:'shot',direction,power,sequence:++sequence});else call({type:'error'});},
    blocked(){return online&&(loading||!connected||!$('scores').hidden||!$('lobby').hidden||!$('connect').hidden);}
  };
  $('create').onclick=()=>join(true);$('join').onclick=()=>join(false);$('start').onclick=()=>send({type:'start',holes:Number($('holes').value)});
  $('leave').onclick=leave;$('finish-exit').onclick=leave;$('show-scores').onclick=()=>showScores();$('close-scores').onclick=()=>$('scores').hidden=true;
  $('spectate').onchange=()=>call({type:'spectate',id:Number($('spectate').value)});
  $('offline').onclick=()=>{$('connect').hidden=true;online=false;};
  document.addEventListener('keydown',e=>{if(e.key==='Tab'&&online){e.preventDefault();showScores(phase==='results'||phase==='finished');}});
  document.addEventListener('keyup',e=>{if(e.key==='Tab'&&online&&!['results','finished'].includes(phase))$('scores').hidden=true;});
  setInterval(()=>{if(room)$('timer').textContent=phase==='finished'?'Final':Math.max(0,Math.ceil((deadline-performance.now())/1000))+'s';},100);
  try{const p=JSON.parse(localStorage.getItem('golf-profile'));if(p){$('nickname').value=p.nickname;$('color').value=p.color;$('avatar').value=String(p.avatar);}}catch{}
})();
