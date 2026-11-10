import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const context=vm.createContext({});
for(const script of ['food','forge-awards','realm-achievements'])vm.runInContext(readFileSync('src/'+script+'.js','utf8'),context);
const api=context.VkachRealm;
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
const food=transaction({});
const savedMeal=(id,date,changes={})=>({id,date,kind:'breakfast',version:1,deleted:false,created:1,updated:1,
  items:[context.VkachFood.position({id:'item',name:'Завтрак',mode:'unknown',grams:100})],...changes});
food.data['food-drafts/draft']={date:'2027-02-01',items:[{name:'Несохранённая еда'}]};
food.data['food-meals/deleted']=savedMeal('deleted','2027-02-02',{deleted:true});
food.data['food-meals/future']=savedMeal('future','2027-03-02');
food.data['food-meals/empty']=savedMeal('empty','2027-02-03',{items:[]});
food.data['food-meals/damaged']=savedMeal('damaged','2027-02-04',{items:[{name:'Повреждённая запись'}]});
api.reconcile(food,'2027-03-01',1800000000000,{});
assert.equal(api.owned(food.data['cfg/realm-achievements']).length,0,'drafts, empty, deleted and future meals cannot earn a discovery');
for(let i=0;i<30;i++){
 const date=new Date(Date.UTC(2027,0,i+1)).toISOString().slice(0,10);
 food.data['food-meals/meal-'+i]=savedMeal('meal-'+i,date);
}
food.data['food-meals/same-day']=savedMeal('same-day','2027-01-01',{kind:'dinner'});
api.reconcile(food,'2027-03-01',1800000001000,{});
assert.equal(api.owned(food.data['cfg/realm-achievements']).filter(r=>r.id.startsWith('refectory')).length,3);
const foodWrites=food.writes.length;api.reconcile(food,'2027-03-01',1800000002000,{});
assert.equal(food.writes.length,foodWrites,'food achievements are once-only and do not affect balance');
const ascent=transaction({});
for(let i=1;i<=21;i++){
 const date='2027-02-'+String(i).padStart(2,'0');
 ascent.data['days/'+date]={q:[true,false,true,false,false,false,false,true],kcal:2100,steps:6000};
 ascent.data['per/'+date]={squat:[1800000000000],pushup:[1800000000001]};
}
ascent.data['goals/unfinished']={name:'Черновик',done:false,ts:1800000000000};
ascent.data['goals/future']={name:'Будущее',done:true,ts:1800000100000};
api.reconcile(ascent,'2027-03-01',1800000000000,{});
const ascentIds=()=>api.owned(ascent.data['cfg/realm-achievements']).map(row=>row.id);
assert(ascentIds().includes('ascent-rhythm')&&ascentIds().includes('ascent-study')&&ascentIds().includes('ascent-week'));
assert(!ascentIds().includes('ascent-body'),'future exercise timestamp is ignored even on a past day');
assert(!ascentIds().includes('ascent-goal'));
const daily='custom-11111111-2222-4333-8444-555555555555';
const weekly='custom-99999999-8888-4777-8666-555555555555';
ascent.data['forge-tasks/'+daily]={kind:'daily'};
ascent.data['forge-tasks/'+weekly]={kind:'weekly'};
ascent.data['cfg/forge-discoveries']={unlocked:{['forge-'+daily+'-2']:{date:'2027-02-14',task:'Сохранённый ритм'},
  ['forge-'+weekly+'-2']:{date:'2027-03-02',task:'Будущий ритм'}}};
api.reconcile(ascent,'2027-03-01',1800000000000,{});
assert(!ascentIds().includes('ascent-forge'),'a future Forge receipt cannot earn an achievement');
ascent.data['cfg/forge-discoveries'].unlocked['forge-'+weekly+'-2'].date='2027-02-22';
ascent.data['goals/finished']={name:'Завершено',done:true,ts:1799999999999};
api.reconcile(ascent,'2027-03-01',1800000000001,{exerciseThresholds:{squat:87,pushup:73}});
assert(ascentIds().includes('ascent-body')&&ascentIds().includes('ascent-goal'));
assert(ascentIds().includes('ascent-forge')&&ascentIds().includes('ascent-aspect'));
const claimedAscent=api.claim(ascent);
const restored=api.merge({unlocked:{}},ascent.data['cfg/realm-achievements']);
assert.equal(api.owned(restored).length,claimedAscent.length);
assert(api.owned(restored).every(row=>row.presented));
const source=readFileSync('src/game.html','utf8'),worker=readFileSync('docs/sw.js','utf8');for(const d of earned)for(const id of d.cos)assert(source.includes('COS.'+id+' ='),'every earned cosmetic has a definition');assert(worker.includes('realm-achievements.js'));assert(!/авито|avito/i.test(source),'retired feature has no live UI, handler or watcher');
console.log('PASS rebuild discoveries: durable facts, no click farming, atomic reward paths, one-time receipts, retained ownership, malformed dates and cached assets');

const approved=execFileSync('git',['show','2c1ff84:src/rpg-ui.css'],{encoding:'utf8'});
// The resident renderer owns its frame and sizing rules. Keep the scenery snapshot strict.
const base=css=>css.replace(/\r\n/g,'\n').split('\n.profile-system-hub')[0].split('\n').filter(line=>
 !line.startsWith('@keyframes citadelInterior') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage .citadel-person') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage .citadel-hero-sprite{width:max(22px,7.5%)') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage .citadel-hero-sprite{width:var(--citadel-room-actor-width)') &&
 !line.startsWith('body.citadel-shell-active #citadel-home .citadel-interior-stage{--citadel-room-actor-width:')
).join('\n').replace('/* Six frames scale with the resident; pixel offsets would tile the sheet. */','').replace(/\n{3,}/g,'\n\n').trim();
assert.equal(base(readFileSync('src/rpg-ui.css','utf8')),base(approved),'approved 1.1 scenery, light, frames, auras, portrait and menu styles stay unchanged');
