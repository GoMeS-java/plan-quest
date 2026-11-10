import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import '../src/world-history.js';
import '../src/cloud-sync.js';
import { dueCategories, isDue, readPolicy } from '../cloud/functions/push-policy.js';
import { dispatchDue, testDevice } from '../cloud/functions/push-job.js';

const {configured,decide,nextVault,create} = VkachCloudSync;
const origin = 'https://qa.example.invalid';
const firebase = {apiKey:'test',appId:'test',projectId:'test',authDomain:'test.firebaseapp.com',databaseURL:'https://test.firebaseio.com'};
assert(configured({enabled:true,origin,firebase},origin));
assert(!configured({enabled:true,origin,firebase},'https://elsewhere.example.invalid'));
assert(!configured({enabled:true,origin,firebase,authMode:'redirect'},origin));
assert(!configured({enabled:true,origin,firebase:{...firebase,databaseURL:'https://evil.invalid'}},origin));
assert.equal(decide('a',null,'a',false),'missing');
assert.equal(decide('a','b',null,false),'conflict');

let vault = null, lostReply = false, writes = 0;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const row = (amt,u) => ({'tx/id':{d:{amt},u},'cfg/abyss-economy':{d:{rank:14,earned:35},u:1}});
const transportHash = (records, revision) => ({
  hash:digest(records),op:'out-of-band-'+revision,revision,savedAt:Date.now(),
  payload:JSON.stringify({records,integrity:digest(records)})
});

function device(initial) {
  let records = initial, metadata = {}, available = true, owner = null, onUser, queue = Promise.resolve();
  const archived = [], events = [];
  const bridge = {
    meta:()=>metadata, setMeta:next=>{metadata=next;},
    changed:()=>{}, schedule:()=>{}, blocked:()=>false,
    serial(task) { const run=queue.then(task); queue=run.catch(()=>{}); return run; },
    read:async()=>structuredClone(records), hash:async data=>digest(data),
    encode:async data=>JSON.stringify({records:data,integrity:digest(data)}),
    decode:async payload=>{
      const {records,integrity}=JSON.parse(payload);
      assert.equal(digest(records),integrity);
      return records;
    },
    async archive(id,local,remote,reason) { archived.push({id,local,remote,reason}); events.push(reason); },
    async replace(expected,incoming) { assert.deepEqual(records,expected); records=structuredClone(VkachWorldHistory.join(incoming,records)); events.push('replace'); }
  };
  const transport = {
    online:()=>available,
    observe(callback) { onUser=callback; },
    async signIn() { owner={uid:'owner'}; onUser(owner); },
    async signOut() { owner=null; onUser(null); },
    async head(uid) { assert.equal(uid,owner.uid); return structuredClone(vault?.head ?? null); },
    async commit(uid,expected,candidate) {
      assert.equal(uid,owner.uid);
      assert.equal(vault?.head.op,expected?.op);
      vault=nextVault(vault,{...candidate,savedAt:Date.now()});
      writes++;
      events.push('commit');
      if (lostReply) { lostReply=false; throw Error('connection dropped after commit'); }
      return structuredClone(vault.head);
    },
    async history() { return structuredClone(Object.values(vault?.history || {})); }
  };
  return {sync:create(bridge,transport),bridge,archived,events,metadata:()=>metadata,records:()=>records,
    set:value=>{records=value;},offline:()=>{available=false;},online:()=>{available=true;},
    as:uid=>{owner={uid};onUser(owner);}};
}

const phone=device(row(200,1)), tablet=device({});
await phone.sync.signIn();
await phone.sync.tick();
assert.equal(writes,0);
await phone.sync.enable();
assert.deepEqual(phone.events,['cloud-first','commit']);
await tablet.sync.signIn();
await tablet.sync.enable();
assert.deepEqual(tablet.records(),phone.records());
assert.equal(writes,1);

