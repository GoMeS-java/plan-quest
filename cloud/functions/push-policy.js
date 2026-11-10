const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const freshness = 6 * 60 * 60 * 1000;
export const deliveryWindow = 20 * 60 * 60 * 1000;

export function currentProof(proof, revision, now, age = 30 * 24 * 3600000) {
  return Boolean(proof && Number.isSafeInteger(revision) && revision > 0 && proof.revision === revision &&
    typeof proof.token === 'string' && proof.token.length > 0 && Number.isFinite(proof.observedAt) &&
    proof.observedAt <= now && now - proof.observedAt <= age);
}

function civilTime(timeZone, now) {
  if (typeof timeZone !== 'string' || !timeZone) return null;
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
      timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(now).map(part=>[part.type,part.value]));
  } catch (_) { return null; }
  return {day:parts.year+'-'+parts.month+'-'+parts.day, hour:parts.hour+':'+parts.minute};
}

function allowedHour(hour, from, to) {
  if (from < to) return hour < from || hour >= to;
  if (from > to) return hour < from && hour >= to;
  return true;
}

export function isDue(proof, revision, now) {
  if (!proof?.needed || !Number.isSafeInteger(revision) || proof.revision !== revision ||
      !Number.isFinite(proof.observedAt) || proof.observedAt > now || now - proof.observedAt > freshness ||
      ![proof.at,proof.quietFrom,proof.quietTo].every(time=>timePattern.test(time))) return false;
  const local = civilTime(proof.timezone,now);
  return Boolean(local && local.day === proof.day && local.hour >= proof.at &&
    allowedHour(local.hour,proof.quietFrom,proof.quietTo));
}

const categories = ['daily','food','chains','achievements','weekly'];
export const deviceId = /^[a-f0-9-]{36}$/i;
export const settingsPath = 'cfg/push-reminders';

export function readPolicy(head) {
  if (head?.payload == null) return {mode:'legacy'};
  try {
    const backup = JSON.parse(head.payload);
    const docs = backup?.docs;
    if (backup.v !== 2 || backup.format !== 'vkach-backup' || !docs || typeof docs !== 'object') return null;
    const config = docs[settingsPath]?.d;
    if (!config) return {mode:'legacy'};
    if (config.version !== 1 || !deviceId.test(config.id) || !config.times ||
        ![config.quietFrom,config.quietTo].every(time=>timePattern.test(time))) return null;
    return {mode:'categories',config,docs,savedAt:head.savedAt};
  } catch (_) { return null; }
}

export function dueCategories(policy, proof, revision, now) {
  if (policy?.mode !== 'categories' || !currentProof(proof,revision,now)) return [];
  const {config,docs} = policy;
  const local = civilTime(proof.timezone,now);
  if (!local || !allowedHour(local.hour,config.quietFrom,config.quietTo)) return [];
  const {day,hour} = local;
  const scheduled = categories.filter(category=>timePattern.test(config.times[category])&&hour>=config.times[category]);
  if (!scheduled.length) return [];
  const dayRecord = docs['days/'+day]?.d;
  const hasFood = docs['food-days/'+day]?.d?.complete === true || Number(dayRecord?.kcal)>0 ||
    Object.entries(docs).some(([path,row])=>path.startsWith('food-meals/')&&row?.d?.date===day&&
      row.d.deleted===false&&Array.isArray(row.d.items)&&row.d.items.length>0);
  const chainsDay = civilTime('Europe/Moscow',now)?.day;
  const chainClosed = Object.entries(docs).some(([path,row])=>path.startsWith('chains/')&&row?.d?.date===chainsDay&&
    !row.d.voidAt&&row.d.kind==='confirm');
  const dayTime = Date.parse(day+'T00:00:00Z'), sunday = new Date(dayTime).getUTCDay()===0;
  const recentAchievements = [
    ...Object.entries(docs['cfg/realm-achievements']?.d?.unlocked || {}),
    ...Object.entries(docs['cfg/legends']?.d?.unlocked || {})
  ].filter(([id,row])=>/^(ascent-[a-z]+|(rebuild|refectory|echo)\d{2})$/.test(id)&&row?.version===1&&
      Number.isFinite(row.at)&&Number.isFinite(config.achievementsSince)&&row.at>=config.achievementsSince&&
      row.at<=Math.min(now,policy.savedAt)&&now-row.at<48*3600000).map(([id])=>id).slice(0,40);
  const needed = {
    daily:proof.needed === true && proof.day===day && now-proof.observedAt<24*3600000,
    food:!hasFood,
    chains:chainsDay>='2026-11-06' && chainsDay<='2027-05-06' && !chainClosed,
    achievements:recentAchievements.length>0,
    weekly:sunday
  };
  return scheduled.filter(category=>needed[category])
    .map(category=>({category,day,policy:config.id,events:category==='achievements'?recentAchievements:[]}));
}
