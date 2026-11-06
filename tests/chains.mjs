import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import '../src/chains.js';

const model = globalThis.VkachChains;
const instant = date => new Date(date + 'T00:00:00+03:00');
assert.deepEqual(model.clock(+instant(model.start)), { ratio: 0, total: 181, gone: 0, left: 181, complete: false });
assert.deepEqual(model.clock(+instant(model.end)), { ratio: 1, total: 181, gone: 181, left: 0, complete: true });
assert.equal(model.today(Date.parse('2026-11-08T20:59:59Z')), '2026-11-08');
assert.equal(model.today(Date.parse('2026-11-08T21:00:00Z')), '2026-11-09');
assert.equal(model.limit('2026-11-05'), null);
assert.equal(model.limit('2026-11-06'), 15);
for (let i = 0; i <= 20; i++) {
  const monday = model.shift('2026-11-09', 7 * i), value = Math.max(0, 14 - i);
  assert.equal(model.limit(monday), value);
  assert.equal(model.limit(model.shift(monday, 6)), value);
}
assert.equal(model.limit(model.zero), 0);
const confirmed = ['2026-11-06', '2026-11-07', '2026-11-08'].map(date => ({ date, kind: 'confirm' }));
const settle = events => model.summarize(events, '2026-11-09');
const gains = events => model.progression(settle(events), {}, '2026-11-09').byDay;
assert.deepEqual(gains(confirmed), { '2026-11-07': 1, '2026-11-08': 1, '2026-11-09': 4 });
assert.deepEqual(gains(confirmed.slice(1)), { '2026-11-08': 1, '2026-11-09': 1 });
const exceed = Array.from({length:16}, () => ({date: model.start, kind:'smoke'}));
assert.deepEqual(gains([...confirmed, ...exceed]), gains(confirmed.slice(1)));
exceed[0].voidAt = 1;
assert.deepEqual(gains([...confirmed, ...exceed]), gains(confirmed));
assert.deepEqual(model.progression(model.summarize(confirmed, model.start), {}, model.start).byDay, {});
const dates = Array.from({length: 150}, (_, i) => ({date: model.shift(model.start, i),kind:'confirm'}));
const hidden = model.summarize(dates, '2027-05-06');
const earned = model.pendingAwards(hidden, '2027-05-06', {});
assert(earned.length > 0);
const ledger = Object.fromEntries(earned.map(id => [id, '2027-05-06']));
assert.deepEqual(model.pendingAwards(hidden, '2027-05-06', ledger), []);
assert.deepEqual(model.mergeAwards(ledger, {}), ledger);
const opened = model.progression(hidden, ledger, '2027-05-06');
assert(opened.aspect);
assert(opened.marks.some(row => row.points > 0));
assert.equal(model.progression(hidden, ledger, '2027-05-05').aspect, null);
const active = { ...ledger, 'chains-aspect': '2026-11-07' };
assert.equal(model.progression(settle(confirmed), active, '2026-11-09').byDay['2026-11-09'], 5);
assert.equal(model.progression(settle(confirmed), active, '2026-11-09').byDay['2026-11-07'], 1);
assert.equal(model.owned(model.mergeAwards({'chains-body':'2026-11-06'}, ledger)).find(row => row.id === 'chains-body').points, 0);
const reduced = dates.slice(0,7).flatMap(({date}) => Array.from({length:10}, () => ({date,kind:'smoke'})));
const reductionDate = '2026-11-13';
assert(model.pendingAwards(model.summarize(reduced, reductionDate), reductionDate, {}).includes('chains-aspect'));
assert(!model.pendingAwards(model.summarize(reduced.slice(10), reductionDate), reductionDate, {}).includes('chains-aspect'));
assert.equal(model.dayShards(10, reductionDate, {date:reductionDate}), 2);


const { chromium } = createRequire(import.meta.url)('playwright');
const contentTypes = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png'};
const root = resolve('android-test');
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) throw Error('path');
    res.setHeader('Content-Type', contentTypes[extname(file)] || 'text/plain');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {}) });
