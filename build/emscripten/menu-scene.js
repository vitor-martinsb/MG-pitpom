/* Straight-alpha reference characters and sky-free foliage, rigged in place. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},children=[])=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);e.append(...children);return e;};
  // The established illustration mask is now used only by the unchanged bird.
  function birdSprite(original,p,contour){
    const x=Math.max(0,Math.floor(p.head[0]-p.head[2]-35)),y=Math.max(0,Math.floor(p.head[1]-p.head[3]-25));
    const w=Math.min(original.naturalWidth-x,Math.ceil(p.head[2]*2+115)),h=Math.ceil(p.anchor[1]-y+18),scale=2;
    const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;const ctx=c.getContext('2d');
    ctx.scale(scale,scale);ctx.drawImage(original,x,y,w,h,0,0,w,h);
    ctx.globalCompositeOperation='destination-in';ctx.save();ctx.translate(-x,-y);ctx.fill(new Path2D(contour),'evenodd');ctx.restore();ctx.globalCompositeOperation='source-over';
    const bounds=original.naturalWidth===1672?[1148,535,38,23]:[752,942,35,41];let tail;
    if(bounds){const [a,b,cw,ch]=bounds,t=document.createElement('canvas');t.width=w*scale;t.height=h*scale;const tc=t.getContext('2d');tc.scale(scale,scale);tc.drawImage(c,0,0,w,h);tc.globalCompositeOperation='destination-in';tc.fillRect(a-x,b-y,cw,ch);tail={url:t.toDataURL(),x,y,w,h};ctx.clearRect(a-x,b-y,cw,ch);}
    return {url:c.toDataURL(),tail,x,y,w,h,canvas:c,scale};
  }
  function without(source,paths){
    const c=document.createElement('canvas'),mask=document.createElement('canvas');c.width=mask.width=source.canvas.width;c.height=mask.height=source.canvas.height;const m=mask.getContext('2d');m.scale(source.scale,source.scale);m.translate(-source.x,-source.y);for(const path of paths)m.fill(new Path2D(path));m.globalCompositeOperation='destination-out';m.lineWidth=2.4;for(const path of paths)m.stroke(new Path2D(path));
    const ctx=c.getContext('2d');ctx.drawImage(source.canvas,0,0);ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,0);return {...source,url:c.toDataURL(),canvas:c};
  }
  // The supplied five-character reference is kept as separate straight-alpha
  // exports. Uniform scale and the existing foot anchors preserve their staging.
  const referenceRigs={
    luna:{bounds:[0,440,415,923],feet:220,head:[214,600,201,157],ears:[[91,553,86,74],[337,519,70,68]],eyes:[[179,578,28,32,'#443228'],[285,560,28,32,'#443228']],tail:[0,770,111,149],pivot:[115,880]},
    romeu:{bounds:[310,510,690,916],feet:498,head:[498,657,182,144],ears:[[365,688,50,65],[633,688,47,65]],eyes:[[453,655,28,31,'#353236'],[553,655,28,31,'#353236']],tail:[310,800,90,120],pivot:[404,900]},
    frida:{bounds:[625,530,941,928],feet:790,head:[785,672,155,140],ears:[[722,584,42,48],[884,622,38,43]],eyes:[],tail:[865,768,76,160],pivot:[870,895]},
    pituca:{bounds:[55,905,545,1378],feet:300,head:[300,1060,245,149],ears:[[165,1065,103,98],[460,992,75,78]],eyes:[[269,1042,33,38,'#333238'],[392,1011,33,38,'#333238']]},
    pompom:{bounds:[505,897,941,1377],feet:700,head:[680,1049,160,146],ears:[[620,971,54,55],[800,1009,52,43]],eyes:[[632,1065,32,36,'#f1a150'],[733,1096,32,36,'#eda04d']],tail:[800,1120,141,260],pivot:[801,1338]}
  };
  function referenceSprite(original,template){
    const r=referenceRigs[template.id],[left,top,right,bottom]=r.bounds;
    const targetTop=Math.min(template.head[1]-template.head[3],...template.ears.map(e=>e[1]-e[3]));
    const ratio=(template.anchor[1]-targetTop)/(bottom-top),x=template.anchor[0]-(r.feet-left)*ratio,y=targetTop;
    const w=Math.ceil((right-left)*ratio)+2,h=Math.ceil((bottom-top)*ratio)+2,scale=2;
    const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;
    const ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.imageSmoothingQuality='high';
    ctx.drawImage(original,left,top,right-left,bottom-top,0,0,(right-left)*ratio,(bottom-top)*ratio);
    const point=([a,b,...rest])=>[x+(a-left)*ratio,y+(b-top)*ratio,...rest.map(v=>typeof v==='number'?v*ratio:v)];
    const rig={...template,head:point(r.head),ears:r.ears.map(point),eyes:r.eyes.map(point)};
    let tail;
    if(r.tail){
      const [a,b,cw,ch]=r.tail.map((v,i)=>i<2?(v-(i?top:left))*ratio:v*ratio);
      const t=document.createElement('canvas');t.width=c.width;t.height=c.height;
      const tc=t.getContext('2d');tc.drawImage(c,0,0);tc.globalCompositeOperation='destination-in';tc.fillRect(a*scale,b*scale,cw*scale,ch*scale);
      tail={url:t.toDataURL(),x,y,w,h};ctx.clearRect(a,b,cw,ch);
      const pivot=point(r.pivot);rig.tail=['',...pivot];
    }
    return {url:c.toDataURL(),tail,x,y,w,h,canvas:c,scale,rig};
  }
  function foliageSprite(original){
    const c=document.createElement('canvas');c.width=original.naturalWidth;c.height=original.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(original,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);
    for(let i=0;i<pixels.data.length;i+=4){
      const [r,g,b]=pixels.data.subarray(i,i+3);
      // Only interior leaf pigment moves. Sky/mountains and their mixed edge
      // pixels are transparent; the unmodified plate owns the outer silhouette.
      const coverage=Math.min(1,Math.max(0,(g-b-24)/16),Math.max(0,(g-r-5)/10));
      pixels.data[i+3]=Math.round(255*coverage);
    }
    ctx.putImageData(pixels,0,0);return {url:c.toDataURL(),x:0,y:0,w:c.width,h:c.height};
  }
  const oval=([x,y,rx,ry])=>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 -${rx*2} 0`;
  function cloudSprite(original,[x,y,w,h]){
    const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(original,x,y,w,h,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);
    for(let k=0;k<pixels.data.length;k+=4)if(pixels.data[k]<210||pixels.data[k+1]<205||pixels.data[k+2]<180)pixels.data[k+3]=0;
    ctx.putImageData(pixels,0,0);return {url:c.toDataURL(),x,y,w,h};
  }
  const layouts={
    landscape:{w:1672,h:941,sun:[1414,110,79],hub:[1259,304],post:'M1118 548L1144 548L1144 646L1118 646Z',
      blades:'M1259 291L1213 229L1191 248L1247 306L1184 354L1203 378L1259 317L1304 388L1329 370L1272 305L1344 252L1323 230L1260 290Z',
      vegetation:[['M0 0H452Q454 79 386 109Q344 155 287 140Q249 185 183 145Q92 208 0 206Z',130,182],['M1420 296Q1436 201 1503 191Q1574 172 1617 261L1610 351Q1488 365 1420 296Z',1513,357],['M0 814Q72 774 149 830L236 941H0Z',85,941],['M1470 828Q1556 777 1672 807V941H1470Z',1590,941],['M388 903Q409 866 434 907L435 919L403 921Z',420,920],['M1559 458Q1602 438 1634 468L1644 504L1575 508Z',1607,505]],
      pets:[
        {id:'luna',body:'M551 485Q556 462 589 450Q633 429 674 446Q717 432 733 453L728 480L716 487L699 509L694 562L692 630Q696 649 663 646L626 648L588 638Q548 634 554 608Q553 589 572 588L581 571L584 534L565 521Z',anchor:[650,645],head:[644,522,87,82],ears:[[582,484,28,42],[707,466,27,31]],tail:['M586 633Q554 635 554 610Q550 589 571 589Q585 593 577 608Q569 617 589 616Z',588,625],eyes:[[626,491,11,12,'#473627'],[671,486,11,12,'#352b22']]},
        {id:'romeu',body:'M739 526Q732 509 744 502Q736 486 753 481Q755 464 776 466Q784 451 801 461Q819 450 832 463Q850 453 860 470Q883 466 886 487Q906 491 899 512Q906 532 890 545L880 560L880 602Q887 634 872 646L818 649L769 641Q733 642 733 614L742 591L759 588L761 565Z',anchor:[816,645],head:[820,521,85,66],ears:[[756,526,20,31],[880,524,19,30]],tail:['M765 635Q728 638 735 607Q738 590 748 589Q761 589 757 605Q752 614 773 615Z',771,625],eyes:[[800,513,10,12,'#272827'],[846,512,10,12,'#272827']]},
        {id:'frida',body:'M942 522L946 486Q966 491 981 505L1008 506L1052 496L1050 532L1046 558L1042 593Q1056 581 1066 593Q1085 612 1067 630L1048 636Q1034 654 1008 647L977 651L953 645Q927 648 923 627Q920 608 938 605L942 570L924 559L937 554Z',anchor:[997,647],head:[993,543,63,59],ears:[[957,509,15,23],[1037,516,16,24]],tail:['M1041 622Q1064 618 1050 605Q1042 593 1055 589Q1069 586 1075 604Q1081 632 1044 638Z',1045,632],eyes:[[962,543,10,5,'#827d72'],[1014,547,10,5,'#898277']],closed:true},
        {id:'maritaca',body:'M1100 491Q1101 470 1122 469Q1147 467 1152 493L1164 514L1185 554L1160 548L1149 562L1135 563L1130 551Q1112 549 1112 535L1114 509L1101 509Z',anchor:[1137,557],head:[1124,491,26,26],ears:[],tail:['M1145 528L1164 534L1185 554L1165 550L1157 555Z',1147,532],eyes:[[1128,491,6,7,'#73ac38']]},
        {id:'pituca',body:'M610 699Q610 676 640 663Q650 641 676 639Q712 624 742 643Q777 631 799 647Q829 648 832 672Q835 694 801 700L789 722L787 775L798 800Q810 826 789 838L753 839L725 841L696 837L665 839Q631 838 634 813L643 786L651 751L664 732Q642 745 623 735Q606 725 610 699Z',anchor:[719,836],head:[726,691,112,65],ears:[[643,704,34,37],[803,672,29,27]],eyes:[[702,683,13,14,'#28282a'],[756,669,12,13,'#242427']]},
        {id:'pompom',body:'M887 730Q881 703 904 682L917 636Q937 632 957 659L994 654L1028 661L1032 682L1023 721L1020 745Q1028 724 1052 725Q1082 727 1089 758Q1090 792 1056 814L1029 824Q1014 841 989 839L966 842L943 836L915 837Q886 837 891 814L902 783L904 750L890 745Z',anchor:[960,837],head:[956,706,70,64],ears:[[928,661,19,25],[1012,679,19,25]],tail:['M1017 817Q1040 798 1029 773Q1016 753 1032 734Q1051 715 1075 738Q1102 765 1073 795Q1046 822 1017 825Z',1020,819],eyes:[[923,704,12,14,'#f7ad4b'],[974,715,12,14,'#e89637']]}
      ]},
    portrait:{w:941,h:1672,sun:[829,485,60],hub:[710,693],post:'M721 950H749V1039H721Z',
      blades:'M710 680L672 626L653 645L699 694L647 735L663 753L711 707L751 763L770 749L724 694L782 649L763 632L711 682Z',
      vegetation:[['M0 252Q137 251 154 340Q231 350 191 458Q256 499 182 558Q89 628 0 597Z',70,591],['M811 665Q819 589 878 581Q926 568 941 601V763Q863 745 811 665Z',882,767],['M0 1415Q80 1369 185 1464L222 1672H0Z',95,1672],['M751 1482Q839 1428 941 1465V1672H741Z',870,1672],['M745 1140Q760 1114 778 1146L777 1164H749Z',763,1165]],
      pets:[
        {id:'luna',body:'M231 894Q235 871 267 863Q293 842 330 853Q368 839 394 860L389 888L372 895L364 945L356 1006L355 1035L328 1039L300 1040L265 1034Q232 1030 232 1006Q232 986 251 985L261 950L254 929Q234 925 231 894Z',anchor:[308,1035],head:[315,910,84,66],ears:[[254,893,26,34],[369,872,25,29]],tail:['M266 1026Q232 1026 233 1004Q232 984 249 987Q263 990 256 1005L274 1014Z',268,1022],eyes:[[297,897,10,12,'#463629'],[337,894,10,12,'#352c24']]},
        {id:'romeu',body:'M399 932Q391 919 404 908Q399 893 415 885Q417 872 434 874Q446 858 463 869Q481 859 493 873Q515 870 523 889Q545 895 542 917Q550 940 532 951L523 968L523 999Q536 1026 514 1035L472 1038L423 1032Q391 1032 394 1008L405 984L420 980L422 965Z',anchor:[470,1034],head:[470,921,77,62],ears:[[414,934,18,25],[529,932,18,25]],tail:['M422 1023Q387 1026 396 1000Q399 983 411 984Q423 988 415 1001L432 1011Z',426,1020],eyes:[[452,917,10,11,'#272827'],[494,918,10,11,'#272827']]},
        {id:'frida',body:'M577 928L582 892L612 911L639 915L674 905L678 934L670 965L665 991Q678 981 690 992Q705 1014 684 1027L665 1035L638 1041L612 1038L585 1039Q559 1037 560 1016Q556 999 574 996L578 973L562 963L575 958Z',anchor:[628,1036],head:[624,949,62,58],ears:[[591,914,16,25],[662,925,16,26]],tail:['M662 1020Q684 1011 672 1002Q665 990 680 989Q697 990 696 1009Q696 1029 663 1035Z',666,1029],eyes:[[599,947,10,5,'#827d72'],[642,951,10,5,'#898277']],closed:true},
        {id:'maritaca',body:'M704 905Q708 883 729 882Q750 882 756 905L762 932L778 951L771 960L787 981L767 980L749 960L736 961L727 952Q716 949 716 930L716 918L705 918Z',anchor:[739,959],head:[729,904,26,25],ears:[],tail:['M747 937L762 939L783 978L769 977L753 957Z',751,945],eyes:[[731,902,6,7,'#73ac38']]},
        {id:'pituca',body:'M283 1092Q284 1073 309 1062Q325 1032 356 1031Q381 1013 411 1029Q441 1018 465 1034Q488 1044 480 1063Q477 1084 451 1083L438 1108L440 1153Q458 1178 446 1195L420 1203L391 1205L363 1199L337 1202Q305 1201 304 1179L315 1149L324 1125Q295 1130 286 1114Z',anchor:[381,1200],head:[385,1074,102,59],ears:[[313,1092,32,32],[457,1052,27,26]],eyes:[[365,1069,13,14,'#28282a'],[410,1056,12,13,'#242427']]},
        {id:'pompom',body:'M525 1120Q519 1092 537 1071L551 1034Q571 1030 586 1054L614 1058L645 1058L648 1080L636 1125L636 1143Q640 1119 664 1110Q697 1108 695 1144Q703 1184 653 1196L635 1205L610 1212L587 1209L564 1205L541 1208Q519 1205 519 1186L530 1158L536 1130Z',anchor:[588,1205],head:[584,1100,64,60],ears:[[559,1058,17,23],[633,1081,17,24]],tail:['M633 1198Q651 1176 639 1153Q630 1129 651 1115Q674 1101 690 1124Q707 1152 680 1178Q658 1196 633 1202Z',635,1197],eyes:[[550,1093,11,13,'#f7ad4b'],[595,1104,11,13,'#e89637']]}
      ]}
  };
  function mount(container,home){
    let current,root,animations=[],loaded=false,tick,clock=new Date(),lastClock=0,serial=0;const originals={};let contours;
    const motion=matchMedia('(prefers-reduced-motion: reduce)'),portrait=matchMedia('(orientation:portrait)');
    function image(file,w,h){return el('image',{href:`art/${file}`,width:w,height:h});}
    function build(){
      const layout=portrait.matches?'portrait':'landscape';if(current===layout)return;
      current=layout;loaded=false;for(const a of animations)a.cancel();animations=[];
      const d=layouts[layout],suffix=layout==='portrait'?'-portrait':'',original=`menu-garden${suffix}.png`;
      root=el('svg',{viewBox:`0 0 ${d.w} ${d.h}`,preserveAspectRatio:'xMidYMid slice','aria-hidden':'true',class:'living-menu-art'});
      const defs=el('defs');root.append(defs);
      const matrix=el('feColorMatrix',{type:'matrix',values:'1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0'}),filter=el('filter',{id:'menu-light',filterUnits:'userSpaceOnUse',x:0,y:0,width:d.w,height:d.h,'color-interpolation-filters':'sRGB'},[matrix]);defs.append(filter);
      const characterMatrix=matrix.cloneNode(),characterFilter=el('filter',{id:'menu-character-light',filterUnits:'userSpaceOnUse',x:0,y:0,width:d.w,height:d.h,'color-interpolation-filters':'sRGB'},[characterMatrix]);defs.append(characterFilter);
      const daylight=el('g',{filter:'url(#menu-light)'});root.append(daylight);
      const golden=el('linearGradient',{id:'menu-golden',x1:0,y1:0,x2:0,y2:1,gradientUnits:'objectBoundingBox'},[el('stop',{offset:0,'stop-color':'#efaa83'}),el('stop',{offset:'.3','stop-color':'#efaa83','stop-opacity':'.95'}),el('stop',{offset:'.65','stop-color':'#efaa83','stop-opacity':0})]);defs.append(golden);
      const sunset=el('g',{'data-sunset':'true'},[el('rect',{width:d.w,height:d.h,fill:'url(#menu-golden)'})]);
      daylight.append(image(`menu-sky-clean${suffix}.png`,d.w,d.h));
      const solar=el('g',{'data-night':'moon'}),[sx,sy,sr]=d.sun;
      solar.append(el('circle',{cx:sx,cy:sy,r:sr,fill:'#fff1bc'}));
      for(const [x,y,r]of [[-.28,-.23,.19],[.18,.2,.23],[.28,-.32,.1],[-.35,.32,.12],[.02,-.5,.13]])solar.append(el('circle',{cx:sx+x*sr,cy:sy+y*sr,r:sr*r,fill:'#dfcf9e',opacity:'.4'}));
      root.append(solar);
      const stars=el('g',{'data-night':'stars',fill:'#eef8ff'});for(let i=0;i<38;i++){
        const x=(i*157+467)%d.w,y=20+(i*73)%(layout==='portrait'?485:130);if(Math.hypot(x-sx,y-sy)<sr+18||(layout==='portrait'&&x<220&&y>240))continue;
        stars.append(el('circle',{cx:x,cy:y,r:i%5===0?2.2:1.15,opacity:.45+(i%4)*.15}));
      }root.append(stars);
      function cut(path,parent=daylight,kind='',source){
        const id=`menu-cut-${++serial}`,clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'},[el('path',{d:path,'clip-rule':'evenodd'})]);defs.append(clip);
        const img=source?el('image',{href:source.url,x:source.x,y:source.y,width:source.w,height:source.h}):image(original,d.w,d.h);
        const group=el('g',kind?{'data-motion':kind}:{});group.append(el('g',{'clip-path':`url(#${id})`},[img]));parent.append(group);return group;
      }
      function animate(group,frames,options){group.style.transformBox='view-box';const eased=frames.map(frame=>({easing:options.easing??'linear',...frame}));animations.push(group.animate(eased,{iterations:Infinity,...options,easing:'linear'}));}
      const clouds=layout==='landscape'?[[430,25,215,102],[1083,28,130,61],[1530,80,142,101],[236,142,110,58]]:[[181,402,187,110],[577,440,147,65],[800,295,141,83],[824,511,117,75]];
      for(const [i,bounds]of clouds.entries()){
        // Edge/occluded cloud crops become rectangles once moved into the sky.
        // Use complete original cloud silhouettes, retaining each cloud anchor.
        const complete=i%2?[1078,23,140,71]:[425,20,225,112];
        const source=cloudSprite(originals['menu-garden.png'],complete),ratio=Math.min(bounds[2]/source.w,bounds[3]/source.h);
        source.x=bounds[0];source.y=bounds[1];source.w*=ratio;source.h*=ratio;
        const cloud=el('g',{'data-motion':'cloud'});
        for(const dx of [-d.w,0,d.w])cloud.append(el('image',{href:source.url,x:source.x+dx,y:source.y,width:source.w,height:source.h}));
        daylight.append(cloud);animate(cloud,[{transform:'translateX(0px)'},{transform:`translateX(${d.w}px)`}],{duration:d.w/(.65+i*.06)*1000,easing:'linear'});
      }
      daylight.append(sunset);
      const water=el('g',{'data-motion':'water','pointer-events':'none'}),waterMask=`menu-water-${++serial}`;
      defs.append(el('clipPath',{id:waterMask},[el('path',{d:layout==='landscape'?'M1190 522H1672V768L1540 768L1513 626L1444 613L1385 635L1288 586L1190 564Z':'M779 900H941V974L800 988L749 961Z'})]));water.setAttribute('clip-path',`url(#${waterMask})`);
      const surface=el('g');for(let i=0;i<16;i++){const x=layout==='landscape'?1195+(i*67)%460:778+(i*37)%180,y=layout==='landscape'?539+(i*29)%179:909+(i*19)%66;surface.append(el('path',{d:`M${x} ${y}q12 -3 25 0t25 0`,fill:'none',stroke:i%3?'#c2f2e6':'#f8ffed','stroke-width':i%3?1.2:1.8,'stroke-linecap':'round',opacity:.22+(i%3)*.05}));}water.append(surface);daylight.append(water);
      animate(surface,[{transform:'translate(0px,0px)',opacity:.55},{transform:'translate(8px,1px)',opacity:.95,offset:.48},{transform:'translate(0px,0px)',opacity:.55}],{duration:8100,easing:'ease-in-out'});
      const rotor=cut(d.blades,daylight,'mill');rotor.style.transformOrigin=`${d.hub[0]}px ${d.hub[1]}px`;animate(rotor,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:72000,easing:'linear'});
      cut(d.post); // The parrot keeps its original perch even on the clean plate.
      const foliageSource=foliageSprite(originals[`menu-sky-clean${suffix}.png`]);
      const foliageMask=`menu-foliage-${++serial}`;
      const mask=el('mask',{id:foliageMask,maskUnits:'userSpaceOnUse',x:0,y:0,width:d.w,height:d.h});
      mask.style.maskType='alpha';mask.append(el('image',{href:foliageSource.url,width:d.w,height:d.h}));defs.append(mask);
      for(const [path,x,y]of d.vegetation){
        const leaf=cut(path,daylight,'wind',foliageSource);leaf.setAttribute('mask',`url(#${foliageMask})`);
        const foliage=leaf.querySelector('image');foliage.style.transformOrigin=`${x}px ${y}px`;
        animate(foliage,[{transform:'skewX(-.35deg) rotate(-.28deg)'},{transform:'skewX(.45deg) rotate(.3deg)',offset:.43},{transform:'skewX(-.35deg) rotate(-.28deg)'}],{duration:11600,easing:'ease-in-out',delay:-2500});
      }
      const pets=el('g',{filter:'url(#menu-character-light)'});root.append(pets);
      const characterBounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
      for(const [index,template]of d.pets.entries()){
        const source=referenceRigs[template.id]?referenceSprite(originals[`menu-pet-${template.id}.png`],template):birdSprite(originals[original],template,contours[layout][template.id].path);
        characterBounds.left=Math.min(characterBounds.left,source.x);characterBounds.top=Math.min(characterBounds.top,source.y);
        characterBounds.right=Math.max(characterBounds.right,source.x+source.w);characterBounds.bottom=Math.max(characterBounds.bottom,source.y+source.h);
        const p=source.rig??template,rectangle=`M${source.x} ${source.y}h${source.w}v${source.h}h-${source.w}Z`;
        if(p.id!=='maritaca')pets.append(el('ellipse',{cx:p.anchor[0],cy:p.anchor[1]+1,rx:p.head[2]*.85,ry:12,fill:'#224a31',opacity:'.24'}));
        const animal=el('g',{'data-pet':p.id,'data-source-art':source.rig?`menu-pet-${p.id}.png`:original});pets.append(animal);animal.style.transformOrigin=`${p.anchor[0]}px ${p.anchor[1]}px`;
        animate(animal,[{transform:'scale(1,1)'},{transform:'scale(1.002,1.009)'},{transform:'scale(1,1)'}],{duration:3900+index*367,delay:-index*947,easing:'ease-in-out'});
        if(source.tail){const tail=cut(rectangle,animal,'tail',source.tail);tail.style.transformOrigin=`${p.tail[1]}px ${p.tail[2]}px`;animate(tail,[{transform:'rotate(-2deg)'},{transform:'rotate(2.4deg)',offset:.42},{transform:'rotate(-2deg)'}],{duration:6100+index*587,delay:-index*1700,easing:'ease-in-out'});}
        cut(rectangle,animal,'body',without(source,[oval(p.head),...p.ears.map(oval)]));
        const head=cut(oval(p.head),animal,'head',without(source,p.ears.map(oval)));
        head.style.transformOrigin=`${p.head[0]}px ${p.head[1]+p.head[3]*.7}px`;
        animate(head,[{transform:'rotate(0deg)'},{transform:'rotate(0deg)',offset:.58},{transform:'rotate(.65deg)',offset:.73},{transform:'rotate(-.4deg)',offset:.86},{transform:'rotate(0deg)'}],{duration:17000+index*2429,delay:-index*2917,easing:'ease-in-out'});
        const lids=el('g',{'data-motion':'blink'});head.append(lids);
        for(const [x,y,rx,ry,color]of p.eyes){const lid=el('g');lid.style.transformOrigin=`${x}px ${y}px`;lid.style.transformBox='view-box';
          lid.append(el('ellipse',{cx:x,cy:y,rx:rx+1.5,ry:ry+1.5,fill:color}),el('path',{d:`M${x-rx+2} ${y}Q${x} ${y+4} ${x+rx-2} ${y}`,fill:'none',stroke:'#28272b','stroke-width':2.2,'stroke-linecap':'round'}));lids.append(lid);
          const period=28700+index*1139,frames=[{transform:'scaleY(0)',opacity:0,offset:0}];
          for(const time of [.15+index*.008,.43-index*.012,.81+index*.009])frames.push({transform:'scaleY(0)',opacity:0,offset:time},{transform:'scaleY(1)',opacity:1,offset:time+.0035},{transform:'scaleY(0)',opacity:0,offset:time+.008});
          frames.push({transform:'scaleY(0)',opacity:0,offset:1});animate(lid,frames,{duration:period,delay:-index*1397,easing:'ease-in-out'});
        }
        for(const [i,[x,y,rx,ry]]of p.ears.entries()){
          const ear=cut(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 -${rx*2} 0`,head,'ear',source);ear.style.transformOrigin=`${x}px ${y-ry*.55}px`;
          animate(ear,[{transform:'rotate(0deg)'},{transform:'rotate(0deg)',offset:.70},{transform:`rotate(${i?-1.2:1.2}deg)`,offset:.80},{transform:'rotate(0deg)',offset:.88},{transform:'rotate(0deg)'}],{duration:19900+index*1777+i*389,delay:-index*3677-i*1700,easing:'ease-in-out'});
        }
      }
      // Stable filter buffers: animated cloud tiles and pet parts must not
      // resize objectBoundingBox surfaces on every frame (notably on Android).
      for(const [key,value]of Object.entries({x:characterBounds.left-32,y:characterBounds.top-32,width:characterBounds.right-characterBounds.left+64,height:characterBounds.bottom-characterBounds.top+64}))characterFilter.setAttribute(key,String(value));
      const lamps=el('g',{'data-night':'lamps'}),lights=layout==='portrait'?[[709,791],[712,741],[855,1000],[917,1010],[200,839],[76,804]]:[[1259,409],[1259,358],[1434,638],[1521,655],[209,421],[1109,441]];
      for(const [x,y]of lights){lamps.append(el('circle',{cx:x,cy:y,r:15,fill:'#ffd76a',opacity:'.08'}),el('circle',{cx:x,cy:y,r:8,fill:'#ffd76a',opacity:'.15'}),el('rect',{x:x-2.6,y:y-4,width:5.2,height:8,rx:1.8,fill:'#fff1aa'}));}root.append(lamps);
      root._matrix=matrix;root._characterMatrix=characterMatrix;container.replaceChildren(root);home.dataset.sceneReady='true';loaded=true;updateLight();visibility();
    }
    const colors={morning:{ink:[22,62,39],surface:[255,249,227],accent:[73,108,55]},afternoon:{ink:[40,59,30],surface:[255,244,217],accent:[79,101,49]},sunset:{ink:[59,35,38],surface:[255,226,191],accent:[115,66,52]},night:{ink:[231,243,255],surface:[22,43,72],accent:[48,77,107]}};
    const attribute=(node,key,value)=>{value=String(value);if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
    const property=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
    function updateLight(){
      if(!root)return;const s=GolfMenuClock.sample(clock),w=s.weights,n=w.night,u=w.sunset,m=w.morning;
      attribute(home,'data-period',s.period);attribute(home,'data-time-zone',s.timeZone);
      for(const key of ['ink','surface','accent']){const c=[0,1,2].map(i=>Math.round(Object.entries(w).reduce((v,[p,f])=>v+colors[p][key][i]*f,0)));const value=`rgb(${c.join(',')})`;property(home,`--menu-${key}`,value);property(document.body,`--menu-${key}`,value);}
      // Matrix tints the original art, including all character cutouts, equally.
      const r=1-.89*n-.03*m,g=1-.84*n-.14*u,b=1-.60*n-.36*u;
      attribute(root._matrix,'values',`${r} 0 0 0 ${.025*u} 0 ${g} 0 0 0 0 0 ${b} 0 ${.01*n} 0 0 0 1 0`);
      attribute(root._characterMatrix,'values',`${1-.40*n} 0 0 0 0 0 ${1-.38*n-.06*u} 0 0 0 0 0 ${1-.22*n-.15*u} 0 ${.01*n} 0 0 0 1 0`);
      root.querySelectorAll('[data-night]').forEach(e=>property(e,'opacity',String(n)));property(home,'--menu-night',String(n));
      property(root.querySelector('[data-sunset]'),'opacity',String(u*.83));
      lastClock=performance.now();
    }
    function visibility(){
      const run=!home.hidden&&!document.hidden;
      for(const a of animations){a.updatePlaybackRate(motion.matches?.3:1);if(run&&a.playState!=='running')a.play();else if(!run&&a.playState==='running')a.pause();}
      home.dataset.motion=motion.matches?'gentle':'full';
      clearInterval(tick);tick=undefined;
      if(!home.hidden&&!document.hidden){clock=new Date();updateLight();tick=setInterval(()=>{clock=new Date();updateLight();},1000);}
    }
    const observer=new MutationObserver(visibility);observer.observe(home,{attributes:true,attributeFilter:['hidden']});
    document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',visibility);portrait.addEventListener('change',build);
    // Decode once. The established static illustration remains as a load fallback.
    const images=['menu-sky-clean.png','menu-sky-clean-portrait.png','menu-garden.png','menu-garden-portrait.png',...Object.keys(referenceRigs).map(id=>`menu-pet-${id}.png`)];
    const ready=Promise.all([fetch('art/menu-contours.json').then(r=>{if(!r.ok)throw new Error('Menu contours unavailable');return r.json();}).then(data=>{contours=data;}),...images.map(file=>{const i=new Image();i.src=`art/${file}`;originals[file]=i;return i.decode();})]).then(build).catch(()=>{home.dataset.sceneReady='fallback';});
    return Object.freeze({ready,get diagnostics(){return {layout:current,loaded,motion:home.dataset.motion,animations:animations.length,running:animations.filter(a=>a.playState==='running').length,lastClock};}});
  }
  window.GolfMenuScene=Object.freeze({mount});
})();
