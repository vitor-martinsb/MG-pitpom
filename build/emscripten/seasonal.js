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
  const treeArt=new Image();let treePixels,treeSurface,treeBounds,treeLightKey='',lightSample,lightAt=-1000;
  function loadTree(){if(treeArt.src)return;treeArt.onload=()=>{
    treeSurface=document.createElement('canvas');treeSurface.width=300;treeSurface.height=Math.round(300*treeArt.naturalHeight/treeArt.naturalWidth);
    const c=treeSurface.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(treeArt,0,0,treeSurface.width,treeSurface.height);treePixels=c.getImageData(0,0,treeSurface.width,treeSurface.height);treeLightKey='';animate();
  };treeArt.src='art/menu-christmas-tree.png';}
  function lighting(now){if(!lightSample||now-lightAt>=1000){lightSample=window.GolfMenuClock?.sample().weights??{night:0,sunset:0,morning:0};lightAt=now;}return lightSample;}
  function ambient(light){return [1-.65*light.night-.03*light.morning+.035*light.sunset,1-.62*light.night-.10*light.sunset,1-.43*light.night-.28*light.sunset];}
  function material(rgb,light){const factors=ambient(light);return `rgb(${rgb.map((v,i)=>Math.round(v*factors[i])).join(',')})`;}
  function blendColor(a,b,t){return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;}
  function paintedTree(light){
    if(!treePixels)return null;const key=[light.night,light.sunset,light.morning].map(n=>n.toFixed(2)).join(',');
    if(key!==treeLightKey){const c=treeSurface.getContext('2d'),pixels=c.createImageData(treePixels.width,treePixels.height),src=treePixels.data,dst=pixels.data;
      const factors=ambient(light);
      for(let i=0;i<src.length;i+=4){dst[i]=src[i]*factors[0];dst[i+1]=src[i+1]*factors[1];dst[i+2]=src[i+2]*factors[2];dst[i+3]=src[i+3];}
      c.putImageData(pixels,0,0);treeLightKey=key;
    }return treeSurface;
  }
  function lamp(x,y,size,index,time,light){
    const warm=index%5!==0,emission=Math.min(1,light.night+light.sunset*.65),pulse=.94+.06*Math.sin(time*.7+index*.8);
    // Sunlit bulbs read as painted glass. Their glow gently wakes at sunset.
    ctx.save();ctx.globalAlpha=1-(1-pulse)*emission;
    const radius=size*(1.5+emission*2.7),glow=ctx.createRadialGradient(x,y,0,x,y,radius),alpha=.015+emission*.285;
    glow.addColorStop(0,warm?`rgba(255,218,135,${alpha})`:`rgba(220,125,91,${alpha*.67})`);glow.addColorStop(1,'rgba(255,216,145,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    const glass=ctx.createRadialGradient(x-size*.3,y-size*.4,0,x,y,size*1.3);
    glass.addColorStop(0,blendColor(warm?[249,229,170]:[229,187,152],warm?[255,249,216]:[245,195,161],emission));
    glass.addColorStop(.4,blendColor(warm?[210,173,95]:[174,90,63],warm?[244,210,133]:[201,117,85],emission));
    glass.addColorStop(1,material(warm?[153,123,66]:[113,63,49],light));
    ctx.fillStyle=glass;ctx.beginPath();ctx.ellipse(x,y,size*.75,size,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function lightStrand(points,count,size,time,light){
    const [a,b,c]=points;ctx.strokeStyle=material([68,82,49],light);ctx.lineWidth=Math.max(.8,size*.35);ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo(...b,...c);ctx.stroke();
    for(let i=0;i<count;i++){const t=(i+.5)/count,x=(1-t)*(1-t)*a[0]+2*(1-t)*t*b[0]+t*t*c[0],y=(1-t)*(1-t)*a[1]+2*(1-t)*t*b[1]+t*t*c[1];
      ctx.strokeStyle=material([87,72,42],light);ctx.lineWidth=Math.max(.8,size*.3);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+size*.8);ctx.stroke();
      ctx.fillStyle=material([111,88,47],light);ctx.fillRect(x-size*.42,y+size*.45,size*.84,size*.6);lamp(x,y+size*1.5,size,i,time,light);
    }
  }
  function ribbon(x,y,light){
    ctx.save();ctx.translate(x,y);ctx.rotate(-.12);ctx.scale(.86,.86);
    const fabric=ctx.createLinearGradient(-30,-20,27,35);fabric.addColorStop(0,material([191,81,53],light));fabric.addColorStop(.45,material([157,53,39],light));fabric.addColorStop(1,material([99,39,31],light));
    ctx.fillStyle=fabric;ctx.strokeStyle=material([92,39,29],light);ctx.lineWidth=1.2;
    for(const side of [-1,1]){
      ctx.beginPath();ctx.moveTo(side*4,2);ctx.bezierCurveTo(side*13,7,side*15,24,side*27,33);ctx.lineTo(side*17,30);ctx.lineTo(side*13,38);ctx.bezierCurveTo(side*8,24,side*9,15,side*3,8);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*16,-16,side*33,-26,side*35,-14);ctx.bezierCurveTo(side*43,7,side*22,13,0,4);ctx.fill();ctx.stroke();
      ctx.strokeStyle=material([208,112,75],light);ctx.beginPath();ctx.moveTo(side*8,0);ctx.quadraticCurveTo(side*19,-10,side*29,-12);ctx.stroke();ctx.strokeStyle=material([92,39,29],light);
    }
    ctx.fillStyle=fabric;ctx.beginPath();ctx.moveTo(-6,-6);ctx.quadraticCurveTo(0,-10,7,-4);ctx.lineTo(5,8);ctx.quadraticCurveTo(0,11,-6,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function persist(){try{localStorage.setItem('pitpom-season',JSON.stringify(prefs));}catch{}apply();}
  function native(){if(!window.GolfCourse?.initialized)return;const key=[theme()==='christmas'?1:0,prefs.skin,prefs.trail,!room&&prefs.obstacles?1:0].join(',');if(nativeKey===key)return;Module.ccall('golf_season_settings','number',['number','number','number','number'],key.split(',').map(Number));nativeKey=key;}
  function apply(){if(theme()==='christmas')loadTree();document.body.dataset.season=theme();themeSelect.value=prefs.theme;themeSelect.disabled=!!room;mechanicsInput.checked=prefs.obstacles;mechanicsInput.disabled=!!room;localCosmetics.hidden=!!room;
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
    const light=lighting(now);
    if(home||entry){
      lightStrand([[0,7],[w*.5,45],[w,7]],Math.max(12,Math.min(24,Math.round(w/32))),2.6,time,light);
    }
    if(home){const root=document.querySelector('.living-menu-art'),m=root?.getScreenCTM();if(m){
      ctx.save();ctx.setTransform(d*m.a,d*m.b,d*m.c,d*m.d,d*m.e,d*m.f);
      const portrait=root.viewBox.baseVal.height>root.viewBox.baseVal.width;
      const strands=portrait?
        [[[-8,320],[65,370],[135,375]],[[12,415],[82,455],[155,460]],[[4,486],[78,536],[160,511]],[[838,636],[891,678],[938,691]]]:
        [[[0,32],[138,94],[315,28]],[[15,105],[132,171],[278,116]],[[1475,240],[1535,291],[1585,285]]];
      strands.forEach(points=>lightStrand(points,6,3,time,light));
      const [bx,by]=portrait?[140,460]:[120,150];ribbon(bx,by,light);
      const tree=paintedTree(light);if(tree){
        const [anchor,y]=portrait?[135,840]:[270,560],height=portrait?155:168,width=height*tree.width/tree.height;
        const left=-m.e/m.a,right=(w-m.e)/m.a,x=Math.max(left+width*.5+8/m.a,Math.min(right-width*.5-8/m.a,anchor));
        treeBounds={left:(x-width*.5)*m.a+m.e,right:(x+width*.5)*m.a+m.e,top:(y-height)*m.d+m.f,bottom:y*m.d+m.f};
        ctx.imageSmoothingQuality='high';ctx.drawImage(tree,x-width*.5,y-height,width,height);
        // Tiny warm lamps retain light while foliage follows the scene's night tint.
        for(const [u,v]of [[.55,.21],[.48,.40],[.32,.62],[.60,.72],[.74,.56]])lamp(x+(u-.5)*width,y-height+v*height,1.4,1,time,light);
      }
      ctx.restore();
    }}
    // Native snow is depth-tested during play. Screen snow is for UI only.
    if(!home&&(entry||!$('lobby').hidden||!$('loading').hidden||!$('home-loading').hidden||!$('level-selection').hidden||!$('scores').hidden)){for(let i=0;i<(w<600?32:56);i++){const x=((i*.61803398875*w+Math.sin(time*.4+i)*12)%w+w)%w,y=(i*79+time*(12+i%9))%(h+20)-10;ctx.fillStyle='#f8fcffe0';ctx.beginPath();ctx.arc(x,y,1+i%3*.45,0,Math.PI*2);ctx.fill();}}
    if(now<burstUntil){const age=(1-(burstUntil-now)/4200);for(let i=0;i<42;i++){const x=w*.5+Math.cos(i*2.4)*age*w*.55,y=h*.38+Math.sin(i*2.4)*age*h*.35+age*age*h*.22;ctx.fillStyle=['#ed6253','#ffe39b','#87bd86'][i%3];ctx.save();ctx.translate(x,y);ctx.rotate(i+age*3);if(i%3===0){ctx.fillRect(-4,-4,8,8);ctx.fillStyle='#fff0b1';ctx.fillRect(-1,-4,2,8);ctx.fillRect(-4,-1,8,2);}
      else if(i%3===1){ctx.strokeStyle='#f1cf72';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,0);ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.stroke();}else ctx.fillRect(-3,-3,6,6);ctx.restore();}}
    animate();
  }
  window.GolfSeason=Object.freeze({get theme(){return theme();},get tournament(){return !!room?.seasonal?.tournament;},cosmetics:()=>({seasonSkin:prefs.skin,seasonTrail:prefs.trail}),room:syncRoom,leave(){room=undefined;lastRoomPhase=undefined;apply();},frame,diagnostics:()=>({decorReady:!!treePixels,treeBounds,decorLighting:treeLightKey,theme:theme(),obstacles:room?.seasonal?.obstacles??prefs.obstacles,particles:innerWidth<600?32:56,skin:prefs.skin,trail:prefs.trail})});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else animate();});
  setInterval(()=>{native();const f=window.GolfCourse?.inspect()?.frame;if(f)frame(f);},150);
  window.addEventListener('languagechange',()=>{legend.textContent=t('title');subtitle.textContent=t('subtitle');cosmeticNote.textContent=localCosmeticNote.textContent=t('cosmeticNote');});
  apply();
})();
