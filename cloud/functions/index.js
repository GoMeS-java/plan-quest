import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getDatabaseWithUrl } from 'firebase-admin/database';
import { getMessaging } from 'firebase-admin/messaging';
import { defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { dispatchDue, testDevice } from './push-job.js';

initializeApp();
const databaseURL = defineString('VKACH_DATABASE_URL',{description:'HTTPS URL of the Vkach Realtime Database instance'});
const database = () => getDatabaseWithUrl(databaseURL.value());
const send = message => getMessaging().send(message);

export const sendCitadelReminders = onSchedule({
  schedule:'every 10 minutes',timeZone:'Etc/UTC',maxInstances:1,timeoutSeconds:120
},async () => {
  await dispatchDue(database(),send,Date.now,randomUUID);
});

export const sendCitadelTestPush = onCall({maxInstances:2,timeoutSeconds:20},async request => {
  if (!request.auth) throw new HttpsError('unauthenticated','Sign in first.');
  if (!await testDevice(database(),request.auth.uid,request.data?.device,send,Date.now,randomUUID)) {
    throw new HttpsError('failed-precondition','An active subscription and one minute between tests are required.');
  }
  return {accepted:true};
});
