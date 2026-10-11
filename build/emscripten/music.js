/* Original, slow lo-fi instrumental: warm keys, bass and a soft brushed beat.
 * Audio is synthesized locally; it needs no track download or external service. */
(() => {
  'use strict';
  const bpm=62,beatLength=60/bpm;
  const chords=[[62,65,69,72,76],[58,62,65,69,74],[60,64,67,71,74],[57,60,64,67,72]];
  const bass=[38,43,36,41];
  let enabled=true,volume=.24,context,master,mix,analyser,noise,timer,nextBeat=0,beat=0,notes=0;
  const toggle=document.getElementById('toggle-music'),slider=document.getElementById('music-volume');
  try{const saved=JSON.parse(localStorage.getItem('pitpom-music'));if(saved){enabled=saved.enabled!==false;if(Number.isFinite(saved.volume))volume=Math.max(0,Math.min(1,saved.volume));}}catch{}
  const hz=midi=>440*Math.pow(2,(midi-69)/12);
  function save(){try{localStorage.setItem('pitpom-music',JSON.stringify({enabled,volume}));}catch{}}
  function update(){toggle.textContent=GolfI18n.t(!context&&toggle.disabled?'audioUnavailable':enabled?'musicMute':'musicEnable');toggle.setAttribute('aria-pressed',String(enabled));slider.value=String(Math.round(volume*100));if(master)master.gain.setTargetAtTime(enabled?volume*.45:0,context.currentTime,.08);}
  function create(){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){toggle.disabled=slider.disabled=true;toggle.textContent=GolfI18n.t('audioUnavailable');return false;}
    context=new Audio();mix=context.createBiquadFilter();mix.type='lowpass';mix.frequency.value=1900;
    master=context.createGain();master.gain.value=enabled?volume*.45:0;
    analyser=context.createAnalyser();analyser.fftSize=512;
    mix.connect(master);master.connect(analyser);analyser.connect(context.destination);
    noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
    const data=noise.getChannelData(0);let previous=0,seed=197;
    for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;previous=(previous+(seed/2147483647*2-1)*.04)/1.04;data[i]=previous;}
    nextBeat=context.currentTime+.06;return true;
  }
  function tone(midi,time,duration,level){
    const voice=context.createGain();voice.gain.setValueAtTime(.0001,time);
    voice.gain.exponentialRampToValueAtTime(level,time+.035);
    voice.gain.exponentialRampToValueAtTime(level*.35,time+.35);
    voice.gain.exponentialRampToValueAtTime(.0001,time+duration);voice.connect(mix);
    const fundamental=context.createOscillator(),overtone=context.createOscillator(),soft=context.createGain();
    fundamental.type='sine';fundamental.frequency.value=hz(midi);
    overtone.type='triangle';overtone.frequency.value=hz(midi)*2;overtone.detune.value=3;soft.gain.value=.13;
    fundamental.connect(voice);overtone.connect(soft);soft.connect(voice);
    fundamental.start(time);overtone.start(time);fundamental.stop(time+duration+.02);overtone.stop(time+duration+.02);
    fundamental.onended=()=>{fundamental.disconnect();overtone.disconnect();soft.disconnect();voice.disconnect();};notes++;
  }
  function kick(time){
    const osc=context.createOscillator(),gain=context.createGain();osc.frequency.setValueAtTime(100,time);osc.frequency.exponentialRampToValueAtTime(42,time+.14);
    gain.gain.setValueAtTime(.17,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.3);
    osc.connect(gain);gain.connect(mix);osc.start(time);osc.stop(time+.32);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  function brush(time,level,frequency){
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=noise;filter.type='highpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(level,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.12);
    source.connect(filter);filter.connect(gain);gain.connect(mix);source.start(time);source.stop(time+.14);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  function schedule(){
    if(!enabled||document.hidden||context.state!=='running')return;
    if(nextBeat<context.currentTime)nextBeat=context.currentTime+.06;
    while(nextBeat<context.currentTime+.18){
      const bar=Math.floor(beat/8)%chords.length,chord=chords[bar];
      if(beat%8===0)for(let i=0;i<chord.length;i++)tone(chord[i],nextBeat+i*.025,6.8,.065);
      if(beat%4===0){tone(bass[bar],nextBeat,2,.09);kick(nextBeat);}
      if(beat%4===2)brush(nextBeat+.025,.16,650);
      if(beat%2===1)brush(nextBeat+.045,.07,1400);
      if(beat%4===3)tone(chord[3+(Math.floor(beat/4)%2)],nextBeat+.03,1.7,.045);
      beat++;nextBeat+=beatLength;
    }
  }
  async function resume(){
    if(!enabled||document.hidden)return;
    try{if(!context&&!create())return;await context.resume();if(!enabled||document.hidden){pause();return;}if(!timer)timer=setInterval(schedule,80);schedule();}catch{}
  }
  function pause(){clearInterval(timer);timer=undefined;context?.suspend().catch(()=>{});}
  toggle.onclick=()=>{enabled=!enabled;update();save();if(enabled)resume();else pause();};
  slider.oninput=()=>{volume=Number(slider.value)/100;update();save();resume();};
  document.getElementById('music-controls').addEventListener('toggle',event=>{if(event.target.open)window.GolfOnline?.cancelAim();});
  document.addEventListener('pointerdown',resume,{capture:true,passive:true});
  document.addEventListener('keydown',resume,{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(context)resume();});
  window.addEventListener('pagehide',pause);
  window.GolfMusic={
    status:()=>({enabled,volume,bpm,state:context?.state??'idle',notes}),
    level(){if(!analyser||context.state!=='running'||!enabled||volume===0)return 0;const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);}
  };
  window.addEventListener('languagechange',update);
  update();
})();
