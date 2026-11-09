import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('android-test');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
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
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true,
    hasTouch: true, timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' });
  await context.route('https://**/*', route => route.fulfill({ body: '', contentType: 'text/css' }));
  const date = '2027-04-16';
  const seed = { 'cfg/opening': { cash: 100, card: 1200 }, 'cfg/citadel': { selectedRoom: 'rest' },
    'cfg/abyss-economy': { version: 1, rank: 1, earned: 1000, claims: {} } };
  for (let n = 0; n < 179; n++) {
    const value = new Date(Date.UTC(2026, 9, 19 + n, 12));
    const day = value.toISOString().slice(0, 10), t = +value;
    seed['days/' + day] = { q: Array(10).fill(true), steps: 50000, kcal: 2100 };
    seed['per/' + day] = { squat: [t, t + 7200000, t + 14400000], pushup: [t, t + 7200000, t + 14400000],
      squatR: [100, 100, 100], pushupR: [100, 100, 100], workout: [t] };
  }
  await context.addInitScript(({ seed }) => {
    localStorage.setItem('plan.android-test.awakening.v1', JSON.stringify({ version: 1, step: 12, status: 'done' }));
    localStorage.setItem('plan.android-test.rebuild-guide.v1', JSON.stringify({ version: 1, step: 2, status: 'done' }));
    if (localStorage.getItem('stage1-qa')) return;
    localStorage.setItem('stage1-qa', 'true');
    localStorage.setItem('wsum', '2027-04-12');
    localStorage.setItem('msum', '2027-04');
    localStorage.setItem('trialSeen', '2027-04-16');
    localStorage.setItem('plan.android-test.store.v1', JSON.stringify({
      v: 1, docs: Object.fromEntries(Object.entries(seed).map(([path, d]) => [path, { d, u: 1 }]))
    }));
  }, { seed });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('PAGE', error.message); });
  await page.clock.install({ time: new Date(date + 'T14:00:00+03:00') });
  const dismiss = () => page.evaluate(() => {
    document.querySelector('#legend-scene[open]')?.close();
    if (!document.querySelector('#achup').hidden) document.querySelector('#ac-ok').click();
    for (const id of ['setup', 'trophy', 'lvup']) document.getElementById(id).hidden = true;
  });
  await page.goto(url);
  await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#citadel-live-rank').textContent !== 'РАНГ …', null, { timeout: 40000 });
  for (let i = 0; i < 7; i++) { await dismiss(); await page.clock.runFor(50); }
  await page.addLocatorHandler(page.locator('#achup:not([hidden]),#legend-scene[open],#lvup:not([hidden])').first(), dismiss, { noWaitAfter: true });

  const openRoom = async name => {
    const node = page.locator('[data-croom="' + name + '"]');
    assert.equal(await node.getAttribute('aria-disabled'), 'false');
    await node.click();
    await page.waitForFunction(name => document.querySelector('#citadel-interior-stage').dataset.room === name &&
      document.querySelector('#citadel-home').dataset.uiView === 'room', name);
  };
  const backToMap = async () => {
    await page.locator('#citadel-interior-close').click();
    await page.waitForFunction(() => document.querySelector('#citadel-home').dataset.uiView === 'overview');
  };
  const docValues = prefixes => page.evaluate(prefixes => Object.fromEntries(Object.entries(PlanSync._docs())
    .filter(([key]) => prefixes.some(prefix => key.startsWith(prefix))).map(([key, row]) => [key, row.d])), prefixes);
  const entries = name => page.locator('#food').getByRole('button', { name, exact: true });
  const byLabel = label => page.locator('#food').getByLabel(label, { exact: true });
  const group = name => page.locator('#food section').filter({ has: page.locator('strong', { hasText: new RegExp('^' + name + '$') }) }).first();
  const add = async meal => {
    await group(meal).getByRole('button', { name: /Добавить|Продолжить черновик/ }).click();
    await byLabel('Название').first().waitFor();
  };
  const openFood = () => page.locator('.citadel-room-primary').click();
  const closeFood = async () => {
    await page.locator('.citadel-system-dialog header button').first().click();
    await page.waitForFunction(() => history.state?.citadelOverlay !== 'system');
  };
  const saveMeal = async () => {
    await entries('Сохранить приём пищи').evaluate(node => { node.click(); node.click(); });
    await page.locator('#food .food-status').filter({ hasText: 'Приём пищи сохранён' }).waitFor();
  };
  async function fill(item, index = 0) {
    await byLabel('Название').nth(index).fill(item.name);
    await byLabel('Масса порции, г').nth(index).fill(item.grams);
    await byLabel('Способ учёта').nth(index).selectOption(item.mode);
    if (item.kcal != null) await byLabel('ккал').nth(index).fill(item.kcal);
    if (item.mode === 'exact') {
      for (const [label, value] of [['Белки', '10'], ['Жиры', '0'], ['Углеводы', '12']]) await byLabel(label).nth(index).fill(value);
    }
  }

  assert.equal(await page.locator('[data-croom]').count(), 10);
  assert.equal(await page.locator('.citadel-today-values span').count(), 3);
  await page.locator('.citadel-map-camera > summary').click();
  await page.getByLabel('Ярус', { exact: true }).selectOption('3');
  assert.equal(await page.getByLabel('Ярус', { exact: true }).locator('option').count(), 6);
  await openRoom('gatehouse');
  await page.getByRole('button', { name: 'Осмотр', exact: true }).click();
  assert.equal(await page.locator('#citadel-interior-stage').getAttribute('data-inspect'), 'true');
  await page.locator('.citadel-room-more summary').first().click();
  assert(await page.locator('#citadel-exits').isVisible());
  assert(await page.locator('#shelter-collection').isVisible());
  assert(await page.locator('[data-room-moment]').isVisible());
  const target = await page.locator('[data-stage-door]').first().getAttribute('data-stage-door');
  await page.locator('[data-stage-door]').first().click();
  await page.waitForFunction(id => document.querySelector('#citadel-interior-stage').dataset.room === id, target);
  await backToMap();
  await page.getByRole('button', { name: 'Все разделы игры' }).click();
  assert.equal(await page.locator('.citadel-pins button').count(), 4);
  assert.equal(await page.locator('.citadel-all-functions').getAttribute('open'), null);
  await page.getByRole('searchbox', { name: 'Поиск по Вкачу' }).fill('трапезная');
  await page.locator('.citadel-search-results button').filter({ hasText: 'Трапезная' }).click();
  await page.waitForFunction(() => document.querySelector('#citadel-interior-stage').dataset.room === 'refectory');
  assert.match(await page.locator('.citadel-refectory-calories').textContent(), /2\s500/);
  assert(!(await page.locator('#citadel-exits').isVisible()));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const scene = document.querySelector('#citadel-interior-stage').getBoundingClientRect();
    const primary = document.querySelector('.citadel-room-primary').getBoundingClientRect();
    return scene.width > 300 && scene.bottom <= innerHeight + 1 && primary.bottom <= innerHeight && primary.left >= scene.right;
  });
  await page.setViewportSize({ width: 360, height: 800 });
  console.log('Mobile map, room inspection, doors, search and landscape room verified');
  const preserved = await docValues(['days/', 'per/', 'tx/', 'cfg/opening', 'buys/']);
  await page.locator('#citadel-interior-object').click();
  await byLabel('Дневник заполнен').waitFor();
  assert(!(await page.locator('.citadel-shell-dock').evaluate(node => node.closest('dialog')?.open)));
  await add('Завтрак');
  await fill({ name: 'Каша тестовая', grams: '50,5', mode: 'exact', kcal: '200' });
  await entries('Своя позиция').click();
  await fill({ name: 'Фрукт тестовый', grams: '120', mode: 'estimate', kcal: '50' }, 1);
  await saveMeal();
  assert.match(await page.locator('#food').innerText(), /Записано ≈ 161/);
  await add('Ужин');
  await fill({ name: 'Готовое блюдо тестовое', grams: '150', mode: 'unknown' });
  await closeFood();
  await page.waitForFunction(() => Object.entries(PlanSync._docs()).some(([key, row]) =>
    key.startsWith('food-drafts/') && row.d?.items[0]?.name === 'Готовое блюдо тестовое'));
  await openFood();
  await add('Обед');
  await fill({ name: 'Отдельный черновик', grams: '30', mode: 'unknown' });
  await closeFood();
  await page.waitForFunction(() => Object.entries(PlanSync._docs()).filter(([key, row]) => key.startsWith('food-drafts/') && row.d).length === 2);

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#citadel-home').dataset.uiView === 'room');
  await openFood();
  await add('Ужин');
  assert.equal(await byLabel('Название').inputValue(), 'Готовое блюдо тестовое');
  await saveMeal();
  assert.match(await page.locator('#food').innerText(), /Итог дня неизвестен/);
  console.log('Drafts resumed and saved after an offline reload');
  await closeFood();
  await page.locator('.citadel-shell-dock [data-section="today"]').click();
  assert(!(await page.locator('#kcal-from-food').isVisible()));
  await page.goBack();
  await openFood();
  if (await group('Ужин').locator('.food-meal').getAttribute('open') === null) {
    await group('Ужин').locator('.food-meal > summary').click();
  }
  await entries('Удалить').click();
  await entries('Отменить удаление').click();
  await page.locator('#food .food-status').filter({ hasText: 'восстановлен' }).waitFor();
  assert.deepEqual(await docValues(['days/', 'per/', 'tx/', 'cfg/opening', 'buys/']), preserved);

  await entries('Продукты').click();
  await entries('Создать продукт').click();
  await byLabel('Название').fill('Овсянка тестовая');
  for (const [label, value] of [['ккал', '300'], ['Белки', '12'], ['Жиры', '5'], ['Углеводы', '53']]) await byLabel(label).fill(value);
  await entries('Сохранить').click();
  await page.locator('#food .food-status').filter({ hasText: 'Сохранено в продуктах' }).waitFor();
  await entries('Создать рецепт').click();
  await byLabel('Название').fill('Домашняя каша');
  await byLabel('Способ приготовления').selectOption('cooked');
  await byLabel('Из продуктов и рецептов').selectOption({ label: 'Овсянка тестовая' });
  await byLabel('Вес до приготовления, г').fill('100');
  await byLabel('Итоговый приготовленный вес, г').fill('250');
  await entries('Сохранить').click();
  await page.locator('#food .food-status').filter({ hasText: 'Сохранено в продуктах' }).waitFor();

  await entries('История').click();
  await byLabel('Дата дневника').fill('2027-04-15');
  await byLabel('Дата дневника').dispatchEvent('change');
  await add('Завтрак');
  await entries('Убрать').click();
  await byLabel('Из продуктов и рецептов').selectOption({ label: 'Домашняя каша' });
  await byLabel('Масса порции, г').fill('125');
  await saveMeal();
  assert.match(await page.locator('#food').innerText(), /Записано 150/);
  await byLabel('Дневник заполнен').check();
  await entries('Сегодня').click();
  await group('Завтрак').getByRole('button', { name: 'Повторить приём от 15.04.2027' }).click();
  assert.equal(await byLabel('Масса порции, г').inputValue(), '125');
  await entries('Удалить черновик').click();
  await page.locator('#food .food-status').filter({ hasText: 'Черновик удалён' }).waitFor();
  assert.deepEqual(await docValues(['days/', 'per/', 'tx/', 'cfg/opening', 'buys/']), preserved);

  await closeFood();
  const beforeBackup = await docValues(['food-', 'days/', 'per/', 'cfg/opening']);
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => PlanSync.exportBackup());
  const download = await downloadPromise;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(backup.format, 'vkach-backup');
  assert(Object.keys(backup.docs).some(key => key.startsWith('food-events/')));
  assert(Object.keys(backup.docs).some(key => key.startsWith('food-drafts/')));
  await page.evaluate(() => PlanDB.doc('food-days/2027-04-15').delete());
  await page.evaluate(backup => PlanSync.importObj(backup, true), backup);
  assert.deepEqual(await docValues(['food-', 'days/', 'per/', 'cfg/opening']), beforeBackup);
  await openFood();
  if (await group('Ужин').locator('.food-meal').getAttribute('open') === null) {
    await group('Ужин').locator('.food-meal > summary').click();
  }
  await entries('Удалить').click();
  await page.locator('#food .food-status').filter({ hasText: 'Приём пищи удалён' }).waitFor();
  await closeFood();
  await page.locator('.citadel-shell-dock [data-section="today"]').click();
  await page.locator('#kcal-from-food').click();
  await page.waitForFunction(date => PlanSync._docs()['days/' + date]?.d.kcal === 161, date);
  const afterTransfer = await docValues(['days/', 'per/', 'tx/', 'cfg/opening', 'buys/']);
  assert.deepEqual(afterTransfer, { ...preserved, ['days/' + date]: { ...preserved['days/' + date], kcal: 161 } });
  await page.goBack();
  console.log('Food UI: offline edits, restored backup and explicit calorie transfer verified');

  await backToMap();
  await openRoom('forge');
  await page.locator('.citadel-room-primary').click();
  assert(await page.locator('#fate-forge-dialog').isVisible());
  await page.goBack();
  assert(!(await page.locator('#fate-forge-dialog').isVisible()));
  await backToMap();
  const residents = page.locator('.citadel-map-tools').getByRole('button', { name: 'Жители', exact: true });
  await residents.click();
  assert(await page.locator('#citadel-residents button').count() >= 4);
  await page.goBack();
  assert(await page.locator('.citadel-viewport').isVisible());
  for (let visit = 0; visit < 2; visit++) {
    await openRoom('observatory');
    const actor = page.locator('#citadel-interior-stage .citadel-person[data-person="guardian"]');
    await actor.click();
    const panel = page.locator('#citadel-room-conversation');
    await panel.waitFor({ state: 'visible' });
    assert.match(await panel.innerText(), /Страж Цитадели/);
    assert.equal(await panel.evaluate(node => getComputedStyle(node).position), 'absolute');
    assert.equal(await page.locator('.citadel-person[data-person="guardian"]:visible').count(), 1);
    await page.goBack();
    await panel.waitFor({ state: 'hidden' });
    assert(await actor.isVisible());
    await backToMap();
    assert.equal(await page.locator('.citadel-person[data-person="guardian"]:visible').count(), 1);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log('Stage I mobile PWA: rooms, sections, offline diary and recipes, old records, backups and Forge verified');
  await context.close();
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
