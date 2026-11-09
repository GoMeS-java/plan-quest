import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getDatabaseWithUrl } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { dispatchDue } from './push-job.js';

initializeApp();
const databaseURL = defineString('VKACH_DATABASE_URL',{description:'HTTPS URL of the Vkach Realtime Database instance'});

export const sendCitadelReminders = onSchedule({
  schedule:'every 10 minutes',timeZone:'Etc/UTC',maxInstances:1,timeoutSeconds:120
},async () => {
  const db = getDatabaseWithUrl(databaseURL.value());
  await dispatchDue(db,message=>getMessaging().send(message),Date.now,randomUUID);
});
