(function (root) {
  'use strict';

  const model = root.VkachFood;
  const metrics = { kcal: 'ккал', protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы' };
  const actions = { create: 'Добавлен', edit: 'Изменён', portion: 'Изменена порция', delete: 'Удалён', restore: 'Восстановлен' };
  const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const dateText = date => date.split('-').reverse().join('.');
  const copy = value => JSON.parse(JSON.stringify(value));
  const fatSecretEndpoint = 'https://vkach-fatsecret-api.ugghhtb.workers.dev';
  // FatSecret Basic usually indexes English product names. Keep this small
  // dictionary local: nutrition data still comes from FatSecret, never here.
  const foodNamesRu = [
    [/курин(?:ое|ая|ый|ого|ую)?\s*филе|филе\s*куриц[ыа]?|курин(?:ая|ую)?\s*грудк[ауы]/g, 'chicken breast'],
    [/индейк[ауы]|индюш(?:иное|ачье)?\s*филе/g, 'turkey'],
    [/говядин[ауы]|говяж(?:ье|ий|ая)/g, 'beef'],
    [/свинин[ауы]/g, 'pork'],
    [/гречк[ауые]|гречнев(?:ая|ую|ой)/g, 'buckwheat'],
    [/творог[а-я]*/g, 'cottage cheese'],
    [/яйц[аоы]|яиц[ао]/g, 'egg'],
    [/молок[оа]|молочн(?:ый|ое)/g, 'milk'],
    [/кефир[а-я]*/g, 'kefir'],
    [/йогурт[а-я]*/g, 'yogurt'],
    [/сыр[а-я]*/g, 'cheese'],
    [/масл[оа]/g, 'butter'],
    [/куриц[аыуе]|цыпл[её]нок/g, 'chicken'],
    [/филе/g, 'fillet'],
    [/рыб[аыуе]/g, 'fish'],
    [/лосос[ья]|с[её]мг[ауы]/g, 'salmon'],
    [/тун[её]ц|тунц[аыу]/g, 'tuna'],
    [/картофел[ья]|картошк[ауы]/g, 'potato'],
    [/помидор[а-я]*|томат[а-я]*/g, 'tomato'],
    [/огур[её]ц|огурц[а-я]*/g, 'cucumber'],
    [/морков[ьи]|морковк[ауы]/g, 'carrot'],
    [/капуст[ауые]/g, 'cabbage'],
    [/лук[а-я]*/g, 'onion'],
    [/яблок[оиа]|яблочн(?:ый|ое)/g, 'apple'],
    [/банан[а-я]*/g, 'banana'],
    [/апельсин[а-я]*/g, 'orange'],
    [/рис[а-я]*/g, 'rice'],
    [/овсянк[ауы]|овсян(?:ая|ые|ой)/g, 'oatmeal'],
    [/макарон[а-я]*|паст[ауы]/g, 'pasta'],
    [/хлеб[а-я]*/g, 'bread'],
    [/батон[а-я]*/g, 'white bread'],
    [/печень[а-я]*/g, 'liver'],
    [/орех[а-я]*/g, 'nuts'],
    [/миндал[ья]/g, 'almond'],
    [/арахис[а-я]*/g, 'peanut'],
    [/шоколад[а-я]*/g, 'chocolate'],
    [/сахар[а-я]*/g, 'sugar'],
    [/м[её]д[а-я]*/g, 'honey'],
    [/соль/g, 'salt'],
    [/кофе/g, 'coffee'],
    [/чай/g, 'tea'],
    [/суп[а-я]*/g, 'soup'],
    [/салат[а-я]*/g, 'salad'],
    [/котлет[а-я]*/g, 'cutlet'],
    [/вар[её]н(?:ый|ая|ое|ые)|отварн(?:ый|ая|ое|ые)/g, 'boiled'],
    [/жарен(?:ый|ая|ое|ые)/g, 'fried'],
    [/запеч[её]н(?:ый|ая|ое|ые)/g, 'baked'],
    [/без\s*кож[иы]/g, 'skinless'],
  ];

  function translateFoodSearch(term) {
    if (!/[а-яё]/i.test(term)) return term;
    if (/^филе$/i.test(term.trim())) return 'chicken breast';
    let translated = term.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
    for (const [pattern, english] of foodNamesRu) translated = translated.replace(pattern, ' ' + english + ' ');
    // Unknown Cyrillic words should not become misleading English guesses.
    return translated.replace(/[а-яё]+/g, ' ').replace(/\s+/g, ' ').trim() || term;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function button(text, action, className) {
    const node = element('button', text, className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function labeled(title, control) {
    const node = element('label', title);
    node.appendChild(control);
    return node;
  }

  function input(title, value, action, options = {}) {
    const control = element('input');
    control.type = options.type || 'text';
    if (options.decimal) {
      control.inputMode = 'decimal';
      control.maxLength = 18;
    }
    if (options.maxLength) control.maxLength = options.maxLength;
    if (options.min) control.min = options.min;
    if (options.max) control.max = options.max;
    control.value = value ?? '';
    control.addEventListener(options.event || 'input', () => action(control.value));
    return labeled(title, control);
  }

  function select(title, options, value, action) {
    const control = element('select');
    control.setAttribute('aria-label', title);
    control.replaceChildren(...options.map(([id, label]) => new Option(label, id)));
    control.value = value;
    control.onchange = () => action(control.value, control);
    return labeled(title, control);
  }

  function check(title, value, action) {
    const control = element('input');
    control.type = 'checkbox';
    control.checked = Boolean(value);
    control.onchange = () => action(control.checked);
    return labeled(title, control);
  }

  function disclosure(title, ...children) {
    const node = element('details');
    node.append(element('summary', title), ...children);
    return node;
  }

  function blank() {
    return { id: model.makeId(), name: '', grams: '', base: '100', mode: 'exact', values: {} };
  }

  function remoteFoodSearch(addPosition) {
    const panel = element('section', null, 'food-entry food-remote-search');
    const query = element('input');
    query.type = 'search';
    query.placeholder = 'Продукт по-русски или бренд';
    query.maxLength = 80;
    query.setAttribute('aria-label', 'Поиск в FatSecret');
    const message = element('p', 'Найди продукт — КБЖУ заполнится автоматически.', 'hint');
    message.setAttribute('role', 'status');
    const results = element('div', null, 'food-stack');
    let serial = 0;

    async function get(path) {
      const response = await fetch(fatSecretEndpoint + path);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'unavailable');
      return data;
    }

    async function search() {
      const term = query.value.trim();
      if (term.length < 2) { message.textContent = 'Введи минимум две буквы.'; return; }
      const request = ++serial;
      results.replaceChildren();
      message.textContent = 'Ищу в FatSecret…';
      try {
        const english = translateFoodSearch(term);
        let { foods } = await get('/search?q=' + encodeURIComponent(english));
        if (!foods.length && english !== term) ({ foods } = await get('/search?q=' + encodeURIComponent(term)));
        if (request !== serial) return;
        message.textContent = foods.length
          ? (english !== term ? 'Поиск по-английски: ' + english + '. Выбери продукт.' : 'Выбери продукт из списка.')
          : 'Ничего не найдено. Попробуй другое название.';
        foods.forEach(food => {
          const label = food.name + (food.brand ? ' · ' + food.brand : '');
          results.appendChild(button(label, async () => {
            message.textContent = 'Загружаю порции…';
            try {
              const detail = (await get('/food?id=' + encodeURIComponent(food.id))).food;
              const servings = detail.servings.filter(s => s.grams > 0 &&
                ['kcal', 'protein', 'fat', 'carbs'].every(key => Number.isFinite(s[key])));
              if (!servings.length) { message.textContent = 'Нет полной граммовой порции. Выбери другой продукт.'; return; }
              results.replaceChildren();
              const selectServing = element('select');
              selectServing.setAttribute('aria-label', 'Порция FatSecret');
              servings.forEach((s, i) => selectServing.add(new Option(
                s.label + ' · ' + s.grams + ' г · ' + s.kcal + ' ккал', String(i))));
              message.textContent = label + ' · выбери исходную порцию.';
              results.append(selectServing, button('Добавить продукт с КБЖУ', () => {
                const serving = servings[Number(selectServing.value)];
                addPosition({ id: model.makeId(), name: label, grams: String(serving.grams),
                  base: String(serving.grams), mode: 'exact', values: {
                    kcal: serving.kcal, protein: serving.protein, fat: serving.fat, carbs: serving.carbs
                  } });
              }));
            } catch { message.textContent = 'Не удалось загрузить порции. Попробуй ещё раз.'; }
          }));
        });
      } catch { message.textContent = 'FatSecret временно недоступен. Своя позиция работает без интернета.'; }
    }
    query.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    panel.append(element('strong', 'Поиск FatSecret'), query, button('Найти продукт', search), message, results);
    return panel;
  }

  function nutrientFields(values, changed, includes = model.keys) {
    const grid = element('div', null, 'food-nutrients');
    for (const key of includes) {
      grid.appendChild(input(metrics[key], values[key], value => {
        values[key] = value;
        changed();
      }, { decimal: true }));
    }
    return grid;
  }

  function librarySearch(library, choose, catalogView = false) {
    const panel = element('section', null, 'food-library-search');
    const results = element('div', null, 'food-stack');
    const message = element('p', null, 'hint');
    message.setAttribute('role', 'status');
    const indexed = library.map(row => ({ row, name: model.searchName(row.name) }));
    const suggestions = indexed.filter(({ row }) => row.favorite || row.lastUsed);
    function show(value) {
      const term = model.searchName(value);
      const matches = term ? indexed.filter(entry => entry.name.includes(term)) : suggestions;
      const limit = term ? 12 : 5;
      results.replaceChildren(...matches.slice(0, limit).map(({ row }) => {
        const result = button(row.name, () => choose(row), 'food-library-result');
        const grams = row.lastGrams ?? row.base;
        const kcal = row.values.kcal == null ? 'Калорийность неизвестна' :
          (row.estimated ? '≈ ' : '') + format.format(row.values.kcal * grams / row.base) + ' ккал';
        result.appendChild(element('small', [row.favorite ? '★' : '', row.type === 'recipe' ? 'Рецепт' :
          row.history ? 'Из истории' : '', format.format(grams) + ' г', kcal].filter(Boolean).join(' · ')));
        return result;
      }));
      message.textContent = term ? (!matches.length ? 'В личной базе ничего не найдено.' :
        matches.length > limit ? 'Уточни название, чтобы увидеть остальные продукты.' : '') :
        matches.length ? 'Избранное и недавние продукты' : 'Здесь появятся продукты из сохранённых приёмов пищи.';
    }
    panel.append(input(catalogView ? 'Найти продукт для редактирования' : 'Поиск в Книге Трапезной', '', show,
      { type: 'search', maxLength: 120 }), message, results);
    show('');
    return panel;
  }

  function itemsEditor(items, catalog, changed, rerender, massLabel, mealAdd) {
    const list = element('div', null, 'food-stack');
    if (mealAdd) list.append(librarySearch(catalog, row => mealAdd(model.fromCatalog(row), true)), remoteFoodSearch(mealAdd));
    items.forEach((row, index) => {
      const section = element('div', null, 'food-entry');
      section.dataset.foodPosition = row.id;
      const update = (key, value) => { row[key] = value; changed(); };
      const heading = element('div', null, 'food-row');
      heading.append(element('strong', 'Позиция ' + (index + 1)), button('Убрать', () => {
        items.splice(index, 1);
        changed();
        rerender();
      }));
      const facts = element('div', null, 'food-stack');
      facts.hidden = row.mode === 'unknown';
      facts.append(input('База КБЖУ, г', row.base, value => update('base', value), { decimal: true }),
        nutrientFields(row.values, changed));
      section.append(heading, input('Название', row.name, value => update('name', value), { maxLength: 120 }),
        input(massLabel, row.grams, value => update('grams', value), { decimal: true }),
        select('Способ учёта', Object.entries(model.modes), row.mode, value => {
          facts.hidden = value === 'unknown';
          update('mode', value);
        }), facts);
      list.appendChild(section);
    });
    if (items.length >= model.limit) return list;
    const add = row => {
      items.push(row);
      changed();
      rerender();
    };
    const addButtons = element('div', null, 'food-row');
    addButtons.append(button('Своя позиция', () => add(blank())));
    if (!mealAdd) list.prepend(librarySearch(catalog, row => add(model.fromCatalog(row))));
    const savedChoices = catalog.filter(row => !row.history && !row.automatic);
    if (savedChoices.length) {
      const options = savedChoices.map(row => [row.id, (row.favorite ? '★ ' : '') + row.name]);
      list.appendChild(select('Из продуктов и рецептов', [['', 'Выбери позицию'], ...options], '', id => {
        const row = savedChoices.find(item => item.id === id);
        if (row) add(model.fromCatalog(row));
      }));
    }
    list.appendChild(addButtons);
    return list;
  }

  function mount(host, options) {
    const { today, goal: defaultGoal, records, transact, notify } = options;
    let tab = 'today';
    let date;
    let active = false;
    let editor = null;
    let catalogEditor = null;
    let visibleSignature = '';
    let watchedRecords;
    let cachedRecords;
    const cachedGroups = new Map();
    let pendingOperation = null;
    let lastDeleted = null;
    let openMeal = null;
    let statusText = '';
    const navigation = element('nav', null, 'food-tabs');
    navigation.setAttribute('aria-label', 'Вкладки дневника');
    const body = element('div', null, 'food-stack');
    const footer = element('footer', null, 'food-footer');
    const status = element('p', null, 'food-status');
    status.setAttribute('role', 'status');
    host.append(navigation, body, status, footer);

    function get(group) {
      const current = records();
      if (current !== cachedRecords) {
        cachedRecords = current;
        cachedGroups.clear();
      }
      if (!cachedGroups.has(group)) cachedGroups.set(group, model.read(current, group));
      return cachedGroups.get(group);
    }

    const goal = () => get('settings')[0]?.kcal ?? defaultGoal();

    function summary(day) {
      const meals = get('meals').filter(row => row.date === day && !row.deleted);
      const items = meals.flatMap(row => row.items);
      const stats = model.totals(items);
      return { meals, items, stats, kcal: model.suggestedCalories(items),
        complete: Boolean(get('days').find(row => row.date === day)?.complete) };
    }

    function calorieLine(day) {
      const { items, stats } = summary(day);
      const stat = stats.metrics.kcal;
      const estimate = items.some(row => row.mode === 'estimate' && model.portion(row, 'kcal') != null);
      return (stat.known ? (estimate ? '≈ ' : '') + format.format(stat.sum) : '—') + ' / ' + format.format(goal()) + ' ккал' +
        (stat.missing ? ' · неполные данные' : '');
    }

    function report(text) {
      statusText = text;
      status.textContent = text;
    }

    function fail(error) {
      report(error.code === 'food_input' || error.code === 'record_changed' ? error.message
        : 'Запись не сохранена. Проверь свободное место и попробуй ещё раз.');
    }

    function validDay(value) {
      if (!model.validDate(value) || value > today()) {
        report('Выбери дату с 09.11.2026 по сегодняшний день.');
        return false;
      }
      return true;
    }

    function catalog() {
      return model.library(get('meals'), get('catalog')).sort((a, b) => Number(b.favorite) - Number(a.favorite) ||
        (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name, 'ru'));
    }

    function draftFor(day, kind) {
      return get('drafts').find(row => row.date === day && row.kind === kind) || null;
    }

    function editorFor(day, kind, items = [], meal = null) {
      const saved = draftFor(day, kind);
      if (saved && (meal || items.length)) {
        report('Для этого приёма уже есть черновик. Продолжи его или удали перед копированием и редактированием.');
        return;
      }
      const draft = saved ? copy(saved) : {
        id: meal?.id ?? model.makeId(), date: day, kind, items: copy(items),
        edit: meal ? { id: meal.id, updated: meal.updated } : null
      };
      if (!draft.items.length) draft.items.push(blank());
      editor = { draft, saved, queue: null, dirty: !saved, accepting: true };
      flushEditor(editor).catch(() => {});
      report('');
      render(true);
    }

    function flushEditor(current = editor) {
      if (!current) return Promise.resolve();
      if (current.queue) return current.queue;
      if (!current.dirty) return Promise.resolve();
      current.queue = (async () => {
        while (current.dirty) {
          const snapshot = copy(current.draft);
          current.dirty = false;
          try {
            current.saved = await transact(tx => model.putDraft(tx, snapshot, current.saved));
          } catch (error) {
            current.dirty = true;
            fail(error);
            throw error;
          }
        }
      })().finally(() => { current.queue = null; });
      return current.queue;
    }

    function updateDraft() {
      if (!editor?.accepting) return;
      editor.dirty = true;
      flushEditor().catch(() => {});
    }

    async function leaveEditor(announce = true) {
      if (!editor) return true;
      try {
        await flushEditor();
        editor = null;
        if (announce) report('Сохранено как черновик');
        return true;
      } catch {
        return false;
      }
    }

    function run(operation, done) {
      if (pendingOperation) return;
      host.setAttribute('aria-busy', 'true');
      const write = Promise.resolve().then(operation);
      pendingOperation = write;
      void write.then(done).catch(fail).finally(() => {
        pendingOperation = null;
        host.removeAttribute('aria-busy');
      });
    }

    function statLabel(metric, unit = '') {
      if (!metric.known) return '—';
      return format.format(metric.sum) + unit + (metric.missing ? ' (частично)' : '');
    }

    function breakdown(stats) {
      const list = element('div', null, 'food-breakdown');
      for (const key of model.keys.slice(1)) {
        list.append(element('span', metrics[key] + ' ' + statLabel(stats.metrics[key], ' г')));
      }
      return list;
    }

    function renderDay(day) {
      const view = summary(day);
      const total = element('section', null, 'food-entry');
      total.append(element('strong', 'Записано ' + calorieLine(day)), breakdown(view.stats));
      if (view.kcal != null) {
        const rest = goal() - view.stats.metrics.kcal.sum;
        const estimate = view.stats.counts.estimate ? '≈ ' : '';
        total.append(element('p', (rest >= 0 ? 'Осталось ' : 'Сверх цели ') + estimate + format.format(Math.abs(rest)) + ' ккал'));
      } else {
        total.append(element('p', view.items.length ? 'Итог дня неизвестен: есть позиции без калорийности.' : 'Записей о питании пока нет.'));
      }
      if (view.items.length) {
        const c = view.stats.counts;
        total.append(element('small', 'Точно: ' + c.exact + ' · приблизительно: ' + c.estimate + ' (' + Math.round(100 * c.estimate / view.items.length) + '%) · без расчёта: ' + c.unknown));
      }
      const complete = check('Дневник заполнен', view.complete, value => run(
        () => transact(tx => model.setComplete(tx, day, value)), () => { report(''); render(); }
      ));
      body.append(total, complete);
      if (lastDeleted?.date === day) {
        body.appendChild(button('Отменить удаление', () => run(
          () => transact(tx => model.setDeleted(tx, lastDeleted, false)), () => {
            lastDeleted = null;
            report('Приём пищи восстановлен');
            render();
          }
        )));
      }
      for (const [kind, label] of Object.entries(model.kinds)) {
        const meals = view.meals.filter(row => row.kind === kind).sort((a, b) => a.created - b.created);
        const saved = draftFor(day, kind);
        const group = element('section', null, 'food-entry');
        const header = element('div', null, 'food-row');
        header.append(element('strong', label), button(saved ? 'Продолжить черновик' : 'Добавить', () => editorFor(day, kind)));
        group.appendChild(header);
        for (const meal of meals) group.appendChild(renderMeal(meal));
        const previous = get('meals').filter(row => !row.deleted && row.kind === kind && row.date < day)
          .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created)[0];
        if (previous && !saved) {
          group.appendChild(button('Повторить приём от ' + dateText(previous.date),
            () => editorFor(day, kind, previous.items.map(row => ({ ...row, id: model.makeId() })))));
        }
        body.appendChild(group);
      }
    }

    function renderMeal(meal) {
      const kcal = model.totals(meal.items).metrics.kcal;
      const list = element('ul');
      for (const row of meal.items) {
        const value = model.portion(row, 'kcal');
        list.appendChild(element('li', row.name + ' · ' + format.format(row.grams) + ' г · ' +
          (value == null ? 'ккал неизвестны' : format.format(value) + ' ккал') + ' · ' + model.modes[row.mode]));
      }
      const buttons = element('div', null, 'food-row');
      buttons.append(button('Редактировать', () => editorFor(meal.date, meal.kind, meal.items, meal)),
        button('Удалить', () => run(() => transact(tx => model.setDeleted(tx, meal, true)), saved => {
          lastDeleted = saved;
          report('Приём пищи удалён');
          render();
        })));
      let targetDate = today();
      const dateInput = input('Дата копии', targetDate, value => { targetDate = value; },
        { type: 'date', min: model.start, max: today() });
      const transfer = disclosure('Копировать на другую дату', dateInput,
        button('Копировать в черновик', () => {
          if (validDay(targetDate)) editorFor(targetDate, meal.kind, meal.items.map(row => ({ ...row, id: model.makeId() })));
        }));
      const panel = disclosure(meal.items.map(row => row.name).join(', ') + ' · ' + statLabel(kcal, ' ккал'), list, buttons, transfer);
      panel.className = 'food-meal';
      panel.open = openMeal === meal.id;
      panel.addEventListener('toggle', () => {
        if (panel.open) openMeal = meal.id;
        else if (openMeal === meal.id) openMeal = null;
      });
      return panel;
    }

    function renderHistory() {
      const dates = new Set([date, today(), ...get('meals').map(row => row.date),
        ...get('days').map(row => row.date), ...get('drafts').map(row => row.date)]);
      const historyBar = element('div', null, 'food-row');
      historyBar.appendChild(input('Дата дневника', date, value => {
        if (validDay(value)) { date = value; render(); }
      }, { type: 'date', min: model.start, max: today(), event: 'change' }));
      historyBar.appendChild(select('Дни с записями', [...dates].sort().reverse().filter(model.validDate)
        .map(value => [value, dateText(value)]), date, value => { date = value; render(); }));
      body.appendChild(historyBar);
      renderDay(date);
      const history = element('ul');
      get('events').filter(row => row.date === date).sort((a, b) => b.updated - a.updated).forEach(row => {
        history.appendChild(element('li', new Date(row.created).toLocaleString('ru-RU') + ' · ' +
          actions[row.action] + ' · ' + model.kinds[row.kind] + ' · ' + row.names.join(', ')));
      });
      if (!history.childElementCount) history.appendChild(element('li', 'Изменений за этот день нет.'));
      body.appendChild(disclosure('История изменений', history));
      const deleted = get('meals').filter(row => row.date === date && row.deleted);
      if (deleted.length) {
        const controls = deleted.map(row => button('Восстановить: ' + row.items.map(item => item.name).join(', '),
          () => run(() => transact(tx => model.setDeleted(tx, row, false)), () => {
            if (lastDeleted?.id === row.id) lastDeleted = null;
            report('Приём пищи восстановлен');
            render();
          })));
        body.appendChild(disclosure('Удалённые приёмы пищи', ...controls));
      }
    }

    function renderEditor() {
      const current = editor;
      const { draft } = current;
      const preview = element('div', null, 'food-entry');
      function updatePreview() {
        const rows = [];
        let pending = 0;
        for (const item of draft.items) {
          try { rows.push(model.position(item)); }
          catch { pending++; }
        }
        const stats = model.totals(rows);
        preview.replaceChildren(element('strong', 'В черновике ' + statLabel(stats.metrics.kcal, ' ккал')),
          breakdown(stats), element('small', pending ? 'Позиций, которые нужно заполнить: ' + pending : ''));
      }
      function changed() {
        updateDraft();
        updatePreview();
      }
      const addPosition = (position, showPortion = false) => {
        if (editor !== current) return;
        const blankIndex = draft.items.findIndex(item => !item.name && !item.grams);
        if (blankIndex >= 0) draft.items.splice(blankIndex, 1, position);
        else if (draft.items.length < model.limit) draft.items.push(position);
        else { report('Максимум 24 позиции в одном приёме пищи.'); return; }
        changed();
        render();
        if (showPortion) body.querySelector(`[data-food-position="${position.id}"]`).scrollIntoView({ block: 'nearest' });
      };
      const title = element('h2', model.kinds[draft.kind] + ' · ' + dateText(draft.date));
      title.tabIndex = -1;
      body.append(title, preview, itemsEditor(draft.items, catalog(), changed, render, 'Масса порции, г', addPosition));
      updatePreview();
      body.append(button('Выйти из черновика', async () => { if (await leaveEditor()) render(); }),
        button('Удалить черновик', () => run(async () => {
          current.accepting = false;
          try {
            await flushEditor(current);
            if (current.saved) await transact(tx => model.clearDraft(tx, current.saved));
          } finally { current.accepting = true; }
        }, () => { editor = null; report('Черновик удалён'); render(); })));
      footer.appendChild(button('Сохранить приём пищи', () => run(async () => {
        draft.items.forEach(model.position);
        if (!draft.items.length) throw Object.assign(new Error('Добавь хотя бы одну позицию.'), { code: 'food_input' });
        current.accepting = false;
        body.inert = true;
        try {
          await flushEditor(current);
          return await transact(tx => model.finishMeal(tx, current.saved));
        } finally {
          current.accepting = true;
          body.inert = false;
        }
      }, saved => {
        editor = null;
        date = saved.date;
        tab = date === today() ? 'today' : 'history';
        report('Приём пищи сохранён');
        render();
      }), 'food-primary'));
    }

    function editCatalog(type, previous = null) {
      const data = previous ? copy(previous) : {
        id: model.makeId(), type, name: '', base: type === 'product' ? '100' : '', values: {},
        note: '', recipeMode: 'simple', ingredients: [], overrides: {}, favorite: false
      };
      if (previous?.history) data.id = model.makeId();
      catalogEditor = { previous: previous?.history ? null : previous, data };
      report('');
      render(true);
    }

    function renderCatalogEditor() {
      const { data, previous } = catalogEditor;
      const title = data.type === 'product' ? 'Свой продукт' : 'Домашний рецепт';
      body.append(element('h2', title),
        input('Название', data.name, value => { data.name = value; }, { maxLength: 120 }),
        input('Примечание', data.note, value => { data.note = value; }, { maxLength: 300 }));
      if (data.type === 'product') {
        body.append(input('База КБЖУ, г', data.base, value => { data.base = value; }, { decimal: true }),
          nutrientFields(data.values, () => {}), check('Показатели приблизительные', data.estimated, value => { data.estimated = value; }));
      } else {
        const cooked = data.recipeMode === 'cooked';
        const preview = element('p');
        data.previewGrams ??= previous?.lastGrams ?? '';
        const portionInput = input('Порция для расчёта, г', data.previewGrams, value => { data.previewGrams = value; updatePreview(); }, { decimal: true });
        function updatePreview() {
          try {
            const result = model.recipe(data.ingredients, data.recipeMode, data.base, data.overrides);
            const kcal = result.values.kcal;
            const estimate = result.estimated ? '≈ ' : '';
            const kcalText = value => estimate + format.format(value) + ' ккал';
            preview.textContent = 'Вес блюда ' + format.format(result.base) + ' г · ' +
              (kcal == null ? 'калорийность неизвестна' : kcalText(kcal) + ' на всё блюдо · ' +
                kcalText(kcal / result.base * 100) + ' на 100 г');
            if (String(data.previewGrams).trim()) {
              try {
                const grams = model.mass(data.previewGrams);
                if (kcal != null) preview.textContent += ' · ' + kcalText(kcal / result.base * grams) + ' в порции';
              } catch (error) { preview.textContent += ' · ' + error.message; }
            }
          } catch { preview.textContent = 'Заполни массу и данные ингредиентов для расчёта.'; }
        }
        body.appendChild(select('Способ приготовления', [['simple', 'Собрать из готовых продуктов'],
          ['cooked', 'Рассчитать по весу после приготовления']], data.recipeMode, value => {
          data.recipeMode = value;
          render();
        }));
        const ingredients = disclosure('Ингредиенты', itemsEditor(data.ingredients,
          catalog().filter(row => row.type === 'product'), updatePreview, render, cooked ? 'Вес до приготовления, г' : 'Вес готового продукта, г'));
        ingredients.open = true;
        body.append(ingredients, preview);
        if (cooked) {
          const yieldSection = disclosure('Выход готового блюда',
            input('Итоговый приготовленный вес, г', data.base, value => { data.base = value; updatePreview(); }, { decimal: true }));
          yieldSection.open = true;
          body.append(yieldSection, disclosure('КБЖУ всего блюда, если известны',
            nutrientFields(data.overrides, updatePreview)));
        }
        body.appendChild(disclosure('Расчёт порции', portionInput));
        updatePreview();
      }
      body.appendChild(button('Отменить редактирование', () => { catalogEditor = null; render(); }));
      footer.appendChild(button('Сохранить', () => run(() => transact(tx => model.saveCatalog(tx, data, previous)), () => {
        catalogEditor = null;
        report('Сохранено в продуктах');
        render();
      }), 'food-primary'));
    }

    function renderCatalog() {
      const list = catalog();
      const group = (title, entries) => {
        const panel = disclosure(title + ' · ' + entries.length);
        panel.addEventListener('toggle', () => {
          if (!panel.open || panel.childElementCount > 1) return;
          const rows = entries.map(row => {
            const node = element('div', null, 'food-catalog-row');
            const estimated = row.estimated || model.keys.some(key => row.values[key] == null);
            const kcal = row.values.kcal == null ? 'ккал неизвестны' :
              (estimated ? '≈ ' : '') + format.format(row.values.kcal) + ' ккал на ' + format.format(row.base) + ' г';
            const detail = [kcal, row.lastGrams ? 'Порция ' + format.format(row.lastGrams) + ' г' : '', row.note].filter(Boolean);
            node.append(element('strong', row.name), element('small', detail.join(' · ')),
              button('Редактировать ' + row.name, () => editCatalog(row.type, row)),
              button(row.favorite ? 'Убрать из избранного' : 'В избранное', () => run(
                () => transact(tx => row.history ? model.favoriteFromHistory(tx, row) : model.favorite(tx, row)), () => render()
              )));
            return node;
          });
          panel.append(...rows);
        });
        body.appendChild(panel);
      };
      body.append(element('h2', 'Книга Трапезной'), librarySearch(list, row => editCatalog(row.type, row), true));
      group('Избранное', list.filter(row => row.favorite));
      group('Недавние', list.filter(row => row.lastUsed).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 6));
      group('Свои продукты', get('catalog').filter(row => row.type === 'product').sort((a, b) => a.name.localeCompare(b.name, 'ru')));
      group('Продукты из истории', list.filter(row => row.history));
      group('Домашние блюда и рецепты', list.filter(row => row.type === 'recipe'));
      body.appendChild(button('Создать рецепт', () => editCatalog('recipe')));
      let target = goal();
      body.appendChild(disclosure('Настройки питания',
        input('Дневная цель, ккал', target, value => { target = value; }, { decimal: true }),
        element('p', 'Цель для дневника. Условия игрового задания остаются прежними.', 'hint'),
        button('Сохранить цель', () => run(() => transact(tx => model.setGoal(tx, target)), () => {
          report('Цель питания сохранена');
          render();
        }))));
      footer.appendChild(button('Создать продукт', () => editCatalog('product'), 'food-primary'));
    }

    function render(focus = false) {
      if (!active) return;
      const scroller = host.parentElement;
      const scroll = scroller.scrollTop;
      navigation.replaceChildren();
      navigation.hidden = Boolean(editor || catalogEditor);
      body.replaceChildren();
      footer.replaceChildren();
      status.textContent = statusText;
      if (editor) renderEditor();
      else if (catalogEditor) renderCatalogEditor();
      else {
        for (const [id, label] of [['today', 'Сегодня'], ['history', 'История'], ['catalog', 'Продукты']]) {
          const control = button(label, () => { tab = id; report(''); render(true); });
          control.dataset.foodTab = id;
          control.setAttribute('aria-pressed', String(id === tab));
          navigation.appendChild(control);
        }
        if (tab === 'today') {
          date = today();
          renderDay(date);
          footer.appendChild(button('Добавить еду', () => chooseMeal(), 'food-primary'));
        } else if (tab === 'history') renderHistory();
        else renderCatalog();
      }
      footer.hidden = !footer.childElementCount;
      scroller.scrollTop = focus ? 0 : scroll;
      if (focus) (body.querySelector(editor ? 'h2' : 'input,button') ||
        navigation.querySelector('[aria-pressed="true"]'))?.focus({ preventScroll: true });
    }

    function chooseMeal() {
      const chooser = element('div', null, 'food-entry');
      chooser.appendChild(element('strong', 'Выбери приём пищи'));
      for (const [kind, label] of Object.entries(model.kinds)) {
        chooser.appendChild(button(label, () => editorFor(today(), kind)));
      }
      body.prepend(chooser);
      chooser.querySelector('button').focus();
      chooser.scrollIntoView({ block: 'nearest' });
      footer.hidden = true;
    }

    function open(add = false) {
      active = true;
      date = today();
      tab = 'today';
      report('');
      render();
      if (add && !editor) chooseMeal();
    }

    function close() {
      active = false;
      catalogEditor = null;
      if (editor) {
        void leaveEditor(false).then(saved => {
          if (saved) notify('Сохранено как черновик');
          else notify('Не удалось сохранить черновик. Открой дневник и попробуй ещё раз.');
          if (active) render();
        });
      }
    }

    function connect(db) {
      function changed() {
        const current = records();
        if (current === watchedRecords) return;
        watchedRecords = current;
        const signature = JSON.stringify(Object.entries(current).filter(([key]) => key.startsWith('food-'))
          .map(([key, row]) => [key, row.u]));
        if (visibleSignature === signature) return;
        visibleSignature = signature;
        options.changed();
        if (!pendingOperation && !editor && !catalogEditor) render();
      }
      for (const collection of Object.values(model.collections)) db.collection(collection).onSnapshot(changed);
    }

    async function flush() {
      await flushEditor();
      await pendingOperation;
    }

    return Object.freeze({ open, close, connect, summary, calorieLine, goal, flush });
  }

  root.VkachFoodUI = Object.freeze({ mount, translateFoodSearch });
})(globalThis);
