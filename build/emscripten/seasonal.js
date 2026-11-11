(() => {
  'use strict';
  const $=id=>document.getElementById(id),t=(key,values)=>GolfI18n.t('season.'+key,values);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const defaults={theme:'original',skin:0,trail:0,obstacles:false};let prefs={...defaults},room,localId,nativeKey='',lastLevel=-1,lastTime=-1,finished=new Set(),burstUntil=0,oneShot=false,lastRoomPhase,appliedTheme,cosmeticsDirty=false;
  try{const p=JSON.parse(localStorage.getItem('pitpom-season')||'{}');prefs={theme:p.theme==='christmas'?'christmas':'original',skin:Number.isInteger(p.skin)&&p.skin>=0&&p.skin<5?p.skin:0,trail:Number.isInteger(p.trail)&&p.trail>=0&&p.trail<5?p.trail:0,obstacles:p.obstacles===true};}catch{}
  const theme=()=>room?.seasonal?.theme??prefs.theme;
  const node=(tag,key)=>{const n=document.createElement(tag);if(key){n.textContent=t(key);n.dataset.i18n='season.'+key;}return n;};
  function select(id,label,keys,parent){const wrap=node('label',label),s=node('select');s.id=id;for(const [value,key] of keys){const o=node('option',key);o.value=value;s.append(o);}wrap.htmlFor=id;parent.append(wrap,s);return s;}
  const settings=node('fieldset'),legend=node('legend','title');settings.className='season-settings';settings.append(legend);$('music-controls').querySelector('.music-panel').append(settings);
  const themeSelect=select('season-theme','theme',[['original','original'],['christmas','christmas']],settings);
  const mechanics=node('label'),mechanicsInput=node('input');mechanicsInput.type='checkbox';mechanicsInput.id='season-obstacles';mechanics.append(mechanicsInput,node('span','obstacles'));settings.append(mechanics,node('small','nextCourse'));
  const cosmetics=node('div');cosmetics.className='season-cosmetics';$('profile-form').insertBefore(cosmetics,$('save-profile'));
  const ball=select('season-skin','ball',Array.from({length:5},(_,i)=>[i,'skin'+i]),cosmetics),trail=select('season-trail','trail',Array.from({length:5},(_,i)=>[i,'trail'+i]),cosmetics),cosmeticNote=node('small','cosmeticNote');cosmetics.append(cosmeticNote);
  const localCosmetics=node('div');settings.append(localCosmetics);
  const localBall=select('season-local-skin','ball',Array.from({length:5},(_,i)=>[i,'skin'+i]),localCosmetics),localTrail=select('season-local-trail','trail',Array.from({length:5},(_,i)=>[i,'trail'+i]),localCosmetics),localCosmeticNote=node('small','cosmeticNote');localCosmetics.append(localCosmeticNote);
  const event=node('fieldset');event.className='season-settings';event.append(node('legend','event'));$('panel-mode').append(event);
  const roomTheme=select('room-season-theme','theme',[['original','original'],['christmas','christmas']],event);
  const tournament=node('label'),tournamentInput=node('input');tournamentInput.type='checkbox';tournamentInput.id='season-tournament';tournament.append(tournamentInput,node('span','tournament'));
  const hazards=node('label'),hazardsInput=node('input');hazardsInput.type='checkbox';hazardsInput.id='room-season-obstacles';hazards.append(hazardsInput,node('span','obstacles'));event.append(tournament,hazards,node('p','rules'));
  const subtitle=node('small','subtitle');subtitle.className='season-subtitle';$('home').querySelector('.home-brand').append(subtitle);
  const tournamentTitle=node('p','tournament');tournamentTitle.id='season-score-title';tournamentTitle.hidden=true;$('scores-title').after(tournamentTitle);
  const trophy=node('p');trophy.id='season-trophy';trophy.setAttribute('role','status');$('winner-banner').after(trophy);
  const announcement=node('div');announcement.id='season-announcement';announcement.setAttribute('role','status');announcement.hidden=true;document.body.append(announcement);
  const canvas=node('canvas');canvas.id='season-atmosphere';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);const ctx=canvas.getContext('2d');let raf=0,previous=0;
  function persist(){try{localStorage.setItem('pitpom-season',JSON.stringify(prefs));}catch{}apply();}
  function native(){if(!window.GolfCourse?.initialized)return;const key=[theme()==='christmas'?1:0,prefs.skin,prefs.trail,!room&&prefs.obstacles?1:0].join(',');if(nativeKey===key)return;Module.ccall('golf_season_settings','number',['number','number','number','number'],key.split(',').map(Number));nativeKey=key;}
  function apply(){document.body.dataset.season=theme();themeSelect.value=prefs.theme;themeSelect.disabled=!!room;mechanicsInput.checked=prefs.obstacles;mechanicsInput.disabled=!!room;localCosmetics.hidden=!!room;
    ball.value=localBall.value=String(prefs.skin);trail.value=localTrail.value=String(prefs.trail);subtitle.hidden=theme()!=='christmas';tournamentTitle.hidden=!room?.seasonal?.tournament;trophy.hidden=room?.phase!=='finished'||!room?.seasonal?.tournament;
    native();if(appliedTheme!==theme()){appliedTheme=theme();window.dispatchEvent(new Event('seasonchange'));}animate();}
  themeSelect.onchange=async()=>{const value=themeSelect.value;if(value==='christmas')await window.GolfChristmasMenu?.ready;prefs.theme=value;persist();};mechanicsInput.onchange=async()=>{const value=mechanicsInput.checked;if(value)await window.GolfChristmasMenu?.ready;prefs.obstacles=value;if(value)prefs.theme='christmas';persist();};
  for(const s of [ball,localBall,trail,localTrail])s.onchange=()=>{cosmeticsDirty=true;prefs[s===ball||s===localBall?'skin':'trail']=Number(s.value);persist();};
  function configure(){window.GolfOnline?.configureSeason({theme:roomTheme.value,tournament:tournamentInput.checked,obstacles:hazardsInput.checked});}
  for(const s of [roomTheme,tournamentInput,hazardsInput])s.onchange=()=>{if(s!==roomTheme&&s.checked)roomTheme.value='christmas';configure();};
  function syncRoom(value,id){const newRoom=room?.code!==value.code;room=value;localId=id;if(newRoom)cosmeticsDirty=false;const state=value.seasonal??{theme:'original',tournament:false,obstacles:false},host=value.host===id;
    roomTheme.value=state.theme;tournamentInput.checked=state.tournament;hazardsInput.checked=state.obstacles;for(const s of [roomTheme,tournamentInput,hazardsInput])s.disabled=!host||value.phase!=='lobby';
    if(value.phase==='lobby'){const own=value.players.find(p=>p.id===id);if(own&&(!cosmeticsDirty||(own.seasonSkin===prefs.skin&&own.seasonTrail===prefs.trail))){cosmeticsDirty=false;prefs.skin=own.seasonSkin??0;prefs.trail=own.seasonTrail??0;}}
    trophy.textContent=state.tournament&&value.phase==='finished'?'★ '+t('champion'):'';
    if(state.tournament&&value.phase==='finished'&&lastRoomPhase!=='finished'){burstUntil=performance.now()+4200;oneShot=false;GolfAudio?.play('christmas');}
    lastRoomPhase=value.phase;apply();
  }
  function frame(value){native();if(!value?.active)return;if(lastLevel!==value.level||value.time<lastTime){finished.clear();lastLevel=value.level;}lastTime=value.time;
    const p=value.players.find(p=>p.id===value.local);if(theme()==='christmas'&&p?.hole&&!finished.has(p.id)){finished.add(p.id);burstUntil=performance.now()+3200;oneShot=p.strokes===1;announcement.textContent=oneShot?'Ho Ho Hole in One!':t('hole');announcement.hidden=false;GolfAudio?.play('christmas');}
    if(performance.now()>burstUntil)announcement.hidden=true;
  }
  function animate(){if(raf||document.hidden||theme()!=='christmas')return;raf=requestAnimationFrame(draw);}
  function draw(now){raf=0;if(document.hidden||theme()!=='christmas'){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    if(now-previous<33){animate();return;}previous=now;
    const w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
    const home=!$('home').hidden,entry=!$('connect').hidden,reduce=reducedMotion.matches,time=reduce?0:now/1000;
    if((home||entry)&&!window.GolfChristmasMenu?.active){
      // Aurora, stars and bulbs are on one bounded surface, never CSS filters.
      const glow=ctx.createLinearGradient(0,0,w,h*.45);glow.addColorStop(0,'#78d9ba22');glow.addColorStop(.5,'#adc4fb20');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h*.45);
      for(let i=0;i<18;i++){ctx.fillStyle='#fff3cc';ctx.globalAlpha=.4+.3*Math.sin(time*.45+i);ctx.fillRect(((i*83.71)%100)/100*w,20+((i*37)%100)/100*h*.28,2,2);}ctx.globalAlpha=1;
      ctx.strokeStyle='#41613e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,8);ctx.quadraticCurveTo(w/2,60,w,8);ctx.stroke();
      for(let i=0;i<18;i++){ctx.fillStyle=['#e85c55','#ffe69b','#7dcb9a','#a6d7f2'][i%4];ctx.beginPath();ctx.ellipse((i+.5)*w/18,10+25*Math.sin((i+.5)/18*Math.PI),3,5,0,0,Math.PI*2);ctx.fill();}
    }
    if(home&&!window.GolfChristmasMenu?.active){const root=document.querySelector('.living-menu-art'),m=root?.getScreenCTM();if(m){
      ctx.save();ctx.setTransform(d*m.a,d*m.b,d*m.c,d*m.d,d*m.e,d*m.f);
      const portrait=root.viewBox.baseVal.height>root.viewBox.baseVal.width,lights=portrait?[[22,320],[88,337],[133,375],[37,405],[133,456],[66,493],[169,510],[45,549],[851,636],[895,657],[921,707]]:[[27,30],[120,58],[231,78],[315,28],[49,107],[169,142],[290,110],[1475,240],[1530,265],[1585,285]];
      lights.forEach(([x,y],i)=>{ctx.fillStyle=['#e36351','#f5d67a','#88cfac'][i%3];ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();});
      // A small decorated evergreen grows beside the flag, away from the pets.
      const [x,y]=portrait?[95,1170]:[135,800],h=portrait?125:160;
      ctx.fillStyle='#805337';ctx.fillRect(x-7,y-20,14,30);
      for(let tier=0;tier<3;tier++){ctx.fillStyle=tier%2?'#37734c':'#2d6445';ctx.beginPath();ctx.moveTo(x,y-h+tier*h*.20);ctx.quadraticCurveTo(x-h*.15,y-h*.50+tier*h*.20,x-h*(.25-tier*.04),y-15-tier*h*.20);ctx.quadraticCurveTo(x,y-tier*h*.20,x+h*(.25-tier*.04),y-15-tier*h*.20);ctx.closePath();ctx.fill();}
      for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#eac866':'#c74b42';ctx.beginPath();ctx.arc(x+Math.sin(i*2.4)*h*.16,y-25-(i%4)*h*.18,4,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#f4d680';ctx.font='26px serif';ctx.fillText('★',x-13,y-h+4);
      for(const [dx,color]of [[-30,'#b63b39'],[16,'#d8ae55']]){ctx.fillStyle=color;ctx.fillRect(x+dx,y-13,22,22);ctx.fillStyle='#ffead0';ctx.fillRect(x+dx+9,y-13,3,22);}
      ctx.restore();
    }}
    // Native snow is depth-tested during play. Screen snow is for UI only.
    if(home||entry||!$('lobby').hidden||!$('loading').hidden||!$('home-loading').hidden||!$('level-selection').hidden||!$('scores').hidden){for(let i=0;i<(w<600?32:56);i++){const x=((i*.61803398875*w+Math.sin(time*.4+i)*12)%w+w)%w,y=(i*79+time*(12+i%9))%(h+20)-10;ctx.fillStyle='#f8fcffe0';ctx.beginPath();ctx.arc(x,y,1+i%3*.45,0,Math.PI*2);ctx.fill();}}
    if(now<burstUntil){const age=(1-(burstUntil-now)/4200);for(let i=0;i<42;i++){const x=w*.5+Math.cos(i*2.4)*age*w*.55,y=h*.38+Math.sin(i*2.4)*age*h*.35+age*age*h*.22;ctx.fillStyle=['#ed6253','#ffe39b','#87bd86'][i%3];ctx.save();ctx.translate(x,y);ctx.rotate(i+age*3);if(i%3===0){ctx.fillRect(-4,-4,8,8);ctx.fillStyle='#fff0b1';ctx.fillRect(-1,-4,2,8);ctx.fillRect(-4,-1,8,2);}
      else if(i%3===1){ctx.strokeStyle='#f1cf72';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,0);ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.stroke();}else ctx.fillRect(-3,-3,6,6);ctx.restore();}}
    animate();
  }
  function outfit(ctx,id,p){
    if(theme()!=='christmas'||!['pompom','romeu','luna','juju'].includes(id))return;
    const [x,y,rx,ry]=p.head,top=y+ry*.88,bottom=p.anchor[1]-ry*.38,height=Math.max(0,bottom-top);if(height<3)return;
    ctx.save();ctx.fillStyle={pompom:'#bd3937',romeu:'#f6edda',luna:'#38744d',juju:'#527b52'}[id];
    ctx.beginPath();ctx.moveTo(x-rx*.35,top);ctx.quadraticCurveTo(x,top+ry*.12,x+rx*.35,top);ctx.bezierCurveTo(x+rx*.46,top+height*.25,x+rx*.49,bottom-height*.10,x+rx*.36,bottom);ctx.quadraticCurveTo(x,bottom+ry*.06,x-rx*.36,bottom);ctx.bezierCurveTo(x-rx*.49,bottom-height*.10,x-rx*.46,top+height*.25,x-rx*.35,top);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#303b32';ctx.lineWidth=Math.max(1,rx*.025);ctx.stroke();
    if(id==='pompom'){ctx.strokeStyle='#fff0d7';ctx.lineWidth=Math.max(2,ry*.07);ctx.beginPath();ctx.moveTo(x-rx*.33,bottom);ctx.quadraticCurveTo(x,bottom+ry*.05,x+rx*.33,bottom);ctx.stroke();}
    ctx.strokeStyle=id==='juju'?'#e8c565':'#f9edd5';ctx.lineWidth=Math.max(2,rx*.06);ctx.beginPath();ctx.moveTo(x,top+2);ctx.lineTo(x,bottom);ctx.stroke();
    ctx.fillStyle=id==='romeu'?'#354639':'#ebce76';for(let i=1;i<3;i++){ctx.beginPath();ctx.arc(x+rx*.12,top+height*i/3,rx*.035,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  function costume(ctx,id,p){if(theme()!=='christmas')return;const [x,y,rx,ry]=p.head;ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);ctx.lineWidth=.035;ctx.lineJoin='round';ctx.strokeStyle='#68492e';
    const ellipse=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
    if(id==='pituca'){ctx.strokeStyle='#91633e';ctx.lineWidth=.10;for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*.45,-.64);ctx.lineTo(s*.52,-1.05);ctx.moveTo(s*.49,-.86);ctx.lineTo(s*.72,-1.02);ctx.stroke();}ellipse(0,.40,.17,.12,'#d9453d');}
    else if(id==='pompom'||id==='luna'||id==='romeu'){
      const color=id==='luna'?'#3c7750':id==='romeu'?'#303b39':'#c83e39';ctx.fillStyle=color;
      if(id==='romeu'){ctx.fillRect(-.50,-1.28,1,.65);ellipse(0,-.65,.77,.10,color);ctx.fillStyle='#ba433b';ctx.fillRect(-.50,-.82,1,.12);}
      else{ctx.beginPath();ctx.moveTo(-.70,-.67);ctx.quadraticCurveTo(-.20,-1.38,.30,-1.38);ctx.quadraticCurveTo(.50,-1.34,.55,-1.12);ctx.lineTo(.13,-1.18);ctx.lineTo(.70,-.67);ctx.closePath();ctx.fill();ellipse(0,-.67,.73,.10,'#fff1d8');ellipse(.55,-1.12,.13,.13,'#fff4df');}
      ellipse(0,.93,.59,.09,id==='luna'?'#c3483a':'#f8e6b9');
    }else if(id==='juju'){for(const s of [-1,1])ellipse(s*.22,-.81,.29,.15,'#c83e39');ellipse(0,-.81,.12,.12,'#f1cf75');}
    else if(id==='frida'){ctx.strokeStyle='#fff1d6';ctx.lineWidth=.07;ctx.beginPath();for(let i=0;i<12;i++){let a=Math.PI*.08+i*Math.PI*.075;ctx.lineTo(Math.cos(a)*.82,Math.sin(a)*.81);}ctx.stroke();for(const s of [-1,1])ellipse(s*.34,.84,.055,.055,'#b33432');}
    else if(id==='maritaca'){ctx.fillStyle='#2f704c';ctx.beginPath();ctx.moveTo(0,-1.60);ctx.lineTo(-.76,-.72);ctx.lineTo(.76,-.72);ctx.closePath();ctx.fill();ctx.fillStyle='#efce70';ctx.font='0.65px serif';ctx.fillText('★',-.32,-1.45);}
    ctx.restore();
  }
  window.GolfSeason=Object.freeze({get theme(){return theme();},get tournament(){return !!room?.seasonal?.tournament;},cosmetics:()=>({seasonSkin:prefs.skin,seasonTrail:prefs.trail}),room:syncRoom,leave(){room=undefined;lastRoomPhase=undefined;apply();},frame,drawCostume:costume,drawOutfit:outfit,diagnostics:()=>({theme:theme(),obstacles:room?.seasonal?.obstacles??prefs.obstacles,particles:innerWidth<600?32:56,skin:prefs.skin,trail:prefs.trail})});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else animate();});
  setInterval(()=>{native();const f=window.GolfCourse?.inspect()?.frame;if(f)frame(f);},150);
  window.addEventListener('languagechange',()=>{legend.textContent=t('title');subtitle.textContent=t('subtitle');cosmeticNote.textContent=localCosmeticNote.textContent=t('cosmeticNote');});
  apply();
})();
