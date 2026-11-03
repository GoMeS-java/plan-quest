/* A detailed, read-only view of the canonical equipped sprite. No saves or progress rules. */
(function(root){
 'use strict';
 var SCALE=6,WIDTH=192,HEIGHT=192,cache=new WeakMap();
 function rgb(color){var n=parseInt(color.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
 function tone(color,k,light){return color.map(function(v){return Math.max(0,Math.min(255,Math.round(v*k+(light||0))));});}
 function pixels(source,outfit,palette){
  var out=new Uint8ClampedArray(WIDTH*HEIGHT*4);
  if(!Array.isArray(source)||source.length!==32*52)return out;
  palette=palette||{};outfit=outfit||{};var colors={},materials=[];
  ['top','outer'].forEach(function(slot){var item=outfit[slot];if(!item||!item.c)return;Object.keys(item.c).forEach(function(key){var value=item.c[key];if(/^#[0-9a-f]{6}$/i.test(value))materials.push({color:rgb(value),shape:item.shape,role:key});});});
  function color(c){return colors[c]||(colors[c]=rgb(c));}
  function material(c){var nearest=null,best=Infinity;materials.forEach(function(m){var d=m.color.reduce(function(sum,v,i){return sum+(v-c[i])*(v-c[i]);},0);if(d<best){best=d;nearest=m;}});return nearest;}
  var fabric={};
  for(var y=0;y<32;y++)for(var x=0;x<32;x++){
   var original=source[y*32+x];if(!original)continue;
   var base=color(original),hair=[palette.hair,palette.hair2,palette.hair3].indexOf(original)!==-1&&y<10;
   var skin=[palette.skin,palette.skin2,palette.blush].indexOf(original)!==-1&&y<18;
   var mat=y>=16&&original!==palette.out&&!skin?(fabric[original]||(fabric[original]=material(base))):null;
   for(var sy=0;sy<SCALE;sy++)for(var sx=0;sx<SCALE;sx++){
    var gx=x*SCALE+sx,gy=y*SCALE+sy,k=1,add=0,c=base;
    if(original===palette.out){
     var near=null,dist=6;
     [[-1,0,sx],[1,0,5-sx],[0,-1,sy],[0,1,5-sy]].forEach(function(d){var nx=x+d[0],ny=y+d[1],v=nx>=0&&nx<32&&ny>=0&&ny<52?source[ny*32+nx]:null;if(v&&v!==palette.out&&d[2]<dist){near=v;dist=d[2];}});
     if(near&&dist<3){c=color(near);k=.63+(2-dist)*.09;}
    }else if(hair){
     k=.94+.07*Math.cos((gx-65)/28);var strand=(gx+Math.floor(gy/5))%11;
     if(strand===2||strand===3)k+=.11;if(strand===8)k-=.08;
     if(sy===1&&source[(y-1)*32+x]===palette.out)k+=.12;
    }else if(skin){
     k=1.015-(gx-72)*.0012;
     if(y>=10&&y<=14)k+=.025*Math.cos((gx-91)/13);
     if(original===palette.blush)k=1.025;
    }else if(original===palette.eye){
     if(sy===0||sy===5)c=color(palette.skin2);else if((x===13||x===17)&&sx<2&&sy>1)c=[220,207,184];
     else if((x===14||x===18)&&sx<3&&sy>1)c=[98,77,54];
     if((x===14||x===18)&&sx===0&&sy===2)c=[244,231,203];
    }else if(original===palette.mouth){
     if(sy<2||sy>3)c=color(palette.skin);else k=sy===2?.88:1.09;
    }else if(mat){
     k=1.035-(gx/192)*.075;
     if(mat.shape==='knit'){
      var stitch=(gx+((Math.floor(gy/4)%2)*2))%6;if(gy%4===0&&stitch<3)k+=.09;else if(gy%4===2&&stitch>3)k-=.075;
     }else if(mat.shape==='sweatshirt'){
      if(gy%14===0)k-=.045;if(gx%19===0&&gy%7===0)k+=.04;
     }else if(mat.shape==='coat'){
      if((gx+gy)%9===0)k+=.055;if((gx-gy+192)%13===0)k-=.045;
     }else if(mat.shape==='jacket'){
      if(gx%18===0)k+=.085;if(gx%18===2)k-=.06;
     }else if(mat.shape==='puffer'){
      k+=.065*Math.sin((gy%24)/24*Math.PI);if(gy%24>21)k-=.1;
     }else if(mat.shape==='plaid'){
      if(gy%5===0||gx%5===0)k-=.05;else if((gx+gy)%11===0)k+=.06;
     }
     if((mat.role==='zip'||mat.role==='btn')&&sx===2&&sy<2)add=24;
    }
    var value=tone(c,k,add),offset=(gy*WIDTH+gx)*4;out[offset]=value[0];out[offset+1]=value[1];out[offset+2]=value[2];out[offset+3]=255;
   }
  }
  return out;
 }
 function paint(canvas,source,outfit,palette){
  if(!canvas)return false;var key=JSON.stringify([source,outfit,palette]);if(cache.get(canvas)===key)return false;
  var ctx=canvas.getContext('2d');if(!ctx)return false;
  if(canvas.width!==WIDTH)canvas.width=WIDTH;if(canvas.height!==HEIGHT)canvas.height=HEIGHT;
  var data=ctx.createImageData(WIDTH,HEIGHT);data.data.set(pixels(source,outfit,palette));ctx.putImageData(data,0,0);cache.set(canvas,key);return true;
 }
 root.VkachPortrait=Object.freeze({width:WIDTH,height:HEIGHT,pixels:pixels,paint:paint});
})(typeof window==='undefined'?globalThis:window);
