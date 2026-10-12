/* Painted vector scenery and independently articulated, original mascots. */
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
  function chase(){
    const s=svg('svg',{viewBox:'0 0 300 300',class:'mascot-chase','aria-hidden':'true'});
    s.innerHTML=`<circle cx="150" cy="150" r="96" fill="none" stroke="#d8c6a8" stroke-dasharray="14 24" stroke-width="3"/>
      <g transform="translate(150 150)"><g><animateMotion dur="3.6s" repeatCount="indefinite" rotate="auto" path="M 0 -94 A94 94 0 1 1 -.01 -94"/><use href="#pitpom-cat" x="-58" y="-42" width="116" height="84"/></g>
      <g><animateMotion dur="3.6s" begin="-1.8s" repeatCount="indefinite" rotate="auto" path="M 0 -94 A94 94 0 1 1 -.01 -94"/><use href="#pitpom-dog" x="-58" y="-42" width="116" height="84"/></g></g>`;if(matchMedia('(prefers-reduced-motion:reduce)').matches)s.querySelectorAll('animateMotion').forEach(a=>a.remove());return s;
  }
  for(const container of document.querySelectorAll('.real-loading')){container.prepend(chase());}
  const environments=['garden','forest','bridge','mushrooms','village','mountains'];
  const previews=[
    '<path d="M0 12V-3M-10 13V3M10 13V3" stroke="#638657" stroke-width="3"/><g fill="#dfad92"><circle cy="-8" r="7"/><circle cx="-11" r="5"/><circle cx="11" r="5"/></g><circle cy="-8" r="3" fill="#e8c56c"/>',
    '<path d="M-7 12V-10M8 12V-6" stroke="#977657" stroke-width="4"/><ellipse cx="-7" cy="-9" rx="10" ry="15" fill="#668c68"/><ellipse cx="8" cy="-5" rx="9" ry="12" fill="#87a17b"/>',
    '<path d="M-20 10Q0 0 20 10" stroke="#86b5bc" stroke-width="10" fill="none"/><path d="M-17 4Q0-15 17 4M-17 9Q0-10 17 9" stroke="#ad8159" stroke-width="5" fill="none"/>',
    '<path d="M-8 12V-3M10 14V3" stroke="#fff0d2" stroke-width="6"/><path d="M-22-2Q-8-27 6-2ZM0 4Q10-15 20 4Z" fill="#ce8e67"/><g fill="#ffeccd"><circle cx="-9" cy="-10" r="3"/><circle cx="11" cy="-2" r="2"/></g>',
    '<path d="M-16 13V-5H16V13Z" fill="#f3dbab"/><path d="M-21-5L0-22L21-5Z" fill="#bd8865"/><path d="M-3 13V2H5V13" fill="#997357"/><path d="M9-2H13V3H9Z" fill="#92babb"/>',
    '<circle cx="12" cy="-13" r="8" fill="#ecc780"/><path d="M-25 13L-9-20L7 13ZM-4 13L11-10L25 13Z" fill="#879b96"/><path d="M-16-7L-9-20L-2-7L-10-10Z" fill="#f6ebda"/>'
  ];
  function paint(container,order,room){
    container.replaceChildren();const h=Math.max(600,order.length*65+120),s=svg('svg',{viewBox:`0 0 720 ${h}`,role:'img','aria-label':t('adventureTitle')});
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
    const points=order.map((_,i)=>[360+Math.sin(i*.95)*160,75+i*(h-140)/Math.max(1,order.length-1)]);
    const path=points.map((p,i)=>i?`C ${points[i-1][0]} ${(points[i-1][1]+p[1])/2} ${p[0]} ${(points[i-1][1]+p[1])/2} ${p[0]} ${p[1]}`:`M ${p[0]} ${p[1]}`).join(' ');
    s.append(svg('path',{d:path,fill:'none',stroke:'#6e7855','stroke-width':27,opacity:.3}),svg('path',{d:path,fill:'none',stroke:'#ead5a7','stroke-width':20,'stroke-linecap':'round'}));
    order.forEach((map,i)=>{
      const complete=room&&(i<room.hole||room.completed||i===room.hole&&room.phase==='results'),current=room&&i===Math.min(room.hole,order.length-1)&&!complete;
      const g=svg('g',{transform:`translate(${points[i][0]} ${points[i][1]})`,class:complete?'trail-node completed':current?'trail-node current':'trail-node next'});
      g.append(svg('circle',{r:24,fill:complete?'#607d50':current?'#f5cb74':'#f8edcf',stroke:'#977b54','stroke-width':3}));
      const number=svg('text',{'text-anchor':'middle',y:7,fill:complete?'#fff7e6':'#405638','font-size':18,'font-weight':700});number.textContent=complete?'✓':String(i+1);g.append(number);
      const theme=Math.floor(i*6/order.length)%6,preview=svg('g',{transform:`translate(${i%2?-47:47} -17) scale(.6)`});preview.innerHTML=previews[theme];g.append(preview);
      const label=svg('text',{x:i%2?-35:35,y:10,'text-anchor':i%2?'end':'start','font-size':17,fill:'#354831'});label.textContent=t('courseName',{number:map+1});g.append(label);
      const subtitle=svg('text',{x:i%2?-35:35,y:29,'text-anchor':i%2?'end':'start','font-size':12,fill:'#526b48'});subtitle.textContent=t('environment.'+environments[theme]);g.append(subtitle);
      s.append(g);
      if(current||!room&&i===0){const pets=svg('g',{transform:`translate(${points[i][0]+(i%2?55:-110)} ${points[i][1]-45})`,class:'trail-pets'});pets.innerHTML='<use href="#pitpom-dog" width="62" height="46"/><use href="#pitpom-cat" x="45" y="-12" width="62" height="46"/>';s.append(pets);}
    });container.append(s);
    if(room){const active=container.querySelector('.current,.completed:last-child');active?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
  }
  let lastRoom,signature='';
  function render(room){
    lastRoom=room;const key=JSON.stringify([room?.sequence,room?.hole,room?.phase,GolfI18n.language]);if(key===signature)return;signature=key;
    const order=room?.sequence?.length?room.sequence:Array.from({length:room?.availableMaps??20},(_,i)=>i);
    for(const id of ['welcome-adventure','lobby-adventure','match-adventure','results-adventure'])paint($(id),order,room?.sequence?.length?room:null);
  }
  $('open-adventure').onclick=()=>{$('adventure-modal').hidden=false;window.GolfOnline?.cancelAim();};
  $('close-adventure').onclick=()=>$('adventure-modal').hidden=true;
  window.addEventListener('languagechange',()=>{signature='';render(lastRoom);});
  window.GolfAdventure={render,reset(){signature='';render(undefined);},busy(value){$('engine-loader').hidden=!value;},celebrate(winners){
    $('winner-banner').textContent=t('winners',{names:winners.map(p=>p.nickname).join(', ')});$('winner-banner').hidden=false;
    const layer=$('celebration');layer.replaceChildren();layer.hidden=false;
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches)for(let i=0;i<32;i++){const p=document.createElement('i');p.style.setProperty('--x',`${(i*61)%100}%`);p.style.setProperty('--delay',`${(i%8)*.12}s`);p.style.setProperty('--turn',`${(i%3)*90}deg`);layer.append(p);}
    setTimeout(()=>layer.hidden=true,4800);
  }};render();
})();
