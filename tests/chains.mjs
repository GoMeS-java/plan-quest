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
const settle = events => model.summarize(events, [], [], '2026-11-09');
assert.equal(settle(confirmed).will, 6);
assert.equal(settle(confirmed.slice(1)).will, 2);
const exceed = Array.from({length:16}, () => ({date: model.start, kind:'smoke'}));
assert.equal(settle([...confirmed, ...exceed]).will, -2);
exceed[0].voidAt = 1;
assert.equal(settle([...confirmed, ...exceed]).will, 6);
assert.deepEqual(settle(confirmed).journal, settle(confirmed).journal);
const body = model.summarize([], [{ id: '2026-11-09', nutrition:{label:'Питание',days:[0,1]}, activity:{label:'Прогулка',days:[0,1]} }],
  [{id:'2026-11-09', nutrition:'done', activity:'excused'}, {id:'2026-11-10',nutrition:'missed',activity:'done'}], '2026-11-16');
assert.equal(body.will, 0);
assert.equal(body.journal.length, 3);
const bodyPassed = model.summarize([], [{id:'2026-11-09', activity:{label:'Прогулка',days:[0,1]}}],
  [{id:'2026-11-09',activity:'done'}, {id:'2026-11-10',activity:'excused'}], '2026-11-16');
assert.equal(bodyPassed.will, 4);
const hidden = model.summarize(Array.from({length: 150}, (_, i) => ({date: model.shift(model.start, i),kind:'confirm'})),[],[],'2027-05-06');
const earned = model.pendingAwards(hidden, '2027-05-06', {});
assert(earned.length > 0);
const ledger = Object.fromEntries(earned.map(id => [id, '2027-05-06']));
assert.deepEqual(model.pendingAwards(hidden, '2027-05-06', ledger), []);
assert.deepEqual(model.mergeAwards(ledger, {}), ledger);

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
const capture = (page,name) => page.screenshot({path:resolve(output,'v13-'+name+'.png')});
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
  await glass.screenshot({path:resolve(output,'v13-clock-green.png')});
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
  await page.locator('#chains-daily').screenshot({path:resolve(output,'v13-daily.png')});
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
  await page.locator('#chains-profile').screenshot({path:resolve(output,'v13-profile.png')});
  await page.getByRole('button',{name:'Аспект «Воля»',exact:true}).click();
  await capture(page,'will');
  await page.getByRole('button',{name:'Настроить план питания и активности'}).click();
  await page.locator('#chains-plan input:not([type=checkbox])').last().fill('Прогулка');
  await page.locator('#chains-plan fieldset').last().getByLabel('Сб').check();
  await page.getByRole('button',{name:'Сохранить план'}).click();
  await close(page,'#chains-will');
  await leave(page);
  await page.locator('.citadel-shell-dock button').last().click();
  const pathLink = page.locator('#citadel-shell-nav [data-section=goals]');
  const pathGroup = pathLink.locator('xpath=ancestor::details[1]');
  if (!await pathGroup.getAttribute('open').then(value => value !== null)) await pathGroup.locator('summary').click();
  await pathLink.click();
  await page.locator('#chains-goal').screenshot({path:resolve(output,'v13-goal.png')});
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
  await page.waitForFunction(() => PlanSync._docs()['chains-ledger/2026-11']?.d?.['smoking:2026-11-06']?.value === 1);
  await page.evaluate(async () => {
    const path = 'chains-ledger/2026-11', saved = PlanSync._docs()[path];
    await PlanSync._merge({ docs: { [path]: { u: saved.u + 1, d: {} } } }, { detect: true });
  });
  await page.waitForFunction(() => PlanSync._docs()['chains-ledger/2026-11']?.d?.['smoking:2026-11-06']?.value === 1);

  await context.close();

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
    await glass.screenshot({path:resolve(output,'v13-clock-'+stage+'.png')});
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
