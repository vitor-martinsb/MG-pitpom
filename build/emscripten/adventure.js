/* Painted scenery; loading uses reference-based, eight-frame running sprites. */
(() => {
  const $=id=>document.getElementById(id),t=(key,values)=>GolfI18n.t(key,values);
  const ns='http://www.w3.org/2000/svg';
  const svg=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  const definitions=svg('svg',{'aria-hidden':'true',class:'pet-definitions'});
  definitions.innerHTML=`<defs>
    <symbol id="pitpom-cat" viewBox="-64 -45 130 92"><g stroke="#303039" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-36 9 Q-76 11 -54 40 Q-28 48 -31 26" fill="#eca153"/><path d="M-55 37 Q-40 49 -31 33" fill="#fff4dd" stroke="none"/>
      <g class="pet-leg rear"><path d="M-27 7 Q-34 28 -18 29 L-8 23" fill="#fff6e6"/></g><g class="pet-leg opposite"><path d="M-15 10 Q-5 32 6 24" fill="#fff6e6"/></g>
      <path d="M-41 8 Q-43 -20 -18 -24 Q1 -30 25 -10 L25 14 Q-11 32 -41 8" fill="#f2a353"/>
      <path d="M-34 8 Q-25 18 -17 2 Q-5 12 4 0 L20 8 L19 20 Q-10 30 -34 8" fill="#fff7e9" stroke="none"/>
      <path d="M-26 -22 L-19 -7 M-11 -25 L-5 -11 M4 -22 L8 -12" stroke="#d5823c" stroke-width="8"/>
      <g class="pet-leg"><path d="M5 13 Q21 34 27 23 L27 8" fill="#fff6e6"/></g><g class="pet-leg opposite"><path d="M17 11 Q41 26 40 15 L28 4" fill="#fff6e6"/></g>
      <path d="M13 -17 L9 -42 Q12 -47 26 -26 L47 -36 Q55 -34 48 -14 Q56 12 35 17 Q13 20 7 0" fill="#f3ac62"/>
      <path d="M14 -35 L23 -25 M44 -29 L42 -18" stroke="#ed9692" stroke-width="7"/>
      <path d="M26 -18 Q25 0 18 1 Q26 19 41 12 Q50 7 44 -9 L37 -20 L33 -3" fill="#fff7eb" stroke="none"/>
      <ellipse cx="24" cy="-3" rx="6" ry="8" fill="#282c30" stroke="none"/><ellipse cx="44" cy="-2" rx="5" ry="7" fill="#282c30" stroke="none"/>
      <circle cx="26" cy="-6" r="2" fill="white" stroke="none"/><circle cx="45" cy="-5" r="1.8" fill="white" stroke="none"/>
      <path d="M31 3 L37 3 L34 6 Z" fill="#ed9295" stroke="none"/><path d="M31 8 Q35 15 40 7" fill="#ed9295" stroke-width="2"/>
      <path d="M14 1 L2 -2 M14 6 L4 9 M49 3 L60 1 M48 8 L57 12" stroke-width="2"/>
    </g></symbol>
    <symbol id="pitpom-dog" viewBox="-64 -45 130 92"><g stroke="#303039" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <g class="pet-leg rear"><path d="M-32 7 Q-44 27 -26 29 L-15 20" fill="#fff6e6"/></g><g class="pet-leg opposite"><path d="M-18 10 Q-6 32 6 24" fill="#fff6e6"/></g>
      <path d="M-44 8 Q-45 -17 -17 -20 L15 -12 Q26 -3 21 16 Q-9 32 -44 8" fill="#fff5e6"/>
      <path d="M-22 -20 Q-9 -20 4 -15 L8 1 Q-4 19 -16 4 Q-25 5 -22 -20" fill="#313237" stroke="none"/>
      <path d="M-34 -8 L-31 -6 M-37 7 L-34 9 M-23 14 L-20 16 M-7 21 L-4 23 M10 16 L13 18" stroke="#a59c96" stroke-width="5"/>
      <g class="pet-leg"><path d="M7 13 Q21 34 29 24 L27 9" fill="#fff6e6"/></g><g class="pet-leg opposite"><path d="M17 9 Q39 26 42 15 L28 3" fill="#fff6e6"/></g>
      <path d="M7 -17 Q10 -34 34 -29 Q55 -28 50 -5 Q50 15 32 17 Q9 20 7 -17" fill="#34343a"/>
      <path class="pet-ear" d="M12 -23 Q-9 -36 -7 -15 Q-5 1 7 0" fill="#34343a"/>
      <path class="pet-ear opposite" d="M40 -27 Q63 -28 57 -6 Q52 4 46 -1" fill="#34343a"/>
      <path d="M28 -28 L25 -8 Q16 -7 11 0 Q11 15 32 14 Q43 12 42 1 Q26 -2 28 -28" fill="#fff8ed" stroke="none"/>
      <ellipse cx="23" cy="-11" rx="4" ry="6" fill="#201e20" stroke="none"/><ellipse cx="43" cy="-9" rx="5" ry="7" fill="#201e20" stroke="none"/>
      <circle cx="24" cy="-13" r="1.7" fill="white" stroke="none"/><circle cx="44" cy="-12" r="2" fill="white" stroke="none"/>
      <path d="M13 1 Q20 -6 28 1 Q27 7 19 7 Z" fill="#25262c"/>
      <path d="M28 11 Q42 12 35 22 Q26 25 27 15" fill="#eb9195" stroke-width="2"/>
      <path d="M15 9 L16 10 M20 12 L21 13 M25 8 L26 9" stroke="#a59c96" stroke-width="3"/>
    </g></symbol>
  </defs>`;document.body.prepend(definitions);
  /* Explicit clipping rectangles accommodate the artist's spacing without editing the PNG. */
  const runningBounds=[[36,100,262,220],[348,101,260,219],[655,101,264,222],[967,102,265,218],[34,412,263,218],[346,413,272,220],[655,412,267,213],[969,412,268,217],[38,705,287,223],[344,697,284,226],[661,694,232,233],[961,703,285,207],[45,992,243,216],[355,988,292,207],[665,983,237,219],[971,990,272,205]];
  runningBounds.forEach(([x,y,w,h],i)=>{
    const symbol=svg('symbol',{id:`pitpom-running-${i}`,viewBox:`${x+w/2-160} ${y+h/2-125} 320 250`});
    symbol.innerHTML=`<clipPath id="running-clip-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><image href="art/loading-run.png" width="1254" height="1254" clip-path="url(#running-clip-${i})"/>`;
    definitions.querySelector('defs').append(symbol);
  });
  const chasers=[];
  function chase(){
    const s=document.createElement('div');s.className='mascot-chase';s.setAttribute('aria-hidden','true');
    const pets=[];
    for(const [name,start]of [['pituca',8],['pompom',0]]){
      const pet=svg('svg',{viewBox:'0 0 320 250',class:`mascot-run ${name}`});
      const frame=svg('use',{href:`#pitpom-running-${start}`,width:320,height:250,class:'run-frame'});
      pet.append(frame);s.append(pet);pets.push({pet,frame,name,start,index:-1});
    }
    chasers.push({element:s,pets});
    return s;
  }
  for(const container of document.querySelectorAll('.real-loading')){container.prepend(chase());}
  // One visible sprite per animal. Shared absolute time preserves the chase
  // through resizes and loading screens; percentage positions keep it responsive.
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');let chaseFrame=0;
  function animateChase(now){
    chaseFrame=0;let visible=false;
    for(const {element,pets}of chasers){
      if(document.hidden||!element.getClientRects().length)continue;visible=true;
      for(const p of pets){
        const angle=(reduced.matches?.4:now*2*Math.PI/6500)-(p.name==='pompom'?Math.PI:0);
        const right=-Math.sin(angle)>0,flip=p.name==='pituca'?(right?-1:1):(right?1:-1);
        p.pet.style.left=`${50+31*Math.cos(angle)}%`;p.pet.style.top=`${50+29*Math.sin(angle)}%`;
        p.pet.style.transform=`translate(-50%,-50%) scaleX(${flip})`;
        const index=reduced.matches?0:(Math.floor(now/100)+(p.name==='pituca'?2:0))%8;
        if(index!==p.index){p.frame.setAttribute('href',`#pitpom-running-${p.start+index}`);p.index=index;}
      }
    }
    if(visible&&!reduced.matches)chaseFrame=requestAnimationFrame(animateChase);
  }
  function wakeChase(){if(!chaseFrame)chaseFrame=requestAnimationFrame(animateChase);}
  new MutationObserver(wakeChase).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',wakeChase);document.addEventListener('visibilitychange',wakeChase);reduced.addEventListener('change',wakeChase);wakeChase();
  const environments=['garden','forest','bridge','mushrooms','village','mountains'];
  const previews=[
    '<path d="M0 12V-3M-10 13V3M10 13V3" stroke="#638657" stroke-width="3"/><g fill="#dfad92"><circle cy="-8" r="7"/><circle cx="-11" r="5"/><circle cx="11" r="5"/></g><circle cy="-8" r="3" fill="#e8c56c"/>',
    '<path d="M-7 12V-10M8 12V-6" stroke="#977657" stroke-width="4"/><ellipse cx="-7" cy="-9" rx="10" ry="15" fill="#668c68"/><ellipse cx="8" cy="-5" rx="9" ry="12" fill="#87a17b"/>',
    '<path d="M-20 10Q0 0 20 10" stroke="#86b5bc" stroke-width="10" fill="none"/><path d="M-17 4Q0-15 17 4M-17 9Q0-10 17 9" stroke="#ad8159" stroke-width="5" fill="none"/>',
    '<path d="M-8 12V-3M10 14V3" stroke="#fff0d2" stroke-width="6"/><path d="M-22-2Q-8-27 6-2ZM0 4Q10-15 20 4Z" fill="#ce8e67"/><g fill="#ffeccd"><circle cx="-9" cy="-10" r="3"/><circle cx="11" cy="-2" r="2"/></g>',
    '<path d="M-16 13V-5H16V13Z" fill="#f3dbab"/><path d="M-21-5L0-22L21-5Z" fill="#bd8865"/><path d="M-3 13V2H5V13" fill="#997357"/><path d="M9-2H13V3H9Z" fill="#92babb"/>',
    '<circle cx="12" cy="-13" r="8" fill="#ecc780"/><path d="M-25 13L-9-20L7 13ZM-4 13L11-10L25 13Z" fill="#879b96"/><path d="M-16-7L-9-20L-2-7L-10-10Z" fill="#f6ebda"/>'
  ];
  let pickedCourse=-1,knownCompleted;
  function paintCampaign(container,order,selection){
    const narrow=innerWidth<600,width=narrow?440:960,height=narrow?680:520;
    const completed=new Set(order.filter(map=>Number.isFinite(selection.levels[map])));
    const next=order.find(map=>!completed.has(map))??order[order.length-1];
    const unlocked=new Set(knownCompleted?order.filter(map=>map>0&&completed.has(map-1)&&!knownCompleted.has(map-1)):[]);
    const progressed=knownCompleted&&completed.has(pickedCourse)&&!knownCompleted.has(pickedCourse);
    knownCompleted=completed;
    if(pickedCourse<0||!order.includes(pickedCourse)||progressed)pickedCourse=next;
    const locked=map=>!!selection.progression&&order.some(before=>before<map&&!completed.has(before));
    const choose=map=>{
      pickedCourse=map;const course=GOLF_CAMPAIGN.courses[map],world=GOLF_CAMPAIGN.worlds[course.world-1];
      $('selected-course-world').textContent=`${world.names[GolfI18n.language]??world.names.en} · ${t('courseNumber',{number:map+1})}`;
      $('selected-course-name').textContent=GolfI18n.courseName(course);
      $('selected-course-info').textContent=locked(map)?t('levelLocked'):completed.has(map)?t('levelBest',{number:selection.levels[map]}):t('readyForAdventure');
      $('play-course').disabled=locked(map);$('play-course').onclick=()=>{
        if(window.GolfOnline?.applySoloProfile()!==false&&Module.ccall('golf_ui_choose_level','number',['number'],[map])){$('level-selection').hidden=true;window.GolfHome?.show('game',false);$('canvas').focus();}
      };
      for(const node of container.querySelectorAll('.trail-node')){
        node.classList.toggle('selected',Number(node.dataset.level)===map);
        node.setAttribute('aria-pressed',String(Number(node.dataset.level)===map));
      }
    };
    container.replaceChildren();
    $('campaign-progress').textContent=t('campaignProgress',{complete:completed.size,total:order.length});
    const navigation=document.createElement('nav');navigation.className='world-navigation';navigation.setAttribute('aria-label',t('worldNavigation'));
    const activeWorld=GOLF_CAMPAIGN.courses[pickedCourse].world;
    for(const world of GOLF_CAMPAIGN.worlds){
      const maps=order.filter(map=>GOLF_CAMPAIGN.courses[map].world===world.id);if(!maps.length)continue;
      const section=document.createElement('section');section.className='campaign-world';section.dataset.world=world.id;section.style.setProperty('--world-color',world.color);
      const title=document.createElement('h3');title.textContent=world.names[GolfI18n.language]??world.names.en;
      const caption=document.createElement('p');for(const family of [...new Set(maps.map(map=>GOLF_CAMPAIGN.courses[map].family))]){const name=document.createElement('span');name.className='family-title';name.textContent=GolfI18n.familyName(family);if(caption.children.length)caption.append(' · ');caption.append(name);}
      section.append(title,caption);
      const s=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':title.textContent});
      const points=narrow?[[76,575],[228,538],[360,434],[240,354],[81,325],[100,182],[267,210],[366,102]]:[[100,402],[255,383],[230,224],[412,211],[539,363],[714,349],[759,191],[866,99]];
      const foliage=world.id===7||world.id===8?'#8fa6a3':world.id===6?'#a4a980':world.id===9?'#92a18a':'#91aa77';
      s.innerHTML=`<defs><linearGradient id="biome-${world.id}" x2="0" y2="1"><stop stop-color="${world.color}"/><stop offset="1" stop-color="${foliage}"/></linearGradient></defs>
        <path d="M0 0H${width}V${height}H0Z" fill="url(#biome-${world.id})"/>
        <path d="M-10 ${height*.22}Q${width*.24} ${height*.04} ${width*.5} ${height*.23}T${width+20} ${height*.14}V${height}H0Z" fill="${foliage}" opacity=".38"/>
        <path d="M${width*.73} -30C${width*.45} ${height*.25} ${width*.92} ${height*.44} ${width*.55} ${height*.64}S${width*.4} ${height*.9} ${width*.65} ${height+30}" fill="none" stroke="#76a7af" stroke-width="48"/>
        <path class="map-current" d="M${width*.73} -30C${width*.45} ${height*.25} ${width*.92} ${height*.44} ${width*.55} ${height*.64}S${width*.4} ${height*.9} ${width*.65} ${height+30}" fill="none" stroke="#c8e1d7" stroke-width="2" stroke-dasharray="18 44"/>`;
      // Clusters leave the playable path and its labels clear.
      for(const [j,x,y]of [[0,width*.09,height*.10],[1,width*.43,height*.12],[2,width*.89,height*.61],[3,width*.25,height*.91],[4,width*.91,height*.91]]){
        const group=svg('g',{transform:`translate(${x} ${y}) scale(${narrow?1.1:1.5})`,class:'map-decoration','aria-hidden':'true'});
        group.innerHTML=previews[world.id===7||world.id===8?5:world.id===6?3:world.id===9?4:j%2?0:1];s.append(group);
      }
      // A windmill and a bridge belong to the terrain rather than a list card.
      const mill=svg('g',{transform:`translate(${width*.42} ${height*.66}) scale(${narrow?.75:1})`,'aria-hidden':'true'});
      mill.innerHTML='<path d="M-17 39L-12-6H12L19 39Z" fill="#eddfbc" stroke="#947657" stroke-width="2"/><path d="M-21-6L0-27L21-6Z" fill="#bb876a"/><g class="map-mill"><path d="M0 0L-5-42H5Z M0 0L42-5V5Z M0 0L5 42H-5Z M0 0L-42 5V-5Z" fill="#fff2d2" stroke="#9e835e" stroke-width="2"/><circle r="5" fill="#8c7354"/></g>';s.append(mill);
      for(let i=1;i<maps.length;i++){
        const a=points[i-1],b=points[i],middle=(a[1]+b[1])/2;
        const d=`M${a[0]} ${a[1]}C${a[0]} ${middle} ${b[0]} ${middle} ${b[0]} ${b[1]}`;
        const open=!locked(maps[i]);
        s.append(svg('path',{d,fill:'none',stroke:'#536b4435','stroke-width':34,'stroke-linecap':'round'}),svg('path',{d,fill:'none',stroke:open?'#e8d4a0':'#b9b69a','stroke-width':24,'stroke-linecap':'round',class:unlocked.has(maps[i])?'unlocked-route':'','stroke-dasharray':open?'none':'4 10'}));
        s.append(svg('path',{d,fill:'none',stroke:'#fff2cd','stroke-width':2,opacity:open?.6:.2,'stroke-dasharray':'2 15'}));
      }
      const bridge=svg('g',{transform:`translate(${(points[3][0]+points[4][0])/2} ${(points[3][1]+points[4][1])/2}) rotate(-18)`,'aria-hidden':'true'});
      bridge.innerHTML='<path d="M-22-24V24M22-24V24" stroke="#735f43" stroke-width="5"/><path d="M-21-18H21M-21-6H21M-21 6H21M-21 18H21" stroke="#b68b5d" stroke-width="9"/>';s.append(bridge);
      maps.forEach((map,i)=>{
        const course=GOLF_CAMPAIGN.courses[map],current=map===next,isLocked=locked(map),done=completed.has(map);
        const g=svg('g',{transform:`translate(${points[i][0]} ${points[i][1]})`,class:`trail-node ${current?'current':done?'completed':'next'} ${isLocked?'locked':'selectable'}${unlocked.has(map)?' just-unlocked':''}`,'data-level':map,role:'button',tabindex:0,'aria-disabled':String(isLocked),'aria-label':`${GolfI18n.courseName(course)}, ${isLocked?t('levelLocked'):done?t('levelBest',{number:selection.levels[map]}):t('currentCourse')}`});
        g.append(svg('ellipse',{cy:7,rx:29,ry:24,fill:'#536b4440'}),svg('circle',{r:25,fill:done?'#57794d':current?'#f2ce7d':isLocked?'#b7b59b':'#fff1cd',stroke:'#8f7851','stroke-width':3}));
        const number=svg('text',{'text-anchor':'middle',y:7,fill:done?'#fff7e6':'#354831','font-size':19,'font-weight':700});number.textContent=done?'✓':isLocked?'·':String(map+1);g.append(number);
        if(isLocked){const lock=svg('path',{d:'M-5-5V-9A5 5 0 0 1 5-9V-5M-8-5H8V8H-8Z',fill:'none',stroke:'#52634a','stroke-width':2.5});g.append(lock);number.textContent='';}
        const label=svg('text',{'text-anchor':'middle',y:48,'font-size':narrow?14:15,'font-weight':600,fill:'#344a30'});label.textContent=t('courseName',{number:course.revision+1});g.append(label);
        const subtitle=svg('text',{'text-anchor':'middle',y:65,'font-size':11,fill:'#4c6241'});subtitle.textContent=course.revision===0?GolfI18n.familyName(course.family):'';g.append(subtitle);
        const select=()=>{choose(map);window.GolfAudio?.play('ui');};g.addEventListener('click',select);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
        if(current){g.setAttribute('aria-current','step');const pets=svg('g',{transform:'translate(-38 -66)',class:'trail-pets','aria-hidden':'true'});pets.innerHTML='<use href="#pitpom-dog" width="52" height="39"/><use href="#pitpom-cat" x="35" y="-5" width="52" height="39"/>';g.append(pets);}
        s.append(g);
      });
      section.append(s);container.append(section);
      const button=document.createElement('button');button.type='button';button.textContent=title.textContent;button.style.setProperty('--world-color',world.color);
      if(world.id===activeWorld)button.setAttribute('aria-current','location');
      button.onclick=()=>{section.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});for(const b of navigation.children)b.removeAttribute('aria-current');button.setAttribute('aria-current','location');};navigation.append(button);
    }
    container.prepend(navigation);choose(pickedCourse);
  }
  function paint(container,order,room,selection){
    if(!container)return;
    if(selection){paintCampaign(container,order,selection);return;}
    const narrow=selection&&innerWidth<600,width=narrow?400:720;
    const grouped=!!selection&&order.length===80,rowHeight=narrow?82:65;
    container.replaceChildren();const h=Math.max(600,order.length*rowHeight+120+(grouped?1400:0)),s=svg('svg',{viewBox:`0 0 ${width} ${h}`,role:selection?'group':'img','aria-label':t(selection?'levelSelection':'adventureTitle')});
    s.innerHTML=`<defs><linearGradient id="sky-${container.id}" x2="0" y2="1"><stop stop-color="#cadeda"/><stop offset="1" stop-color="#f2dfb5"/></linearGradient></defs>
      <rect width="720" height="${h}" rx="35" fill="url(#sky-${container.id})"/>
      <path d="M0 140 Q140 40 280 150 T720 90 L720 ${h} L0 ${h}Z" fill="#b7c798"/>
      <path d="M0 380 Q190 200 380 330 T720 220 L720 ${h} L0 ${h}Z" fill="#99b78b"/>
      <path d="M-40 310 Q230 300 120 500 T650 720 Q550 870 760 900" fill="none" stroke="#8dbbc0" stroke-width="45" opacity=".7"/>`;
    for(let i=0;i<24;i++){
      const x=35+(i*173)%640,y=80+(i*127)%(h-120);const g=svg('g',{transform:`translate(${x} ${y})`});
      g.innerHTML=i%4===0?'<path d="M-16 10 Q0 -26 16 10Z" fill="#db9b66"/><path d="M0 10V26" stroke="#f6eccf" stroke-width="10"/><circle cx="-6" cy="4" r="3" fill="#fff4dd"/>':i%5===0?'<path d="M-20 18V-3L0-22L20-3V18Z" fill="#f0dcae"/><path d="M-25-3L0-27L25-3" fill="#c5916c"/><path d="M-3 18V4H6V18" fill="#927554"/>':'<path d="M0 12V40" stroke="#977657" stroke-width="7"/><ellipse cy="-4" rx="25" ry="33" fill="#668c68"/><ellipse cx="-14" cy="9" rx="18" ry="23" fill="#759d70"/>';
      s.append(g);
    }
    const points=order.map((_,i)=>[width/2+Math.sin(i*.95)*(narrow?60:160),grouped?110+i*rowHeight+Math.floor(i/4)*70:75+i*(h-140)/Math.max(1,order.length-1)]);
    const familyHeadings=[];
    if(grouped)for(let i=0;i<20;i++) {
      const world=GOLF_CAMPAIGN.worlds[Math.floor(i/2)],y=points[i*4][1];
      s.append(svg('rect',{x:8,y:y-85,width:width-16,height:rowHeight*3+145,rx:24,fill:world.color,opacity:.25}));
      const sign=svg('rect',{x:width*.08,y:y-81,width:width*.84,height:62,rx:14,fill:'#f5e8c9',stroke:'#b2956a','stroke-width':2});
      const title=svg('text',{x:width/2,y:y-55,'text-anchor':'middle','font-size':narrow?18:25,'font-weight':700,fill:'#354831',class:'family-title'});title.textContent=GolfI18n.familyName(i+1);
      const range=svg('text',{x:width/2,y:y-32,'text-anchor':'middle','font-size':13,fill:'#526b48'});range.textContent=`${world.id} · ${world.names[GolfI18n.language]??world.names.en}`;familyHeadings.push(sign,title,range);
    }
    const path=points.map((p,i)=>i?`C ${points[i-1][0]} ${(points[i-1][1]+p[1])/2} ${p[0]} ${(points[i-1][1]+p[1])/2} ${p[0]} ${p[1]}`:`M ${p[0]} ${p[1]}`).join(' ');
    s.append(svg('path',{d:path,fill:'none',stroke:'#6e7855','stroke-width':27,opacity:.3}),svg('path',{d:path,fill:'none',stroke:'#ead5a7','stroke-width':20,'stroke-linecap':'round'}));
    s.append(...familyHeadings);
    for(let i=1;i<points.length;i++){
      const [x,y]=points[i],previous=points[i-1];
      if(i%8===0){const bridge=svg('g',{transform:`translate(${(x+previous[0])/2} ${(y+previous[1])/2})`, 'aria-hidden':'true'});bridge.innerHTML='<path d="M-19-18V18M19-18V18" stroke="#795c40" stroke-width="4"/><path d="M-18-12H18M-18-4H18M-18 4H18M-18 12H18" stroke="#b98d60" stroke-width="6"/>';s.append(bridge);}
      else s.append(svg('ellipse',{cx:(x+previous[0])/2+5,cy:(y+previous[1])/2,rx:4,ry:2.5,fill:'#bba888',opacity:.8}));
    }
    let locked=false;
    order.forEach((map,i)=>{
      const course=window.GOLF_CAMPAIGN?.courses[map],world=course&&GOLF_CAMPAIGN.worlds[course.world-1];
      const best=selection?.levels[map],isLocked=!!selection&&!!selection.progression&&locked;
      const complete=selection?best!==null:room&&(i<room.hole||room.completed||i===room.hole&&room.phase==='results'),current=selection?(selection.progression?!isLocked&&!complete:map===Math.max(0,selection.current??0)):room&&i===Math.min(room.hole,order.length-1)&&!complete;
      const g=svg('g',{transform:`translate(${points[i][0]} ${points[i][1]})`,class:(current?'trail-node current':complete?'trail-node completed':'trail-node next')+(selection?(isLocked?' locked':' selectable'):''),'data-level':map});
      g.append(svg('circle',{r:24,fill:complete?'#607d50':current?'#f5cb74':'#f8edcf',stroke:'#977b54','stroke-width':3}));
      const number=svg('text',{'text-anchor':'middle',y:7,fill:complete?'#fff7e6':'#405638','font-size':18,'font-weight':700});number.textContent=isLocked?'🔒':complete?'✓':String((course?.revision??0)+1);g.append(number);
      const theme=world?([0,2,2,5,1,3,5,5,4,0][course.world-1]):Math.floor(i*6/order.length)%6,preview=svg('g',{transform:`translate(${i%2?-47:47} -17) scale(.6)`});preview.innerHTML=previews[theme];g.append(preview);
      const label=svg('text',{x:i%2?-35:35,y:10,'text-anchor':i%2?'end':'start','font-size':grouped?17:13,fill:'#354831'});label.textContent=grouped?t('courseName',{number:course.revision+1}):GolfI18n.courseName(course);g.append(label);
      const environment=world?(world.names[GolfI18n.language]??world.names.en):t('environment.'+environments[theme]);
      const subtitle=svg('text',{x:i%2?-35:35,y:29,'text-anchor':i%2?'end':'start','font-size':12,fill:'#526b48'});subtitle.textContent=selection?(isLocked?t('levelLocked'):best!==null?t('levelBest',{number:best}):course?.revision?t('evolutionStage',{number:course.revision}):t('originalStage')):environment;g.append(subtitle);
      if(selection){
        g.setAttribute('role','button');g.setAttribute('aria-label',`${GolfI18n.courseName(course)}, ${subtitle.textContent}`);g.setAttribute('aria-disabled',String(isLocked));
        g.append(svg('rect',{x:-160,y:-30,width:320,height:65,fill:'transparent'}));
        if(!isLocked){g.setAttribute('tabindex','0');const choose=()=>{if(window.GolfOnline?.applySoloProfile()!==false&&Module.ccall('golf_ui_choose_level','number',['number'],[map])){$('level-selection').hidden=true;$('canvas').focus();}};g.addEventListener('click',choose);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});}
        if(selection.progression&&best===null)locked=true;
      }
      s.append(g);
      if(current||!room&&!selection&&i===0){const pets=svg('g',{transform:`translate(${points[i][0]+(i%2?34:-122)} ${points[i][1]-22})`,class:'trail-pets'});pets.innerHTML='<use href="#pitpom-dog" width="54" height="40"/><use href="#pitpom-cat" x="36" y="-8" width="54" height="40"/>';s.append(pets);}
    });container.append(s);
    // A compact, connected world index links directly to the course trail.
    const navigation=document.createElement('nav');navigation.className='world-navigation';navigation.setAttribute('aria-label',t('worldNavigation'));
    const currentNode=s.querySelector('.current'),currentMap=Number(currentNode?.dataset.level??order[0]),currentWorld=GOLF_CAMPAIGN.courses[currentMap]?.world;
    for(const world of GOLF_CAMPAIGN.worlds){
      const first=order.find(map=>GOLF_CAMPAIGN.courses[map]?.world===world.id);if(first===undefined)continue;
      const button=document.createElement('button');button.type='button';button.textContent=world.names[GolfI18n.language]??world.names.en;button.style.setProperty('--world-color',world.color);
      if(world.id===currentWorld){button.setAttribute('aria-current','location');button.title=t('currentCourse');}
      button.onclick=()=>{const node=s.querySelector(`[data-level="${first}"]`);node?.scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});node?.focus({preventScroll:true});};navigation.append(button);
    }
    container.prepend(navigation);
    if(room){const active=container.querySelector('.current,.completed:last-child');active?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
  }
  let lastRoom,signature='';
  function render(room){
    lastRoom=room;const key=JSON.stringify([room?.sequence,room?.mapPool,room?.hole,room?.phase,GolfI18n.language]);if(key===signature)return;signature=key;
    const order=room?.sequence?.length?room.sequence:room?.mapPool??Array.from({length:window.GOLF_CAMPAIGN?.courses.length??80},(_,i)=>i);
    for(const id of ['lobby-adventure','match-adventure','results-adventure'])paint($(id),order,room?.sequence?.length?room:null);
  }
  $('open-adventure').onclick=()=>{$('adventure-modal').hidden=false;window.GolfOnline?.cancelAim();};
  $('close-adventure').onclick=()=>$('adventure-modal').hidden=true;
  let selectionSignature='',lastSelection,progression=false;
  try{progression=localStorage.getItem('pitpom-progression')==='true';}catch{}
  $('solo-progression').checked=progression;
  $('solo-progression').onchange=()=>{progression=$('solo-progression').checked;try{localStorage.setItem('pitpom-progression',String(progression));}catch{}Module.ccall('golf_ui_set_progression',null,['number'],[Number(progression)]);selectionSignature='';};
  $('close-level-selection').onclick=()=>{Module.ccall('golf_ui_close_level_selection',null,[],[]);$('level-selection').hidden=true;window.GolfHome?.show('menu');};
  $('level-selection').addEventListener('keydown',e=>{if(e.key==='Escape')$('close-level-selection').click();});
  function select(selection){
    if(selection.progression!==progression){Module.ccall('golf_ui_set_progression',null,['number'],[Number(progression)]);selection.progression=progression;}
    window.GolfHome?.native(selection);lastSelection=selection;const visible=selection.open&&$('connect').hidden&&!GolfOnline.active();const panel=$('level-selection'),opening=panel.hidden&&visible;panel.hidden=!visible;
    $('solo-loading').hidden=!selection.loading||!$('connect').hidden||GolfOnline.active();
    const key=JSON.stringify([selection.levels,selection.progression,GolfI18n.language,innerWidth<600,selection.current]);if(visible&&(selectionSignature!==key||opening)){selectionSignature=key;paint($('level-adventure'),selection.levels.map((_,i)=>i),null,selection);if(opening)requestAnimationFrame(()=>$('level-adventure').querySelector('.current')?.closest('.campaign-world')?.scrollIntoView({block:'start'}));}
    if(opening)$('close-level-selection').focus({preventScroll:true});
  }
  window.addEventListener('languagechange',()=>{signature='';render(lastRoom);if(lastSelection)select(lastSelection);});
  window.GolfAdventure={render,select,reset(){signature='';selectionSignature='';render(undefined);},busy(value){$('engine-loader').hidden=!value;},celebrate(winners){
    $('winner-banner').textContent=t('winners',{names:winners.map(p=>p.nickname).join(', ')});$('winner-banner').hidden=false;
    const layer=$('celebration');layer.replaceChildren();layer.hidden=false;
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches)for(let i=0;i<32;i++){const p=document.createElement('i');p.style.setProperty('--x',`${(i*61)%100}%`);p.style.setProperty('--delay',`${(i%8)*.12}s`);p.style.setProperty('--turn',`${(i%3)*90}deg`);layer.append(p);}
    setTimeout(()=>layer.hidden=true,4800);
  }};render();
})();
