import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const server = createServer(async (req,res) => {
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    const file = resolve(root,'.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!['docs','android-test'].some(folder=>file.startsWith(resolve(root,folder)+sep))) throw Error('Invalid path');
    res.setHeader('Content-Type',types[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-cache');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
const shots = process.env.STAGE_THREE_SHOTS;
if (shots) await mkdir(shots,{recursive:true});
const errors = [];
const date = '2027-04-16';
const seed = {
  'cfg/opening':{cash:5000,card:10000},
  'cfg/abyss-economy':{version:1,rank:1,claims:{},earned:0,rankSeeded:true},
  ['days/'+date]:{q:Array(10).fill(false)},
  'tx/stage-three':{amt:200,kind:'out',acc:'cash',cat:'Продукты',what:'Тестовая операция',date,ts:1,counted:true},
  'room-notes/test':{version:1,title:'Запись из теста',text:'Синтетические данные',created:1,updated:1},
  ['room-recovery/'+date]:{version:1,date,minutes:null,mood:4,created:1,updated:1},
  ['food-days/'+date]:{version:1,date,complete:true,created:1,updated:1}
};
const shot = (page,name) => shots && page.screenshot({path:resolve(shots,name+'.png'),animations:'disabled'});
const dismiss = page => page.evaluate(() => {
  document.querySelector('#legend-scene[open]')?.close();
  if (!document.querySelector('#achup').hidden) document.querySelector('#ac-ok').click();
  for (const id of ['setup','trophy','lvup']) document.getElementById(id).hidden=true;
});
const button = (scope,name) => scope.getByRole('button',{name,exact:true});

async function device(testMode, remote) {
  const context = await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,
    timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
  const prefix = testMode ? 'plan.android-test.' : 'plan.';
  await context.route('https://**/*',remote || (route=>route.fulfill({body:'',contentType:'text/css'})));
  await context.addInitScript(({prefix,seed}) => {
    if (!localStorage.getItem('qa-stage-three')) {
      localStorage.setItem('qa-stage-three','1');
      localStorage.setItem(prefix+'store.v1',JSON.stringify({v:1,docs:Object.fromEntries(
        Object.entries(seed).map(([path,d])=>[path,{d,u:1}]))}));
    }
    localStorage.setItem(prefix+'awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem(prefix+'rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    localStorage.setItem('wsum','2027-04-12');
    localStorage.setItem('msum','2027-04');
    window.qaToken = 'owner';
    window.qaLogins = 0;
    window.google = {accounts:{oauth2:{
      initTokenClient:opts=>({requestAccessToken:()=>{window.qaLogins++;opts.callback({access_token:window.qaToken,expires_in:3600});}}),
      revoke:(_,done)=>done()
    }}};
  },{prefix,seed});
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(date+'T14:00:00+03:00')});
  await page.goto(url + (testMode ? '/android-test/' : '/docs/'));
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  await dismiss(page);
  return {context,page};
}

try {
  const {context,page} = await device(true);
  const menu = page.locator('.pl-menu');
  const openData = () => page.evaluate(()=>PlanSync.openData());
  await openData();
  await menu.getByText(/Последняя копия ·/).click();
  const daily = menu.locator('.pl-history-entry').filter({hasText:'Автоматическая копия'});
  await daily.waitFor();
  assert(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth));
  await shot(page,'01-history');
  const download = page.waitForEvent('download');
  await button(daily,'Скачать копию').click();
  const copy = JSON.parse(await readFile(await (await download).path(),'utf8'));
  assert.equal(copy.v,2);
  assert.equal(copy.docs['tx/stage-three'].d.amt,200);
  assert.equal(copy.docs['room-notes/test'].d.title,'Запись из теста');
  assert(!JSON.stringify(copy).includes('access_token'));

  await context.setOffline(true);
  await page.evaluate(()=>PlanDB.doc('tx/stage-three').update({amt:275}));
  await page.evaluate(()=>PlanDB.doc('room-notes/test').update({title:'Изменено офлайн'}));
  await page.reload();
  await page.waitForFunction(()=>PlanSync._docs()['tx/stage-three'].d.amt===275);
  await dismiss(page);
  await openData();
  if (!await daily.isVisible()) await menu.getByText(/Последняя копия ·/).click();
  page.once('dialog',dialog=>{
    assert.match(dialog.message(),/Различия по разделам:.*Финансы.*Заметки/);
    return dialog.dismiss();
  });
  await button(daily,'Восстановить копию').click();
  await menu.getByText('Операция отменена. Данные не изменены.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>PlanSync._docs()['tx/stage-three'].d.amt),275);
  page.once('dialog',dialog=>dialog.accept());
  await button(daily,'Восстановить копию').click();
  await page.waitForFunction(()=>PlanSync._docs()['tx/stage-three'].d.amt===200);
  const restored = await page.evaluate(()=>PlanSync._docs());
  for (const path of Object.keys(seed)) assert.deepEqual(restored[path].d,seed[path]);
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('plan.android-test.meta.v1')).syncPaused));
  const archive = menu.locator('.pl-history-entry').filter({hasText:'До восстановления'});
  if (!await archive.isVisible()) {
    await button(menu,'ЗАКРЫТЬ').click();
    await openData();
    if (!await daily.isVisible()) await menu.getByText(/Последняя копия ·/).click();
  }
  await archive.waitFor();
  const previousDownload = page.waitForEvent('download');
  await button(archive,'Скачать копию').click();
  const previous = JSON.parse(await readFile(await (await previousDownload).path(),'utf8'));
  assert.equal(previous.docs['tx/stage-three'].d.amt,275);
  assert.equal(previous.docs['room-notes/test'].d.title,'Изменено офлайн');
  await shot(page,'02-recovery');

  const corrupted = structuredClone(copy);
  corrupted.docs['tx/stage-three'].d.amt = 99999;
  const input = page.locator('input[type="file"][accept=".json,application/json"]');
  await input.setInputFiles({name:'damaged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(corrupted))});
  await menu.getByText(/проверка целостности не пройдена/).waitFor();
  const injected = '{"v":1,"docs":{"cfg/opening":{"u":1,"d":{"__proto__":{"cash":123}}}}}';
  await input.setInputFiles({name:'injected.json',mimeType:'application/json',buffer:Buffer.from(injected)});
  await menu.getByText(/Копия не применена/).waitFor();
  assert.deepEqual(await page.evaluate(()=>PlanSync._docs()),restored);
  await button(menu,'ЗАКРЫТЬ').click();

  await page.evaluate(()=>PlanDB.doc('cfg/room-reminders').set({
    version:1,at:'13:00',quietFrom:'23:00',quietTo:'08:00',categories:['food','habits','recovery']
  }));
  await page.clock.runFor(61000);
  const sent = await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date]?.d.sent,date);
  assert.deepEqual(sent,['habits','recovery'],'a completed food diary suppresses its reminder even with no meals');
  const receipt = await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date].u,date);
  await page.clock.runFor(61000);
  assert.equal(await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date].u,date),receipt);
  await page.locator('.citadel-shell-dock [data-section="wardrobe"]').click();
  await page.locator('#profile-settings-open').click();
  const reminders = page.locator('#room-reminders');
  await reminders.locator('summary').click();
  await reminders.getByLabel('Сон ещё не записан').waitFor();
  await reminders.evaluate(el=>{
    const settings = el.closest('#setup');
    settings.scrollTop += el.getBoundingClientRect().top - settings.getBoundingClientRect().top - 65;
  });
  await shot(page,'03-reminders');

  const limits = await page.evaluate(async()=>{
    const history = VkachSaveHistory.create('qa-retention-only',PlanSync.backupFor);
    const records = {'tx/retention':{u:1,d:{amt:3}}};
    for (let i=1;i<=10;i++) await history.daily(records,new Date(2027,3,i,12));
    for (let i=1;i<=6;i++) await history.change('test-'+i,Date.UTC(2027,3,15+i),records,records,'restore');
    const rows = await history.list();
    return {daily:rows.filter(row=>row.kind==='daily').length,change:rows.filter(row=>row.kind==='change').length,
      oldest:await history.read('change-test-1') ?? null,first:await history.read('day-2027-04-01') ?? null};
  });
  assert.deepEqual(limits,{daily:7,change:4,oldest:null,first:null});
  await context.close();
  console.log('Stage III local: bounded history, verified export, offline restore, protected import and smart reminders');

  let rows = [['path','json','u']], uploads = 0, rejectedAccess = 0, expired = false;
  const remote = async route => {
    const request=route.request(), address=request.url(), authorization=request.headers().authorization;
    if (address.includes('fonts.googleapis.com') || address.includes('fonts.gstatic.com')) return route.fulfill({body:'',contentType:'text/css'});
    if (address.includes('/drive/v3/about?')) return route.fulfill({json:{user:{emailAddress:authorization==='Bearer owner'?'owner@example.invalid':'other@example.invalid'}}});
    if (authorization!=='Bearer owner') { rejectedAccess++; return route.fulfill({status:403,json:{}}); }
    if (expired && address.includes('values/data!A:C')) return route.fulfill({status:401,json:{}});
    if (address.includes('/drive/v3/files?')) return route.fulfill({json:{files:[{id:'PRIVATE_TEST_SHEET'}]}});
    if (request.method()==='PUT') { rows=request.postDataJSON().values; uploads++; return route.fulfill({json:{}}); }
    if (address.includes('values/data!A:C')) return route.fulfill({json:{values:rows}});
    throw Error('Unexpected mock cloud request');
  };
  const a = await device(false,remote), b = await device(false,remote);
  await a.page.evaluate(()=>PlanDB.doc('room-notes/two-devices').set({
    version:1,title:'Синхронизировано между устройствами',text:'Синтетическая запись',created:Date.now(),updated:Date.now()
  }));
  await a.page.evaluate(()=>PlanSync.sync(true));
  assert.equal(await a.page.evaluate(()=>qaLogins),1);
  assert.equal(uploads,1);
  await b.page.evaluate(()=>PlanSync.sync(true));
  await b.page.waitForFunction(()=>PlanSync._docs()['room-notes/two-devices']?.d.title==='Синхронизировано между устройствами');
  assert.equal((await b.page.evaluate(()=>PlanSync._docs()['tx/stage-three'].d)).amt,200);
  await a.page.reload();
  await a.page.waitForFunction(()=>!!PlanSync?._docs()['room-notes/two-devices']);
  await a.page.evaluate(()=>PlanSync.sync(true));
  assert.equal(await a.page.evaluate(()=>qaLogins),0,'reload reuses the verified, unexpired session');
  await a.context.setOffline(true);
  await b.context.setOffline(true);
  await a.page.clock.fastForward(1000);
  await b.page.clock.fastForward(1000);
  await a.page.evaluate(()=>PlanDB.doc('room-notes/two-devices').update({title:'Изменение с устройства A'}));
  await b.page.evaluate(()=>PlanDB.doc('room-notes/two-devices').update({title:'Изменение с устройства B'}));
  await a.context.setOffline(false);
  await a.page.evaluate(()=>PlanSync.sync(false));
  const beforeConflict = uploads;
  await b.context.setOffline(false);
  await b.page.evaluate(()=>PlanSync.sync(false));
  await b.page.waitForFunction(()=>!!localStorage.getItem('plan.conflict.v1'));
  assert.equal(uploads,beforeConflict);
  await b.page.evaluate(()=>PlanSync.openData());
  const compare = b.page.locator('.pl-menu');
  await compare.getByText('Подробные различия',{exact:true}).click();
  await compare.getByText('Заметки · 1',{exact:true}).waitFor();
  await compare.getByText('Сравнение сохранений',{exact:true}).scrollIntoViewIfNeeded();
  await shot(b.page,'04-conflict');
  await button(compare,'Отложить решение').click();
  await b.page.evaluate(()=>PlanSync.sync(false));
  assert.equal(uploads,beforeConflict);
  await button(compare,'Сравнить копии').click();
  b.page.once('dialog',dialog=>dialog.accept());
  await button(compare,'ПРИНЯТЬ КОНФЛИКТУЮЩИЕ ДАННЫЕ ОБЛАКА').click();
  await b.page.waitForFunction(()=>!localStorage.getItem('plan.conflict.v1'));
  assert.equal(uploads,beforeConflict,'resolution still waits for manual upload');
  assert.equal(await b.page.evaluate(()=>PlanSync._docs()['room-notes/two-devices'].d.title),'Изменение с устройства A');
  assert.equal(await b.page.evaluate(()=>PlanSync._docs()['tx/stage-three'].d.amt),200);

  await a.page.evaluate(()=>PlanSync.openData());
  const account = a.page.locator('.pl-menu');
  expired = true;
  const logins = await a.page.evaluate(()=>qaLogins);
  await a.page.evaluate(()=>PlanSync.sync(true));
  await account.getByText('Нужно войти в Google',{exact:true}).waitFor();
  assert.equal(await a.page.evaluate(()=>localStorage.getItem('plan.tok')),'null');
  await a.page.evaluate(()=>PlanSync.sync(false));
  assert.equal(await a.page.evaluate(()=>qaLogins),logins,'an expired session must never open Google on reconnect');
  expired = false;
  await a.page.evaluate(()=>PlanSync.sync(true));
  assert.equal(await a.page.evaluate(()=>qaLogins),logins+1);
  await button(account,'ВЫЙТИ').click();
  await account.getByText(/Выход выполнен/).waitFor();
  await a.page.evaluate(()=>{window.qaToken='other';});
  await button(account,'ВОЙТИ ЧЕРЕЗ GOOGLE').click();
  await account.getByText(/Этот профиль связан с другим аккаунтом Google/).waitFor();
  assert.equal(rejectedAccess,0,'never reach Sheets using an unrelated account');
  assert.equal(uploads,beforeConflict);
  assert.equal(await a.page.evaluate(()=>PlanSync._docs()['tx/stage-three'].d.amt),200);
  await a.context.close();
  await b.context.close();
  assert.deepEqual(errors,[]);
  console.log('Stage III Sheets sandbox: sign-in, reload, offline work, conflict deferral, explicit resolution, sign-out and account isolation');
} finally {
  await browser.close();
  await new Promise(done=>server.close(done));
}
