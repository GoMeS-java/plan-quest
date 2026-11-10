import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

// This browser test exercises the real game and adapter with synthetic SDK
// responses. tests/cloud-rules.mjs independently exercises actual Firebase rules.
const site='https://vkach-cloud.example.invalid';
const root=resolve('docs'), outputs=process.env.CLOUD_FINAL_SHOTS;
if (outputs) await mkdir(outputs,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
const date='2027-04-16';
let vault=null, writes=0, protectedByBackup=false, subscription=null, pauseSubscription, finishSubscription;
const pushUpdates=[];
const pageErrors=[];
const sdk={
  app:'export function initializeApp(options) { return options; }',
  auth:`
    let listener;
    const user={uid:'sandbox-owner',email:'sandbox@example.invalid'};
    const session={currentUser:localStorage.getItem('qa-auth')?user:null};
    export const browserLocalPersistence={};
    export const getAuth=()=>session;
    export const setPersistence=async()=>{};
    export class GoogleAuthProvider { setCustomParameters(){} }
    export function onAuthStateChanged(_,callback) { listener=callback; queueMicrotask(()=>callback(session.currentUser)); }
    export async function signInWithPopup() { localStorage.setItem('qa-auth','1'); session.currentUser=user; listener(user); }
    export async function signOut() { localStorage.removeItem('qa-auth'); session.currentUser=null; listener(null); }
  `,
  messaging:`
    export const getMessaging=()=>({});
    export const getToken=async()=>'synthetic-push-token';
    export const deleteToken=async()=>true;
  `,
  functions:`
    export const getFunctions=()=>({});
    export const httpsCallable=(_,name)=>async data=>{
      if(name!=='sendCitadelTestPush'||!data.device||Object.keys(data).length!==1) throw Error('Invalid test request');
      return {data:{accepted:true}};
    };
  `,
  database:`
    export const getDatabase=()=>({});
    export const ref=(_,path)=>path;
    export const serverTimestamp=()=>Date.now();
    const snap=value=>({val:()=>value});
    export function onValue(path,callback) {
      if(path==='.info/connected') queueMicrotask(()=>callback(snap(true)));
      else get(path).then(callback);
      return ()=>{};
    }
    export async function get(path) {
      const response=await fetch('/__mock_db__?path='+encodeURIComponent(path));
      return snap(await response.json());
    }
    export async function set(path,value) {
      const response=await fetch('/__mock_db__?path='+encodeURIComponent(path),{method:'PUT',body:JSON.stringify(value)});
      if (!response.ok) throw Error('test write');
    }
    export async function runTransaction(path,update) {
      const current=(await get(path)).val(), next=update(current);
      if (!next) return {committed:false};
      const archive=VkachSaveHistory.create('plan.save-history.v1',PlanSync.backupFor);
      const backed=(await archive.list()).some(row=>row.reason==='cloud-first');
      const response=await fetch('/__mock_db__?path='+encodeURIComponent(path),{
        method:'PUT',body:JSON.stringify({expected:current?.head.revision||0,next,backed})
      });
      return {committed:response.ok,snapshot:snap(await response.json())};
    }
  `
};
const config={clientId:'existing-sheets-is-inactive',cloud:{enabled:true,origin:site,authMode:'popup',vapidKey:'synthetic',
  firebase:{apiKey:'synthetic',appId:'synthetic',projectId:'test',authDomain:'test.firebaseapp.com',databaseURL:'https://test.firebaseio.com'}}};
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
async function device(amount, offline=false) {
  const context=await browser.newContext({isMobile:true,hasTouch:true,viewport:{width:360,height:800},
    serviceWorkers:'block',timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
    const request=route.request(), url=new URL(request.url());
    if (url.hostname==='www.gstatic.com' && url.pathname.includes('/firebasejs/13.2.0/')) {
      const module=/firebase-([a-z]+)\.js$/.exec(url.pathname)?.[1];
      if (!sdk[module]) return route.abort();
      return route.fulfill({body:sdk[module],contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    }
    if (url.origin!==site) return route.fulfill({body:'',contentType:'text/css'});
    if (url.pathname==='/config.js') return route.fulfill({body:'window.PLAN_CONFIG='+JSON.stringify(config),contentType:'text/javascript'});
    if (url.pathname==='/__mock_db__') {
      const path=url.searchParams.get('path');
      if (request.method()==='PUT') {
        if (path.startsWith('subscriptions/')) {
          const value=request.postDataJSON();
          const delayed=value && pauseSubscription;
          if (delayed) await delayed();
          subscription=value;
          pushUpdates.push(Boolean(value));
          await route.fulfill({body:'null',contentType:'application/json'});
          if (delayed) finishSubscription();
          return;
        }
        const {expected,next,backed}=request.postDataJSON();
        if (expected!==(vault?.head.revision || 0)) return route.fulfill({status:412,json:vault});
        vault=next; writes++; protectedByBackup ||= backed;
        return route.fulfill({json:vault});
      }
      const relative=path.split('/').slice(2);
      const value=relative.reduce((state,key)=>state?.[key],vault);
      return route.fulfill({body:JSON.stringify(value ?? null),contentType:'application/json'});
    }
    try {
      const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if (!file.startsWith(root+sep)) throw Error('invalid path');
      return route.fulfill({body:await readFile(file),contentType:types[extname(file)]||'application/octet-stream'});
    } catch (_) { return route.fulfill({status:404}); }
  });
  await context.addInitScript(({amount,date,offline})=>{
    if (offline) {
      window.qaOnline=false;
      Object.defineProperty(navigator,'onLine',{get:()=>window.qaOnline});
    }
    let permission='default';
    Object.defineProperty(window,'Notification',{value:{get permission(){return permission;},
      requestPermission:async()=>permission='granted'}});
    if (!('PushManager' in window)) window.PushManager=class {};
    navigator.serviceWorker.getRegistration=async()=>({active:{},scope:location.origin+'/'});
    localStorage.setItem('plan.awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem('plan.rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem('wsum','2027-04-12');
    localStorage.setItem('msum','2027-04');
    if (localStorage.getItem('qa-seed')) return;
    localStorage.setItem('qa-seed','1');
    const u=Date.parse(date+'T10:00:00+03:00');
    localStorage.setItem('plan.store.v1',JSON.stringify({v:1,docs:{
      'cfg/opening':{d:{cash:5000,card:10000},u},
      'cfg/abyss-economy':{d:{version:1,rank:1,claims:{},earned:0,rankSeeded:true},u},
      'cfg/room-reminders':{d:{version:1,at:'18:00',quietFrom:'23:00',quietTo:'08:00',categories:['tasks']},u},
      'tx/sample':{d:{amt:amount,kind:'out',acc:'cash',cat:'Продукты',what:'Синтетическая операция',date,ts:u,counted:true},u}
    }}));
  },{amount,date,offline});
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.clock.install({time:new Date(date+'T14:00:00+03:00')});
  await page.goto(site+'/');
  await page.waitForFunction(()=>document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  const menu=page.locator('.pl-menu');
  const open=()=>page.evaluate(()=>{
    document.querySelector('#legend-scene[open]')?.close();
    for (const id of ['setup','trophy','lvup','achup']) document.getElementById(id).hidden=true;
    PlanSync.openData();
  });
  await open();
  return {context,page,menu,open};
}
const button=(device,name)=>device.menu.getByRole('button',{name,exact:true});
const shot=(device,name)=>outputs && device.page.screenshot({path:resolve(outputs,name+'.png'),animations:'disabled'});
async function mobileAccountLayout(device) {
  for (const width of [320,360,390,430]) {
    await device.page.setViewportSize({width,height:800});
    assert(await device.menu.evaluate(el=>
      el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth &&
      Array.from(el.querySelectorAll('button')).filter(button=>button.getClientRects().length)
        .every(button=>button.getBoundingClientRect().height>=44)),`Account menu overflow at ${width}px`);
  }
  await device.page.setViewportSize({width:360,height:800});
}
async function connect(device) {
  await button(device,'Войти через Google · Firebase').click();
  await device.menu.getByText('sandbox@example.invalid',{exact:true}).waitFor();
  device.page.once('dialog',dialog=>dialog.accept());
  await button(device,'Включить синхронизацию').click();
}
try {
  const phone=await device(200), tablet=await device(275,true);
  await connect(phone);
  await phone.menu.getByText(/Последнее согласование/).waitFor();
  assert.equal(writes,1);
  assert(protectedByBackup);
  assert.equal(vault.head.revision,1);
  await mobileAccountLayout(phone);
  assert.equal(await phone.page.evaluate(()=>Notification.permission),'default','startup must not request permission');
  await button(phone,'Включить Push').click();
  await phone.menu.getByText('Фоновые уведомления включены на этом устройстве.',{exact:true}).waitFor();
  assert.equal(subscription.token,'synthetic-push-token');
  assert.equal(subscription.revision,1);
  assert(subscription.needed);
  assert.equal(await phone.page.evaluate(()=>PlanSync.pushSettings.test()),true,'test notification uses the callable for the signed-in device');
  await button(phone,'Отключить Push').scrollIntoViewIfNeeded();
  await shot(phone,'04-push-settings');
  const initialPushUpdates=pushUpdates.length;
  let started, release;
  const waiting=new Promise(resolve=>{started=resolve;});
  const hold=new Promise(resolve=>{release=resolve;});
  const finished=new Promise(resolve=>{finishSubscription=resolve;});
  pauseSubscription=()=>{
    pauseSubscription=null;
    started();
    return hold;
  };
  await phone.page.clock.fastForward(3605000);
  await Promise.race([waiting,new Promise((_,reject)=>setTimeout(()=>reject(Error('Expected a pending Push refresh')),10000).unref())]);
  await button(phone,'Отключить Push').click();
  await phone.page.waitForFunction(()=>JSON.parse(localStorage.getItem('plan.push136.v1'))?.enabled!==true);
  release();
  await phone.menu.getByText('Фоновые уведомления отключены на этом устройстве.',{exact:true}).waitFor();
  await finished;
  assert.deepEqual(pushUpdates.slice(initialPushUpdates),[true,false],'a pending refresh must precede removal');
  assert.equal(subscription,null);
  assert.equal(await phone.page.evaluate(()=>PlanSync.pushSettings.test()),false);
  await button(phone,'Включить Push').scrollIntoViewIfNeeded();
  await shot(phone,'01-cloud-account');

  assert(await button(tablet,'Войти через Google · Firebase').isDisabled());
  await tablet.page.evaluate(()=>{window.qaOnline=true;window.dispatchEvent(new Event('online'));});
  await connect(tablet);
  await tablet.menu.getByText('Конфликт сохранений',{exact:true}).waitFor();
  assert.equal(writes,1);
  await tablet.menu.getByText('Подробные различия',{exact:true}).click();
  await tablet.menu.getByText('Финансы · 1',{exact:true}).waitFor();
  await mobileAccountLayout(tablet);
  await tablet.menu.getByText('Конфликт сохранений',{exact:true}).evaluate(el=>{
    const menu=el.closest('.pl-menu');
    menu.scrollTop+=el.getBoundingClientRect().top-menu.getBoundingClientRect().top-20;
  });
  await shot(tablet,'02-cloud-conflict');
  await button(tablet,'Отложить решение').click();
  assert.equal(await tablet.page.evaluate(()=>PlanSync._docs()['tx/sample'].d.amt),275);
  await button(tablet,'Сравнить версии Firebase').click();
  tablet.page.once('dialog',dialog=>dialog.accept());
  await button(tablet,'Использовать облачную версию').click();
  await tablet.page.waitForFunction(()=>PlanSync._docs()['tx/sample'].d.amt===200);
  await tablet.menu.getByText(/Последнее согласование/).waitFor();
  assert.equal(writes,1);

  await phone.page.evaluate(()=>PlanDB.doc('tx/sample').update({amt:300}));
  await button(phone,'Проверить синхронизацию').click();
  await phone.page.waitForFunction(()=>JSON.parse(localStorage.getItem('plan.cloud136.v1'))?.revision===2);
  assert.equal(vault.head.revision,2);
  await button(phone,'Облачные версии').click();
  await button(phone,'Восстановить версию 1').scrollIntoViewIfNeeded();
  await shot(phone,'03-cloud-history');
  await button(tablet,'Проверить синхронизацию').click();
  await tablet.page.waitForFunction(()=>PlanSync._docs()['tx/sample'].d.amt===300);
  await tablet.page.reload();
  await tablet.page.evaluate(()=>{window.qaOnline=true;window.dispatchEvent(new Event('online'));});
  await tablet.open();
  await tablet.menu.getByText('sandbox@example.invalid',{exact:true}).waitFor();
  await button(tablet,'Выйти из Firebase').click();
  await button(tablet,'Войти через Google · Firebase').waitFor();
  assert.equal(await tablet.page.evaluate(()=>PlanSync._docs()['tx/sample'].d.amt),300);
  phone.page.once('dialog',dialog=>dialog.accept());
  await button(phone,'Восстановить версию 1').click();
  await phone.page.waitForFunction(()=>PlanSync._docs()['tx/sample'].d.amt===200);
  assert.equal(await phone.page.evaluate(()=>JSON.parse(localStorage.getItem('plan.cloud136.v1')).enabled),false);
  assert.equal(vault.head.revision,2,'restoring an archive does not silently publish it');
  assert.equal(writes,2);
  assert.deepEqual(pageErrors,[]);
  console.log('PASS integrated Android-width Firebase account, opt-in, conflict, archive, two-device pull, persistent session and Push subscription controls with synthetic SDK');
} finally {
  await browser.close();
}
