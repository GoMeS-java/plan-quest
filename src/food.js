// The diary has its own documents inside the existing save and backup envelope.
(function (root) {
  'use strict';

  const start = '2026-11-09';
  const version = 1;
  const kinds = Object.freeze({ breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекусы' });
  const modes = Object.freeze({ exact: 'Точно', estimate: 'Приблизительно', unknown: 'Без расчёта' });
  const keys = Object.freeze(['kcal', 'protein', 'fat', 'carbs']);
  const collections = Object.freeze({
    meals: 'food-meals', drafts: 'food-drafts', catalog: 'food-catalog', days: 'food-days', events: 'food-events', settings: 'food-settings'
  });
  const limit = 24;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function problem(message, code = 'food_input') {
    return Object.assign(new Error(message), { code });
  }

  function conflict() {
    return problem('Запись изменилась в другом окне. Сохрани свой ввод перед перезагрузкой или открой свежую запись.', 'record_changed');
  }

  function number(value) {
    if (value == null || String(value).trim() === '') return null;
    const text = String(value).trim().replace(',', '.');
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw problem('Введи положительное число или ноль.');
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount > 1e7) throw problem('Проверь величину числа.');
    return amount;
  }

  function mass(value) {
    const amount = number(value);
    if (amount == null || amount < 0.001) throw problem('Укажи массу от 0,001 г.');
    return amount;
  }

  function name(value) {
    const text = String(value ?? '').trim();
    if (!text || text.length > 120) throw problem('Укажи название до 120 символов.');
    return text;
  }

  function validDate(date) {
    if (typeof date !== 'string' || date < start || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const time = Date.parse(date + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
  }

  function validId(id) {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,70}$/.test(id) && !['constructor', 'prototype', '__proto__'].includes(id);
  }

  function makeId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function checkKey(date, kind) {
    if (!validDate(date) || !has(kinds, kind)) throw problem('Выбери дату начиная с 9 ноября 2026 и тип приёма пищи.');
    return date + '-' + kind;
  }

  function nutrients(values = {}) {
    return Object.fromEntries(keys.map(key => [key, number(values?.[key])]));
  }

  function position(raw) {
    if (!validId(raw.id) || !has(modes, raw.mode)) throw problem('Выбери способ учёта еды.');
    const values = nutrients(raw.mode === 'unknown' ? {} : raw.values);
    if (raw.mode === 'exact' && keys.some(key => values[key] == null)) {
      throw problem('Для точной записи заполни все четыре показателя КБЖУ.');
    }
    if (raw.mode === 'estimate' && keys.every(key => values[key] == null)) {
      throw problem('Введи хотя бы один показатель или выбери «Без расчёта».');
    }
    return {
      id: raw.id, name: name(raw.name), grams: mass(raw.grams), mode: raw.mode,
      base: raw.mode === 'unknown' ? 1 : mass(raw.base), values,
      source: validId(raw.source) ? raw.source : null
    };
  }

  function portion(row, key) {
    if (row.mode === 'unknown' || row.values[key] == null) return null;
    return row.values[key] * (row.grams / row.base);
  }

  function totals(items) {
    const counts = { exact: 0, estimate: 0, unknown: 0 };
    const metrics = Object.fromEntries(keys.map(key => [key, { known: 0, missing: 0, sum: 0 }]));
    for (const row of items) {
      counts[row.mode]++;
      for (const key of keys) {
        const stat = metrics[key];
        const value = portion(row, key);
        if (value == null) stat.missing++;
        else {
          stat.known++;
          stat.sum += value;
        }
      }
    }
    return { counts, metrics };
  }

  function suggestedCalories(items) {
    const kcal = totals(items).metrics.kcal;
    return kcal.known && !kcal.missing ? Math.round(kcal.sum * 100) / 100 : null;
  }

  function stamp(data, previous, now) {
    return {
      ...data, version, created: previous?.created ?? now,
      updated: Math.max(now, (previous?.updated ?? -1) + 1)
    };
  }

  function guarded(tx, path, expected) {
    const row = tx.get(path) || null;
    if (!same(row, expected || null)) throw conflict();
    return row;
  }

  function prepareDraft(draft) {
    checkKey(draft.date, draft.kind);
    if (!validId(draft.id) || !Array.isArray(draft.items) || draft.items.length > limit ||
        (draft.edit && (!validId(draft.edit.id) || draft.id !== draft.edit.id || !Number.isFinite(draft.edit.updated)))) {
      throw problem('Некорректный черновик.');
    }
    return { id: draft.id, date: draft.date, kind: draft.kind, items: draft.items, edit: draft.edit || null };
  }

  function putDraft(tx, draft, previous, now = Date.now()) {
    const data = prepareDraft(draft);
    const path = collections.drafts + '/' + checkKey(data.date, data.kind);
    const old = guarded(tx, path, previous);
    const row = stamp(data, old, now);
    tx.set(path, row);
    return row;
  }

  function clearDraft(tx, draft) {
    const path = collections.drafts + '/' + checkKey(draft.date, draft.kind);
    guarded(tx, path, draft);
    tx.delete(path);
  }

  function log(tx, record, action, now) {
    const id = record.id + '-' + record.updated;
    tx.set(collections.events + '/' + id, stamp({
      meal: record.id, date: record.date, kind: record.kind, action,
      names: record.items.map(item => item.name), positions: record.items.length
    }, null, now));
  }

  function reopenDay(tx, date, now) {
    const path = collections.days + '/' + date;
    const old = tx.get(path);
    if (old?.complete) tx.set(path, stamp({ date, complete: false }, old, now));
  }

  function searchName(value) {
    return value.normalize('NFC').toLowerCase().replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');
  }

  function catalogMode(row) {
    if (keys.every(key => row.values[key] == null)) return 'unknown';
    return row.estimated || keys.some(key => row.values[key] == null) ? 'estimate' : 'exact';
  }

  function productKey(row) {
    const mode = row.mode ?? catalogMode(row);
    // Compare equivalent bases without changing the values stored for calculations.
    const perGram = keys.map(key => mode === 'unknown' || row.values[key] == null
      ? null : (row.values[key] / row.base).toPrecision(14));
    return JSON.stringify([searchName(row.name), mode, perGram]);
  }

  function productIndex(catalog) {
    const index = new Map();
    for (const row of catalog) {
      if (row.type !== 'product' || !readable('catalog', row)) continue;
      const key = productKey(row);
      const current = index.get(key);
      if (!current || (current.automatic && !row.automatic)) index.set(key, row);
    }
    return index;
  }

  function productId(key) {
    // Stable across devices so two offline saves of the same food share a document.
    let hash = 0xcbf29ce484222325n;
    for (let i = 0; i < key.length; i++) {
      hash = BigInt.asUintN(64, (hash ^ BigInt(key.charCodeAt(i))) * 0x100000001b3n);
    }
    return 'remembered-' + hash.toString(16);
  }

  function availableProductId(tx, key) {
    let id = productId(key);
    // An edited product keeps its original ID for existing meal references.
    for (let slot = 1; tx.get(collections.catalog + '/' + id); slot++) {
      id = productId(JSON.stringify([key, slot]));
    }
    return id;
  }

  function rememberedProduct(item, id, lastUsed) {
    return { id, type: 'product', name: item.name, note: '', base: item.base, values: item.values,
      estimated: item.mode === 'estimate', automatic: true, favorite: false, lastGrams: item.grams, lastUsed };
  }

  function rememberItems(tx, items, previous, now) {
    const catalog = productIndex(tx.list(collections.catalog));
    const priorItems = new Map((previous?.items ?? []).map(item => [item.id, item]));
    return items.map(item => {
      const prior = priorItems.get(item.id);
      if (same(item, prior)) return item;
      const key = productKey(item);
      const source = item.source && tx.get(collections.catalog + '/' + item.source);
      const keepSource = readable('catalog', source) && (source.type === 'recipe' || productKey(source) === key ||
        (prior?.source === source.id && productKey(prior) === key));
      const match = keepSource ? source : catalog.get(key);
      const id = match?.id ?? availableProductId(tx, key);
      const path = collections.catalog + '/' + id;
      const current = match && tx.get(path);
      const data = current ? { ...current, lastGrams: item.grams, lastUsed: Math.max(now, current.lastUsed || 0) }
        : rememberedProduct(item, id, now);
      const row = stamp(data, current, now);
      tx.set(path, row);
      if (!match) catalog.set(key, row);
      return { ...item, source: id };
    });
  }

  function finishMeal(tx, draft, now = Date.now()) {
    const data = prepareDraft(draft);
    const mealPath = collections.meals + '/' + data.id;
    const previous = tx.get(mealPath);
    if (previous && !data.edit) return previous;
    const path = collections.drafts + '/' + checkKey(data.date, data.kind);
    guarded(tx, path, draft);
    if (data.edit && (!previous || previous.deleted || previous.updated !== data.edit.updated)) throw conflict();
    if (!data.items.length) throw problem('Добавь хотя бы одну позицию.');
    const validated = data.items.map(position);
    if (new Set(validated.map(row => row.id)).size !== validated.length) throw problem('В черновике повторились идентификаторы.');
    const items = rememberItems(tx, validated, previous, now);
    const row = stamp({ id: data.id, date: data.date, kind: data.kind, items, deleted: false }, previous, now);
    const portionsChanged = previous && items.some(item => previous.items.some(old => old.id === item.id && old.grams !== item.grams));
    tx.set(mealPath, row);
    tx.delete(path);
    reopenDay(tx, data.date, now);
    log(tx, row, previous ? (portionsChanged ? 'portion' : 'edit') : 'create', now);
    return row;
  }

  function setDeleted(tx, expected, deleted, now = Date.now()) {
    const path = collections.meals + '/' + expected.id;
    const old = guarded(tx, path, expected);
    if (old.deleted === deleted) return old;
    const row = stamp({ ...old, deleted }, old, now);
    tx.set(path, row);
    reopenDay(tx, row.date, now);
    log(tx, row, deleted ? 'delete' : 'restore', now);
    return row;
  }

  function setComplete(tx, date, complete, now = Date.now()) {
    if (!validDate(date)) throw problem('Выбери дату дневника.');
    const path = collections.days + '/' + date;
    const previous = tx.get(path);
    tx.set(path, stamp({ date, complete: Boolean(complete) }, previous, now));
  }

  function recipe(items, mode, cookedWeight, overrides = {}) {
    if (!['simple', 'cooked'].includes(mode) || !items.length || items.length > limit) throw problem('Добавь ингредиенты блюда.');
    const ingredients = items.map(position);
    const base = mode === 'cooked' ? mass(cookedWeight) : ingredients.reduce((sum, item) => sum + item.grams, 0);
    const summary = totals(ingredients);
    const explicit = mode === 'cooked' ? nutrients(overrides) : {};
    const values = Object.fromEntries(keys.map(key => {
      const metric = summary.metrics[key];
      return [key, explicit[key] ?? (metric.missing ? null : metric.sum)];
    }));
    const estimated = summary.counts.estimate > 0 || keys.some(key => values[key] == null);
    return { ingredients, recipeMode: mode, base, values, estimated, overrides: explicit };
  }

  function saveCatalog(tx, input, previous, now = Date.now()) {
    if (!validId(input.id) || !['product', 'recipe'].includes(input.type)) throw problem('Некорректный продукт.');
    const facts = input.type === 'product'
      ? { base: mass(input.base), values: nutrients(input.values), estimated: Boolean(input.estimated) }
      : recipe(input.ingredients, input.recipeMode, input.base, input.overrides);
    const title = name(input.name);
    let path = collections.catalog + '/' + input.id;
    let old = guarded(tx, path, previous);
    if (input.type === 'product') {
      const key = productKey({ name: title, ...facts });
      const match = productIndex(tx.list(collections.catalog).filter(row => row.id !== input.id)).get(key);
      if (match && (!old || productKey(old) !== key)) {
        if (old || !match.automatic) throw problem('Такой продукт уже есть в Книге Трапезной.');
        path = collections.catalog + '/' + match.id;
        old = tx.get(path);
      }
    }
    const row = stamp({
      id: old?.id ?? input.id, type: input.type, name: title, note: String(input.note ?? '').trim().slice(0, 300),
      favorite: Boolean(input.favorite || (!previous && old?.favorite)),
      lastGrams: old?.lastGrams ?? (input.history ? mass(input.lastGrams) : null),
      lastUsed: old?.lastUsed ?? (input.history ? input.lastUsed : null), ...facts
    }, old, now);
    tx.set(path, row);
    return row;
  }

  function favorite(tx, expected, now = Date.now()) {
    const path = collections.catalog + '/' + expected.id;
    const current = guarded(tx, path, expected);
    const row = stamp({ ...current, favorite: !current.favorite }, current, now);
    tx.set(path, row);
    return row;
  }

  function fromCatalog(row, id = makeId()) {
    return { id, name: row.name, source: row.history ? null : row.id, base: row.base,
      grams: row.lastGrams ?? row.base, mode: catalogMode(row), values: { ...row.values } };
  }

  function library(meals, catalog) {
    const products = productIndex(catalog);
    const tracked = new Set(catalog.map(row => row.id));
    const history = new Map();
    // Old meals contribute a read-only view. Opening the library does not migrate the diary.
    for (const meal of meals) {
      if (meal?.deleted || !readable('meals', meal)) continue;
      for (const item of meal.items) {
        if (tracked.has(item.source)) continue;
        const key = productKey(item);
        const lastUsed = meal.updated || meal.created || 0;
        if (products.has(key) || (history.has(key) && history.get(key).lastUsed > lastUsed)) continue;
        history.set(key, { ...rememberedProduct(item, item.id, lastUsed), history: true });
      }
    }
    return [...products.values(), ...catalog.filter(row => row.type === 'recipe'), ...history.values()];
  }

  function favoriteFromHistory(tx, item, now = Date.now()) {
    const key = productKey(item);
    const existing = productIndex(tx.list(collections.catalog)).get(key);
    if (existing?.favorite) return existing;
    const id = existing?.id ?? availableProductId(tx, key);
    const { history, ...data } = item;
    const row = stamp({ ...(existing ?? { ...data, id }), favorite: true }, existing, now);
    tx.set(collections.catalog + '/' + id, row);
    return row;
  }

  function validFacts(values) {
    return values && keys.every(key => values[key] === null || (Number.isFinite(values[key]) && values[key] >= 0));
  }

  function validPosition(item) {
    return item && validId(item.id) && typeof item.name === 'string' && has(modes, item.mode) &&
      Number.isFinite(item.grams) && item.grams > 0 && Number.isFinite(item.base) && item.base > 0 && validFacts(item.values);
  }

  function setGoal(tx, value, now = Date.now()) {
    const kcal = number(value);
    if (!Number.isInteger(kcal) || kcal < 1 || kcal > 20000) throw problem('Введи дневную цель целым числом от 1 до 20 000 ккал.');
    const path = collections.settings + '/preferences';
    const previous = tx.get(path);
    if (previous?.kcal === kcal) return previous;
    const row = stamp({ kcal }, previous, now);
    tx.set(path, row);
    return row;
  }

  function readable(group, row) {
    if (row?.version !== version) return false;
    if (group === 'settings') return Number.isInteger(row.kcal) && row.kcal > 0 && row.kcal <= 20000;
    if (group === 'catalog') {
      return validId(row.id) && typeof row.name === 'string' && Number.isFinite(row.base) && row.base > 0 &&
        validFacts(row.values) && (row.type === 'product' || (row.type === 'recipe' &&
          Array.isArray(row.ingredients) && row.ingredients.every(validPosition) && row.overrides));
    }
    if (!validDate(row.date)) return false;
    if (group === 'days') return typeof row.complete === 'boolean';
    if (!has(kinds, row.kind)) return false;
    if (group === 'events') return Array.isArray(row.names) && row.names.every(value => typeof value === 'string');
    if (!validId(row.id) || !Array.isArray(row.items) || row.items.length > limit) return false;
    if (group === 'meals') return row.items.length > 0 && row.items.every(validPosition);
    return row.items.every(item => item && validId(item.id) && item.values && has(modes, item.mode));
  }

  function read(records, group) {
    const prefix = collections[group] + '/';
    // Unsupported or damaged food rows stay in the backup, isolated from game views.
    return Object.entries(records)
      .filter(([path, row]) => path.startsWith(prefix) && readable(group, row.d))
      .map(([, row]) => row.d);
  }
  const savedMeal = row => row?.deleted === false && readable('meals', row);

  root.VkachFood = Object.freeze({
    start, kinds, modes, keys, collections, limit, validDate, checkKey, makeId, mass, position, portion, totals,
    suggestedCalories, putDraft, clearDraft, finishMeal, setDeleted, setComplete, recipe, saveCatalog, favorite,
    fromCatalog, library, searchName, favoriteFromHistory, setGoal, read, savedMeal
  });
})(globalThis);
