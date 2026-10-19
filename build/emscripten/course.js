(() => {
  'use strict';
  const $=id=>document.getElementById(id),t=key=>GolfI18n.t(key);
  let geometry,level,base,frame,collapsed=false,last=0;
  let lastSlap=-100,lastWake=-100,soloStarted=-1,effectLevel=-1;
  const heard=new Map(),effectNames=['','romeu','luna','frida','portal'];
  const worldLabel=document.createElement('small'),effectLabel=document.createElement('small');
  worldLabel.id='campaign-world';effectLabel.id='wildlife-effect';effectLabel.setAttribute('role','status');
  $('minimap').append(worldLabel,effectLabel);
  const canvas=$('minimap-canvas'),ctx=canvas.getContext('2d');
  const size=240,padding=14;
  function point(p){
    const [x,z,maxx,maxz]=geometry.bounds;
    const scale=(size-padding*2)/Math.max(maxx-x,maxz-z,.1);
    return [size/2+(p[0]-(x+maxx)/2)*scale,size/2+(p[1]-(z+maxz)/2)*scale];
  }
  function background(){
    base=document.createElement('canvas');base.width=base.height=size;
    const c=base.getContext('2d');c.fillStyle='#f5e9ce';c.fillRect(0,0,size,size);
    for(const tri of [...geometry.triangles].sort((a,b)=>(a[6]===3?-1:a[6])-(b[6]===3?-1:b[6]))){
      const a=point(tri.slice(0,2)),b=point(tri.slice(2,4)),d=point(tri.slice(4,6));
      c.fillStyle=['#95ae75','#997650','#6e795b','#86b9c6'][tri[6]];c.beginPath();c.moveTo(...a);c.lineTo(...b);c.lineTo(...d);c.closePath();c.fill();
    }
    const start=point(geometry.start),hole=point(geometry.hole);
    const angle=Math.atan2(hole[1]-start[1],hole[0]-start[0]),tip=[start[0]+12*Math.cos(angle),start[1]+12*Math.sin(angle)];
    c.strokeStyle='#526b48';c.lineWidth=2;c.beginPath();c.moveTo(...start);c.lineTo(...tip);c.lineTo(tip[0]-5*Math.cos(angle-.6),tip[1]-5*Math.sin(angle-.6));c.moveTo(...tip);c.lineTo(tip[0]-5*Math.cos(angle+.6),tip[1]-5*Math.sin(angle+.6));c.stroke();
    c.font='19px sans-serif';c.fillText('⚑',hole[0]-4,hole[1]+3);c.fillStyle='#b74a36';c.fillText('⚑',hole[0]-4,hole[1]+3);
  }
  function draw(){
    ctx.drawImage(base,0,0);ctx.font='18px sans-serif';ctx.textAlign='center';
    ctx.fillStyle='#997650';for(const box of frame.obstacles??[]){const a=point(box.slice(0,2)),b=point(box.slice(2,4));ctx.fillRect(a[0],a[1],Math.max(2,b[0]-a[0]),Math.max(2,b[1]-a[1]));}
    for(const [p,icon,active] of [[frame.cat,'🐈',frame.catActive],[frame.dog,'🐕',frame.dogActive]]){if(active===false)continue;const v=point(p);ctx.fillText(icon,v[0],v[1]+6);}
    for(const a of frame.wildlife??[]){if(!a.active)continue;const v=point([a.pos[0],a.pos[2]]);ctx.fillStyle=['#5585af','#34363c','#f8f5e6'][a.kind];ctx.beginPath();ctx.arc(...v,7,0,Math.PI*2);ctx.fill();ctx.fillStyle=a.kind===2?'#30343b':'#fff';ctx.font='bold 10px sans-serif';ctx.fillText(['R','L','F'][a.kind],v[0],v[1]+3);}
    for(const p of frame.players){
      if(!p.visible)continue;const v=point(p.pos);ctx.beginPath();ctx.arc(v[0],v[1],p.id===frame.local?5:3,0,Math.PI*2);
      const protectedBall=frame.mode==='impact'&&!p.firstComplete;ctx.globalAlpha=protectedBall?.72:1;
      ctx.fillStyle=`rgb(${p.color.map(n=>Math.round(n*255)).join(',')})`;ctx.fill();ctx.globalAlpha=1;
      if(protectedBall){ctx.strokeStyle='#8dd2ed';ctx.lineWidth=2;ctx.stroke();}
      if(p.id===frame.local){ctx.strokeStyle='#fffaf0';ctx.lineWidth=2;ctx.stroke();}
    }
  }
  function matchLabels(){
    if(!frame)return;
    const world=window.GOLF_CAMPAIGN?.worlds[frame.world-1];
    worldLabel.textContent=world?`${world.names[GolfI18n.language]??world.names.en} · ${GolfI18n.t('stageNumber',{number:frame.stage})}`:'';
    const local=frame.players.find(p=>p.id===frame.local);
    const effect=local&&(local.captureKind||local.slowUntil>frame.time&&1);
    effectLabel.textContent=effect?GolfI18n.t('effect.'+effectNames[effect]):'';
    $('minimap-legend').textContent=t('minimapLegend')+((frame.wildlife??[]).some(a=>a.active)?' · '+t('animalLegend'):'');
  }
  function update(now){
    requestAnimationFrame(update);if(now-last<100||!window.Module?.ccall||!window.GolfCourse?.initialized)return;last=now;
    frame=JSON.parse(Module.ccall('golf_course_frame','string',[],[]));
    if(frame.active&&frame.world>0&&$('connect').hidden&&$('lobby').hidden)window.GolfMusic?.world(frame.world);
    if(effectLevel!==frame.level){effectLevel=frame.level;heard.clear();}
    GolfAdventure.select(JSON.parse(Module.ccall('golf_ui_level_selection','string',[],[])));
    if(window.GolfAudio&&!GolfAudio.status().network){
      if(frame.active&&!frame.intro&&soloStarted!==frame.level){soloStarted=frame.level;GolfAudio.phase('game');}
      if(frame.slapTime>lastSlap&&frame.slapTime>=0)GolfAudio.play('slap');
      if(frame.wakeTime>lastWake&&frame.wakeTime>=0)GolfAudio.play('capture');
      for(const p of frame.players){const previous=heard.get(p.id)??0;if(p.effectSerial>previous&&p.effectKind)GolfAudio.play(effectNames[p.effectKind]);heard.set(p.id,p.effectSerial);}
    }
    lastSlap=frame.slapTime;lastWake=frame.wakeTime;
    $('minimap').hidden=!frame.active;$('presentation').hidden=!frame.active||!frame.intro;
    if(!frame.active)return;
    matchLabels();
    $('presentation-progress').value=Math.min(1,frame.progress);
    if(level!==frame.level||!geometry){level=frame.level;geometry=JSON.parse(Module.ccall('golf_course_geometry','string',[],[]));background();}
    if(!collapsed)draw();
  }
  $('skip-presentation').onclick=()=>Module.ccall('golf_course_skip',null,[],[]);
  $('toggle-minimap').onclick=()=>{collapsed=!collapsed;canvas.hidden=collapsed;$('minimap-legend').hidden=collapsed;$('toggle-minimap').setAttribute('aria-expanded',String(!collapsed));};
  function language(){canvas.setAttribute('aria-label',t('minimapLabel'));$('minimap-legend').textContent=t('minimapLegend');matchLabels();}
  window.addEventListener('languagechange',language);language();
  window.GolfCourse={initialized:false,inspect:()=>({frame,geometry,collapsed})};requestAnimationFrame(update);
})();
