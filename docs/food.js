// The diary has its own documents inside the existing save and backup envelope.
(function (root) {
  'use strict';

  const start = '2026-11-09';
  const version = 1;
  const kinds = Object.freeze({ breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекусы' });
  const modes = Object.freeze({ exact: 'Точно', estimate: 'Приблизительно', unknown: 'Без расчёта' });
  const keys = Object.freeze(['kcal', 'protein', 'fat', 'carbs']);
  const collections = Object.freeze({
    meals: 'food-meals', drafts: 'food-drafts', catalog: 'food-catalog', days: 'food-days', events: 'food-events'
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
    return Object.fromEntries(keys.map(key => [key, number(values[key])]));
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

  function finishMeal(tx, draft, now = Date.now()) {
    const data = prepareDraft(draft);
    const mealPath = collections.meals + '/' + data.id;
    const previous = tx.get(mealPath);
    if (previous && !data.edit) return previous;
    const path = collections.drafts + '/' + checkKey(data.date, data.kind);
    guarded(tx, path, draft);
    if (data.edit && (!previous || previous.deleted || previous.updated !== data.edit.updated)) throw conflict();
    if (!data.items.length) throw problem('Добавь хотя бы одну позицию.');
    const items = data.items.map(position);
    if (new Set(items.map(row => row.id)).size !== items.length) throw problem('В черновике повторились идентификаторы.');
    const row = stamp({ id: data.id, date: data.date, kind: data.kind, items, deleted: false }, previous, now);
    const portionsChanged = previous && items.some(item => previous.items.some(old => old.id === item.id && old.grams !== item.grams));
    tx.set(mealPath, row);
    tx.delete(path);
    reopenDay(tx, data.date, now);
    log(tx, row, previous ? (portionsChanged ? 'portion' : 'edit') : 'create', now);
    for (const item of items) {
      if (!item.source) continue;
      const sourcePath = collections.catalog + '/' + item.source;
      const source = tx.get(sourcePath);
      if (source) tx.set(sourcePath, stamp({ ...source, lastGrams: item.grams, lastUsed: now }, source, now));
    }
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
    const path = collections.catalog + '/' + input.id;
    const old = guarded(tx, path, previous);
    const facts = input.type === 'product'
      ? { base: mass(input.base), values: nutrients(input.values), estimated: Boolean(input.estimated) }
      : recipe(input.ingredients, input.recipeMode, input.base, input.overrides);
    const row = stamp({
      id: input.id, type: input.type, name: name(input.name), note: String(input.note ?? '').trim().slice(0, 300),
      favorite: Boolean(input.favorite), lastGrams: old?.lastGrams ?? null, lastUsed: old?.lastUsed ?? null, ...facts
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
    const mode = keys.every(key => row.values[key] == null) ? 'unknown'
      : row.estimated || keys.some(key => row.values[key] == null) ? 'estimate' : 'exact';
    return { id, name: row.name, source: row.id, base: row.base, grams: row.lastGrams ?? row.base, mode, values: { ...row.values } };
  }

  function read(records, group) {
    const prefix = collections[group] + '/';
    return Object.entries(records)
      .filter(([path, row]) => path.startsWith(prefix) && row.d?.version === version)
      .map(([, row]) => row.d);
  }

  root.VkachFood = Object.freeze({
    start, kinds, modes, keys, collections, limit, validDate, checkKey, makeId, position, portion, totals,
    suggestedCalories, putDraft, clearDraft, finishMeal, setDeleted, setComplete, recipe, saveCatalog, favorite, fromCatalog, read
  });
})(globalThis);
