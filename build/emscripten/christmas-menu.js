/* Christmas artwork derived from the supplied reference. One opaque surface
 * keeps tails, paws and background connected throughout the animation. */
(() => {
  'use strict';
  const home=document.getElementById('home'),scene=document.getElementById('home-scenery');
  const canvas=document.createElement('canvas');canvas.id='christmas-menu-art';canvas.setAttribute('aria-hidden','true');scene.append(canvas);
  const ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)'),images={},cache=new Map();
  const compositions={
    portrait:{file:'menu-christmas-portrait.png',feet:1220,group:[205,835],
      pets:{luna:[205,765,185,245],romeu:[390,785,165,225],frida:[560,845,145,165],maritaca:[690,810,110,155],pituca:[240,998,220,225],pompom:[470,995,200,230],juju:[675,1010,160,215]},
      tails:[[204,934,50,70],[381,947,34,57],[669,933,38,70],[757,900,41,65],[605,1117,65,97],[781,1126,56,86]],
      bulbs:[[55,28],[116,44],[179,54],[242,66],[302,72],[365,78],[425,78],[485,80],[550,78],[610,72],[673,63],[736,54],[797,44],[856,30],[891,22]]},
    landscape:{file:'menu-christmas.png',feet:875,group:[330,985],
      pets:{luna:[330,424,190,245],romeu:[515,444,180,225],frida:[697,495,150,176],maritaca:[832,464,118,210],pituca:[360,660,225,215],pompom:[603,653,200,225],juju:[809,672,177,204]},
      tails:[[329,595,50,70],[509,610,36,53],[808,604,41,64],[909,570,45,65],[735,748,72,108],[925,766,62,98]],
      bulbs:[[302,12],[390,28],[475,36],[560,42],[638,48],[717,51],[793,51],[870,48],[948,45],[1025,40],[1101,34],[1177,26],[1246,18],[1316,8]]}
  };
  let decoded=false,frame=0,last=0,frames=0,layout,preparation;
  const active=()=>decoded&&window.GolfSeason?.theme==='christmas';
  function placement(){
    const host=home.getBoundingClientRect(),w=host.width,h=host.height,key=h>=w?'portrait':'landscape',spec=compositions[key],image=images[key];
    if(!w||!h||!image)return;
    let scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
    // Fit the whole portrait width, including the flag and tree. Only empty
    // sky and grass bands extend on taller phones; pets keep their proportions.
    if(key==='portrait')scale=w/image.naturalWidth;
    const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale,extra=Math.max(0,h-ih);
    let x=(w-iw)/2,y=extra?0:(h-ih)/2,skyExtra=key==='portrait'?extra*.7:0,grassExtra=extra-skyExtra;
    x=Math.max(12-spec.group[0]*scale,Math.min(x,w-12-spec.group[1]*scale));
    if(key==='portrait'){
      const menu=document.getElementById('main-menu'),limit=!menu.hidden?menu.getBoundingClientRect().top-host.top-16:h*.80;
      if(!extra)y=Math.max(h-ih,Math.min(y,limit-spec.feet*scale));
      const lift=Math.min(Math.max(0,spec.feet*scale+y+skyExtra-limit),skyExtra+65*scale*.75);
      skyExtra-=lift;grassExtra+=lift;
    }else y=Math.max(h-ih,Math.min(y,h-20-spec.feet*scale));
    layout={key,spec,image,w,h,x,y,scale,extra,skyExtra,grassExtra,host};return layout;
  }
  function tailImage(l,index,phase){
    const key=`${l.key}:${index}:${phase}`;if(cache.has(key))return cache.get(key);
    const [x,y,w,h]=l.spec.tails[index],c=document.createElement('canvas');c.width=w;c.height=h;
    const t=c.getContext('2d'),guard=5,middle=Math.floor(w/2),amplitude=phase/4*Math.min(3.5,h*.035);
    t.drawImage(l.image,x,y,w,h,0,0,w,h);t.clearRect(guard,guard,w-guard*2,h-guard*2);
    for(let row=guard;row<h-guard;row++){
      const shift=amplitude*Math.sin(Math.PI*(row-guard)/(h-guard*2-1))**2,split=middle+shift;
      t.drawImage(l.image,x+guard,y+row,middle-guard,1,guard,row,split-guard,1);
      t.drawImage(l.image,x+middle,y+row,w-middle-guard,1,split,row,w-split-guard,1);
    }
    cache.set(key,c);return c;
  }
  function render(now=0){
    const l=placement();if(!l)return;const d=Math.min(devicePixelRatio||1,1.5),width=Math.round(l.w*d),height=Math.round(l.h*d);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(d*l.scale,0,0,d*l.scale,d*l.x,d*l.y);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const image=l.image,iw=image.naturalWidth,ih=image.naturalHeight;
    if(l.key==='portrait'&&(l.skyExtra||l.grassExtra)){
      const sky=l.skyExtra/l.scale,grass=l.grassExtra/l.scale;
      // Safari antialiases fractional destination edges. Extend each strip by
      // one physical pixel, sampling the real neighboring artwork, so adjacent
      // strips cover the join completely without changing the image mapping.
      function strip(sourceY,sourceHeight,destY,destHeight){
        const pad=1/(d*l.scale),sourcePad=pad*sourceHeight/destHeight;
        const top=Math.max(0,sourceY-sourcePad),bottom=Math.min(ih,sourceY+sourceHeight+sourcePad);
        ctx.drawImage(image,0,top,iw,bottom-top,0,destY+(top-sourceY)*destHeight/sourceHeight,iw,(bottom-top)*destHeight/sourceHeight);
      }
      strip(0,90,0,90);strip(90,65,90,65+sky);
      strip(155,1105,155+sky,1105);strip(1260,220,1260+sky,220+grass);
      strip(1480,ih-1480,1480+sky+grass,ih-1480);
    }else ctx.drawImage(image,0,0);
    if(!motion.matches){
      ctx.save();ctx.translate(0,l.skyExtra/l.scale);
      l.spec.tails.forEach(([x,y,w,h],i)=>{const phase=Math.round(Math.sin(now/(440+i*43)+i)*4);ctx.drawImage(tailImage(l,i,phase),x,y,w,h);});
      ctx.restore();
      // Gentle light variation stays on the actual painted bulbs, never off.
      l.spec.bulbs.forEach(([x,y],i)=>{const alpha=.06+.06*(.5+.5*Math.sin(now/1250+i));ctx.fillStyle=`rgba(255,242,188,${alpha})`;ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();});
    }
    canvas.dataset.composition=l.key;frames++;
  }
  function tick(now){frame=0;if(!active()||home.hidden||document.hidden)return;if(now-last>=33){last=now;render(now);}frame=requestAnimationFrame(tick);}
  function update(){
    if(window.GolfSeason?.theme==='christmas'&&!decoded)prepare();
    cancelAnimationFrame(frame);frame=0;
    if(active()&&!home.hidden&&!document.hidden){render(performance.now());if(!motion.matches)frame=requestAnimationFrame(tick);}
  }
  function prepare(){if(preparation)return preparation;
  preparation=Promise.all(Object.entries(compositions).map(async([key,spec])=>{const image=new Image();image.src='art/'+spec.file;images[key]=image;await image.decode();})).then(()=>{
    decoded=true;home.dataset.christmasArt='ready';update();window.dispatchEvent(new Event('seasonartready'));return true;
  }).catch(()=>{home.dataset.christmasArt='fallback';return false;});return preparation;}
  window.GolfChristmasMenu=Object.freeze({get ready(){return prepare();},mount(){scene.append(canvas);update();},get active(){return active();},petBounds(id){
    if(!active())return;const l=placement(),b=l?.spec.pets[id];if(!b)return;
    return {x:l.x+b[0]*l.scale,y:l.y+b[1]*l.scale+l.skyExtra,width:b[2]*l.scale,height:b[3]*l.scale};
  },diagnostics:()=>({ready:decoded,active:active(),composition:layout?.key,frames,cache:cache.size,scale:layout?.scale,extraGrass:layout?.grassExtra??0,extraSky:layout?.skyExtra??0})});
  new ResizeObserver(update).observe(home);new MutationObserver(update).observe(home,{attributes:true,attributeFilter:['hidden','data-screen']});
  window.addEventListener('seasonchange',update);document.addEventListener('visibilitychange',update);motion.addEventListener('change',update);
})();