phone.offline();
phone.set(row(250,2));
await phone.sync.tick();
assert.equal(writes,1);
phone.online();
lostReply=true;
await assert.rejects(phone.sync.tick());
assert.equal(writes,2);
const committed = phone.metadata().pending.op;
phone.set(row(260,3));
await phone.sync.tick();
assert.equal(writes,3);
assert.equal(vault.history.a.op,committed);
await phone.sync.tick();
assert.equal(writes,3);

tablet.set(row(300,4));
await tablet.sync.tick();
assert.deepEqual(tablet.sync.state().review.local,row(300,4));
assert.deepEqual(tablet.sync.state().review.remote,row(260,3));
assert.equal(tablet.archived.length,1);
assert.equal(writes,3);
await tablet.sync.tick();
assert.equal(tablet.archived.length,1,'a repeated comparison does not duplicate the recovery pair');
tablet.set(row(310,5));
await assert.rejects(tablet.sync.resolve('local'),{code:'changed-review'});
await tablet.sync.tick();
await tablet.sync.resolve('remote');
assert.deepEqual(tablet.records(),row(260,3));
assert.equal(writes,3);

tablet.set(row(333,6));
phone.set(row(444,7));
await phone.sync.tick();
await tablet.sync.tick();
await tablet.sync.resolve('local');
assert.deepEqual(tablet.records(),row(333,6));
assert.equal(vault.head.revision,5);
assert.equal((await tablet.sync.history()).length,3);
assert.deepEqual(Object.keys(vault.history),['a','b','c']);
await phone.sync.tick();
assert.deepEqual(phone.records(),row(333,6));
assert.equal(phone.records()['cfg/abyss-economy'].d.earned,35);

tablet.as('other');
await assert.rejects(tablet.sync.enable(),{code:'wrong-account'});
assert.equal(writes,5);
tablet.as('owner');
const healthy = structuredClone(vault);
vault.head.payload='corrupt JSON';
await assert.rejects(tablet.sync.tick(),{code:'invalid-remote'});
vault.head=transportHash({},healthy.head.revision+1);
await assert.rejects(tablet.sync.tick(),{code:'invalid-remote'});
assert.deepEqual(tablet.records(),row(333,6),'a well-formed empty cloud snapshot cannot replace a nonempty profile');
vault=null;
await assert.rejects(tablet.sync.tick(),{code:'missing-remote'});
assert.deepEqual(tablet.records(),row(333,6));
vault=healthy;
let rejectCleanup;
tablet.bridge.disablePush=()=>new Promise((_,reject)=>{rejectCleanup=reject;});
const signingOut=tablet.sync.signOut();
assert.equal(tablet.sync.signOut(),signingOut,'duplicate clicks share the logout');
await assert.rejects(tablet.sync.enable(),{code:'paused'});
rejectCleanup(Error('Browser notification storage unavailable'));
await signingOut;
assert(!tablet.sync.state().enabled);
assert.equal(tablet.sync.state().user,null,'Push cleanup must not keep a Google session signed in');

const untouched = device(row(99,8));
untouched.bridge.archive=async()=>{throw Error('Storage quota');};
await untouched.sync.signIn();
await assert.rejects(untouched.sync.enable());
assert.equal(writes,5);
vault=null;
await assert.rejects(untouched.sync.tick());
assert.equal(writes,5,'an upload cannot start without a readable local backup');
assert.deepEqual(untouched.records(),row(99,8));

const now=Date.parse('2027-04-16T18:15:00+03:00');
const proof={day:'2027-04-16',timezone:'Europe/Moscow',at:'18:00',quietFrom:'23:00',quietTo:'08:00',needed:true,revision:3,observedAt:now-1000};
assert(isDue(proof,3,now));
assert(!isDue(proof,4,now));
assert(!isDue({...proof,needed:false},3,now));
assert(!isDue({...proof,at:'19:00'},3,now));
assert(!isDue({...proof,quietFrom:'18:00'},3,now));
assert(!isDue({...proof,observedAt:now-7*3600000},3,now));
assert(!isDue({...proof,day:'2027-04-15'},3,now));
assert(!isDue({...proof,timezone:'bad-timezone'},3,now));

