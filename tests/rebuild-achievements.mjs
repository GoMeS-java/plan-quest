import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const context=vm.createContext({});vm.runInContext(readFileSync('src/realm-achievements.js','utf8'),context);const api=context.VkachRealm;
function transaction(records){const data=structuredClone(records),writes=[];return {data,writes,get:p=>structuredClone(data[p]),list:prefix=>Object.entries(data).filter(([p])=>p.startsWith(prefix+'/')).map(([p,d])=>({...structuredClone(d),id:p.slice(prefix.length+1)})),set:(p,d)=>{data[p]=structuredClone(d);writes.push(p);}};}
const empty=transaction({'cfg/look':{showcase:['x01','x02','x03'],title:'x01',bg:'b_forest',frame:'fr_gold',aura:'au_soft'},'cfg/outfit':{outer:'coat_camel'}});api.reconcile(empty,'2027-03-01',1800000000000,{marks:['x01','x02','x03'],cos:['b_forest','fr_gold','au_soft']});assert.equal(empty.writes.length,0,'views and appearance alone never award progress');assert.equal(api.needs(empty,'2027-03-01',{}),false,'unchanged views do not schedule an empty write');
const records={'cfg/look':empty.data['cfg/look'],'cfg/outfit':{top:'custom',bottom:'pants_brown',outer:'coat_camel'},'cfg/citadel':{decor:{rest:'banner',study:'lantern',forge:'crystal'}},'wardrobe/custom':{slot:'top',shape:'knit',c:{base:'#555577'}}};
for(let i=0;i<100;i++){const d=new Date('2026-10-19T12:00Z');d.setUTCDate(d.getUTCDate()+i);records['days/'+d.toISOString().slice(0,10)]={q:Array(10).fill(true),steps:5000};}
for(let i=0;i<12;i++){const d=new Date('2026-10-19T12:00Z');d.setUTCDate(d.getUTCDate()+i*7);records['weights/'+i]={kg:150-i/10,date:d.toISOString().slice(0,10)};records['spont/'+i]={done:true,heavy:true,date:'2027-01-25'};}
for(const room of ['rest','throne','study','archive','forge','observatory','gatehouse','refectory','cloister','vault'])for(const level of [2,3])records['buys/citadel-'+room+'-'+level]={kind:'citadel-room',room,level,currency:'abyss',cost:100,ts:1798804800000};
const proof={marks:['x01','x02','x03'],cos:['b_forest','fr_gold','au_soft']},tx=transaction(records);api.reconcile(tx,'2027-03-01',1800000000000,proof);const earned=api.owned(tx.data['cfg/realm-achievements']);assert(earned.length>8);assert(earned.some(d=>d.kind==='superrare'));assert(earned.some(d=>d.clothes));assert(tx.writes.every(p=>p==='cfg/realm-achievements'||p.startsWith('wardrobe/')),'no currency or real task writes');
const claimed=api.claim(tx);assert.equal(claimed.length,earned.length);assert.equal(api.claim(tx).length,0);const count=tx.writes.length;api.reconcile(tx,'2027-03-01',1800000001000,proof);assert.equal(tx.writes.length,count,'repeat cannot duplicate receipts or inventory');
const gift=earned.find(d=>d.clothes).clothes;delete tx.data['wardrobe/'+gift];assert(api.needs(tx,'2027-03-01',proof));api.reconcile(tx,'2027-03-01',1800000002000,proof);assert(tx.data['wardrobe/'+gift]);assert.equal(api.claim(tx).length,0,'repairing a missing earned garment never replays a receipt');assert.equal(api.needs(tx,'2027-03-01',proof),false);
const merged=api.merge(tx.data['cfg/realm-achievements'],{version:1,unlocked:{},future:'keep'});assert.equal(api.owned(merged).length,earned.length);assert(api.owned(merged).every(d=>d.presented));assert.equal(merged.future,'keep');
const future=transaction({...records,'buys/citadel-rest-2':{kind:'citadel-room',room:'rest',level:2,currency:'abyss',cost:100,ts:1e100}});assert.doesNotThrow(()=>api.reconcile(future,'2027-03-01',1800000000000,proof));
const source=readFileSync('src/game.html','utf8'),worker=readFileSync('docs/sw.js','utf8');for(const d of earned)for(const id of d.cos)assert(source.includes('COS.'+id+' ='),'every earned cosmetic has a definition');assert(worker.includes('realm-achievements.js'));assert(!/авито|avito/i.test(source),'retired feature has no live UI, handler or watcher');
console.log('PASS rebuild discoveries: durable facts, no click farming, atomic reward paths, one-time receipts, retained ownership, malformed dates and cached assets');

const approved=execFileSync('git',['show','2c1ff84:src/rpg-ui.css'],{encoding:'utf8'});
// The resident renderer owns its frame and sizing rules. Keep the scenery snapshot strict.
const base=css=>css.split('\n.profile-system-hub')[0].split('\n').filter(line=>
 !line.startsWith('@keyframes citadelInterior') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage .citadel-person') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage .citadel-hero-sprite{width:max(22px,7.5%)') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage .citadel-hero-sprite{width:var(--citadel-room-actor-width)') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage{--citadel-room-actor-width:')
).join('\n').replace('/* Six frames scale with the resident; pixel offsets would tile the sheet. */','').replace(/\n{3,}/g,'\n\n').trim();
assert.equal(base(readFileSync('src/rpg-ui.css','utf8')),base(approved),'approved 1.1 scenery, light, frames, auras, portrait and menu styles stay unchanged');
