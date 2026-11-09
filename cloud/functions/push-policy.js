const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const freshness = 6 * 60 * 60 * 1000;
export const deliveryWindow = 20 * 60 * 60 * 1000;

export function isDue(proof, revision, now) {
  if (!proof?.needed || !Number.isSafeInteger(revision) || proof.revision !== revision ||
      !Number.isFinite(proof.observedAt) || proof.observedAt > now || now - proof.observedAt > freshness ||
      ![proof.at,proof.quietFrom,proof.quietTo].every(time=>timePattern.test(time))) return false;
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
      timeZone:proof.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(now).map(part=>[part.type,part.value]));
  } catch (_) { return false; }
  const day = parts.year+'-'+parts.month+'-'+parts.day, hour = parts.hour+':'+parts.minute;
  if (day !== proof.day || hour < proof.at) return false;
  const {quietFrom:from,quietTo:to} = proof;
  if (from < to) return hour < from || hour >= to;
  if (from > to) return hour < from && hour >= to;
  return true;
}