const cloudTree={
  subscriptions:{owner:{a:{...proof,token:'valid'},b:{...proof,token:'alternate',observedAt:now-5000}},
    expired:{a:{...proof,token:'invalid'}},stale:{a:{...proof,token:'stale'}}},
  vaults:{owner:{head:{revision:3}},expired:{head:{revision:3}},stale:{head:{revision:4}}},
  deliveries:{}
};
const schedulerDb={ref(path) {
  const parts=path.split('/'), leaf=parts.pop();
  const parent=()=>parts.reduce((value,key)=>value?.[key],cloudTree);
  return {
    get:async()=>({val:()=>structuredClone(parent()?.[leaf]??null)}),
    transaction:async update=>{
      const row=parent(), next=update(row[leaf]??null);
      if (next===undefined) return {committed:false};
      if (next===null) delete row[leaf];
      else row[leaf]=next;
      return {committed:true};
    }
  };
}};
const sent=[];
async function simulateScheduler() {
  return dispatchDue(schedulerDb,async message=>{
    sent.push(message.token);
    if (message.token==='invalid') throw Object.assign(Error('Invalid'),{code:'messaging/registration-token-not-registered'});
    assert.equal(message.data.day,proof.day);
    assert.equal(message.data.revision,'3');
    assert.equal(message.notification,undefined);
  },()=>now,()=>'test-id');
}
await simulateScheduler();
await simulateScheduler();
assert.deepEqual(sent,['valid','invalid']);
assert.equal(cloudTree.subscriptions.expired.a,undefined);

const sunday=Date.parse('2027-04-18T20:15:00+03:00');
const pushDevice='11111111-2222-4333-8444-555555555555', other='99999999-8888-4777-8666-555555555555';
const policyId='88888888-7777-4666-8555-444444444444';
const config={version:1,id:policyId,quietFrom:'23:00',quietTo:'08:00',achievementsSince:sunday-86400000,
  times:{daily:'18:00',food:'19:00',chains:'08:00',achievements:'09:00',weekly:'20:00'}};
const policyDocs={'cfg/push-reminders':{d:config},'cfg/realm-achievements':{d:{unlocked:{
  'ascent-study':{version:1,at:sunday-3600000},'ascent-goal':{version:1,at:sunday+1},
  'rebuild01':{version:1,at:sunday-2*86400000}
}}}};
const v2head={revision:5,savedAt:sunday,payload:JSON.stringify({v:2,format:'vkach-backup',docs:policyDocs})};
const v2proof={...proof,revision:5,token:'categories-device',observedAt:sunday-9000,day:'2027-04-18'};
const policy=readPolicy(v2head);
assert.deepEqual(dueCategories(policy,v2proof,5,sunday).map(row=>row.category),['daily','food','chains','achievements','weekly']);
assert.deepEqual(dueCategories({...policy,config:{...config,times:{food:'19:00'}}},v2proof,5,sunday).map(row=>row.category),['food']);
assert.deepEqual(dueCategories(policy,v2proof,5,sunday).find(row=>row.category==='achievements').events,['ascent-study']);
assert.deepEqual(dueCategories(policy,v2proof,4,sunday),[]);
assert.deepEqual(dueCategories(policy,v2proof,5,sunday+5*3600000),[],'quiet hours continue across midnight');
const done={...policy,docs:{...policy.docs,'food-meals/meal':{d:{date:v2proof.day,deleted:false,items:[{}]}},
  'chains/confirm':{d:{date:v2proof.day,kind:'confirm'}}}};
