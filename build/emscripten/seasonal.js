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
  themeSelect.onchange=()=>{prefs.theme=themeSelect.value;persist();};mechanicsInput.onchange=()=>{prefs.obstacles=mechanicsInput.checked;if(prefs.obstacles)prefs.theme='christmas';persist();};
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
    if(home||entry){
      // Decorations only: the original sky, palette and pets stay untouched.
      ctx.strokeStyle='#41613e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,8);ctx.quadraticCurveTo(w/2,60,w,8);ctx.stroke();
      for(let i=0;i<18;i++){ctx.globalAlpha=.78+.22*(.5+.5*Math.sin(time*1.3+i));ctx.fillStyle=['#e85c55','#ffe69b','#7dcb9a','#a6d7f2'][i%4];ctx.beginPath();ctx.ellipse((i+.5)*w/18,10+25*Math.sin((i+.5)/18*Math.PI),3,5,0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    }
    if(home){const root=document.querySelector('.living-menu-art'),m=root?.getScreenCTM();if(m){
      ctx.save();ctx.setTransform(d*m.a,d*m.b,d*m.c,d*m.d,d*m.e,d*m.f);
      const portrait=root.viewBox.baseVal.height>root.viewBox.baseVal.width,lights=portrait?[[22,320],[88,337],[133,375],[37,405],[133,456],[66,493],[169,510],[45,549],[851,636],[895,657],[921,707]]:[[27,30],[120,58],[231,78],[315,28],[49,107],[169,142],[290,110],[1475,240],[1530,265],[1585,285]];
      lights.forEach(([x,y],i)=>{ctx.fillStyle=['#e36351','#f5d67a','#88cfac'][i%3];ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();});
      // Ribbon stays on the large tree, well away from all pet silhouettes.
      const [bx,by]=portrait?[140,460]:[120,150];
      ctx.fillStyle='#ba3734';ctx.strokeStyle='#812d2b';ctx.lineWidth=1.5;
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(bx,by);ctx.bezierCurveTo(bx+side*40,by-35,bx+side*40,by+25,bx,by+4);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(bx,by+2);ctx.lineTo(bx+side*12,by+35);ctx.lineTo(bx+side*19,by+26);ctx.lineTo(bx+side*27,by+30);ctx.lineTo(bx+side*9,by);ctx.fill();}
      ctx.fillStyle='#dfb851';ctx.beginPath();ctx.arc(bx,by+2,6,0,Math.PI*2);ctx.fill();
      // A small decorated evergreen grows on free ground behind the flag.
      const [x,y]=portrait?[135,850]:[270,550],h=portrait?125:145;
      ctx.fillStyle='#805337';ctx.fillRect(x-7,y-23,14,33);
      for(let tier=2;tier>=0;tier--){
        const top=y-h+tier*h*.21,base=y-h*.53+tier*h*.25,half=h*(.16+tier*.07);
        ctx.fillStyle=['#39764b','#326d43','#29603c'][tier];ctx.beginPath();ctx.moveTo(x,top);ctx.quadraticCurveTo(x-half*.7,base-h*.07,x-half,base);ctx.quadraticCurveTo(x,base+h*.08,x+half,base);ctx.quadraticCurveTo(x+half*.7,base-h*.07,x,top);ctx.fill();
        ctx.strokeStyle='#ddbd66';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-half*.65,base-h*.12);ctx.quadraticCurveTo(x,base+h*.07,x+half*.72,base-h*.09);ctx.stroke();
        for(let i=0;i<3;i++){ctx.fillStyle=['#cf4841','#f3ce69','#e9f1d2'][(i+tier)%3];ctx.beginPath();ctx.arc(x+(i-1)*half*.55,base-h*(i%2?.04:.12),3.5,0,Math.PI*2);ctx.fill();}
      }
      ctx.fillStyle='#f4d680';ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:11;ctx.lineTo(x+Math.cos(a)*r,y-h+Math.sin(a)*r);}ctx.closePath();ctx.fill();
      for(const [dx,color]of [[-30,'#b63b39'],[16,'#d8ae55']]){ctx.fillStyle=color;ctx.fillRect(x+dx,y-7,22,17);ctx.fillStyle='#ffead0';ctx.fillRect(x+dx+9,y-7,3,17);ctx.fillRect(x+dx,y-3,22,3);}
      ctx.restore();
    }}
    // Native snow is depth-tested during play. Screen snow is for UI only.
    if(!home&&(entry||!$('lobby').hidden||!$('loading').hidden||!$('home-loading').hidden||!$('level-selection').hidden||!$('scores').hidden)){for(let i=0;i<(w<600?32:56);i++){const x=((i*.61803398875*w+Math.sin(time*.4+i)*12)%w+w)%w,y=(i*79+time*(12+i%9))%(h+20)-10;ctx.fillStyle='#f8fcffe0';ctx.beginPath();ctx.arc(x,y,1+i%3*.45,0,Math.PI*2);ctx.fill();}}
    if(now<burstUntil){const age=(1-(burstUntil-now)/4200);for(let i=0;i<42;i++){const x=w*.5+Math.cos(i*2.4)*age*w*.55,y=h*.38+Math.sin(i*2.4)*age*h*.35+age*age*h*.22;ctx.fillStyle=['#ed6253','#ffe39b','#87bd86'][i%3];ctx.save();ctx.translate(x,y);ctx.rotate(i+age*3);if(i%3===0){ctx.fillRect(-4,-4,8,8);ctx.fillStyle='#fff0b1';ctx.fillRect(-1,-4,2,8);ctx.fillRect(-4,-1,8,2);}
      else if(i%3===1){ctx.strokeStyle='#f1cf72';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,0);ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.stroke();}else ctx.fillRect(-3,-3,6,6);ctx.restore();}}
    animate();
  }
  window.GolfSeason=Object.freeze({get theme(){return theme();},get tournament(){return !!room?.seasonal?.tournament;},cosmetics:()=>({seasonSkin:prefs.skin,seasonTrail:prefs.trail}),room:syncRoom,leave(){room=undefined;lastRoomPhase=undefined;apply();},frame,diagnostics:()=>({theme:theme(),obstacles:room?.seasonal?.obstacles??prefs.obstacles,particles:innerWidth<600?32:56,skin:prefs.skin,trail:prefs.trail})});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else animate();});
  setInterval(()=>{native();const f=window.GolfCourse?.inspect()?.frame;if(f)frame(f);},150);
  window.addEventListener('languagechange',()=>{legend.textContent=t('title');subtitle.textContent=t('subtitle');cosmeticNote.textContent=localCosmeticNote.textContent=t('cosmeticNote');});
  apply();
})();
