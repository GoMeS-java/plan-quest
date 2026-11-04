// All fixtures are synthetic. Keep assertion diagnostics free of private definitions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const src=await readFile('src/legends.js','utf8'),box={};vm.createContext(box);vm.runInContext(src,box);const E=box.VkachLegends;
let checks=0;
function check(fn){try{fn();checks++;}catch{throw Error('Cosmetic ledger invariant failed in group '+(checks+1));}}
function fixture(complete=false){
 const docs={'cfg/citadel':{decor:{rest:'none'},selectedRoom:'rest'},'cfg/outfit':{top:'knit_beige'},'cfg/rare':{kept:'2026-10-19'}};
 if(complete)for(let n=0;n<240;n++){const day=new Date(Date.UTC(2026,9,19+n)).toISOString().slice(0,10);docs['days/'+day]={q:Array(10).fill(true)};docs['spont/'+n]={date:day,done:true};}
 let writes=0;return {docs,get writes(){return writes;},tx:{get:p=>structuredClone(docs[p]||null),list:c=>Object.entries(docs).filter(([p])=>p.startsWith(c+'/')).map(([p,d])=>({...structuredClone(d),id:p.split('/')[1]})),set:(p,d)=>{docs[p]=structuredClone(d);writes++;}}};
}
check(()=>{const f=fixture();E.reconcile(f.tx,'2026-11-01',1793560000000);assert.equal(f.writes,0);assert.equal(E.earned(null).length,0);});
check(()=>{const f=fixture(true),before=structuredClone(f.docs);E.reconcile(f.tx,'2027-07-01',1793560000000);assert(E.earned(f.docs['cfg/legends']).length>0);const once=JSON.stringify(f.docs);for(let i=0;i<10;i++)E.reconcile(f.tx,'2027-07-01',1793560000000+i);assert.equal(JSON.stringify(f.docs),once);assert.equal(f.writes,1);for(const p of Object.keys(before))assert.deepEqual(f.docs[p],before[p]);});
check(()=>{const f=fixture(true);E.reconcile(f.tx,'2027-07-01',1793560000000);const copy=JSON.parse(JSON.stringify(f.docs));assert.equal(JSON.stringify(E.earned(copy['cfg/legends'])),JSON.stringify(E.earned(f.docs['cfg/legends'])));Object.keys(copy).filter(p=>p.startsWith('days/')||p.startsWith('spont/')).forEach(p=>delete copy[p]);assert(E.earned(copy['cfg/legends']).length>0);});
check(()=>{const f=fixture(true);E.reconcile(f.tx,'2026-10-19',1793560000000);assert.equal(f.writes,0);});
check(()=>{const f=fixture(true);E.reconcile(f.tx,'2027-07-01',1793560000000);const old=structuredClone(f.docs['cfg/legends']);old.futureField={retained:true};old.unlocked.unknown={version:7,at:1};f.docs['cfg/legends']=old;E.reconcile(f.tx,'2027-07-01',1793560000001);assert.deepEqual(f.docs['cfg/legends'],old);});
check(()=>{assert.equal(E.Awakening.initial().status,'idle');let s=E.Awakening.transition(null,'start');s=E.Awakening.transition(s,'skip');assert.equal(s.status,'skipped');assert.equal(E.Awakening.transition(s,'replay').step,0);});
check(()=>{const a={version:1,active:'test',unlocked:{synthetic:{version:1,at:10,presented:true,kept:1}},future:{kept:true}},b={version:1,active:'',unlocked:{synthetic:{version:1,at:20,presented:false,remote:2},other:{version:1,at:30}}};const merged=E.merge(a,b);assert.equal(merged.active,'');assert.equal(merged.unlocked.synthetic.at,10);assert.equal(merged.unlocked.synthetic.presented,true);assert.equal(merged.unlocked.synthetic.kept,1);assert.equal(merged.unlocked.synthetic.remote,2);assert(merged.unlocked.other);assert(merged.future.kept);assert.equal(JSON.stringify(E.merge(merged,b)),JSON.stringify(merged));assert.equal(a.unlocked.synthetic.at,10);});
check(()=>{const a={unlocked:{synthetic:{version:1,at:10,presented:true}}};assert.equal(E.merge(a,{unlocked:{synthetic:{version:1,at:-1}}}).unlocked.synthetic.presented,true);assert.equal(E.merge(a,null).unlocked.synthetic.presented,true);});
const current=await readFile('src/game.html','utf8'),baseline=execFileSync('git',['show','ee0f428:src/game.html'],{encoding:'utf8'});
check(()=>{for(const [start,end]of [['  function trialOf(', '  function trialProg('],['  function trialProg(', '  function trialText(']]){const a=baseline.indexOf(start),b=baseline.indexOf(end,a);assert(a>=0&&b>a);assert.equal(current.slice(current.indexOf(start),current.indexOf(end,current.indexOf(start))),baseline.slice(a,b));}});
check(()=>{assert(!current.includes("'Суперредкая цель: '"));assert(!current.includes("'Заклятие открыло цель'"));assert(current.includes('legendClose(true);e.stopImmediatePropagation()'));assert(current.includes('setTimeout(function(){legendClose(false);},7200)'));});
console.log('PASS cosmetic ledger, compatibility, secrecy, replay separation, unchanged balance and optional teaching: '+checks+' groups');
