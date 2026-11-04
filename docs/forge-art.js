/* Authored pixel layers, composed deterministically for each earned reward. */
(function(root){
  'use strict';
  var palettes=[
    ['#211d3b','#494268','#826181','#d18b83','#f4c688','#62587b','#423c63','#292c49','#1b2237','#ab776d'],
    ['#151e38','#354265','#626b8f','#ad8197','#f4bf99','#606a89','#41496f','#2b3655','#19263c','#917b87'],
    ['#172b39','#355567','#66898a','#a8aaa3','#e3cf9e','#577583','#395669','#283d52','#162d3e','#809483']
  ];
  var cache=new Map();
  function svg(seed){
    if(cache.has(seed))return cache.get(seed);
    var p=palettes[seed%palettes.length],state=seed||1,art=[];
    function random(max){state=(Math.imul(state,1664525)+1013904223)>>>0;return Math.floor(state/4294967296*max);}
    function rect(x,y,w,h,c){art.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>');}
    function shape(points,c){art.push('<polygon points="'+points+'" fill="'+c+'"/>');}
    rect(0,0,240,120,p[0]);rect(0,27,240,20,p[1]);rect(0,47,240,19,p[2]);rect(0,66,240,54,p[3]);
    for(var star=0;star<38;star++)rect(random(240),3+random(45),1+random(2),1,star%5===0?p[4]:p[2]);
    var sun=124+random(47),sy=47+random(9);
    for(var line=0;line<22;line++){
      var r=Math.floor(Math.sqrt(121-(line-10)*(line-10)));
      rect(sun-r,sy+line,r*2+1,1,p[4]);
    }
    for(var cloud=0;cloud<20;cloud++)rect(random(240),28+random(52),5+random(37),1,cloud%3?p[2]:p[3]);
    function ridge(y,amp,color){
      var points='0,120',last=y;
      for(var x=0;x<=240;x+=4){
        var height=y+Math.round(Math.sin((x+seed%33)/18)*amp+Math.sin((x+11)/8)*amp/3)+random(3);
        points+=' '+x+','+last+' '+x+','+height;last=height;
      }
      shape(points+' 240,120',color);
    }
    ridge(66,15,p[5]);ridge(78,13,p[6]);ridge(94,10,p[7]);ridge(108,6,p[8]);
    var tower=sun-16;
    rect(tower,74,13,13,p[7]);rect(tower+3,68,7,17,p[7]);
    rect(tower+2,67,2,3,p[7]);rect(tower+8,67,2,3,p[7]);rect(tower+5,73,2,2,p[4]);rect(tower+10,79,2,1,p[4]);
    shape((tower+4)+',83 '+(tower+8)+',83 142,95 139,100 159,110 174,120 153,120 129,109 128,101 134,95',p[9]);
    for(var tree=0;tree<48;tree++){
      var tx=random(240),ty=96+random(27),h=3+random(7);
      if(tx>126&&tx<171)continue;
      rect(tx,ty-h,1,h+1,p[8]);rect(tx-1,ty-h+2,3,3,p[8]);rect(tx-2,ty-h+4,5,2,p[8]);
      if(tree%7===0)rect(tx+1,ty-1,1,1,p[4]);
    }
    var url='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" shape-rendering="crispEdges">'+art.join('')+'</svg>');
    if(cache.size>=64)cache.delete(cache.keys().next().value);
    cache.set(seed,url);return url;
  }
  root.VkachForgeArt=Object.freeze({svg:svg});
})(globalThis);