const output = resolve(process.env.TEST_OUTPUT || 'test-results');
await mkdir(output, { recursive: true });
const errors = [];
async function launch(date, seed = {}, opts = {}) {
  const context = await browser.newContext({ viewport: {width:390,height:844}, hasTouch:true, isMobile:true, timezoneId:'America/Los_Angeles', ...opts });
  await context.route('https://**/*', route => route.fulfill({body:'',contentType:'text/css'}));
  await context.addInitScript(({ docs, week }) => {
    localStorage.setItem('plan.android-test.awakening.v1', JSON.stringify({version:1,step:0,status:'skipped'}));
    if (localStorage.getItem('chains-test-init')) return;
    localStorage.setItem('chains-test-init','1');
    localStorage.setItem('wsum', week);
    localStorage.setItem('plan.android-test.store.v1', JSON.stringify({v:1,docs:Object.fromEntries(Object.entries(docs).map(([id,d])=>[id,{d,u:1}]))}));
  }, { docs: seed, week: model.monday(model.shift(date, -1)) });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({time: instant(date)});
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#citadel-live-rank').textContent !== 'РАНГ …');
  await dismiss(page);
  return {page,context};
}
async function dismiss(page) {
  for(let i=0;i<4;i++) {
    await page.evaluate(() => {
      document.querySelector('#legend-scene[open]')?.close();
      if (!document.getElementById('achup').hidden) document.getElementById('ac-ok').click();
      for (const id of ['lvup','setup','trophy']) document.getElementById(id).hidden=true;
    });
  }
}
const capture = (page,name) => page.screenshot({path:resolve(output,'v13-progression-'+name+'.png')});
const close = (page, id) => page.locator(id).getByRole('button',{name:'Закрыть',exact:true}).click();
const leave = async page => {
  await page.getByRole('button',{name:'Вернуться в Цитадель'}).click();
  await page.waitForFunction(() => !history.state?.citadelOverlay && !document.querySelector('.citadel-system-dialog').open);
};
const dock = (page, id) => page.locator('.citadel-shell-dock [data-section="' + id + '"]').click();
const smokeRows = page => page.evaluate(() => Object.values(PlanSync._docs()).filter(row => row.d?.kind==='smoke' && !row.d.voidAt).length);

