/* Local-only room tools. The game supplies read-only snapshots and its existing ritual action. */
(function (root) {
  'use strict';

  const paths = Object.freeze({ notes: 'room-notes', projects: 'room-projects', recovery: 'room-recovery' });
  const labels = Object.freeze({ observatory: 'Обсерватория', study: 'Кабинет', cloister: 'Ритуалы', rest: 'Восстановление' });
  const metrics = [
    ['food', 'Питание', 'ккал'], ['weight', 'Вес', 'кг'], ['activity', 'Активность', 'шагов'],
    ['habits', 'Ритуалы', '%'], ['tasks', 'Задания', '%'], ['aspects', 'Аспекты', ''],
    ['sleep', 'Сон', 'мин'], ['wellbeing', 'Самочувствие', 'из 5'], ['energy', 'Энергия', 'из 5'], ['smoking', 'Разрыв оков', 'сиг.'], ['finance', 'Финансовые цели', '']
  ];
  const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const dateLabel = key => key.split('-').reverse().join('.');
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, action, className) {
    const el = node('button', text, className);
    el.type = 'button';
    el.onclick = action;
    return el;
  }
  function field(label, control) {
    const el = node('label', label);
    control.setAttribute('aria-label', label);
    el.append(control);
    return el;
  }
  function choice(options, value) {
    const el = node('select');
    for (const [id, label] of options) el.add(new Option(label, id, false, id === value));
    return el;
  }
  function input(type, value, maxLength) {
    const el = node('input');
    el.type = type;
    el.value = value ?? '';
    if (maxLength) el.maxLength = maxLength;
    return el;
  }
  function textarea(value, maxLength) {
    const el = node('textarea');
    el.value = value ?? '';
    el.maxLength = maxLength;
    el.rows = 4;
    return el;
  }
  function daysBack(date, count) {
    const end = Date.parse(date + 'T12:00:00Z');
    return Array.from({length: count}, (_, i) => new Date(end - (count - 1 - i) * 86400000).toISOString().slice(0, 10));
  }
  function rows(records, group) {
    const prefix = paths[group] + '/';
    return Object.entries(records).flatMap(([path, entry]) => {
      const row = entry.d;
      if (!path.startsWith(prefix) || row?.version !== 1 || row.deleted) return [];
      if (group === 'projects' && (typeof row.title !== 'string' || !Array.isArray(row.tasks))) return [];
      if (group === 'notes' && (typeof row.title !== 'string' || typeof row.text !== 'string')) return [];
      if (group === 'recovery' && (!dayPattern.test(row.date) || path !== prefix + row.date)) return [];
      return [{ ...row, id: path.slice(prefix.length) }];
    });
  }
  function write(tx, group, id, expected, values) {
    const path = paths[group] + '/' + id, old = tx.get(path) ?? null;
    if (JSON.stringify(old) !== JSON.stringify(expected)) {
      throw Object.assign(new Error('Запись уже изменилась. Открой её заново.'), { code: 'record_changed' });
    }
    const row = { ...values, version: 1, created: old?.created ?? Date.now(), updated: Date.now() };
    tx.set(path, row);
    return row;
  }
  function duration(record) {
    if (Number.isFinite(record.minutes)) return record.minutes;
    if (!timePattern.test(record.asleep) || !timePattern.test(record.awake)) return null;
    const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    return (1440 + minutes(record.awake) - minutes(record.asleep)) % 1440 || null;
  }
  function average(list) { return list.reduce((sum, row) => sum + row.value, 0) / list.length; }
  function chart(series, dates, unit) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 320 100');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Динамика по записанным дням' + (unit ? ', ' + unit : ''));
    const values = series.map(row => row.value);
    const min = Math.min(...values), max = Math.max(...values);
    const position = row => [
      9 + dates.indexOf(row.date) / Math.max(1, dates.length - 1) * 302,
      88 - (row.value - min) / Math.max(1, max - min) * 76
    ];
    const line = document.createElementNS(svg.namespaceURI, 'polyline');
    line.setAttribute('points', series.map(row => position(row).join(',')).join(' '));
    line.setAttribute('class', 'room-chart-line');
    svg.append(line);
    for (const row of series) {
      const [x,y] = position(row), dot = document.createElementNS(svg.namespaceURI, 'circle');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 2.8);
      const title = document.createElementNS(svg.namespaceURI, 'title');
      title.textContent = dateLabel(row.date) + ' · ' + format.format(row.value) + ' ' + unit;
      dot.append(title);
      svg.append(dot);
    }
    return svg;
  }

  function mount(host, options) {
    const { today, records, transact, gameSeries, goals, study, tasks, rituals, toggleRitual, roomLevel, nutritionGoal, weightGoal } = options;
    let room = '', metric = 'food', range = 7, tab = 'learning', recoveryDate, busy = false, editing = false;
    const body = node('div', null, 'room-work-body');
    const message = node('p', null, 'hint');
    message.setAttribute('role', 'status');
    host.append(body, message);
    const stored = (group,id) => records()[paths[group] + '/' + id]?.d ?? null;
    const report = text => { message.textContent = text; };
    function save(operation, success) {
      if (busy) return;
      busy = true;
      transact(operation).then(success, error => report(error.message || 'Не удалось сохранить.')).finally(() => { busy = false; });
    }
    function remove(group, id, expected, removedText, restoredText) {
      save(tx=>write(tx,group,id,expected,{...expected,deleted:true}),removed=>{
        render();
        message.replaceChildren(node('span',removedText + ' '),button('Отменить',()=>save(
          tx=>write(tx,group,id,removed,{...expected,deleted:false}),()=>{render();report(restoredText);}
        )));
      });
    }
    function card(title, ...children) {
      const view = node('section', null, 'room-work-card');
      view.append(node('strong', title), ...children);
      return view;
    }
    function navigation(items, active, action) {
      const nav = node('nav', null, 'room-work-tabs');
      for (const [id, label] of items) {
        const control = button(label, () => { action(id); report(''); render(); });
        control.setAttribute('aria-pressed', String(id === active));
        nav.append(control);
      }
      return nav;
    }
    function recoverySeries(dates, metric) {
      return rows(records(),'recovery').filter(row => dates.includes(row.date))
        .map(row => ({date:row.date,value:metric==='sleep'?duration(row):metric==='wellbeing'?row.mood:row.energy})).filter(row => row.value != null);
    }
    function analytics() {
      const dates = daysBack(today(), range);
      const activeMetric = metrics.find(item => item[0] === metric);
      const select = choice(metrics, metric);
      select.onchange = () => { metric = select.value; render(); body.querySelector('select')?.focus(); };
      body.append(node('p','Записи Цитадели · сводка за ' + range + ' дней','hint'),
        navigation([[7,'7 дней'],[30,'30 дней']],range,value=>{range=value;}), field('Направление', select));
      if (metric === 'finance') {
        const list = goals();
        body.append(list.length ? card('Текущие цели', ...list.map(row => node('p', row))) :
          card('Финансовые цели', node('p','Пока нет данных для сводки.')));
        return;
      }
      const series = (['sleep','wellbeing','energy'].includes(metric) ? recoverySeries(dates,metric) : gameSeries(metric, dates))
        .filter(row => dates.includes(row.date) && Number.isFinite(row.value)).sort((a,b) => a.date.localeCompare(b.date));
      if (!series.length) {
        body.append(card(activeMetric[1], node('p','За этот период нет записей.')));
        return;
      }
      const unit = activeMetric[2], summary = metric === 'aspects' ? series.length : average(series);
      const trend = series.length < 2 ? 'Для тенденции нужно больше записей.' :
        'Первая запись: ' + format.format(series[0].value) + ' · последняя: ' + format.format(series.at(-1).value);
      const total = card(activeMetric[1], node('p',(metric === 'aspects' ? 'Дней с открытиями: ' : 'Среднее по записям: ') +
        format.format(summary) + (metric !== 'aspects' && unit ? ' ' + unit : '')), node('p',trend,'hint'));
      if (series.some(row=>row.approximate)) total.append(node('p','В сводке есть приблизительные записи.','hint'));
      if (metric === 'food') {
        const target = nutritionGoal();
        total.append(node('p','По текущей цели ' + format.format(target) + ' ккал: ' +
          series.filter(row=>row.value<=target).length + ' из ' + series.length + ' учтённых дней.','hint'));
      }
      body.append(total);
      const detail = node('details', null, 'room-work-card');
      detail.append(node('summary','График и записи'), chart(series, dates, unit));
      const history = node('ul');
      for (const row of series.slice().reverse()) {
        history.append(node('li', dateLabel(row.date) + ' · ' + (row.approximate ? '≈ ' : '') + format.format(row.value) + (unit ? ' ' + unit : '')));
      }
      detail.append(history);
      body.append(detail);
      if (roomLevel('observatory') >= 2 && ['weight','activity','sleep','food','habits','tasks','smoking'].includes(metric)) {
        const measured = series.filter(row=>!row.approximate);
        const last = measured.at(-1);
        const gap = measured.length && dates.indexOf(last.date) - dates.indexOf(measured[0].date);
        let estimate = 'Для оценки нужно больше записей за разные дни.', eta = '';
        if (measured.length >= 5 && gap >= 4) {
          const rate = (last.value - measured[0].value) / gap;
          const next = last.value + rate * 7;
          const maximum = ['habits','tasks'].includes(metric)?100:metric==='sleep'?1440:Infinity;
          if (next >= 0 && next <= maximum) estimate = 'Если тенденция сохранится, через неделю: около ' + format.format(next) + ' ' + unit + '.';
          if (metric === 'weight' && rate) {
            const remaining = Math.ceil((weightGoal() - last.value) / rate);
            if (remaining > 0 && remaining <= 180) eta = 'До текущей цели по весу: примерно ' + remaining + ' дн. от последней записи.';
          }
        }
        const forecast = card('Оценка тенденции', node('p',estimate), node('p','Оценка по записям. Дальнейший результат может отличаться.','hint'));
        if (eta) forecast.append(node('p',eta));
        body.append(forecast);
      }
    }
    function openEditor(group, previous) {
      editing = true;
      report('');
      const isNote = group === 'notes', id = previous?.id ?? crypto.randomUUID();
      const expected = stored(group, id);
      if (expected?.deleted) { render(); report('Запись уже удалена.'); return; }
      if (expected) previous = { ...expected, id };
      const title = input('text', previous?.title, 80);
      const form = node('form', null, 'room-work-card');
      form.append(node('strong', isNote ? 'Заметка' : 'Проект'), field('Название',title));
      const selected = new Set(previous?.tasks ?? []);
      const text = textarea(previous?.text, 2000);
      const project = choice([['','Без проекта'],...rows(records(),'projects').map(row=>[row.id,row.title])], previous?.project ?? '');
      if (isNote) {
        form.append(field('Текст',text),field('Проект',project));
      } else {
        const list = node('fieldset');
        list.append(node('legend','Действующие задания'));
        for (const item of tasks()) {
          const check = input('checkbox');
          check.checked = selected.has(item.id);
          check.onchange = () => check.checked ? selected.add(item.id) : selected.delete(item.id);
          list.append(field(item.label,check));
        }
        form.append(list);
      }
      form.append(button('Отмена',render), button('Сохранить', () => {
        const name = title.value.trim();
        if (!name) { report('Введи название.'); return; }
        const values = isNote ? {title:name,text:text.value.trim(),project:project.value} : {title:name,tasks:[...selected]};
        save(tx => write(tx,group,id,expected,values), () => { render(); report('Сохранено'); });
      }, 'room-work-primary'));
      form.onsubmit = event => event.preventDefault();
      body.replaceChildren(form);
      title.focus();
    }
    function cabinet() {
      body.append(navigation([['learning','Обучение'],['projects','Проекты'],['notes','Заметки']],tab,value=>{tab=value;}));
      if (tab === 'learning') {
        body.append(card('Текущая цель', node('p',study().goal)), card('Задание на сегодня', node('p',study().task),
          button('Открыть задания',options.openTasks)));
        return;
      }
      const list = rows(records(),tab).sort((a,b)=>b.updated-a.updated);
      const taskById = tab === 'projects' ? new Map(tasks().map(item=>[item.id,item])) : null;
      body.append(button(tab === 'notes' ? 'Новая заметка' : 'Новый проект', () => openEditor(tab), 'room-work-primary'));
      if (!list.length) body.append(node('p','Пока здесь пусто.','hint'));
      for (const row of list) {
        const group = tab, expected = stored(group,row.id);
        const view = card(row.title);
        if (group === 'notes') {
          if (row.text) view.append(node('p',row.text,'room-note-text'));
          const parent = rows(records(),'projects').find(item=>item.id===row.project);
          if (parent) view.append(node('p','Проект · '+parent.title,'hint'));
        } else {
          const linked = row.tasks.map(id => taskById.get(id)).filter(Boolean);
          view.append(node('p','Выполнено ' + linked.filter(item=>item.done).length + ' из ' + linked.length));
          const detail = node('details');
          detail.dataset.roomDisclosure = 'project-' + row.id;
          detail.append(node('summary','Задания проекта'));
          for (const item of linked) detail.append(node('p',(item.done ? '✓ ' : '○ ') + item.label));
          view.append(detail);
        }
        view.append(button('Редактировать',()=>openEditor(group,row)));
        if (group === 'notes') view.append(button('Удалить',()=>remove(group,row.id,expected,'Заметка удалена.','Заметка восстановлена')));
        body.append(view);
      }
    }
    function ritualView() {
      const history = daysBack(today(),7);
      const list = rituals(history);
      body.append(node('p','Отметки здесь и в «Заданиях» общие.','hint'));
      if (!list.length) body.append(node('p','На сегодня нет доступных ритуалов.'));
      for (const item of list) {
        const done = button(item.done ? 'Снять отметку' : 'Выполнить',()=>toggleRitual(item.id));
        done.setAttribute('aria-label',(item.done ? 'Снять отметку: ' : 'Выполнить: ') + item.label);
        const detail = node('details');
        detail.dataset.roomDisclosure = 'ritual-' + item.id;
        detail.append(node('summary','Последние 7 дней'),
          ...history.slice().reverse().map(key=>node('p',dateLabel(key) + ' · ' +
            (item.history[key] === true ? 'Выполнено' : item.history[key] === false ? 'Без отметки' : 'Недоступно'))));
        const heading = node('div',null,'room-ritual-heading');
        heading.append(node('strong',item.label),node('p','Серия: ' + item.streak + ' дн.','hint'));
        const view = node('section',null,'room-work-card room-ritual-card');
        view.append(heading,done,detail);
        body.append(view);
      }
    }
    function recovery() {
      const expected = stored('recovery',recoveryDate);
      const current = expected?.deleted ? null : expected;
      const date = input('date',recoveryDate);
      date.max = today();
      date.onchange = () => {
        if (dayPattern.test(date.value) && date.value <= today()) { recoveryDate = date.value; report(''); render(); }
      };
      const minutes = input('number',current?.minutes);
      minutes.min = 1; minutes.max = 1440;
      const asleep = input('time',current?.asleep), awake = input('time',current?.awake);
      const scale = [['','Без отметки'],...['1','2','3','4','5'].map(value=>[value,value])];
      const mood = choice(scale,String(current?.mood ?? '')), energy = choice(scale,String(current?.energy ?? ''));
      const note = textarea(current?.note,500);
      const saveControl = button('Сохранить запись',()=>{
        const value = minutes.value === '' ? null : Number(minutes.value);
        if (value !== null && (!Number.isInteger(value) || value < 1 || value > 1440)) { report('Укажи длительность от 1 до 1440 минут.'); return; }
        const row = {date:recoveryDate,minutes:value,asleep:asleep.value,awake:awake.value,
          mood:Number(mood.value)||null,energy:Number(energy.value)||null,note:note.value.trim()};
        if (![row.minutes,row.asleep,row.awake,row.mood,row.energy,row.note].some(Boolean)) { report('Заполни хотя бы одно поле.'); return; }
        save(tx=>write(tx,'recovery',row.date,expected,row),()=>{render();report('Запись сохранена');});
      },'room-work-primary');
      const actions = node('div',null,'room-recovery-actions');
      actions.append(saveControl);
      if (current) actions.append(button('Удалить запись',()=>remove('recovery',current.date,expected,'Запись удалена.','Запись восстановлена')));
      body.append(field('Дата записи',date),
        card('Сон и самочувствие',field('Длительность сна, минут',minutes),field('Засыпание',asleep),
          field('Пробуждение',awake),field('Самочувствие от 1 до 5',mood),field('Энергия от 1 до 5',energy),field('Заметка',note),actions));
      const dates = daysBack(today(),7);
      const recent = rows(records(),'recovery').filter(row=>dates.includes(row.date)).sort((a,b)=>b.date.localeCompare(a.date));
      if (recent.length) {
        const times = recent.map(duration).filter(value=>value != null);
        const history = node('details',null,'room-work-card');
        history.dataset.roomDisclosure = 'recovery';
        history.append(node('summary','Последние 7 дней'),
          ...recent.map(row=>node('p',dateLabel(row.date) + ' · ' + (duration(row) == null ? 'сон не записан' : duration(row) + ' мин') +
            (row.mood ? ' · самочувствие ' + row.mood + '/5' : '') + (row.energy ? ' · энергия ' + row.energy + '/5' : ''))));
        if (times.length) body.append(node('p','Средний сон по записям: ' + format.format(times.reduce((a,b)=>a+b,0)/times.length) + ' мин.','hint'));
        body.append(history);
      }
    }
    function render() {
      const expanded = new Set([...body.querySelectorAll('details[open][data-room-disclosure]')].map(detail=>detail.dataset.roomDisclosure));
      body.replaceChildren();
      editing = false;
      if (room === 'observatory') analytics();
      if (room === 'study') cabinet();
      if (room === 'cloister') ritualView();
      if (room === 'rest') recovery();
      for (const detail of body.querySelectorAll('details[data-room-disclosure]')) {
        detail.open = expanded.has(detail.dataset.roomDisclosure);
      }
    }
    return {
      open(value) { room = value; recoveryDate = today(); body.replaceChildren(); report(''); render(); },
      close() { room = ''; editing = false; },
      refresh() { if (room === 'cloister' || room === 'study' && !editing && !busy) render(); }
    };
  }

  const reminderPath = 'cfg/room-reminders';
  const reminderCategories = [
    ['tasks','Задания ещё открыты'], ['food','В дневнике питания пока нет записей'],
    ['recovery','В дневнике восстановления пока нет записи']
  ];
  const reminderDefaults = { version:1, at:'19:00', quietFrom:'23:00', quietTo:'08:00', categories:[] };
  function readReminders(value) {
    if (value?.version !== 1 || ![value.at,value.quietFrom,value.quietTo].every(time=>timePattern.test(time)) ||
        !Array.isArray(value.categories)) return reminderDefaults;
    return value;
  }
  function dueReminders(config, hour, sent, needs) {
    if (!timePattern.test(hour) || hour < config.at) return [];
    const { quietFrom:from, quietTo:to } = config;
    const quiet = from < to ? hour >= from && hour < to : from > to && (hour >= from || hour < to);
    if (quiet) return [];
    return reminderCategories.filter(([key])=>config.categories.includes(key)&&!sent.includes(key)&&needs(key));
  }
  function mountReminders(host, options) {
    const { records, transact, today, time, ready, needs, notify } = options;
    const form = node('div',null,'room-reminder-form');
    const status = node('p',null,'hint');
    status.setAttribute('role','status');
    host.append(form,status);
    function draw() {
      const config = readReminders(records()[reminderPath]?.d);
      const schedule = input('time',config.at), from = input('time',config.quietFrom), to = input('time',config.quietTo);
      const checks = reminderCategories.map(([key,title])=>{
        const control = input('checkbox');
        control.checked=config.categories.includes(key);
        return [key,field(title,control),control];
      });
      const times = node('div',null,'room-reminder-times');
      times.append(field('Показывать после',schedule),field('Тишина с',from),field('Тишина до',to));
      form.replaceChildren(node('p','Напоминания появляются, пока игра открыта.','hint'),times,...checks.map(row=>row[1]));
      const saveControl = button('Сохранить напоминания',()=>{
        if (![schedule.value,from.value,to.value].every(value=>timePattern.test(value))) {
          status.textContent='Укажи время напоминаний и часы тишины.';
          return;
        }
        saveControl.disabled=true;
        transact(tx=>tx.set(reminderPath,{version:1,at:schedule.value,quietFrom:from.value,quietTo:to.value,
          categories:checks.filter(row=>row[2].checked).map(row=>row[0])}))
          .then(()=>{status.textContent='Настройки сохранены';check();},error=>{status.textContent=error.message;})
          .finally(()=>{saveControl.disabled=false;});
      });
      form.append(saveControl);
    }
    host.addEventListener('toggle',()=>{if(host.open)draw();});
    let checking = false;
    function check() {
      if (checking || document.hidden || !ready()) return;
      const config = readReminders(records()[reminderPath]?.d), date=today();
      if (!config.categories.length) return;
      const path = 'room-reminder-days/' + date;
      const sent = records()[path]?.d?.sent || [];
      if (!dueReminders(config,time(),sent,needs).length) return;
      checking=true;
      transact(tx=>{
        const previous=tx.get(path)?.sent || [];
        const due=dueReminders(readReminders(tx.get(reminderPath)),time(),previous,needs);
        if (date !== today() || document.hidden || !due.length) return [];
        tx.set(path,{version:1,sent:previous.concat(due.map(row=>row[0]))});
        return due;
      }).then(due=>{if(due.length)notify(due.map(row=>row[1]).join(' · '));},()=>{}).finally(()=>{checking=false;});
    }
    setInterval(check,60000);
    document.addEventListener('visibilitychange',check);
  }

  root.VkachRoomWorkspace = Object.freeze({ labels, mount, mountReminders, dueReminders });
})(globalThis);
