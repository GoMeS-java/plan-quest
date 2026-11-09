import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';
import '../src/room-workspace.js';

const reminders = {at:'18:00',quietFrom:'23:00',quietTo:'08:00',categories:['tasks','food']};
const due = (at,sent=[],needs=()=>true) => VkachRoomWorkspace.dueReminders(reminders,at,sent,needs).map(row=>row[0]);
assert.deepEqual(due('17:59'),[]);
assert.deepEqual(due('23:30'),[]);
assert.deepEqual(due('19:00',['tasks']),['food']);
assert.deepEqual(due('19:00',[],key=>key==='tasks'),['tasks']);

const root = resolve('android-test');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req,res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) throw Error('Invalid path');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
const shots = process.env.STAGE_TWO_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
try {
  const date = '2027-04-16';
  const seed = { 'cfg/opening': { cash: 150000, card: 320000 }, 'cfg/citadel': { selectedRoom: 'rest' },
    'cfg/abyss-economy': { version: 1, rank: 1, earned: 1000, claims: {} },
    'buys/citadel-observatory-2': {kind:'citadel-room',currency:'abyss',room:'observatory',level:2,
      item:'citadel-observatory-2',name:'Латунная звёздная линза',cost:5,ts:1} };
  for (let i = 0; i < 179; i++) {
    const t = Date.UTC(2026, 9, 19 + i, 12), day = new Date(t).toISOString().slice(0, 10);
    seed['days/' + day] = { q: Array(10).fill(true), steps: 45000 + i * 10, kcal: 2130 + i % 5 * 55 };
    seed['per/' + day] = { squat:[t,t+7200000,t+14400000],pushup:[t,t+7200000,t+14400000],
      squatR:[100,100,100],pushupR:[100,100,100] };
  }
  for (const [i,kg] of [149.2,148.7,149,148.3,148.2,147.9].entries()) {
    seed['weights/stage-two-'+i] = { date:'2027-04-'+(10+i),kg,ts:Date.UTC(2027,3,10+i,11) };
  }
  const context = await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,
    timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
  await context.route('https://**/*', route => route.fulfill({body:'',contentType:'text/css'}));
  await context.addInitScript(seed => {
    localStorage.setItem('plan.android-test.awakening.v1',JSON.stringify({version:1,step:12,status:'done'}));
    localStorage.setItem('plan.android-test.rebuild-guide.v1',JSON.stringify({version:1,step:2,status:'done'}));
    if (localStorage.getItem('qa-stage-two')) return;
    localStorage.setItem('qa-stage-two','1');
    localStorage.setItem('wsum','2027-04-12');
    localStorage.setItem('msum','2027-04');
    localStorage.setItem('plan.android-test.store.v1',JSON.stringify({
      v:1,docs:Object.fromEntries(Object.entries(seed).map(([path,d])=>[path,{d,u:1}]))
    }));
  },seed);
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(date+'T14:00:00+03:00')});
  const dismiss = () => page.evaluate(() => {
    document.querySelector('#legend-scene[open]')?.close();
    if (!document.querySelector('#achup').hidden) document.querySelector('#ac-ok').click();
    for (const id of ['setup','trophy','lvup']) document.getElementById(id).hidden=true;
  });
  await page.goto(url);
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  for(let i=0;i<7;i++){await dismiss();await page.clock.runFor(40);}
  await page.addLocatorHandler(page.locator('#achup:not([hidden]),#legend-scene[open],#lvup:not([hidden])').first(),dismiss,{noWaitAfter:true});
  const protectedDocs = () => page.evaluate(()=>Object.fromEntries(Object.entries(PlanSync._docs())
    .filter(([path,row])=>row.d && /^(days\/|per\/|tx\/|buys\/|chains\/|cfg\/opening$)/.test(path)).map(([path,row])=>[path,row.d])));
  const oldBackup = await page.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  const before = await protectedDocs();
  const panel = page.locator('#room-workspace');
  const b = (name,scope=panel) => scope.getByRole('button',{name,exact:true});
  const shot = async name => {
    if (!shots) return;
    await page.clock.runFor(90);
    await page.screenshot({path:resolve(shots,name+'.png'),animations:'disabled'});
  };
  async function openRoom(id) {
    await page.locator('[data-croom="'+id+'"]').click();
    await page.waitForFunction(id=>document.querySelector('#citadel-interior-stage').dataset.room===id&&document.querySelector('#citadel-home').dataset.uiView==='room',id);
  }
  async function open(id) {
    await openRoom(id);
    await page.locator('.citadel-room-primary').click();
    await panel.waitFor();
  }
  async function closePanel() {
    await page.locator('.citadel-system-dialog header button').first().click();
    await page.waitForFunction(()=>!document.querySelector('.citadel-system-dialog').open&&history.state?.citadelOverlay!=='system');
  }
  async function map() {
    await page.locator('#citadel-interior-close').click();
    await page.waitForFunction(()=>document.querySelector('#citadel-home').dataset.uiView==='overview');
  }
  await open('observatory');
  await panel.getByLabel('Направление').selectOption('weight');
  await panel.getByText('График и записи',{exact:true}).click();
  assert.equal(await panel.locator('svg circle').count(),6);
  await shot('01-observatory');
  assert.match(await panel.innerText(), /Если тенденция сохранится/);
  await b('30 дней').click();
  await panel.getByLabel('Направление').selectOption('finance');
  assert.match(await panel.innerText(),/470/);
  assert.deepEqual(await protectedDocs(),before);
  await closePanel();
  await map();

  await open('study');
  await b('Проекты').click();
  await b('Новый проект').click();
  await panel.getByLabel('Название',{exact:true}).fill('Учёба и режим');
  await panel.getByRole('checkbox').first().check();
  await b('Сохранить').click();
  await panel.getByText('Выполнено 0 из 1',{exact:true}).waitFor();
  await panel.getByText('Задания проекта',{exact:true}).click();
  await shot('02-cabinet-project');
  await b('Заметки').click();
  await b('Новая заметка').click();
  await panel.getByLabel('Название',{exact:true}).fill('План на неделю');
  await panel.getByLabel('Текст',{exact:true}).fill('Разобрать конспект и повторить новые слова.');
  await panel.getByLabel('Проект',{exact:true}).selectOption({label:'Учёба и режим'});
  await b('Сохранить').click();
  await panel.getByText('План на неделю',{exact:true}).waitFor();
  await b('Удалить').click();
  await b('Отменить').click();
  await panel.getByText('План на неделю',{exact:true}).waitFor();
  await shot('03-cabinet-notes');
  await closePanel();
  await map();

  await open('cloister');
  const ritual = panel.getByRole('button',{name:/^Выполнить:/}).first();
  await ritual.click();
  await panel.getByRole('button',{name:/^Снять отметку:/}).first().waitFor();
  assert((await protectedDocs())['days/'+date]?.q[0]);
  await shot('04-rituals');
  await closePanel();
  await map();
  await open('study');
  await b('Проекты').click();
  await panel.getByText('Выполнено 1 из 1',{exact:true}).waitFor();
  await closePanel();
  await map();

  await context.setOffline(true);
  await open('rest');
  await panel.getByLabel('Самочувствие от 1 до 5').selectOption('4');
  await b('Сохранить запись').click();
  await panel.getByText('Запись сохранена',{exact:true}).waitFor();
  assert.equal(await page.evaluate(date=>PlanSync._docs()['room-recovery/'+date].d.minutes,date),null);
  await panel.getByLabel('Засыпание',{exact:true}).fill('23:30');
  await panel.getByLabel('Пробуждение',{exact:true}).fill('07:00');
  await panel.getByLabel('Энергия от 1 до 5').selectOption('4');
  await b('Сохранить запись').click();
  await panel.getByText('Средний сон по записям: 450 мин.',{exact:true}).waitFor();
  await shot('05-recovery');
  await closePanel();
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  await page.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.room==='rest');
  await page.locator('.citadel-room-primary').click();
  await panel.getByLabel('Энергия от 1 до 5').waitFor();
  assert.equal(await panel.getByLabel('Энергия от 1 до 5').inputValue(),'4');
  await closePanel();
  await map();
  await openRoom('refectory');
  await page.locator('.citadel-room-primary').click();
  const food = page.locator('#food');
  await b('Продукты',food).click();
  await food.getByText('Настройки питания',{exact:true}).click();
  await food.getByLabel('Дневная цель, ккал').fill('2600');
  await b('Сохранить цель',food).click();
  await food.getByText('Цель питания сохранена',{exact:true}).waitFor();
  await food.getByText('Настройки питания',{exact:true}).click();
  await shot('06-food-goal');
  await b('Сегодня',food).click();
  assert.match(await food.innerText(),/2\s600 ккал/);
  await closePanel();
  const after = await protectedDocs();
  assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([path])=>path!=='days/'+date)),before);
  const backup = await page.evaluate(()=>PlanSync.backupFor(PlanSync._docs()));
  assert(Object.keys(backup.docs).some(path=>path.startsWith('room-notes/')));
  assert.equal(backup.docs['food-settings/preferences'].d.kcal,2600);
  await page.evaluate(old=>PlanSync.importObj(old,true),oldBackup);
  assert.deepEqual(await protectedDocs(),before);
  await page.evaluate(copy=>PlanSync.importObj(copy,true),backup);
  assert.deepEqual(await protectedDocs(),after);
  assert.equal(await page.evaluate(date=>PlanSync._docs()['room-recovery/'+date].d.mood,date),4);
  await map();
  await page.getByRole('button',{name:'Все разделы игры'}).click();
  const search = page.getByRole('searchbox',{name:'Поиск по Вкачу'});
  await search.fill('Приседания');
  await page.locator('.citadel-search-results button').filter({hasText:'приседаний'}).click();
  await page.locator('.citadel-system-dialog[open] #today').waitFor();
  await closePanel();

  await page.locator('.citadel-shell-dock [data-section="wardrobe"]').click();
  await page.locator('#profile-settings-open').click();
  const settings = page.locator('#room-reminders');
  await settings.locator('summary').click();
  await settings.getByLabel('Показывать после').fill('13:00');
  await settings.getByLabel('Задания ещё открыты').check();
  await b('Сохранить напоминания',settings).click();
  await page.waitForFunction(date=>PlanSync._docs()['room-reminder-days/'+date]?.d.sent.includes('tasks'),date);
  const notice = await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date].u,date);
  await page.clock.runFor(61000);
  assert.equal(await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date].u,date),notice);
  await settings.scrollIntoViewIfNeeded();
  await shot('07-reminders');

  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),360);
  assert.deepEqual(errors,[]);
  console.log('Stage II: read-only analytics, linked projects, note undo, shared rituals, offline recovery, calorie preferences and backup round trip verified');
  await context.close();
} finally {
  await browser.close();
  await new Promise(done=>server.close(done));
}
