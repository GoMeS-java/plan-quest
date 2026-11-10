import { currentProof, deliveryWindow, deviceId, dueCategories, isDue, readPolicy } from './push-policy.js';

const expired = error => ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code);

async function deliver(subscription, proof, data, send, clock) {
  try {
    await send({token:proof.token,data:{...data,expiresAt:String(clock()+300000)},webpush:{headers:{TTL:'300'}}});
    return true;
  } catch (error) {
    if (expired(error)) await subscription.transaction(value=>value?.token===proof.token ? null : undefined);
    else console.warn('Push delivery did not confirm');
    return false;
  }
}

async function dispatchCategories(db, uid, devices, version, revision, policy, send, clock, idFor) {
  const now = clock();
  const offered = new Set();
  for (const [device,proof] of devices) {
    if (!deviceId.test(device)) continue;
    for (const item of dueCategories(policy,proof,revision,now)) {
      const {category,day,events} = item;
      if (offered.has(category)) continue;
      const subscription = db.ref('subscriptions/'+uid+'/'+device);
      const claim = await db.ref('push-deliveries/'+uid+'/'+category).transaction(previous=>{
        if (previous && (previous.day===day || now-previous.at<deliveryWindow)) return;
        const seen = Array.isArray(previous?.seen) ? previous.seen : [];
        if (category==='achievements' && events.every(id=>seen.includes(id))) return;
        return {day,at:now,...(events.length ? {seen:[...new Set([...seen,...events])].slice(-80)} : {})};
      });
      if (!claim.committed) continue;
      offered.add(category);
      const latest = (await subscription.get()).val();
      // The category and its evidence were evaluated against this exact head.
      if ((await version.get()).val()!==revision) return;
      if (latest?.token!==proof.token || latest.timezone!==proof.timezone ||
          !dueCategories(policy,latest,revision,clock()).some(row=>row.category===category&&row.day===day)) continue;
      await deliver(subscription,latest,{vkach:'2',id:idFor(),device,category,day,policy:item.policy,
        timezone:latest.timezone,revision:String(revision),sentAt:String(now)},send,clock);
    }
  }
}

// The callable derives the token from the signed-in user's current device.
export async function testDevice(db, uid, device, send, clock, idFor) {
  if (typeof uid!=='string' || !uid || typeof device!=='string' || !deviceId.test(device)) return false;
  const now=clock(), version=db.ref('vaults/'+uid+'/head/revision');
  const subscription=db.ref('subscriptions/'+uid+'/'+device);
  const proof=(await subscription.get()).val(), revision=(await version.get()).val();
  if (!currentProof(proof,revision,now)) return false;
  const claim=await db.ref('push-deliveries/'+uid+'/test').transaction(previous=>{
    if (previous && now-previous.at<60000) return;
    return {at:now};
  });
  if (!claim.committed) return false;
  const latest=(await subscription.get()).val();
  if (latest?.token!==proof.token || latest.revision!==revision || !currentProof(latest,(await version.get()).val(),clock())) return false;
  return deliver(subscription,latest,{vkach:'2',id:idFor(),device,category:'test',revision:String(revision),
    sentAt:String(now)},send,clock);
}

export async function dispatchDue(db, send, clock, idFor) {
  const subscriptions = (await db.ref('subscriptions').get()).val() || {};
  for (const [uid,devices] of Object.entries(subscriptions)) {
    try {
      const headPath = 'vaults/'+uid+'/head', version = db.ref(headPath+'/revision');
      const revision = (await version.get()).val(), now = clock();
      const active = Object.entries(devices).filter(([,proof])=>currentProof(proof,revision,now))
        .sort((left,right)=>right[1].observedAt-left[1].observedAt);
      if (!active.length) continue;
      const head = (await db.ref(headPath).get()).val();
      if (head?.revision!==revision) continue;
      const policy = readPolicy(head);
      if (!policy) continue;
      if (policy.mode==='categories') {
        await dispatchCategories(db,uid,active,version,revision,policy,send,clock,idFor);
        continue;
      }
      const next = active.find(([,proof])=>isDue(proof,revision,now));
      if (!next) continue;
      const [device,proof] = next;
      const subscription = db.ref('subscriptions/'+uid+'/'+device);
      const current = (await subscription.get()).val();
      const currentRevision = (await version.get()).val();
      if (!current || current.token !== proof.token || !isDue(current,currentRevision,clock())) continue;
      const claim = await db.ref('deliveries/'+uid).transaction(previous=>{
        if (previous && (previous.day===current.day || now-previous.at<deliveryWindow)) return;
        return {day:current.day,at:now};
      });
      if (!claim.committed) continue;
      const latest = (await subscription.get()).val();
      if (!latest || latest.token !== current.token || !isDue(latest,(await version.get()).val(),clock())) continue;
      await deliver(subscription,latest,{
        vkach:'1',id:idFor(),device,day:latest.day,revision:String(latest.revision)
      },send,clock);
    } catch (_) { console.warn('Could not check a push subscription'); }
  }
}
