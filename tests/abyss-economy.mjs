import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/game.html',import.meta.url),'utf8');
function functionText(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
const context={S:{buys:[]},document:{querySelector:()=>({dataset:{minRank:'1'}})},citadelRenovations:{rest:['Repair','Majesty']}};
vm.createContext(context);
vm.runInContext(functionText('  function spent()','  function costOf(')+functionText('function citadelRoomLevel(','// Существующий расчёт читает актуальный снимок'),context);
const old={id:'citadel-rest-2',kind:'citadel-room',room:'rest',level:2,cost:1};
const shop={id:'shop-phone',cost:2};
context.S.buys=[old,shop];
assert.equal(context.spent(),2,'legacy castle spending restores only documented cores');
assert.equal(context.citadelRoomLevel('rest'),2,'legacy room remains upgraded');
assert.equal(context.citadelUpgradeOffer('rest',1).cost,5);
assert.equal(context.citadelUpgradeOffer('rest',2).cost,12);
assert.equal(context.abyssBalance({version:1,earned:17,claims:{}},context.S.buys),17);
context.S.buys.push({id:'citadel-rest-3',kind:'citadel-room',currency:'abyss',room:'rest',level:3,cost:12});
assert.equal(context.abyssBalance({version:1,earned:17},context.S.buys),5);
assert.equal(context.citadelRoomLevel('rest'),3);
assert.equal(context.spent(),2);
assert.equal(context.abyssBalance(null),0,'unmigrated save cannot spend essence');
// Execute the actual migration twice against a transactional in-memory copy.
const docs=new Map();
const tx={get:key=>docs.get(key),set:(key,value)=>docs.set(key,structuredClone(value)),list:kind=>kind==='buys'?context.S.buys:[]};
let rank=7,events={'daily-2026-10-31':1};
Object.assign(context,{loaded:true,db:{runTransaction:async fn=>fn(tx)},abyssReconciling:false,
  enqueue:fn=>fn(),purchasePoints:()=>({L:rank}),abyssEvents:()=>events,Date});
vm.runInContext(functionText('function abyssReconcile(){','// Существующий расчёт читает актуальный снимок'),context);
await context.abyssReconcile();
assert.equal(docs.get('cfg/abyss-economy').earned,0,'completed events are baselined');
assert.equal(docs.get('cfg/abyss-economy-backup').legacyCitadelBuys.length,2);
rank=8;events={...events,'weekly-2026-11-02':2};
await context.abyssReconcile();
assert.equal(docs.get('cfg/abyss-economy').earned,7);
await context.abyssReconcile();
assert.equal(docs.get('cfg/abyss-economy').earned,7,'reload is idempotent');
assert.equal(docs.get('cfg/abyss-economy-backup').rank,7,'original recovery snapshot is preserved');
console.log('Abyss economy: legacy migration, costs, independent balances and idempotent grants pass');
