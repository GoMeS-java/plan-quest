import assert from 'node:assert/strict';
import '../src/citadel-space.js';
const space=globalThis.CitadelSpace;
let routes=0;
for(const room of ['rest','study','archive','forge','throne','observatory','gatehouse','refectory','cloister','vault']){
 for(const level of [1,2,3]){
  for(const x of [70,120,180,240,300,360,410])for(const y of [230,250,275,300]){
   const start={x:240,y:306},target={x,y},route=space.route(room,level,start,target);
   assert.deepEqual(route[0],start);
   assert(Math.hypot(route.at(-1).x-x,route.at(-1).y-y)<=Math.hypot(start.x-x,start.y-y)+.01,`${room}/${level} approaches a reachable point`);
   for(let i=1;i<route.length;i++)assert(space.clear(room,level,route[i-1],route[i]),`${room}/${level} cannot walk through furniture`);
   for(const p of route)assert(p.x>=62&&p.x<=418&&p.y>=228&&p.y<=306);
   routes++;
  }
 }
}
assert(!space.clear('rest',3,{x:270,y:250},{x:460,y:250}),'bed blocks a straight path');
assert.deepEqual(space.route('study',1,{x:140,y:300},{x:350,y:300}),[{x:140,y:300},{x:350,y:300}],'clear foreground aisle stays direct');
console.log(`PASS ${routes} interior routes across 30 scenes; furniture, floor and nearest reachable points`);