assert.deepEqual(dueCategories(done,{...v2proof,needed:false},5,sunday).map(row=>row.category),['achievements','weekly']);
assert(!dueCategories(policy,{...v2proof,timezone:'Pacific/Auckland'},5,sunday).some(row=>row.category==='daily'));
assert.equal(readPolicy({...v2head,payload:'not json'}),null);
cloudTree.subscriptions={owner:{[pushDevice]:v2proof,[other]:{...v2proof,token:'older-device',observedAt:sunday-20000}}};
cloudTree.vaults.owner.head=v2head;
cloudTree['push-deliveries']={owner:{}};
const categorySends=[];
const send=async message=>{categorySends.push(message);};
const clock=()=>sunday, idFor=()=>`push-${categorySends.length}`;
await dispatchDue(schedulerDb,send,clock,idFor);
await dispatchDue(schedulerDb,send,clock,idFor);
assert.deepEqual(categorySends.map(row=>row.data.category),['daily','food','chains','achievements','weekly']);
assert(categorySends.every(row=>row.token===v2proof.token&&row.data.policy===policyId&&!row.notification));
await dispatchDue(schedulerDb,send,()=>sunday+86400000,idFor);
assert.equal(categorySends.filter(row=>row.data.category==='achievements').length,1,'an achievement is never resent after midnight');
assert.equal(await testDevice(schedulerDb,'another-account',pushDevice,send,clock,idFor),false);
assert.equal(await testDevice(schedulerDb,'owner','bad/path',send,clock,idFor),false);
assert.equal(await testDevice(schedulerDb,'owner',pushDevice,send,clock,idFor),true);
assert.equal(await testDevice(schedulerDb,'owner',pushDevice,send,clock,idFor),false,'tests are rate limited per account');
assert.equal(categorySends.at(-1).data.category,'test');
cloudTree.subscriptions={owner:{[pushDevice]:v2proof}};
cloudTree.vaults.owner.head=v2head;
cloudTree['push-deliveries']={owner:{}};
const racingDb={ref(path){
  const original=schedulerDb.ref(path);
  if(path!=='subscriptions/owner/'+pushDevice)return original;
  return {...original,get:()=>{
    cloudTree.vaults.owner.head={revision:6,payload:JSON.stringify({v:2,format:'vkach-backup',
      docs:{'cfg/push-reminders':{d:{...config,times:{}}}}})};
    cloudTree.subscriptions.owner[pushDevice]={...v2proof,revision:6,needed:false};
    return original.get();
  }};
}};
const beforeRace=categorySends.length;
await dispatchDue(racingDb,send,clock,idFor);
assert.equal(categorySends.length,beforeRace,'updated device proof cannot revive a reminder from an obsolete snapshot');

