/* The same journal drives the task, Path and profile surfaces. */
(function (root) {
  'use strict';
  const model = root.VkachChains;
  const $ = id => document.getElementById(id);
  const colors = [[0, 135, 206, 127], [.24, 156, 209, 102], [.49, 214, 212, 107],
    [.66, 239, 185, 86], [.85, 242, 126, 67], [.97, 233, 80, 86], [1, 150, 49, 62]];
  function sandColor(ratio) {
    const i = Math.max(1, colors.findIndex(c => c[0] >= ratio));
    const [a, r, g, b] = colors[i - 1], [z, ...next] = colors[i];
    const t = (ratio - a) / (z - a);
    return 'rgb(' + [r, g, b].map((n, j) => Math.round(n + (next[j] - n) * t)).join(' ') + ')';
  }
  const glass = `<svg viewBox="0 0 64 88" aria-hidden="true">
    <defs><clipPath id="fate-glass-mask"><path d="M20 11h24v8c0 8-10 14-10 20s10 10 10 20v8H20v-8c0-10 10-14 10-20S20 27 20 19z"/></clipPath>
    <linearGradient id="fate-stone"><stop stop-color="#24243d"/><stop offset=".45" stop-color="#64617d"/><stop offset="1" stop-color="#222239"/></linearGradient>
    <linearGradient id="fate-metal"><stop stop-color="#584153"/><stop offset=".49" stop-color="#dfb384"/><stop offset="1" stop-color="#564152"/></linearGradient></defs>
    <path d="M11 86v-7h6v-6h30v6h6v7z" fill="url(#fate-stone)" stroke="#94849d"/>
    <path d="M13 80h38M19 75h26M21 80v6m17-6v6" stroke="#93829b" opacity=".7"/>
    <path d="M17 13v54m30-54v54M13 9h38v5H13zm0 57h38v6H13z" fill="url(#fate-metal)" stroke="url(#fate-metal)" stroke-width="2"/>
    <path d="M20 11h24v8c0 8-10 14-10 20s10 10 10 20v8H20v-8c0-10 10-14 10-20S20 27 20 19z" fill="#15172a" stroke="#c6bcd8" stroke-width="1.5"/>
    <g clip-path="url(#fate-glass-mask)" class="fate-sand">
      <rect id="fate-sand-top" x="19" width="26"/><rect id="fate-sand-bottom" x="19" width="26"/>
      <path class="fate-stream" d="M32 38v29" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
    </g>
    <path d="M23 15v5q1 7 6 11m8 18q4 6 4 12" fill="none" stroke="#f9edf6" opacity=".55"/>
    <path class="fate-frost" d="M13 9h12l-3 3-3-1-3 4-3-2m3 65h12l4 2 9-2h7l2 4H14z" fill="#dcf2ff"/>
    <g class="fate-stars" fill="#e7c5ff"><path d="m7 25 2 4-2 4-2-4zm48 17 2 4-2 4-2-4z"/><circle cx="53" cy="19" r="1"/></g>
  </svg>`;
  const cigarette = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 14h18v4H3z" fill="#dad0d9" stroke="#bda4bd"/><path d="M3 14h6v4H3z" fill="#ad7d58"/><path d="M19 14h2v4h-2z" fill="#e4a568"/><path d="M20 11c3-4-5-3-2-7" fill="none" stroke="#b8a0bd" stroke-linecap="round"/></svg>';
  const pretty = key => key.split('-').reverse().join('.');
  const signed = n => n < 0 ? '−' + Math.abs(n) : '+' + n;
  const fmt = new Intl.NumberFormat('ru', { maximumFractionDigits: 1 });
  const times = new Intl.DateTimeFormat('ru', { timeZone: model.zone, hour: '2-digit', minute: '2-digit' });
  const create = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  function button(text, action, cls = 'btn') {
    const node = create('button', text, cls);
    node.type = 'button';
    node.onclick = action;
    return node;
  }
  function makeDialog(id, title) {
    const dialog = create('dialog', undefined, 'chains-dialog');
    dialog.id = id;
    const head = create('header'), label = create('strong', title);
    label.id = id + '-title';
    dialog.setAttribute('aria-labelledby', label.id);
    const close = button('✕', () => dialog.close());
    close.setAttribute('aria-label', 'Закрыть');
    head.append(label, close);
    const content = create('div', undefined, 'chains-content');
    dialog.append(head, content);
    document.body.append(dialog);
    return { dialog, content };
  }
  const settingsTitle = 'Настройки испытания';
  let db, enqueue, events = [], prefs = {}, data, currentDate, refreshHero, refreshOverview;
  let quick, quickPanel, quickCount, undo, undoTimer, undoId, stat, statDate, statsBody, statsSummary;
  let settings, watch, clockDetail, clockSeen, clockPending;
  let renderQueued = false;
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    Promise.resolve().then(() => {
      renderQueued = false;
      render();
      refreshOverview?.();
    });
  }
  function connect(database, queue, onProgress, onOverview) {
    db = database;
    enqueue = queue;
    refreshHero = onProgress;
    refreshOverview = onOverview;
    $('chains-settings-open').onclick = openSettings;
    db.doc('cfg/fate-clock').onSnapshot(snapshot => {
      const seen = !!snapshot.data()?.finished;
      if (seen !== clockSeen) { clockSeen = seen; requestRender(); }
    });
    db.doc(model.awardsPath).onSnapshot(snapshot => {
      const next = snapshot.data() || {};
      if (JSON.stringify(awards) !== JSON.stringify(next)) { awards = next; requestRender(); refreshHero(); }
    });
    let eventSignature;
    db.collection(model.collection).onSnapshot(snapshot => {
      const rows = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      const signature = JSON.stringify(rows);
      if (signature === eventSignature) return;
      eventSignature = signature;
      const previous = progressData?.byDay;
      events = rows;
      data = undefined;
      const next = getProgress().byDay;
      requestRender();
      if (JSON.stringify(previous) !== JSON.stringify(next)) refreshHero();
    });
    db.doc(model.prefs).onSnapshot(snapshot => {
      const next = snapshot.data() || {};
      if (JSON.stringify(next) !== JSON.stringify(prefs)) { prefs = next; requestRender(); }
    });
  }
  function mountQuick(home, dock) {
    quickPanel = create('div', undefined, 'chains-quick');
    quickPanel.hidden = true;
    new MutationObserver(updateClock).observe(home, { attributes: true, attributeFilter: ['data-ui-view','open'] });
    quick = button('', () => addSmoke(model.today()), 'chains-medallion');
    quick.innerHTML = cigarette;
    quickCount = create('span', '0', 'chains-quick-count');
    quick.append(quickCount);
    undo = button('Отменить', undoLast, 'chains-undo');
    undo.hidden = true;
    const added = create('span', '+1', 'chains-added');
    added.hidden = true;
    added.setAttribute('aria-hidden', 'true');
    quickPanel.append(undo, quick, added);
    home.insertBefore(quickPanel, dock);
  }
  function hideUndo() {
    if (!undo) return;
    undo.hidden = true;
    undoId = null;
    quickPanel.querySelector('.chains-added').hidden = true;
    const dailyUndo = $('chains-daily-undo');
    if (dailyUndo) dailyUndo.hidden = true;
  }
  function undoLast() {
    const id = undoId;
    if (id) voidEvent(id).then(() => { if (undoId === id) hideUndo(); }, () => {});
  }
  function addEvent(kind, date, fields = {}, id = crypto.randomUUID()) {
    if (!db || !model.validDate(date) || date < model.start || date > model.today()) return Promise.resolve(null);
    const at = Date.now();
    return enqueue(() => db.runTransaction(tx => {
      const path = model.collection + '/' + id;
      if (!tx.get(path) || kind === 'confirm') tx.set(path, { kind, date, at, ...fields });
      if (!tx.get(model.prefs)) tx.set(model.prefs, { start: model.start, side: 'right' });
    })).then(() => id);
  }
  function addSmoke(date) {
    addEvent('smoke', date).then(id => {
      if (!id || !quick || date !== model.today()) return;
      undoId = id;
      undo.hidden = false;
      quickPanel.querySelector('.chains-added').hidden = false;
      const dailyUndo = $('chains-daily-undo');
      if (dailyUndo) dailyUndo.hidden = false;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(hideUndo, 6500);
    }, () => {});
  }
  function voidEvent(id) {
    return enqueue(() => db.runTransaction(tx => {
      const path = model.collection + '/' + id, entry = tx.get(path);
      if (entry && !entry.voidAt) tx.set(path, { ...entry, voidAt: Date.now() });
    }));
  }
  const observed = row => row && (row.count > 0 || row.confirmed);
  function progress(value, max, label) {
    const bar = create('progress');
    bar.max = max || 1;
    bar.value = Math.min(bar.max, value);
    bar.setAttribute('aria-label', label);
    return bar;
  }
  function render() {
    updateClock();
    if (!db || !$('chains-daily')) return;
    const progression = getProgress();
    const active = currentDate >= model.start;
    const row = data.days[currentDate], n = row?.count || 0, limit = model.limit(currentDate);
    if (quick) {
      quickPanel.hidden = !active;
      quickPanel.dataset.side = prefs.side === 'left' ? 'left' : 'right';
      quickCount.textContent = n;
      quick.setAttribute('aria-label', 'Записать сигарету. Сегодня ' + n + ' из ' + limit);
      quick.title = quick.getAttribute('aria-label');
    }
    const daily = $('chains-daily'), goal = $('chains-goal'), profile = $('chains-profile');
    for (const section of [daily, goal, profile]) section.hidden = !active;
    if (!active) return;
    const status = !observed(row) ? 'День пока не подтверждён' : n > limit ? 'Лимит превышен · награды за день нет' : 'В пределах лимита';
    const reward = model.dayShards(n, currentDate, progression.aspect);
    const dailyUndo = button('Отменить', undoLast);
    dailyUndo.id = 'chains-daily-undo';
    dailyUndo.hidden = !undoId;
    const confirm = button('Подтвердить ноль', () => {
      const date = model.today();
      addEvent('confirm', date, {}, 'confirm-' + date).catch(() => {});
    });
    confirm.hidden = !!observed(row);
    const actions = create('div', undefined, 'row chains-task-actions');
    actions.append(button('+ Сигарета', () => addSmoke(model.today())), confirm, button('Дневник и исправления', openStats), dailyUndo);
    daily.replaceChildren(create('strong', 'Разрыв оков'), create('p', 'Неделя ' + model.week(currentDate) + ' · Сегодня ' + n + ' / ' + limit),
      progress(n, limit, 'Сигареты сегодня'), create('p', status, n > limit ? 'chains-over' : 'hint'),
      create('p', '+' + reward + ' осколок' + (reward === 1 ? '' : 'а') + ' за закрытый день в пределах лимита · +' + model.weekReward + ' за неделю в пределах лимита', 'hint'), actions);
    const pct = Math.round((15 - limit) / 15 * 100);
    goal.replaceChildren(create('strong', 'Снизить количество сигарет до нуля'),
      create('p', 'План · ' + pct + '% · лимит ' + limit + ' из исходных 15'),
      progress(15 - limit, 15, 'План снижения дневного лимита'),
      create('p', 'Факт сегодня · ' + (observed(row) ? n : 'нет данных') + ' · Нулевой лимит с ' + pretty(model.zero), 'hint'),
      create('p', 'В среднем за учтённые дни последних двух недель · ' + (data.mean === null ? 'нет данных' : fmt.format(data.mean)), 'hint'),
      chart(14), create('p', 'Янтарный — план · Фиолетовый — факт', 'hint'), button('История и график', openStats));
    profile.dataset.stage = data.stage;
    const profileActions = create('div', undefined, 'chains-profile-actions');
    profileActions.append(button('Статистика', openStats));
    profile.replaceChildren(create('strong', 'Разрыв оков'), create('p', 'Сегодня ' + n + ' / ' + limit + ' · Неделя ' + model.week(currentDate)),
      create('p', ['Оковы', 'Преодоление', 'Освобождение'][data.stage - 1] + ' · Успешных дней ' + data.success),
      profileActions);
    if (stat?.dialog.open) renderStats();
    syncProgress();
  }

  let awards = {}, awarding = false, progressData;
  function getProgress() {
    const date = model.today();
    if (!data || date !== currentDate || progressData.ledger !== awards) {
      const rolledOver = !!currentDate && date !== currentDate;
      currentDate = date;
      data = model.summarize(events, date);
      progressData = { ...model.progression(data, awards, date), ledger: awards };
      if (rolledOver) { requestRender(); refreshHero?.(); }
    }
    return progressData;
  }
  function recordedCount(date) {
    getProgress();
    const row = data.days[date];
    return observed(row) ? row.count : null;
  }
  function todayStatus() {
    getProgress();
    const limit = model.limit(currentDate);
    return limit === null ? null : { count: data.days[currentDate]?.count || 0, limit };
  }
  function syncProgress() {
    if (awarding || !model.pendingAwards(data, currentDate, awards).length) return;
    awarding = true;
    enqueue(() => db.runTransaction(tx => {
      const date = model.today();
      const existing = tx.get(model.awardsPath) || {};
      const latest = model.summarize(tx.list(model.collection), date);
      const earned = model.pendingAwards(latest, date, existing);
      if (earned.length) tx.set(model.awardsPath, { ...existing, ...Object.fromEntries(earned.map(id => [id, date])) });
    })).then(() => {
      awarding = false;
      if (model.pendingAwards(data, currentDate, awards).length) setTimeout(requestRender, 0);
    }, () => { awarding = false; });
  }

  function chart(length) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 310 97');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Динамика. Янтарная линия — лимит, фиолетовая — фактические записи. Пропуски обозначают отсутствие данных.');
    svg.classList.add('chains-chart');
    const dates = Array.from({ length }, (_, i) => model.shift(currentDate, i + 1 - length)).filter(date => date >= model.start);
    const max = Math.max(15, ...dates.map(date => data.days[date]?.count || 0));
    const y = n => 77 - 62 * n / max;
    function shape(tag, attrs) {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.append(n);
      return n;
    }
    for (const n of [0, 5, 10, 15]) {
      shape('path', { d: 'M22 ' + y(n) + 'H304', class: 'chains-chart-grid' });
      shape('text', { x: 1, y: y(n) + 3 }).textContent = n;
    }
    const x = i => 24 + 278 * i / Math.max(1, dates.length - 1);
    const plan = dates.map((date, i) => (i ? 'H' + x(i) + 'V' : 'M' + x(i) + ' ') + y(model.limit(date))).join(' ');
    shape('path', { d: dates.length === 1 ? plan + 'H302' : plan, class: 'chains-chart-plan' });
    let previous = false, fact = '';
    dates.forEach((date, i) => {
      const day = data.days[date], visible = observed(day);
      if (visible) {
        fact += (previous ? 'L' : 'M') + x(i) + ' ' + y(day.count) + ' ';
        shape('circle', { cx: x(i), cy: y(day.count), r: 2.4, class: 'chains-chart-dot' });
      }
      previous = visible;
    });
    shape('path', { d: fact, class: 'chains-chart-fact' });
    if (dates.length) {
      shape('text', { x: 23, y: 92 }).textContent = pretty(dates[0]).slice(0, 5);
      if (dates.length > 1) shape('text', { x: 274, y: 92 }).textContent = pretty(currentDate).slice(0, 5);
    }
    return svg;
  }

  function openStats() {
    if (!stat) {
      stat = makeDialog('chains-stat', 'Разрыв оков');
      statsSummary = create('div');
      const picker = create('label', 'Дневник за дату ');
      statDate = create('input');
      statDate.type = 'date';
      statDate.min = model.start;
      statDate.onchange = renderStats;
      picker.append(statDate);
      statsBody = create('div');
      stat.content.append(statsSummary, picker, statsBody, button(settingsTitle, openSettings));
    }
    statDate.max = statDate.value = model.today();
    renderStats();
    if (!stat.dialog.open) stat.dialog.showModal();
  }
  function renderStats() {
    const today = data.days[currentDate], limit = model.limit(currentDate);
    const mk = model.monday(currentDate), month = currentDate.slice(0, 7);
    const weekRows = Object.entries(data.days).filter(([key, row]) => key >= mk && observed(row));
    const monthRows = Object.entries(data.days).filter(([key, row]) => key.startsWith(month) && observed(row));
    const count = rows => rows.reduce((sum, [, row]) => sum + row.count, 0);
    const days = data.success, free = data.free;
    const metrics = create('div', undefined, 'chains-metrics');
    for (const [title, value] of [['Сегодня', (observed(today) ? today.count : '—') + ' / ' + limit], ['За неделю', weekRows.length ? count(weekRows) : '—'],
      ['За месяц', monthRows.length ? count(monthRows) : '—'], ['В день за месяц', monthRows.length ? fmt.format(count(monthRows) / monthRows.length) : '—'],
      ['Успешные дни', days], ['Дни без сигарет', free]]) {
      const cell = create('div', title);
      cell.prepend(create('strong', value));
      metrics.append(cell);
    }
    statsSummary.replaceChildren(metrics, chart(30), create('p', 'Янтарный — план · Фиолетовый — факт', 'hint'));
    if (prefs.price > 0 && prefs.pack > 0 && monthRows.length) {
      const closed = monthRows.filter(([date]) => date < currentDate);
      if (closed.length) {
        const saving = (closed.length * 15 - count(closed)) * prefs.price / prefs.pack;
        statsSummary.append(create('p', (saving >= 0 ? 'Экономия за учтённые дни месяца ' : 'Перерасход за учтённые дни месяца ') + fmt.format(Math.abs(saving)) + ' ₽', 'hint'));
      }
    }
    const date = statDate.value;
    if (!model.validDate(date) || date < model.start || date > currentDate) { statsBody.replaceChildren(); return; }
    const entry = data.days[date], n = entry?.count || 0;
    statsBody.replaceChildren(create('p', (observed(entry) ? n : 'Нет записи') + ' · Лимит ' + model.limit(date)));
    if (date < currentDate && observed(entry)) {
      const passed = data.completed.includes(date);
      statsBody.append(create('p', passed ? 'День закрыт в пределах лимита' : 'День закрыт с превышением', passed ? 'hint' : 'chains-over'));
    }
    statsBody.append(button('+ Сигарета', () => addSmoke(date)));
    if (!n && !entry?.confirmed) statsBody.append(button('Подтвердить 0 сигарет', () => addEvent('confirm', date, {}, 'confirm-' + date).catch(() => {})));
    if (!n && entry?.confirmed) statsBody.append(button('Снять подтверждение нуля', () => voidEvent('confirm-' + date).catch(() => {})));
    for (const event of (entry?.events || []).slice().sort((a,b) => b.at - a.at)) {
      const item = create('div', undefined, 'chains-log-row');
      const label = Number.isFinite(event.at) && model.today(event.at) === date
        ? 'Сигарета · ' + times.format(event.at)
        : 'Сигарета · добавлено позже';
      item.append(create('span', label), button('Убрать запись', () => voidEvent(event.id).catch(() => {})));
      statsBody.append(item);
    }
    const craving = create('select');
    craving.setAttribute('aria-label', 'Причина тяги');
    craving.append(new Option('Без причины', ''));
    for (const reason of model.reasonOptions) craving.append(new Option(reason, reason));
    const log = create('div', undefined, 'chains-log-row');
    log.append(craving, button('Пережил тягу', () => addEvent('craving', date, { reason: craving.value }).catch(() => {})));
    statsBody.append(log);
    for (const event of entry?.cravings || []) {
      const item = create('div', undefined, 'chains-log-row');
      item.append(create('span', 'Пережил тягу' + (event.reason ? ' · ' + event.reason : '')), button('Убрать', () => voidEvent(event.id).catch(() => {})));
      statsBody.append(item);
    }
  }

  function openSettings() {
    settings ??= makeDialog('chains-settings', settingsTitle);
    const form = create('form');
    const side = create('select');
    side.append(new Option('Справа', 'right'), new Option('Слева', 'left'));
    side.value = prefs.side || 'right';
    const price = create('input'), pack = create('input');
    price.type = pack.type = 'number';
    price.min = 0; price.step = '.01'; price.max = 100000;
    pack.min = 1; pack.max = 1000;
    price.value = prefs.price || '';
    pack.value = prefs.pack || 20;
    const submit = create('button', 'Сохранить', 'btn');
    for (const [label, control] of [['Кнопка в Цитадели', side], ['Цена пачки, ₽', price], ['Сигарет в пачке', pack]]) {
      const field = create('label', label); field.append(control); form.append(field);
    }
    form.append(submit);
    form.onsubmit = event => {
      event.preventDefault();
      submit.disabled = true;
      enqueue(() => db.doc(model.prefs).set({ start: model.start, side: side.value, price: price.valueAsNumber || 0, pack: pack.valueAsNumber || 20 }))
        .then(() => settings.dialog.close(), () => {}).finally(() => { submit.disabled = false; });
    };
    settings.content.replaceChildren(form);
    settings.dialog.showModal();
  }

  function updateClock() {
    const node = $('fate-hourglass');
    if (!node) return;
    if (!node.firstChild) {
      node.innerHTML = glass;
      node.onclick = () => {
        watch ??= makeDialog('fate-clock-dialog', 'Песочные часы судьбы');
        clockDetail = watch.content;
        if (!watch.dialog.open) watch.dialog.showModal();
        updateClock();
      };
    }
    const time = model.clock();
    node.dataset.started = String(model.today() >= model.start);
    const remaining = 1 - time.ratio;
    node.style.setProperty('--sand', sandColor(time.ratio));
    const top = $('fate-sand-top'), bottom = $('fate-sand-bottom');
    // Each chamber is tapered. Approximate equal change in volume by adjusting the fill height.
    const topHeight = 28 * (1 - Math.sqrt(time.ratio)), bottomHeight = 28 * (1 - Math.sqrt(remaining));
    top.setAttribute('y', 39 - topHeight); top.setAttribute('height', topHeight);
    bottom.setAttribute('y', 67 - bottomHeight); bottom.setAttribute('height', bottomHeight);
    node.dataset.complete = String(time.complete);
    node.dataset.urgent = String(remaining <= .1 && !time.complete);
    if (time.complete && clockSeen === false && !clockPending && db && !document.hidden &&
        $('citadel-home').open && $('citadel-home').dataset.uiView === 'overview') {
      node.classList.add('fate-finished');
      clockPending = true;
      enqueue(() => db.doc('cfg/fate-clock').set({ finished: model.end })).catch(() => {}).finally(() => { clockPending = false; });
    }
    node.title = 'Песочные часы судьбы · осталось ' + time.left + ' дн.';
    if (clockDetail && watch?.dialog.open) {
      const meter = progress(time.ratio, 1, 'Прошедшее время');
      meter.style.accentColor = sandColor(time.ratio);
      clockDetail.replaceChildren(
        create('p', pretty(model.start) + ' — ' + pretty(model.end) + ' · Москва'),
        create('p', 'Прошло ' + time.gone + ' дн. · Осталось ' + time.left + ' дн. · ' + fmt.format(time.ratio * 100) + '%'),
        meter,
        create('p', time.complete ? 'Последняя песчинка упала. Заклятие запомнило твой путь.' : 'Песок продолжает сыпаться, даже пока Цитадель спит.', 'hint'));
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
  setInterval(() => { if (!document.hidden) currentDate !== model.today() ? requestRender() : updateClock(); }, 15000);
  root.VkachChainsUI = Object.freeze({ connect, mountQuick, sandColor, getProgress, todayStatus, recordedCount, owned: () => model.owned(awards) });
})(globalThis);
