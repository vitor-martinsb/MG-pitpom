/* Calendar time is always Brasilia; the player's browser timezone is irrelevant. */
(() => {
  'use strict';
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const clamp=x=>Math.max(0,Math.min(1,x));
  function sample(date=new Date()){
    const p=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
    const minutes=Number(p.hour)*60+Number(p.minute)+Number(p.second)/60;
    let period,start,previous;
    if(minutes>=360&&minutes<720){period='morning';start=360;previous='night';}
    else if(minutes>=720&&minutes<1080){period='afternoon';start=720;previous='morning';}
    else if(minutes>=1080&&minutes<1140){period='sunset';start=1080;previous='afternoon';}
    else{period='night';start=minutes<360?-300:1140;previous='sunset';}
    const x=clamp((minutes-start)/12),blend=x*x*(3-2*x);
    const weights={morning:0,afternoon:0,sunset:0,night:0};weights[previous]=1-blend;weights[period]=blend;
    return {period,minutes,weights,timeZone:'America/Sao_Paulo'};
  }
  globalThis.GolfMenuClock=Object.freeze({sample});
})();