const worker = await readFile(new URL('../src/sw.template.js',import.meta.url),'utf8');
const listeners = {}, cache = new Map(), shown = [];
let visible = false;
const scope='https://qa.example.invalid/game/';
const environment=vm.createContext({
  URL,Date,Response,
  self:{
    addEventListener:(type,fn)=>{listeners[type]=fn;},
    registration:{scope,showNotification:async(title,options)=>shown.push({title,options})},
    clients:{matchAll:async()=>visible?[{url:scope,visibilityState:'visible'}]:[]}
  },
  caches:{open:async()=>({match:async key=>cache.get(String(key))?.clone(),put:async(key,value)=>cache.set(String(key),value)})}
});
vm.runInContext(worker.replace('__SHELL__','[]'),environment);
const marker=scope+'__vkach_push_state__', data={vkach:'1',id:'test-delivery',device:'test-device',day:'2027-04-16',revision:'3',expiresAt:String(Date.now()+60000)};
async function dispatch(overrides={}) {
  let completion;
  listeners.push({data:{json:()=>({data:{...data,...overrides}})},waitUntil:value=>{completion=value;}});
  await completion;
}
await dispatch();
assert.equal(shown.length,0);
cache.set(marker,new Response(JSON.stringify({device:data.device,day:data.day,revision:3,needed:true})));
await dispatch({revision:'2'});
await dispatch({expiresAt:'1'});
visible=true;
await dispatch();
assert.equal(shown.length,0);
visible=false;
await Promise.all([dispatch(),dispatch()]);
assert.equal(shown.length,1);
assert.equal(shown[0].options.body,'Открой Цитадель, чтобы проверить дела дня.');
cache.delete(marker);
await dispatch({id:'after-disable'});
assert.equal(shown.length,1);
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const localDay=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'}).format();
const v2data={vkach:'2',id:'v2-food',device:data.device,day:localDay,policy:policyId,timezone,category:'food',sentAt:String(Date.now())};
cache.set(marker,new Response(JSON.stringify({device:data.device,day:localDay,revision:3,needed:false,policy:policyId,timezone})));
await dispatch({...v2data,device:'foreign'});
await dispatch({...v2data,policy:'outdated'});
await dispatch({...v2data,timezone:'bad-timezone'});
await dispatch({...v2data,category:'daily'});
assert.equal(shown.length,1);
await dispatch(v2data);
await dispatch(v2data);
await dispatch({...v2data,id:'late-arrival',sentAt:String(Number(v2data.sentAt)-1)});
assert.equal(shown.length,2);
assert.equal(shown.at(-1).options.tag,'vkach-food');
visible=true;
await dispatch({...v2data,id:'v2-test',category:'test',day:undefined});
assert.equal(shown.at(-1).options.tag,'vkach-test');
cache.delete(marker);
await dispatch({...v2data,id:'test-after-logout',category:'test'});
assert.equal(shown.length,3);
vault=null;
const observed=(day,at,rank)=>({['world-history/2026-12-'+day]:{d:{version:1,at,frame:{hero:[rank]}},u:at}});
const firstDay=observed('19',100,2), newerFirstDay=observed('19',110,3), secondDay=observed('20',200,4);
const historyPhone=device({...row(1,1),...firstDay}),historyTablet=device({...row(1,1),...newerFirstDay,...secondDay});
await historyPhone.sync.signIn();
await historyPhone.sync.enable();
await historyTablet.sync.signIn();
await historyTablet.sync.enable();
await historyPhone.sync.tick();
assert.equal(historyTablet.sync.state().review,null,'changes confined to history are merged without a gameplay conflict');
assert.deepEqual(historyPhone.records(),{...row(1,1),...newerFirstDay,...secondDay});
const phoneOnly=observed('18',90,2);
historyPhone.set({...historyPhone.records(),...phoneOnly});
historyTablet.set({...historyTablet.records(),...row(2,2)});
await historyTablet.sync.tick();
await historyPhone.sync.tick();
assert.equal(historyPhone.sync.state().review,null,'history on one device must not conflict with a gameplay change on another');
assert.equal(historyPhone.records()['tx/id'].d.amt,2);
assert.deepEqual(historyPhone.records()['world-history/2026-12-18'],phoneOnly['world-history/2026-12-18']);
const thirdDay=observed('21',300,5), fourthDay=observed('22',400,6);
historyPhone.set({...historyPhone.records(),...row(4,4),...thirdDay});
historyTablet.set({...historyTablet.records(),...row(3,3),...fourthDay});
await historyPhone.sync.tick();
await historyTablet.sync.tick();
assert(historyTablet.sync.state().review);
await historyTablet.sync.resolve('local');
await historyPhone.sync.tick();
assert.equal(historyPhone.records()['tx/id'].d.amt,3,'the chosen gameplay version still wins');
for(const observation of [newerFirstDay,secondDay,thirdDay,fourthDay]){
  const [path,record]=Object.entries(observation)[0];
  assert.deepEqual(historyPhone.records()[path],record);
  assert.deepEqual(historyTablet.records()[path],record);
}
console.log('PASS Firebase sync, retries, version conflicts, independent world-history merge, archive, retention and push policy/worker');
