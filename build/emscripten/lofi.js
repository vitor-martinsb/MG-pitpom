/* Original instrumental scores and synthesized soundscapes, under the project
 * license. No recordings, model APIs, downloads or third-party samples. */
(() => {
  'use strict';
  const scores=[
    {bpm:62,chords:[[62,65,69,72],[58,62,65,69],[60,64,67,71],[57,60,64,67]],bass:[38,34,36,33],melody:[69,72,76,72,67,71,74,71],instrument:'keys',pad:'warm',air:'',beat:'soft'},
    {bpm:60,chords:[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,69]],bass:[36,33,29,31],melody:[72,76,79,76,74,72,69,67,72,76,81,79,76,74,72,67],instrument:'acoustic',pad:'warm',air:'birds',beat:'brush'},
    {bpm:58,chords:[[62,66,69,73],[59,62,66,69],[55,59,62,66],[57,62,64,69]],bass:[38,35,31,33],melody:[74,78,81,78,73,74,69,66,74,81,85,81,78,74,73,69],instrument:'water',pad:'sine',air:'water',beat:'soft',echo:.27},
    {bpm:62,chords:[[57,60,64,67],[53,57,60,64],[50,53,57,60],[52,56,59,62]],bass:[33,29,26,28],melody:[69,72,76,72,69,67,64,67,69,72,76,79,76,72,69,67],instrument:'round',pad:'sine',air:'',beat:'circle',echo:.32},
    {bpm:66,chords:[[53,57,60,64],[55,58,62,65],[58,62,65,69],[60,64,67,74]],bass:[29,31,34,36],melody:[65,69,72,74,76,74,72,69,67,69,74,77,76,72,69,65],instrument:'keys',pad:'warm',air:'',beat:'light'},
    {bpm:60,chords:[[55,59,62,66],[52,55,59,62],[48,52,55,59],[50,55,57,62]],bass:[31,28,24,26],melody:[79,81,83,86,83,81,79,74,76,79,83,81,79,76,74,71],instrument:'flute',pad:'sine',air:'wind',beat:'brush',echo:.38},
    {bpm:59,chords:[[50,53,57,60],[46,50,53,57],[43,46,50,53],[45,49,52,55]],bass:[26,22,19,21],melody:[74,75,77,81,79,77,75,74,72,69,70,74,77,75,72,69],instrument:'mist',pad:'sine',air:'mist',beat:'sparse',echo:.46},
    {bpm:64,chords:[[48,51,55,58],[44,48,51,55],[41,44,48,51],[43,47,50,53]],bass:[24,20,17,19],melody:[60,63,67,70,67,63,62,60,58,60,63,67,65,63,62,55],instrument:'warm',pad:'warm',air:'warmth',beat:'deep'},
    {bpm:58,chords:[[52,56,59,63],[49,52,56,59],[45,49,52,56],[47,52,54,59]],bass:[28,25,21,23],melody:[76,80,83,87,83,80,78,76,73,76,80,85,83,80,78,75],instrument:'stars',pad:'sine',air:'stars',beat:'sparse',echo:.58},
    {bpm:72,chords:[[54,57,61,64],[50,54,57,61],[47,50,54,57],[49,54,56,61]],bass:[30,26,23,25],melody:[66,69,73,76,73,69,68,66,64,66,69,73,71,69,68,61],instrument:'electro',pad:'warm',air:'',beat:'sync',echo:.22},
    {bpm:62,chords:[[60,64,67,71,74],[55,59,62,66],[57,60,64,67],[53,57,60,64],[50,53,57,60],[52,55,59,62],[53,57,60,64],[55,60,62,67]],bass:[36,31,33,29,26,28,29,31],melody:[72,76,79,83,86,83,79,76,74,77,81,84,83,79,76,72],instrument:'cinema',pad:'warm',air:'',beat:'light',echo:.3}
  ];
  const hz=midi=>440*2**((midi-69)/12);
  function noise(context,seed){
    const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),data=buffer.getChannelData(0),edge=context.sampleRate*.01;let last=0;
    for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;last=(last+(seed/2147483647*2-1)*.08)/1.08;data[i]=last*Math.min(1,i/edge,(data.length-1-i)/edge);}
    return buffer;
  }
  function ramp(track,to,time,duration){
    const from=track.fadeEnd>time?track.fadeFrom+(track.fadeTo-track.fadeFrom)*Math.max(0,(time-track.fadeStart)/(track.fadeEnd-track.fadeStart)):track.fadeTo;
    track.gain.gain.cancelScheduledValues(time);track.gain.gain.setValueAtTime(from,time);track.gain.gain.linearRampToValueAtTime(to,time+duration);
    Object.assign(track,{fadeFrom:from,fadeTo:to,fadeStart:time,fadeEnd:time+duration});
  }
  function track(context,destination,world,time,buffer){
    const profile=scores[world],input=context.createGain(),filter=context.createBiquadFilter(),gain=context.createGain();
    filter.type='lowpass';filter.frequency.value=world===7?1400:world===8?3000:2300;input.connect(filter);filter.connect(gain);gain.connect(destination);gain.gain.value=0;
    const result={context,world,profile,input,filter,gain,noise:buffer,sources:new Set(),nodes:[input,filter,gain],beat:0,next:time+.04,notes:0,voices:0,offline:typeof context.startRendering==='function',fadeFrom:0,fadeTo:0,fadeStart:time,fadeEnd:time,retire:Infinity};
    if(profile.echo){
      const delay=context.createDelay(1),feedback=context.createGain(),wet=context.createGain();delay.delayTime.value=profile.echo;feedback.gain.value=.22;wet.gain.value=.18;
      filter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(gain);result.nodes.push(delay,feedback,wet);
    }
    if(profile.air){
      const source=context.createBufferSource(),air=context.createBiquadFilter(),level=context.createGain();source.buffer=buffer;source.loop=true;
      air.type='bandpass';air.frequency.value=profile.air==='water'?600:profile.air==='wind'?1050:350;air.Q.value=.4;level.gain.value=profile.air==='water'?.025:.014;
      source.connect(air);air.connect(level);level.connect(input);source.start(time);result.sources.add(source);result.nodes.push(air,level);
    }
    ramp(result,1,time,.8);return result;
  }
  function tone(t,midi,time,duration,level,instrument=t.profile.instrument){
    if(t.voices>=80&&!t.offline)return;t.voices++;t.notes++;
    const c=t.context,voice=c.createGain(),fundamental=c.createOscillator(),overtone=c.createOscillator(),soft=c.createGain();
    const pad=instrument==='pad',flute=instrument==='flute',attack=pad?.3:flute?.1:.025;
    voice.gain.setValueAtTime(.0001,time);voice.gain.exponentialRampToValueAtTime(level,time+attack);
    voice.gain.exponentialRampToValueAtTime(level*(pad?.65:.35),time+Math.min(duration*.65,Math.max(attack+.02,.4)));
    voice.gain.exponentialRampToValueAtTime(.0001,time+duration);voice.connect(t.input);
    fundamental.type=instrument==='electro'?'triangle':'sine';fundamental.frequency.value=hz(midi);
    overtone.type=pad&&t.profile.pad==='warm'?'sawtooth':'triangle';overtone.frequency.value=hz(midi)*(pad?1:instrument==='stars'?3:2);overtone.detune.value=pad?6:2;
    soft.gain.value=pad?.022:instrument==='acoustic'?.18:flute?.035:.1;
    fundamental.connect(voice);overtone.connect(soft);soft.connect(voice);fundamental.start(time);overtone.start(time);fundamental.stop(time+duration+.02);overtone.stop(time+duration+.02);t.sources.add(fundamental);t.sources.add(overtone);
    fundamental.onended=()=>{t.voices--;t.sources.delete(fundamental);t.sources.delete(overtone);fundamental.disconnect();overtone.disconnect();soft.disconnect();voice.disconnect();};
  }
  function brush(t,time,level,frequency){
    const c=t.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=t.noise;filter.type='highpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(level,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.12);source.connect(filter);filter.connect(gain);gain.connect(t.input);source.start(time);source.stop(time+.14);t.sources.add(source);
    source.onended=()=>{t.sources.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
  }
  function kick(t,time,level){
    const c=t.context,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(95,time);o.frequency.exponentialRampToValueAtTime(40,time+.14);g.gain.setValueAtTime(level,time);g.gain.exponentialRampToValueAtTime(.0001,time+.28);
    o.connect(g);g.connect(t.input);o.start(time);o.stop(time+.3);t.sources.add(o);o.onended=()=>{t.sources.delete(o);o.disconnect();g.disconnect();};
  }
  function compose(t){
    const p=t.profile,b=t.beat,bar=Math.floor(b/4)%p.chords.length,chord=p.chords[bar],at=t.next,beat=60/p.bpm;
    if(b%4===0){for(let i=0;i<chord.length;i++)tone(t,chord[i],at+i*.025,beat*4.3,.025,'pad');tone(t,p.bass[bar%p.bass.length],at,beat*1.8,p.beat==='deep'?.095:.055,'warm');}
    const note=p.melody[b%p.melody.length];
    if(p.beat!=='sparse'||b%2===0)tone(t,note,at+(b%2?.025:0),beat*(p.instrument==='flute'?2.4:1.8),p.instrument==='cinema'?.068:.052);
    if(p.instrument==='cinema'&&b%4===2)tone(t,chord[2]+12,at+beat*.5,beat*2,.028);
    if(p.beat==='circle'||b%4===0)kick(t,at,p.beat==='deep'?.13:p.beat==='sync'?.085:.055);
    if(b%2===1)brush(t,at+.035,p.beat==='brush'?.026:.018,1000);
    if(p.beat==='sync'){brush(t,at+beat*.5,.014,2200);if(b%8===3||b%8===6)kick(t,at+beat*.5,.045);}
    if(p.air==='birds'&&b%8===4){tone(t,87,at,.35,.018,'flute');tone(t,91,at+.18,.28,.014,'flute');}
    if(p.air==='water'&&b%5===2)tone(t,88+(b%3)*2,at+.1,.55,.015,'water');
    if(p.air==='stars'&&b%4===1)tone(t,note+12,at,beat*3,.017,'stars');
    t.beat++;t.next+=beat;
  }
  class Engine{
    constructor(context,destination,world=0){this.context=context;this.destination=destination;this.noise=noise(context,197);this.layers=[];this.completedNotes=0;this.switches=0;this.setWorld(world);}
    setWorld(world){
      world=Number.isInteger(world)&&world>=0&&world<=10?world:0;if(this.active?.world===world)return false;
      const now=this.context.currentTime,changing=!!this.active;if(changing)this.switches++;
      for(const layer of this.layers)if(layer.retire===Infinity){ramp(layer,0,now,1.8);layer.retire=now+1.8;}
      this.active=track(this.context,this.destination,world,now,this.noise);if(changing)ramp(this.active,1,now,1.8);this.layers.push(this.active);return true;
    }
    schedule(until=this.context.currentTime+.18,playing=true){
      const now=this.context.currentTime;
      for(const layer of this.layers){
        if(layer.next<now)layer.next=now+.04;
        while(playing&&layer.next<until&&layer.next<layer.retire)compose(layer);
      }
      this.layers=this.layers.filter(layer=>{
        if(now<layer.retire+8)return true;
        this.completedNotes+=layer.notes;for(const source of layer.sources)try{source.stop();}catch{}for(const node of layer.nodes)node.disconnect();return false;
      });
    }
    status(){return {world:this.active.world,bpm:this.active.profile.bpm,beat:this.active.beat,notes:this.completedNotes+this.layers.reduce((n,t)=>n+t.notes,0),switches:this.switches,layers:this.layers.length,voices:this.layers.reduce((n,t)=>n+t.voices,0)};}
  }
  async function render(world,seconds=12){
    const Audio=window.OfflineAudioContext||window.webkitOfflineAudioContext,context=new Audio(1,Math.ceil(seconds*22050),22050),gain=context.createGain();gain.gain.value=.1;gain.connect(context.destination);
    const engine=new Engine(context,gain,world);engine.schedule(seconds);return context.startRendering();
  }
  window.PitPomLofi=Object.freeze({Engine,scores,render});
})();
