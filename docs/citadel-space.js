/* Foot coordinates in the same 480x320 plane as the room art. No save writes. */
(function(root){
 'use strict';
 var furniture={
  rest:[[28,246,128,274],[114,240,177,267],[172,253,303,282],[288,239,464,283]],
  study:[[28,242,111,282],[375,241,453,282],[170,250,304,282],[298,247,363,279]],
  archive:[[25,241,117,282],[371,241,461,282],[131,233,193,265],[203,255,340,286],[302,218,356,249]],
  forge:[[24,240,153,282],[315,246,432,282],[194,246,260,281]],
  throne:[[146,207,367,250],[204,216,313,263],[48,254,115,285],[359,249,426,282]],
  observatory:[[177,238,292,262],[25,249,142,281],[350,255,417,285]],
  gatehouse:[[24,242,148,282],[122,254,259,285],[190,242,266,261],[358,249,425,283]],
  refectory:[[77,218,416,281],[18,234,87,272]],
  cloister:[[156,224,332,266],[16,250,130,281],[355,250,466,281]],
  vault:[[19,244,139,282],[147,251,215,282],[227,254,295,285],[309,250,377,282]]
 };
 var ruins={rest:[[290,231,451,279]],study:[[68,238,129,273],[173,239,319,279]],archive:[[68,238,129,273],[173,239,319,279]],throne:[[183,235,320,269]],forge:[[62,244,167,269],[217,248,282,281]],observatory:[[183,249,289,280]],gatehouse:[[141,246,214,275],[317,256,384,286]],refectory:[[92,236,384,284]],cloister:[[173,242,310,279]],vault:[[103,257,174,285],[286,257,356,285]]};
 function obstacles(room,level){return (level>1?furniture:ruins)[room]||[];}
 function clamp(p){return {x:Math.max(62,Math.min(418,p.x)),y:Math.max(228,Math.min(306,p.y))};}
 function inside(p,b){return p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3];}
 function boxes(room,level){return obstacles(room,level).map(function(b){return [b[0]-6,b[1]-4,b[2]+6,b[3]+4];});}
 function nearest(point,bs){
  var p=clamp(point),best=null;
  if(!bs.some(function(b){return inside(p,b);}))return p;
  var candidates=[];
  bs.forEach(function(b){candidates.push({x:b[0]-1,y:p.y},{x:b[2]+1,y:p.y},{x:p.x,y:b[1]-1},{x:p.x,y:b[3]+1});});
  // Foreground aisle is always available, including at the largest footprints.
  candidates.push({x:p.x,y:306});
  candidates.map(clamp).forEach(function(q){if(bs.some(function(b){return inside(q,b);}))return;var d=(p.x-q.x)**2+(p.y-q.y)**2;if(!best||d<best.d)best={p:q,d:d};});
  return best?best.p:{x:240,y:306};
 }
 function clear(a,b,bs){
  return bs.every(function(r){
   var lo=0,hi=1,dx=b.x-a.x,dy=b.y-a.y;
   for(var k=0;k<2;k++){
    var v=k?dy:dx,start=k?a.y:a.x,min=r[k],max=r[k+2];
    if(Math.abs(v)<.00001){if(start<=min||start>=max)return true;}
    else{var t1=(min-start)/v,t2=(max-start)/v;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>=hi)return true;}
   }
   return hi<=0||lo>=1;
  });
 }
 function route(room,level,from,to){
  var bs=boxes(room,level),a=nearest(from,bs),b=nearest(to,bs),nodes=[a,b];
  bs.forEach(function(r){[[r[0]-1,r[1]-1],[r[2]+1,r[1]-1],[r[0]-1,r[3]+1],[r[2]+1,r[3]+1]].forEach(function(v){var p=clamp({x:v[0],y:v[1]});if(!bs.some(function(t){return inside(p,t);}))nodes.push(p);});});
  var dist=nodes.map(function(){return Infinity;}),prev=[],done=[];dist[0]=0;
  for(var n=0;n<nodes.length;n++){
   var u=-1;nodes.forEach(function(_,i){if(!done[i]&&(u<0||dist[i]<dist[u]))u=i;});if(u<0||!isFinite(dist[u]))break;if(u===1)break;done[u]=true;
   nodes.forEach(function(p,v){if(done[v]||!clear(nodes[u],p,bs))return;var d=dist[u]+Math.hypot(p.x-nodes[u].x,p.y-nodes[u].y);if(d<dist[v]){dist[v]=d;prev[v]=u;}});
  }
  var end=1;
  if(!isFinite(dist[1])){
   end=0;nodes.forEach(function(p,i){if(isFinite(dist[i])&&Math.hypot(p.x-b.x,p.y-b.y)<Math.hypot(nodes[end].x-b.x,nodes[end].y-b.y))end=i;});
  }
  var path=[nodes[end]],i=end;while(i!==0){i=prev[i];path.unshift(nodes[i]);}return path;
 }
 root.CitadelSpace=Object.freeze({obstacles:obstacles,route:route,nearest:function(room,level,p){return nearest(p,boxes(room,level));},clear:function(room,level,a,b){return clear(a,b,boxes(room,level));}});
})(typeof globalThis!=='undefined'?globalThis:this);
