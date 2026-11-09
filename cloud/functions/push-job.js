import { deliveryWindow, isDue } from './push-policy.js';

export async function dispatchDue(db, send, clock, idFor) {
  const subscriptions = (await db.ref('subscriptions').get()).val() || {};
  for (const [uid,devices] of Object.entries(subscriptions)) {
    try {
      const version = db.ref('vaults/'+uid+'/head/revision');
      const revision = (await version.get()).val(), now = clock();
      const next = Object.entries(devices).filter(([,proof])=>isDue(proof,revision,now))
        .sort((left,right)=>right[1].observedAt-left[1].observedAt)[0];
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
      try {
        await send({token:latest.token,data:{
          vkach:'1',id:idFor(),device,day:latest.day,revision:String(latest.revision),expiresAt:String(clock()+300000)
        },webpush:{headers:{TTL:'300'}}});
      } catch (error) {
        if (error.code==='messaging/registration-token-not-registered' || error.code==='messaging/invalid-registration-token') {
          await subscription.transaction(value=>value?.token===latest.token ? null : undefined);
        } else {
          // The claim stays in place because a transport error may follow delivery.
          console.warn('Push delivery did not confirm');
        }
      }
    } catch (_) { console.warn('Could not check a push subscription'); }
  }
}
