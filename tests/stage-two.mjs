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
  async function assertNoHorizontalScroll(area) {
    const size = await area.evaluate(el=>({scroll:el.scrollWidth,visible:el.clientWidth,name:el.id||el.className}));
    assert(size.scroll<=size.visible+1,JSON.stringify(size));
  }
  const content = page.locator('.citadel-system-content');
  const projectProgress = (done,total) => panel.getByText('Выполнено '+done+' из '+total,{exact:true}).waitFor();
  const wakeup = 'Встал до 10:00';
  async function openRoom(id) {
    await page.locator('[data-croom="'+id+'"]').click();
    await page.waitForFunction(id=>document.querySelector('#citadel-interior-stage').dataset.room===id&&document.querySelector('#citadel-home').dataset.uiView==='room',id);
    await assertNoHorizontalScroll(page.locator('html'));
  }
  async function open(id) {
    await openRoom(id);
    await page.locator('.citadel-room-primary').click();
    await panel.waitFor();
    await assertNoHorizontalScroll(content);
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
  await panel.getByLabel('Направление').selectOption('food');
  await panel.getByText('График и записи',{exact:true}).click();
  assert.equal(await panel.locator('svg circle').count(),6);
  await b('30 дней').click();
  for (const metric of ['food','tasks','habits']) {
    await panel.getByLabel('Направление').selectOption(metric);
    await panel.getByText('График и записи',{exact:true}).click();
    assert.equal(await panel.locator('svg circle').count(),29);
  }
  await panel.getByLabel('Направление').selectOption('sleep');
  await panel.getByText('За этот период нет записей.',{exact:true}).waitFor();
  assert.equal(await panel.locator('svg').count(),0);
  await panel.getByLabel('Направление').selectOption('finance');
  assert.match(await panel.innerText(),/470/);
  assert.deepEqual(await protectedDocs(),before);
  await closePanel();
  await map();

  await open('study');
  await b('Проекты').click();
  await b('Новый проект').click();
  await panel.getByLabel('Название',{exact:true}).fill('Учёба и режим');
  await panel.getByRole('checkbox',{name:wakeup,exact:true}).check();
  await b('Сохранить').click();
  await projectProgress(0,1);
  await b('Редактировать').click();
  await panel.getByRole('checkbox',{name:'Лёг до 00:00',exact:true}).check();
  await b('Сохранить').click();
  await projectProgress(0,2);
  await b('Заметки').click();
  await b('Новая заметка').click();
  await panel.getByLabel('Название',{exact:true}).fill('План на неделю');
  await panel.getByLabel('Текст',{exact:true}).fill('Разобрать конспект и повторить новые слова.');
  await panel.getByLabel('Проект',{exact:true}).selectOption({label:'Учёба и режим'});
  await b('Сохранить').click();
  await panel.getByText('План на неделю',{exact:true}).waitFor();
  await b('Редактировать').click();
  await panel.getByLabel('Текст',{exact:true}).fill('Повторить новые слова после конспекта.');
  await b('Сохранить').click();
  await panel.getByText('Повторить новые слова после конспекта.',{exact:true}).waitFor();
  await b('Удалить').click();
  await b('Отменить').click();
  await panel.getByText('План на неделю',{exact:true}).waitFor();
  await shot('03-cabinet-notes');
  await closePanel();
  await map();

  await page.locator('.citadel-shell-dock [data-section="today"]').click();
  const tasks = page.locator('#qlist');
  const wakeTask = tasks.getByRole('button',{name:new RegExp(wakeup)});
  await wakeTask.click();
  await page.waitForFunction(date=>PlanSync._docs()['days/'+date]?.d.q[0],date);
  await closePanel();
  await open('cloister');
  await b('Снять отметку: '+wakeup).waitFor();
  assert.equal(await panel.locator('.room-ritual-card details[open]').count(),0);
  assert((await panel.locator('.room-ritual-card').first().boundingBox()).height<125);
  const ritualCard = panel.locator('.room-ritual-card').filter({hasText:wakeup});
  await ritualCard.getByText('Последние 7 дней',{exact:true}).click();
  await b('Снять отметку: '+wakeup).click();
  await page.waitForFunction(date=>PlanSync._docs()['days/'+date]?.d.q[0]===false,date);
  assert.equal(await ritualCard.locator('details[open]').count(),1);
  await closePanel();
  await map();
  await open('study');
  await b('Проекты').click();
  await projectProgress(0,2);
  await closePanel();
  await map();
  await open('cloister');
  assert.equal(await panel.locator('.room-ritual-card details[open]').count(),0);
  await b('Выполнить: '+wakeup).click();
  await b('Выполнить: Лёг до 00:00').click();
  await page.waitForFunction(date=>{const q=PlanSync._docs()['days/'+date]?.d.q;return q?.[0]&&q?.[8];},date);
  const afterRituals = await protectedDocs();
  await shot('04-rituals');
  await closePanel();
  await map();
  await open('study');
  await b('Проекты').click();
  await projectProgress(2,2);
  await panel.getByText('Задания проекта',{exact:true}).click();
  await shot('02-cabinet-project');
  assert.deepEqual(await protectedDocs(),afterRituals);
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
  const yesterday = '2027-04-15';
  await panel.getByLabel('Дата записи').fill(yesterday);
  await panel.getByLabel('Длительность сна, минут').fill('390');
  await b('Сохранить запись').click();
  await panel.getByText('Средний сон по записям: 420 мин.',{exact:true}).waitFor();
  await b('Удалить запись').click();
  await panel.getByText('Запись удалена.',{exact:true}).waitFor();
  await panel.getByText('Средний сон по записям: 450 мин.',{exact:true}).waitFor();
  assert.equal(await panel.getByLabel('Длительность сна, минут').inputValue(),'');
  await b('Отменить').click();
  await panel.getByText('Запись восстановлена',{exact:true}).waitFor();
  assert.equal(await panel.getByLabel('Длительность сна, минут').inputValue(),'390');
  await panel.getByText('Последние 7 дней',{exact:true}).click();
  await panel.getByText('15.04.2027 · 390 мин',{exact:true}).waitFor();
  await panel.getByLabel('Дата записи').fill(date);
  await panel.getByLabel('Заметка',{exact:true}).fill('Восстановился после нагрузки.');
  await b('Сохранить запись').click();
  await panel.getByText('Запись сохранена',{exact:true}).waitFor();
  await shot('05-recovery');
  await closePanel();
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.querySelector('#citadel-live-rank').textContent!=='РАНГ …');
  await page.waitForFunction(()=>document.querySelector('#citadel-interior-stage').dataset.room==='rest');
  await page.locator('.citadel-room-primary').click();
  await panel.getByLabel('Энергия от 1 до 5').waitFor();
  assert.equal(await panel.getByLabel('Энергия от 1 до 5').inputValue(),'4');
  assert.equal(await panel.getByLabel('Заметка',{exact:true}).inputValue(),'Восстановился после нагрузки.');
  await closePanel();
  await map();
  await open('study');
  await b('Проекты').click();
  await projectProgress(2,2);
  await b('Заметки').click();
  await panel.getByText('Повторить новые слова после конспекта.',{exact:true}).waitFor();
  await closePanel();
  await map();
  await openRoom('refectory');
  await page.locator('.citadel-room-primary').click();
  const food = page.locator('#food');
  await assertNoHorizontalScroll(content);
  await food.getByText(/Записано .*2\s500 ккал/).waitFor();
  await b('Продукты',food).click();
  await b('Создать рецепт',food).click();
  await food.getByLabel('Название',{exact:true}).first().fill('Домашний рецепт для проверки');
  await food.getByLabel('Способ приготовления').selectOption('cooked');
  const cookedWeight = food.getByLabel('Итоговый приготовленный вес, г');
  await cookedWeight.fill('250');
  await b('Своя позиция',food).click();
  const ingredient = food.locator('.food-entry').first();
  await ingredient.getByLabel('Название',{exact:true}).fill('Ингредиент');
  await ingredient.getByLabel('Вес до приготовления, г').fill('150');
  await ingredient.getByLabel('Способ учёта').selectOption('estimate');
  await ingredient.getByLabel('ккал',{exact:true}).fill('200');
  await food.getByText('Расчёт порции',{exact:true}).click();
  const portionWeight = food.getByLabel('Порция для расчёта, г');
  await portionWeight.fill('125');
  await food.getByText(/≈ 120 ккал на 100 г.*≈ 150 ккал в порции/).waitFor();
  await portionWeight.fill('0');
  await food.getByText(/Укажи массу от 0,001 г/).waitFor();
  await portionWeight.fill('1e999');
  await food.getByText(/Введи положительное число или ноль/).waitFor();
  await portionWeight.fill('125');
  await cookedWeight.fill('0');
  await food.getByText('Заполни массу и данные ингредиентов для расчёта.',{exact:true}).waitFor();
  await cookedWeight.fill('200');
  await food.getByText(/≈ 150 ккал на 100 г.*≈ 187,5 ккал в порции/).waitFor();
  await cookedWeight.fill('250');
  await ingredient.getByLabel('ккал',{exact:true}).fill('');
  await ingredient.getByLabel('Белки',{exact:true}).fill('10');
  await food.getByText(/калорийность неизвестна/).waitFor();
  await ingredient.getByLabel('ккал',{exact:true}).fill('200');
  assert.doesNotMatch(await food.innerText(),/Infinity|NaN/);
  await assertNoHorizontalScroll(content);
  await food.getByText(/≈ 120 ккал на 100 г.*≈ 150 ккал в порции/).scrollIntoViewIfNeeded();
  await shot('08-recipe-portion');
  await b('Сохранить',food).click();
  await food.getByText('Сохранено в продуктах',{exact:true}).waitFor();
  await b('Сегодня',food).click();
  const breakfast = food.locator('section').filter({has:page.getByText('Завтрак',{exact:true})});
  await b('Добавить',breakfast).click();
  await food.getByLabel('Из продуктов и рецептов').selectOption({label:'Домашний рецепт для проверки'});
  await food.getByLabel('Масса порции, г',{exact:true}).last().fill('125');
  await b('Убрать',food).first().click();
  await b('Сохранить приём пищи',food).click();
  await food.getByText('Осталось ≈ 2 350 ккал',{exact:true}).waitFor();
  await b('Продукты',food).click();
  await food.getByText(/Домашние блюда и рецепты/).click();
  await b('Редактировать Домашний рецепт для проверки',food).click();
  await food.getByText('Расчёт порции',{exact:true}).click();
  assert.equal(await portionWeight.inputValue(),'125');
  await cookedWeight.fill('300');
  await food.getByText(/≈ 100 ккал на 100 г.*≈ 125 ккал в порции/).waitFor();
  await b('Сохранить',food).click();
  await food.getByText('Сохранено в продуктах',{exact:true}).waitFor();
  await food.getByText('Настройки питания',{exact:true}).click();
  await food.getByLabel('Дневная цель, ккал').fill('2600');
  await b('Сохранить цель',food).click();
  await food.getByText('Цель питания сохранена',{exact:true}).waitFor();
  await food.getByText('Настройки питания',{exact:true}).click();
  await shot('06-food-goal');
  await b('Сегодня',food).click();
  assert.match(await food.innerText(),/2\s600 ккал/);
  await food.getByText('Осталось ≈ 2 450 ккал',{exact:true}).waitFor();
  await closePanel();
  assert.match(await page.locator('.citadel-refectory-calories').innerText(),/2\s600 ккал/);
  assert.match(await page.locator('.citadel-today-values').textContent(),/2\s600 ккал/);
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
  assert.equal(await page.evaluate(()=>PlanSync._docs()['food-settings/preferences'].d.kcal),2600);
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.querySelector('#citadel-interior-stage').dataset.room==='refectory');
  await page.locator('.citadel-room-primary').click();
  await food.getByText('Осталось ≈ 2 450 ккал',{exact:true}).waitFor();
  await closePanel();
  await map();
  await open('observatory');
  await panel.getByLabel('Направление').selectOption('food');
  await panel.getByText('В сводке есть приблизительные записи.',{exact:true}).waitFor();
  await panel.getByText('График и записи',{exact:true}).click();
  await panel.getByText('16.04.2027 · ≈ 150 ккал',{exact:true}).waitFor();
  await closePanel();
  await map();
  await open('study');
  await b('Проекты').click();
  await projectProgress(2,2);
  await closePanel();
  await map();
  await page.getByRole('button',{name:'Все разделы игры'}).click();
  const search = page.getByRole('searchbox',{name:'Поиск по Вкачу'});
  await search.fill('Приседания');
  await assertNoHorizontalScroll(page.locator('#citadel-shell-nav'));
  await assertNoHorizontalScroll(page.getByRole('navigation',{name:'Быстрые действия'}));
  await page.locator('.citadel-search-results button').filter({hasText:'приседаний'}).click();
  await page.locator('.citadel-system-dialog[open] #today').waitFor();
  await tasks.getByRole('button',{name:/Еда в пределах 2500 ккал/}).waitFor();
  await closePanel();

  await page.locator('.citadel-shell-dock [data-section="wardrobe"]').click();
  await page.locator('#profile-settings-open').click();
  const settings = page.locator('#room-reminders');
  await settings.locator('summary').click();
  const schedule = settings.getByLabel('Показывать после');
  await schedule.waitFor();
  for (const width of [320,360,390,430]) {
    await page.setViewportSize({width,height:800});
    await assertNoHorizontalScroll(page.locator('#setup'));
    await assertNoHorizontalScroll(settings);
    const boxes = await settings.locator('input[type="time"]').evaluateAll(inputs=>inputs.map(input=>{
      const field=input.getBoundingClientRect(),form=input.closest('.room-reminder-form').getBoundingClientRect();
      return {left:field.left-form.left,right:form.right-field.right,height:field.height,width:field.width};
    }));
    assert.equal(boxes.length,3);
    assert(boxes.every(box=>box.left>=-1&&box.right>=-1&&box.height>=44&&box.width>=44),JSON.stringify(boxes));
    if (width===320) {
      await settings.scrollIntoViewIfNeeded();
      await shot('07-reminders-320');
    }
  }
  await page.setViewportSize({width:360,height:800});
  await schedule.focus();
  await page.setViewportSize({width:360,height:420});
  await settings.getByLabel('Тишина с').fill('22:30');
  await settings.getByLabel('Тишина до').fill('07:30');
  await schedule.fill('13:00');
  await page.waitForFunction(()=>document.activeElement?.type==='time');
  const focused = await schedule.boundingBox();
  assert(focused.y>=0&&focused.y+focused.height<=420);
  await page.setViewportSize({width:360,height:800});
  await settings.getByLabel('Задания ещё открыты').check();
  await b('Сохранить напоминания',settings).click();
  await page.waitForFunction(date=>PlanSync._docs()['room-reminder-days/'+date]?.d.sent.includes('tasks'),date);
  const notice = await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date].u,date);
  await page.clock.runFor(61000);
  assert.equal(await page.evaluate(date=>PlanSync._docs()['room-reminder-days/'+date].u,date),notice);
  await settings.locator('summary').click();
  await settings.locator('summary').click();
  assert.equal(await settings.getByLabel('Тишина с').inputValue(),'22:30');
  assert.equal(await settings.getByLabel('Тишина до').inputValue(),'07:30');
  await settings.scrollIntoViewIfNeeded();
  await shot('07-reminders');

  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),360);
  assert.deepEqual(errors,[]);
  console.log('Stage II: analytics, shared rituals and projects, note and recovery undo, recipes, calorie preferences, backup, reminders at 320–430 px and mobile viewport resize verified');
  await context.close();
} finally {
  await browser.close();
  await new Promise(done=>server.close(done));
}
