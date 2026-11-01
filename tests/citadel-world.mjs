// Public spatial invariants only. No saves, personal data or reward definitions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{},Date});
vm.runInContext(readFileSync('src/citadel-world.js','utf8'),context);
const game=readFileSync('src/game.html','utf8');
const people=game.match(/var citadelPeople\s*=\s*(\[[\s\S]*?\]);/);
assert(people,'existing residents must be discoverable');
vm.runInContext('window.people='+people[1],context);
const w=context.window.CitadelWorld;
let samples=0;
for(const rank of [1,3,5,8,10,15,20,30]){
 for(const person of context.window.people){
  if(rank<person.rank)continue;
  const index=context.window.people.indexOf(person);
  // Every departure and return, including the staggered start and midnight.
  const starts=[0,7,10,18,21,23].map(h=>new Date(2027,3,16,h,0).getTime());
  for(let h=10;h<18;h++)starts.push(new Date(2027,3,16,h,15).getTime());
  for(const start of starts)for(let offset=-2;offset<=130;offset++){
   const now=start+offset*1000,st=w.resident(person,now,rank,index);
   assert(w.available(st.node,rank)&&w.available(st.next,rank),'resident enters an inaccessible node');
   assert(st.fraction>=0&&st.fraction<1,'invalid interpolation');
   assert(['travel','rest','meal','planning','craft','errand'].includes(st.occupation));
   assert.equal(st.moving,st.occupation==='travel');
   for(let n=1;n<st.path.length;n++)assert(w.graph[st.path[n-1]].includes(st.path[n]),'route skips a passage');
   for(const node of st.path)assert(w.available(node,rank),'path crosses a locked room');
   const restored=w.resident(person,now,rank,index);
   assert.equal(JSON.stringify(st),JSON.stringify(restored),'reload changes recovered state');
   if(st.moving){const next=w.resident(person,now+1000,rank,index);assert(next.node===st.node||next.node===st.next,'one second skips a route segment');}
   samples++;
  }
  const before=w.resident(person,new Date(2027,3,16,23,59,59).getTime(),rank,index);
  const after=w.resident(person,new Date(2027,3,17,0,0,1).getTime(),rank,index);
  assert.equal(before.node,after.node,'midnight teleport');
 }
}
assert.equal(Object.keys(w.ranks).length,10);assert.equal(w.floors.length,5);
console.log('PASS public world routes, occupations, reload determinism and midnight continuity: '+samples+' synthetic states');
