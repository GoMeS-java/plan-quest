// Execute only against the Firebase Auth and Realtime Database emulators.
import assert from 'node:assert/strict';
import '../src/cloud-sync.js';

const project='demo-vkach-final';
const auth='http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake';
const db='http://127.0.0.1:19000';
const namespace=project+'-default-rtdb';
async function user(label) {
  const response=await fetch(auth,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    email:label+'-'+Date.now()+'@example.invalid',password:'synthetic-passphrase',returnSecureToken:true
  })});
  assert.equal(response.status,200);
  return response.json();
}
const owner=await user('owner'), stranger=await user('stranger');
const path='vaults/'+owner.localId;
function request(path,session,method='GET',value,headers={}) {
  const url=new URL(path+'.json',db+'/');
  url.searchParams.set('ns',namespace);
  if (session) url.searchParams.set('auth',session.idToken);
  return fetch(url,{method,headers:{'content-type':'application/json',...headers},body:value===undefined?undefined:JSON.stringify(value)});
}
const deny=async response=>assert([401,403].includes(response.status),await response.text());
const candidate=(op,payload)=>({op,hash:'a'.repeat(64),payload,savedAt:{'.sv':'timestamp'}});
const first=VkachCloudSync.nextVault(null,candidate('first','synthetic-profile'));
await deny(await request(path,null));
await deny(await request(path,{idToken:'invalid-test-token'}));
await deny(await request(path,stranger));
await deny(await request(path,stranger,'PUT',first));
const created=await request(path,owner,'PUT',first);
assert.equal(created.status,200,await created.clone().text());
const fetched=await request(path,owner,'GET',undefined,{'X-Firebase-ETag':'true'});
assert.equal(fetched.status,200);
const tag=fetched.headers.get('etag'), before=await fetched.json();
assert(tag);
assert.equal(before.head.revision,1);
assert.equal(before.head.payload,'synthetic-profile');
await deny(await request(path,stranger,'PUT',VkachCloudSync.nextVault(before,candidate('stolen','bad'))));
await deny(await request(path,owner,'DELETE'));
await deny(await request(path+'/head',owner,'PUT',{...before.head,revision:2,op:'partial'}));
await deny(await request(path,owner,'PUT',{head:{...before.head,revision:9}}));
const next=VkachCloudSync.nextVault(before,candidate('second','second-version'));
const written=await request(path,owner,'PUT',next,{'if-match':tag});
assert.equal(written.status,200,await written.clone().text());
const raced=await request(path,owner,'PUT',next,{'if-match':tag});
assert([401,403,412].includes(raced.status),await raced.text());
let current=await (await request(path,owner)).json();
assert.deepEqual(current.history.a,before.head);
await deny(await request(path,owner,'PUT',VkachCloudSync.nextVault(current,candidate('second','second-version'))));
const broken=structuredClone(VkachCloudSync.nextVault(current,candidate('broken','would-replace')));
broken.history.a.payload='tampered archive';
await deny(await request(path,owner,'PUT',broken));
assert.deepEqual(await (await request(path,owner)).json(),current);
for (let revision=3;revision<=6;revision++) {
  const response=await request(path,owner,'PUT',VkachCloudSync.nextVault(current,candidate('rev-'+revision,'saved-'+revision)));
  assert.equal(response.status,200,await response.clone().text());
  current=await response.json();
}
assert.equal(current.head.revision,6);
assert.deepEqual([current.history.a.revision,current.history.b.revision,current.history.c.revision],[5,4,3]);

const subscription='subscriptions/'+owner.localId+'/00000000-0000-4000-8000-000000000000';
const proof={token:'synthetic',timezone:'Europe/Moscow',day:'2027-04-16',at:'18:00',quietFrom:'23:00',quietTo:'08:00',
  needed:true,revision:6,observedAt:{'.sv':'timestamp'}};
await deny(await request(subscription,stranger,'PUT',proof));
await deny(await request(subscription,owner,'PUT',{...proof,revision:5}));
assert.equal((await request(subscription,owner,'PUT',proof)).status,200);
await deny(await request(subscription,stranger));
await deny(await request(subscription,stranger,'DELETE'));
assert.equal((await request(subscription,owner,'DELETE')).status,200);
await deny(await request('deliveries/'+owner.localId,owner,'PUT',{at:1,day:proof.day}));
console.log('PASS actual Firebase emulator rules: unauthorized and foreign access denied, atomic revisions, retained history, races and private push subscriptions');
