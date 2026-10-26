/* Original, slow lo-fi instrumental: warm keys, bass and a soft brushed beat.
 * Audio is synthesized locally; it needs no track download or external service. */
(() => {
  'use strict';
  let enabled=true,volume=.24,context,master,mix,analyser,noise,timer,score,requestedWorld=0;
  let output,effectsBus,uiBus,voices=0,scene='menu',network=false,lastEventHole=-1,lastEvent=0,celebrations=0;
  const prefs={master:.8,effects:.7,ui:.45,muted:false},cooldowns=new Map();
  try{const p=JSON.parse(localStorage.getItem('pitpom-audio'));if(p){for(const k of ['master','effects','ui'])if(Number.isFinite(p[k]))prefs[k]=Math.max(0,Math.min(1,p[k]));prefs.muted=p.muted===true;}}catch{}
  const toggle=document.getElementById('toggle-music'),slider=document.getElementById('music-volume');
  try{const saved=JSON.parse(localStorage.getItem('pitpom-music'));if(saved){enabled=saved.enabled!==false;if(Number.isFinite(saved.volume))volume=Math.max(0,Math.min(1,saved.volume));}}catch{}
  const hz=midi=>440*Math.pow(2,(midi-69)/12);
  function save(){try{localStorage.setItem('pitpom-music',JSON.stringify({enabled,volume}));}catch{}}
  function update(){
    const world=requestedWorld?window.GOLF_CAMPAIGN?.worlds[requestedWorld-1]:null;
    const name=world?(world.names[GolfI18n.language]??world.names.en):GolfI18n.t('musicMenu');
    document.getElementById('music-track').textContent=GolfI18n.t('musicTrack',{world:name,bpm:PitPomLofi.scores[requestedWorld].bpm});
    toggle.textContent=GolfI18n.t(!context&&toggle.disabled?'audioUnavailable':enabled?'musicMute':'musicEnable');toggle.setAttribute('aria-pressed',String(enabled));slider.value=String(Math.round(volume*100));if(master)master.gain.setTargetAtTime(enabled?volume*(scene==='results'?.22:.45):0,context.currentTime,.15);if(output){output.gain.setTargetAtTime(prefs.muted?0:prefs.master,context.currentTime,.06);effectsBus.gain.setTargetAtTime(prefs.effects,context.currentTime,.06);uiBus.gain.setTargetAtTime(prefs.ui,context.currentTime,.06);}for(const [id,k]of [['master-volume','master'],['effects-volume','effects'],['ui-volume','ui']])document.getElementById(id).value=String(Math.round(prefs[k]*100));document.getElementById('mute-all').textContent=GolfI18n.t(prefs.muted?'unmuteAll':'muteAll');document.getElementById('mute-all').setAttribute('aria-pressed',String(prefs.muted));}
  function create(){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){toggle.disabled=slider.disabled=true;toggle.textContent=GolfI18n.t('audioUnavailable');return false;}
    context=new Audio();mix=context.createBiquadFilter();mix.type='lowpass';mix.frequency.value=1900;
    master=context.createGain();master.gain.value=enabled?volume*.45:0;
    analyser=context.createAnalyser();analyser.fftSize=512;
    output=context.createGain();effectsBus=context.createGain();uiBus=context.createGain();output.gain.value=prefs.muted?0:prefs.master;effectsBus.gain.value=prefs.effects;uiBus.gain.value=prefs.ui;
    mix.connect(master);master.connect(analyser);analyser.connect(output);effectsBus.connect(output);uiBus.connect(output);output.connect(context.destination);
    noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
    const data=noise.getChannelData(0);let previous=0,seed=197;
    for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;previous=(previous+(seed/2147483647*2-1)*.04)/1.04;data[i]=previous;}
    score=new PitPomLofi.Engine(context,mix,requestedWorld);return true;
  }
  function schedule(){if(!document.hidden&&context.state==='running')score?.schedule(undefined,enabled);}
  async function resume(){
    if(document.hidden)return;
    try{if(!context&&!create())return;await context.resume();if(document.hidden){pause();return;}if(!timer)timer=setInterval(schedule,80);schedule();}catch{}
  }
  function pause(){clearInterval(timer);timer=undefined;context?.suspend().catch(()=>{});}
  toggle.onclick=()=>{enabled=!enabled;update();save();resume();};
  slider.oninput=()=>{volume=Number(slider.value)/100;update();save();resume();};
  document.getElementById('music-controls').addEventListener('toggle',event=>{if(event.target.open)window.GolfOnline?.cancelAim();});
  document.addEventListener('pointerdown',resume,{capture:true,passive:true});
  document.addEventListener('keydown',resume,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(context)resume();});
  window.addEventListener('pagehide',pause);
  window.GolfMusic={
    status:()=>({enabled,volume,bpm:PitPomLofi.scores[requestedWorld].bpm,state:context?.state??'idle',world:requestedWorld,notes:0,...score?.status()}),
    world(value){const id=Number.isInteger(value)&&value>=0&&value<=10?value:0;if(id===requestedWorld)return false;requestedWorld=id;score?.setWorld(id);update();return true;},
    renderPreview:(world,seconds=12)=>PitPomLofi.render(world,seconds),
    level(){if(!analyser||context.state!=='running')return 0;const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);}
  };
  function effectTone(frequency,duration,level,time=0,bus=effectsBus,end=frequency){
    if(!context||context.state!=='running'||voices>=24)return;
    time+=context.currentTime;const osc=context.createOscillator(),gain=context.createGain();voices++;
    osc.type='triangle';osc.frequency.setValueAtTime(frequency,time);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,level),time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain);gain.connect(bus);osc.start(time);osc.stop(time+duration+.01);osc.onended=()=>{voices--;osc.disconnect();gain.disconnect();};
  }
  function applause(){
    if(!context||context.state!=='running')return;
    for(let i=0;i<42;i++){
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),time=context.currentTime+i*.09;
      source.buffer=noise;filter.type='bandpass';filter.frequency.value=900+(i*197)%1600;filter.Q.value=.6;
      gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.55,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+.1);
      source.connect(filter);filter.connect(gain);gain.connect(effectsBus);source.start(time,(i*.113)%noise.duration);source.stop(time+.12);
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    }
  }
  function play(kind,strength=.5){
    if(!context||context.state!=='running'||prefs.muted)return;
    const time=context.currentTime,previous=cooldowns.get(kind)??-100;if(time-previous<(kind==='water'?.5:.09))return;cooldowns.set(kind,time);
    const variation=.96+Math.random()*.08,level=.08+Math.max(0,Math.min(1,strength))*.15;
    if(kind==='shot'||kind==='wood')effectTone((kind==='shot'?350-strength*180:190)*variation,.16,level,0,effectsBus,80);
    else if(kind==='stone')effectTone(680*variation,.075,level,0,effectsBus,210);
    else if(kind==='impact')effectTone(190*variation,.2,level,0,effectsBus,420);
    else if(kind==='slap'){effectTone(550,.12,.22,0,effectsBus,90);effectTone(300,.2,.13,.08,effectsBus,150);}
    else if(kind==='capture'){effectTone(220,.22,.17,0,effectsBus,70);effectTone(90,.16,.1,.2,effectsBus,300);}
    else if(kind==='juju'){effectTone(470,.09,.17,0,effectsBus,130);effectTone(95,.24,.14,.07,effectsBus,48);effectTone(150,.16,.08,.18,effectsBus,80);}
    else if(kind==='romeu'){effectTone(340,.18,.12,0,effectsBus,170);effectTone(410,.13,.07,.12,effectsBus,230);}
    else if(kind==='luna'){effectTone(230,.11,.12,0,effectsBus,380);effectTone(180,.15,.10,.14,effectsBus,290);}
    else if(kind==='frida'){effectTone(520,.20,.10,0,effectsBus,850);effectTone(850,.24,.09,.17,effectsBus,390);}
    else if(kind==='portal'){effectTone(390,.28,.08,0,effectsBus,1250);}
    else if(kind==='ui')effectTone(720,.055,.08,0,uiBus,580);
    else if(kind==='countdown')effectTone(660,.16,.1);
    else if(kind==='water')effectTone(150,.18,.06,0,effectsBus,80);
    else if(kind==='error'){effectTone(280,.13,.1);effectTone(220,.18,.1,.13);}
    else if(['hole','courseDone','start','victory'].includes(kind)){
      const melody=kind==='victory'?[72,76,79,84,79,84]:kind==='hole'?[72,76,79]:[62,69,74];
      melody.forEach((m,i)=>effectTone(hz(m),kind==='victory'?.55:.28,.12,i*(kind==='victory'?.22:.12)));
    }
  }
  window.GolfAudio={play,
    engine(name,strength){const map={hit_ball:'shot',ball_in_hole:'hole',ball_in_water:'water',ball_out_of_bounds:'error',wood:'wood',stone:'stone',confirmation:'ui',button:'ui',ball_impact:'wood'};if(network&&['hit_ball','ball_in_hole','wood','stone','ball_impact'].includes(name))return;play(map[name]??(name.includes('button')?'ui':name.includes('confirm')?'ui':name),strength);},
    events(events,hole=0){network=true;if(hole!==lastEventHole){lastEventHole=hole;lastEvent=0;}const fresh=events.filter(e=>e.id>lastEvent);for(const e of fresh)lastEvent=Math.max(lastEvent,e.id);const priority={hole:0,capture:1,slap:1,juju:1,romeu:1,luna:1,frida:1,portal:1,shot:2,impact:3,wood:4,stone:4};fresh.sort((a,b)=>(priority[a.kind]??5)-(priority[b.kind]??5));for(const e of fresh.slice(0,6))play(e.kind,e.strength);},
    phase(next){scene=next;if(next==='menu'){network=false;lastEvent=0;lastEventHole=-1;GolfMusic.world(0);}update();if(next==='game')play('start');},
    victory(){celebrations++;scene='results';if(master)master.gain.setTargetAtTime(0,context.currentTime,.25);play('victory');setTimeout(applause,650);setTimeout(update,4600);},
    status:()=>({...prefs,voices,scene,celebrations,network,state:context?.state??'idle'})
  };
  for(const [id,key]of [['master-volume','master'],['effects-volume','effects'],['ui-volume','ui']])document.getElementById(id).oninput=e=>{prefs[key]=Number(e.target.value)/100;localStorage.setItem('pitpom-audio',JSON.stringify(prefs));update();resume();};
  document.getElementById('mute-all').onclick=()=>{prefs.muted=!prefs.muted;localStorage.setItem('pitpom-audio',JSON.stringify(prefs));update();resume();};
  document.addEventListener('click',event=>{if(event.target.closest('button,summary'))play('ui');},{passive:true});
  window.addEventListener('languagechange',update);
  update();
})();
