import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const context=vm.createContext({});
for(const script of ['food','forge-awards','realm-achievements'])vm.runInContext(readFileSync('src/'+script+'.js','utf8'),context);
const api=context.VkachRealm;
function transaction(records){const data=structuredClone(records),writes=[];return {data,writes,get:p=>structuredClone(data[p]),list:prefix=>Object.entries(data).filter(([p])=>p.startsWith(prefix+'/')).map(([p,d])=>({...structuredClone(d),id:p.slice(prefix.length+1)})),set:(p,d)=>{data[p]=structuredClone(d);writes.push(p);}};}
const empty=transaction({'cfg/look':{showcase:['x01','x02','x03'],title:'x01',bg:'b_forest',frame:'fr_gold',aura:'au_soft'},'cfg/outfit':{outer:'coat_camel'}});api.reconcile(empty,'2027-03-01',1800000000000,{marks:['x01','x02','x03'],cos:['b_forest','fr_gold','au_soft']});assert.deepEqual(empty.writes,[api.path],'an empty profile only records the feature start date');assert.equal(api.owned(empty.data[api.path]).length,0,'views and appearance alone never award progress');assert.equal(api.needs(empty,'2027-03-01',{}),false,'unchanged views do not schedule an empty write');
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

const oldReceipt={version:1,at:Date.parse('2026-09-02T09:00Z'),presented:true};
const spell=transaction({[api.path]:{unlocked:{rebuild09:oldReceipt}}});
const today='2026-11-30', now=Date.parse(today+'T12:00Z');
const walkDate=i=>'2026-11-'+String(i).padStart(2,'0');
const walk=i=>{spell.data['days/'+walkDate(i)]={steps:5500};};
for(let i=1;i<=10;i++)walk(i);
api.reconcile(spell,'2026-11-10',Date.parse('2026-11-10T12:00Z'),{});
assert.equal(spell.data[api.path].mysterySince,'2026-11-10');
assert(!api.owned(spell.data[api.path]).some(row=>row.direction),'old records do not award the new marks');
const previews=()=>api.previews(spell,today,now);
assert.equal(previews().length,5);
assert(previews().every(row=>row.stage===0));
assert(previews().every(row=>Object.keys(row).sort().join(',')==='hint,stage'),'previews expose no identity, reward or thresholds');
for(let i=11;i<=13;i++)walk(i);
assert.equal(previews()[0].stage,1);
const whisper=previews()[0].hint;
for(let i=14;i<=18;i++)walk(i);
assert.equal(previews()[0].stage,2);
assert.notEqual(previews()[0].hint,whisper);
delete spell.data['days/2026-11-18'];
assert.equal(previews()[0].stage,1);
for(let i=18;i<=22;i++)walk(i);
spell.data['days/2026-12-01']={steps:100000};
api.reconcile(spell,today,now,{});
const received=api.claim(spell).filter(row=>row.direction);
assert.equal(received.length,1);
assert.equal(received[0].id,'mystery-road');
assert.equal(received[0].at,now);
assert(received[0].action&&received[0].direction);
assert.equal(previews().length,4);
for(let i=11;i<=30;i++){
 walk(i);
 spell.data['per/'+walkDate(i)]={pushup:[now+1]};
}
api.reconcile(spell,today,now,{});
assert(!api.owned(spell.data[api.path]).some(row=>row.id==='mystery-iron'),'future exercise timestamps cannot awaken an absolute mystery');
for(let i=11;i<=22;i++)spell.data['per/'+walkDate(i)].pushup=[Date.parse(walkDate(i)+'T09:00Z')];
api.reconcile(spell,today,now,{});
assert(api.claim(spell).some(row=>row.id==='mystery-iron'));
assert.equal(previews().length,4,'absolute mysteries never have a preview');
const carried=api.merge(spell.data[api.path],{mysterySince:'2026-11-15',unlocked:{rebuild09:oldReceipt}});
assert.equal(carried.mysterySince,'2026-11-10');
assert.equal(carried.unlocked.rebuild09.at,oldReceipt.at);
for(const key of Object.keys(spell.data))if(key.startsWith('days/')||key.startsWith('per/'))delete spell.data[key];
spell.data[api.path]=carried;
api.reconcile(spell,today,now+1000,{});
assert.equal(api.claim(spell).length,0,'a restore and deletion retain discovery and notification receipts');
assert.equal(api.owned(spell.data[api.path]).filter(row=>row.direction).length,2);
console.log('PASS spell stages, redacted previews, existing saves, edit/delete, absolute mysteries and receipt merge');

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