try {
  const { page,context } = await launch('2026-11-06', {'cfg/opening':{cash:1000,card:2000},'weights/old':{date:'2026-11-04',kg:150}});
  const glass = page.locator('#fate-hourglass');
  await glass.click();
  assert.match(await page.locator('#fate-clock-dialog').innerText(), /181 дн\./);
  await page.keyboard.press('Escape');
  assert(await page.locator('#fate-clock-dialog').isHidden());
  assert(await page.locator('#citadel-home').evaluate(node => node.classList.contains('citadel-expanded')));
  await capture(page,'citadel');
  await glass.screenshot({path:resolve(output,'v13-progression-clock-green.png')});
  const medallion = page.locator('.chains-medallion');
  const layout = await page.evaluate(() => {
    const b = document.querySelector('.chains-medallion').getBoundingClientRect(), nav = document.querySelector('.citadel-shell-dock').getBoundingClientRect();
    return b.width >= 44 && b.height >= 44 && b.bottom <= nav.top;
  });
  assert(layout);
  await medallion.tap();
  await page.waitForFunction(() => document.querySelector('.chains-quick-count').textContent === '1');
  assert.equal(await smokeRows(page),1);
  await page.locator('.chains-quick').getByRole('button',{name:'Отменить',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('.chains-quick-count').textContent === '0');
  assert.equal(await smokeRows(page),0);
  await medallion.tap();
  await medallion.tap();
  await page.waitForFunction(() => document.querySelector('.chains-quick-count').textContent === '2');
  assert.equal(await smokeRows(page),2);
  await capture(page,'quick');
  await dock(page,'today');
  assert.match(await page.locator('#chains-daily').innerText(), /2 \/ 15/);
  await page.locator('#chains-daily').screenshot({path:resolve(output,'v13-progression-daily.png')});
  await page.locator('#chains-daily').getByRole('button',{name:'Дневник и исправления'}).click();
  await page.getByRole('button',{name:'Убрать запись'}).first().click();
  await page.waitForFunction(() => document.querySelectorAll('#chains-stat button').length > 0 && document.querySelector('.chains-quick-count').textContent === '1');
  await capture(page,'statistics');
  await page.getByRole('button',{name:'Настройки испытания'}).click();
  await page.getByLabel('Кнопка в Цитадели').selectOption('left');
  await page.getByLabel('Цена пачки, ₽').fill('200');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await close(page,'#chains-stat');
  await leave(page);
  await page.waitForFunction(() => document.querySelector('.chains-quick').dataset.side === 'left');
  await dock(page,'wardrobe');
  assert.match(await page.locator('#chains-profile').innerText(), /1 \/ 15/);
  await page.locator('#chains-profile').screenshot({path:resolve(output,'v13-progression-profile.png')});
  assert.doesNotMatch(await page.locator('#chains-profile').innerText(), /Воля/);
  await leave(page);
  await page.locator('.citadel-shell-dock button').last().click();
  const pathLink = page.locator('#citadel-shell-nav [data-section=goals]');
  const pathGroup = pathLink.locator('xpath=ancestor::details[1]');
  if (!await pathGroup.getAttribute('open').then(value => value !== null)) await pathGroup.locator('summary').click();
  await pathLink.click();
  await page.locator('#chains-goal').screenshot({path:resolve(output,'v13-progression-goal.png')});
  assert.match(await page.locator('#chains-goal').innerText(), /Факт сегодня · 1/);
  assert.equal(await page.locator('#days-gone').textContent(),'0');
  const copy = await page.evaluate(() => PlanSync.backupFor(PlanSync._docs()));
  await page.evaluate(async backup => { await PlanSync.importObj(backup,true); await PlanSync.importObj(backup,false); },copy);
  assert.equal(await smokeRows(page),1);
  assert.equal(await page.evaluate(()=>PlanSync._docs()['cfg/opening'].d.cash),1000);
  await leave(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await dismiss(page);
  await page.waitForFunction(() => document.querySelector('.chains-quick-count').textContent === '1');
  assert.equal(await smokeRows(page),1);
  for(const [width,height] of [[320,640],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(100);
    assert(await medallion.isVisible());
  }
  await context.setOffline(false);
  await page.clock.setFixedTime(instant('2026-11-09'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => document.querySelector('.chains-medallion').title.includes('0 из 14'));
  await page.waitForFunction(() => VkachChainsUI.getProgress().byDay['2026-11-07'] === 1);
  await page.setViewportSize({width:390,height:844});
  await dock(page,'today');
  await page.locator('#chains-daily').getByRole('button',{name:'Дневник и исправления'}).click();
  const diary = page.locator('#chains-stat');
  await diary.getByLabel('Дневник за дату').fill('2026-11-08');
  await diary.getByRole('button',{name:'+ Сигарета',exact:true}).click();
  await diary.getByText('Сигарета · добавлено позже',{exact:true}).waitFor();
  assert.equal(await diary.getByLabel('Дневник за дату').inputValue(),'2026-11-08');
  assert.equal(await page.locator('.chains-quick-count').textContent(),'0');
  assert.equal(await page.evaluate(() => VkachChainsUI.getProgress().byDay['2026-11-09']),1);
  assert.equal(await page.evaluate(() => Object.values(PlanSync._docs()).filter(r => r.d?.kind==='smoke' && r.d.date==='2026-11-08' && !r.d.voidAt).length),1);
  await diary.getByRole('button',{name:'Убрать запись'}).click();
  await page.waitForFunction(() => !VkachChainsUI.getProgress().byDay['2026-11-09']);
  await diary.getByText('Нет записи · Лимит 15',{exact:true}).waitFor();

  await context.close();

  const history = Object.fromEntries(confirmed.map(row => ['chains/confirm-' + row.date, row]));
  const old = { 'will-plans/2026-11-07': { activity:{label:'Старая прогулка', days:[0]} },
    'will-days/2026-11-07': { activity:'done' }, 'cfg/chains-discoveries': { 'chains-body':'2026-11-06' } };
  const baseline = await launch('2026-11-09', old, {timezoneId:model.zone});
  const baselineRank = await baseline.page.locator('#citadel-live-points').innerText();
  await baseline.context.close();
  const saved = await launch('2026-11-09', { ...old, ...history }, {timezoneId:model.zone});
  const before = Number(baselineRank.match(/\d+/)[0]);
  await saved.page.waitForFunction(before => Number(document.querySelector('#citadel-live-points').textContent.match(/\d+/)[0]) === before + 5, before);
  assert.equal(await saved.page.evaluate(() => PlanSync._docs()['will-days/2026-11-07'].d.activity), 'done');
  await dock(saved.page,'wardrobe');
  await saved.page.locator('#profile-achievements-open').click();
  assert.doesNotMatch(await saved.page.locator('#sklist').innerText(), /Воля|Свободное дыхание/);
  await saved.context.close();

  const streakSeed = Object.fromEntries(dates.slice(0,14).map(row => ['chains/confirm-' + row.date, row]));
  const unlocked = await launch('2026-11-20', streakSeed, {timezoneId:model.zone});
  await unlocked.page.waitForFunction(() => !!VkachChainsUI.getProgress().aspect);
  await dismiss(unlocked.page);
  await dock(unlocked.page,'wardrobe');
  await unlocked.page.locator('#profile-achievements-open').click();
  assert.match(await unlocked.page.locator('#sklist').innerText(), /дополнительный осколок/);
  assert(await unlocked.page.locator('#alist [data-achievement^="chains-"]').count() > 0);
  await unlocked.context.close();

  for (const [date,stage,bg] of [['2027-02-28','gold',null],['2027-04-25','red',null],['2026-12-22','winter','b_winter'],['2027-02-12','space','b_space'],['2027-05-06','complete',null]]) {
    const seed = bg ? {'cfg/look':{bg}, 'cfg/rare':{[bg==='b_winter'?'z02':'z01']:model.shift(date,-1)}} : {};
    const {page,context}=await launch(date,seed,{reducedMotion:'reduce'});
    if (bg) {
      await page.waitForFunction(key => document.documentElement.dataset.citadelBg === key, bg === 'b_winter' ? 'winter' : 'space');
      const effect = page.locator(bg === 'b_winter' ? '.fate-frost' : '.fate-stars');
      assert(await effect.isVisible());
      await dismiss(page);
      await page.evaluate(() => { document.getElementById('toast').hidden = true; });
    }
    const glass=page.locator('#fate-hourglass');
    await glass.screenshot({path:resolve(output,'v13-progression-clock-'+stage+'.png')});
    if(bg) await capture(page,'citadel-'+stage);
    assert.equal(await page.locator('.fate-stream').evaluate(n=>getComputedStyle(n).animationName),'none');
    assert.equal(await glass.getAttribute('data-complete'),String(stage==='complete'));
    assert(Number(await page.locator('#fate-sand-bottom').getAttribute('height')) > 0);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Chains calendar, settlement, UI, offline restore and clock stages');
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
